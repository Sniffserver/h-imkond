/**
 * Storage Domain: map.packs & map.cache
 * 
 * Persists offline .pmtiles vector map packs and tile geometry caches.
 * 
 * RULE: Backed by IndexedDB. NEVER stored in localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface StoredMapPack {
  id: string;
  cityId: string;
  fileName: string;
  sizeBytes: number;
  installedAt: number;
  metadata: Record<string, any>;
}

const memoryMapPacks = new Map<string, StoredMapPack>();
const memoryTileCache = new Map<string, any>();

export class MapPackStore {
  public static async getPack(id: string): Promise<StoredMapPack | null> {
    if (memoryMapPacks.has(id)) return memoryMapPacks.get(id)!;

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.MAP_PACKS, 'readonly');
        const req = tx.objectStore(STORES.MAP_PACKS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public static async getAllPacks(): Promise<StoredMapPack[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.MAP_PACKS, 'readonly');
        const req = tx.objectStore(STORES.MAP_PACKS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(memoryMapPacks.values()));
      });
    } catch {
      return Array.from(memoryMapPacks.values());
    }
  }

  public static async savePack(pack: StoredMapPack): Promise<void> {
    memoryMapPacks.set(pack.id, pack);
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.MAP_PACKS, 'readwrite');
      tx.objectStore(STORES.MAP_PACKS).put(pack);
    } catch {
      // Memory fallback active
    }
  }

  public static async deletePack(id: string): Promise<void> {
    memoryMapPacks.delete(id);
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.MAP_PACKS, 'readwrite');
      tx.objectStore(STORES.MAP_PACKS).delete(id);
    } catch {
      // Memory fallback active
    }
  }
}

export class MapCacheStore {
  public static async getTile(key: string): Promise<any | null> {
    if (memoryTileCache.has(key)) return memoryTileCache.get(key);

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.MAP_CACHE, 'readonly');
        const req = tx.objectStore(STORES.MAP_CACHE).get(key);
        req.onsuccess = () => resolve(req.result?.data || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public static async putTile(key: string, data: any): Promise<void> {
    memoryTileCache.set(key, data);
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.MAP_CACHE, 'readwrite');
      tx.objectStore(STORES.MAP_CACHE).put({ key, data, timestamp: Date.now() });
    } catch {
      // Memory fallback active
    }
  }

  public static async clear(): Promise<void> {
    memoryTileCache.clear();
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.MAP_CACHE, 'readwrite');
      tx.objectStore(STORES.MAP_CACHE).clear();
    } catch {
      // Memory fallback active
    }
  }
}
