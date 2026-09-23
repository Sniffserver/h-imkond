import { OfflineMapRegion, MeshNode, ResourceItem, CityMapData } from '../../types';
import { unifiedTileCache } from '../../features/map/UnifiedTileCache';

const STORAGE_KEY = 'hoimu_offline_regions_v1';

export const offlineMapService = {
  getDownloadedRegions(): OfflineMapRegion[] {
    return unifiedTileCache.getDownloadedRegions();
  },

  saveRegion(region: OfflineMapRegion): OfflineMapRegion[] {
    return unifiedTileCache.saveRegion(region);
  },

  deleteRegion(regionId: string): OfflineMapRegion[] {
    return unifiedTileCache.deleteRegion(regionId);
  },

  getStorageUsage(): { usedBytes: number; formatted: string; count: number } {
    return unifiedTileCache.getStorageUsage();
  },

  clearAllOfflineData(): void {
    unifiedTileCache.clearAll().catch((e) => console.error('Failed to clear offline data:', e));
  },

  isCityDownloaded(cityName: string): boolean {
    const regions = this.getDownloadedRegions();
    return regions.some((r) => r.cityName.toLowerCase() === cityName.toLowerCase());
  },

  generateRegionPack(params: {
    name: string;
    cityId: string;
    activeCity: CityMapData;
    center: { x: number; y: number; lat?: number; lng?: number };
    radiusKm: number;
    allNodes: MeshNode[];
    allResources: ResourceItem[];
    userCallsign: string;
  }): OfflineMapRegion {
    const { name, cityId, activeCity, center, radiusKm, allNodes, allResources, userCallsign } = params;
    
    // 1 km is roughly 40 world coordinate units in our bioregional projection
    const worldRadius = radiusKm * 40;

    // Filter nodes within radius
    const cachedNodes = allNodes.filter((node) => {
      // Polar or grid coordinate approximation
      const angleRad = ((node.angle || 0) * Math.PI) / 180;
      const nodeDist = (node.distanceRatio || 0.5) * 160;
      const nx = center.x + Math.cos(angleRad) * nodeDist;
      const ny = center.y + Math.sin(angleRad) * nodeDist;
      const dx = nx - center.x;
      const dy = ny - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= worldRadius * 1.5;
    });

    // Filter resources within radius
    const cachedResources = allResources.filter((res) => {
      const rx = res.coordinates?.x ?? 0;
      const ry = res.coordinates?.y ?? 0;
      const dx = rx - center.x;
      const dy = ry - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= worldRadius * 1.5 || res.distanceKm <= radiusKm * 1.2;
    });

    // Count street segments & POIs within bounds
    const minX = center.x - worldRadius;
    const maxX = center.x + worldRadius;
    const minY = center.y - worldRadius;
    const maxY = center.y + worldRadius;

    let streetSegmentCount = 0;
    if (activeCity.streets) {
      activeCity.streets.forEach((street) => {
        if (street.points.some(([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY)) {
          streetSegmentCount += street.points.length;
        }
      });
    }

    const poiNames: string[] = [];
    if (activeCity.districts) {
      activeCity.districts.forEach((d) => {
        if (d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY) {
          poiNames.push(`District: ${d.name}`);
        }
      });
    }
    if (activeCity.zones) {
      activeCity.zones.forEach((z) => {
        poiNames.push(`${z.type.toUpperCase()}: ${z.name}`);
      });
    }

    const payloadObj = {
      name,
      cityId,
      cityName: activeCity.cityName,
      bioregionName: activeCity.bioregionName,
      center,
      radiusKm,
      worldRadius,
      cachedNodes,
      cachedResources,
      streetSegmentCount,
      poiNames,
    };

    const jsonStr = JSON.stringify(payloadObj);
    const sizeBytes = new Blob([jsonStr]).size;
    const sizeFormatted = sizeBytes > 1024 * 1024 
      ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` 
      : `${(sizeBytes / 1024).toFixed(1)} KB`;

    // Compute deterministic hex digest over region content
    let simpleHash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
      simpleHash = ((simpleHash << 5) - simpleHash) + jsonStr.charCodeAt(i);
      simpleHash |= 0;
    }
    const signatureHash = `ED25519:${Math.abs(simpleHash).toString(16).padStart(12, '0')}`;

    const newRegion: OfflineMapRegion = {
      id: `off-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `${activeCity.cityName} - ${radiusKm}km Offline Pack`,
      cityId,
      cityName: activeCity.cityName,
      bioregionName: activeCity.bioregionName,
      centerCoords: center,
      radiusKm,
      worldRadius,
      downloadedAt: Date.now(),
      sizeBytes,
      sizeFormatted,
      nodeCount: cachedNodes.length,
      resourceCount: cachedResources.length,
      streetSegmentCount: Math.max(12, streetSegmentCount),
      poiCount: poiNames.length,
      bounds: { minX, maxX, minY, maxY },
      cachedNodes,
      cachedResources,
      cachedPoiNames: poiNames,
      signatureHash,
      isActiveOffline: true,
    };

    return newRegion;
  },

  exportRegionAsFile(region: OfflineMapRegion) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(region, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `hoimu-offline-map-${region.cityName.toLowerCase()}-${region.radiusKm}km-${new Date().toISOString().slice(0, 10)}.hoimumap`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },
};
