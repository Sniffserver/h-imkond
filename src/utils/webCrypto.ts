/**
 * HÕIMU Web Crypto API Encryption Layer
 * 
 * Provides hardware-grade, tamper-evident AES-GCM-256 encryption at rest
 * for sensitive user profiles, cryptographic identities, auth tokens,
 * and peer exchange journals stored on device.
 * 
 * Security Policy:
 * - NO WEAK FALLBACKS / NO SILENT SECURITY DEGRADATION.
 * - If WebCrypto/Hardware Keystore is available, AES-GCM-256 is strictly enforced.
 * - Non-extractable device keys prevent key exfiltration.
 */

import { identityService } from '../services/identity';

export const WEBCRYPTO_PREFIX = 'hoimu_webcrypto:';

export interface WebCryptoEnvelope {
  v: 2;
  alg: 'AES-GCM-256';
  iv: string; // Base64 encoded 96-bit initialization vector
  ct: string; // Base64 encoded ciphertext + 128-bit authentication tag
  tagLength: 128;
  ts: number;
}

// Memory cache of the imported CryptoKey to eliminate repeated import overhead
let cachedCryptoKey: CryptoKey | null = null;
let cachedRawKeyHex: string | null = null;

/**
 * Converts an ArrayBuffer or Uint8Array to a Base64 string safely across browsers and Node.js
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

/**
 * Converts a Base64 string to a Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Imports or returns the non-extractable Web Crypto CryptoKey for AES-GCM-256 operations.
 * Guaranteed: extractable is FALSE. Key material is stored in IndexedDB or Android Keystore,
 * never in plaintext localStorage.
 */
export async function getWebCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  // Active cleanup of old legacy raw key from localStorage if present
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem('hoimu_webcrypto_device_raw_key');
      localStorage.removeItem('hoimu_aes_key');
    } catch {}
  }

  cachedCryptoKey = await identityService.getDeviceKey();
  return cachedCryptoKey;
}

/**
 * Resets cached crypto key (useful for test suites)
 */
export function resetCachedWebCryptoKey(): void {
  cachedCryptoKey = null;
  cachedRawKeyHex = null;
}

/**
 * Checks if a stored string is wrapped in a Web Crypto envelope
 */
export function isWebCryptoPayload(str: unknown): boolean {
  return typeof str === 'string' && str.startsWith(WEBCRYPTO_PREFIX);
}

/**
 * Encrypts a plaintext string strictly using the Web Crypto API (AES-GCM-256).
 * Produces an authenticated encrypted-at-rest envelope with a 96-bit random IV and 128-bit authentication tag.
 * Throws if the cryptographic subsystem is unavailable (no silent downgrade).
 */
export async function encryptWithWebCrypto(plaintext: string): Promise<string> {
  if (!plaintext) return '';

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('[WebCrypto] Cryptographic subsystem unavailable: AES-GCM-256 WebCrypto is required.');
  }

  const key = await getWebCryptoKey();
  const iv = new Uint8Array(12); // Standard 96-bit IV for AES-GCM
  cryptoObj.getRandomValues(iv);

  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const cipherBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    data
  );

  const envelope: WebCryptoEnvelope = {
    v: 2,
    alg: 'AES-GCM-256',
    iv: bufferToBase64(iv),
    ct: bufferToBase64(cipherBuffer),
    tagLength: 128,
    ts: Date.now(),
  };

  return `${WEBCRYPTO_PREFIX}${JSON.stringify(envelope)}`;
}

/**
 * Decrypts a Web Crypto envelope strictly using the Web Crypto API (AES-GCM-256).
 * Verifies the 128-bit authentication tag to ensure data integrity and tamper resistance.
 * Rejects tampering or missing authentication tags without weaker fallbacks.
 */
export async function decryptWithWebCrypto(encryptedString: string): Promise<string> {
  if (!encryptedString) return '';

  if (!isWebCryptoPayload(encryptedString)) {
    throw new Error('[WebCrypto] Invalid payload: Missing WebCrypto authentication prefix header.');
  }

  const rawJson = encryptedString.slice(WEBCRYPTO_PREFIX.length);
  let envelope: WebCryptoEnvelope;
  try {
    envelope = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`[WebCrypto] Malformed envelope JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('[WebCrypto] Cryptographic subsystem unavailable: WebCrypto is required for decryption.');
  }

  if (!envelope.iv || !envelope.ct) {
    throw new Error('[WebCrypto] Incomplete envelope: IV or Ciphertext payload is missing.');
  }

  const key = await getWebCryptoKey();
  const iv = base64ToBuffer(envelope.iv);
  const ct = base64ToBuffer(envelope.ct);

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    ct
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
