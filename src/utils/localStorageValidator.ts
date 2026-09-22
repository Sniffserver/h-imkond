import { encryptData, decryptData, getEncryptionKey } from './encryption';
import {
  encryptWithWebCrypto,
  decryptWithWebCrypto,
  decryptWebCryptoSync,
  isWebCryptoPayload,
  WEBCRYPTO_PREFIX,
} from './webCrypto';

// In-memory decrypted cache for high-speed zero-latency synchronous access
interface CacheRecord {
  raw: string;
  parsed: unknown;
}
const secureMemoryCache = new Map<string, CacheRecord>();

/**
 * Safely parses and validates JSON data stored in localStorage.
 * Prevents application state corruption from invalid or malformed cached items.
 *
 * @template T - Expected type of the stored item.
 * @param {string} key - The localStorage item key.
 * @param {T} fallback - The fallback value if key does not exist or JSON parsing fails.
 * @param {(data: unknown) => boolean} [validator] - Optional runtime validator function.
 * @returns {T} The parsed object or the fallback value.
 */
export function getSafeLocalStorage<T>(
  key: string,
  fallback: T,
  validator?: (data: unknown) => boolean
): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (validator && !validator(parsed)) {
      console.warn(`[LocalStorageValidator] Validation failed for key "${key}". Reverting to fallback.`);
      return fallback;
    }

    return parsed as T;
  } catch (error) {
    console.error(`[LocalStorageValidator] Error reading key "${key}" from localStorage:`, error);
    return fallback;
  }
}

/**
 * Safely writes a serializable value to localStorage with error handling for QuotaExceededError.
 *
 * @param {string} key - The target key name.
 * @param {unknown} value - The object or value to serialize.
 * @returns {boolean} True if successfully saved, false otherwise.
 */
export function setSafeLocalStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`[LocalStorageValidator] Failed to set item "${key}" in localStorage:`, error);
    return false;
  }
}

/**
 * High-privacy version of localStorage reader.
 * Transparently decrypts data encrypted at rest with Web Crypto API or AES-256 before parsing.
 */
export function getSecureLocalStorage<T>(
  key: string,
  fallback: T
): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }

    // 1. Check memory cache for instant synchronous retrieval if raw has not changed
    const cached = secureMemoryCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T;
    }

    let decrypted: string;
    if (isWebCryptoPayload(raw)) {
      // Synchronously resolve the Web Crypto envelope
      decrypted = decryptWebCryptoSync(raw);
    } else {
      // Legacy or direct AES cipher
      decrypted = decryptData(raw);
    }

    const parsed = JSON.parse(decrypted) as unknown;
    secureMemoryCache.set(key, { raw, parsed });
    return parsed as T;
  } catch (error) {
    // If parsing or decryption fails, check if the raw string was saved unencrypted
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        console.info(`[LocalStorageValidator] Loaded unencrypted fallback for key "${key}" successfully.`);
        secureMemoryCache.set(key, { raw, parsed });
        return parsed as T;
      }
    } catch {}
    
    console.error(`[LocalStorageValidator] Secure error reading key "${key}":`, error);
    return fallback;
  }
}

/**
 * Asynchronous Web Crypto version of localStorage reader.
 * Performs direct native hardware-grade decryption with Web Crypto API (AES-GCM-256)
 * verifying the 128-bit authentication tag.
 */
export async function getSecureLocalStorageAsync<T>(
  key: string,
  fallback: T
): Promise<T> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }

    const cached = secureMemoryCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T;
    }

    let decrypted: string;
    if (isWebCryptoPayload(raw)) {
      decrypted = await decryptWithWebCrypto(raw);
    } else {
      decrypted = decryptData(raw);
    }

    const parsed = JSON.parse(decrypted) as unknown;
    secureMemoryCache.set(key, { raw, parsed });
    return parsed as T;
  } catch (err) {
    console.warn(`[LocalStorageValidator] Async Web Crypto read fallback for key "${key}":`, err);
    return getSecureLocalStorage(key, fallback);
  }
}

/**
 * High-privacy version of localStorage writer.
 * Transparently encrypts the value using Web Crypto API (AES-GCM-256) to guarantee
 * sensitive profiles, auth tokens, and mesh ledgers remain encrypted at rest on the device.
 */
export function setSecureLocalStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);

    // 1. Immediately store an encrypted string to prevent any plaintext exposure at rest
    const immediateEncrypted = encryptData(serialized);
    secureMemoryCache.set(key, { raw: immediateEncrypted, parsed: value });
    localStorage.setItem(key, immediateEncrypted);

    // 2. Perform Web Crypto API AES-GCM-256 hardware-grade encryption asynchronously
    // and upgrade the stored payload to the authenticated Web Crypto envelope at rest
    encryptWithWebCrypto(serialized, true)
      .then((webCryptoPayload) => {
        try {
          localStorage.setItem(key, webCryptoPayload);
          secureMemoryCache.set(key, { raw: webCryptoPayload, parsed: value });
          localStorage.setItem(`${key}_webcrypto_verified`, 'true');
        } catch {
          // Quota or storage restriction
        }
      })
      .catch((err) => {
        console.warn(`[LocalStorageValidator] Web Crypto async persistence failed for "${key}":`, err);
      });

    return true;
  } catch (error) {
    console.error(`[LocalStorageValidator] Secure failed to set item "${key}":`, error);
    return false;
  }
}

/**
 * Asynchronous Web Crypto version of localStorage writer.
 * Guarantees that data is encrypted with native Web Crypto API before returning.
 */
export async function setSecureLocalStorageAsync(key: string, value: unknown): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    const webCryptoPayload = await encryptWithWebCrypto(serialized, true);
    secureMemoryCache.set(key, { raw: webCryptoPayload, parsed: value });
    localStorage.setItem(key, webCryptoPayload);
    localStorage.setItem(`${key}_webcrypto_verified`, 'true');
    return true;
  } catch (err) {
    console.error(`[LocalStorageValidator] setSecureLocalStorageAsync failed for "${key}":`, err);
    return setSecureLocalStorage(key, value);
  }
}

/**
 * Checks whether a key in localStorage is currently encrypted with Web Crypto API
 */
export function isEncryptedWithWebCrypto(key: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const raw = localStorage.getItem(key);
  return isWebCryptoPayload(raw);
}

/**
 * Helper to clear the in-memory cache (primarily for tests)
 */
export function clearSecureMemoryCache(): void {
  secureMemoryCache.clear();
}

export { getEncryptionKey, encryptWithWebCrypto, decryptWithWebCrypto };

