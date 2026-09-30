import { EDGE_FLAGS, BinaryNode, BinaryEdge, RoutingGraphData } from '../../../src/services/routing/binaryFormat';

export interface RawOsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

export interface RawOsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

export type RawOsmElement = RawOsmNode | RawOsmWay;

export interface WalkableWay {
  id: string;
  name: string;
  district: string;
  highwayClass: 'pedestrian' | 'footway' | 'steps' | 'path' | 'living_street' | 'residential' | 'secondary' | 'primary' | 'cycleway' | 'service' | 'track' | 'tertiary' | 'unclassified';
  surface?: 'paved' | 'asphalt' | 'cobblestone' | 'gravel' | 'ground' | 'steps';
  walkable: boolean;
  wheelchair: boolean;
  bicycle: boolean;
  stairs: boolean;
  flags: number;
  coordinates: [number, number][]; // [lng, lat]
  oneway?: boolean;
  onewayReverse?: boolean;
  slope?: boolean;
  unsafe?: boolean;
  access?: string;
}

export interface GraphStructuralMetrics {
  nodeCount: number;
  edgeCount: number;
  connectedComponentCount: number;
  largestComponentSize: number;
  isolatedNodeCount: number;
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  oneWayEdgeCount: number;
  stairsEdgeCount: number;
  wheelchairEdgeCount: number;
  bikeEdgeCount: number;
}

export interface RoutingCoverageReport {
  nodeCount: number;
  edgeCount: number;
  totalWalkableKm: number;
  connectedComponentCount: number;
  largestComponentRatio: number;
  intersectionCount: number;
  deadEndCount: number;
  stairsEdgeCount: number;
  wheelchairEdgeCount: number;
  districtCoverage: Record<string, number>;
  bboxCoverage: number;
}

/**
 * High-fidelity Graph Builder implementing the requested pipeline:
 * OSM way -> walkability -> access -> oneway -> surface -> stairs -> wheelchair -> intersection splitting -> graph.
 */
export class OsmGraphBuilder {
  private nodes: Map<number, RawOsmNode> = new Map();
  private ways: RawOsmWay[] = [];

  constructor(elements: RawOsmElement[]) {
    for (const el of elements) {
      if (el.type === 'node') {
        this.nodes.set(el.id, el);
      } else if (el.type === 'way') {
        this.ways.push(el);
      }
    }
  }

