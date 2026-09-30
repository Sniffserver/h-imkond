/**
 * HÕIMU Cryptographic HKDF (RFC 5869) Implementation
 * Extracts and expands cryptographic key material using HMAC-SHA-256.
 */

import { toHex, fromHex } from './utils';

export async function hkdfExtractAndExpand(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  lengthBytes: number
): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      baseKey,
      lengthBytes * 8
    );
    return new Uint8Array(derived);
  }

  // Node.js fallback
  const nodeCrypto = await import('crypto');
  const derived = nodeCrypto.hkdfSync(
    'sha256',
    Buffer.from(ikm),
    Buffer.from(salt),
    Buffer.from(info),
    lengthBytes
  );
  return new Uint8Array(derived);
}
