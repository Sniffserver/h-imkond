/**
 * Storage Domain: identity
 * 
 * Persists local user node identity, public signing key, public DH key,
 * callsign, and node profile.
 * 
 * RULE: Backed by IndexedDB. NEVER stored in localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface StoredIdentity {
  nodeId: string;
  callsign: string;
  signingPublicKeyHex: string;
  dhPublicKeyHex: string;
  createdAt: number;
  updatedAt: number;
  bio?: string;
  locationName?: string;
}

let memoryIdentity: StoredIdentity | null = null;

export class IdentityStore {
  public static async getLocalIdentity(): Promise<StoredIdentity | null> {
    if (memoryIdentity) return memoryIdentity;

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.IDENTITY, 'readonly');
        const store = tx.objectStore(STORES.IDENTITY);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result || []) as StoredIdentity[];
          if (results.length > 0) {
            memoryIdentity = results[0];
            resolve(memoryIdentity);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(memoryIdentity);
      });
    } catch {
      return memoryIdentity;
    }
  }

  public static async saveLocalIdentity(identity: StoredIdentity): Promise<void> {
    memoryIdentity = { ...identity, updatedAt: Date.now() };

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.IDENTITY, 'readwrite');
      tx.objectStore(STORES.IDENTITY).put(memoryIdentity);
    } catch {
      // Memory fallback active
    }
  }

  public static async clear(): Promise<void> {
    memoryIdentity = null;
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.IDENTITY, 'readwrite');
      tx.objectStore(STORES.IDENTITY).clear();
    } catch {
      // Memory fallback active
    }
  }
}
