/**
 * Durable Mesh Deduplication Store
 * Persists seen packet identifiers, origin IDs, and expiration timestamps to IndexedDB
 * so routing deduplication and loop prevention survive reboots and application restarts.
 */

import { storageDB } from './db';
import { STORES } from './migrations';

export interface DurableDedupRecord {
  packetId: string;
  expiresAt: number;
  originId?: string;
  sequence?: number;
  recordedAt: number;
}

const volatileDedupFallback = new Map<string, DurableDedupRecord>();

export class DurableDedupStore {
  /**
   * Persists a seen packet record to durable storage.
   */
  public static async recordSeen(
    packetId: string,
    expiresAt: number,
    meta?: { originId?: string; sequence?: number }
  ): Promise<void> {
    const record: DurableDedupRecord = {
      packetId,
      expiresAt,
      originId: meta?.originId,
      sequence: meta?.sequence,
      recordedAt: Date.now(),
    };

    volatileDedupFallback.set(packetId, record);

    try {
      await storageDB.writeDurably(STORES.DEDUP, (store) => {
        return store.put(record);
      });
    } catch {
      // Handled by volatile memory fallback
    }
  }

  /**
   * Loads all active, unexpired seen packet records from durable storage.
   * Called during startup/reboot to rehydrate the routing deduplication cache.
   */
  public static async loadActiveRecords(): Promise<DurableDedupRecord[]> {
    const now = Date.now();
    const activeFromMemory = Array.from(volatileDedupFallback.values()).filter(
      (r) => r.expiresAt > now
    );

    try {
      const db = await storageDB.getDB();
      return new Promise<DurableDedupRecord[]>((resolve) => {
        const tx = db.transaction(STORES.DEDUP, 'readonly');
        const store = tx.objectStore(STORES.DEDUP);
        const req = store.getAll();

        req.onsuccess = () => {
          const results: DurableDedupRecord[] = req.result || [];
          const unexpired = results.filter((r) => r && r.expiresAt > now);
          // Sync into memory fallback
          for (const rec of unexpired) {
            volatileDedupFallback.set(rec.packetId, rec);
          }
          resolve(unexpired);
        };

        req.onerror = () => {
          resolve(activeFromMemory);
        };
      });
    } catch {
      return activeFromMemory;
    }
  }

  /**
   * Prunes expired deduplication entries from durable storage to prevent unbounded growth.
   */
  public static async pruneExpired(): Promise<number> {
    const now = Date.now();
    let pruned = 0;

    for (const [key, record] of volatileDedupFallback.entries()) {
      if (record.expiresAt <= now) {
        volatileDedupFallback.delete(key);
        pruned += 1;
      }
    }

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.DEDUP, 'readwrite');
      const store = tx.objectStore(STORES.DEDUP);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: DurableDedupRecord[] = req.result || [];
        for (const rec of records) {
          if (rec.expiresAt <= now) {
            store.delete(rec.packetId);
            pruned += 1;
          }
        }
      };
    } catch {
      // In-memory already pruned
    }

    return pruned;
  }

  public static clearMemory(): void {
    volatileDedupFallback.clear();
  }
}
