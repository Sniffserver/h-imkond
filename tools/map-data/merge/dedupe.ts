/**
 * Ingestion Pipeline: Deduplication Engine
 * Uses spatial proximity (Haversine metric distance) and fuzzy lexical heuristics
 * to correlate authoritative state/city registry entries with community OpenStreetMap candidates.
 */

import { haversineDistanceMeters } from '../../../src/geo/projection';
import { NormalizedRecord, DedupeMatch } from '../types';

export function calculateNameSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));

  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }

  const total = Math.max(wordsA.size, wordsB.size);
  return total > 0 ? common / total : 0;
}

export function areCategoriesCompatible(a: NormalizedRecord, b: NormalizedRecord): boolean {
  if (a.mainCategory === b.mainCategory) return true;
  if (a.subCategory === b.subCategory) return true;
  if (a.subCategory === 'police' && (b.tags?.amenity === 'police' || b.subCategory === 'police')) return true;
  if (a.subCategory === 'shelter' && (b.tags?.amenity === 'shelter' || b.subCategory === 'shelter')) return true;
  if (a.subCategory === 'hospital' && (b.tags?.amenity === 'hospital' || b.subCategory === 'hospital')) return true;
  if (a.subCategory === 'tap' && (b.tags?.amenity === 'drinking_water' || b.subCategory === 'tap')) return true;
  return false;
}

export interface DedupeResult {
  matchedPairs: DedupeMatch[];
  unmatchedAuthoritative: NormalizedRecord[];
  unmatchedOsm: NormalizedRecord[];
}

/**
 * Finds spatial-semantic matches between authoritative records and OSM candidate records.
 * Default max radius: 65 meters.
 */
export function deduplicateRecords(
  authoritative: NormalizedRecord[],
  osmRecords: NormalizedRecord[],
  maxDistanceMeters = 65
): DedupeResult {
  const matchedPairs: DedupeMatch[] = [];
  const matchedOsmIds = new Set<string>();
  const unmatchedAuth: NormalizedRecord[] = [];

  for (const auth of authoritative) {
    let bestMatch: NormalizedRecord | null = null;
    let minDistance = Infinity;
    let bestSimilarity = 0;

    for (const osm of osmRecords) {
      if (matchedOsmIds.has(osm.id)) continue;
      if (!areCategoriesCompatible(auth, osm)) continue;

      const dist = haversineDistanceMeters(auth.lat, auth.lng, osm.lat, osm.lng);
      if (dist <= maxDistanceMeters) {
        const sim = calculateNameSimilarity(auth.name, osm.name);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = osm;
          bestSimilarity = sim;
        }
      }
    }

    if (bestMatch) {
      matchedOsmIds.add(bestMatch.id);
      matchedPairs.push({
        primary: auth,
        secondary: bestMatch,
        distanceMeters: Math.round(minDistance),
        nameSimilarity: bestSimilarity,
      });
    } else {
      unmatchedAuth.push(auth);
    }
  }

  const unmatchedOsm = osmRecords.filter((o) => !matchedOsmIds.has(o.id));

  return {
    matchedPairs,
    unmatchedAuthoritative: unmatchedAuth,
    unmatchedOsm,
  };
}
