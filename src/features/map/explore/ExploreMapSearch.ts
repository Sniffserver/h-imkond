/**
 * Spatial & Keyword Multi-Token Search Engine for ExploreMap
 * Integrates off-main-thread Web Worker and PlaceSearchIndex ranking.
 */

import { MapPlace, Street, GeoPoint } from '../../../types';
import { PlaceSearchIndex, SearchHit } from '../places/placeSearchIndex';
import { searchWorkerClient, SearchMatch } from '../../search/searchWorkerClient';

export type { SearchMatch };

let localIndex: PlaceSearchIndex | null = null;
let lastPlacesRef: MapPlace[] | null = null;
let lastStreetsRef: Street[] | null = null;

export function getOrBuildLocalSearchIndex(places: MapPlace[], streets: Street[]): PlaceSearchIndex {
  if (!localIndex || places !== lastPlacesRef || streets !== lastStreetsRef) {
    localIndex = new PlaceSearchIndex(places, streets);
    lastPlacesRef = places;
    lastStreetsRef = streets;
    searchWorkerClient.initialize(places, streets);
  }
  return localIndex;
}

export function searchExploreMap(
  query: string,
  userLocation: GeoPoint,
  places: MapPlace[],
  streets: Street[]
): SearchMatch[] {
  const normQuery = query.trim();
  if (!normQuery) return [];

  const index = getOrBuildLocalSearchIndex(places, streets);
  const hits = index.search(normQuery, userLocation);

  return hits.slice(0, 6).map((h) => {
    let subtitle = '';
    if (h.type === 'place') {
      subtitle = `${h.address || h.category?.toUpperCase() || 'ASUKOHT'} • ${h.place?.sourceName || 'Keskus'}`;
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

export async function searchExploreMapAsync(
  query: string,
  userLocation: GeoPoint,
  places: MapPlace[],
  streets: Street[]
): Promise<SearchMatch[]> {
  getOrBuildLocalSearchIndex(places, streets);
  return searchWorkerClient.searchDebounced(query, userLocation, 6, 75);
}
