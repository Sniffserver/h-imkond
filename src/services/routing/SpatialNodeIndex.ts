/**
 * Spatial Grid Bucket Index for Graph Routing Nodes
 * 
 * Partitions geographic space into grid buckets (~200m - 500m)
 * to accelerate findNearestNode() from O(N) to O(1) expected time.
 */

import { BinaryNode } from './binaryFormat';
import { calculateHaversineMeters } from './routingEngine';

export class SpatialNodeIndex {
  // Cell size in degrees (~0.005 deg ≈ 550m in latitude, ~280m in Tallinn longitude)
  private cellSize: number;
  private grid: Map<string, BinaryNode[]> = new Map();
  private allNodes: BinaryNode[] = [];

  constructor(nodes: BinaryNode[] = [], cellSize: number = 0.005) {
    this.cellSize = cellSize;
    this.rebuild(nodes);
  }

  private getCellKey(lat: number, lng: number): string {
    const x = Math.floor(lng / this.cellSize);
    const y = Math.floor(lat / this.cellSize);
    return `${x}:${y}`;
  }

  public rebuild(nodes: BinaryNode[]): void {
    this.grid.clear();
    this.allNodes = nodes;

    for (const node of nodes) {
      const key = this.getCellKey(node.lat, node.lng);
      let list = this.grid.get(key);
      if (!list) {
        list = [];
        this.grid.set(key, list);
      }
      list.push(node);
    }
  }

  public addNode(node: BinaryNode): void {
    this.allNodes.push(node);
    const key = this.getCellKey(node.lat, node.lng);
    let list = this.grid.get(key);
    if (!list) {
      list = [];
      this.grid.set(key, list);
    }
    list.push(node);
  }

  /**
   * Finds nearest graph node using radial grid bucket expansion.
   */
  public findNearest(lat: number, lng: number, maxRadiusMeters: number = 25000): BinaryNode | null {
    if (this.allNodes.length === 0) return null;

    const centerX = Math.floor(lng / this.cellSize);
    const centerY = Math.floor(lat / this.cellSize);

    let bestNode: BinaryNode | null = null;
    let bestDist = Infinity;

    // Search concentric rings: 0 (center), 1, 2, 3, up to max rings
    const maxRings = Math.max(3, Math.ceil((maxRadiusMeters / 1000) / (this.cellSize * 111)));

    for (let ring = 0; ring <= maxRings; ring++) {
      let foundInRing = false;

      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;

          const key = `${centerX + dx}:${centerY + dy}`;
          const bucket = this.grid.get(key);
          if (!bucket || bucket.length === 0) continue;

          for (const node of bucket) {
            const dist = calculateHaversineMeters(lat, lng, node.lat, node.lng);
            if (dist < bestDist) {
              bestDist = dist;
              bestNode = node;
              foundInRing = true;
            }
          }
        }
      }

      // If we found a candidate in this ring, and best distance is less than next ring's minimum distance, we can stop
      if (foundInRing && bestDist < (ring + 1) * this.cellSize * 111000 * 0.5) {
        return bestNode;
      }
    }

    if (bestNode) return bestNode;

    // Fallback: Global scan if outside indexed clusters
    for (const node of this.allNodes) {
      const dist = calculateHaversineMeters(lat, lng, node.lat, node.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode;
  }
}
