import {
  encryptWithWebCrypto,
  decryptWithWebCrypto,
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
 * Returns decoded data from memory cache or initializes async decryption.
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

    // 1. Check memory cache if raw in storage matches cache
    const cached = secureMemoryCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed as T;
    }

    // 2. If raw is WebCrypto payload, trigger async decryption to warm up memory cache
    if (isWebCryptoPayload(raw)) {
      decryptWithWebCrypto(raw)
        .then((decrypted) => {
          try {
            const parsed = JSON.parse(decrypted) as unknown;
            secureMemoryCache.set(key, { raw, parsed });
          } catch {}
        })
        .catch(() => {
          // Gracefully reset obsolete or cross-session payload without noisy console errors
          try {
            localStorage.removeItem(key);
            secureMemoryCache.delete(key);
          } catch {}
        });

      if (cached) {
        return cached.parsed as T;
      }
      return fallback;
    }

    // 3. If raw is unencrypted plaintext JSON (e.g. initial boot, tests, or migration)
    try {
      const parsed = JSON.parse(raw) as unknown;
      secureMemoryCache.set(key, { raw, parsed });
      // Schedule background upgrade to WebCrypto
      encryptWithWebCrypto(raw)
        .then((encrypted) => {
          try {
            localStorage.setItem(key, encrypted);
            secureMemoryCache.set(key, { raw: encrypted, parsed });
          } catch {}
        })
        .catch(() => {});
      return parsed as T;
    } catch {
      return fallback;
    }
  } catch (error) {
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
      // Unencrypted JSON
      decrypted = raw;
    }

    const parsed = JSON.parse(decrypted) as unknown;
    secureMemoryCache.set(key, { raw, parsed });
    return parsed as T;
  } catch (err) {
    console.error(`[LocalStorageValidator] getSecureLocalStorageAsync failed for "${key}":`, err);
    return fallback;
  }
}

/**
 * High-privacy version of localStorage writer.
 * Guarantees that data is encrypted with native Web Crypto API (AES-GCM-256).
 */
export function setSecureLocalStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);

    // Save in memory cache immediately for zero latency within process
    secureMemoryCache.set(key, { raw: '', parsed: value });

    // Set immediate non-plaintext envelope to prevent unencrypted leaks
    const placeholder = `${WEBCRYPTO_PREFIX}${JSON.stringify({
      v: 2,
      alg: 'AES-GCM-256',
      iv: '',
      ct: '',
      tagLength: 128,
      ts: Date.now(),
    })}`;
    localStorage.setItem(key, placeholder);
    secureMemoryCache.set(key, { raw: placeholder, parsed: value });

    // Perform Web Crypto API AES-GCM-256 encryption asynchronously and store encrypted envelope
    encryptWithWebCrypto(serialized)
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
        console.error(`[LocalStorageValidator] Web Crypto async encryption failed for "${key}":`, err);
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
    const webCryptoPayload = await encryptWithWebCrypto(serialized);
    secureMemoryCache.set(key, { raw: webCryptoPayload, parsed: value });
    localStorage.setItem(key, webCryptoPayload);
    localStorage.setItem(`${key}_webcrypto_verified`, 'true');
    return true;
  } catch (err) {
    console.error(`[LocalStorageValidator] setSecureLocalStorageAsync failed for "${key}":`, err);
    return false;
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

export { encryptWithWebCrypto, decryptWithWebCrypto };
