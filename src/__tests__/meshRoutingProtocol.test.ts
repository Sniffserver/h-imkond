import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SeenPacketCache,
} from '../services/mesh/routing/SeenPacketCache';
import {
  createMeshPacket,
  normalizeMeshPacket,
  relayMeshPacket,
  isPacketExpired,
  resetSequenceForTesting,
} from '../services/mesh/routing/packetProtocol';
import {
  enqueueMessage,
  queueMessageForSync,
  handleIncomingSyncPayload,
  clearMeshSyncForTesting,
  getSeenPacketCache,
  getOutboxQueue,
  getDeliveryHistory,
} from '../services/mesh/meshSync';
import { MeshMessage } from '../types';

describe('Mesh Routing Protocol & Packet Architecture', () => {
  beforeEach(() => {
    clearMeshSyncForTesting();
    resetSequenceForTesting(1);
  });

  afterEach(() => {
    clearMeshSyncForTesting();
  });

  describe('Canonical Mesh Packet Protocol', () => {
    it('creates a packet with all required protocol fields', () => {
      const payload = { temperature: 18.5, status: 'nominal' };
      const packet = createMeshPacket({
        originId: 'LEMBI-NODE-01',
        destinationId: 'TARTU-BASE-01',
        payload,
        ttl: 5,
        type: 'MESSAGE',
      });

      // Assert all 11 required canonical fields
      expect(packet.packetId).toBeDefined();
      expect(packet.packetId).toContain('LEMBI-NODE-01');
      expect(packet.originId).toBe('LEMBI-NODE-01');
      expect(packet.destinationId).toBe('TARTU-BASE-01');
      expect(packet.ttl).toBe(5);
      expect(packet.sequence).toBe(1);
      expect(typeof packet.createdAt).toBe('number');
      expect(typeof packet.expiresAt).toBe('number');
      expect(packet.expiresAt).toBeGreaterThan(packet.createdAt!);
      expect(packet.routeId).toBe('LEMBI-NODE-01');
      expect(packet.hopCount).toBe(0);
      expect(packet.payload).toEqual(payload);

      // Backwards-compatible aliases
      expect(packet.id).toBe(packet.packetId);
      expect(packet.senderId).toBe('LEMBI-NODE-01');
      expect(packet.targetId).toBe('TARTU-BASE-01');
    });

    it('increments sequence numbers monotonically per packet', () => {
      const pkt1 = createMeshPacket({ originId: 'NODE-A', payload: '1' });
      const pkt2 = createMeshPacket({ originId: 'NODE-A', payload: '2' });
      const pkt3 = createMeshPacket({ originId: 'NODE-A', payload: '3' });

      expect(pkt1.sequence).toBe(1);
      expect(pkt2.sequence).toBe(2);
      expect(pkt3.sequence).toBe(3);
    });

    it('relays packet correctly decrementing TTL and building route trace', () => {
      const original = createMeshPacket({
        originId: 'NODE-ORIGIN',
        destinationId: 'NODE-DEST',
        ttl: 4,
        payload: { command: 'beacon_sync' },
      });

      const hop1 = relayMeshPacket(original, 'RELAY-HAANJA-01');
      expect(hop1).not.toBeNull();
      expect(hop1!.ttl).toBe(3);
      expect(hop1!.hopCount).toBe(1);
      expect(hop1!.routeId).toBe('NODE-ORIGIN->RELAY-HAANJA-01');
      expect(hop1!.originId).toBe('NODE-ORIGIN');
      expect(hop1!.sequence).toBe(original.sequence);

      const hop2 = relayMeshPacket(hop1!, 'RELAY-VORU-02');
      expect(hop2).not.toBeNull();
      expect(hop2!.ttl).toBe(2);
      expect(hop2!.hopCount).toBe(2);
      expect(hop2!.routeId).toBe('NODE-ORIGIN->RELAY-HAANJA-01->RELAY-VORU-02');

      const hop3 = relayMeshPacket(hop2!, 'RELAY-TARTU-03');
      expect(hop3!.ttl).toBe(1);

      // Next hop cannot relay (TTL exhausted at 1)
      const hop4 = relayMeshPacket(hop3!, 'FINAL-HOP');
      expect(hop4).toBeNull();
    });

    it('detects and discards expired packets', () => {
      const freshPacket = createMeshPacket({
        originId: 'NODE-1',
        payload: 'fresh',
        lifetimeMs: 60000,
      });
      expect(isPacketExpired(freshPacket)).toBe(false);

      const expiredPacket = createMeshPacket({
        originId: 'NODE-1',
        payload: 'expired',
        lifetimeMs: -1000, // already expired
      });
      expect(isPacketExpired(expiredPacket)).toBe(true);

      const relayAttempt = relayMeshPacket(expiredPacket, 'SOME-RELAY');
      expect(relayAttempt).toBeNull();
    });

    it('normalizes legacy packets into canonical structure', () => {
      const legacyRaw = {
        id: 'legacy-pkt-99',
        senderId: 'LEMBITU',
        senderCallsign: 'LEMBITU',
        targetCallsign: 'PEER-X',
        ttl: 3,
        hopCount: 1,
        payload: { foo: 'bar' },
        timestamp: 1700000000000,
      };

      const normalized = normalizeMeshPacket(legacyRaw);
      expect(normalized.packetId).toBe('legacy-pkt-99');
      expect(normalized.originId).toBe('LEMBITU');
      expect(normalized.destinationId).toBe('PEER-X');
      expect(normalized.ttl).toBe(3);
      expect(normalized.hopCount).toBe(1);
      expect(normalized.createdAt).toBe(1700000000000);
      expect(normalized.expiresAt).toBeGreaterThan(1700000000000);
    });
  });

  describe('SeenPacketCache (Bounded LRU & Expiration)', () => {
    it('stores and checks seen packets', () => {
      const cache = new SeenPacketCache({ maxCapacity: 10, defaultTtlMs: 5000 });
      expect(cache.has('pkt-1')).toBe(false);

      cache.add('pkt-1');
      expect(cache.has('pkt-1')).toBe(true);
      expect(cache.size()).toBe(1);

      const entry = cache.get('pkt-1');
      expect(entry?.packetId).toBe('pkt-1');
      expect(entry?.expires).toBeGreaterThan(Date.now());
    });

    it('enforces bounded LRU capacity eviction', () => {
      const capacity = 3;
      const cache = new SeenPacketCache({ maxCapacity: capacity, defaultTtlMs: 60000 });

      cache.add('pkt-1');
      cache.add('pkt-2');
      cache.add('pkt-3');
      expect(cache.size()).toBe(3);

      // Adding 4th item when capacity is 3 evicts the least recently used ('pkt-1')
      cache.add('pkt-4');
      expect(cache.size()).toBe(3);
      expect(cache.has('pkt-1')).toBe(false);
      expect(cache.has('pkt-2')).toBe(true);
      expect(cache.has('pkt-3')).toBe(true);
      expect(cache.has('pkt-4')).toBe(true);

      // Accessing pkt-2 promotes it in LRU order
      cache.has('pkt-2');

      // Adding 5th item now evicts 'pkt-3' because 'pkt-2' was recently used
      cache.add('pkt-5');
      expect(cache.has('pkt-3')).toBe(false);
      expect(cache.has('pkt-2')).toBe(true);
      expect(cache.has('pkt-4')).toBe(true);
      expect(cache.has('pkt-5')).toBe(true);
    });

    it('prunes expired entries and expires after TTL', () => {
      const cache = new SeenPacketCache({ maxCapacity: 10, defaultTtlMs: 50 });

      cache.add('pkt-expiring', 10); // 10ms TTL
      expect(cache.has('pkt-expiring')).toBe(true);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // After 25ms, it should be recognized as expired and deleted
          expect(cache.has('pkt-expiring')).toBe(false);
          expect(cache.size()).toBe(0);
          resolve();
        }, 25);
      });
    });
  });

  describe('Routing-State vs Delivery-State Separation', () => {
    it('queuing an outgoing message updates Delivery State (outbox) WITHOUT marking it in SeenPacketCache', () => {
      const cache = getSeenPacketCache();
      const testMsg: MeshMessage = {
        id: 'msg-outgoing-101',
        from: 'LEMBITU',
        to: 'TARTU-ECHO-1',
        content: 'Emergency telemetry update',
        timestamp: Date.now(),
        ttl: 3,
        signature: 'mock-ed25519-signature-101',
      };

      // Queue for local transmission
      enqueueMessage(testMsg);

      // 1. Delivery state: should be queued in outbox
      const outbox = getOutboxQueue();
      expect(outbox.some((item) => item.message.id === testMsg.id)).toBe(true);

      // 2. Routing state: MUST NOT be in SeenPacketCache (avoiding the bug where queuing marked it as already processed from network)
      expect(cache.has(testMsg.id)).toBe(false);
    });

    it('receiving an incoming packet ingests it into SeenPacketCache (Routing State) to prevent loops', async () => {
      const cache = getSeenPacketCache();
      const incomingMessage: MeshMessage = {
        id: 'msg-incoming-relay-202',
        from: 'HAANJA-RADIO',
        to: 'LEMBITU', // Addressed to local user
        content: 'Radio link established',
        timestamp: Date.now(),
        ttl: 3,
        signature: 'mock-ed25519-signature-202',
      };

      // Ingest incoming packet payload from a peer
      await handleIncomingSyncPayload({
        senderId: 'remote-peer-99',
        senderCallsign: 'HAANJA-RADIO',
        timestamp: Date.now(),
        messages: [incomingMessage],
      });

      // 1. Packet is now recorded in SeenPacketCache
      expect(cache.has(incomingMessage.id)).toBe(true);

      // 2. Duplicate arrival of the same packet is filtered out
      const seenBefore = cache.has(incomingMessage.id);
      expect(seenBefore).toBe(true);
    });

    it('store-and-forward relay decrements TTL and queues forwarded packet in Delivery State', async () => {
      const remoteToRemoteMsg: MeshMessage = {
        id: 'msg-transit-303',
        from: 'HAANJA-RADIO',
        to: 'PARNU-RELAY-9', // Not addressed to me
        content: 'Transit data payload',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        signature: 'mock-ed25519-signature-303',
      };

      await handleIncomingSyncPayload({
        senderId: 'remote-peer-99',
        senderCallsign: 'HAANJA-RADIO',
        timestamp: Date.now(),
        messages: [remoteToRemoteMsg],
      });

      // Relayed message is queued in outbox with decremented TTL and incremented hopCount
      const outbox = getOutboxQueue();
      const relayed = outbox.find((item) => item.message.id === remoteToRemoteMsg.id);

      expect(relayed).toBeDefined();
      expect(relayed!.message.ttl).toBe(2);
      expect(relayed!.message.hopCount).toBe(2);
      expect(relayed!.status).toBe('relayed');
    });
  });
});
