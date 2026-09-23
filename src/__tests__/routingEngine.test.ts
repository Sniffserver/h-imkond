import { describe, it, expect } from 'vitest';
import { RoutingEngine, calculateHaversineMeters } from '../services/routing/routingEngine';
import { encodeRoutingBin, decodeRoutingBin, EDGE_FLAGS } from '../services/routing/binaryFormat';

describe('HÕIMU Metric Binary Routing Engine', () => {
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

  it('executes A* search for walking and bike profiles', () => {
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
    expect(routeWalk!.totalDistanceMeters).toBeGreaterThan(0);
    expect(routeWalk!.path.length).toBeGreaterThanOrEqual(3);
    expect(routeWalk!.profileUsed).toBe('walking');

    const routeBike = engine.planRoute(
      { lat: 59.437, lng: 24.745 },
      { lat: 59.439, lng: 24.747 },
      { profile: 'bike' }
    );

    expect(routeBike).not.toBeNull();
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
});
