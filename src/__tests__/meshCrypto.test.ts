import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateIdentityKeyPair,
  generateEncryptionKeyPair,
  deriveX25519KeyPairFromSeed,
  deriveEd25519KeyPairFromSeed,
  encryptMeshMessage,
  decryptMeshMessage,
  parseEnvelope,
} from '../services/crypto/meshCrypto';
import {
  sendDirectMessage,
  getConversation,
  initMessageStorage,
  getLocalUserDualCrypto,
} from '../services/comms/messageService';

describe('Dual-Key Asymmetric Mesh E2EE & Authenticated Envelope', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initMessageStorage();
  });

  describe('Key Architecture (Ed25519 Identity + X25519 Session/Encryption)', () => {
    it('generates genuine Ed25519 identity keypair for signing', async () => {
      const idKey = await generateIdentityKeyPair();
      expect(idKey.publicKeyHex).toBeDefined();
      expect(idKey.publicKeyHex.length).toBeGreaterThanOrEqual(64);
      expect(idKey.keyPair.privateKey).toBeDefined();
      expect(idKey.keyPair.publicKey).toBeDefined();
    });

    it('generates genuine X25519 encryption keypair for Diffie-Hellman key agreement', async () => {
      const encKey = await generateEncryptionKeyPair();
      expect(encKey.publicKeyHex).toBeDefined();
      expect(encKey.publicKeyHex.length).toBeGreaterThanOrEqual(64);
      expect(encKey.keyPair.privateKey).toBeDefined();
      expect(encKey.keyPair.publicKey).toBeDefined();
    });

    it('reproducibly derives deterministic X25519 and Ed25519 keypairs from seed strings', async () => {
      const seed = 'test-node-beacon-seed-01';
      const pair1 = await deriveX25519KeyPairFromSeed(seed);
      const pair2 = await deriveX25519KeyPairFromSeed(seed);
      expect(pair1.publicKeyHex).toBe(pair2.publicKeyHex);

      const edPair1 = await deriveEd25519KeyPairFromSeed(seed);
      const edPair2 = await deriveEd25519KeyPairFromSeed(seed);
      expect(edPair1.publicKeyHex).toBe(edPair2.publicKeyHex);
    });
  });

  describe('Authenticated Envelope & Asymmetric Cryptography', () => {
    it('constructs conforming envelope with ephemeral key, nonce, ciphertext, and signature', async () => {
      const aliceId = await generateIdentityKeyPair();
      const bobEnc = await generateEncryptionKeyPair();

      const plaintext = 'Solar microgrid frequency synchronized at 50.02Hz';
      const envelope = await encryptMeshMessage({
        content: plaintext,
        senderCallsign: 'Alice-Solar',
        recipientCallsign: 'Bob-Battery',
        recipientX25519PublicKeyHex: bobEnc.publicKeyHex,
        senderIdentityKeyPair: aliceId.keyPair,
        senderIdentityPublicKeyHex: aliceId.publicKeyHex,
        ttl: 4,
      });

      expect(envelope.version).toBe(1);
      expect(envelope.sender).toBe('Alice-Solar');
      expect(envelope.recipient).toBe('Bob-Battery');
      expect(envelope.ephemeralPublicKey).toBeDefined();
      expect(envelope.ephemeralPublicKey.length).toBe(64); // 32 bytes hex
      expect(envelope.nonce).toBeDefined();
      expect(envelope.nonce.length).toBe(24); // 12 bytes hex IV
      expect(envelope.salt).toBeDefined();
      expect(envelope.salt.length).toBe(32); // 16 bytes hex HKDF salt
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.ciphertext).not.toContain(plaintext);
      expect(envelope.signature).toBeDefined();
      expect(envelope.ttl).toBe(4);
      expect(envelope.createdAt).toBeGreaterThan(0);

      // Decrypt with Bob's private X25519 key
      const decrypted = await decryptMeshMessage(envelope, bobEnc.keyPair.privateKey);
      expect(decrypted.plaintext).toBe(plaintext);
      expect(decrypted.signatureValid).toBe(true);
    });

    it('ensures forward secrecy: identical plaintexts produce distinct ephemeral keys and ciphertexts', async () => {
      const aliceId = await generateIdentityKeyPair();
      const bobEnc = await generateEncryptionKeyPair();
      const plaintext = 'Repeatable test message';

      const env1 = await encryptMeshMessage({
        content: plaintext,
        senderCallsign: 'Alice',
        recipientCallsign: 'Bob',
        recipientX25519PublicKeyHex: bobEnc.publicKeyHex,
        senderIdentityKeyPair: aliceId.keyPair,
        senderIdentityPublicKeyHex: aliceId.publicKeyHex,
      });

      const env2 = await encryptMeshMessage({
        content: plaintext,
        senderCallsign: 'Alice',
        recipientCallsign: 'Bob',
        recipientX25519PublicKeyHex: bobEnc.publicKeyHex,
        senderIdentityKeyPair: aliceId.keyPair,
        senderIdentityPublicKeyHex: aliceId.publicKeyHex,
      });

      expect(env1.ephemeralPublicKey).not.toBe(env2.ephemeralPublicKey);
      expect(env1.nonce).not.toBe(env2.nonce);
      expect(env1.ciphertext).not.toBe(env2.ciphertext);
    });

    it('fails decryption when an attacker attempts to decrypt with the wrong private key', async () => {
      const aliceId = await generateIdentityKeyPair();
      const bobEnc = await generateEncryptionKeyPair();
      const attackerEnc = await generateEncryptionKeyPair();

      const envelope = await encryptMeshMessage({
        content: 'Confidential seed swap coordinates',
        senderCallsign: 'Alice',
        recipientCallsign: 'Bob',
        recipientX25519PublicKeyHex: bobEnc.publicKeyHex,
        senderIdentityKeyPair: aliceId.keyPair,
        senderIdentityPublicKeyHex: aliceId.publicKeyHex,
      });

      await expect(
        decryptMeshMessage(envelope, attackerEnc.keyPair.privateKey)
      ).rejects.toThrow();
    });

    it('detects tampering and marks signature invalid if ciphertext is altered in transit', async () => {
      const aliceId = await generateIdentityKeyPair();
      const bobEnc = await generateEncryptionKeyPair();

      const envelope = await encryptMeshMessage({
        content: 'Original tamper-free payload',
        senderCallsign: 'Alice',
        recipientCallsign: 'Bob',
        recipientX25519PublicKeyHex: bobEnc.publicKeyHex,
        senderIdentityKeyPair: aliceId.keyPair,
        senderIdentityPublicKeyHex: aliceId.publicKeyHex,
      });

      // Attacker tampers with the signature or envelope recipient
      const tamperedEnvelope = {
        ...envelope,
        recipient: 'Mallory',
      };

      // Decryption with Bob's private key will succeed AEAD, but signature verification will detect tampering
      const result = await decryptMeshMessage(tamperedEnvelope, bobEnc.keyPair.privateKey);
      expect(result.signatureValid).toBe(false);
    });

    it('correctly parses raw envelope strings and base64 encoded envelopes', () => {
      const sample = {
        version: 1,
        id: '01J123',
        sender: 'Alice',
        recipient: 'Bob',
        ephemeralPublicKey: 'a'.repeat(64),
        nonce: 'b'.repeat(24),
        salt: 'c'.repeat(32),
        ciphertext: 'AQIDBA==',
        signature: 'd'.repeat(128),
        senderIdentityKey: 'e'.repeat(64),
        ttl: 5,
        createdAt: 1780000000000,
      };

      const json = JSON.stringify(sample);
      const b64 = btoa(json);

      expect(parseEnvelope(json)?.id).toBe('01J123');
      expect(parseEnvelope(b64)?.id).toBe('01J123');
      expect(parseEnvelope('not-valid-json')).toBeNull();
    });
  });

  describe('Integration with messageService', () => {
    it('initializes dual crypto identity for local user in IndexedDB', async () => {
      const dual = await getLocalUserDualCrypto();
      expect(dual.identity.publicKeyHex).toBeDefined();
      expect(dual.encryption.publicKeyHex).toBeDefined();
    });

    it('sends direct message and stores conforming envelope in conversation thread', async () => {
      const msg = await sendDirectMessage('peer_fern_weaver', 'Tere Fern-Weaver! E2EE check.');
      expect(msg.id).toBeDefined();
      expect(msg.from).toBeDefined();
      expect(msg.to).toBe('Fern-Weaver');
      expect(msg.envelope).toBeDefined();
      expect(msg.envelope?.version).toBe(1);
      expect(msg.envelope?.ephemeralPublicKey).toBeDefined();

      const thread = await getConversation('peer_fern_weaver');
      expect(thread.length).toBeGreaterThan(0);
      const sent = thread.find((m) => m.id === msg.id);
      expect(sent).toBeDefined();
      expect(sent?.decryptedText).toBe('Tere Fern-Weaver! E2EE check.');
    });
  });
});
