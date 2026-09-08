import { MapEngineState, initialMapEngineState, clusterSpatialItems } from './mapState';
import { detectMapCapabilities, MapQualityMode, MapRenderer } from './mapCapabilities';
import { MeshNode, ResourceItem, SurvivalPoi, WifiSpot } from '../../types';

export class MapController {
  private state: MapEngineState = { ...initialMapEngineState };
  private listeners: Set<(state: MapEngineState) => void> = new Set();
  private animFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private startTime = performance.now();

  constructor(batteryLevel?: number, isCharging?: boolean) {
    const caps = detectMapCapabilities(batteryLevel, isCharging);
    this.state.activeRenderer = caps.recommendedRenderer;
    this.state.qualityMode = caps.recommendedQuality;
    this.state.metrics.activeRenderer = caps.recommendedRenderer;
    this.state.metrics.timeToFirstRenderMs = Math.round(performance.now() - this.startTime);
  }

  public getState(): MapEngineState {
    return this.state;
  }

  public subscribe(listener: (state: MapEngineState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }

  public setQualityMode(mode: MapQualityMode) {
    this.state.qualityMode = mode;
    this.notify();
  }

  public setRenderer(renderer: MapRenderer) {
    this.state.activeRenderer = renderer;
    this.state.metrics.activeRenderer = renderer;
    this.notify();
  }

  public autoCheckBatterySaver(batteryLevel?: number, isCharging?: boolean) {
    if (batteryLevel !== undefined && batteryLevel < 0.20 && isCharging === false && this.state.qualityMode !== 'power_saver') {
      this.state.qualityMode = 'power_saver';
      this.state.autoDowngradedNotice = true;
      this.notify();
    }
  }

  public clearAutoDowngradeNotice() {
    this.state.autoDowngradedNotice = false;
    this.notify();
  }

  public toggleLayer(layerKey: keyof MapEngineState['layers']) {
    this.state.layers[layerKey] = !this.state.layers[layerKey];
    this.notify();
  }

  public updateViewport(centerLat: number, centerLng: number, zoom: number) {
    this.state.centerLat = centerLat;
    this.state.centerLng = centerLng;
    this.state.zoom = zoom;

    // Recalculate bounds
    const latSpan = 0.1 / Math.pow(2, zoom - 10);
    const lngSpan = 0.1 / Math.pow(2, zoom - 10);
    this.state.bounds = {
      minLat: centerLat - latSpan / 2,
      maxLat: centerLat + latSpan / 2,
      minLng: centerLng - lngSpan / 2,
      maxLng: centerLng + lngSpan / 2,
    };
    this.notify();
  }

  public processSpatialData(
    peers: MeshNode[],
    resources: ResourceItem[]
  ) {
    const peerItems = peers.map((p) => ({
      ...p,
      lat: (p as any).lat ?? (59.437 + (p.distanceRatio || 0.1) * 0.01 * Math.cos(((p.angle || 0) * Math.PI) / 180)),
      lng: (p as any).lng ?? (24.7535 + (p.distanceRatio || 0.1) * 0.01 * Math.sin(((p.angle || 0) * Math.PI) / 180)),
    }));

    const resourceItems = resources.map((r) => ({
      ...r,
      lat: (r as any).lat ?? (59.437 + (r.coordinates?.y || 0) * 0.001),
      lng: (r as any).lng ?? (24.7535 + (r.coordinates?.x || 0) * 0.001),
    }));

    const peerClusters = clusterSpatialItems(peerItems, this.state.zoom, this.state.bounds);
    const resourceClusters = clusterSpatialItems(resourceItems, this.state.zoom, this.state.bounds);

    const totalVisible = peerClusters.visibleItems.length + resourceClusters.visibleItems.length;
    this.state.metrics.visibleMarkerCount = totalVisible;

    return {
      peers: peerClusters.visibleItems,
      peerClusters: peerClusters.clusters,
      resources: resourceClusters.visibleItems,
      resourceClusters: resourceClusters.clusters,
    };
  }

  public startRenderLoop(callback: () => void) {
    if (this.animFrameId) return;

    const loop = (time: number) => {
      const delta = time - this.lastFrameTime;
      this.lastFrameTime = time;

      // Throttle depending on quality mode
      const targetFps = this.state.qualityMode === 'power_saver' ? 20 : 60;
      const minInterval = 1000 / targetFps;

      if (delta >= minInterval) {
        this.frameCount++;
        this.state.metrics.frameTimeMs = Math.round(delta * 10) / 10;
        this.state.metrics.fps = Math.min(60, Math.round(1000 / delta));
        callback();
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public stopRenderLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
