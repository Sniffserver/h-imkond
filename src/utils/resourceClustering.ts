import { ResourceItem, ResourceCategory, MeshNode } from '../types';

export interface RawResourcePosition {
  resource: ResourceItem;
  x: number;
  y: number;
  color: string;
}

export interface ResourceCluster {
  id: string;
  x: number;
  y: number;
  resources: ResourceItem[];
  count: number;
  categories: ResourceCategory[];
  categoryCounts: Record<string, number>;
  categoryColors: string[];
  dominantCategory: ResourceCategory;
  dominantColor: string;
  isCluster: boolean;
  singleResource?: ResourceItem;
  radiusWorld: number;
}

export interface RawPeerPosition {
  peer: MeshNode;
  x: number;
  y: number;
  distKm: string;
}

export interface PeerCluster {
  id: string;
  x: number;
  y: number;
  peers: MeshNode[];
  count: number;
  isCluster: boolean;
  singlePeer?: MeshNode;
  distKm?: string;
  directCount: number;
  relayedCount: number;
  avgRssi: number;
  radiusWorld: number;
}

export const CATEGORY_COLORS: Record<ResourceCategory, string> = {
  Energy: '#F4A261',
  Tools: '#2A9D8F',
  Food: '#87A878',
  Skills: '#E9C46A',
  'Care & Housing': '#588157',
  'Bio-Remedy': '#E76F51',
  'Electronics': '#6366F1',
};

/**
 * Cluster mesh peer nodes using proximity-based spatial clustering.
 * Clusters nearby peers to prevent visual clutter and improve rendering performance.
 *
 * @param rawPeers List of mesh nodes with calculated world coordinates
 * @param scale Current map zoom scale (transform.scale)
 * @param enabled Whether clustering is enabled
 * @param clusterThresholdPx Distance threshold in screen pixels (default 48px)
 */
export function clusterPeerNodes(
  rawPeers: RawPeerPosition[],
  scale: number,
  enabled: boolean = true,
  clusterThresholdPx: number = 48
): PeerCluster[] {
  if (rawPeers.length === 0) return [];

  if (!enabled) {
    return rawPeers.map((pp, idx) => ({
      id: `single-peer-${pp.peer.id || idx}`,
      x: pp.x,
      y: pp.y,
      peers: [pp.peer],
      count: 1,
      isCluster: false,
      singlePeer: pp.peer,
      distKm: pp.distKm,
      directCount: pp.peer.isDirect ? 1 : 0,
      relayedCount: pp.peer.isDirect ? 0 : 1,
      avgRssi: pp.peer.lastRssi,
      radiusWorld: 16 / scale,
    }));
  }

  // Calculate clustering threshold in world coordinate units
  // 5 units corresponds to exactly 50 meters, enforcing that nodes within 50m aggregate.
  // Uses visual threshold at lower zoom levels to prevent clutter.
  const thresholdWorld = Math.max(5, clusterThresholdPx / scale);
  const clusters: PeerCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < rawPeers.length; i++) {
    if (assigned.has(i)) continue;

    const base = rawPeers[i];
    const clusterItems: RawPeerPosition[] = [base];
    assigned.add(i);

    for (let j = i + 1; j < rawPeers.length; j++) {
      if (assigned.has(j)) continue;
      const candidate = rawPeers[j];
      const dist = Math.hypot(candidate.x - base.x, candidate.y - base.y);
      if (dist <= thresholdWorld) {
        clusterItems.push(candidate);
        assigned.add(j);
      }
    }

    let sumX = 0;
    let sumY = 0;
    let directCount = 0;
    let sumRssi = 0;
    const peersList: MeshNode[] = [];

    clusterItems.forEach((item) => {
      sumX += item.x;
      sumY += item.y;
      if (item.peer.isDirect) directCount++;
      sumRssi += item.peer.lastRssi;
      peersList.push(item.peer);
    });

    const isMulti = clusterItems.length > 1;
    const count = clusterItems.length;
    const avgRssi = Math.round(sumRssi / count);
    const baseVisualRadiusPx = isMulti ? Math.min(26, 16 + Math.log2(count) * 4) : 16;

    clusters.push({
      id: isMulti ? `peer-cluster-${i}-${count}` : `peer-${base.peer.id}`,
      x: isMulti ? sumX / count : base.x,
      y: isMulti ? sumY / count : base.y,
      peers: peersList,
      count,
      isCluster: isMulti,
      singlePeer: isMulti ? undefined : base.peer,
      distKm: isMulti ? undefined : base.distKm,
      directCount,
      relayedCount: count - directCount,
      avgRssi,
      radiusWorld: baseVisualRadiusPx / scale,
    });
  }

  return clusters;
}

