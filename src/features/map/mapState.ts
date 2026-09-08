import { MapRenderer, MapQualityMode } from './mapCapabilities';
import { MeshNode, ResourceItem, SurvivalPoi, WifiSpot } from '../../types';

export interface SpatialGridCluster<T> {
  id: string;
  gridX: number;
  gridY: number;
  count: number;
  items: T[];
  centerLat: number;
  centerLng: number;
}

export interface MapPerformanceMetrics {
  timeToFirstRenderMs: number;
  tileCacheHitRatio: number; // 0..100
  visibleMarkerCount: number;
  frameTimeMs: number;
  fps: number;
  droppedFramesCount: number;
  tileCacheMemoryMB: number;
  activeRenderer: MapRenderer;
  offlineRegionSizeMB: number;
}

export interface MapEngineState {
  // Quality & Renderer
  qualityMode: MapQualityMode;
  activeRenderer: MapRenderer;
  autoDowngradedNotice: boolean;

  // Viewport / Camera
  zoom: number;
  centerLat: number;
  centerLng: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };

  // Layer Visibilities
  layers: {
    baseMap: boolean;
    offlineTiles: boolean;
    peers: boolean;
    resources: boolean;
    safety: boolean;
    scans: boolean;
  };

  // Performance Metrics
  metrics: MapPerformanceMetrics;
}

export const initialMapEngineState: MapEngineState = {
  qualityMode: 'balanced',
  activeRenderer: 'canvas',
  autoDowngradedNotice: false,
  zoom: 14,
  centerLat: 59.437,
  centerLng: 24.7535,
  bounds: {
    minLat: 59.42,
    maxLat: 59.45,
    minLng: 24.73,
    maxLng: 24.78,
  },
  layers: {
    baseMap: true,
    offlineTiles: true,
    peers: true,
    resources: true,
    safety: true,
    scans: true,
  },
  metrics: {
    timeToFirstRenderMs: 0,
    tileCacheHitRatio: 88,
    visibleMarkerCount: 0,
    frameTimeMs: 16.6,
    fps: 60,
    droppedFramesCount: 0,
    tileCacheMemoryMB: 12.4,
    activeRenderer: 'canvas',
    offlineRegionSizeMB: 24.8,
  },
};

/**
 * Spatial Grid Clustering Utility
 * Groups items into a grid based on latitude/longitude bins for rapid high-performance rendering.
 */
export function clusterSpatialItems<T extends { lat: number; lng: number; id: string }>(
  items: T[],
  zoom: number,
  bounds: MapEngineState['bounds']
): { visibleItems: T[]; clusters: SpatialGridCluster<T>[] } {
  // Filter visible items inside bounds plus 10% safety buffer
  const latBuffer = (bounds.maxLat - bounds.minLat) * 0.1;
  const lngBuffer = (bounds.maxLng - bounds.minLng) * 0.1;

  const inBounds = items.filter(
    (item) =>
      item.lat >= bounds.minLat - latBuffer &&
      item.lat <= bounds.maxLat + latBuffer &&
      item.lng >= bounds.minLng - lngBuffer &&
      item.lng <= bounds.maxLng + lngBuffer
  );

  // If item count < 50, do not cluster — show all individual markers
  if (inBounds.length < 50) {
    return { visibleItems: inBounds, clusters: [] };
  }

  // Calculate grid cellSize based on zoom level
  const gridSize = Math.max(0.005, 0.2 / Math.pow(2, zoom - 8));
  const gridMap = new Map<string, SpatialGridCluster<T>>();

  inBounds.forEach((item) => {
    const gridX = Math.floor(item.lng / gridSize);
    const gridY = Math.floor(item.lat / gridSize);
    const key = `${gridX}_${gridY}`;

    const existing = gridMap.get(key);
    if (!existing) {
      gridMap.set(key, {
        id: `cluster_${key}`,
        gridX,
        gridY,
        count: 1,
        items: [item],
        centerLat: item.lat,
        centerLng: item.lng,
      });
    } else {
      existing.items.push(item);
      existing.count += 1;
      // Recalculate running average center
      existing.centerLat = (existing.centerLat * (existing.count - 1) + item.lat) / existing.count;
      existing.centerLng = (existing.centerLng * (existing.count - 1) + item.lng) / existing.count;
    }
  });

  const clusters: SpatialGridCluster<T>[] = [];
  const unclusteredItems: T[] = [];

  gridMap.forEach((cluster) => {
    if (cluster.count >= 3 && zoom < 16) {
      clusters.push(cluster);
    } else {
      unclusteredItems.push(...cluster.items);
    }
  });

  return { visibleItems: unclusteredItems, clusters };
}
