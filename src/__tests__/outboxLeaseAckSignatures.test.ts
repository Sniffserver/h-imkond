import { describe, it, expect, beforeEach } from 'vitest';
import { OutboxStore, OutboxItem } from '../storage/outbox';
import { createHoimuPacket } from '../protocol/packet';
import { HoimuPacketType, PacketFlags } from '../protocol/constants';
import { MeshRouter } from '../mesh/router';
import { generateEd25519KeyPair } from '../core/crypto/ed25519';
import { signPacket, isSignatureRequired } from '../crypto/signatures';
import { AckPayload, HoimuPacket } from '../protocol/types';
import { Storage } from '../storage/canonicalStorage';

describe('Outbox State Machine, Lease & ACK Semantics, Signature Policy', () => {
  beforeEach(() => {
    OutboxStore.clearMemory();
    OutboxStore.clearVolatileFallback();
  });

  describe('1. Outbox Volatile Fallback & Storage Durability Indicator', () => {
    it('accurately identifies durability status and provides volatile fallback awareness', () => {
      const status = Storage.getDurabilityStatus();
      expect(status).toHaveProperty('isDurable');
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('label');

      if (!status.isDurable) {
        expect(status.label).toBe('LOCAL ONLY / NOT DURABLE (Volatile Fallback)');
        expect(status.mode).toBe('volatile_memory');
      } else {
        expect(status.label).toBe('DURABLE (IndexedDB)');
        expect(status.mode).toBe('durable_indexeddb');
      }
    });
  });

  describe('2. Outbox State Machine Lifecycle & Lease Management', () => {
    it('transitions through QUEUED -> CLAIMED -> SENDING -> TX_CONFIRMED -> WAITING_ACK -> ACKED', async () => {
      const packet = createHoimuPacket({
        type: HoimuPacketType.MESSAGE,
        originId: 'NODE_ALICE',
        destinationId: 'NODE_BOB',
        flags: PacketFlags.NONE,
        payload: { text: 'Testing complete state machine' },
      });

      // 1. Enqueue -> status: 'queued'
      const enqueued = await OutboxStore.enqueue(packet);
      expect(enqueued.status).toBe('queued');
      expect(enqueued.attempts).toBe(0);

      // 2. Claim item with workerId and lease -> status: 'claimed'
      const claimed = await OutboxStore.claim(packet.header.packetId, 'worker_mesh_tx_1', 15000);
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe('claimed');
      expect(claimed?.workerId).toBe('worker_mesh_tx_1');
      expect(claimed?.attemptId).toBeDefined();
      expect(claimed?.leaseUntil).toBeGreaterThan(Date.now());

      // 3. Start sending -> status: 'sending'
      const sending = await OutboxStore.startSending(packet.header.packetId);
      expect(sending?.status).toBe('sending');

      // 4. Physical radio TX success (TX_CONFIRMED, but destination is not broadcast, so moves to 'waiting_ack')
      const waitingAck = await OutboxStore.confirmTx(packet.header.packetId, undefined, true);
      expect(waitingAck?.status).toBe('waiting_ack');
      expect(waitingAck?.txConfirmedAt).toBeDefined();
      expect(waitingAck?.leaseUntil).toBeUndefined(); // Lease released upon TX confirmation

      // 5. Remote destination returns ACK -> status: 'acked'
      const acked = await OutboxStore.confirmAck(packet.header.packetId, { status: 'received' });
      expect(acked?.status).toBe('acked');
      expect(acked?.ackedAt).toBeDefined();
    });

    it('recovers stranded SENDING or CLAIMED packets on startup / reboot', async () => {
      const strandedPacket = createHoimuPacket({
        type: HoimuPacketType.MESSAGE,
        originId: 'NODE_ALICE',
        destinationId: 'NODE_BOB',
        flags: PacketFlags.NONE,
        payload: { text: 'Stranded packet during unexpected power loss' },
      });

      await OutboxStore.enqueue(strandedPacket);
      await OutboxStore.claim(strandedPacket.header.packetId, 'worker_crashed', 30000);
      await OutboxStore.startSending(strandedPacket.header.packetId);

      const beforeReboot = await OutboxStore.getItem(strandedPacket.header.packetId);
      expect(beforeReboot?.status).toBe('sending');

      // Simulate reboot / restart
      OutboxStore.clearMemory();
      const pendingAfterReboot = await OutboxStore.restoreAndCleanExpired();

      const recovered = pendingAfterReboot.find((p) => p.id === strandedPacket.header.packetId);
      expect(recovered).toBeDefined();
      // Status must not remain stranded in 'sending' or with stale lease!
      expect(['queued', 'retrying']).toContain(recovered?.status);
      expect(recovered?.leaseUntil).toBeUndefined();
      expect(recovered?.workerId).toBeUndefined();
    });
  });

  describe('3. Canonical ACK Semantics & Router Handling', () => {
    it('creates and processes structured AckPayload with all canonical fields', async () => {
      const aliceKeys = await generateEd25519KeyPair(false);
      const bobKeys = await generateEd25519KeyPair(false);

      const router = new MeshRouter({
        localNodeId: aliceKeys.publicKeyHex,
        signingPrivateKey: aliceKeys.privateKey,
      });

      const originalPacketId = 'PKT_ORD_9918273';
      const originalSeq = 42;

      // Alice receives packet and sends ACK to Bob
      const ackPacket = await router.sendAck(bobKeys.publicKeyHex, originalPacketId, originalSeq);

      expect(ackPacket.header.type).toBe(HoimuPacketType.ACK);
      expect(ackPacket.header.flags & PacketFlags.IS_PRIORITY).toBeTruthy();

      const payload = ackPacket.payload as AckPayload;
      expect(payload.ackedPacketId).toBe(originalPacketId);
      expect(payload.originNodeId).toBe(bobKeys.publicKeyHex);
      expect(payload.receiverNodeId).toBe(aliceKeys.publicKeyHex);
      expect(payload.status).toBe('received');
      expect(payload.originalSequence).toBe(originalSeq);
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('4. Strict Signature Policy on Sensitive Packets', () => {
    it('enforces signature requirement on MESSAGE, DIRECT_ENCRYPTED, SOS, CRDT, ROUTING, and ACK', () => {
      expect(isSignatureRequired(HoimuPacketType.MESSAGE)).toBe(true);
      expect(isSignatureRequired(HoimuPacketType.DIRECT_ENCRYPTED)).toBe(true);
      expect(isSignatureRequired(HoimuPacketType.SOS)).toBe(true);
      expect(isSignatureRequired(HoimuPacketType.CRDT_SYNC)).toBe(true);
      expect(isSignatureRequired(HoimuPacketType.ROUTE_ANNOUNCE)).toBe(true);
      expect(isSignatureRequired(HoimuPacketType.ACK)).toBe(true);
    });

    it('router drops unsigned sensitive packets', async () => {
      const keys = await generateEd25519KeyPair(false);
      const router = new MeshRouter({
        localNodeId: keys.publicKeyHex,
      });

      const unsignedMessage = createHoimuPacket({
        type: HoimuPacketType.MESSAGE,
        originId: 'SOME_SENDER',
        destinationId: keys.publicKeyHex,
        flags: PacketFlags.NONE,
        payload: { text: 'Unsigned sensitive text' },
      });

      const handled = await router.handleIncomingPacket(unsignedMessage);
      expect(handled).toBe(false);
      expect(router.getMetrics().packetsDroppedUnsigned).toBe(1);
    });

    it('router accepts validly signed sensitive packets', async () => {
      const senderKeys = await generateEd25519KeyPair(false);
      const receiverKeys = await generateEd25519KeyPair(false);

      const router = new MeshRouter({
        localNodeId: receiverKeys.publicKeyHex,
      });

      const unsigned = createHoimuPacket({
        type: HoimuPacketType.MESSAGE,
        originId: senderKeys.publicKeyHex,
        destinationId: receiverKeys.publicKeyHex,
        flags: PacketFlags.IS_SIGNED,
        payload: { text: 'Cryptographically signed verified message' },
      });

      const signed = await signPacket(unsigned, senderKeys.privateKey);
      const handled = await router.handleIncomingPacket(signed);
      expect(handled).toBe(true);
      expect(router.getMetrics().packetsDelivered).toBe(1);
    });
  });
});
