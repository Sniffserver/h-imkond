// Offline Vector Street Network Graph & A* Pathfinding Engine for Solarpunk Resilience
import { VectorStreet } from '../types';

export interface RouteStep {
  instruction: string;
  streetName: string;
  distanceMeters: number;
  distanceM?: number;
}

export interface RouteResult {
  path: [number, number][];
  totalDistanceMeters: number;
  totalDistanceM?: number;
  estimatedWalkMinutes: number;
  estimatedWalkMin?: number;
  estimatedBikeMinutes: number;
  estimatedBikeMin?: number;
  steps: RouteStep[];
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  neighbors: { node: GraphNode; dist: number; streetName: string }[];
}

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function euclideanDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Project point (px, py) onto line segment (x1, y1) - (x2, y2)
function projectPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number; dist: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { x: x1, y: y1, dist: euclideanDist(px, py, x1, y1), t: 0 };
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return { x: projX, y: projY, dist: euclideanDist(px, py, projX, projY), t };
}

/**
 * Builds an offline navigational graph from vector streets and finds shortest walkable street path
 */
export function planOfflineRoute(
  streets: VectorStreet[],
  start: { x: number; y: number },
  destination: { x: number; y: number }
): RouteResult {
  // If no streets, direct straight-line route
  if (!streets || streets.length === 0) {
    const rawDist = euclideanDist(start.x, start.y, destination.x, destination.y);
    const distMeters = Math.round(rawDist * 10);
    return {
      path: [
        [start.x, start.y],
        [destination.x, destination.y],
      ],
      totalDistanceMeters: distMeters,
      estimatedWalkMinutes: Math.max(1, Math.round(distMeters / 75)),
      estimatedBikeMinutes: Math.max(1, Math.round(distMeters / 250)),
      steps: [
        {
          instruction: 'Otsetee sihtpunkti (otsetrajektoor)',
          streetName: 'Otsetee',
          distanceMeters: distMeters,
        },
      ],
    };
  }

  // 1. Collect all segment endpoints and build node registry
  const nodeMap = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];

  const getOrCreateNode = (x: number, y: number): GraphNode => {
    // Round to 1 decimal place to merge close intersections
    const key = `${Math.round(x * 2) / 2},${Math.round(y * 2) / 2}`;
    let node = nodeMap.get(key);
    if (!node) {
      node = { id: key, x, y, neighbors: [] };
      nodeMap.set(key, node);
      nodes.push(node);
    }
    return node;
  };

  const segmentList: {
    p1: [number, number];
    p2: [number, number];
    streetName: string;
    type: string;
  }[] = [];

  // 2. Add street segments as graph edges
  streets.forEach((st) => {
    for (let i = 0; i < st.points.length - 1; i++) {
      const p1 = st.points[i];
      const p2 = st.points[i + 1];
      const n1 = getOrCreateNode(p1[0], p1[1]);
      const n2 = getOrCreateNode(p2[0], p2[1]);
      const d = euclideanDist(n1.x, n1.y, n2.x, n2.y);

      n1.neighbors.push({ node: n2, dist: d, streetName: st.name });
      n2.neighbors.push({ node: n1, dist: d, streetName: st.name });

      segmentList.push({
        p1,
        p2,
        streetName: st.name,
        type: st.type,
      });
    }
  });

  // Connect close nodes across different streets (intersections within 15 units)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = euclideanDist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
      if (d > 0.01 && d < 18) {
        // Create an intersection crossway
        nodes[i].neighbors.push({ node: nodes[j], dist: d, streetName: 'Ristmik / Ühendustee' });
        nodes[j].neighbors.push({ node: nodes[i], dist: d, streetName: 'Ristmik / Ühendustee' });
      }
    }
  }

  // 3. Find closest street projection for Start and Destination
  let bestStartProj = { x: start.x, y: start.y, dist: Infinity, streetName: 'Kõnnitee' };
  let bestEndProj = { x: destination.x, y: destination.y, dist: Infinity, streetName: 'Kõnnitee' };

  segmentList.forEach((seg) => {
    const projS = projectPointOnSegment(start.x, start.y, seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]);
    if (projS.dist < bestStartProj.dist) {
      bestStartProj = { x: projS.x, y: projS.y, dist: projS.dist, streetName: seg.streetName };
    }
    const projE = projectPointOnSegment(destination.x, destination.y, seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]);
    if (projE.dist < bestEndProj.dist) {
      bestEndProj = { x: projE.x, y: projE.y, dist: projE.dist, streetName: seg.streetName };
    }
  });

  // Create temporary Start & End graph nodes
  const startNode: GraphNode = {
    id: 'START_NODE',
    x: bestStartProj.x,
    y: bestStartProj.y,
    neighbors: [],
  };
  const endNode: GraphNode = {
    id: 'END_NODE',
    x: bestEndProj.x,
    y: bestEndProj.y,
    neighbors: [],
  };

  // Connect startNode and endNode to nearby existing street nodes
  nodes.forEach((n) => {
    const dStart = euclideanDist(startNode.x, startNode.y, n.x, n.y);
    if (dStart < 40) {
      startNode.neighbors.push({ node: n, dist: dStart, streetName: bestStartProj.streetName });
      n.neighbors.push({ node: startNode, dist: dStart, streetName: bestStartProj.streetName });
    }
    const dEnd = euclideanDist(endNode.x, endNode.y, n.x, n.y);
    if (dEnd < 40) {
      endNode.neighbors.push({ node: n, dist: dEnd, streetName: bestEndProj.streetName });
      n.neighbors.push({ node: endNode, dist: dEnd, streetName: bestEndProj.streetName });
    }
  });

  // If startNode or endNode has no close neighbors, link to closest node
  if (startNode.neighbors.length === 0 && nodes.length > 0) {
    let closest = nodes[0];
    let minD = Infinity;
    nodes.forEach((n) => {
      const d = euclideanDist(startNode.x, startNode.y, n.x, n.y);
      if (d < minD) {
        minD = d;
        closest = n;
      }
    });
    startNode.neighbors.push({ node: closest, dist: minD, streetName: bestStartProj.streetName });
    closest.neighbors.push({ node: startNode, dist: minD, streetName: bestStartProj.streetName });
  }

  if (endNode.neighbors.length === 0 && nodes.length > 0) {
    let closest = nodes[0];
    let minD = Infinity;
    nodes.forEach((n) => {
      const d = euclideanDist(endNode.x, endNode.y, n.x, n.y);
      if (d < minD) {
        minD = d;
        closest = n;
      }
    });
    endNode.neighbors.push({ node: closest, dist: minD, streetName: bestEndProj.streetName });
    closest.neighbors.push({ node: endNode, dist: minD, streetName: bestEndProj.streetName });
  }

  // 4. A* Algorithm to find shortest path from startNode to endNode
  const openSet = new Set<GraphNode>([startNode]);
  const cameFrom = new Map<GraphNode, { from: GraphNode; streetName: string }>();
  const gScore = new Map<GraphNode, number>();
  const fScore = new Map<GraphNode, number>();

  gScore.set(startNode, 0);
  fScore.set(startNode, euclideanDist(startNode.x, startNode.y, endNode.x, endNode.y));

  let current: GraphNode | null = null;
  let found = false;

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let lowestF = Infinity;
    let lowestNode: GraphNode | null = null;
    openSet.forEach((node) => {
      const f = fScore.get(node) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        lowestNode = node;
      }
    });

    if (!lowestNode) break;
    current = lowestNode;

    if (current === endNode || (Math.abs(current.x - endNode.x) < 2 && Math.abs(current.y - endNode.y) < 2)) {
      found = true;
      break;
    }

    openSet.delete(current);

    for (const edge of current.neighbors) {
      const neighbor = edge.node;
      const tentativeG = (gScore.get(current) ?? Infinity) + edge.dist;

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, { from: current, streetName: edge.streetName });
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + euclideanDist(neighbor.x, neighbor.y, endNode.x, endNode.y));
        openSet.add(neighbor);
      }
    }
  }

  // 5. Reconstruct path
  const path: [number, number][] = [];
  const rawSteps: { streetName: string; dist: number }[] = [];

  if (found && current) {
    let currNode: GraphNode | null = current;
    const pathNodes: GraphNode[] = [];
    while (currNode && currNode !== startNode) {
      pathNodes.push(currNode);
      const prev = cameFrom.get(currNode);
      if (prev) {
        rawSteps.push({
          streetName: prev.streetName,
          dist: euclideanDist(currNode.x, currNode.y, prev.from.x, prev.from.y),
        });
        currNode = prev.from;
      } else {
        break;
      }
    }
    pathNodes.push(startNode);
    pathNodes.reverse();
    rawSteps.reverse();

    // Start with exact start coordinate
    path.push([start.x, start.y]);
    pathNodes.forEach((n) => {
      path.push([n.x, n.y]);
    });
    // Finish with exact destination coordinate
    path.push([destination.x, destination.y]);
  } else {
    // Direct path fallback
    path.push([start.x, start.y], [destination.x, destination.y]);
    rawSteps.push({
      streetName: 'Otsetee',
      dist: euclideanDist(start.x, start.y, destination.x, destination.y),
    });
  }

  // 6. Calculate distance in meters (1 map unit ≈ 10 meters)
  let totalDistanceWorld = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistanceWorld += euclideanDist(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
  }
  const totalDistanceMeters = Math.round(totalDistanceWorld * 10);

  // Group steps by street name
  const steps: RouteStep[] = [];
  if (rawSteps.length === 0) {
    steps.push({
      instruction: 'Liigu otse sihtpunkti',
      streetName: 'Kõnnitee',
      distanceMeters: totalDistanceMeters,
    });
  } else {
    let currentStreet = rawSteps[0].streetName;
    let accumulatedDist = 0;

    rawSteps.forEach((s) => {
      if (s.streetName === currentStreet) {
        accumulatedDist += s.dist;
      } else {
        const dM = Math.round(accumulatedDist * 10);
        if (dM > 5) {
          steps.push({
            instruction: `Liigu mööda: ${currentStreet}`,
            streetName: currentStreet,
            distanceMeters: dM,
          });
        }
        currentStreet = s.streetName;
        accumulatedDist = s.dist;
      }
    });

    if (accumulatedDist > 0) {
      steps.push({
        instruction: `Jätka mööda: ${currentStreet}`,
        streetName: currentStreet,
        distanceMeters: Math.round(accumulatedDist * 10),
      });
    }
  }

  return {
    path,
    totalDistanceMeters,
    estimatedWalkMinutes: Math.max(1, Math.round(totalDistanceMeters / 75)), // ~4.5 km/h
    estimatedBikeMinutes: Math.max(1, Math.round(totalDistanceMeters / 250)), // ~15 km/h
    steps,
  };
}
