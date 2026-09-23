/**
 * HÕIMU Core Authenticated Encryption with Associated Data (AEAD)
 * AES-GCM-256 with HKDF-SHA-256 Key Derivation
 */

import { getRandomBytes } from './utils';

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available');
}

/**
 * Derives a 256-bit AES-GCM encryption key from a master secret using HKDF-SHA-256.
 */
export async function deriveKeyHKDF(
  masterSecret: Uint8Array,
  salt: Uint8Array,
  info: string = 'hoimu_mesh_v1'
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const infoBytes = new TextEncoder().encode(info);

  const baseKey = await subtle.importKey(
    'raw',
    masterSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: infoBytes,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext bytes using AES-GCM-256.
 */
export async function encryptAesGcm(
  plaintext: Uint8Array,
  key: CryptoKey,
  nonce?: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const subtle = getSubtle();
  const iv = nonce || getRandomBytes(12);

  const encrypted = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    plaintext
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    nonce: iv,
  };
}

/**
 * Decrypts AES-GCM-256 ciphertext bytes.
 */
export async function decryptAesGcm(
  ciphertext: Uint8Array,
  key: CryptoKey,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const subtle = getSubtle();

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128,
    },
    key,
    ciphertext
  );

  return new Uint8Array(decrypted);
}
