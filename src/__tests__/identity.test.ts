import { describe, it, expect } from 'vitest';
import {
  createIdentityFromSeed,
  generateRandomIdentity,
  deriveNodeId,
  exportIdentityBackup,
  restoreIdentityFromSeed,
} from '../crypto/identity';
import { signBytes, verifySignature } from '../crypto/ed25519';

describe('HÕIMU Node Identity & Key Management', () => {
  it('derives deterministic Ed25519 and X25519 keys from seed', async () => {
    const seed = 'deterministic_test_seed_1234567890abcdef';
    const id1 = await createIdentityFromSeed(seed, 'TALLINN-01');
    const id2 = await createIdentityFromSeed(seed, 'TALLINN-01');

    expect(id1.nodeId).toBe(id2.nodeId);
    expect(id1.signingPublicKeyHex).toBe(id2.signingPublicKeyHex);
    expect(id1.dhPublicKeyHex).toBe(id2.dhPublicKeyHex);
    expect(id1.callsign).toBe('TALLINN-01');
    expect(id1.nodeId.length).toBe(16);
  });

  it('generates random identity with valid Web Crypto key pairs', async () => {
    const id = await generateRandomIdentity('RANDO-99');
    expect(id.callsign).toBe('RANDO-99');
    expect(id.signingKeyPair.publicKey).toBeDefined();
    expect(id.signingKeyPair.privateKey).toBeDefined();
    expect(id.dhKeyPair.publicKey).toBeDefined();
    expect(id.dhKeyPair.privateKey).toBeDefined();

    // Verify signing with the generated identity
    const message = new TextEncoder().encode('Hello Mesh');
    const sig = await signBytes(id.signingKeyPair.privateKey, message);
    const isValid = await verifySignature(id.signingPublicKeyHex, message, sig);
    expect(isValid).toBe(true);
  });

  it('exports and restores identity backup', async () => {
    const seedHex = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
    const id = await createIdentityFromSeed(seedHex, 'FIELD-HQ');
    const backup = exportIdentityBackup(id, seedHex);

    expect(backup.callsign).toBe('FIELD-HQ');
    expect(backup.seedHex).toBe(seedHex);

    const restored = await restoreIdentityFromSeed(backup.seedHex!, backup.callsign);
    expect(restored.signingPublicKeyHex).toBe(id.signingPublicKeyHex);
    expect(restored.nodeId).toBe(id.nodeId);
  });
});
