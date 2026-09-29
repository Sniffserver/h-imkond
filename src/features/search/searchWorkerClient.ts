/**
 * Client interface for the Search Web Worker with 60-100ms debounce
 * and zero-dependency in-memory fallback.
 */

import { PlaceSearchIndex, SearchHit } from '../map/places/placeSearchIndex';
import { MapPlace, Street, GeoPoint } from '../../types';

export interface SearchMatch {
  type: 'place' | 'street';
  id: string;
  title: string;
  subtitle: string;
  location: GeoPoint;
  distanceMeters: number;
  place?: MapPlace;
  street?: Street;
  category?: string;
  reason?: string;
}

class SearchWorkerClient {
  private worker: Worker | null = null;
  private isInitialized = false;
  private pendingCallbacks: Map<string, (hits: SearchHit[]) => void> = new Map();
  private debounceTimer: any = null;
  private fallbackIndex: PlaceSearchIndex | null = null;
  private cachedPlaces: MapPlace[] = [];
  private cachedStreets: Street[] = [];
  private requestIdCounter = 0;

  constructor() {
    this.initWorker();
  }

  public isReady(): boolean {
    return this.isInitialized || this.fallbackIndex !== null;
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./searchWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (event: MessageEvent) => {
          const { type, id, results } = event.data || {};
          if (type === 'SEARCH_RESULT' && id && this.pendingCallbacks.has(id)) {
            const cb = this.pendingCallbacks.get(id)!;
            this.pendingCallbacks.delete(id);
            cb(results || []);
          }
        };

        this.worker.onerror = (err) => {
          console.warn('[SearchWorkerClient] Web Worker error, falling back to local thread:', err);
          this.worker = null;
        };
      } catch (e) {
        console.warn('[SearchWorkerClient] Unable to instantiate Web Worker, using synchronous fallback:', e);
        this.worker = null;
      }
    }
  }

  public initialize(places: MapPlace[], streets: Street[]): void {
    this.cachedPlaces = places;
    this.cachedStreets = streets;
    this.fallbackIndex = new PlaceSearchIndex(places, streets);

    if (this.worker) {
      this.worker.postMessage({
        type: 'INIT',
        places,
        streets,
      });
      this.isInitialized = true;
    }
  }

  /**
   * Executes a debounced search (75ms, within 60-100ms window)
   * returning the top 6 results without scoring metrics exposed to the UI.
   */
  public searchDebounced(
    query: string,
    userLocation?: GeoPoint,
    limit: number = 6,
    delayMs: number = 75
  ): Promise<SearchMatch[]> {
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.executeSearch(query, userLocation, limit).then(resolve);
      }, delayMs);
    });
  }

  public async executeSearch(
    query: string,
    userLocation?: GeoPoint,
    limit: number = 6
  ): Promise<SearchMatch[]> {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      return [];
    }

    if (!this.fallbackIndex && (this.cachedPlaces.length > 0 || this.cachedStreets.length > 0)) {
      this.fallbackIndex = new PlaceSearchIndex(this.cachedPlaces, this.cachedStreets);
    }

    if (this.worker) {
      const id = `srch_${++this.requestIdCounter}_${Date.now()}`;
      const hitsPromise = new Promise<SearchHit[]>((resolve) => {
        // Clear previous pending callbacks
        this.pendingCallbacks.clear();
        this.pendingCallbacks.set(id, resolve);

        this.worker!.postMessage({
          type: 'SEARCH',
          id,
          query: trimmed,
          userLocation,
          limit,
        });

        // Safety timeout fallback after 400ms
        setTimeout(() => {
          if (this.pendingCallbacks.has(id)) {
            this.pendingCallbacks.delete(id);
            if (this.fallbackIndex) {
              resolve(this.fallbackIndex.search(trimmed, userLocation).slice(0, limit));
            } else {
              resolve([]);
            }
          }
        }, 400);
      });

      const hits = await hitsPromise;
      return this.formatHits(hits);
    }

    // Synchronous fallback
    if (this.fallbackIndex) {
      const hits = this.fallbackIndex.search(trimmed, userLocation).slice(0, limit);
      return this.formatHits(hits);
    }

    return [];
  }

  private formatHits(hits: SearchHit[]): SearchMatch[] {
    return hits.map((h) => {
      let subtitle = '';
      if (h.type === 'place') {
        subtitle = `${h.address || h.category?.toUpperCase() || 'KOHT'} • ${h.place?.sourceName || 'Keskus'}`;
      } else {
        subtitle = `${h.street?.district || 'Tallinn'} • Tänav`;
      }

      return {
        type: h.type,
        id: h.id,
        title: h.name,
        subtitle,
        location: h.location,
        distanceMeters: h.distanceMeters || 0,
        place: h.place,
        street: h.street,
        category: h.category,
        reason: h.reason,
      };
    });
  }

  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
  }
}

export const searchWorkerClient = new SearchWorkerClient();
