import { describe, it, expect, beforeEach } from 'vitest';
import {
  messageService,
  envelopeService,
  messageVerifier,
  messageDecryptor,
  messagePersistence,
  messageRouter,
} from '../services/messaging';
import { peerIdentityStore, trustStore } from '../services/identity';
import { generateX25519KeyPair, generateEd25519KeyPair } from '../core/crypto';

describe('Phase 3 — Modular Message Pipeline', () => {
  beforeEach(async () => {
    await messagePersistence.initStorage();
    await peerIdentityStore.initialize();
  });

  it('orchestrates end-to-end outbound and inbound message pipeline across modules', async () => {
    // 1. Setup peer keypairs
    const aliceSign = await generateEd25519KeyPair(true);
    const aliceEnc = await generateX25519KeyPair(true);
    const bobSign = await generateEd25519KeyPair(true);
    const bobEnc = await generateX25519KeyPair(true);

    const bobEncPubHex = bobEnc.publicKeyHex;
    const bobSignPubHex = bobSign.publicKeyHex;

    // Register Bob in peerIdentityStore
    await peerIdentityStore.putPeer({
      nodeId: 'NODE-BOB-E2EE',
      callsign: 'Bob',
      signingPublicKey: bobSignPubHex,
      encryptionPublicKey: bobEncPubHex,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'verified',
      capabilities: ['mesh:v1', 'e2ee:v1'],
    });

    // 2. Outbound: Create authenticated envelope via EnvelopeService
    const secretContent = 'Hõimu mesh resilience network packet';
    const envelope = await envelopeService.createEnvelope({
      content: secretContent,
      senderCallsign: 'Alice',
      recipientCallsign: 'Bob',
      recipientX25519PublicKeyHex: bobEncPubHex,
      senderIdentityKeyPair: {
        publicKey: aliceSign.publicKey,
        privateKey: aliceSign.privateKey,
      },
      senderIdentityPublicKeyHex: aliceSign.publicKeyHex,
    });

    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.signature).toBeDefined();
    expect(envelope.nonce).toHaveLength(24); // 12 bytes hex

    // 3. Inbound: Verify cryptographic signature and trust via MessageVerifier
    const authResult = await messageVerifier.verifyAndAuthorize(envelope);
    expect(authResult.valid).toBe(true);
    expect(authResult.authorized).toBe(true);

    // 4. Inbound: Decrypt via MessageDecryptor
    const decryptResult = await messageDecryptor.decryptEnvelope(envelope, bobEnc.privateKey);
    expect(decryptResult.verified).toBe(true);
    expect(decryptResult.plaintext).toBe(secretContent);

    // 5. Inbound: Tampered signature rejection
    const tamperedEnvelope = { ...envelope, ciphertext: envelope.ciphertext + 'tampered' };
    const tamperedAuth = await messageVerifier.verifyAndAuthorize(tamperedEnvelope);
    expect(tamperedAuth.valid).toBe(false);
  });

  it('routes outbound message and persists through MessageRouter and MessagePersistence', async () => {
    // Generate peer
    const charlieEnc = await generateX25519KeyPair(true);
    const charlieSign = await generateEd25519KeyPair(true);

    await peerIdentityStore.putPeer({
      nodeId: 'NODE-CHARLIE-01',
      callsign: 'Charlie',
      signingPublicKey: charlieSign.publicKeyHex,
      encryptionPublicKey: charlieEnc.publicKeyHex,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'verified',
      capabilities: ['mesh:v1'],
    });

    const routeResult = await messageRouter.routeOutboundMessage('Charlie', 'Hello Charlie from local node');
    expect(routeResult.message.id).toBeDefined();
    expect(routeResult.message.to).toBe('Charlie');
    expect(routeResult.wireBytes.length).toBeGreaterThan(43); // 39 byte header + payload + 4 byte CRC

    // Verify stored in messagePersistence
    const stored = await messagePersistence.getMessageById(routeResult.message.id);
    expect(stored).not.toBeNull();
    expect(stored?.decryptedText).toBe('Hello Charlie from local node');
  });

  it('handles backwards compatibility through top-level MessageService', async () => {
    const crypto = await messageService.getLocalUserCrypto();
    expect(crypto.publicKeyHex).toBeDefined();

    const dualCrypto = await messageService.getLocalUserDualCrypto();
    expect(dualCrypto.identity.publicKeyHex).toBeDefined();
    expect(dualCrypto.encryption.publicKeyHex).toBeDefined();

    const unread = await messageService.getUnreadCount();
    expect(typeof unread).toBe('number');
  });
});
