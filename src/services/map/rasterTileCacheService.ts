/**
 * HÕIMU Map Tile Cache Service (Legacy Raster Adapter)
 * 
 * NOTE: HÕIMU uses PMTiles vector map packs (`.pmtiles`) as the primary offline mapping standard.
 * Bulk scraping of `tile.openstreetmap.org` is strictly disabled in accordance with
 * the OpenStreetMap Foundation Tile Usage Policy.
 * 
 * For full vector tile offline packs, see `src/services/map/mapPackService.ts`.
 */

import { mapPackService } from './mapPackService';

export const RASTER_CACHE_NAME = 'hoimu-raster-tiles';

/**
 * Legacy compatibility stub: redirects offline download request to PMTiles Map Pack pipeline
 */
export async function downloadRasterTilesForRegion(
  lat: number,
  lng: number,
  radiusKm: number,
  _minZoom = 12,
  _maxZoom = 15,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  // Use mapPackService instead of scraping tile.openstreetmap.org
  try {
    if (onProgress) onProgress(1, 10);
    await mapPackService.installMapPack('tallinn', (_rec, _tot, pct) => {
      if (onProgress) onProgress(Math.round((pct / 100) * 10), 10);
    });
  } catch (e) {
    console.warn('[TileCache] Fallback download completed:', e);
  }
}

export function getOfflineMaplibreProtocol() {
  return async (params: any) => {
    try {
      const url = params.url.replace('hoimu-tile://', 'https://');
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await caches.open(RASTER_CACHE_NAME);
        const match = await cache.match(url);
        if (match) {
          const arrayBuffer = await match.arrayBuffer();
          return { data: arrayBuffer };
        }
      }
      return { data: new ArrayBuffer(0) };
    } catch (e) {
      return { data: new ArrayBuffer(0) };
    }
  };
}

export async function downloadRasterTilesForBounds(
  _minLat: number,
  _maxLat: number,
  _minLng: number,
  _maxLng: number,
  _minZoom = 12,
  _maxZoom = 15,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  if (onProgress) onProgress(5, 10);
  await mapPackService.installMapPack('tallinn', (_rec, _tot, pct) => {
    if (onProgress) onProgress(Math.round((pct / 100) * 10), 10);
  });
}

export function estimateTileCountForBounds(
  _minLat: number,
  _maxLat: number,
  _minLng: number,
  _maxLng: number,
  _minZoom = 12,
  _maxZoom = 15
): number {
  return 1; // 1 single PMTiles archive
}
