/**
 * HÕIMU High-Performance Metric Binary Graph Routing Engine
 * Implements A* pathfinding over binary graph structures (`routing.bin`).
 * Operates in true projected metric coordinates (meters via Haversine formula).
 */

import {
  BinaryNode,
  BinaryEdge,
  RoutingGraphData,
  EDGE_FLAGS,
  decodeRoutingBin,
  encodeRoutingBin
} from './binaryFormat';

export type RoutingProfileType = 'walking' | 'bike' | 'wheelchair' | 'emergency';

export interface RouteOptions {
  profile?: RoutingProfileType;
  avoidStairs?: boolean;
  avoidUnsafeZones?: boolean;
  maxDistanceMeters?: number;
}

export interface RouteStep {
  instruction: string;
  streetName: string;
  distanceMeters: number;
}

export interface RouteResult {
  path: [number, number][]; // Array of [lng, lat] coordinates
  totalDistanceMeters: number;
  estimatedMinutes: number;
  steps: RouteStep[];
  profileUsed: RoutingProfileType;
}

/**
 * Calculates exact geodesic distance between two WGS84 coordinates in meters.
 */
export function calculateHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

interface AdjacencyEdge {
  targetNode: BinaryNode;
  distanceMeters: number;
  flags: number;
  maxSpeedKmh: number;
  streetName: string;
}

interface InternalNode extends BinaryNode {
  neighbors: AdjacencyEdge[];
}

export class RoutingEngine {
  private nodesMap: Map<number, InternalNode> = new Map();
  private graphData: RoutingGraphData;

  constructor(graphData: RoutingGraphData) {
    this.graphData = graphData;
    for (const node of graphData.nodes) {
      this.nodesMap.set(node.id, { ...node, neighbors: [] });
    }

      for (const edge of graphData.edges) {
        const srcNode = this.nodesMap.get(edge.sourceId);
        const tgtNode = this.nodesMap.get(edge.targetId);

        if (srcNode && tgtNode) {
          srcNode.neighbors.push({
            targetNode: tgtNode,
            distanceMeters: edge.distanceMeters,
            flags: edge.flags,
            maxSpeedKmh: edge.maxSpeedKmh,
            streetName: edge.streetName,
          });

          // Bidirectional unless one-way
          if (!(edge.flags & EDGE_FLAGS.ONE_WAY)) {
            tgtNode.neighbors.push({
              targetNode: srcNode,
              distanceMeters: edge.distanceMeters,
              flags: edge.flags,
              maxSpeedKmh: edge.maxSpeedKmh,
              streetName: edge.streetName,
            });
          }
        }
      }
  }

  public static fromBinary(buffer: ArrayBuffer): RoutingEngine {
    const data = decodeRoutingBin(buffer);
    return new RoutingEngine(data);
  }

