import { describe, it, expect, beforeEach } from 'vitest';
import {
  stageCreate,
  stageSign,
  stageEncrypt,
  stageQueue,
  stageTransmit,
  stageReceive,
  stageVerify,
  stageDecrypt,
  stageDedup,
  stageRoute,
  stageDeliver,
  PacketLifecyclePipeline,
} from '../services/mesh/pipeline/packetLifecycle';
import { SeenPacketCache } from '../services/mesh/routing/SeenPacketCache';
import { MeshTransportManager } from '../services/mesh/transport/MeshTransportManager';
import { deriveEd25519KeyPairFromSeed } from '../services/crypto/meshCrypto';
import { HoimuRuntime } from '../services/runtime/hoimuRuntime';
import { crdtEventLogEngine } from '../services/mesh/crdt/signedEventLog';

describe('HÕIMU 11-Stage Discrete Packet Lifecycle Architecture', () => {
  let seenCache: SeenPacketCache;
  let transportManager: MeshTransportManager;

  beforeEach(() => {
    seenCache = new SeenPacketCache({ maxEntries: 100, defaultTtlMs: 60000 });
    transportManager = new MeshTransportManager({ localNodeId: 'TARTU-GW-01' });
    crdtEventLogEngine.clearMemoryLog();
  });

  describe('Individual Stage Testing', () => {
    it('1. CREATE Stage generates a valid, standard-compliant MeshPacket', () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        destinationId: 'NODE-BOB',
        payload: { text: 'Emergency Solar Backup Available' },
        ttl: 5,
      });

      expect(packet.packetId).toMatch(/^pkt_NODE-ALICE_/);
      expect(packet.originId).toBe('NODE-ALICE');
      expect(packet.destinationId).toBe('NODE-BOB');
      expect(packet.ttl).toBe(5);
      expect(packet.hopCount).toBe(0);
      expect(packet.payload.text).toBe('Emergency Solar Backup Available');
    });

    it('2. SIGN Stage applies genuine canonical Ed25519 signature', async () => {
      const keyPair = await deriveEd25519KeyPairFromSeed('alice_seed');
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        payload: { message: 'Bioregion Alert' },
      });

      const signedPacket = await stageSign(packet, keyPair.keyPair.privateKey);

      expect(signedPacket.signature).toBeDefined();
      expect(signedPacket.signature?.length).toBeGreaterThanOrEqual(64);
    });

    it('3. ENCRYPT Stage seals payload with X25519 authenticated encryption for direct peers', async () => {
      const aliceKeys = await deriveEd25519KeyPairFromSeed('alice_seed');
      const bobKeys = await deriveEd25519KeyPairFromSeed('bob_seed');

      const packet = stageCreate({
        originId: 'NODE-ALICE',
        destinationId: 'NODE-BOB',
        payload: { secretCoords: [58.38, 26.72] },
      });

      const encryptedPacket = await stageEncrypt(
        packet,
        bobKeys.x25519PublicKeyHex,
        aliceKeys.keyPair.privateKeyHex
      );

      expect((encryptedPacket.payload as any).__encrypted).toBe(true);
      expect((encryptedPacket.payload as any).cipherPayload).toBeDefined();
      expect((encryptedPacket.payload as any).nonceHex).toBeDefined();
    });

    it('4. QUEUE Stage enqueues packet for persistent store-and-forward', async () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        payload: { text: 'Queue me' },
      });

      const queued = await stageQueue(packet);
      expect(queued.packetId).toBe(packet.packetId);
    });

    it('5. TRANSMIT Stage converts to compact binary framing and broadcasts', async () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        payload: { text: 'Transmit me' },
      });

      const result = await stageTransmit(packet, transportManager);
      expect(result.success).toBe(true);
      expect(result.byteCount).toBeGreaterThan(32);
      expect(result.byteCount).toBeLessThan(100);
    });

    it('6. RECEIVE Stage ingests compact binary wire bytes accurately', () => {
      const packet = stageCreate({
        originId: 'TARTU-01',
        payload: { msg: 'Binary Ingest Test' },
      });

      const parsed = stageReceive(packet);
      expect(parsed.packetId).toBe(packet.packetId);
      expect(parsed.originId).toBe('TARTU-01');
    });

    it('7. VERIFY Stage validates genuine signatures and rejects tampered envelopes', async () => {
      const aliceKeys = await deriveEd25519KeyPairFromSeed('alice_seed');
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        payload: { data: 'Authentic content' },
      });

      const signedPacket = await stageSign(packet, aliceKeys.keyPair.privateKey);

      // Verify authentic
      const isValid = await stageVerify(signedPacket, aliceKeys.publicKeyHex);
      expect(isValid).toBe(true);

      // Tamper payload
      const tamperedPacket = { ...signedPacket, payload: { data: 'Forged content' } };
      const isTamperedValid = await stageVerify(tamperedPacket, aliceKeys.publicKeyHex);
      expect(isTamperedValid).toBe(false);
    });

    it('8. DECRYPT Stage recovers plaintext using recipient private key', async () => {
      const aliceKeys = await deriveEd25519KeyPairFromSeed('alice_seed');
      const bobKeys = await deriveEd25519KeyPairFromSeed('bob_seed');

      const packet = stageCreate({
        originId: 'NODE-ALICE',
        destinationId: 'NODE-BOB',
        payload: { secret: 'Emajõgi Safehouse 10' },
      });

      const encrypted = await stageEncrypt(packet, bobKeys.x25519PublicKeyHex, aliceKeys.keyPair.privateKeyHex);
      const decrypted = await stageDecrypt(encrypted, bobKeys.keyPair.privateKeyHex);

      expect(decrypted.isEncrypted).toBe(true);
      expect(decrypted.decryptedPayload.secret).toBe('Emajõgi Safehouse 10');
    });

    it('9. DEDUP Stage detects duplicate packets using bounded LRU cache', () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        payload: { text: 'Once only' },
      });

      expect(stageDedup(packet, seenCache)).toBe(false);
      seenCache.markSeen(packet.packetId!);
      expect(stageDedup(packet, seenCache)).toBe(true);
    });

    it('10. ROUTE Stage decrements TTL and increments hop count for store-and-forward relay', async () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        destinationId: 'NODE-CHARLIE',
        ttl: 4,
        payload: { text: 'Relay me' },
      });

      const routeResult = await stageRoute(packet, 'INTERMEDIATE-RELAY-01', transportManager, seenCache);
      expect(routeResult.relayed).toBe(true);
      expect(routeResult.nextTtl).toBe(3);
      expect(routeResult.nextHop).toBe(1);
    });

    it('11. DELIVER Stage delivers matching packets and applies CRDT mutations', async () => {
      const packet = stageCreate({
        originId: 'NODE-ALICE',
        destinationId: 'MY-LOCAL-NODE',
        payload: {
          text: 'Direct message for you',
          crdtEvents: [
            {
              opId: 'crdt_op_100',
              authorId: 'NODE-ALICE',
              authorCallsign: 'ALICE',
              clock: 1,
              vectorClock: { 'NODE-ALICE': 1 },
              entityType: 'resource',
              entityId: 'res-solar-battery',
              action: 'insert',
              fields: { name: 'Solar 100W Panel', quantity: 2 },
              tombstone: false,
              timestamp: Date.now(),
            },
          ],
        },
      });

      const delivery = await stageDeliver(packet, 'MY-LOCAL-NODE');
      expect(delivery.deliveredToLocal).toBe(true);
      expect(delivery.crdtApplied).toBe(true);

      const activeResources = crdtEventLogEngine.getActiveEntities('resource');
      expect(activeResources.length).toBe(1);
      expect(activeResources[0].name).toBe('Solar 100W Panel');
    });
  });

  describe('End-to-End Packet Lifecycle Pipeline & Runtime Integration', () => {
    it('executes full outbound and inbound pipeline with complete trace', async () => {
      const aliceKeys = await deriveEd25519KeyPairFromSeed('alice_pipeline_seed');
      const bobKeys = await deriveEd25519KeyPairFromSeed('bob_pipeline_seed');

      const alicePipeline = new PacketLifecyclePipeline('ALICE-NODE', transportManager, aliceKeys, seenCache);
      const bobPipeline = new PacketLifecyclePipeline('BOB-NODE', transportManager, bobKeys, seenCache);

      // Outbound (CREATE -> SIGN -> ENCRYPT -> QUEUE -> TRANSMIT)
      const outResult = await alicePipeline.processOutbound(
        {
          originId: 'ALICE-NODE',
          destinationId: 'BOB-NODE',
          payload: { note: 'Secret river crossing' },
          ttl: 3,
        },
        bobKeys.x25519PublicKeyHex
      );

      expect(outResult.trace.map((t) => t.stage)).toEqual(['CREATE', 'SIGN', 'ENCRYPT', 'QUEUE', 'TRANSMIT']);
      expect(outResult.packet.signature).toBeDefined();

      // Inbound (RECEIVE -> VERIFY -> DECRYPT -> DEDUP -> ROUTE -> DELIVER)
      const inResult = await bobPipeline.processInbound(outResult.packet, aliceKeys.publicKeyHex);

      expect(inResult.trace.map((t) => t.stage)).toEqual(['RECEIVE', 'VERIFY', 'DECRYPT', 'DEDUP', 'ROUTE', 'DELIVER']);
      expect(inResult.status).toBe('DELIVERED');
      expect(inResult.decryptedPayload.note).toBe('Secret river crossing');
    });

    it('initializes HoimuRuntime tree with modular Identity, Storage, Capabilities & Mesh protocol', async () => {
      const runtime = new HoimuRuntime('CUSTOM-NODE-01', 'TARTU-PIONEER');
      await runtime.init('seed_test_runtime');

      const status = runtime.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.nodeId).toBe('CUSTOM-NODE-01');
      expect(status.callsign).toBe('TARTU-PIONEER');
      expect(status.ed25519PubKey.length).toBeGreaterThan(0);
      expect(status.storageReady).toBe(true);
      expect(status.capabilities).toBeDefined();
    });
  });
});
