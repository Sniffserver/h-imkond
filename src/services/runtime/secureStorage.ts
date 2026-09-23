import { StorageCapability } from './types';
import { getPlatformInfo } from './platform';
import {
  getIdentityService,
  getSecureItem as getIdentitySecureItem,
  setSecureItem as setIdentitySecureItem,
  removeSecureItem as removeIdentitySecureItem,
  clearSecureStorage as clearIdentitySecureStorage,
} from '../identity';

/**
 * Securely retrieves an encrypted item from persistent device storage.
 * - On Web: AES-GCM-256 with non-extractable CryptoKey in IndexedDB.
 * - On Android: Backed by Android Keystore hardware TEE / StrongBox.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const val = await getIdentitySecureItem(key);
    if (val !== null) return val;

    // Backward compatibility fallback for legacy items
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(`secure_${key}`);
      if (raw) return raw;
    }
    return null;
  } catch (e) {
    console.warn('[SecureStorage] Error reading secure item:', key, e);
    return null;
  }
}

/**
 * Securely persists an item into hardware-bound or non-extractable storage.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await setIdentitySecureItem(key, value);
  } catch (e) {
    console.error('[SecureStorage] Error saving secure item:', key, e);
  }
}

/**
 * Removes a secure item from storage.
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    await removeIdentitySecureItem(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(`secure_${key}`);
    }
  } catch (e) {
    console.error('[SecureStorage] Error removing secure item:', key, e);
  }
}

/**
 * Clears secure storage
 */
export async function clearSecureStorage(): Promise<void> {
  try {
    await clearIdentitySecureStorage();
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('secure_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) {
    console.error('[SecureStorage] Error clearing secure storage:', e);
  }
}

/**
 * Inspects current storage quota & hardware storage capabilities
 */
export async function getStorageCapability(): Promise<StorageCapability> {
  const platform = getPlatformInfo();
  const identity = getIdentityService();

  const baseStorageType = identity.providerType === 'android_keystore'
    ? 'android_keystore'
    : identity.providerType === 'webcrypto_indexeddb'
      ? 'webcrypto_indexeddb'
      : 'memory';

  if (platform.isTest || typeof navigator === 'undefined' || !navigator.storage) {
    return {
      secureStorageAvailable: true,
      storageType: baseStorageType,
      isHardwareBacked: identity.isHardwareBacked,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      secureStorageAvailable: true,
      storageType: baseStorageType,
      isHardwareBacked: identity.isHardwareBacked,
      quotaBytes: estimate.quota,
      usageBytes: estimate.usage,
    };
  } catch {
    return {
      secureStorageAvailable: true,
      storageType: baseStorageType,
      isHardwareBacked: identity.isHardwareBacked,
    };
  }
}
