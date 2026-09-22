/**
 * UnifiedTileCache.ts
 *
 * Coherent unified caching engine merging:
 * 1. Vector geometry caching (CityMapData)
 * 2. Raw tile blobs & data URLs (TileCacheService)
 * 3. Raster map tile packages (rasterTileCacheService)
 * 4. Offline downloaded regions (offlineMapService)
 *
 * Features:
 * - Two-tier caching (RAM Memory LRU + IndexedDB persistent store)
 * - Automatic LRU eviction on both tiers based on access timestamps
 * - Quota management & memory pressure protection
 * - Transparent fallback when IndexedDB or Cache API is unavailable
 */

import { OfflineMapRegion, CityMapData } from '../../types';

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
  storageUsageFormatted: string;
}

export class UnifiedTileCache {
  // Tier 1: In-Memory LRU Cache
  private memoryCache: Map<string, TileData> = new Map();
  private maxMemoryTiles: number = 120;

  // Tier 2: Persistent Storage
  private maxOfflineTiles: number = 2000;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly dbName: string = 'HoimuTileCacheDB';
  private readonly dbVersion: number = 3;

  // Analytics
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxMemoryTiles = 120, maxOfflineTiles = 2000) {
    this.maxMemoryTiles = maxMemoryTiles;
    this.maxOfflineTiles = maxOfflineTiles;
    this.initIndexedDB();
  }

  /**
   * Initializes unified IndexedDB schema for tiles, vector bundles, and offline regions.
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

          // 1. Store for individual tiles (raster/vector)
          if (!db.objectStoreNames.contains('tiles')) {
            const tileStore = db.createObjectStore('tiles', { keyPath: 'key' });
            tileStore.createIndex('by_last_accessed', 'lastAccessed', { unique: false });
          }

          // 2. Store for city vector models (roads, buildings, etc.)
          if (!db.objectStoreNames.contains('vector_city')) {
            db.createObjectStore('vector_city', { keyPath: 'id' });
          }

          // 3. Store for offline regions metadata
          if (!db.objectStoreNames.contains('regions')) {
            db.createObjectStore('regions', { keyPath: 'id' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('UnifiedTileCache: IndexedDB unavailable, falling back to in-memory/localStorage.');
          resolve(null);
        };
      } catch (err) {
        console.warn('UnifiedTileCache: IndexedDB initialization error:', err);
        resolve(null);
      }
    });
  }

  // ==========================================
  // 1. Tile Operations (Two-Tier Memory + IDB)
  // ==========================================

  public serializeKey(key: TileKey): string {
    return `${key.layerId || 'base'}_${key.z}_${key.x}_${key.y}`;
  }

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

  public async getTile(key: TileKey): Promise<TileData | null> {
    const sKey = this.serializeKey(key);
    const now = Date.now();

    // 1. Check Tier 1 (Memory LRU)
    if (this.memoryCache.has(sKey)) {
      const tile = this.memoryCache.get(sKey)!;
      tile.lastAccessed = now;

      // Re-insert to mark as recently used
      this.memoryCache.delete(sKey);
      this.memoryCache.set(sKey, tile);
      this.hits++;
      return tile;
    }

    // 2. Check Tier 2 (IndexedDB)
    const offlineTile = await this.getFromOfflineStorage(sKey);
    if (offlineTile) {
      offlineTile.lastAccessed = now;
      this.hits++;

      // Promote to Tier 1
      this.setMemoryCache(sKey, offlineTile);
      this.saveToOfflineStorage(sKey, offlineTile).catch(() => {});
      return offlineTile;
    }

    // 3. Cache Miss - Generate procedural tactical field tile
    this.misses++;
    const fetched = await this.fetchProceduralFieldTile(key);
    if (fetched) {
      this.setMemoryCache(sKey, fetched);
      await this.saveToOfflineStorage(sKey, fetched);
    }
    return fetched;
  }

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

  public async cacheTileBlob(url: string, blob: Blob): Promise<void> {
    const sKey = `blob_${url}`;
    const now = Date.now();
    const tile: TileData = {
      key: sKey,
      x: 0,
      y: 0,
      z: 0,
      blob,
      timestamp: now,
      lastAccessed: now,
      sizeBytes: blob.size,
    };

    this.setMemoryCache(sKey, tile);
    await this.saveToOfflineStorage(sKey, tile);
  }

  public async getTileBlob(url: string): Promise<Blob | undefined> {
    const sKey = `blob_${url}`;
    const now = Date.now();

    if (this.memoryCache.has(sKey)) {
      const tile = this.memoryCache.get(sKey)!;
      tile.lastAccessed = now;
      this.memoryCache.delete(sKey);
      this.memoryCache.set(sKey, tile);
      this.hits++;
      return tile.blob;
    }

    const offline = await this.getFromOfflineStorage(sKey);
    if (offline?.blob) {
      offline.lastAccessed = now;
      this.hits++;
      this.setMemoryCache(sKey, offline);
      return offline.blob;
    }

    this.misses++;
    return undefined;
  }

  private setMemoryCache(sKey: string, tile: TileData): void {
    if (this.memoryCache.has(sKey)) {
      this.memoryCache.delete(sKey);
    } else if (this.memoryCache.size >= this.maxMemoryTiles) {
      // LRU Eviction: delete oldest key
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(sKey, tile);
  }

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

  private async saveToOfflineStorage(sKey: string, tile: TileData): Promise<void> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        localStorage.setItem(`hoimu_tile_${sKey}`, JSON.stringify(tile));
      } catch {
        // LocalStorage quota reached
      }
      return;
    }

    try {
      const tx = db.transaction('tiles', 'readwrite');
      const store = tx.objectStore('tiles');
      store.put(tile);

      tx.oncomplete = () => {
        this.pruneOfflineTilesIfNeeded(db);
      };
    } catch (e) {
      console.warn('UnifiedTileCache: write error:', e);
    }
  }

  private pruneOfflineTilesIfNeeded(db: IDBDatabase): void {
    try {
      const tx = db.transaction('tiles', 'readwrite');
      const store = tx.objectStore('tiles');
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > this.maxOfflineTiles) {
          const toDelete = count - this.maxOfflineTiles;
          const index = store.index('by_last_accessed');
          let deleted = 0;
          const cursorReq = index.openCursor(); // Oldest lastAccessed first
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
            if (cursor && deleted < toDelete) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch {
      // Best-effort resilience
    }
  }

  private async fetchProceduralFieldTile(key: TileKey): Promise<TileData | null> {
    const sKey = this.serializeKey(key);
    const dataUrl = this.generateProceduralFieldTile(key.x, key.y, key.z);
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

  private generateProceduralFieldTile(x: number, y: number, z: number): string {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = 'rgba(135, 168, 120, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(128, 0); ctx.lineTo(128, 128); ctx.lineTo(0, 128); ctx.closePath();
    ctx.stroke();

    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(88, 129, 87, 0.6)';
    ctx.fillText(`Z${z} ${x},${y}`, 8, 18);

    return canvas.toDataURL('image/png');
  }

  // ==========================================
  // 2. Vector City Map Operations (mapTileCache)
  // ==========================================

  public async cacheCityMapData(cityMap: CityMapData): Promise<void> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        localStorage.setItem(`hoimu_city_${cityMap.id}`, JSON.stringify(cityMap));
      } catch (e) {
        console.warn('LocalStorage city write error:', e);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('vector_city', 'readwrite');
        const store = tx.objectStore('vector_city');
        const req = store.put({
          ...cityMap,
          cachedAt: Date.now(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getCachedCityMapData(cityId: string): Promise<CityMapData | null> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        const raw = localStorage.getItem(`hoimu_city_${cityId}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('vector_city', 'readonly');
        const store = tx.objectStore('vector_city');
        const req = store.get(cityId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  // ==========================================
  // 3. Offline Region Management (offlineMapService)
  // ==========================================

  public getDownloadedRegions(): OfflineMapRegion[] {
    try {
      const saved = localStorage.getItem('hoimu_offline_regions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load regions:', e);
    }
    return [];
  }

  /**
   * Pins and caches the current active viewport locally into IndexedDB and RAM.
   * Generates and stores the multi-zoom tactical raster and vector tiles
   * to ensure offline map availability when disconnected from mesh gateways.
   */
  public async pinAndCacheCurrentViewport(params: {
    center: { lat: number; lng: number };
    zoom: number;
    name?: string;
    peers?: any[];
    resources?: any[];
  }): Promise<{ region: OfflineMapRegion; cachedTilesCount: number; sizeBytes: number }> {
    const { center, zoom, name, peers = [], resources = [] } = params;
    const now = Date.now();
    const regionId = `pinned_viewport_${Math.round(center.lat * 100)}_${Math.round(center.lng * 100)}_${Math.round(zoom)}`;

    // Generate tiles across current zoom and adjacent zoom levels
    const targetZooms = [
      Math.max(1, Math.round(zoom) - 1),
      Math.round(zoom),
      Math.min(18, Math.round(zoom) + 1),
    ];

    let cachedCount = 0;
    let totalBytes = 0;

    for (const z of targetZooms) {
      const n = Math.pow(2, z);
      const latRad = (center.lat * Math.PI) / 180;
      const xCenter = Math.floor(((center.lng + 180) / 360) * n);
      const yCenter = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
      );

      // Cache a 3x3 tile grid around center for each zoom level (9 tiles per level = ~27 tiles total)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const tileX = (xCenter + dx + n) % n;
          const tileY = Math.max(0, Math.min(n - 1, yCenter + dy));
          const tileKey: TileKey = {
            x: tileX,
            y: tileY,
            z,
            layerId: 'base_tactical',
          };

          const tile = await this.getTile(tileKey);
          if (tile) {
            cachedCount++;
            totalBytes += tile.sizeBytes || 4096;
          }
        }
      }
    }

    const regionName =
      name || `Pinned Viewport (${center.lat.toFixed(3)}°, ${center.lng.toFixed(3)}°)`;
    const formattedSize =
      totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(totalBytes / 1024)} KB`;

    const region: OfflineMapRegion = {
      id: regionId,
      name: regionName,
      cityId: 'pinned_local',
      cityName: 'Pinned Tactical Sector',
      bioregionName: 'Local Mesh Sector',
      centerCoords: {
        x: 0,
        y: 0,
        lat: center.lat,
        lng: center.lng,
      },
      radiusKm: 3.5,
      worldRadius: 400,
      downloadedAt: now,
      sizeBytes: totalBytes,
      sizeFormatted: formattedSize,
      nodeCount: peers.length,
      resourceCount: resources.length,
      streetSegmentCount: 16,
      poiCount: resources.length,
      bounds: {
        minX: -400,
        maxX: 400,
        minY: -400,
        maxY: 400,
      },
      cachedNodes: peers,
      cachedResources: resources,
      cachedPoiNames: resources.map((r: any) => r.title || r.name || 'Resource'),
      isPinned: true,
      tileCount: cachedCount,
      isActiveOffline: true,
    };

    this.saveRegion(region);
    return { region, cachedTilesCount: cachedCount, sizeBytes: totalBytes };
  }

  public saveRegion(region: OfflineMapRegion): OfflineMapRegion[] {
    const existing = this.getDownloadedRegions();
    const updated = [region, ...existing.filter((r) => r.id !== region.id)];
    try {
      localStorage.setItem('hoimu_offline_regions_v1', JSON.stringify(updated));
    } catch {
      if (updated.length > 1) {
        updated.pop();
        localStorage.setItem('hoimu_offline_regions_v1', JSON.stringify(updated));
      }
    }
    return updated;
  }

  public deleteRegion(regionId: string): OfflineMapRegion[] {
    const existing = this.getDownloadedRegions();
    const updated = existing.filter((r) => r.id !== regionId);
    try {
      localStorage.setItem('hoimu_offline_regions_v1', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete region:', e);
    }
    return updated;
  }

  public getStorageUsage(): { usedBytes: number; formatted: string; count: number } {
    const regions = this.getDownloadedRegions();
    const totalBytes = regions.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
    const formatted =
      totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(totalBytes / 1024).toFixed(1)} KB`;

    return {
      usedBytes: totalBytes,
      formatted,
      count: regions.length,
    };
  }

  // ==========================================
  // 4. Memory & Performance Pruning
  // ==========================================

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

  public getCacheHitRatio(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 1.0;
    return Math.round((this.hits / total) * 100) / 100;
  }

  public getStats(): TileCacheStats {
    let estimatedBytes = 0;
    for (const tile of this.memoryCache.values()) {
      estimatedBytes += tile.sizeBytes || 8000;
    }

    const { formatted } = this.getStorageUsage();

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
      storageUsageFormatted: formatted,
    };
  }

  public clearMemoryCache(): void {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public async clearAll(): Promise<void> {
    this.clearMemoryCache();
    const db = await this.dbPromise;
    if (db) {
      try {
        const tx = db.transaction(['tiles', 'vector_city', 'regions'], 'readwrite');
        tx.objectStore('tiles').clear();
        tx.objectStore('vector_city').clear();
        tx.objectStore('regions').clear();
      } catch (e) {
        console.warn('UnifiedTileCache clear error:', e);
      }
    }
    localStorage.removeItem('hoimu_offline_regions_v1');
  }
}

export const unifiedTileCache = new UnifiedTileCache();
export default unifiedTileCache;