  /**
   * Helper to build a metric routing graph directly from vector streets.
   */
  public static fromVectorStreets(
    streets: Array<{ id?: string; name: string; coordinates: [number, number][]; type?: string; flags?: number }>
  ): RoutingEngine {
    const nodeMap = new Map<string, BinaryNode>();
    const nodes: BinaryNode[] = [];
    const edges: BinaryEdge[] = [];
    let nodeCounter = 1;

    let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;

    const getOrCreateNode = (lng: number, lat: number): BinaryNode => {
      minLat = Math.min(minLat, lat);
      minLng = Math.min(minLng, lng);
      maxLat = Math.max(maxLat, lat);
      maxLng = Math.max(maxLng, lng);

      // Quantize to ~1m precision (5 decimal places)
      const key = `${Math.round(lat * 100000) / 100000},${Math.round(lng * 100000) / 100000}`;
      let existing = nodeMap.get(key);
      if (!existing) {
        existing = {
          id: nodeCounter++,
          lat,
          lng,
          flags: 0,
        };
        nodeMap.set(key, existing);
        nodes.push(existing);
      }
      return existing;
    };

    for (const street of streets) {
      const coords = street.coordinates || [];
      if (coords.length < 2) continue;

      let flags = street.flags || 0;
      if (street.type === 'steps' || street.type === 'stairs' || street.name.toLowerCase().includes('trepp')) {
        flags |= EDGE_FLAGS.STAIRS;
      }
      if (street.type === 'cycleway' || street.type === 'bike') {
        flags |= EDGE_FLAGS.BIKE_PATH;
      }

      for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];

        const u = getOrCreateNode(lng1, lat1);
        const v = getOrCreateNode(lng2, lat2);

        const dist = calculateHaversineMeters(lat1, lng1, lat2, lng2);

        edges.push({
          sourceId: u.id,
          targetId: v.id,
          distanceMeters: dist,
          flags,
          maxSpeedKmh: (flags & EDGE_FLAGS.BIKE_PATH) ? 20 : 5,
          streetName: street.name || 'Nimetu tee',
        });
      }
    }

    if (nodes.length === 0) {
      // Fallback bounding box
      minLat = 59.4; minLng = 24.7; maxLat = 59.5; maxLng = 24.8;
    }

    return new RoutingEngine({
      nodes,
      edges,
      bounds: { minLat, minLng, maxLat, maxLng },
    });
  }

  /**
   * Finds the nearest graph node to a given lat/lng coordinate.
   */
  public findNearestNode(lat: number, lng: number): BinaryNode | null {
    let bestNode: BinaryNode | null = null;
    let bestDist = Infinity;

    for (const node of this.nodesMap.values()) {
      const dist = calculateHaversineMeters(lat, lng, node.lat, node.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode;
  }

  /**
   * A* Pathfinding Algorithm with profile cost weighting and hazard avoidance.
   */
  public planRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    options: RouteOptions = {}
  ): RouteResult | null {
    const profile = options.profile || 'walking';
    const avoidStairs = options.avoidStairs ?? (profile === 'wheelchair');
    const avoidUnsafe = options.avoidUnsafeZones ?? false;

    const startNode = this.findNearestNode(origin.lat, origin.lng);
    const goalNode = this.findNearestNode(destination.lat, destination.lng);

    if (!startNode || !goalNode) {
      return null;
    }

    // Direct straight line fallback if start and goal are the same
    if (startNode.id === goalNode.id) {
      const dist = calculateHaversineMeters(origin.lat, origin.lng, destination.lat, destination.lng);
      return {
        path: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
        totalDistanceMeters: dist,
        estimatedMinutes: Math.max(1, Math.round(dist / 75)),
        steps: [{ instruction: 'Oled juba sihtkohas', streetName: 'Sihtkoht', distanceMeters: dist }],
        profileUsed: profile,
      };
    }

    // A* Data structures
    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();
    const cameFrom = new Map<number, { node: InternalNode; edge: AdjacencyEdge }>();

    gScore.set(startNode.id, 0);
    const initialH = calculateHaversineMeters(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng);
    fScore.set(startNode.id, initialH);

    // Simple priority queue (Min-Heap based logic)
    const openSet = new Set<number>([startNode.id]);

    while (openSet.size > 0) {
      // Pick node with lowest fScore
      let currentId: number | null = null;
      let lowestF = Infinity;

      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId === null) break;

      if (currentId === goalNode.id) {
        // Reconstruct path
        return this.reconstructRoute(goalNode.id, cameFrom, origin, destination, profile);
      }

      openSet.delete(currentId);
      const currentNode = this.nodesMap.get(currentId)!;
      const currentG = gScore.get(currentId) ?? Infinity;

      for (const neighborEdge of currentNode.neighbors) {
        const neighborNode = neighborEdge.targetNode;

        // Profile & Avoidance Constraint Filters
        if (avoidStairs && (neighborEdge.flags & EDGE_FLAGS.STAIRS)) {
          continue; // Impassable for wheelchair or avoidStairs
        }

        if (avoidUnsafe && (neighborEdge.flags & EDGE_FLAGS.UNSAFE_ZONE)) {
          continue; // Impassable unsafe threat zone
        }

        // Cost weighting multiplier based on profile
        let costMultiplier = 1.0;

        if (profile === 'wheelchair') {
          if (neighborEdge.flags & EDGE_FLAGS.COBBLESTONE) costMultiplier *= 2.5;
          if (neighborEdge.flags & EDGE_FLAGS.STEEP_SLOPE) costMultiplier *= 3.0;
          if (neighborEdge.flags & EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE) costMultiplier *= 0.8;
        } else if (profile === 'bike') {
          if (neighborEdge.flags & EDGE_FLAGS.BIKE_PATH) costMultiplier *= 0.7;
          if (neighborEdge.flags & EDGE_FLAGS.STAIRS) costMultiplier *= 10.0;
        } else if (profile === 'emergency') {
          costMultiplier *= 0.5; // High priority override
        }

        const tentativeG = currentG + neighborEdge.distanceMeters * costMultiplier;

        if (tentativeG < (gScore.get(neighborNode.id) ?? Infinity)) {
          cameFrom.set(neighborNode.id, { node: currentNode, edge: neighborEdge });
          gScore.set(neighborNode.id, tentativeG);

          const h = calculateHaversineMeters(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng);
          fScore.set(neighborNode.id, tentativeG + h);

          openSet.add(neighborNode.id);
        }
      }
    }

    // Return null if no path found
    return null;
  }

  private reconstructRoute(
    goalId: number,
    cameFrom: Map<number, { node: InternalNode; edge: AdjacencyEdge }>,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    profile: RoutingProfileType
  ): RouteResult {
    const path: [number, number][] = [[destination.lng, destination.lat]];
    let currId = goalId;
    let totalDist = 0;
    const rawSteps: RouteStep[] = [];

    while (cameFrom.has(currId)) {
      const { node, edge } = cameFrom.get(currId)!;
      path.unshift([node.lng, node.lat]);
      totalDist += edge.distanceMeters;

      rawSteps.unshift({
        instruction: `Liigu mööda tänavat: ${edge.streetName}`,
        streetName: edge.streetName,
        distanceMeters: Math.round(edge.distanceMeters),
      });

      currId = node.id;
    }

    path.unshift([origin.lng, origin.lat]);

    // Consolidate consecutive steps on same street name
    const steps: RouteStep[] = [];
    for (const step of rawSteps) {
      if (steps.length > 0 && steps[steps.length - 1].streetName === step.streetName) {
        steps[steps.length - 1].distanceMeters += step.distanceMeters;
      } else {
        steps.push({ ...step });
      }
    }

    // Speed constants in m/s
    const speedsMps: Record<RoutingProfileType, number> = {
      walking: 1.25,  // 4.5 km/h
      bike: 4.17,     // 15 km/h
      wheelchair: 0.9, // 3.2 km/h
      emergency: 11.1, // 40 km/h
    };

    const speed = speedsMps[profile] || 1.25;
    const estimatedMinutes = Math.max(1, Math.round(totalDist / (speed * 60)));

    return {
      path,
      totalDistanceMeters: Math.round(totalDist),
      estimatedMinutes,
      steps,
      profileUsed: profile,
    };
  }

  /**
   * Serializes current routing graph into binary buffer representation.
   */
  public toBinary(): ArrayBuffer {
    return encodeRoutingBin(this.graphData);
  }
}
