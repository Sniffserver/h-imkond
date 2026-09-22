// Lightweight IndexedDB Cache for Offline Map Geometry and Custom Vector Tile Packages
import { CityMapData, MapTransform } from '../types';
import { unifiedTileCache } from '../features/map/UnifiedTileCache';

const DB_NAME = 'hoimu_map_cache_db';
const STORE_NAME = 'vector_map_tiles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a CityMapData vector tile bundle in UnifiedTileCache & IndexedDB
 */
export async function cacheCityMapData(cityMap: CityMapData): Promise<void> {
  try {
    await unifiedTileCache.cacheCityMapData(cityMap);
  } catch (err) {
    console.warn('[MapTileCache] UnifiedTileCache error:', err);
  }
}

/**
 * Retrieve cached CityMapData vector geometry from UnifiedTileCache & IndexedDB
 */
export async function getCachedCityMapData(cityId: string): Promise<CityMapData | null> {
  try {
    const cached = await unifiedTileCache.getCachedCityMapData(cityId);
    if (cached) return cached;

    // Fallback check on legacy DB
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(cityId);

      request.onsuccess = () => {
        const res = (request.result as CityMapData) || null;
        if (res) {
          // Promote to unified cache
          unifiedTileCache.cacheCityMapData(res).catch(() => {});
        }
        resolve(res);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[MapTileCache] Read error:', err);
    return null;
  }
}

/**
 * Cache custom user bioregional perimeter boundary markers in IndexedDB
 */
export interface CustomPerimeterZone {
  id: string;
  name: string;
  color: string;
  points: [number, number][]; // [worldX, worldY]
  createdAt: number;
}

export async function saveCustomPerimeter(zone: CustomPerimeterZone): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: `perimeter_${zone.id}`,
        type: 'perimeter',
        data: zone,
        cachedAt: Date.now(),
      };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[MapTileCache] Save perimeter error:', err);
  }
}

export async function getCustomPerimeters(): Promise<CustomPerimeterZone[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const perimeters = results
          .filter((r) => r.type === 'perimeter')
          .map((r) => r.data as CustomPerimeterZone);
        resolve(perimeters);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[MapTileCache] Get perimeters error:', err);
    return [];
  }
}

/**
 * Geometric helper to calculate polygon area in square kilometers and hectares.
 * Map world coordinates are scaled so that 100 units = 1.0 km (1 unit = 10 meters).
 */
export function calculatePolygonArea(points: [number, number][]): {
  km2: number;
  hectares: number;
} {
  if (points.length < 3) return { km2: 0, hectares: 0 };
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  // 1 unit = 0.01 km. Area factor = 0.01 * 0.01 = 0.0001 km^2
  const km2 = (Math.abs(sum) / 2) * 0.0001;
  const hectares = km2 * 100;
  return { km2, hectares };
}

/**
 * Geometric helper to calculate perimeter boundary circumference in kilometers.
 */
export function calculatePerimeterLength(
  points: [number, number][],
  isClosed = false
): number {
  if (points.length < 2) return 0;
  let dist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    dist += Math.hypot(dx, dy);
  }
  if (isClosed && points.length >= 3) {
    const dx = points[0][0] - points[points.length - 1][0];
    const dy = points[0][1] - points[points.length - 1][1];
    dist += Math.hypot(dx, dy);
  }
  return dist * 0.01; // 100 units = 1 km
}

/**
 * Check if a 2D point [x, y] is inside a polygon using ray-casting.
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  if (vs.length < 3) return false;
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Encodes perimeter data into a shareable offline token string (e.g. for Meshtastic radio or QR code)
 */
export function encodePerimeterToken(name: string, points: [number, number][]): string {
  const payload = {
    v: 1,
    n: name || 'Bioregional Zone',
    pts: points,
    t: Date.now(),
  };
  try {
    return 'HOIMU:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return 'HOIMU:' + btoa(JSON.stringify(payload));
  }
}

/**
 * Decodes a shareable perimeter token back into name and coordinates
 */
export function decodePerimeterToken(token: string): { name: string; points: [number, number][] } | null {
  try {
    const cleanToken = token.trim();
    const b64 = cleanToken.startsWith('HOIMU:') ? cleanToken.slice(6) : cleanToken;
    let jsonStr: string;
    try {
      jsonStr = decodeURIComponent(escape(atob(b64)));
    } catch {
      jsonStr = atob(b64);
    }
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.pts)) {
      return {
        name: parsed.n || 'Imported Zone',
        points: parsed.pts,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculates new map transform for focal-point zooming.
 * Keeps the geographic/world coordinate under focalScreenX, focalScreenY invariant while scaling.
 * Supports concurrent scale, rotation, and center displacement during pinch-zoom.
 */
export function calculateFocalPointZoom(
  currentTransform: MapTransform,
  focalScreenX: number,
  focalScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
  newScale: number,
  newRotation: number = currentTransform.rotation,
  newFocalScreenX: number = focalScreenX,
  newFocalScreenY: number = focalScreenY
): MapTransform {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // 1. Calculate the invariant world coordinate under initial focal point
  const dx = focalScreenX - (cx + currentTransform.offsetX);
  const dy = focalScreenY - (cy + currentTransform.offsetY);

  const unscaledX = dx / currentTransform.scale;
  const unscaledY = dy / currentTransform.scale;

  const cosRot = Math.cos(-currentTransform.rotation);
  const sinRot = Math.sin(-currentTransform.rotation);

  const worldX = unscaledX * cosRot - unscaledY * sinRot;
  const worldY = unscaledX * sinRot + unscaledY * cosRot;

  // 2. Project world coordinate back to the new focal point under new scale and rotation
  const cosNewRot = Math.cos(newRotation);
  const sinNewRot = Math.sin(newRotation);

  const rotWorldX = (worldX * cosNewRot - worldY * sinNewRot) * newScale;
  const rotWorldY = (worldX * sinNewRot + worldY * cosNewRot) * newScale;

  const newOffsetX = newFocalScreenX - cx - rotWorldX;
  const newOffsetY = newFocalScreenY - cy - rotWorldY;

  return {
    scale: newScale,
    rotation: newRotation,
    offsetX: newOffsetX,
    offsetY: newOffsetY,
  };
}

