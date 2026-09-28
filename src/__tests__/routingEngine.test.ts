import { describe, it, expect } from 'vitest';
import { RoutingEngine, calculateHaversineMeters } from '../services/routing/routingEngine';
import { encodeRoutingBin, decodeRoutingBin, EDGE_FLAGS } from '../services/routing/binaryFormat';
import { RoutingRepository } from '../services/routing/routingRepository';
import { transformDomainToMapViewModel } from '../features/map/viewmodel/MapViewModel';
import { MeshNode, ResourceItem } from '../types';

describe('HÕIMU Metric Binary Routing Engine & Repository', () => {
  it('calculates accurate Haversine metric distances in meters', () => {
    // Tallinn Freedom Square to Town Hall Square (~400m)
    const lat1 = 59.4335;
    const lng1 = 24.7447;
    const lat2 = 59.4372;
    const lng2 = 24.7453;

    const distM = calculateHaversineMeters(lat1, lng1, lat2, lng2);
    expect(distM).toBeGreaterThan(350);
    expect(distM).toBeLessThan(450);
  });

  it('packs and unpacks routing.bin binary graph buffers', () => {
    const originalData = {
      nodes: [
        { id: 1, lat: 59.437, lng: 24.753, flags: 0 },
        { id: 2, lat: 59.438, lng: 24.754, flags: 0 },
      ],
      edges: [
        {
          sourceId: 1,
          targetId: 2,
          distanceMeters: 125.5,
          flags: EDGE_FLAGS.BIKE_PATH,
          maxSpeedKmh: 20,
          streetName: 'Viru tänav',
        },
      ],
      bounds: { minLat: 59.437, minLng: 24.753, maxLat: 59.438, maxLng: 24.754 },
    };

    const binBuffer = encodeRoutingBin(originalData);
    expect(binBuffer.byteLength).toBeGreaterThan(32);

    const decoded = decodeRoutingBin(binBuffer);
    expect(decoded.nodes.length).toBe(2);
    expect(decoded.edges.length).toBe(1);
    expect(decoded.edges[0].streetName).toBe('Viru tänav');
    expect(decoded.edges[0].distanceMeters).toBeCloseTo(125.5, 1);
  });

  it('executes A* search for walking and bike profiles with quality: graph', () => {
    const streets = [
      {
        name: 'Pikk tänav',
        coordinates: [
          [24.745, 59.437] as [number, number],
          [24.746, 59.438] as [number, number],
        ],
        type: 'pedestrian',
      },
      {
        name: 'Rataskaevu tänav',
        coordinates: [
          [24.746, 59.438] as [number, number],
          [24.747, 59.439] as [number, number],
        ],
        type: 'residential',
      },
    ];

    const engine = RoutingEngine.fromVectorStreets(streets);

    const routeWalk = engine.planRoute(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.439, lng: 24.747 },
      { profile: 'walking' }
    );

    expect(routeWalk).not.toBeNull();
    expect(routeWalk!.quality).toBe('graph');
    expect(routeWalk!.totalDistanceMeters).toBeGreaterThan(0);
    expect(routeWalk!.path.length).toBeGreaterThanOrEqual(3);
    expect(routeWalk!.profileUsed).toBe('walking');

    const routeBike = engine.planRoute(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.439, lng: 24.747 },
      { profile: 'bike' }
    );

    expect(routeBike).not.toBeNull();
    expect(routeBike!.quality).toBe('graph');
    expect(routeBike!.profileUsed).toBe('bike');
  });

  it('strictly avoids stairs for wheelchair profile', () => {
    const streets = [
      {
        name: 'Trepikoda (Stairs)',
        coordinates: [
          [24.745, 59.437] as [number, number],
          [24.746, 59.438] as [number, number],
        ],
        type: 'stairs',
      },
    ];

    const engine = RoutingEngine.fromVectorStreets(streets);

    const routeWheelchair = engine.planRoute(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.438, lng: 24.746 },
      { profile: 'wheelchair', avoidStairs: true }
    );

    // Should return null since the only street consists of stairs
    expect(routeWheelchair).toBeNull();
  });

  it('strictly refuses silent fake straight-line walking routes in RoutingRepository', () => {
    const repo = new RoutingRepository();
    expect(repo.isReady()).toBe(false);

    // When no graph is loaded, planRoute must return quality: 'unavailable' and empty path
    const unavailableRoute = repo.planRoute(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.439, lng: 24.747 },
      { profile: 'walking' }
    );
    expect(unavailableRoute.quality).toBe('unavailable');
    expect(unavailableRoute.path).toHaveLength(0);
    expect(unavailableRoute.errorMessage).toBeDefined();

    // When direct bearing is explicitly requested, it is labeled quality: 'estimated'
    const bearing = repo.planDirectBearing(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.439, lng: 24.747 }
    );
    expect(bearing.quality).toBe('estimated');
    expect(bearing.path).toHaveLength(2);
    expect(bearing.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('transforms domain state through MapViewModel boundary cleanly', () => {
    const mockPeers: MeshNode[] = [
      {
        id: 'node_alpha_1',
        callsign: 'ALPHA1',
        bio: 'Alpha Scout',
        skills: ['Scouting'],
        lastRssi: -65,
        hopDistance: 1,
        lastSeen: '2026-09-27T12:00:00Z',
        trustScore: 95,
        completedExchanges: 5,
        relayReliability: 99,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'seed1',
        recentInteractions: [10],
        angle: 45,
        distanceRatio: 0.3,
      },
      {
        id: 'node_bravo_2',
        callsign: 'BRAVO2',
        bio: 'Bravo Medic',
        skills: ['First Aid'],
        lastRssi: -72,
        hopDistance: 1,
        lastSeen: '2026-09-27T12:00:00Z',
        trustScore: 90,
        completedExchanges: 3,
        relayReliability: 98,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'seed2',
        recentInteractions: [12],
        angle: 180,
        distanceRatio: 0.6,
      },
    ];

    const mockResources: ResourceItem[] = [
      {
        id: 'res_water_1',
        ownerId: 'node_alpha_1',
        ownerCallsign: 'ALPHA1',
        title: 'Fresh Water Tank',
        description: 'Potable water supply',
        category: 'Food',
        type: 'offer',
        location: { lat: 59.438, lng: 24.754 },
        distanceKm: 0.2,
        createdAt: Date.now(),
        isActive: true,
        availabilityText: '500 L',
        avatarSeed: 'seed1',
      },
    ];

    const vm = transformDomainToMapViewModel({
      peers: mockPeers,
      resources: mockResources,
      userLocation: { lat: 59.437, lng: 24.753 },
    });

    expect(vm.peers).toHaveLength(2);
    expect(vm.peers[0].callsign).toBe('ALPHA1');
    expect(vm.resources).toHaveLength(1);
    expect(vm.meshLinks).toHaveLength(1); // Link synthesized between the two online nodes
    expect(vm.places.length).toBeGreaterThan(0);
    expect(vm.streets.length).toBeGreaterThan(0);
  });
});
