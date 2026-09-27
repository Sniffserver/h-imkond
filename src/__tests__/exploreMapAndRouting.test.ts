import { describe, it, expect } from 'vitest';
import { getNearestPointOnStreetGeometry, generateFieldWalkRoute } from '../features/map/streets/streetWalkGenerator';
import { planOfflineRoute } from '../utils/offlineRouter';
import { mapRepository } from '../features/map/data/repository';
import { convertPlacesToGeoJson } from '../features/map/explore/overlays/PlacesLayer';
import { MapPlace, Street } from '../types';

describe('Unified ExploreMap Architecture, POI Clustering & A* Routing', () => {
  describe('Requirement #19: Native POI Clustering GeoJSON Conversion', () => {
    it('converts MapPlace records to GeoJSON point feature collection ready for MapLibre clustering', () => {
      const places: MapPlace[] = [
        {
          id: 'place_police_1',
          name: 'Põhja Prefektuur',
          location: { lat: 59.4215, lng: 24.7330 },
          mainCategory: 'safety',
          subCategory: 'police',
          source: 'ppa',
          sourceName: 'PPA Official',
          provenanceStatus: 'official',
          address: 'Pärnu mnt 139',
        },
        {
          id: 'place_water_1',
          name: 'Glehni Allikas',
          location: { lat: 59.3875, lng: 24.6540 },
          mainCategory: 'water',
          subCategory: 'spring',
          source: 'tallinn',
          sourceName: 'Tallinn Geoportal',
          provenanceStatus: 'official',
          address: 'Lossi tee 13',
        },
      ];

      const geojson = convertPlacesToGeoJson(places);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(2);
      expect(geojson.features[0].geometry.coordinates).toEqual([24.7330, 59.4215]);
      expect(geojson.features[0].properties?.mainCategory).toBe('safety');
    });
  });

  describe('Requirement #20: Real Polyline Street Geometry Distance Calculation', () => {
    it('calculates orthogonal distance to nearest point on street polyline geometry rather than first vertex', () => {
      const longStreet: Street = {
        id: 'parnu_mnt',
        name: 'Pärnu maantee',
        district: 'Kesklinn',
        highwayClass: 'primary',
        walkable: true,
        bicycle: true,
        exploredPercent: 0,
        geometry: {
          coordinates: [
            [24.7430, 59.4360], // Start: Viru / Vabaduse väljak (800m+ away)
            [24.7330, 59.4215], // Middle: Pärnu mnt 139 (very close)
            [24.7180, 59.3950], // End: Nõmme
          ],
        },
      };

      // User location is right next to the middle coordinate (Pärnu mnt 139)
      const userLoc = { lat: 59.4216, lng: 24.7331 };

      const { nearestPoint, distanceMeters } = getNearestPointOnStreetGeometry(longStreet, userLoc);
      expect(distanceMeters).toBeLessThan(30); // Very close orthogonal distance
      expect(nearestPoint.lat).toBeCloseTo(59.4215, 3);
      expect(nearestPoint.lng).toBeCloseTo(24.7330, 3);
    });

    it('generates a field walk route using segment-nearest street geometry points', () => {
      const userLoc = { lat: 59.4370, lng: 24.7535 };
      const walkRoute = generateFieldWalkRoute(userLoc);

      expect(walkRoute.stops.length).toBeGreaterThanOrEqual(3);
      expect(walkRoute.totalDistanceKm).toBeGreaterThan(0);
      expect(walkRoute.unexploredStreets.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement #21: A* Graph Routing Engine', () => {
    it('calculates a valid WGS84 GeoJSON walking route between two points on the Tallinn street graph', () => {
      const vectorStreets = mapRepository.getAllStreets().map((s) => ({
        name: s.name,
        type: (s.highwayClass === 'primary' ? 'primary' : s.highwayClass === 'footway' || s.highwayClass === 'pedestrian' || s.highwayClass === 'trail' ? 'trail' : 'secondary') as 'primary' | 'secondary' | 'trail',
        width: 2,
        points: (s.geometry?.coordinates || []) as [number, number][],
      }));

      // Route from Viru väljak (59.4360, 24.7440) to Raua tänava päästekomando (59.4358, 24.7670)
      const route = planOfflineRoute(
        vectorStreets,
        { x: 24.7440, y: 59.4360 },
        { x: 24.7670, y: 59.4358 },
        { profile: 'walking' }
      );

      expect(route).toBeDefined();
      expect(route.path.length).toBeGreaterThanOrEqual(2);
      expect(route.totalDistanceMeters).toBeGreaterThan(100);
      expect(route.estimatedWalkMinutes).toBeGreaterThan(0);
      expect(route.steps.length).toBeGreaterThan(0);
    });
  });
});
