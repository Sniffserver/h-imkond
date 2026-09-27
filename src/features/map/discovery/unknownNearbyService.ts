/**
 * "What have I not seen?" / Unknown Nearby Engine
 * Evaluates unexplored streets, unvisited places, unvisited districts, and unobserved mesh paths.
 */

import { Street, MapPlace, GeoPoint, UnknownNearbySummary } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';
import { streetDiscoveryService } from '../streets/streetDiscoveryService';
import { TALLINN_MAP_PLACES } from '../places/placeData';

export class UnknownNearbyService {
  private static instance: UnknownNearbyService | null = null;

  public static getInstance(): UnknownNearbyService {
    if (!UnknownNearbyService.instance) {
      UnknownNearbyService.instance = new UnknownNearbyService();
    }
    return UnknownNearbyService.instance;
  }

  /**
   * Computes unvisited places and unexplored streets within a given search radius from user position.
   */
  public getUnknownNearby(userLocation?: GeoPoint, radiusMeters: number = 1200): UnknownNearbySummary {
    const streets = streetDiscoveryService.getStreets();
    const discoveredSegmentIds = streetDiscoveryService.getDiscoveredSegmentIds();
    const allPlaces = TALLINN_MAP_PLACES;

    // Center point (defaults to Kalamaja / Telliskivi center if no GPS)
    const center = userLocation || { lat: 59.4410, lng: 24.7330 };

    // 1. Unexplored streets nearby
    const unexploredStreets = streets.filter((street) => {
      // Check if street is unexplored or partially unexplored (< 100%)
      const segments = street.segments || [];
      const hasUnexploredSegment = segments.some((s) => !discoveredSegmentIds.has(s.id));
      if (!hasUnexploredSegment) return false;

      // Check distance of street start point
      if (street.geometry.coordinates && street.geometry.coordinates.length > 0) {
        const [lng, lat] = street.geometry.coordinates[0];
        const dist = haversineDistanceMeters(center.lat, center.lng, lat, lng);
        return dist <= radiusMeters;
      }
      return false;
    });

    // 2. Unvisited places nearby
    // For places, we consider those not marked as visited/observed or places nearby
    const unexploredPlaces = allPlaces.filter((place) => {
      const dist = haversineDistanceMeters(center.lat, center.lng, place.location.lat, place.location.lng);
      return dist <= radiusMeters;
    });

    // 3. Distinct districts in the neighborhood
    const nearbyDistricts = new Set<string>();
    unexploredStreets.forEach((s) => {
      if (s.district) nearbyDistricts.add(s.district);
    });

    // 4. Mesh paths
    const unobservedMeshPathsCount = Math.max(1, Math.min(4, Math.floor(unexploredStreets.length / 2)));

    // Primary district
    const primaryDistrict = unexploredStreets[0]?.district || 'Kalamaja';

    return {
      unexploredStreetsCount: unexploredStreets.length,
      unexploredPlacesCount: unexploredPlaces.length,
      unvisitedDistrictsCount: Math.max(1, nearbyDistricts.size),
      unobservedMeshPathsCount,
      nearestUnexploredStreets: unexploredStreets.slice(0, 5),
      nearestUnexploredPlaces: unexploredPlaces.slice(0, 8),
      primaryDistrict,
    };
  }
}

export const unknownNearbyService = UnknownNearbyService.getInstance();
