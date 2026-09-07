import { StorageCapability } from './types';
import { getPlatformInfo } from './platform';
import { encryptData, decryptData } from '../../utils/encryption';

/**
 * In-memory fallback store for non-browser or test environments
 */
const memoryStorage = new Map<string, string>();

/**
 * Securely retrieves an encrypted item from persistent device storage.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  const platform = getPlatformInfo();

  if (platform.isTest || typeof window === 'undefined' || !window.localStorage) {
    const raw = memoryStorage.get(key) || null;
    return raw ? decryptData(raw) : null;
  }

  try {
    const raw = localStorage.getItem(`secure_${key}`);
    if (!raw) return null;
    return decryptData(raw);
  } catch (e) {
    console.warn('[SecureStorage] Error reading secure item:', key, e);
    return null;
  }
}

/**
 * Securely persists an item using AES-256 encryption.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  const platform = getPlatformInfo();
  const encrypted = encryptData(value);

  if (platform.isTest || typeof window === 'undefined' || !window.localStorage) {
    memoryStorage.set(key, encrypted);
    return;
  }

  try {
    localStorage.setItem(`secure_${key}`, encrypted);
  } catch (e) {
    console.error('[SecureStorage] Error saving secure item:', key, e);
  }
}

/**
 * Removes a secure item from storage.
 */
export async function removeSecureItem(key: string): Promise<void> {
  const platform = getPlatformInfo();

  if (platform.isTest || typeof window === 'undefined' || !window.localStorage) {
    memoryStorage.delete(key);
    return;
  }

  try {
    localStorage.removeItem(`secure_${key}`);
  } catch (e) {
    console.error('[SecureStorage] Error removing secure item:', key, e);
  }
}

/**
 * Clears secure storage
 */
export async function clearSecureStorage(): Promise<void> {
  const platform = getPlatformInfo();

  if (platform.isTest || typeof window === 'undefined' || !window.localStorage) {
    memoryStorage.clear();
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('secure_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.error('[SecureStorage] Error clearing secure storage:', e);
  }
}

/**
 * Inspects current storage quota & hardware storage capabilities
 */
export async function getStorageCapability(): Promise<StorageCapability> {
  const platform = getPlatformInfo();

  if (platform.isTest || typeof navigator === 'undefined' || !navigator.storage) {
    return {
      secureStorageAvailable: true,
      storageType: platform.isAndroid ? 'capacitor_secure' : 'memory',
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      secureStorageAvailable: true,
      storageType: platform.isAndroid ? 'capacitor_secure' : 'encrypted_localStorage',
      quotaBytes: estimate.quota,
      usageBytes: estimate.usage,
    };
  } catch {
    return {
      secureStorageAvailable: true,
      storageType: 'encrypted_localStorage',
    };
  }
}