/**
 * Cluster resource pins using proximity-based spatial clustering.
 * Prevents overlapping icons in dense mesh hubs and adapts dynamically to map zoom scale.
 * 
 * @param rawItems List of resource items with raw world coordinates
 * @param scale Current map zoom scale (transform.scale)
 * @param enabled Whether clustering is enabled
 * @param clusterThresholdPx Distance threshold in screen pixels (e.g. 40px)
 */
export function clusterResourcePins(
  rawItems: RawResourcePosition[],
  scale: number,
  enabled: boolean = true,
  clusterThresholdPx: number = 42
): ResourceCluster[] {
  if (rawItems.length === 0) return [];

  // When clustering is disabled, return every item individually with slight dispersion
  if (!enabled) {
    return rawItems.map((item, idx) => {
      const counts: Record<string, number> = { [item.resource.category]: 1 };
      return {
        id: `single-${item.resource.id || idx}`,
        x: item.x,
        y: item.y,
        resources: [item.resource],
        count: 1,
        categories: [item.resource.category],
        categoryCounts: counts,
        categoryColors: [item.color],
        dominantCategory: item.resource.category,
        dominantColor: item.color,
        isCluster: false,
        singleResource: item.resource,
        radiusWorld: 18 / scale,
      };
    });
  }

  // Calculate clustering threshold in world coordinate units
  // Zooming in (higher scale) reduces threshold in world space, causing clusters to naturally expand / decluster
  const thresholdWorld = Math.max(12, clusterThresholdPx / scale);

  const clusters: ResourceCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < rawItems.length; i++) {
    if (assigned.has(i)) continue;

    const base = rawItems[i];
    const clusterItems: RawResourcePosition[] = [base];
    assigned.add(i);

    // Find all unassigned neighboring items within threshold distance
    for (let j = i + 1; j < rawItems.length; j++) {
      if (assigned.has(j)) continue;

      const candidate = rawItems[j];
      const dist = Math.hypot(candidate.x - base.x, candidate.y - base.y);

      if (dist <= thresholdWorld) {
        clusterItems.push(candidate);
        assigned.add(j);
      }
    }

    // Compute cluster centroid
    let sumX = 0;
    let sumY = 0;
    const resources: ResourceItem[] = [];
    const catCounts: Record<string, number> = {};
    const catColorSet = new Set<string>();

    clusterItems.forEach((ci) => {
      sumX += ci.x;
      sumY += ci.y;
      resources.push(ci.resource);
      catCounts[ci.resource.category] = (catCounts[ci.resource.category] || 0) + 1;
      catColorSet.add(ci.color);
    });

    const centroidX = sumX / clusterItems.length;
    const centroidY = sumY / clusterItems.length;

    // Determine dominant category and categories present
    const categoriesPresent = Object.keys(catCounts) as ResourceCategory[];
    let maxCount = 0;
    let dominantCategory: ResourceCategory = base.resource.category;

    categoriesPresent.forEach((cat) => {
      if (catCounts[cat] > maxCount) {
        maxCount = catCounts[cat];
        dominantCategory = cat;
      }
    });

    const isMulti = clusterItems.length > 1;
    const dominantColor = CATEGORY_COLORS[dominantCategory] || '#2A9D8F';

    // Base visual radius in world units
    const baseVisualRadiusPx = isMulti ? Math.min(26, 16 + Math.log2(clusterItems.length) * 4) : 16;

    clusters.push({
      id: isMulti ? `cluster-${i}-${clusterItems.length}` : `res-${base.resource.id}`,
      x: isMulti ? centroidX : base.x,
      y: isMulti ? centroidY : base.y,
      resources,
      count: clusterItems.length,
      categories: categoriesPresent,
      categoryCounts: catCounts,
      categoryColors: Array.from(catColorSet),
      dominantCategory,
      dominantColor,
      isCluster: isMulti,
      singleResource: isMulti ? undefined : base.resource,
      radiusWorld: baseVisualRadiusPx / scale,
    });
  }

  return clusters;
}
