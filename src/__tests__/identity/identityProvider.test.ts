import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalIdentityProvider } from '../../core/identity/provider';
import { verifyEd25519 } from '../../core/crypto/ed25519';

describe('Canonical IdentityProvider', () => {
  let providerA: CanonicalIdentityProvider;
  let providerB: CanonicalIdentityProvider;

  beforeEach(async () => {
    providerA = new CanonicalIdentityProvider();
    await providerA.initialize();

    providerB = new CanonicalIdentityProvider();
    await providerB.initialize();
  });

  it('generates non-empty node identity with deterministic node ID', async () => {
    const identityA = await providerA.getNodeIdentity();
    expect(identityA.nodeId).toBeDefined();
    expect(identityA.nodeId.length).toBe(16);
    expect(identityA.signingPublicKey.length).toBe(32);
    expect(identityA.dhPublicKey.length).toBe(32);
    expect(identityA.signingPublicKeyHex.length).toBe(64);
    expect(identityA.dhPublicKeyHex.length).toBe(64);
  });

  it('signs data and produces verifiable Ed25519 signature', async () => {
    const data = new TextEncoder().encode('HÕIMU sovereign mesh authentication');
    const signature = await providerA.sign(data);
    expect(signature.length).toBe(64);

    const pubKey = await providerA.getPublicKey();
    const isValid = await verifyEd25519(data, signature, pubKey);
    expect(isValid).toBe(true);

    // Tampered data should fail verification
    const tampered = new TextEncoder().encode('Tampered mesh authentication');
    const isTamperedValid = await verifyEd25519(tampered, signature, pubKey);
    expect(isTamperedValid).toBe(false);
  });

  it('encrypts for peer using ephemeral X25519 + AES-GCM and decrypts cleanly', async () => {
    const identityB = await providerB.getNodeIdentity();
    const plaintext = new TextEncoder().encode('Confidential field operational telemetry');

    const envelope = await providerA.encryptForPeer(identityB.dhPublicKey, plaintext);

    expect(envelope.ciphertext.length).toBeGreaterThan(16);
    expect(envelope.nonce.length).toBe(12);
    expect(envelope.senderEphemeralPublicKey.length).toBe(32);

    // Peer B decrypts using sender's ephemeral public key
    const decrypted = await providerB.decrypt(
      envelope.ciphertext,
      envelope.senderEphemeralPublicKey,
      envelope.nonce
    );

    expect(new TextDecoder().decode(decrypted)).toBe('Confidential field operational telemetry');
  });
});
