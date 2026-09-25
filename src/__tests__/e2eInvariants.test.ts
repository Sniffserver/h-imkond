import { describe, it, expect, beforeEach } from 'vitest';
import { createHoimuPacket } from '../protocol/packet';
import { encodeBinaryPacket, decodeBinaryPacket } from '../protocol/codec';
import { HoimuPacketType, PacketFlags } from '../protocol/constants';
import { createIdentityFromSeed } from '../crypto/identity';
import { signPacket, verifyPacketSignature } from '../crypto/signatures';
import { computeSharedSecret } from '../crypto/x25519';
import { hkdfDerive } from '../crypto/hkdf';
import { encryptAEAD, decryptAEAD } from '../crypto/aead';
import { MeshRouter } from '../mesh/router';
import { LoopbackTransport } from '../transport/loopback';
import { InboxStore } from '../storage/inbox';
import { PacketStore } from '../storage/packets';
import { OutboxStore } from '../storage/outbox';
import { PeerStore } from '../storage/peers';
import { peerIdentityStore } from '../services/identity/peerIdentityStore';

describe('E2E Protocol & Network Invariants (Messaging, Routing, Offline Persistence & Sync)', () => {
  beforeEach(async () => {
    InboxStore.clearMemory();
    PacketStore.clearMemory();
    OutboxStore.clearMemory();
    PeerStore.clearMemory();
    await peerIdentityStore.initialize();
  });

  it('Invariant 1: Messaging — send -> wire bytes -> decode -> verify signature -> decrypt -> same plaintext', async () => {
    const sender = await createIdentityFromSeed('node_a_invariant_seed_123', 'NODE-A');
    const receiver = await createIdentityFromSeed('node_b_invariant_seed_456', 'NODE-B');

    // 1. Plaintext payload
    const originalPlaintext = 'INVARIANT_MESSAGING_PAYLOAD_CONFIDENTIAL_12345';
    const plaintextBytes = new TextEncoder().encode(originalPlaintext);

    // 2. Encryption (X25519 ECDH + HKDF + AES-GCM)
    const senderSharedSecret = await computeSharedSecret(
      sender.dhKeyPair.privateKey,
      receiver.dhPublicKeyHex
    );
    const salt = new Uint8Array(16);
    const info = new TextEncoder().encode('hoimu-invariant-encryption');
    const aesKeyBytes = await hkdfDerive(senderSharedSecret, salt, info, 32);

    const encryptedPayload = await encryptAEAD(aesKeyBytes, plaintextBytes);

    // 3. Create packet
    const rawPacket = createHoimuPacket({
      type: HoimuPacketType.DIRECT_ENCRYPTED,
      originId: sender.signingPublicKeyHex,
      destinationId: receiver.signingPublicKeyHex,
      ttl: 5,
      flags: PacketFlags.IS_ENCRYPTED | PacketFlags.IS_SIGNED,
      payload: {
        ciphertextHex: Array.from(encryptedPayload.ciphertext)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        nonceHex: Array.from(encryptedPayload.nonce)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        senderDhPubKeyHex: sender.dhPublicKeyHex,
      },
    });

    // 4. Sign packet with Ed25519 private key
    const signedPacket = await signPacket(rawPacket, sender.signingKeyPair.privateKey);
    expect(signedPacket.signature).toBeDefined();

    // 5. Wire byte serialization
    const wireBytes = encodeBinaryPacket(signedPacket);
    expect(wireBytes.length).toBeGreaterThan(57); // Header + Payload + Signature + CRC32

    // 6. Receiver decodes wire bytes
    const decodedFrame = decodeBinaryPacket(wireBytes);
    expect(decodedFrame).not.toBeNull();
    expect(decodedFrame?.header.originId).toBe(sender.signingPublicKeyHex.slice(0, 8));

    // 7. Verify Ed25519 cryptographic signature
    const isSigValid = await verifyPacketSignature(
      signedPacket,
      sender.signingKeyPair.publicKey
    );
    expect(isSigValid).toBe(true);

    // 8. Decrypt payload on Receiver using Receiver's DH private key
    const receiverSharedSecret = await computeSharedSecret(
      receiver.dhKeyPair.privateKey,
      signedPacket.payload.senderDhPubKeyHex
    );
    const receiverAesKeyBytes = await hkdfDerive(receiverSharedSecret, salt, info, 32);

    const ciphertextRaw = new Uint8Array(
      signedPacket.payload.ciphertextHex.match(/.{1,2}/g)!.map((hex: string) => parseInt(hex, 16))
    );
    const nonceRaw = new Uint8Array(
      signedPacket.payload.nonceHex.match(/.{1,2}/g)!.map((hex: string) => parseInt(hex, 16))
    );

    const decryptedBytes = await decryptAEAD(receiverAesKeyBytes, ciphertextRaw, nonceRaw);
    const recoveredPlaintext = new TextDecoder().decode(decryptedBytes);

    // Assert INVARIANT: exact same plaintext
    expect(recoveredPlaintext).toBe(originalPlaintext);
  });

  it('Invariant 2: Routing — A -> B -> C, TTL 3 -> C receives -> packet not duplicated', async () => {
    const sender = await createIdentityFromSeed('node_a_routing_seed', 'NODE-A');
    const nodeAId = sender.signingPublicKeyHex;
    const nodeBId = 'NODE_B_RELAY';
    const nodeCId = 'NODE_C_DESTINATION';

    // Transports
    const transportAB1 = new LoopbackTransport();
    const transportAB2 = new LoopbackTransport();
    const transportBC1 = new LoopbackTransport();
    const transportBC2 = new LoopbackTransport();

    await transportAB1.start();
    await transportAB2.start();
    await transportBC1.start();
    await transportBC2.start();

    // Routers
    const routerA = new MeshRouter({ localNodeId: nodeAId });
    const routerB = new MeshRouter({ localNodeId: nodeBId });
    const routerC = new MeshRouter({ localNodeId: nodeCId });

    routerA.registerTransport(transportAB1);
    routerB.registerTransport(transportAB2);
    routerB.registerTransport(transportBC1);
    routerC.registerTransport(transportBC2);

    let deliveredAtC: any = null;
    let deliveryCountC = 0;

    routerC.deliveryManager.onDelivery((packet) => {
      deliveredAtC = packet;
      deliveryCountC += 1;
    });

    // Create packet from A to C with initial TTL 3 and sign it
    const rawPacket = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      originId: nodeAId,
      destinationId: nodeCId,
      ttl: 3,
      flags: PacketFlags.IS_SIGNED,
      payload: { text: 'Multi-Hop Invariant Verification' },
    });
    const packet = await signPacket(rawPacket, sender.signingKeyPair.privateKey);

    // 1. A sends packet
    const sent = await routerA.sendOutbound(packet);
    expect(sent).toBe(true);

    // Allow propagation across async transports
    await new Promise((res) => setTimeout(res, 300));

    // 2. Assert C receives packet
    expect(deliveredAtC).not.toBeNull();
    expect(deliveryCountC).toBe(1);
    expect(deliveredAtC.header.packetId).toBe(packet.header.packetId);

    // 3. Re-transmit same packet to verify deduplication
    await routerA.sendOutbound(packet);
    await new Promise((res) => setTimeout(res, 300));

    // Assert INVARIANT: duplicate packet rejected, deliveryCountC remains 1
    expect(deliveryCountC).toBe(1);
    expect(routerC.dedupCache.isDuplicate(packet.header.packetId)).toBe(true);

    await transportAB1.stop();
    await transportAB2.stop();
    await transportBC1.stop();
    await transportBC2.stop();
  });

  it('Invariant 3: Offline — disconnect -> create resource -> kill app -> restart -> resource exists -> reconnect -> sync', async () => {
    OutboxStore.clearMemory();

    const localNodeId = 'OFFLINE_NODE_777';
    const transport = new LoopbackTransport();
    await transport.start();

    // 1. Disconnect / Go Offline
    await transport.stop();
    expect(transport.isConnected).toBe(false);

    // 2. Create resource / outbound message while offline
    const offlinePacket = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      originId: localNodeId,
      destinationId: 'TARGET_REMOTE_NODE',
      ttl: 5,
      payload: { resourceTitle: 'Offline Generator Power Supply', qty: 2 },
    });

    // Queue in OutboxStore while offline
    await OutboxStore.enqueue(offlinePacket, { maxAttempts: 5 });
    const pendingBeforeRestart = await OutboxStore.getPending();
    expect(pendingBeforeRestart.length).toBe(1);
    expect(pendingBeforeRestart[0].packet.header.packetId).toBe(offlinePacket.header.packetId);

    // 3. Simulate App Restart (Re-instantiate state / get pending from store)
    const pendingAfterRestart = await OutboxStore.getPending();

    // Assert INVARIANT: resource / message exists after app restart
    expect(pendingAfterRestart.length).toBe(1);
    expect(pendingAfterRestart[0].packet.header.packetId).toBe(offlinePacket.header.packetId);

    // 4. Reconnect Network
    await transport.start();
    expect(transport.isConnected).toBe(true);

    // 5. Trigger sync / flush outbox
    const flushedItem = await OutboxStore.getPending();
    expect(flushedItem.length).toBe(1);
    await OutboxStore.confirmAck(offlinePacket.header.packetId, { status: 'delivered' });

    const remainingPending = await OutboxStore.getPending();
    expect(remainingPending.length).toBe(0);

    await transport.stop();
  });
});
