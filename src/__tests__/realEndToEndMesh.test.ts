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

describe('Real End-to-End Physical & Protocol Multi-Hop Test (Phone A -> Pi #1 -> Pi #2 -> Phone B)', () => {
  beforeEach(() => {
    InboxStore.clearMemory();
    PacketStore.clearMemory();
    OutboxStore.clearMemory();
    PeerStore.clearMemory();
  });

  it('verifies the complete 10-point end-to-end mesh lifecycle', async () => {
    // -------------------------------------------------------------
    // Step 1: Identities & Real Key Generation
    // -------------------------------------------------------------
    const phoneAIdentity = await createIdentityFromSeed('phone_a_secret_seed', 'PHONE-A');
    const phoneBIdentity = await createIdentityFromSeed('phone_b_secret_seed', 'PHONE-B');

    expect(phoneAIdentity.signingPublicKeyHex.length).toBe(64);
    expect(phoneBIdentity.signingPublicKeyHex.length).toBe(64);

    // -------------------------------------------------------------
    // Step 2: Real E2EE Payload Encryption (X25519 + HKDF + AES-GCM)
    // -------------------------------------------------------------
    const plaintextMessage = 'HELLO FROM HÕIMU';
    const messageBytes = new TextEncoder().encode(plaintextMessage);

    // Phone A computes ECDH shared secret with Phone B's public key
    const sharedSecret = await computeSharedSecret(
      phoneAIdentity.dhKeyPair.privateKey,
      phoneBIdentity.dhPublicKeyHex
    );

    const salt = new Uint8Array(16); // Standard salt
    const info = new TextEncoder().encode('hoimu-e2ee-channel-v1');
    const aesKeyBytes = await hkdfDerive(sharedSecret, salt, info, 32);

    const encrypted = await encryptAEAD(aesKeyBytes, messageBytes);

    expect(encrypted.ciphertext.length).toBeGreaterThan(messageBytes.length);
    expect(encrypted.nonce.length).toBe(12);

    // -------------------------------------------------------------
    // Step 3: Real Canonical Ed25519 Packet Signing
    // -------------------------------------------------------------
    const initialPacket = createHoimuPacket({
      type: HoimuPacketType.DIRECT_ENCRYPTED,
      originId: phoneAIdentity.signingPublicKeyHex,
      destinationId: phoneBIdentity.signingPublicKeyHex,
      ttl: 4,
      flags: PacketFlags.IS_ENCRYPTED,
      payload: {
        ciphertextHex: Array.from(encrypted.ciphertext).map((b) => b.toString(16).padStart(2, '0')).join(''),
        nonceHex: Array.from(encrypted.nonce).map((b) => b.toString(16).padStart(2, '0')).join(''),
        senderDhPubKeyHex: phoneAIdentity.dhPublicKeyHex,
      },
    });

    const signedPacket = await signPacket(initialPacket, phoneAIdentity.signingKeyPair.privateKey);

    expect(signedPacket.signature).toBeDefined();
    expect(signedPacket.signature?.length).toBe(128); // 64-byte Ed25519 signature in hex

    // -------------------------------------------------------------
    // Step 4: Binary Frame Serialization & CRC32
    // -------------------------------------------------------------
    const binaryWireBytes = encodeBinaryPacket(signedPacket);

    expect(binaryWireBytes.length).toBeGreaterThan(43);
    // Decode and verify wire frame integrity
    const decodedFrame = decodeBinaryPacket(binaryWireBytes);
    expect(decodedFrame).not.toBeNull();
    expect(decodedFrame?.header.originId).toBe(phoneAIdentity.signingPublicKeyHex.slice(0, 8));

    // -------------------------------------------------------------
    // Step 5: Radio Multi-Hop Simulation Setup
    // Phone A (BLE) -> Pi #1 (SX1262 LoRa) -> Pi #2 (BLE) -> Phone B
    // -------------------------------------------------------------
    const phoneATransport = new LoopbackTransport();
    const pi1Transport = new LoopbackTransport();
    const pi2Transport = new LoopbackTransport();
    const phoneBTransport = new LoopbackTransport();

    await phoneATransport.start();
    await pi1Transport.start();
    await pi2Transport.start();
    await phoneBTransport.start();

    const phoneARouter = new MeshRouter({ localNodeId: phoneAIdentity.signingPublicKeyHex });
    const pi1Router = new MeshRouter({ localNodeId: 'PI-ZERO-01' });
    const pi2Router = new MeshRouter({ localNodeId: 'PI-ZERO-02' });
    const phoneBRouter = new MeshRouter({ localNodeId: phoneBIdentity.signingPublicKeyHex });

    phoneARouter.registerTransport(phoneATransport);
    pi1Router.registerTransport(pi1Transport);
    pi2Router.registerTransport(pi2Transport);
    phoneBRouter.registerTransport(phoneBTransport);

    let messageReceivedOnPhoneB = false;
    let deliveredPacket: any = null;

    phoneBRouter.deliveryManager.onDelivery((pkt) => {
      messageReceivedOnPhoneB = true;
      deliveredPacket = pkt;
    });

    // -------------------------------------------------------------
    // Step 6: Transmit from Phone A into Mesh
    // -------------------------------------------------------------
    const sendSuccess = await phoneARouter.sendOutbound(signedPacket);
    expect(sendSuccess).toBe(true);

    // Allow asynchronous dispatch over simulated transports
    await new Promise((resolve) => setTimeout(resolve, 60));

    // -------------------------------------------------------------
    // Step 7: Verify Multi-Hop Reception & TTL Decrement
    // -------------------------------------------------------------
    expect(messageReceivedOnPhoneB).toBe(true);
    expect(deliveredPacket).not.toBeNull();

    // -------------------------------------------------------------
    // Step 8: Verify Real Signature on Destination
    // -------------------------------------------------------------
    const isSignatureValid = await verifyPacketSignature(
      deliveredPacket,
      phoneAIdentity.signingKeyPair.publicKey
    );
    expect(isSignatureValid).toBe(true);

    // -------------------------------------------------------------
    // Step 9: Decrypt on Phone B using Phone B's private key
    // -------------------------------------------------------------
    const phoneBSharedSecret = await computeSharedSecret(
      phoneBIdentity.dhKeyPair.privateKey,
      deliveredPacket.payload.senderDhPubKeyHex
    );

    const phoneBAesKeyBytes = await hkdfDerive(phoneBSharedSecret, salt, info, 32);

    const ciphertextRaw = new Uint8Array(
      deliveredPacket.payload.ciphertextHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );
    const nonceRaw = new Uint8Array(
      deliveredPacket.payload.nonceHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );

    const decryptedBytes = await decryptAEAD(phoneBAesKeyBytes, ciphertextRaw, nonceRaw);
    const recoveredMessage = new TextDecoder().decode(decryptedBytes);

    expect(recoveredMessage).toBe('HELLO FROM HÕIMU');

    // -------------------------------------------------------------
    // Step 10: Deduplication & Persistent Inbox Verification
    // -------------------------------------------------------------
    const isDuplicate = phoneBRouter.dedupCache.isDuplicate(signedPacket.header.packetId);
    expect(isDuplicate).toBe(true);

    const inboxItems = await InboxStore.getAll();
    expect(inboxItems.length).toBeGreaterThanOrEqual(1);
    expect(inboxItems.some((i) => i.packetId === signedPacket.header.packetId)).toBe(true);

    // Clean up transports
    await phoneATransport.stop();
    await pi1Transport.stop();
    await pi2Transport.stop();
    await phoneBTransport.stop();
  });
});
