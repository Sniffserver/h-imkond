/**
 * Storage Domain: secureSecrets
 * 
 * Persists cryptographic seeds, private keys, and hardware key material.
 * 
 * STRICT RULE: Stored in IndexedDB (STORES.SECURE_SECRETS) or WebCrypto non-extractable storage.
 * NEVER stored in localStorage!
 * Includes automatic migration to purge any legacy seeds from localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface StoredSecret {
  keyId: string;
  type: 'seed' | 'private_key' | 'pre_shared_key' | 'backup_passphrase';
  secretHex: string;
  algorithm?: string;
  createdAt: number;
}

const memorySecrets = new Map<string, StoredSecret>();

const LEGACY_STORAGE_SEED_KEYS = [
  'hoimu_identity_master_seed',
  'hoimu_crypto_seed',
  'hoimu_identity_seed',
];

export class SecureSecretsStore {
  /**
   * Retrieves a secret by keyId.
   */
  public static async getSecret(keyId: string): Promise<StoredSecret | null> {
    // Check in-memory first
    if (memorySecrets.has(keyId)) {
      return memorySecrets.get(keyId)!;
    }

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.SECURE_SECRETS, 'readonly');
        const req = tx.objectStore(STORES.SECURE_SECRETS).get(keyId);
        req.onsuccess = () => {
          const res = req.result as StoredSecret | undefined;
          if (res) {
            memorySecrets.set(keyId, res);
            resolve(res);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Saves a secret securely into IndexedDB.
   */
  public static async saveSecret(secret: Omit<StoredSecret, 'createdAt'> & { createdAt?: number }): Promise<void> {
    const record: StoredSecret = {
      ...secret,
      createdAt: secret.createdAt || Date.now(),
    };

    memorySecrets.set(record.keyId, record);

    try {
      await storageDB.writeDurably(STORES.SECURE_SECRETS, (store) => {
        return store.put(record);
      });
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Deletes a secret from secure storage.
   */
  public static async deleteSecret(keyId: string): Promise<void> {
    memorySecrets.delete(keyId);

    try {
      await storageDB.writeDurably(STORES.SECURE_SECRETS, (store) => {
        return store.delete(keyId);
      });
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Clears all secrets (used during nuclear reset).
   */
  public static async clear(): Promise<void> {
    memorySecrets.clear();

    try {
      await storageDB.writeDurably(STORES.SECURE_SECRETS, (store) => {
        return store.clear();
      });
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Migration utility: Purges any legacy cryptographic seeds from localStorage
   * and moves them into IndexedDB secure storage.
   */
  public static async purgeAndMigrateLegacyLocalStorage(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    for (const key of LEGACY_STORAGE_SEED_KEYS) {
      const legacySeed = localStorage.getItem(key);
      if (legacySeed) {
        // Save to IndexedDB secureSecrets
        await this.saveSecret({
          keyId: 'master_identity_seed',
          type: 'seed',
          secretHex: legacySeed,
        });

        // Strictly delete from localStorage
        localStorage.removeItem(key);
        console.info(`[SecureSecretsStore] Migrated and scrubbed legacy seed from localStorage key '${key}'`);
      }
    }
  }
}
