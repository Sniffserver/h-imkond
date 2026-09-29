import { describe, it, expect } from 'vitest';
import { deriveEd25519FromSeed, signBytes, verifySignature } from '../crypto/ed25519';

describe('Cross-Runtime Ed25519 Cryptographic Vector Verification', () => {
  const SEED = 'hoimu_esp32_js_shared_seed_vector_2026';
  const MESSAGE = new TextEncoder().encode('HOIMU_ESP32_CROSS_RUNTIME_TEST_VECTOR_PAYLOAD');

  it('signs payload in JS and verifies signature with JS Ed25519 routines', async () => {
    const keyPair = await deriveEd25519FromSeed(SEED);
    expect(keyPair.publicKeyHex).toBeDefined();

    const sigHex = await signBytes(keyPair.privateKey, MESSAGE);
    expect(sigHex.length).toBe(128); // 64 bytes hex

    const valid = await verifySignature(keyPair.publicKeyHex, MESSAGE, sigHex);
    expect(valid).toBe(true);
  });

  it('detects bit tampering on cross-runtime messages', async () => {
    const keyPair = await deriveEd25519FromSeed(SEED);
    const sigHex = await signBytes(keyPair.privateKey, MESSAGE);

    const tamperedMessage = new TextEncoder().encode('HOIMU_ESP32_CROSS_RUNTIME_TEST_VECTOR_PAYLOAD_TAMPERED');
    const valid = await verifySignature(keyPair.publicKeyHex, tamperedMessage, sigHex);
    expect(valid).toBe(false);
  });
});
