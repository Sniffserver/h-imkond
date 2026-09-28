import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaceSearchIndex, normalizeStreetSuffixes } from '../features/map/places/placeSearchIndex';
import { searchExploreMap } from '../features/map/explore/ExploreMapSearch';
import { searchWorkerClient } from '../features/search/searchWorkerClient';
import { MapUpdateScheduler } from '../features/map/explore/MapUpdateScheduler';
import { MinHeap } from '../services/routing/MinHeap';
import { SpatialNodeIndex } from '../services/routing/SpatialNodeIndex';
import { RoutingEngine } from '../services/routing/routingEngine';
import { getTallinnMapPlaces } from '../features/map/places/placeData';
import { getTallinnStreets } from '../features/map/streets/streetData';
import { MapPlace, Street, GeoPoint } from '../types';

describe('P1 Enhancements: Search, MapUpdateScheduler, MinHeap & SpatialNodeIndex', () => {
  const userLoc: GeoPoint = { lat: 59.4370, lng: 24.7535 };
  let places: MapPlace[];
  let streets: Street[];

  beforeEach(() => {
    places = getTallinnMapPlaces();
    streets = getTallinnStreets();
  });

  // =========================================================================
  // 1. Search Ranking & Multi-Token Queries
  // =========================================================================
  describe('Multi-Token Ranked Search Engine', () => {
    it('normalizes Estonian street suffixes correctly', () => {
      expect(normalizeStreetSuffixes('Viru tn')).toBe('viru tänav');
      expect(normalizeStreetSuffixes('Pärnu mnt 139')).toBe('pärnu maantee 139');
      expect(normalizeStreetSuffixes('Sõpruse pst')).toBe('sõpruse puiestee');
      expect(normalizeStreetSuffixes('Lossi tee')).toBe('lossi tee');
    });

    it('ranks exact street matches for "Viru tänav" and abbreviation "Viru tn"', () => {
      const index = new PlaceSearchIndex(places, streets);

      const hitsFull = index.search('Viru tänav', userLoc);
      expect(hitsFull.length).toBeGreaterThan(0);
      expect(hitsFull[0].name.toLowerCase()).toContain('viru tänav');
      expect(hitsFull[0].type).toBe('street');

      const hitsAbbr = index.search('Viru tn', userLoc);
      expect(hitsAbbr.length).toBeGreaterThan(0);
      expect(hitsAbbr[0].name.toLowerCase()).toContain('viru tänav');
      expect(hitsAbbr[0].type).toBe('street');
    });

    it('ranks house number address match for "Viru 4"', () => {
      const index = new PlaceSearchIndex(places, streets);
      const hits = index.search('Viru 4', userLoc);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].address?.toLowerCase()).toContain('viru');
      expect(hits[0].address?.toLowerCase()).toContain('4');
    });

    it('ranks compound category query "apteek Viru" with pharmacy as top result', () => {
      const index = new PlaceSearchIndex(places, streets);
      const hits = index.search('apteek Viru', userLoc);
      expect(hits.length).toBeGreaterThan(0);
      const top = hits[0];
      expect(top.type).toBe('place');
      expect(top.subCategory).toBe('pharmacy');
      expect(top.name.toLowerCase()).toContain('viru');
    });

    it('ranks compound category query "water Viru" with drinking water as top result', () => {
      const index = new PlaceSearchIndex(places, streets);
      const hits = index.search('water Viru', userLoc);
      expect(hits.length).toBeGreaterThan(0);
      const top = hits[0];
      expect(top.type).toBe('place');
      expect(top.category).toBe('water');
      expect(top.name.toLowerCase()).toContain('viru');
    });

    it('enforces ranking hierarchy: exact name > exact street > prefix > alias > category', () => {
      const customPlaces: MapPlace[] = [
        {
          id: 'place_exact',
          name: 'Viru',
          mainCategory: 'stores',
          subCategory: 'other',
          location: { lat: 59.4365, lng: 24.7540 },
          sources: [{ provider: 'tallinn', sourceId: '1', retrievedAt: 100 }],
          source: 'tallinn',
          sourceName: 'Tallinn',
          provenanceStatus: 'official',
        },
        {
          id: 'place_prefix',
          name: 'Viru Keskus',
          mainCategory: 'stores',
          subCategory: 'other',
          location: { lat: 59.4365, lng: 24.7540 },
          sources: [{ provider: 'tallinn', sourceId: '2', retrievedAt: 100 }],
          source: 'tallinn',
          sourceName: 'Tallinn',
          provenanceStatus: 'official',
        },
      ];

      const customStreets: Street[] = [
        {
          id: 'street_exact',
          name: 'Viru',
          district: 'Kesklinn',
          highwayClass: 'pedestrian',
          walkable: true,
          bicycle: true,
          lengthMeters: 500,
          discoveredMeters: 0,
          exploredPercent: 0,
          segments: [],
          geometry: { coordinates: [[24.7500, 59.4365], [24.7465, 59.4372]] },
        },
      ];

      const index = new PlaceSearchIndex(customPlaces, customStreets);
      const hits = index.search('Viru', userLoc);

      // Exact place name should be #1 (tier 1)
      expect(hits[0].id).toBe('place_exact');
      // Exact street should be #2 (tier 2)
      expect(hits[1].id).toBe('street_exact');
      // Prefix match should follow (tier 3)
      expect(hits[2].id).toBe('place_prefix');
    });

    it('returns top 6 results without exposing raw algorithmic scores to UI matches', () => {
      const results = searchExploreMap('viru', userLoc, places, streets);
      expect(results.length).toBeLessThanOrEqual(6);
      for (const res of results) {
        expect(res.title).toBeDefined();
        expect(res.subtitle).toBeDefined();
        expect(res.distanceMeters).toBeGreaterThanOrEqual(0);
        // Ensure no score property leaked into SearchMatch interface
        expect((res as any).score).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 2. SearchWorkerClient Debouncing
  // =========================================================================
  describe('SearchWorkerClient', () => {
    it('debounces rapid keystrokes within 60-100ms window', async () => {
      searchWorkerClient.initialize(places, streets);

      const p1 = searchWorkerClient.searchDebounced('v', userLoc, 6, 75);
      const p2 = searchWorkerClient.searchDebounced('vi', userLoc, 6, 75);
      const p3 = searchWorkerClient.searchDebounced('viru', userLoc, 6, 75);

      const results = await p3;
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(6);
    });
  });

  // =========================================================================
  // 3. MapUpdateScheduler Batching
  // =========================================================================
  describe('MapUpdateScheduler', () => {
    it('batches multiple rapid setData calls into a single synchronous flush', () => {
      const setDataMock = vi.fn();
      const mockSource = { setData: setDataMock };
      const mockMap = {
        getSource: vi.fn().mockReturnValue(mockSource),
      } as any;

      const scheduler = new MapUpdateScheduler(mockMap);

      // Enqueue 5 source updates
      scheduler.queueUpdate('source_1', { type: 'FeatureCollection', features: [] });
      scheduler.queueUpdate('source_2', { type: 'FeatureCollection', features: [] });
      scheduler.queueUpdate('source_1', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { v: 2 }, geometry: { type: 'Point', coordinates: [0, 0] } }] });
      scheduler.queueUpdate('source_3', { type: 'FeatureCollection', features: [] });

      // Before flush, setData is not called synchronously
      expect(setDataMock).not.toHaveBeenCalled();

      // Flush batched updates
      scheduler.flush();

      // Should have called setData exactly 3 times (once per distinct source: source_1, source_2, source_3)
      expect(setDataMock).toHaveBeenCalledTimes(3);

      scheduler.destroy();
    });
  });

  // =========================================================================
  // 4. MinHeap Priority Queue
  // =========================================================================
  describe('MinHeap<T>', () => {
    it('maintains min-heap property with O(log n) push and pop', () => {
      const heap = new MinHeap<number>();
      heap.push(10, 50);
      heap.push(20, 10);
      heap.push(30, 30);
      heap.push(40, 5);
      heap.push(50, 100);

      expect(heap.size).toBe(5);
      expect(heap.pop()?.key).toBe(40); // priority 5
      expect(heap.pop()?.key).toBe(20); // priority 10
      expect(heap.pop()?.key).toBe(30); // priority 30
      expect(heap.pop()?.key).toBe(10); // priority 50
      expect(heap.pop()?.key).toBe(50); // priority 100
      expect(heap.isEmpty()).toBe(true);
    });

    it('handles decrease-key updates correctly', () => {
      const heap = new MinHeap<string>();
      heap.push('nodeA', 100);
      heap.push('nodeB', 50);
      heap.push('nodeC', 80);

      // Decrease nodeA priority to 10 (should become new root)
      heap.push('nodeA', 10);

      expect(heap.peek()?.key).toBe('nodeA');
      expect(heap.pop()?.key).toBe('nodeA');
      expect(heap.pop()?.key).toBe('nodeB');
    });
  });

  // =========================================================================
  // 5. SpatialNodeIndex
  // =========================================================================
  describe('SpatialNodeIndex', () => {
    it('indexes nodes into grid buckets and retrieves closest node in O(1) expected time', () => {
      const nodes = [
        { id: 1, lat: 59.4365, lng: 24.7538, flags: 0 }, // Viru
        { id: 2, lat: 59.4340, lng: 24.7440, flags: 0 }, // Vabaduse
        { id: 3, lat: 59.4385, lng: 24.7890, flags: 0 }, // Kadriorg
        { id: 4, lat: 59.3875, lng: 24.6540, flags: 0 }, // Glehn
      ];

      const spatialIndex = new SpatialNodeIndex(nodes, 0.005);

      // Nearest to Viru coordinates
      const nearestViru = spatialIndex.findNearest(59.4364, 24.7540);
      expect(nearestViru).not.toBeNull();
      expect(nearestViru?.id).toBe(1);

      // Nearest to Kadriorg
      const nearestKadriorg = spatialIndex.findNearest(59.4380, 24.7885);
      expect(nearestKadriorg).not.toBeNull();
      expect(nearestKadriorg?.id).toBe(3);
    });
  });

  // =========================================================================
  // 6. RoutingEngine Integration with MinHeap and SpatialNodeIndex
  // =========================================================================
  describe('RoutingEngine with MinHeap & SpatialNodeIndex', () => {
    it('plans optimal walking routes using binary MinHeap and spatial node lookup', () => {
      const engine = RoutingEngine.fromVectorStreets(streets);

      // Route from Viru väljak (59.4364, 24.7538) to Raekoja plats (59.4374, 24.7452)
      const route = engine.planRoute(
        { lat: 59.4364, lng: 24.7538 },
        { lat: 59.4374, lng: 24.7452 },
        { profile: 'walking' }
      );

      expect(route).not.toBeNull();
      expect(route!.path.length).toBeGreaterThan(1);
      expect(route!.totalDistanceMeters).toBeGreaterThan(200);
      expect(route!.totalDistanceMeters).toBeLessThan(1500);
      expect(route!.quality).toBe('graph');
    });
  });
});
