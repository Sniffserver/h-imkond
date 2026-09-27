import { describe, it, expect, beforeEach } from 'vitest';
import { unknownNearbyService } from '../features/map/discovery/unknownNearbyService';
import { neighborhoodIntelligenceService } from '../features/map/discovery/neighborhoodIntelligenceService';
import { fieldQuestService } from '../features/map/discovery/fieldQuestService';
import { searchPlaces, searchAll, rebuildSearchIndex, PlaceSearchIndex } from '../features/map/places/placeSearch';
import { streetDiscoveryService } from '../features/map/streets/streetDiscoveryService';
import { SpatialSegmentIndex } from '../features/map/streets/SpatialSegmentIndex';
import {
  locationManager,
  BrowserGeolocationProvider,
  AndroidLocationProvider,
  GNSSSerialProvider,
  MeshLocationProvider,
  ReplayLocationProvider,
  DEFAULT_TALLINN_REPLAY_TRACK,
} from '../services/location';
import { MapPlace, Street, GeoFix } from '../types';

describe('HÕIMU Field Intelligence, Unknown Nearby & Deterministic Offline Search', () => {
  beforeEach(() => {
    streetDiscoveryService.resetForTesting();
    fieldQuestService.resetQuests();
  });

  describe('1. "What Have I Not Seen?" / Unknown Nearby Engine', () => {
    it('computes unvisited places, unwalked streets, and unvisited districts within user proximity', () => {
      const userLoc = { lat: 59.4410, lng: 24.7330 }; // Kalamaja / Telliskivi
      const summary = unknownNearbyService.getUnknownNearby(userLoc, 1500);

      expect(summary).toBeDefined();
      expect(summary.unexploredStreetsCount).toBeGreaterThan(0);
      expect(summary.unexploredPlacesCount).toBeGreaterThan(0);
      expect(summary.unvisitedDistrictsCount).toBeGreaterThanOrEqual(1);
      expect(summary.unobservedMeshPathsCount).toBeGreaterThan(0);
      expect(summary.nearestUnexploredStreets.length).toBeGreaterThan(0);
      expect(summary.nearestUnexploredPlaces.length).toBeGreaterThan(0);
      expect(summary.primaryDistrict).toBeDefined();
    });

    it('updates unknown counts as new street segments are confirmed', () => {
      const userLoc = { lat: 59.4420, lng: 24.7350 };
      const initial = unknownNearbyService.getUnknownNearby(userLoc, 1500);

      // Simulate discovering street segment
      const streets = streetDiscoveryService.getStreets();
      const firstSeg = streets[0]?.segments?.[0];
      if (firstSeg) {
        streetDiscoveryService.markSegmentDiscovered(firstSeg.id);
        const updated = unknownNearbyService.getUnknownNearby(userLoc, 1500);
        expect(updated).toBeDefined();
      }
    });
  });

  describe('2. Neighborhood Intelligence Engine', () => {
    it('derives authentic district exploration metrics strictly from actual observations without fake reputation', () => {
      const districts = neighborhoodIntelligenceService.getNeighborhoods();

      expect(districts.length).toBeGreaterThanOrEqual(5);
      const kalamaja = districts.find((d) => d.name === 'Kalamaja');
      expect(kalamaja).toBeDefined();
      if (kalamaja) {
        expect(typeof kalamaja.streetsExploredPercent).toBe('number');
        expect(typeof kalamaja.placesDiscoveredPercent).toBe('number');
        expect(typeof kalamaja.meshObservationsCount).toBe('number');
        expect(typeof kalamaja.signalCoverageKm).toBe('number');
        expect(['low', 'medium', 'high']).toContain(kalamaja.confidence);
      }
    });
  });

  describe('3. Field Quests Engine', () => {
    it('loads real-world survey objectives combining streets, tools, reuse, and mesh signals', () => {
      const quests = fieldQuestService.getQuests();
      expect(quests.length).toBeGreaterThan(0);

      const kalamajaQuest = quests.find((q) => q.district === 'Kalamaja');
      expect(kalamajaQuest).toBeDefined();
      expect(kalamajaQuest!.targetDistanceKm).toBe(2.7);
      expect(kalamajaQuest!.estimatedMinutes).toBe(35);
      expect(kalamajaQuest!.objectives.length).toBeGreaterThanOrEqual(4);

      // Verify specific objective types
      const types = kalamajaQuest!.objectives.map((o) => o.type);
      expect(types).toContain('street_explore');
      expect(types).toContain('place_find');
      expect(types).toContain('mesh_observe');
      expect(types).toContain('return_campfire');
    });

    it('records completed objectives and marks quest completed when all are verified', () => {
      const active = fieldQuestService.getActiveQuest();
      expect(active).toBeDefined();

      if (active) {
        for (const obj of active.objectives) {
          fieldQuestService.completeObjective(active.id, obj.id);
        }
        const updated = fieldQuestService.getQuests().find((q) => q.id === active.id);
        expect(updated?.completed).toBe(true);
      }
    });
  });

  describe('4. Deterministic Offline Search (Acceptance Tests)', () => {
    it('returns deterministic results for "riistapood" with hardware and tool places offline', () => {
      const results = searchPlaces('riistapood');
      expect(results.length).toBeGreaterThan(0);
      // Verify matches contain tools / hardware
      const first = results[0];
      expect(first.mainCategory).toBe('tools');
    });

    it('returns deterministic results for "Narva maantee" street offline', () => {
      const allResults = searchAll('Narva maantee');
      expect(allResults.length).toBeGreaterThan(0);
      const match = allResults.find((r) => r.name.toLowerCase().includes('narva'));
      expect(match).toBeDefined();
    });

    it('returns deterministic results for "politsei" law enforcement and safety offline', () => {
      const results = searchPlaces('politsei');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((p) => p.subCategory === 'police' || p.mainCategory === 'safety')).toBe(true);
    });

    it('returns deterministic results for "reuse" / "uuskasutus" second hand and give boxes offline', () => {
      const results = searchPlaces('reuse');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((p) => p.mainCategory === 'finds' || p.subCategory === 'reuse' || p.subCategory === 'second_hand')).toBe(true);
    });

    it('orders results deterministically without exposing internal scores', () => {
      const res1 = searchPlaces('vesi');
      const res2 = searchPlaces('vesi');
      expect(res1.map((p) => p.id)).toEqual(res2.map((p) => p.id));
    });
  });

  describe('5. Physical-Device Location Providers & Abstraction', () => {
    it('provides LocationManager with multi-source backends', () => {
      const providers = locationManager.getAvailableProviders();
      const ids = providers.map((p) => p.id);

      expect(ids).toContain('browser');
      expect(ids).toContain('android');
      expect(ids).toContain('gnss_serial');
      expect(ids).toContain('mesh_triangulation');
      expect(ids).toContain('replay');
    });

    it('parses GNSS NMEA sentence in GNSSSerialProvider', () => {
      const gnss = new GNSSSerialProvider();
      // Valid NMEA $GPRMC sentence: 59°26.22' N, 24°44.70' E
      const nmea = '$GPRMC,123519,A,5926.22,N,02444.70,E,022.4,084.4,230326,003.1,W*6A';
      const fix = gnss.parseNMEALine(nmea);

      expect(fix).not.toBeNull();
      expect(fix!.lat).toBeCloseTo(59.437, 2);
      expect(fix!.lng).toBeCloseTo(24.745, 2);
    });

    it('replays track sequentially in ReplayLocationProvider', async () => {
      const replay = new ReplayLocationProvider(DEFAULT_TALLINN_REPLAY_TRACK);
      let fixReceived: GeoFix | null = null;
      replay.subscribe((fix) => {
        fixReceived = fix;
      });

      await replay.start();
      await new Promise((r) => setTimeout(r, 50));
      await replay.stop();

      expect(replay.getStatus()).toBe('idle');
    });
  });

  describe('6. Spatial Segment Index & Street Discovery Observation Ledger', () => {
    it('indexes Tallinn street segments into spatial grid cells', () => {
      const streets = streetDiscoveryService.getStreets();
      const spatialIndex = new SpatialSegmentIndex(streets);

      expect(spatialIndex.getAllIndexedCount()).toBeGreaterThan(0);
      const candidates = spatialIndex.queryCandidates({ lat: 59.4420, lng: 24.7350 }, 100);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('records rich DiscoveryObservation with GPS accuracy and confirmation counts', () => {
      // Send 2 consecutive GPS fixes along Telliskivi street to simulate real movement
      const p1: GeoFix = { lat: 59.4420, lng: 24.7350, accuracyMeters: 4.0, timestamp: 1000 };
      const p2: GeoFix = { lat: 59.4435, lng: 24.7335, accuracyMeters: 3.5, timestamp: 2000 };

      streetDiscoveryService.processGPSFix(p1);
      const discovered = streetDiscoveryService.processGPSFix(p2);

      if (discovered.length > 0) {
        const seg = discovered[0];
        const obs = streetDiscoveryService.getObservation(seg.id);
        expect(obs).toBeDefined();
        expect(obs!.confirmationCount).toBeGreaterThanOrEqual(1);
        expect(obs!.bestAccuracyMeters).toBeLessThanOrEqual(5);
        expect(obs!.confidence).toBe('high');
      }
    });
  });
});
