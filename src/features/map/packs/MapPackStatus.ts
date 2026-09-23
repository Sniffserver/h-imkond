/**
 * HÕIMU Map Pack Status Tracker
 * Tracks local caching, integrity verification, and storage allocation
 */

import { MapPackManifest, MAP_PACK_MANIFESTS } from './MapPackManifest';

export type MapPackInstallState = 'available' | 'downloading' | 'verifying' | 'installed' | 'error';

export interface MapPackStatusRecord {
  id: string;
  version: string;
  routingSnapshotVersion: string;
  state: MapPackInstallState;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  installedAt?: number;
  lastCheckedAt?: number;
  checksumVerified: boolean;
  storageType: 'indexeddb' | 'cache_storage' | 'embedded';
  error?: string;
}

const STORAGE_KEY = 'hoimu_map_packs_status_v1';

export class MapPackStatusService {
  private static instance: MapPackStatusService;
  private records: Map<string, MapPackStatusRecord> = new Map();
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): MapPackStatusService {
    if (!MapPackStatusService.instance) {
      MapPackStatusService.instance = new MapPackStatusService();
    }
    return MapPackStatusService.instance;
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this.records.set(item.id, item);
          }
        }
      }

      // Default baseline: Tallinn is marked as pre-bundled/installed
      if (!this.records.has('tallinn')) {
        const tallinnManifest = MAP_PACK_MANIFESTS.tallinn;
        this.records.set('tallinn', {
          id: 'tallinn',
          version: tallinnManifest.version,
          routingSnapshotVersion: tallinnManifest.routingSnapshotVersion,
          state: 'installed',
          progressPercent: 100,
          downloadedBytes: tallinnManifest.sizeBytes,
          totalBytes: tallinnManifest.sizeBytes,
          installedAt: Date.now() - 3600000,
          lastCheckedAt: Date.now(),
          checksumVerified: true,
          storageType: 'cache_storage',
        });
        this.saveToStorage();
      }
    } catch {
      // Fallback
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      const list = Array.from(this.records.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Ignore quota errors
    }
  }

  public getStatus(packId: string): MapPackStatusRecord {
    const manifest = MAP_PACK_MANIFESTS[packId] || MAP_PACK_MANIFESTS.tallinn;
    return (
      this.records.get(packId) || {
        id: packId,
        version: manifest.version,
        routingSnapshotVersion: manifest.routingSnapshotVersion,
        state: 'available',
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: manifest.sizeBytes,
        checksumVerified: false,
        storageType: 'indexeddb',
      }
    );
  }

  public updateStatus(packId: string, update: Partial<MapPackStatusRecord>): void {
    const current = this.getStatus(packId);
    const updated: MapPackStatusRecord = {
      ...current,
      ...update,
      lastCheckedAt: Date.now(),
    };
    this.records.set(packId, updated);
    this.saveToStorage();
    this.notifyListeners();
  }

  public removeStatus(packId: string): void {
    const manifest = MAP_PACK_MANIFESTS[packId];
    if (manifest) {
      this.records.set(packId, {
        id: packId,
        version: manifest.version,
        routingSnapshotVersion: manifest.routingSnapshotVersion,
        state: 'available',
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: manifest.sizeBytes,
        checksumVerified: false,
        storageType: 'indexeddb',
      });
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public getAllStatuses(): Record<string, MapPackStatusRecord> {
    const result: Record<string, MapPackStatusRecord> = {};
    for (const id of Object.keys(MAP_PACK_MANIFESTS)) {
      result[id] = this.getStatus(id);
    }
    return result;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