  /**
   * Main pipeline execution
   */
  public buildPipeline(): {
    walkableWays: WalkableWay[];
    routingNodes: BinaryNode[];
    routingEdges: BinaryEdge[];
    graphData: RoutingGraphData;
    metrics: GraphStructuralMetrics;
    coverageReport: RoutingCoverageReport;
  } {
    // 1. Walkability Filter & Access Rules
    const processedWays: {
      way: RawOsmWay;
      coords: [number, number][];
      highwayClass: WalkableWay['highwayClass'];
      surface?: WalkableWay['surface'];
      walkable: boolean;
      wheelchair: boolean;
      bicycle: boolean;
      stairs: boolean;
      oneway: boolean;
      onewayReverse: boolean;
      slope: boolean;
      unsafe: boolean;
      access: string;
      flags: number;
    }[] = [];

    // Tracks how many times each node ID is referenced across all walkable ways (for intersection splitting)
    const nodeReferenceCount = new Map<number, number>();

    for (const way of this.ways) {
      const tags = way.tags || {};
      const highway = tags.highway;
      if (!highway) continue;

      // 1. Walkability Filter
      const isWalkableHighway = [
        'pedestrian', 'footway', 'steps', 'path', 'living_street',
        'residential', 'cycleway', 'service', 'track', 'secondary',
        'primary', 'tertiary', 'unclassified', 'corridor'
      ].includes(highway);

      if (!isWalkableHighway) continue;

      // 2. Access Rules check
      const access = tags.access || 'yes';
      const foot = tags.foot || 'yes';
      if (
        access === 'no' ||
        access === 'private' ||
        foot === 'no' ||
        foot === 'private' ||
        tags.impassable === 'yes'
      ) {
        continue; // Strictly excluded from walkable graph
      }

      // 3. Node sequence validation
      const wayNodes = way.nodes || [];
      const validNodes = wayNodes.filter(nid => this.nodes.has(nid));
      if (validNodes.length < 2) continue;

      // 4. One-way handling
      const onewayTag = tags.oneway;
      const oneway = onewayTag === 'yes' || onewayTag === '1' || onewayTag === 'true';
      const onewayReverse = onewayTag === '-1';

      // 5. Stairs & Elevation
      const stairs = highway === 'steps' || tags.stairs === 'yes' || !!tags.step_count;
      const slope = tags.incline === 'yes' || tags.incline === 'up' || tags.incline === 'down' || !!tags.slope;

      // 6. Surface handling
      let surface: WalkableWay['surface'] = 'paved';
      if (tags.surface) {
        const s = tags.surface.toLowerCase();
        if (s === 'cobblestone' || s === 'sett' || s === 'paving_stones') surface = 'cobblestone';
        else if (s === 'unpaved' || s === 'gravel' || s === 'fine_gravel' || s === 'compacted') surface = 'gravel';
        else if (s === 'ground' || s === 'earth' || s === 'dirt' || s === 'sand' || s === 'grass') surface = 'ground';
        else if (s === 'asphalt' || s === 'concrete' || s === 'paved') surface = 'paved';
      } else if (stairs) {
        surface = 'steps';
      }

      // 7. Wheelchair & Bicycle rules
      const wheelchairTag = tags.wheelchair;
      let wheelchair = true;
      if (wheelchairTag === 'no' || stairs) {
        wheelchair = tags.ramp === 'yes' || tags.wheelchair === 'yes';
      } else if (wheelchairTag === 'yes' || wheelchairTag === 'designated') {
        wheelchair = true;
      }

      const bicycleTag = tags.bicycle;
      let bicycle = highway === 'cycleway' || bicycleTag === 'yes' || bicycleTag === 'designated';
      if (bicycleTag === 'no' || stairs) {
        bicycle = false;
      } else if (!bicycleTag && (highway === 'pedestrian' || highway === 'living_street' || highway === 'residential' || highway === 'path')) {
        bicycle = true;
      }

      const unsafe = tags.unsafe === 'yes' || tags.hazard === 'yes' || tags.security === 'unsafe';

      // Map highway classes
      let highwayClass: WalkableWay['highwayClass'] = 'path';
      if (highway === 'pedestrian') highwayClass = 'pedestrian';
      else if (highway === 'footway') highwayClass = 'footway';
      else if (highway === 'steps') highwayClass = 'steps';
      else if (highway === 'living_street') highwayClass = 'living_street';
      else if (highway === 'residential') highwayClass = 'residential';
      else if (highway === 'secondary') highwayClass = 'secondary';
      else if (highway === 'primary') highwayClass = 'primary';
      else if (highway === 'cycleway') highwayClass = 'cycleway';
      else if (highway === 'service') highwayClass = 'service';
      else if (highway === 'track') highwayClass = 'track';
      else if (highway === 'tertiary') highwayClass = 'tertiary';
      else if (highway === 'unclassified') highwayClass = 'unclassified';

      // 8. Build binary flags
      let flags = 0;
      if (surface === 'cobblestone') flags |= EDGE_FLAGS.COBBLESTONE;
      if (surface === 'paved') flags |= EDGE_FLAGS.PAVED;
      if (surface === 'gravel') flags |= EDGE_FLAGS.GRAVEL;
      if (wheelchair) flags |= EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE;
      if (bicycle) flags |= EDGE_FLAGS.BIKE_PATH;
      if (stairs) flags |= EDGE_FLAGS.STAIRS;
      if (slope) flags |= EDGE_FLAGS.STEEP_SLOPE;
      if (unsafe) flags |= EDGE_FLAGS.UNSAFE_ZONE;
      if (oneway || onewayReverse) flags |= EDGE_FLAGS.ONE_WAY;

      const coords = validNodes.map(nid => {
        const n = this.nodes.get(nid)!;
        return [n.lon, n.lat] as [number, number];
      });

      // Increment node reference counts for intersection discovery
      for (const nid of validNodes) {
        nodeReferenceCount.set(nid, (nodeReferenceCount.get(nid) || 0) + 1);
      }

      processedWays.push({
        way,
        coords,
        highwayClass,
        surface,
        walkable: true,
        wheelchair,
        bicycle,
        stairs,
        oneway,
        onewayReverse,
        slope,
        unsafe,
        access,
        flags,
      });
    }

    // 2. Intersection Splitting
    const walkableWays: WalkableWay[] = [];
    const finalNodesMap = new Map<number, BinaryNode>();
    const finalEdges: BinaryEdge[] = [];
    let nextNodeId = 1;

    let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;

    const getOrCreateRoutingNode = (osmId: number, lat: number, lon: number): BinaryNode => {
      let node = finalNodesMap.get(osmId);
      if (!node) {
        minLat = Math.min(minLat, lat);
        minLng = Math.min(minLng, lon);
        maxLat = Math.max(maxLat, lat);
        maxLng = Math.max(maxLng, lon);

        node = { id: nextNodeId++, lat, lng: lon, flags: 0 };
        finalNodesMap.set(osmId, node);
      }
      return node;
    };

    for (const pw of processedWays) {
      const wayNodes = pw.way.nodes.filter(nid => this.nodes.has(nid));
      const streetName = pw.way.tags?.name || pw.way.tags?.['name:et'] || 'Nimetu tee';

      // Split this way into sub-ways at intersection nodes
      let segmentStartIdx = 0;

      for (let i = 1; i < wayNodes.length; i++) {
        const nid = wayNodes[i];
        const isIntersection = (nodeReferenceCount.get(nid) || 0) > 1;
        const isEnd = i === wayNodes.length - 1;

        if (isIntersection || isEnd) {
          const segmentNodes = wayNodes.slice(segmentStartIdx, i + 1);
          const segmentCoords = segmentNodes.map(snid => {
            const n = this.nodes.get(snid)!;
            return [n.lon, n.lat] as [number, number];
          });

          const segmentId = `osm_way_${pw.way.id}_seg_${segmentStartIdx}_to_${i}`;
          walkableWays.push({
            id: segmentId,
            name: streetName,
            district: pw.way.tags?.['addr:district'] || pw.way.tags?.['addr:suburb'] || 'Tallinn',
            highwayClass: pw.highwayClass,
            surface: pw.surface,
            walkable: pw.walkable,
            wheelchair: pw.wheelchair,
            bicycle: pw.bicycle,
            stairs: pw.stairs,
            flags: pw.flags,
            coordinates: segmentCoords,
            oneway: pw.oneway,
            onewayReverse: pw.onewayReverse,
            slope: pw.slope,
            unsafe: pw.unsafe,
            access: pw.access,
          });

          // Add topological edges to graph
          for (let k = 0; k < segmentNodes.length - 1; k++) {
            const uOsm = segmentNodes[k];
            const vOsm = segmentNodes[k + 1];
            const uNode = this.nodes.get(uOsm)!;
            const vNode = this.nodes.get(vOsm)!;

            const u = getOrCreateRoutingNode(uOsm, uNode.lat, uNode.lon);
            const v = getOrCreateRoutingNode(vOsm, vNode.lat, vNode.lon);

            const dist = calculateHaversineMeters(uNode.lat, uNode.lon, vNode.lat, vNode.lon);
            const maxSpeedKmh = pw.bicycle ? 20 : (pw.stairs ? 2 : 5);

            if (pw.onewayReverse) {
              finalEdges.push({
                sourceId: v.id,
                targetId: u.id,
                distanceMeters: dist,
                flags: pw.flags,
                maxSpeedKmh,
                streetName,
              });
            } else {
              finalEdges.push({
                sourceId: u.id,
                targetId: v.id,
                distanceMeters: dist,
                flags: pw.flags,
                maxSpeedKmh,
                streetName,
              });
            }
          }

          segmentStartIdx = i;
        }
      }
    }

    const routingNodes = Array.from(finalNodesMap.values());
    const routingEdges = finalEdges;

    if (routingNodes.length === 0) {
      minLat = 59.35; minLng = 24.6; maxLat = 59.5; maxLng = 24.9;
    }

    const bounds = { minLat, minLng, maxLat, maxLng };

    // 3. Connected Components Analysis
    const metrics = this.calculateStructuralMetrics(routingNodes, routingEdges, bounds);

    // Comprehensive Routing Coverage Report Calculation
    const totalWalkableMeters = routingEdges.reduce((sum, e) => sum + e.distanceMeters, 0) / 2;
    const totalWalkableKm = Math.round((totalWalkableMeters / 1000) * 100) / 100;
    const largestComponentRatio = Math.round((metrics.largestComponentSize / (routingNodes.length || 1)) * 1000) / 1000;

    const adj = new Map<number, number[]>();
    for (const n of routingNodes) adj.set(n.id, []);
    for (const e of routingEdges) {
      adj.get(e.sourceId)?.push(e.targetId);
      if (!(e.flags & EDGE_FLAGS.ONE_WAY)) adj.get(e.targetId)?.push(e.sourceId);
    }

    let intersectionCount = 0;
    let deadEndCount = 0;
    for (const [_, neighbors] of adj.entries()) {
      if (neighbors.length >= 3) intersectionCount++;
      else if (neighbors.length === 1) deadEndCount++;
    }

    const districtCoverage: Record<string, number> = {};
    for (const w of walkableWays) {
      const d = w.district || 'Tallinn';
      districtCoverage[d] = (districtCoverage[d] || 0) + 1;
    }

    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const bboxCoverage = Math.min(1.0, Math.round(((latSpan * lngSpan) / (0.18 * 0.35)) * 100) / 100);

    const coverageReport: RoutingCoverageReport = {
      nodeCount: routingNodes.length,
      edgeCount: routingEdges.length,
      totalWalkableKm,
      connectedComponentCount: metrics.connectedComponentCount,
      largestComponentRatio,
      intersectionCount,
      deadEndCount,
      stairsEdgeCount: metrics.stairsEdgeCount,
      wheelchairEdgeCount: metrics.wheelchairEdgeCount,
      districtCoverage,
      bboxCoverage,
    };

    const graphData: RoutingGraphData = {
      nodes: routingNodes,
      edges: routingEdges,
      bounds,
    };

    return {
      walkableWays,
      routingNodes,
      routingEdges,
      graphData,
      metrics,
      coverageReport,
    };
  }

