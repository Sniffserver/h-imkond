/**
 * Deterministic Natural Language & Index-Powered Search for Tallinn Places & Streets
 */

import { MapPlace, GeoPoint, Street } from '../../../types';
import { TALLINN_MAP_PLACES } from './placeData';
import { getTallinnStreets } from '../streets/streetData';
import { PlaceSearchIndex, SearchHit } from './placeSearchIndex';

let cachedIndex: PlaceSearchIndex | null = null;

function getSearchIndex(): PlaceSearchIndex {
  if (!cachedIndex) {
    const streets = getTallinnStreets();
    cachedIndex = new PlaceSearchIndex(TALLINN_MAP_PLACES, streets);
  }
  return cachedIndex;
}

export function rebuildSearchIndex(places: MapPlace[], streets: Street[]): PlaceSearchIndex {
  cachedIndex = new PlaceSearchIndex(places, streets);
  return cachedIndex;
}

export { PlaceSearchIndex };
export type { SearchHit };

/**
 * Searches places & streets using deterministic index matching with ranking.
 */
export function searchPlaces(
  query: string,
  userLocation?: GeoPoint,
  radiusMeters?: number,
  allPlaces: MapPlace[] = TALLINN_MAP_PLACES
): (MapPlace & { distanceMeters?: number; _score?: number })[] {
  if (!query || !query.trim()) {
    return [];
  }

  const index = getSearchIndex();
  const hits = index.search(query, userLocation, radiusMeters);

  // Return place objects formatted for MapPlace consumers
  return hits
    .filter((h) => h.type === 'place' && h.place)
    .map((h) => ({
      ...h.place!,
      distanceMeters: h.distanceMeters,
      _score: h._rank,
    }));
}

export function searchAll(
  query: string,
  userLocation?: GeoPoint,
  radiusMeters?: number
): SearchHit[] {
  if (!query || !query.trim()) {
    return [];
  }
  return getSearchIndex().search(query, userLocation, radiusMeters);
}

export interface NormalizedSearchTerms {
  rawQuery: string;
  categories: string[];
  subCategories: string[];
  tags: string[];
  matchedCategories: string[];
  matchedSubCategories: string[];
  matchedTags: string[];
}

export function normalizeSearchQuery(query: string): NormalizedSearchTerms {
  const q = query.trim().toLowerCase();
  const matchedCategories = new Set<string>();
  const matchedSubCategories = new Set<string>();
  const matchedTags = new Set<string>();

  if (q.includes('riista') || q.includes('tööriist') || q.includes('hardware') || q.includes('ehitus')) {
    matchedCategories.add('tools');
    matchedSubCategories.add('hardware');
    matchedSubCategories.add('diy');
    matchedTags.add('tools');
  }
  if (q.includes('apteek') || q.includes('pharmacy') || q.includes('haigla') || q.includes('politsei') || q.includes('varjend')) {
    matchedCategories.add('safety');
    if (q.includes('apteek')) matchedSubCategories.add('pharmacy');
    if (q.includes('haigla')) matchedSubCategories.add('hospital');
    if (q.includes('politsei')) matchedSubCategories.add('police');
    if (q.includes('varjend')) matchedSubCategories.add('shelter');
  }
  if (q.includes('tasuta') || q.includes('uuskasutus') || q.includes('reuse') || q.includes('kaltsukas')) {
    matchedCategories.add('finds');
    matchedSubCategories.add('reuse');
    matchedSubCategories.add('second_hand');
  }
  if (q.includes('vesi') || q.includes('allikas') || q.includes('kraan')) {
    matchedCategories.add('water');
    matchedSubCategories.add('spring');
    matchedSubCategories.add('tap');
  }

  const cats = Array.from(matchedCategories);
  const subCats = Array.from(matchedSubCategories);
  const tags = Array.from(matchedTags);

  return {
    rawQuery: q,
    categories: cats,
    subCategories: subCats,
    tags,
    matchedCategories: cats,
    matchedSubCategories: subCats,
    matchedTags: tags,
  };
}

export const normalizeQuery = normalizeSearchQuery;

export const searchTallinnPlaces = searchPlaces;

