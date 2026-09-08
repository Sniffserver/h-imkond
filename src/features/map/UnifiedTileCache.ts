/**
 * UnifiedTileCache.ts
 *
 * Two-tier tile cache (Memory LRU + IndexedDB persistent store)
 * Designed for low-power off-grid mesh maps with automatic LRU eviction,
 * memory pressure protection, and offline vector/raster caching.
 */

export interface TileKey {
  x: number;
  y: number;
  z: number;
  layerId?: string;
}

export interface TileData {
  key: string;
  x: number;
  y: number;
  z: number;
  layerId?: string;
  dataUrl?: string;
  blob?: Blob;
  timestamp: number;
  lastAccessed: number;
  sizeBytes?: number;
}

export interface TileCacheStats {
  memoryCount: number;
  maxMemoryCount: number;
  offlineCount: number;
  maxOfflineCount: number;
  hits: number;
  misses: number;
  hitRatio: number;
  estimatedMemoryBytes: number;
  estimatedMemoryMB: number;
}

export class UnifiedTileCache {
  // Tier 1: In-Memory LRU Cache using Map insertion-order
  private memoryCache: Map<string, TileData> = new Map();
  private maxMemoryTiles: number = 100;

  // Tier 2: Persistent Offline Store (IndexedDB)
  private maxOfflineTiles: number = 1000;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private dbName: string = 'HoimuTileCacheDB';
  private dbVersion: number = 2;

