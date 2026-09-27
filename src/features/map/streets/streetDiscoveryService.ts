/**
 * Segment-Based Street Discovery Engine with Spatial Index & Observation Ledger
 * 
 * Rules:
 * - Spatial Index (Grid spatial hash) for O(1) candidate pruning within 50m
 * - Minimum GPS accuracy <= 35 meters
 * - Maximum orthogonal distance from segment <= 25 meters
 * - Minimum continuous movement along street segment >= 15 meters
 * - Trace evidence requirement: at least 2 consecutive valid GPS trace points near segment (P1 -> P2)
 * - Persists rich DiscoveryObservation (confirmation counts, timestamps, best GPS accuracy, confidence)
 * - Authentic physical exploration: No fake gamification (+XP). Real confirmation counts & walk history.
 */

import { Street, StreetSegment, GeoPoint, DiscoveryObservation } from '../../../types';
import { getTallinnStreets } from './streetData';
import { haversineDistanceMeters } from '../../../geo/projection';
import { SpatialSegmentIndex, IndexedSegment } from './SpatialSegmentIndex';

const STORAGE_KEY_OBSERVATIONS = 'hoimu_street_discovery_observations';
const STORAGE_KEY_LEGACY = 'hoimu_discovered_street_segments';
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
  streetConfidences: Record<string, 'low' | 'medium' | 'high'>;
}

export type DiscoveryListener = (result: DiscoveryResult) => void;

/**
 * Calculates shortest distance from point P to line segment AB in meters.
 */
function distancePointToSegmentMeters(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const pLat = p.lat;
  const pLng = p.lng;
  const aLat = a.lat;
  const aLng = a.lng;
  const bLat = b.lat;
  const bLng = b.lng;

  const l2 = haversineDistanceMeters(aLat, aLng, bLat, bLng);
  if (l2 === 0) return haversineDistanceMeters(pLat, pLng, aLat, aLng);

  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  return haversineDistanceMeters(pLat, pLng, projLat, projLng);
}

export class StreetDiscoveryService {
  private static instance: StreetDiscoveryService | null = null;
  private observations: Map<string, DiscoveryObservation> = new Map();
  private spatialIndex: SpatialSegmentIndex | null = null;
  private listeners: Set<DiscoveryListener> = new Set();
  private lastValidFix: GPSFix | null = null;
  private recentTrace: GPSFix[] = [];
  private static MAX_TRACE_POINTS = 5;

  private constructor() {
    this.loadFromStorage();
    this.initSpatialIndex();
  }

  public static getInstance(): StreetDiscoveryService {
    if (!StreetDiscoveryService.instance) {
      StreetDiscoveryService.instance = new StreetDiscoveryService();
    }
    return StreetDiscoveryService.instance;
  }

