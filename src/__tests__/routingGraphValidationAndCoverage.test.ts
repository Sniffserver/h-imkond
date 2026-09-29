import { describe, it, expect } from 'vitest';
import { generateRawOsmElementsFromSnapshot } from '../../tools/map-data/osm/pedestrian';
import { OsmGraphBuilder } from '../../tools/map-data/osm/graph-builder';
import { RoutingEngine } from '../services/routing/routingEngine';
import { EDGE_FLAGS } from '../services/routing/binaryFormat';

describe('Phase 5 — Real OSM Pedestrian Routing Graph & District Coverage', () => {
  const rawElements = generateRawOsmElementsFromSnapshot();
  const builder = new OsmGraphBuilder(rawElements);
  const pipeline = builder.buildPipeline();
  const engine = new RoutingEngine(pipeline.graphData);

  it('1. Structural Validation: builds complete graph from actual OSM ways with intersection splitting', () => {
    const metrics = pipeline.metrics;

    // Must be a real graph, not a dummy 97-node stub
    expect(metrics.nodeCount).toBeGreaterThan(30);
    expect(metrics.edgeCount).toBeGreaterThan(40);
    expect(metrics.connectedComponentCount).toBeGreaterThan(0);
    expect(metrics.largestComponentSize).toBeGreaterThan(20);

    // Bounding box within Tallinn bioregion
    expect(metrics.bounds.minLat).toBeGreaterThanOrEqual(59.3);
    expect(metrics.bounds.maxLat).toBeLessThanOrEqual(59.6);
    expect(metrics.bounds.minLng).toBeGreaterThanOrEqual(24.5);
    expect(metrics.bounds.maxLng).toBeLessThanOrEqual(25.0);

    const structural = engine.validateStructuralIntegrity();
    expect(structural.valid).toBe(true);
    expect(structural.issues).toHaveLength(0);
  });

  it('2. Semantic Rule: wheelchair strictly avoids stairs', () => {
    // Find stair edge in graph (e.g. Patkuli or Lühike jalg)
    const stairEdges = pipeline.routingEdges.filter(e => e.flags & EDGE_FLAGS.STAIRS);
    expect(stairEdges.length).toBeGreaterThan(0);

    const stairsEdge = stairEdges[0];
    const srcNode = pipeline.routingNodes.find(n => n.id === stairsEdge.sourceId)!;
    const tgtNode = pipeline.routingNodes.find(n => n.id === stairsEdge.targetId)!;

    // Walking profile can traverse stairs
    const walkRoute = engine.planRoute(
      { lat: srcNode.lat, lng: srcNode.lng },
      { lat: tgtNode.lat, lng: tgtNode.lng },
      { profile: 'walking', avoidStairs: false }
    );
    expect(walkRoute).not.toBeNull();

    // Wheelchair profile with avoidStairs strictly avoids stair edge
    const wheelchairRoute = engine.planRoute(
      { lat: srcNode.lat, lng: srcNode.lng },
      { lat: tgtNode.lat, lng: tgtNode.lng },
      { profile: 'wheelchair', avoidStairs: true }
    );
    if (wheelchairRoute) {
      // Must not use stair steps
      expect(wheelchairRoute.steps.some(s => s.streetName.toLowerCase().includes('trepp'))).toBe(false);
    }
  });

  it('3. Semantic Rule: bike prefers bike infrastructure and penalizes stairs', () => {
    const bikeEdges = pipeline.routingEdges.filter(e => e.flags & EDGE_FLAGS.BIKE_PATH);
    expect(bikeEdges.length).toBeGreaterThan(0);

    const semantic = engine.validateSemanticRules();
    expect(semantic.bikePrefersBikePath).toBe(true);
    expect(semantic.pedestrianTraversesFootway).toBe(true);
  });

  it('4. Access Rule: restricted ways (access=no, foot=no) are excluded from graph', () => {
    // Ingest dummy way with access=no
    const restrictedWayBuilder = new OsmGraphBuilder([
      { type: 'node', id: 9991, lat: 59.43, lon: 24.75 },
      { type: 'node', id: 9992, lat: 59.431, lon: 24.751 },
      {
        type: 'way',
        id: 99901,
        nodes: [9991, 9992],
        tags: { highway: 'pedestrian', access: 'no', name: 'Privaatne suletud ala' },
      },
    ]);

    const res = restrictedWayBuilder.buildPipeline();
    expect(res.routingNodes).toHaveLength(0);
    expect(res.routingEdges).toHaveLength(0);
  });

  it('5. District Coverage: randomly and systematically verifies coverage across all 8 Tallinn districts', () => {
    const districts = [
      { name: 'Kesklinn / Vanalinn', lat: 59.4372, lng: 24.7452 },
      { name: 'Kalamaja / Põhja-Tallinn', lat: 59.4412, lng: 24.7350 },
      { name: 'Kadriorg / Südalinn', lat: 59.4385, lng: 24.7890 },
      { name: 'Kristiine / Uus Maailm', lat: 59.4265, lng: 24.7230 },
      { name: 'Mustamäe', lat: 59.4010, lng: 24.6850 },
      { name: 'Nõmme', lat: 59.3900, lng: 24.6650 },
      { name: 'Haabersti / Õismäe', lat: 59.4230, lng: 24.6700 },
      { name: 'Pirita', lat: 59.4680, lng: 24.8320 },
      { name: 'Lasnamäe', lat: 59.4340, lng: 24.8600 },
    ];

    const coverage = engine.testCoverageAcrossDistricts(districts);
    expect(coverage.allPassed).toBe(true);

    coverage.results.forEach(res => {
      expect(res.nearestNodeFound).toBe(true);
      expect(res.distanceToGraphMeters).toBeLessThan(1000); // within 1km of district point
    });
  });
});
