/**
 * Spatial & Keyword Search Engine for ExploreMap
 */

import { MapPlace, Street, GeoPoint } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';

export interface SearchMatch {
  type: 'place' | 'street';
  id: string;
  title: string;
  subtitle: string;
  location: GeoPoint;
  distanceMeters: number;
  place?: MapPlace;
  street?: Street;
}

export function searchExploreMap(
  query: string,
  userLocation: GeoPoint,
  places: MapPlace[],
  streets: Street[]
): SearchMatch[] {
  const normQuery = query.toLowerCase().trim();
  if (!normQuery) return [];

  const results: SearchMatch[] = [];

  // 1. Search MapPlaces
  for (const place of places) {
    const nameMatch = place.name.toLowerCase().includes(normQuery);
    const catMatch = place.mainCategory.toLowerCase().includes(normQuery) || place.subCategory.toLowerCase().includes(normQuery);
    const addrMatch = (place.address || '').toLowerCase().includes(normQuery);

    if (nameMatch || catMatch || addrMatch) {
      const dist = Math.round(haversineDistanceMeters(userLocation.lat, userLocation.lng, place.location.lat, place.location.lng));
      results.push({
        type: 'place',
        id: place.id,
        title: place.name,
        subtitle: `${place.address || place.mainCategory.toUpperCase()} • ${place.sourceName}`,
        location: place.location,
        distanceMeters: dist,
        place,
      });
    }
  }

  // 2. Search Streets
  for (const street of streets) {
    if (street.name.toLowerCase().includes(normQuery) || (street.district || '').toLowerCase().includes(normQuery)) {
      const firstCoord = street.geometry.coordinates[0];
      const loc: GeoPoint = { lat: firstCoord[1], lng: firstCoord[0] };
      const dist = Math.round(haversineDistanceMeters(userLocation.lat, userLocation.lng, loc.lat, loc.lng));

      results.push({
        type: 'street',
        id: street.id,
        title: street.name,
        subtitle: `${street.district || 'Tallinn'} • ${street.exploredPercent || 0}% uuritud`,
        location: loc,
        distanceMeters: dist,
        street,
      });
    }
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
