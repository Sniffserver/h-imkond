import { describe, it, expect, beforeEach } from 'vitest';
import { streetDiscoveryService } from '../features/map/streets/streetDiscoveryService';
import { generateFieldWalkRoute } from '../features/map/streets/streetWalkGenerator';
import { mapRepository } from '../features/map/data/repository';
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
      const places = mapRepository.getAllPlaces();
      expect(places.length).toBeGreaterThanOrEqual(8);

      const hardware = places.find((p) => p.mainCategory === 'tools' || p.subCategory === 'hardware');
      expect(hardware).toBeDefined();
      expect(hardware?.location.lat).toBeGreaterThan(59.0);
      expect(hardware?.location.lng).toBeGreaterThan(24.0);

      const shelter = places.find((p) => p.mainCategory === 'safety' && p.subCategory === 'shelter');
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
      // First fix along Narva mnt start (establishes trace point 1)
      const fix1 = streetDiscoveryService.processGPSFix({
        lat: 59.4368,
        lng: 24.7548,
        accuracyMeters: 8,
        timestamp: Date.now(),
      });
      expect(fix1.length).toBe(0); // Need trace evidence (at least 2 points)

      // Second fix after moving 40m along the street (establishes trace point 2)
      const fix2 = streetDiscoveryService.processGPSFix({
        lat: 59.4372,
        lng: 24.7570,
        accuracyMeters: 6,
        timestamp: Date.now() + 5000,
      });

      expect(fix2.length).toBeGreaterThanOrEqual(1);
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
    it('generates a complete field exploration loop with stops, pedestrian graph path, Field Objectives and Field Report', () => {
      const walk = generateFieldWalkRoute({ lat: 59.4370, lng: 24.7535 });

      expect(walk).toBeDefined();
      expect(walk.stops.length).toBeGreaterThanOrEqual(4);
      expect(walk.stops[0].type).toBe('start');
      expect(walk.stops[walk.stops.length - 1].type).toBe('home');
      expect(walk.totalDistanceKm).toBeGreaterThan(0.5);
      expect(walk.estimatedTimeMinutes).toBeGreaterThan(5);

      // Verify pedestrian graph path polyline coordinates
      expect(walk.routePath).toBeDefined();
      expect(walk.routePath.length).toBeGreaterThanOrEqual(2);

      // Verify Field Objectives
      expect(walk.fieldObjectives).toBeDefined();
      expect(walk.fieldObjectives.discoverStreetSegments).toBeGreaterThanOrEqual(1);
      expect(walk.fieldObjectives.visitPlacesCount).toBeGreaterThanOrEqual(1);
      expect(walk.fieldObjectives.observeMeshSignal).toBe(true);

      // Verify Field Report (accurately reflects true counted observations, no fake values)
      expect(walk.fieldReport).toBeDefined();
      expect(walk.fieldReport?.streetsDiscoveredCount).toBeGreaterThanOrEqual(1);
      expect(walk.fieldReport?.radioObservationsCount).toBe(0);

      // Verify passing actual observations count or array (radioObservationsCount: actualObservations.length)
      const walkWithObservations = generateFieldWalkRoute({ lat: 59.4370, lng: 24.7535 }, undefined, 7);
      expect(walkWithObservations.fieldReport?.radioObservationsCount).toBe(7);

      const mockObs = [
        { id: 'obs-1', peerId: 'node-1', medium: 'lora' as const, rssi: -68, position: { lat: 59.438, lng: 24.754 }, timestamp: Date.now() },
        { id: 'obs-2', peerId: 'node-2', medium: 'ble' as const, rssi: -82, position: { lat: 59.439, lng: 24.755 }, timestamp: Date.now() },
      ];
      const walkWithObsArray = generateFieldWalkRoute({ lat: 59.4370, lng: 24.7535 }, undefined, mockObs);
      expect(walkWithObsArray.fieldReport?.radioObservationsCount).toBe(2);

      expect(walk.fieldcraftRewards.streetsToDiscover).toBeGreaterThanOrEqual(1);
      expect(walk.fieldcraftRewards.placesToFind).toBeGreaterThanOrEqual(1);
      expect(walk.fieldcraftRewards.distanceKm).toBeGreaterThan(0.5);
    });
  });

  describe('4. Universal MapPlace Architecture, Multi-Source Truth & Multilingual Search', () => {
    it('populates sources array on MapPlace for multi-source truth provenance', () => {
      const places = mapRepository.getAllPlaces();
      expect(places.length).toBeGreaterThan(0);
      const firstPlace = places[0];
      expect(firstPlace.sources).toBeDefined();
      expect(firstPlace.sources!.length).toBeGreaterThanOrEqual(1);
      expect(firstPlace.sources![0].provider).toBeDefined();
    });

    it('validates Signal Observation RSSI color mapping for signal geography', async () => {
      const { getRssiColor, convertTrailToGeoJson } = await import('../features/map/explore/overlays/SignalTrailLayer');

      expect(getRssiColor(-60)).toBe('#2A9D8F'); // Green (> -70)
      expect(getRssiColor(-80)).toBe('#E9C46A'); // Yellow (-70 to -85)
      expect(getRssiColor(-95)).toBe('#F4A261'); // Orange (-85 to -100)
      expect(getRssiColor(-105)).toBe('#E76F51'); // Red (< -100)

      const geojson = convertTrailToGeoJson([
        { timestamp: Date.now(), position: { lat: 59.437, lng: 24.753 }, peerId: 'node_1', rssi: -65, medium: 'lora' },
        { timestamp: Date.now(), position: { lat: 59.438, lng: 24.755 }, peerId: 'node_2', rssi: -90, medium: 'ble' },
      ]);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBeGreaterThanOrEqual(2);
    });
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
      expect(['osm', 'community', 'verified', 'tallinn']).toContain(toolPlace?.source);
    });

    it('validates generalized conflicts array when sources disagree', async () => {
      const { TALLINN_MAP_PLACES } = await import('../features/map/places/placeData');
      const conflictPlace = TALLINN_MAP_PLACES.find((p) => p.hasMismatch || (p.conflicts && p.conflicts.length > 0));

      expect(conflictPlace).toBeDefined();
      if (conflictPlace?.conflicts && conflictPlace.conflicts.length > 0) {
        const c = conflictPlace.conflicts[0];
        expect(c.status).toBe('sources_disagree');
        expect(c.claims.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('verifies test fixtures are isolated with source fixture and provenanceStatus fixture/simulated', async () => {
      const { TEST_FIXTURE_POIS } = await import('../data/fixtures/test-pois');
      expect(TEST_FIXTURE_POIS.length).toBeGreaterThan(0);
      TEST_FIXTURE_POIS.forEach((fix) => {
        expect(fix.source).toBe('fixture');
        expect(['fixture', 'simulated']).toContain(fix.provenanceStatus);
      });
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

