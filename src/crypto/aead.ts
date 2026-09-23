/**
 * Real AEAD (AES-256-GCM) Authenticated Encryption with Associated Data
 */

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available');
}

export interface AEADEncryptedResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  tag?: Uint8Array;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function encryptAEAD(
  keyBytes: Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Promise<AEADEncryptedResult> {
  const subtle = getSubtle();
  const nonce = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard GCM nonce

  const aesKey = await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: associatedData,
      tagLength: 128,
    },
    aesKey,
    plaintext
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    nonce,
  };
}

export async function decryptAEAD(
  keyBytes: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const aesKey = await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: associatedData,
      tagLength: 128,
    },
    aesKey,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}
