/**
 * HÕIMU Cryptographically Secure Entropy Source
 * Strict security invariant: No Math.random() in security/crypto/protocol/identity contexts.
 */

export class CryptoUnavailableError extends Error {
  constructor(message = 'Cryptographically secure RNG unavailable') {
    super(message);
    this.name = 'CryptoUnavailableError';
  }
}

export function getSecureRandomBytes(length: number): Uint8Array {
  const gCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (gCrypto?.getRandomValues) {
    const result = new Uint8Array(length);
    gCrypto.getRandomValues(result);
    return result;
  }

  // Node runtime fallback
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto.randomBytes) {
      return new Uint8Array(nodeCrypto.randomBytes(length));
    }
  } catch {}

  throw new CryptoUnavailableError('Cryptographically secure RNG unavailable');
}

export function getRandomBytes(count: number): Uint8Array {
  return getSecureRandomBytes(count);
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function randomId(prefix = 'id'): string {
  const bytes = getSecureRandomBytes(8);
  return `${prefix}_${toHex(bytes)}`;
}

export function secureId(prefix = 'sec'): string {
  const bytes = getSecureRandomBytes(16);
  return `${prefix}_${toHex(bytes)}`;
}

export function protocolNonce(length = 16): Uint8Array {
  return getSecureRandomBytes(length);
}

export function pairingToken(digits = 6): string {
  const bytes = getSecureRandomBytes(4);
  const val = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const mod = Math.pow(10, digits);
  return String(val % mod).padStart(digits, '0');
}

export function messageId(): string {
  const bytes = getSecureRandomBytes(12);
  return `msg_${toHex(bytes)}`;
}
