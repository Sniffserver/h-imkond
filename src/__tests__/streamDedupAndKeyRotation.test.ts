import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoRaBridgeTransport } from '../services/mesh/transport/LoRaBridgeTransport';
import { publishBridgeStreamEvent, setMockBridgeMode } from '../services/comms/piBridge';
import { DedupCache } from '../mesh/dedup';
import { DurableDedupStore } from '../storage/dedupStore';
import { PeerStore, StoredPeer, KeyRotationStatement } from '../storage/peers';
import { generateEd25519KeyPair } from '../core/crypto/ed25519';

describe('Streaming Transport, Durable Dedup & Secure Key Rotation', () => {
  beforeEach(() => {
    localStorage.clear();
    setMockBridgeMode(true);
    DurableDedupStore.clearMemory();
    PeerStore.clearMemory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. LoRaBridgeTransport Stream Abstraction & Real Latency (Req 31 & 32)
  // =========================================================================
  describe('LoRaBridgeTransport Stream & Real Latency Timing', () => {
    it('dispatches incoming packets via real-time stream without 12-second polling', async () => {
      const transport = new LoRaBridgeTransport();
      await transport.start();

      const receivedPackets: any[] = [];
      transport.subscribe((packet) => {
        receivedPackets.push(packet);
      });

      // Emit real-time PACKET_RX event from Pi bridge stream
      publishBridgeStreamEvent({
        type: 'PACKET_RX',
        timestamp: Date.now(),
        payload: {
          packet: {
            id: 'STREAM_PKT_01',
            type: 'MESSAGE',
            senderId: 'NODE_STREAMER',
            senderCallsign: 'STREAM-01',
            timestamp: Date.now(),
            ttl: 3,
            hopCount: 1,
            payload: { text: 'Streamed message' },
          },
          snr: 10.2,
          rssi: -78,
        },
      });

      expect(receivedPackets.length).toBe(1);
      expect(receivedPackets[0].id).toBe('STREAM_PKT_01');
      expect(receivedPackets[0].transportMeta?.rssi).toBe(-78);
      expect(receivedPackets[0].transportMeta?.snr).toBe(10.2);

      await transport.stop();
    });

    it('returns real measured latency and does not clamp with synthetic Math.max(120, ...)', async () => {
      const transport = new LoRaBridgeTransport();
      await transport.start();

      const sendResult = await transport.send({
        id: 'MEASURED_TX_01',
        type: 'MESSAGE',
        senderId: 'LOCAL_NODE',
        senderCallsign: 'LOCAL',
        timestamp: Date.now(),
        ttl: 4,
        hopCount: 0,
        payload: 'test',
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.latencyMs).toBeDefined();
      // In fast local test / mock, duration is under 50ms.
      // Previously, Math.max(120, duration) forced it to be >= 120ms.
      // Now it reports the actual measured physical time!
      expect(sendResult.latencyMs).toBeLessThan(120);

      await transport.stop();
    });
  });

  // =========================================================================
  // 2. Durable Dedup & Unambiguous API (Req 33 & 34)
  // =========================================================================
  describe('Durable Dedup & Unambiguous Expiration API', () => {
    it('provides distinct markSeenUntil and markSeenFor methods', () => {
      const cache = new DedupCache({ autoHydrateDurable: false });

      // markSeenUntil with absolute timestamp
      const absoluteExpiry = Date.now() + 60_000;
      cache.markSeenUntil('PKT_UNTIL_01', absoluteExpiry);
      expect(cache.isDuplicate('PKT_UNTIL_01')).toBe(true);

      // markSeenFor with relative TTL duration
      cache.markSeenFor('PKT_FOR_02', 30_000);
      expect(cache.isDuplicate('PKT_FOR_02')).toBe(true);

      expect(cache.isDuplicate('NON_EXISTENT')).toBe(false);
    });

    it('survives reboots: new DedupCache instance hydrates unexpired seen packets', async () => {
      const session1Cache = new DedupCache({ autoHydrateDurable: false });

      // In session 1, mark packets seen with durable persistence
      const expiry = Date.now() + 100_000;
      session1Cache.markSeenUntil('REBOOT_SURVIVOR_01', expiry, {
        originId: 'NODE_ALICE',
        sequence: 42,
      });

      expect(session1Cache.isDuplicate('REBOOT_SURVIVOR_01')).toBe(true);

      // Simulate App Restart / Reboot (new Cache instance)
      const session2Cache = new DedupCache({ autoHydrateDurable: false });
      expect(session2Cache.isDuplicate('REBOOT_SURVIVOR_01')).toBe(false); // Before hydration

      // Hydrate from durable storage
      const loaded = await session2Cache.hydrateFromStorage();
      expect(loaded).toBeGreaterThanOrEqual(1);

      // Survivor packet is recognized as duplicate in the new session!
      expect(session2Cache.isDuplicate('REBOOT_SURVIVOR_01')).toBe(true);
    });

    it('detects old/replayed sequences within origin sequence window', () => {
      const cache = new DedupCache({ autoHydrateDurable: false });
      cache.markSeenUntil('PKT_SEQ_100', Date.now() + 60_000, {
        originId: 'NODE_BOB',
        sequence: 500,
      });

      // Sequence 480 is fresh/within margin
      expect(cache.isSequenceOldOrSeen('NODE_BOB', 480, 50)).toBe(false);

      // Sequence 200 is way behind highest seen (500) -> old/replayed
      expect(cache.isSequenceOldOrSeen('NODE_BOB', 200, 50)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Cryptographic Key Rotation & Non-blind Upsert (Req 35)
  // =========================================================================
  describe('Cryptographic Peer Key Rotation & Non-Blind Upsert', () => {
    it('blocks unauthorized public key replacement when incoming key differs without rotation proof', async () => {
      const aliceKeys = await generateEd25519KeyPair(true);
      const attackerKeys = await generateEd25519KeyPair(true);

      // 1. Initial trusted registration of Alice
      const initialPeer: StoredPeer = {
        nodeId: 'ALICE_NODE_01',
        callsign: 'ALICE-01',
        signingPublicKeyHex: aliceKeys.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
        keyVersion: 1,
      };

      await PeerStore.upsertPeer(initialPeer);

      const storedAlice = await PeerStore.getPeer('ALICE_NODE_01');
      expect(storedAlice?.signingPublicKeyHex).toBe(aliceKeys.publicKeyHex);

      // 2. Attacker attempts to forge an update with attacker's public key without rotation proof
      const maliciousUpdate: StoredPeer = {
        nodeId: 'ALICE_NODE_01',
        callsign: 'ALICE-01',
        signingPublicKeyHex: attackerKeys.publicKeyHex, // Different key!
        lastSeen: Date.now(),
        hopCount: 1,
      };

      const result = await PeerStore.upsertPeer(maliciousUpdate);
      expect(result.keyRotated).toBe(false);

      // Public key must remain Alice's genuine trusted key! Attacker's key was REJECTED.
      const checkedPeer = await PeerStore.getPeer('ALICE_NODE_01');
      expect(checkedPeer?.signingPublicKeyHex).toBe(aliceKeys.publicKeyHex);
      expect(checkedPeer?.signingPublicKeyHex).not.toBe(attackerKeys.publicKeyHex);
    });

    it('successfully rotates key when accompanied by valid KeyRotationStatement signed by old key', async () => {
      const oldKeys = await generateEd25519KeyPair(true);
      const newKeys = await generateEd25519KeyPair(true);

      // Initial registration
      await PeerStore.upsertPeer({
        nodeId: 'ROTATING_NODE_02',
        callsign: 'ROTATOR',
        signingPublicKeyHex: oldKeys.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
        keyVersion: 1,
      });

      // Generate authentic key rotation statement signed by old key and new key
      const rotationProof = await PeerStore.createKeyRotationStatement(
        'ROTATING_NODE_02',
        oldKeys.privateKey,
        oldKeys.publicKeyHex,
        newKeys.privateKey,
        newKeys.publicKeyHex,
        2 // New key version
      );

      // Perform verified key rotation
      const rotationUpdate: StoredPeer = {
        nodeId: 'ROTATING_NODE_02',
        callsign: 'ROTATOR',
        signingPublicKeyHex: newKeys.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      };

      const result = await PeerStore.upsertPeer(rotationUpdate, rotationProof);
      expect(result.keyRotated).toBe(true);

      // Peer key is now securely rotated to new key
      const updatedPeer = await PeerStore.getPeer('ROTATING_NODE_02');
      expect(updatedPeer?.signingPublicKeyHex).toBe(newKeys.publicKeyHex);
      expect(updatedPeer?.keyVersion).toBe(2);
    });

    it('rejects key rotation statement if signature by old key is forged or invalid', async () => {
      const oldKeys = await generateEd25519KeyPair(true);
      const newKeys = await generateEd25519KeyPair(true);
      const wrongKeys = await generateEd25519KeyPair(true);

      await PeerStore.upsertPeer({
        nodeId: 'NODE_SECURITY_03',
        callsign: 'SEC-03',
        signingPublicKeyHex: oldKeys.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
        keyVersion: 1,
      });

      // Fraudulent rotation statement: signed by wrongKeys instead of oldKeys
      const fraudulentProof = await PeerStore.createKeyRotationStatement(
        'NODE_SECURITY_03',
        wrongKeys.privateKey, // FORGERY!
        oldKeys.publicKeyHex,
        newKeys.privateKey,
        newKeys.publicKeyHex,
        2
      );

      const updateAttempt: StoredPeer = {
        nodeId: 'NODE_SECURITY_03',
        callsign: 'SEC-03',
        signingPublicKeyHex: newKeys.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      };

      const result = await PeerStore.upsertPeer(updateAttempt, fraudulentProof);
      expect(result.keyRotated).toBe(false);

      const finalPeer = await PeerStore.getPeer('NODE_SECURITY_03');
      expect(finalPeer?.signingPublicKeyHex).toBe(oldKeys.publicKeyHex);
    });
  });
});