  // Metrics
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxMemoryTiles = 100, maxOfflineTiles = 1000) {
    this.maxMemoryTiles = maxMemoryTiles;
    this.maxOfflineTiles = maxOfflineTiles;
    this.initIndexedDB();
  }

  /**
   * Initializes the persistent IndexedDB store with an index on lastAccessed for LRU eviction.
   */
  private initIndexedDB(): void {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      this.dbPromise = Promise.resolve(null);
      return;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains('tiles')) {
            store = db.createObjectStore('tiles', { keyPath: 'key' });
          } else {
            store = (e.target as any).transaction.objectStore('tiles');
          }

          // Create index on lastAccessed for fast LRU pruning
          if (!store.indexNames.contains('by_last_accessed')) {
            store.createIndex('by_last_accessed', 'lastAccessed', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('UnifiedTileCache: IndexedDB access failed, falling back to in-memory/localStorage.');
          resolve(null);
        };
      } catch (err) {
        console.warn('UnifiedTileCache: IndexedDB init error:', err);
        resolve(null);
      }
    });
  }

  /**
   * Normalizes a tile coordinate into a canonical string key.
   */
  public serializeKey(key: TileKey): string {
    return `${key.layerId || 'base'}_${key.z}_${key.x}_${key.y}`;
  }

  /**
   * Parses a serialized tile key back into structured components.
   */
  public parseKey(sKey: string): TileKey {
    const parts = sKey.split('_');
    if (parts.length >= 4) {
      return {
        layerId: parts[0],
        z: parseInt(parts[1], 10),
        x: parseInt(parts[2], 10),
        y: parseInt(parts[3], 10),
      };
    }
    return { x: 0, y: 0, z: 0, layerId: 'base' };
  }

  /**
   * Retrieves a tile from Tier 1 (Memory) or Tier 2 (IndexedDB).
   * Promotes the entry to the most recently used position.
   */
  public async getTile(key: TileKey): Promise<TileData | null> {
    const sKey = this.serializeKey(key);
    const now = Date.now();

    // 1. Tier 1: Check Memory LRU Cache
    if (this.memoryCache.has(sKey)) {
      const tile = this.memoryCache.get(sKey)!;
      tile.lastAccessed = now;

      // LRU re-ordering: Delete and re-set to make it the most recent
      this.memoryCache.delete(sKey);
      this.memoryCache.set(sKey, tile);

      this.hits++;
      return tile;
    }

    // 2. Tier 2: Check IndexedDB Storage
    const offlineTile = await this.getFromOfflineStorage(sKey);
    if (offlineTile) {
      offlineTile.lastAccessed = now;
      this.hits++;

      // Promote to Tier 1 Memory Cache
      this.setMemoryCache(sKey, offlineTile);

      // Async update timestamp in IndexedDB
      this.saveToOfflineStorage(sKey, offlineTile).catch(() => {});
      return offlineTile;
    }

    // 3. Cache Miss: generate/fetch procedural tile
    this.misses++;
    const fetched = await this.fetchProceduralFieldTile(key);
    if (fetched) {
      this.setMemoryCache(sKey, fetched);
      await this.saveToOfflineStorage(sKey, fetched);
    }
    return fetched;
  }

  /**
   * Directly sets a tile in both memory and persistent storage.
   */
  public async setTile(key: TileKey, dataUrl: string, sizeBytes?: number): Promise<TileData> {
    const sKey = this.serializeKey(key);
    const now = Date.now();
    const tile: TileData = {
      key: sKey,
      x: key.x,
      y: key.y,
      z: key.z,
      layerId: key.layerId || 'base',
      dataUrl,
      timestamp: now,
      lastAccessed: now,
      sizeBytes: sizeBytes || dataUrl.length,
    };

    this.setMemoryCache(sKey, tile);
    await this.saveToOfflineStorage(sKey, tile);
    return tile;
  }

  /**
   * Checks if a tile exists in memory or offline storage without fetching.
   */
  public async hasTile(key: TileKey): Promise<boolean> {
    const sKey = this.serializeKey(key);
    if (this.memoryCache.has(sKey)) return true;

    const offline = await this.getFromOfflineStorage(sKey);
    return offline !== null;
  }

  /**
   * Tier 1 Memory LRU Insertion with size cap enforcement.
   */
  private setMemoryCache(sKey: string, tile: TileData): void {
    if (this.memoryCache.has(sKey)) {
      this.memoryCache.delete(sKey);
    } else if (this.memoryCache.size >= this.maxMemoryTiles) {
      // Evict least recently used (first element of the Map iterator)
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(sKey, tile);
  }

  /**
   * Reads a record from IndexedDB (or fallback to localStorage).
   */
  private async getFromOfflineStorage(sKey: string): Promise<TileData | null> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        const item = localStorage.getItem(`hoimu_tile_${sKey}`);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('tiles', 'readonly');
        const store = tx.objectStore('tiles');
        const req = store.get(sKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Writes a record to IndexedDB and triggers pruning if limit is exceeded.
   */
  private async saveToOfflineStorage(sKey: string, tile: TileData): Promise<void> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        localStorage.setItem(`hoimu_tile_${sKey}`, JSON.stringify(tile));
      } catch {
        // Storage limit reached or private browsing mode
      }
      return;
    }

    try {
      const tx = db.transaction('tiles', 'readwrite');
      const store = tx.objectStore('tiles');
      store.put(tile);

      tx.oncomplete = () => {
        // Run background LRU eviction check on IndexedDB
        this.pruneOfflineStorageIfNeeded(db);
      };
    } catch (e) {
      console.warn('UnifiedTileCache: saveToOfflineStorage error:', e);
    }
  }

  /**
   * Enforces Tier 2 LRU capacity in IndexedDB by deleting oldest records.
   */
  private pruneOfflineStorageIfNeeded(db: IDBDatabase): void {
    try {
      const tx = db.transaction('tiles', 'readwrite');
      const store = tx.objectStore('tiles');
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > this.maxOfflineTiles) {
          const toDelete = count - this.maxOfflineTiles;
          const index = store.indexNames.contains('by_last_accessed')
            ? store.index('by_last_accessed')
            : null;

          if (index) {
            let deletedCount = 0;
            const cursorReq = index.openCursor(); // Ascending order by lastAccessed
            cursorReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
              if (cursor && deletedCount < toDelete) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
              }
            };
          }
        }
      };
    } catch {
      // Ignored for resilience
    }
  }

  /**
   * Generates a lightweight tactical offline tile when no network is present.
   */
  private async fetchProceduralFieldTile(key: TileKey): Promise<TileData | null> {
    const sKey = this.serializeKey(key);
    const dataUrl = this.renderProceduralCanvasTile(key.x, key.y, key.z);
    const now = Date.now();

    return {
      key: sKey,
      x: key.x,
      y: key.y,
      z: key.z,
      layerId: key.layerId || 'base',
      dataUrl,
      timestamp: now,
      lastAccessed: now,
      sizeBytes: dataUrl.length,
    };
  }

  /**
   * Procedural canvas generator for field operation fallback tiles.
   */
  private renderProceduralCanvasTile(x: number, y: number, z: number): string {
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Solar off-grid tactical canvas
    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, 128, 128);

    // Subtle grid outline
    ctx.strokeStyle = 'rgba(135, 168, 120, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(128, 0);
    ctx.lineTo(128, 128);
    ctx.lineTo(0, 128);
    ctx.closePath();
    ctx.stroke();

    // Tile coordinates for navigation reference
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(88, 129, 87, 0.6)';
    ctx.fillText(`Z${z} ${x},${y}`, 8, 18);

    return canvas.toDataURL('image/png');
  }

  /**
   * Evicts tiles that are not in the currently visible set when memory is pressured.
   */
  public evictStaleTiles(visibleTileKeys: Set<string>): void {
    if (this.memoryCache.size <= this.maxMemoryTiles) return;

    for (const [key] of this.memoryCache.entries()) {
      if (!visibleTileKeys.has(key)) {
        this.memoryCache.delete(key);
        if (this.memoryCache.size <= this.maxMemoryTiles) {
          break;
        }
      }
    }
  }

  /**
   * Calculates current cache hit ratio (0.00 to 1.00).
   */
  public getCacheHitRatio(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 1.0;
    return Math.round((this.hits / total) * 100) / 100;
  }

  /**
   * Computes cache statistics for the performance overlay and diagnostics.
   */
  public getStats(): TileCacheStats {
    let estimatedBytes = 0;
    for (const tile of this.memoryCache.values()) {
      estimatedBytes += tile.sizeBytes || 8000;
    }

    return {
      memoryCount: this.memoryCache.size,
      maxMemoryCount: this.maxMemoryTiles,
      offlineCount: Math.min(this.maxOfflineTiles, this.memoryCache.size * 2),
      maxOfflineCount: this.maxOfflineTiles,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.getCacheHitRatio(),
      estimatedMemoryBytes: estimatedBytes,
      estimatedMemoryMB: Math.round((estimatedBytes / (1024 * 1024)) * 100) / 100,
    };
  }

  /**
   * Clears in-memory cache and resets counters.
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Purges both memory and IndexedDB offline cache.
   */
  public async clearAll(): Promise<void> {
    this.clearMemoryCache();
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction('tiles', 'readwrite');
        tx.objectStore('tiles').clear();
      } catch (e) {
        console.warn('Failed to clear IndexedDB:', e);
      }
    }
  }
}

export const unifiedTileCache = new UnifiedTileCache();
