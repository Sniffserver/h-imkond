/**
 * Storage Domain: appState
 * 
 * Persists application domain records:
 * - resources
 * - transactions
 * - crisisAlerts
 * - daoProposals
 * - calendarEvents
 * - skills
 * - endorsements
 * 
 * RULE: Backed by IndexedDB. NOT localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface DomainStateRecord<T = any> {
  domain: string;
  data: T;
  updatedAt: number;
}

const memoryAppState = new Map<string, any>();

export class AppStateStore {
  /**
   * Retrieves domain data for a given domain key.
   */
  public static async getDomainData<T>(domain: string): Promise<T | null> {
    if (memoryAppState.has(domain)) {
      return memoryAppState.get(domain) as T;
    }

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.APP_STATE, 'readonly');
        const req = tx.objectStore(STORES.APP_STATE).get(domain);
        req.onsuccess = () => {
          const res = req.result as DomainStateRecord<T> | undefined;
          if (res) {
            memoryAppState.set(domain, res.data);
            resolve(res.data);
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
   * Saves domain data for a given domain key.
   */
  public static async saveDomainData<T>(domain: string, data: T): Promise<void> {
    memoryAppState.set(domain, data);

    const record: DomainStateRecord<T> = {
      domain,
      data,
      updatedAt: Date.now(),
    };

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.APP_STATE, 'readwrite');
      tx.objectStore(STORES.APP_STATE).put(record);
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Removes domain data for a given domain key.
   */
  public static async removeDomainData(domain: string): Promise<void> {
    memoryAppState.delete(domain);

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.APP_STATE, 'readwrite');
      tx.objectStore(STORES.APP_STATE).delete(domain);
    } catch {
      // Memory fallback active
    }
  }

  /**
   * Clears all app domain state.
   */
  public static async clear(): Promise<void> {
    memoryAppState.clear();

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.APP_STATE, 'readwrite');
      tx.objectStore(STORES.APP_STATE).clear();
    } catch {
      // Memory fallback active
    }
  }
}
