/**
 * Dedicated Nearby Discovery Engine
 * Aggregates places within a radius around user location and computes category summaries for fast 1-tap filtering.
 */

import { MapPlace, GeoPoint, PlaceMainCategory } from '../../../types';
import { TALLINN_MAP_PLACES } from './placeData';
import { haversineDistanceMeters } from '../../../geo/projection';

export interface NearbyCategorySummary {
  category: PlaceMainCategory;
  label: string;
  iconName: string;
  count: number;
  color: string;
  places: MapPlace[];
}

export interface NearbyPlacesReport {
  userLocation: GeoPoint;
  radiusMeters: number;
  totalPlacesCount: number;
  summaries: NearbyCategorySummary[];
  allNearbyPlaces: MapPlace[];
}

export function calculateNearbyReport(
  userLocation: GeoPoint = { lat: 59.4370, lng: 24.7535 },
  radiusMeters: number = 3000,
  placesPool: MapPlace[] = TALLINN_MAP_PLACES
): NearbyPlacesReport {
  const uLat = userLocation.lat ?? userLocation.latitude ?? 59.4370;
  const uLng = userLocation.lng ?? userLocation.longitude ?? 24.7535;

  const placesWithDistance: MapPlace[] = placesPool
    .map((place) => {
      const pLat = place.location.lat ?? place.location.latitude ?? 0;
      const pLng = place.location.lng ?? place.location.longitude ?? 0;
      const dist = Math.round(haversineDistanceMeters(uLat, uLng, pLat, pLng));
      return {
        ...place,
        distanceMeters: dist,
      };
    })
    .filter((p) => (p.distanceMeters || 0) <= radiusMeters)
    .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

  // Category Buckets
  const categoryConfig: Array<{
    category: PlaceMainCategory;
    label: string;
    iconName: string;
    color: string;
  }> = [
    { category: 'tools', label: 'Tools & Hardware', iconName: 'Wrench', color: '#E9C46A' },
    { category: 'stores', label: 'Stores & Markets', iconName: 'Store', color: '#2A9D8F' },
    { category: 'safety', label: 'Safety & Shelters', iconName: 'ShieldAlert', color: '#E76F51' },
    { category: 'finds', label: 'Finds & Reuse', iconName: 'Sparkles', color: '#588157' },
    { category: 'water', label: 'Water Points', iconName: 'Droplets', color: '#457B9D' },
    { category: 'nature', label: 'Parks & Greenery', iconName: 'Trees', color: '#87A878' },
    { category: 'energy', label: 'Energy & Power', iconName: 'Zap', color: '#F4A261' },
  ];

  const summaries: NearbyCategorySummary[] = categoryConfig
    .map((cfg) => {
      const matching = placesWithDistance.filter((p) => p.mainCategory === cfg.category);
      return {
        category: cfg.category,
        label: cfg.label,
        iconName: cfg.iconName,
        color: cfg.color,
        count: matching.length,
        places: matching,
      };
    })
    .filter((s) => s.count > 0);

  return {
    userLocation: { lat: uLat, lng: uLng },
    radiusMeters,
    totalPlacesCount: placesWithDistance.length,
    summaries,
    allNearbyPlaces: placesWithDistance,
  };
}
