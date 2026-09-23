/**
 * Real HKDF (RFC 5869) using Web Crypto API
 */

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
}

export async function hkdfDerive(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  lengthBytes = 32
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const derivedBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    baseKey,
    lengthBytes * 8
  );

  return new Uint8Array(derivedBits);
}