  private calculateStructuralMetrics(
    nodes: BinaryNode[],
    edges: BinaryEdge[],
    bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }
  ): GraphStructuralMetrics {
    const adj = new Map<number, number[]>();
    for (const n of nodes) {
      adj.set(n.id, []);
    }

    let oneWayCount = 0;
    let stairsCount = 0;
    let wheelchairCount = 0;
    let bikeCount = 0;

    for (const e of edges) {
      adj.get(e.sourceId)?.push(e.targetId);
      if (!(e.flags & EDGE_FLAGS.ONE_WAY)) {
        adj.get(e.targetId)?.push(e.sourceId);
      } else {
        oneWayCount++;
      }
      if (e.flags & EDGE_FLAGS.STAIRS) stairsCount++;
      if (e.flags & EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE) wheelchairCount++;
      if (e.flags & EDGE_FLAGS.BIKE_PATH) bikeCount++;
    }

    // BFS to count connected components
    const visited = new Set<number>();
    let componentCount = 0;
    let largestComponentSize = 0;
    let isolatedNodeCount = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        componentCount++;
        let compSize = 0;
        const queue = [node.id];
        visited.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          compSize++;
          const neighbors = adj.get(curr) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        if (compSize === 1) {
          isolatedNodeCount++;
        }
        if (compSize > largestComponentSize) {
          largestComponentSize = compSize;
        }
      }
    }

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      connectedComponentCount: componentCount,
      largestComponentSize,
      isolatedNodeCount,
      bounds,
      oneWayEdgeCount: oneWayCount,
      stairsEdgeCount: stairsCount,
      wheelchairEdgeCount: wheelchairCount,
      bikeEdgeCount: bikeCount,
    };
  }
}

export function calculateHaversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_METERS = 6371000.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLng = ((lng2 - lng1) * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10.0;
}