  private initSpatialIndex(): void {
    const streets = getTallinnStreets(this.getDiscoveredSegmentIds());
    this.spatialIndex = new SpatialSegmentIndex(streets);
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedObs = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        if (savedObs) {
          const list: DiscoveryObservation[] = JSON.parse(savedObs);
          list.forEach((obs) => this.observations.set(obs.segmentId, obs));
        } else {
          // Backward compatibility with legacy string array
          const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
          if (legacy) {
            const ids: string[] = JSON.parse(legacy);
            const now = Date.now();
            ids.forEach((id) => {
              this.observations.set(id, {
                segmentId: id,
                streetId: id.split('_seg_')[0] || id,
                firstDiscoveredAt: now,
                lastConfirmedAt: now,
                confirmationCount: 1,
                bestAccuracyMeters: 10,
                confidence: 'medium',
              });
            });
          }
        }
      } catch {
        this.observations.clear();
      }
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const list = Array.from(this.observations.values());
        localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(list));
        // Keep legacy key in sync for any external reader
        localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(Array.from(this.observations.keys())));
      } catch {
        // Ignored
      }
    }
  }

  public getDiscoveredSegmentIds(): Set<string> {
    return new Set(this.observations.keys());
  }

  public getObservation(segmentId: string): DiscoveryObservation | undefined {
    return this.observations.get(segmentId);
  }

  public getAllObservations(): DiscoveryObservation[] {
    return Array.from(this.observations.values());
  }

  public getStreets(): Street[] {
    return getTallinnStreets(this.getDiscoveredSegmentIds());
  }

  public getStreetById(id: string): Street | undefined {
    return this.getStreets().find((s) => s.id === id);
  }

  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStreetConfidence(streetId: string): 'low' | 'medium' | 'high' {
    const street = this.getStreetById(streetId);
    if (!street || !street.segments || street.segments.length === 0) return 'low';
    
    let totalConfirmed = 0;
    let highAccuracyCount = 0;

    for (const seg of street.segments) {
      const obs = this.observations.get(seg.id);
      if (obs) {
        totalConfirmed++;
        if (obs.bestAccuracyMeters <= 5 || obs.confirmationCount >= 3) {
          highAccuracyCount++;
        }
      }
    }

    if (totalConfirmed === 0) return 'low';
    if (highAccuracyCount >= Math.ceil(street.segments.length * 0.5)) return 'high';
    if (totalConfirmed >= Math.ceil(street.segments.length * 0.3)) return 'medium';
    return 'low';
  }

  private notify(newlyDiscovered: StreetSegment[] = []): void {
    const streets = this.getStreets();
    let totalSegments = 0;
    let discoveredSegments = 0;
    const streetPercents: Record<string, number> = {};
    const streetConfidences: Record<string, 'low' | 'medium' | 'high'> = {};

    streets.forEach((st) => {
      const segs = st.segments || [];
      totalSegments += segs.length;
      const discovered = segs.filter((seg) => this.observations.has(seg.id)).length;
      discoveredSegments += discovered;
      streetPercents[st.id] = st.exploredPercent || 0;
      streetConfidences[st.id] = this.getStreetConfidence(st.id);
    });

    const overallExploredPercent = totalSegments > 0 ? Math.round((discoveredSegments / totalSegments) * 100) : 0;

    const result: DiscoveryResult = {
      newlyDiscoveredSegments: newlyDiscovered,
      totalDiscoveredCount: this.observations.size,
      totalSegmentsCount: totalSegments,
      overallExploredPercent,
      streetExploredPercents: streetPercents,
      streetConfidences,
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
   * Evaluates a real GPS trace against Tallinn street segments using Spatial Index.
   */
  public processGPSFix(fix: GPSFix): StreetSegment[] {
    // 1. Guardrail: reject poor accuracy (> 35m)
    if (fix.accuracyMeters !== undefined && fix.accuracyMeters > GPS_MAX_ACCURACY_METERS) {
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

    // Append to trace buffer (P1 -> P2 -> P3)
    this.recentTrace.push(fix);
    if (this.recentTrace.length > StreetDiscoveryService.MAX_TRACE_POINTS) {
      this.recentTrace.shift();
    }

    // Require at least 2 trace points as real trace evidence before confirming segment
    if (this.recentTrace.length < 2) {
      return [];
    }

    if (!this.spatialIndex) {
      this.initSpatialIndex();
    }

    // Query candidate segments within 50m using spatial index
    const candidates: IndexedSegment[] = this.spatialIndex?.queryCandidates({ lat: fix.lat, lng: fix.lng }, 50) || [];
    const newlyDiscovered: StreetSegment[] = [];
    const now = fix.timestamp || Date.now();
    const fixAccuracy = fix.accuracyMeters || 10;

    for (const candidate of candidates) {
      const { segment, street } = candidate;

      // 3. Trace evidence check: verify that multiple points in the trace intersect segment proximity
      let intersectingPointsCount = 0;
      for (const pt of this.recentTrace) {
        const dist = distancePointToSegmentMeters({ lat: pt.lat, lng: pt.lng }, segment.start, segment.end);
        if (dist <= SEGMENT_PROXIMITY_METERS) {
          intersectingPointsCount++;
        }
      }

      // Require trace evidence (at least 2 points intersecting segment proximity)
      if (intersectingPointsCount >= 2) {
        const existing = this.observations.get(segment.id);
        if (!existing) {
          const confidence = fixAccuracy <= 5 ? 'high' : fixAccuracy <= 15 ? 'medium' : 'low';
          const newObs: DiscoveryObservation = {
            segmentId: segment.id,
            streetId: street.id,
            firstDiscoveredAt: now,
            lastConfirmedAt: now,
            confirmationCount: 1,
            bestAccuracyMeters: fixAccuracy,
            confidence,
          };
          this.observations.set(segment.id, newObs);
          segment.discoveryState = 'discovered';
          segment.discoveredAt = now;
          newlyDiscovered.push(segment);
        } else {
          // Re-confirm existing discovery
          existing.lastConfirmedAt = now;
          existing.confirmationCount += 1;
          existing.bestAccuracyMeters = Math.min(existing.bestAccuracyMeters, fixAccuracy);
          if (existing.bestAccuracyMeters <= 5 || existing.confirmationCount >= 3) {
            existing.confidence = 'high';
          } else if (existing.bestAccuracyMeters <= 15 || existing.confirmationCount >= 2) {
            existing.confidence = 'medium';
          }
        }
      }
    }

    if (newlyDiscovered.length > 0) {
      this.saveToStorage();
      this.notify(newlyDiscovered);
    }

    return newlyDiscovered;
  }

  public markSegmentDiscovered(segmentId: string): boolean {
    if (!this.observations.has(segmentId)) {
      const now = Date.now();
      const streetId = segmentId.split('_seg_')[0] || segmentId;
      this.observations.set(segmentId, {
        segmentId,
        streetId,
        firstDiscoveredAt: now,
        lastConfirmedAt: now,
        confirmationCount: 1,
        bestAccuracyMeters: 5,
        confidence: 'high',
      });
      this.saveToStorage();
      this.notify();
      return true;
    }
    return false;
  }

  public resetForTesting(): void {
    this.observations.clear();
    this.lastValidFix = null;
    this.recentTrace = [];
    this.saveToStorage();
    this.initSpatialIndex();
    this.notify();
  }
}

export const streetDiscoveryService = StreetDiscoveryService.getInstance();
