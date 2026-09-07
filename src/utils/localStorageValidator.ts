import { encryptData, decryptData, getEncryptionKey } from './encryption';

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
 * Transparently decrypts the stored string using AES-256 before parsing.
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

    // Attempt to decrypt
    const decrypted = decryptData(raw);
    const parsed = JSON.parse(decrypted) as unknown;
    return parsed as T;
  } catch (error) {
    // If parsing or decryption fails, check if the raw string was saved unencrypted
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        console.info(`[LocalStorageValidator] Loaded unencrypted fallback for key "${key}" successfully.`);
        return parsed as T;
      }
    } catch {}
    
    console.error(`[LocalStorageValidator] Secure error reading key "${key}":`, error);
    return fallback;
  }
}

/**
 * High-privacy version of localStorage writer.
 * Transparently encrypts the value using AES-256 before saving to protect user data offline.
 */
export function setSecureLocalStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    const encrypted = encryptData(serialized);
    localStorage.setItem(key, encrypted);
    return true;
  } catch (error) {
    console.error(`[LocalStorageValidator] Secure failed to set item "${key}":`, error);
    return false;
  }
}

export { getEncryptionKey };
