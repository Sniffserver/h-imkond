/**
 * Comprehensive Cross-Runtime Ed25519 Cryptographic Test Matrix
 * Verifies RFC 8032 Known Test Vectors and Full Adversarial Attack Surface.
 * 
 * Truth Principle: Real cryptographic material only.
 * Zero tolerance for permissive verifiers or mock signatures.
 */

import { describe, it, expect } from 'vitest';
import { deriveEd25519FromSeed, deriveEd25519FromRawSeed, signBytes, verifySignature } from '../crypto/ed25519';
import { fromHex, toHex } from '../crypto/aead';
import { createSignedEnvelope, verifySignedEnvelope, SignedEnvelope } from '../core/crypto/canonical';
import { TruthFirewall } from '../core/truth/truthFirewall';

describe('RFC 8032 Known Test Vectors & Adversarial Crypto Matrix', () => {

  // =========================================================================
  // 1. RFC 8032 Official Test Vectors (Section 7.1)
  // =========================================================================
  describe('1. RFC 8032 Section 7.1 Known Test Vectors', () => {
    it('verifies RFC 8032 Vector 1 (Empty message)', async () => {
      const seedHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
      const expectedPubHex = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
      const expectedSigHex = 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b';
      const message = new Uint8Array(0);

      const keyPair = await deriveEd25519FromRawSeed(fromHex(seedHex));
      expect(keyPair.publicKeyHex.toLowerCase()).toBe(expectedPubHex.toLowerCase());

      const computedSig = await signBytes(keyPair.privateKey, message);
      expect(computedSig.toLowerCase()).toBe(expectedSigHex.toLowerCase());

      const valid = await verifySignature(expectedPubHex, message, expectedSigHex);
      expect(valid).toBe(true);
    });

    it('verifies RFC 8032 Vector 2 (1-byte message 0x72)', async () => {
      const seedHex = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb';
      const expectedPubHex = '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c';
      const expectedSigHex = '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00';
      const message = new Uint8Array([0x72]);

      const keyPair = await deriveEd25519FromRawSeed(fromHex(seedHex));
      expect(keyPair.publicKeyHex.toLowerCase()).toBe(expectedPubHex.toLowerCase());

      const computedSig = await signBytes(keyPair.privateKey, message);
      expect(computedSig.toLowerCase()).toBe(expectedSigHex.toLowerCase());

      const valid = await verifySignature(expectedPubHex, message, expectedSigHex);
      expect(valid).toBe(true);
    });
  });

  // =========================================================================
  // 2. Adversarial Rejection Tests
  // =========================================================================
  describe('2. Adversarial Security Regression Tests', () => {
    const seed = 'hoimu_secure_mesh_adversarial_seed_2026';
    const message = new TextEncoder().encode('CRITICAL_RESCUE_WAYPOINT_TALLINN_CENTRAL');

    it('rejects modified message (1 bit flipped)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const sigHex = await signBytes(keyPair.privateKey, message);

      const tamperedMsg = new Uint8Array(message);
      tamperedMsg[tamperedMsg.length - 1] ^= 0x01;

      const valid = await verifySignature(keyPair.publicKeyHex, tamperedMsg, sigHex);
      expect(valid).toBe(false);
    });

    it('rejects modified R component in signature', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const sigHex = await signBytes(keyPair.privateKey, message);

      const sigBytes = fromHex(sigHex);
      sigBytes[0] ^= 0x01; // Mutate R byte
      const tamperedSigHex = toHex(sigBytes);

      const valid = await verifySignature(keyPair.publicKeyHex, message, tamperedSigHex);
      expect(valid).toBe(false);
    });

    it('rejects modified S component in signature', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const sigHex = await signBytes(keyPair.privateKey, message);

      const sigBytes = fromHex(sigHex);
      sigBytes[63] ^= 0x01; // Mutate S byte
      const tamperedSigHex = toHex(sigBytes);

      const valid = await verifySignature(keyPair.publicKeyHex, message, tamperedSigHex);
      expect(valid).toBe(false);
    });

    it('rejects verification with wrong public key', async () => {
      const keyPair1 = await deriveEd25519FromSeed('seed_alpha');
      const keyPair2 = await deriveEd25519FromSeed('seed_beta');

      const sigHex = await signBytes(keyPair1.privateKey, message);

      const valid = await verifySignature(keyPair2.publicKeyHex, message, sigHex);
      expect(valid).toBe(false);
    });

    it('rejects all-zero signature (64 bytes of 0x00)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const zeroSigHex = '00'.repeat(64);

      const valid = await verifySignature(keyPair.publicKeyHex, message, zeroSigHex);
      expect(valid).toBe(false);
    });

    it('rejects all-FF signature (64 bytes of 0xFF)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const ffSigHex = 'ff'.repeat(64);

      const valid = await verifySignature(keyPair.publicKeyHex, message, ffSigHex);
      expect(valid).toBe(false);
    });

    it('rejects truncated signature (< 64 bytes)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const truncatedSigHex = '12'.repeat(32); // only 32 bytes

      const valid = await verifySignature(keyPair.publicKeyHex, message, truncatedSigHex);
      expect(valid).toBe(false);
    });

    it('rejects oversized signature (> 64 bytes)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const oversizedSigHex = '12'.repeat(96); // 96 bytes

      const valid = await verifySignature(keyPair.publicKeyHex, message, oversizedSigHex);
      expect(valid).toBe(false);
    });

    it('rejects malformed public key (< 32 bytes or corrupted)', async () => {
      const keyPair = await deriveEd25519FromSeed(seed);
      const sigHex = await signBytes(keyPair.privateKey, message);

      const malformedPubKey = keyPair.publicKeyHex.slice(0, 30); // 15 bytes
      const valid = await verifySignature(malformedPubKey, message, sigHex);
      expect(valid).toBe(false);
    });
  });

  // =========================================================================
  // 3. Canonical SignedEnvelope Verification
  // =========================================================================
  describe('3. Canonical Protocol SignedEnvelope Specification', () => {
    it('creates and verifies canonical SignedEnvelope with payload hash', async () => {
      const keyPair = await deriveEd25519FromSeed('envelope_seed');
      const payload = new TextEncoder().encode('HOIMU_EMERGENCY_DISCOVERY_PAYLOAD_V1');

      const envelope = await createSignedEnvelope(payload, keyPair.privateKey, keyPair.publicKeyHex, 'KEY-001');

      expect(envelope.version).toBe(1);
      expect(envelope.algorithm).toBe('Ed25519');
      expect(envelope.keyId).toBe('KEY-001');
      expect(envelope.publicKey).toBe(keyPair.publicKeyHex);
      expect(envelope.signature.length).toBe(128); // 64 bytes in hex

      const isValid = await verifySignedEnvelope(envelope, payload);
      expect(isValid).toBe(true);
    });

    it('rejects SignedEnvelope when payload is tampered', async () => {
      const keyPair = await deriveEd25519FromSeed('envelope_seed');
      const payload = new TextEncoder().encode('ORIGINAL_CONTENT');
      const envelope = await createSignedEnvelope(payload, keyPair.privateKey, keyPair.publicKeyHex, 'KEY-001');

      const tamperedPayload = new TextEncoder().encode('ORIGINAL_CONTENT_TAMPERED');
      const isValid = await verifySignedEnvelope(envelope, tamperedPayload);
      expect(isValid).toBe(false);
    });
  });

  // =========================================================================
  // 4. Truth Firewall Invariant Attestation
  // =========================================================================
  describe('4. Truth Firewall Boundary Invariants', () => {
    it('downgrades ESTIMATED and FIXTURE evidence so they never certify production READY', () => {
      expect(TruthFirewall.filterReadiness('OBSERVED', 'READY')).toBe('READY');
      expect(TruthFirewall.filterReadiness('DERIVED', 'READY')).toBe('READY');

      // Estimated evidence is capped at DEGRADED
      expect(TruthFirewall.filterReadiness('ESTIMATED', 'READY')).toBe('DEGRADED');
      expect(TruthFirewall.filterReadiness('ESTIMATED', 'DEGRADED')).toBe('DEGRADED');

      // Fixtures and simulations are capped at DEGRADED
      expect(TruthFirewall.filterReadiness('FIXTURE', 'READY')).toBe('DEGRADED');
      expect(TruthFirewall.filterReadiness('SIMULATED', 'READY')).toBe('DEGRADED');

      // Fails never become READY
      expect(TruthFirewall.filterReadiness('FAILED', 'READY')).toBe('FAILED');
      expect(TruthFirewall.filterReadiness('UNAVAILABLE', 'READY')).toBe('UNAVAILABLE');
    });
  });
});
