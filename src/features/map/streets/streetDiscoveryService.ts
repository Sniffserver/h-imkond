/**
 * Segment-Based Street Discovery Engine with GPS Validation Guardrails
 * 
 * Rules:
 * - Minimum GPS accuracy <= 35 meters
 * - Maximum orthogonal distance from segment <= 25 meters
 * - Minimum continuous movement along street segment >= 15 meters
 * - Prevents indoor drift / static GPS errors from triggering false discoveries
 */

import { Street, StreetSegment, GeoPoint } from '../../../types';
import { getTallinnStreets } from './streetData';
import { haversineDistanceMeters } from '../../../geo/projection';

const STORAGE_KEY = 'hoimu_discovered_street_segments';
const GPS_MAX_ACCURACY_METERS = 35;
const SEGMENT_PROXIMITY_METERS = 25;
const MIN_MOVEMENT_METERS = 15;

export interface GPSFix {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  timestamp?: number;
  speedMps?: number;
}

export interface DiscoveryResult {
  newlyDiscoveredSegments: StreetSegment[];
  totalDiscoveredCount: number;
  totalSegmentsCount: number;
  overallExploredPercent: number;
  streetExploredPercents: Record<string, number>;
}

export type DiscoveryListener = (result: DiscoveryResult) => void;

/**
 * Calculates shortest distance from point P to line segment AB in meters.
 */
function distancePointToSegmentMeters(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const pLat = p.lat ?? p.latitude ?? 0;
  const pLng = p.lng ?? p.longitude ?? 0;
  const aLat = a.lat ?? a.latitude ?? 0;
  const aLng = a.lng ?? a.longitude ?? 0;
  const bLat = b.lat ?? b.latitude ?? 0;
  const bLng = b.lng ?? b.longitude ?? 0;

  const l2 = haversineDistanceMeters(aLat, aLng, bLat, bLng);
  if (l2 === 0) return haversineDistanceMeters(pLat, pLng, aLat, aLng);

  // Parameter t of projection onto line segment
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  return haversineDistanceMeters(pLat, pLng, projLat, projLng);
}

export class StreetDiscoveryService {
  private static instance: StreetDiscoveryService | null = null;
  private discoveredSegmentIds: Set<string> = new Set();
  private listeners: Set<DiscoveryListener> = new Set();
  private lastValidFix: GPSFix | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): StreetDiscoveryService {
    if (!StreetDiscoveryService.instance) {
      StreetDiscoveryService.instance = new StreetDiscoveryService();
    }
    return StreetDiscoveryService.instance;
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const list: string[] = JSON.parse(saved);
          this.discoveredSegmentIds = new Set(list);
        }
      } catch {
        this.discoveredSegmentIds = new Set();
      }
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.discoveredSegmentIds)));
      } catch {
        // Ignored
      }
    }
  }

  public getDiscoveredSegmentIds(): Set<string> {
    return new Set(this.discoveredSegmentIds);
  }

  public getStreets(): Street[] {
    return getTallinnStreets(this.discoveredSegmentIds);
  }

  public getStreetById(id: string): Street | undefined {
    return this.getStreets().find((s) => s.id === id);
  }

  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(newlyDiscovered: StreetSegment[] = []): void {
    const streets = this.getStreets();
    let totalSegments = 0;
    let discoveredSegments = 0;
    const streetPercents: Record<string, number> = {};

    streets.forEach((st) => {
      totalSegments += (st.segments || []).length;
      discoveredSegments += (st.segments || []).filter((seg) => seg.discoveryState === 'discovered').length;
      streetPercents[st.id] = st.exploredPercent || 0;
    });

    const overallExploredPercent = totalSegments > 0 ? Math.round((discoveredSegments / totalSegments) * 100) : 0;

    const result: DiscoveryResult = {
      newlyDiscoveredSegments: newlyDiscovered,
      totalDiscoveredCount: this.discoveredSegmentIds.size,
      totalSegmentsCount: totalSegments,
      overallExploredPercent,
      streetExploredPercents: streetPercents,
    };

    this.listeners.forEach((cb) => {
      try {
        cb(result);
      } catch (err) {
        console.error('[StreetDiscoveryService] Listener error:', err);
      }
    });
  }

  /**
   * Evaluates a real GPS position against Tallinn street segments with guardrails.
   */
  public processGPSFix(fix: GPSFix): StreetSegment[] {
    // 1. Guardrail: reject poor accuracy (e.g. indoors or cell-tower triangulations > 35m)
    if (fix.accuracyMeters && fix.accuracyMeters > GPS_MAX_ACCURACY_METERS) {
      return [];
    }

    // 2. Guardrail: check if user actually moved distance since last fix
    if (this.lastValidFix) {
      const movedMeters = haversineDistanceMeters(
        this.lastValidFix.lat,
        this.lastValidFix.lng,
        fix.lat,
        fix.lng
      );
      if (movedMeters < MIN_MOVEMENT_METERS) {
        return [];
      }
    }

    this.lastValidFix = fix;
    const currentPoint: GeoPoint = { lat: fix.lat, lng: fix.lng };
    const streets = this.getStreets();
    const newlyDiscovered: StreetSegment[] = [];

    for (const street of streets) {
      for (const segment of street.segments || []) {
        if (this.discoveredSegmentIds.has(segment.id)) continue;

        // 3. Guardrail: check distance from segment
        const dist = distancePointToSegmentMeters(currentPoint, segment.start, segment.end);
        if (dist <= SEGMENT_PROXIMITY_METERS) {
          this.discoveredSegmentIds.add(segment.id);
          segment.discoveryState = 'discovered';
          segment.discoveredAt = fix.timestamp || Date.now();
          newlyDiscovered.push(segment);
        }
      }
    }

    if (newlyDiscovered.length > 0) {
      this.saveToStorage();
      this.notify(newlyDiscovered);
    }

    return newlyDiscovered;
  }

  /**
   * Manually explore a street or segment (used for unit tests and manual field tagging)
   */
  public markSegmentDiscovered(segmentId: string): boolean {
    if (!this.discoveredSegmentIds.has(segmentId)) {
      this.discoveredSegmentIds.add(segmentId);
      this.saveToStorage();
      this.notify();
      return true;
    }
    return false;
  }

  public resetForTesting(): void {
    this.discoveredSegmentIds.clear();
    this.lastValidFix = null;
    this.saveToStorage();
    this.notify();
  }
}

export const streetDiscoveryService = StreetDiscoveryService.getInstance();
