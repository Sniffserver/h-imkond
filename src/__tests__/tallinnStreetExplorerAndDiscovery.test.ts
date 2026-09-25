import { describe, it, expect, beforeEach } from 'vitest';
import { streetDiscoveryService } from '../features/map/streets/streetDiscoveryService';
import { generateFieldWalkRoute } from '../features/map/streets/streetWalkGenerator';
import { TALLINN_POIS } from '../features/map/streets/poiData';
import { getTallinnStreets } from '../features/map/streets/streetData';

describe('Tallinn Street Explorer, Discovery & Field Walk Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    streetDiscoveryService.resetForTesting();
  });

  describe('1. Canonical Geographic Model & Tallinn Streets', () => {
    it('loads Tallinn streets with segmented representations and real coordinates', () => {
      const streets = getTallinnStreets();
      expect(streets.length).toBeGreaterThanOrEqual(10);

      const narva = streets.find((s) => s.id === 'narva_mnt');
      expect(narva).toBeDefined();
      expect(narva?.name).toBe('Narva maantee');
      expect(narva?.geometry.coordinates.length).toBeGreaterThan(3);
      expect(narva?.segments?.length).toBeGreaterThan(2);
      expect(narva?.walkable).toBe(true);
      expect(narva?.exploredPercent).toBe(0);
    });

    it('loads authentic Tallinn POIs with GeoPoint location coordinates', () => {
      expect(TALLINN_POIS.length).toBeGreaterThanOrEqual(8);

      const hardware = TALLINN_POIS.find((p) => p.category === 'hardware' || p.category === 'tools');
      expect(hardware).toBeDefined();
      expect(hardware?.location.lat).toBeGreaterThan(59.0);
      expect(hardware?.location.lng).toBeGreaterThan(24.0);

      const shelter = TALLINN_POIS.find((p) => p.category === 'shelter');
      expect(shelter).toBeDefined();
      expect(shelter?.source).toBe('paasteamet');
    });
  });

  describe('2. Segment-Based Street Discovery with GPS Guardrails', () => {
    it('rejects inaccurate GPS fixes (> 35m) from falsely discovering street segments', () => {
      // Narva mnt coordinate ~ 59.4368, 24.7548
      const newlyDiscovered = streetDiscoveryService.processGPSFix({
        lat: 59.4368,
        lng: 24.7548,
        accuracyMeters: 80, // Poor accuracy (e.g. indoors cell triangulation)
        timestamp: Date.now(),
      });

      expect(newlyDiscovered.length).toBe(0);
      const narva = streetDiscoveryService.getStreetById('narva_mnt');
      expect(narva?.exploredPercent).toBe(0);
    });

    it('validates and discovers street segments when user has high-accuracy GPS on street', () => {
      // First fix along Narva mnt start
      const fix1 = streetDiscoveryService.processGPSFix({
        lat: 59.4368,
        lng: 24.7548,
        accuracyMeters: 8,
        timestamp: Date.now(),
      });
      expect(fix1.length).toBeGreaterThanOrEqual(1);

      // Second fix after moving 40m along the street
      const fix2 = streetDiscoveryService.processGPSFix({
        lat: 59.4372,
        lng: 24.7570,
        accuracyMeters: 6,
        timestamp: Date.now() + 5000,
      });

      const narva = streetDiscoveryService.getStreetById('narva_mnt');
      expect(narva?.exploredPercent).toBeGreaterThan(0);
    });

    it('persists discovered segments in localStorage across reboots', () => {
      streetDiscoveryService.markSegmentDiscovered('narva_mnt_seg_1');
      streetDiscoveryService.markSegmentDiscovered('narva_mnt_seg_2');

      const saved = localStorage.getItem('hoimu_discovered_street_segments');
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!)).toContain('narva_mnt_seg_1');
    });
  });

  describe('3. Tallinn Field Walk Loop & Street Hunt Generator', () => {
    it('generates a complete field exploration loop with stops and fieldcraft metrics', () => {
      const walk = generateFieldWalkRoute({ lat: 59.4370, lng: 24.7535 });

      expect(walk).toBeDefined();
      expect(walk.stops.length).toBeGreaterThanOrEqual(4);
      expect(walk.stops[0].type).toBe('start');
      expect(walk.stops[walk.stops.length - 1].type).toBe('home');
      expect(walk.totalDistanceKm).toBeGreaterThan(0.5);
      expect(walk.estimatedTimeMinutes).toBeGreaterThan(5);

      expect(walk.fieldcraftRewards.streetsToDiscover).toBeGreaterThanOrEqual(1);
      expect(walk.fieldcraftRewards.placesToFind).toBeGreaterThanOrEqual(1);
      expect(walk.fieldcraftRewards.distanceKm).toBeGreaterThan(0.5);
    });
  });

  describe('4. Universal MapPlace Architecture & Multilingual Search', () => {
    it('normalizes colloquial Estonian and English search terms into canonical categories', async () => {
      const { searchTallinnPlaces, normalizeQuery } = await import('../features/map/places/placeSearch');

      // Test normalization
      const normTools = normalizeQuery('riistapood');
      expect(normTools.categories).toContain('tools');
      expect(normTools.subCategories).toContain('hardware');

      const normPharmacy = normalizeQuery('apteek');
      expect(normPharmacy.categories).toContain('safety');
      expect(normPharmacy.subCategories).toContain('pharmacy');

      const normFinds = normalizeQuery('tasuta');
      expect(normFinds.categories).toContain('finds');

      // Test live search results
      const resultsRiistad = searchTallinnPlaces('riistapood');
      expect(resultsRiistad.length).toBeGreaterThan(0);
      expect(resultsRiistad.some((p) => p.mainCategory === 'tools')).toBe(true);

      const resultsApteek = searchTallinnPlaces('apteek');
      expect(resultsApteek.length).toBeGreaterThan(0);
      expect(resultsApteek.some((p) => p.subCategory === 'pharmacy')).toBe(true);
    });

    it('preserves provenance metadata and authoritative source on official safety places', async () => {
      const { TALLINN_MAP_PLACES } = await import('../features/map/places/placeData');

      const shelter = TALLINN_MAP_PLACES.find((p) => p.subCategory === 'shelter');
      expect(shelter).toBeDefined();
      expect(shelter?.source).toBe('paasteamet');
      expect(shelter?.provenanceStatus).toBe('official');
      expect(shelter?.snapshotDate).toBeDefined();

      const toolPlace = TALLINN_MAP_PLACES.find((p) => p.mainCategory === 'tools');
      expect(toolPlace).toBeDefined();
      expect(['osm', 'community', 'verified']).toContain(toolPlace?.source);
    });
  });

  describe('5. Dedicated Nearby Discovery Engine', () => {
    it('aggregates nearby places within radius and provides 1-tap category summaries', async () => {
      const { calculateNearbyReport } = await import('../features/map/places/nearbyEngine');

      const report = calculateNearbyReport({ lat: 59.4370, lng: 24.7535 }, 5000);
      expect(report.totalPlacesCount).toBeGreaterThan(0);
      expect(report.summaries.length).toBeGreaterThan(0);

      const toolsSummary = report.summaries.find((s) => s.category === 'tools');
      expect(toolsSummary).toBeDefined();
      expect(toolsSummary!.count).toBeGreaterThan(0);
      expect(toolsSummary!.places.length).toBe(toolsSummary!.count);
    });
  });
});

