/**
 * MapUpdateScheduler: Batched GeoJSON Source Update Pipeline for MapLibre GL
 * 
 * Prevents multiple independent setData() calls from dropping frames when high-frequency
 * peer broadcasts, GNSS telemetry, radio observations, and mesh topology events arrive.
 * 
 * Architecture:
 * - Queues source updates in a dirty map: `sourceId -> GeoJSONData`
 * - Schedules a single `requestAnimationFrame` pass
 * - Flushes all pending source changes in a single unified frame
 */

import type * as maplibregl from 'maplibre-gl';

export class MapUpdateScheduler {
  private map: maplibregl.Map | null = null;
  private pendingUpdates: Map<string, GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry> = new Map();
  private rafId: number | null = null;
  private isDestroyed = false;

  constructor(map?: maplibregl.Map | null) {
    if (map) {
      this.setMap(map);
    }
  }

  public setMap(map: maplibregl.Map | null): void {
    this.map = map;
    if (this.map && this.pendingUpdates.size > 0 && !this.rafId) {
      this.scheduleFlush();
    }
  }

  /**
   * Enqueues a GeoJSON update for the specified MapLibre source.
   * If an update for the same source is already queued for this frame, it is overwritten with the latest state.
   */
  public queueUpdate(
    sourceId: string,
    data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry
  ): void {
    if (this.isDestroyed) return;

    this.pendingUpdates.set(sourceId, data);
    this.scheduleFlush();
  }

  /**
   * Immediately flushes all pending updates to MapLibre sources synchronously.
   */
  public flush(): void {
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }

    if (!this.map || this.isDestroyed || this.pendingUpdates.size === 0) {
      return;
    }

    const updatesToProcess = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    updatesToProcess.forEach((data, sourceId) => {
      try {
        const source = this.map?.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (source && typeof source.setData === 'function') {
          source.setData(data as any);
        }
      } catch (err) {
        // Silently bypass if source not yet registered or style is reloading
        console.warn(`[MapUpdateScheduler] Error updating source "${sourceId}":`, err);
      }
    });
  }

  private scheduleFlush(): void {
    if (this.rafId !== null || this.isDestroyed) return;

    if (typeof requestAnimationFrame === 'function') {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flush();
      });
    } else {
      // Fallback for non-browser / test environments
      this.rafId = setTimeout(() => {
        this.rafId = null;
        this.flush();
      }, 0) as any;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
    this.pendingUpdates.clear();
    this.map = null;
  }
}
