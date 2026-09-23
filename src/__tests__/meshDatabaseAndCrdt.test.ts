import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CRDTEventLogEngine,
  crdtEventLogEngine,
} from '../services/mesh/crdt/signedEventLog';
import {
  meshDb,
  openMeshDatabase,
  STORES,
} from '../services/mesh/db/meshDatabase';
import {
  enqueueMessage,
  triggerMeshSync,
  handleIncomingSyncPayload,
  clearMeshSyncForTesting,
  getOutboxQueue,
  initMeshSync,
} from '../services/mesh/meshSync';
import { MeshMessage } from '../types';

describe('Persistent Mesh Database & Signed CRDT Event Log Engine', () => {
  beforeEach(() => {
    clearMeshSyncForTesting();
    meshDb.clearMemoryStorage();
  });

  afterEach(() => {
    clearMeshSyncForTesting();
    meshDb.clearMemoryStorage();
  });

  describe('Persistent Outbox Storage (hoimu_mesh_db.outbox)', () => {
    it('persists queued outbox items across app reloads and restarts', async () => {
      const pendingMessage: MeshMessage = {
        id: 'msg-store-forward-900',
        from: 'HAANJA-TOWER',
        to: 'TARTU-BASE-01',
        content: 'Relay telemetry packet for store-and-forward',
        timestamp: Date.now(),
        ttl: 4,
        signature: 'sig-mock-900',
      };

      // 1. Enqueue message
      enqueueMessage(pendingMessage, 'queued');

      // Check in-memory outbox
      expect(getOutboxQueue().length).toBe(1);

      // Verify it was saved to persistent database layer
      const dbItems = await meshDb.getPendingOutboxItems();
      expect(dbItems.length).toBe(1);
      expect(dbItems[0].id).toBe(pendingMessage.id);
      expect(dbItems[0].status).toBe('queued');

      // 2. Simulate app crash / restart: clear in-memory outbox, then run initMeshSync
      clearMeshSyncForTesting();
      // (keep DB storage intact)
      await meshDb.saveOutboxItem(dbItems[0]);

      initMeshSync();
      // Wait microtask for async load
      await new Promise((r) => setTimeout(r, 10));

      const recoveredOutbox = getOutboxQueue();
      expect(recoveredOutbox.length).toBe(1);
      expect(recoveredOutbox[0].message.id).toBe(pendingMessage.id);
      expect(recoveredOutbox[0].status).toBe('queued');
    });

    it('updates transmission status in database when outbox is transmitted', async () => {
      const msg: MeshMessage = {
        id: 'msg-transmit-808',
        from: 'LEMBITU',
        to: '*',
        content: 'Beacon broadcast',
        timestamp: Date.now(),
        ttl: 3,
        signature: 'sig-808',
      };

      enqueueMessage(msg, 'queued');
      triggerMeshSync();

      // In-memory queue spliced
      expect(getOutboxQueue().length).toBe(0);

      // Check DB: item is recorded as transmitted
      const pending = await meshDb.getPendingOutboxItems();
      expect(pending.length).toBe(0); // No longer in pending state
    });
  });

  describe('Signed Event Log & CRDT Projection Engine', () => {
    it('creates immutable signed mutation events with Lamport clock and version vectors', () => {
      const engine = new CRDTEventLogEngine('NODE-TARTU', 'TARTU-01');

      const event1 = engine.createEvent('resource', 'res_solar_panel_1', {
        title: 'Solar Panel 100W',
        quantity: 2,
        status: 'available',
      });

      expect(event1.opId).toBeDefined();
      expect(event1.opId).toContain('NODE-TARTU');
      expect(event1.authorId).toBe('NODE-TARTU');
      expect(event1.authorCallsign).toBe('TARTU-01');
      expect(event1.clock).toBe(1);
      expect(event1.vectorClock['NODE-TARTU']).toBe(1);
      expect(event1.tombstone).toBe(false);
      expect(event1.signature).toBeDefined();

      const event2 = engine.createEvent('resource', 'res_solar_panel_1', {
        quantity: 1, // updated quantity
      }, 'update');

      expect(event2.clock).toBe(2);
      expect(event2.vectorClock['NODE-TARTU']).toBe(2);

      // Verify projection
      const projected = engine.getEntity('resource', 'res_solar_panel_1');
      expect(projected).toBeDefined();
      expect(projected.title).toBe('Solar Panel 100W');
      expect(projected.quantity).toBe(1);
    });

    it('handles explicit tombstones and ensures deletes supersede older writes', () => {
      const engine = new CRDTEventLogEngine('NODE-TARTU', 'TARTU-01');

      engine.createEvent('poi', 'poi_water_spring', {
        name: 'Fresh Spring Water',
        lat: 58.378,
        lng: 26.729,
      });

      expect(engine.getActiveEntities('poi').length).toBe(1);

      // Create explicit tombstone
      const deleteEvent = engine.createTombstone('poi', 'poi_water_spring');
      expect(deleteEvent.tombstone).toBe(true);
      expect(deleteEvent.action).toBe('delete');

      // Projection now filters out deleted tombstone
      expect(engine.getActiveEntities('poi').length).toBe(0);
      expect(engine.getEntity('poi', 'poi_water_spring')).toBeNull();
    });

    it('performs deterministic conflict resolution (LWW by Lamport clock and Author ID)', () => {
      const engine = new CRDTEventLogEngine('LOCAL-NODE', 'LOCAL');

      // Peer A publishes update at clock 5
      const eventPeerA = {
        opId: 'op_PEER-A_c5_111',
        authorId: 'PEER-A',
        authorCallsign: 'PEER-A',
        clock: 5,
        vectorClock: { 'PEER-A': 5 },
        entityType: 'resource' as const,
        entityId: 'medkit_01',
        action: 'insert' as const,
        fields: { name: 'First Aid Kit (A version)', count: 5 },
        tombstone: false,
        timestamp: 1700000000000,
      };

      // Peer B publishes concurrent update at clock 6
      const eventPeerB = {
        opId: 'op_PEER-B_c6_222',
        authorId: 'PEER-B',
        authorCallsign: 'PEER-B',
        clock: 6,
        vectorClock: { 'PEER-B': 6 },
        entityType: 'resource' as const,
        entityId: 'medkit_01',
        action: 'update' as const,
        fields: { name: 'First Aid Kit (B newer version)', count: 10 },
        tombstone: false,
        timestamp: 1700000001000,
      };

      // Ingest in reverse order to test causality convergence
      engine.ingestEvents([eventPeerB, eventPeerA]);

      const projected = engine.getEntity('resource', 'medkit_01');
      expect(projected).toBeDefined();
      expect(projected.name).toBe('First Aid Kit (B newer version)');
      expect(projected.count).toBe(10);
      expect(engine.getLamportClock()).toBeGreaterThanOrEqual(6);
    });

    it('syncs CRDT event deltas via handleIncomingSyncPayload', async () => {
      const crdtEvent = {
        opId: 'op_RADIO-GATEWAY_c10_xyz',
        authorId: 'RADIO-GATEWAY',
        authorCallsign: 'GATEWAY-01',
        clock: 10,
        vectorClock: { 'RADIO-GATEWAY': 10 },
        entityType: 'proposal' as const,
        entityId: 'prop_radio_repeater_setup',
        action: 'insert' as const,
        fields: {
          title: 'Deploy repeater on Munamägi hill',
          votesYes: 14,
          status: 'passed',
        },
        tombstone: false,
        timestamp: Date.now(),
      };

      // Receive remote sync payload with attached signed CRDT event log delta
      await handleIncomingSyncPayload({
        senderId: 'RADIO-GATEWAY',
        senderCallsign: 'GATEWAY-01',
        timestamp: Date.now(),
        messages: [],
        crdtEvents: [crdtEvent],
      });

      // Assert that global CRDT engine has ingested and projected the entity
      const proposal = crdtEventLogEngine.getEntity('proposal', 'prop_radio_repeater_setup');
      expect(proposal).toBeDefined();
      expect(proposal.title).toBe('Deploy repeater on Munamägi hill');
      expect(proposal.votesYes).toBe(14);
    });
  });
});
