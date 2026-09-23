/**
 * HÕIMU Map Pack Manager
 * Coordinates offline vector maps with synchronized routing graph topology
 */

import { MAP_PACK_MANIFESTS, MapPackManifest } from './MapPackManifest';
import { MapPackStatusService, MapPackStatusRecord } from './MapPackStatus';
import { MapPackInstaller } from './MapPackInstaller';

export class MapPackManager {
  private static instance: MapPackManager;
  private statusService = MapPackStatusService.getInstance();

  public static getInstance(): MapPackManager {
    if (!MapPackManager.instance) {
      MapPackManager.instance = new MapPackManager();
    }
    return MapPackManager.instance;
  }

  public getManifest(packId: string): MapPackManifest {
    return MAP_PACK_MANIFESTS[packId] || MAP_PACK_MANIFESTS.tallinn;
  }

  public getAllManifests(): MapPackManifest[] {
    return Object.values(MAP_PACK_MANIFESTS);
  }

  public getStatus(packId: string): MapPackStatusRecord {
    return this.statusService.getStatus(packId);
  }

  public getAllStatuses(): Record<string, MapPackStatusRecord> {
    return this.statusService.getAllStatuses();
  }

  public async installMapPack(
    packId: string,
    onProgress?: (progressPercent: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<boolean> {
    return MapPackInstaller.install(packId, onProgress);
  }

  public async removeMapPack(packId: string): Promise<boolean> {
    return MapPackInstaller.uninstall(packId);
  }

  public subscribe(listener: () => void): () => void {
    return this.statusService.subscribe(listener);
  }

  /**
   * Validates whether current routing graph matches the basemap snapshot
   */
  public isRoutingGraphSynchronized(cityId: string, routingSnapshotVersion: string): boolean {
    const manifest = this.getManifest(cityId);
    return manifest.routingSnapshotVersion === routingSnapshotVersion;
  }
}

export const mapPackManager = MapPackManager.getInstance();
