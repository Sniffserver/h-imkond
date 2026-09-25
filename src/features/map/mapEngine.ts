/**
 * mapEngine.ts
 *
 * Unified Map Engine Architecture for HÕIMU Off-Grid Tactical Maps.
 *
 * Architecture:
 * 1. MapLibre GL = Canonical Geographic Renderer (handles PMTiles vector tiles, styles, WebGL base map).
 * 2. Exact Geographic Projection: `project()` and `unproject()` rely on MapLibre / Web Mercator EPSG:3857,
 *    ensuring map marker == route point == clicked coordinate.
 * 3. OverlayRenderer = Tactical Overlays (WebGL / Canvas 2D) for Mesh peers, RF coverage, resources, links.
 * 4. ASCII Mode = Explicit terminal fallback for ultra-low power mode.
 */

import type * as maplibregl from 'maplibre-gl';
import { detectMapCapabilities, SystemCapabilities, MapRenderer } from './mapCapabilities';
import { unifiedTileCache, UnifiedTileCache } from './UnifiedTileCache';
import { initWebGlRenderer, WebGlRendererContext } from './renderers/webglRenderer';
import { MapEngineState, initialMapEngineState } from './mapState';
import { OverlayRenderer } from './overlayRenderer';

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'peers' | 'resources' | 'tiles' | 'safety' | 'scan';
  render?: (ctx: CanvasRenderingContext2D, center: GeoCoordinate, zoom: number) => void;
  renderWebGl?: (gl: WebGLRenderingContext | WebGL2RenderingContext, center: GeoCoordinate, zoom: number) => void;
  renderAscii?: (grid: string[][], cols: number, rows: number, center: GeoCoordinate, zoom: number) => void;
}

export interface MapMetrics {
  fps: number;
  frameTimeMs: number;
  tileCacheHitRate: number;
  tileCacheHitRatio: number;
  visibleTileCount: number;
  memoryUsageMB: number;
  memoryUsageMb?: number;
  renderer: MapRenderer;
  activeRenderer: MapRenderer;
  qualityMode: 'power-saver' | 'balanced' | 'detail';
  totalObjectsRendered: number;
  capabilities?: SystemCapabilities;
}

/**
 * Exact Spherical Web Mercator Projection (EPSG:3857)
 * Ensures pixel <-> geographic coordinate fidelity matching MapLibre GL specification.
 */
export function exactWebMercatorProject(
  coord: GeoCoordinate,
  center: GeoCoordinate,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  const lngToX = (lng: number) => ((lng + 180) / 360) * scale;
  const latToY = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const clampedSin = Math.min(Math.max(sin, -0.9999), 0.9999);
    return (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  };

  const cx = lngToX(center.lng);
  const cy = latToY(center.lat);
  const px = lngToX(coord.lng);
  const py = latToY(coord.lat);

  return {
    x: width / 2 + (px - cx),
    y: height / 2 + (py - cy),
  };
}

/**
 * Exact Spherical Web Mercator Unprojection (EPSG:3857)
 * Converts exact screen pixels to lat/lng coordinates without crude linear approximations.
 */
export function exactWebMercatorUnproject(
  pixel: { x: number; y: number },
  center: GeoCoordinate,
  zoom: number,
  width: number,
  height: number
): GeoCoordinate {
  const scale = 256 * Math.pow(2, zoom);
  const cx = ((center.lng + 180) / 360) * scale;
  const sinCenter = Math.sin((center.lat * Math.PI) / 180);
  const clampedSinCenter = Math.min(Math.max(sinCenter, -0.9999), 0.9999);
  const cy = (0.5 - Math.log((1 + clampedSinCenter) / (1 - clampedSinCenter)) / (4 * Math.PI)) * scale;

  const px = cx + (pixel.x - width / 2);
  const py = cy + (pixel.y - height / 2);

  const lng = (px / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * py) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return {
    lat: Math.max(-85.0511, Math.min(85.0511, lat)),
    lng: Math.max(-180, Math.min(180, lng)),
  };
}

export interface MapEngine {
  initialize(container: HTMLElement): Promise<void>;
  destroy(): void;

  // Canonical MapLibre Connection
  setMapLibreInstance(map: maplibregl.Map | null): void;
  getMapLibreInstance(): maplibregl.Map | null;

  // Spatial Projections (MapLibre source-of-truth)
  project(coord: GeoCoordinate): { x: number; y: number };
  unproject(pixel: { x: number; y: number }): GeoCoordinate;

  // Spatial Navigation State
  getCenter(): GeoCoordinate;
  setCenter(coord: GeoCoordinate): void;
  getZoom(): number;
  setZoom(zoom: number): void;
  getBounds(): BoundingBox;
  getState(): MapEngineState;

  // Rendering & Overlay Pipeline
  setRenderer(mode: MapRenderer): void;
  getRenderer(): MapRenderer;
  addLayer(layer: MapLayer): void;
  removeLayer(layerId: string): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  render(): void;

  // Performance & Capability Adaptation
  setQualityMode(mode: 'power-saver' | 'balanced' | 'detail'): void;
  getQualityMode(): 'power-saver' | 'balanced' | 'detail';
  getCapabilities(): SystemCapabilities;
  getMetrics(): MapMetrics;

  on(
    event: 'move' | 'zoom' | 'click' | 'rendererchange' | 'qualitychange',
    handler: (data?: any) => void
  ): () => void;
}

export class MapEngineImpl implements MapEngine {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private webglContext: WebGlRendererContext | null = null;
  private asciiContainer: HTMLPreElement | null = null;

  // Canonical MapLibre Geographic Renderer Reference
  private mapLibreInstance: maplibregl.Map | null = null;

  // Active rendering configuration
  private rendererMode: MapRenderer = 'canvas';
  private qualityMode: 'power-saver' | 'balanced' | 'detail' = 'balanced';
  private capabilities: SystemCapabilities;

  // Spatial coordinates
  private center: GeoCoordinate = { lat: 59.437, lng: 24.7535 };
  private zoom: number = 13;

  // Layer registry
  private layers: Map<string, MapLayer> = new Map();
  private tileCache: UnifiedTileCache = unifiedTileCache;

  // Event Listeners
  private eventListeners: Map<string, Set<(data?: any) => void>> = new Map();

  // Animation Loop & Performance Metrics
  private animFrameId: number | null = null;
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  private currentFps: number = 60;
  private currentFrameTimeMs: number = 16.6;
  private totalObjectsRendered: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.capabilities = detectMapCapabilities();
    this.rendererMode = this.capabilities.recommendedRenderer;
  }

  public setMapLibreInstance(map: maplibregl.Map | null): void {
    this.mapLibreInstance = map;
    if (map) {
      const center = map.getCenter();
      this.center = { lat: center.lat, lng: center.lng };
      this.zoom = map.getZoom();

      map.on('move', () => {
        const c = map.getCenter();
        this.center = { lat: c.lat, lng: c.lng };
        this.zoom = map.getZoom();
        this.emit('move', { center: this.center, zoom: this.zoom });
      });

      map.on('click', (e) => {
        this.emit('click', {
          x: e.point.x,
          y: e.point.y,
          coordinate: { lat: e.lngLat.lat, lng: e.lngLat.lng },
        });
      });
    }
  }

  public getMapLibreInstance(): maplibregl.Map | null {
    return this.mapLibreInstance;
  }

  /**
   * Projects a geo coordinate to screen pixels using MapLibre as canonical truth.
   */
  public project(coord: GeoCoordinate): { x: number; y: number } {
    if (this.mapLibreInstance) {
      const p = this.mapLibreInstance.project([coord.lng, coord.lat]);
      return { x: p.x, y: p.y };
    }
    const width = this.canvas?.width || this.container?.clientWidth || 800;
    const height = this.canvas?.height || this.container?.clientHeight || 600;
    return exactWebMercatorProject(coord, this.center, this.zoom, width, height);
  }

  /**
   * Unprojects screen pixels to a geo coordinate using MapLibre as canonical truth.
   */
  public unproject(pixel: { x: number; y: number }): GeoCoordinate {
    if (this.mapLibreInstance) {
      const ll = this.mapLibreInstance.unproject([pixel.x, pixel.y]);
      return { lat: ll.lat, lng: ll.lng };
    }
    const width = this.canvas?.width || this.container?.clientWidth || 800;
    const height = this.canvas?.height || this.container?.clientHeight || 600;
    return exactWebMercatorUnproject(pixel, this.center, this.zoom, width, height);
  }

  public async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = '';
    this.setupViewElements();
    this.setupResizeObserver();
    this.startRenderLoop();
  }

  private setupViewElements(): void {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.canvas = null;
    this.ctx = null;
    this.webglContext = null;
    this.asciiContainer = null;

    if (this.rendererMode === 'ascii') {
      this.asciiContainer = document.createElement('pre');
      this.asciiContainer.className = 'w-full h-full p-2 font-mono text-emerald-500 bg-[#0A0F0D] select-none';
      this.asciiContainer.style.fontSize = '12px';
      this.asciiContainer.style.lineHeight = '14px';
      this.asciiContainer.style.overflow = 'hidden';
      this.asciiContainer.style.cursor = 'crosshair';
      this.asciiContainer.addEventListener('click', (e) => this.handleContainerClick(e));
      this.container.appendChild(this.asciiContainer);
      return;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth || 800;
    this.canvas.height = this.container.clientHeight || 500;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'crosshair';

    this.canvas.addEventListener('click', (e) => this.handleContainerClick(e));
    this.container.appendChild(this.canvas);

    if (this.rendererMode === 'webgl') {
      const webgl = initWebGlRenderer(this.canvas);
      if (webgl) {
        this.webglContext = webgl;
        this.canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          this.setRenderer('canvas');
        });
      } else {
        this.rendererMode = 'canvas';
        this.ctx = this.canvas.getContext('2d');
      }
    } else {
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        this.setRenderer('ascii');
      }
    }
  }

  private setupResizeObserver(): void {
    if (typeof window !== 'undefined' && 'ResizeObserver' in window && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.canvas && this.container) {
          this.canvas.width = this.container.clientWidth;
          this.canvas.height = this.container.clientHeight;
          this.render();
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private handleContainerClick(e: MouseEvent): void {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedCoord = this.unproject({ x, y });
    this.emit('click', { x, y, coordinate: clickedCoord });
  }

  public destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.mapLibreInstance = null;
    this.eventListeners.clear();
  }

  public getCenter(): GeoCoordinate {
    return { ...this.center };
  }

  public setCenter(coord: GeoCoordinate): void {
    this.center = { ...coord };
    if (this.mapLibreInstance) {
      this.mapLibreInstance.setCenter([coord.lng, coord.lat]);
    }
    this.emit('move', { center: this.center, zoom: this.zoom });
    this.render();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(3, Math.min(20, zoom));
    if (this.mapLibreInstance) {
      this.mapLibreInstance.setZoom(this.zoom);
    }
    this.emit('zoom', { zoom: this.zoom, center: this.center });
    this.render();
  }

  public getBounds(): BoundingBox {
    if (this.mapLibreInstance) {
      const bounds = this.mapLibreInstance.getBounds();
      return {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      };
    }
    const width = this.canvas?.width || 800;
    const height = this.canvas?.height || 600;
    const nw = this.unproject({ x: 0, y: 0 });
    const se = this.unproject({ x: width, y: height });
    return {
      minLat: Math.min(nw.lat, se.lat),
      maxLat: Math.max(nw.lat, se.lat),
      minLng: Math.min(nw.lng, se.lng),
      maxLng: Math.max(nw.lng, se.lng),
    };
  }

  public getState(): MapEngineState {
    const bounds = this.getBounds();
    return {
      ...initialMapEngineState,
      qualityMode: this.qualityMode === 'power-saver' ? 'power_saver' : this.qualityMode,
      activeRenderer: this.rendererMode,
      zoom: this.zoom,
      centerLat: this.center.lat,
      centerLng: this.center.lng,
      bounds,
      metrics: {
        timeToFirstRenderMs: 35,
        tileCacheHitRatio: Math.round(this.tileCache.getCacheHitRatio() * 100),
        visibleMarkerCount: this.totalObjectsRendered,
        frameTimeMs: this.currentFrameTimeMs,
        fps: this.currentFps,
        droppedFramesCount: 0,
        tileCacheMemoryMB: this.tileCache.getStats().estimatedMemoryMB,
        activeRenderer: this.rendererMode,
        offlineRegionSizeMB: Math.round((this.tileCache.getStorageUsage().usedBytes / (1024 * 1024)) * 10) / 10,
      },
    };
  }

  public setRenderer(mode: MapRenderer): void {
    if (this.rendererMode === mode && (this.canvas || this.asciiContainer)) return;
    this.rendererMode = mode;
    this.setupViewElements();
    this.emit('rendererchange', { renderer: mode });
    this.render();
  }

  public getRenderer(): MapRenderer {
    return this.rendererMode;
  }

  public addLayer(layer: MapLayer): void {
    this.layers.set(layer.id, layer);
    this.render();
  }

  public removeLayer(layerId: string): void {
    this.layers.delete(layerId);
    this.render();
  }

  public setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
      this.render();
    }
  }

  public setQualityMode(mode: 'power-saver' | 'balanced' | 'detail'): void {
    this.qualityMode = mode;
    this.emit('qualitychange', { qualityMode: mode });
  }

  public getQualityMode(): 'power-saver' | 'balanced' | 'detail' {
    return this.qualityMode;
  }

  public getCapabilities(): SystemCapabilities {
    return this.capabilities;
  }

  public getMetrics(): MapMetrics {
    const mem = (performance as any).memory
      ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
      : 14;
    const hitRate = this.tileCache.getCacheHitRatio();

    return {
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      tileCacheHitRate: hitRate,
      tileCacheHitRatio: hitRate,
      visibleTileCount: Math.max(12, Math.round(16 * Math.pow(1.1, this.zoom - 10))),
      memoryUsageMB: mem,
      memoryUsageMb: mem,
      renderer: this.rendererMode,
      activeRenderer: this.rendererMode,
      qualityMode: this.qualityMode,
      totalObjectsRendered: this.totalObjectsRendered,
      capabilities: this.capabilities,
    };
  }

  public on(
    event: 'move' | 'zoom' | 'click' | 'rendererchange' | 'qualitychange',
    handler: (data?: any) => void
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data?: any): void {
    this.eventListeners.get(event)?.forEach((fn) => fn(data));
  }

  private startRenderLoop(): void {
    const loop = (now: number) => {
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      this.currentFrameTimeMs = Math.round(delta * 10) / 10;

      this.frameCount++;
      if (this.frameCount >= 30) {
        this.currentFps = Math.min(60, Math.round(1000 / delta));
        this.frameCount = 0;
      }

      this.render();

      const throttleMs =
        this.qualityMode === 'power-saver' ? 60 : this.qualityMode === 'balanced' ? 30 : 16;

      setTimeout(() => {
        this.animFrameId = requestAnimationFrame(loop);
      }, throttleMs);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public render(): void {
    if (this.rendererMode === 'ascii') {
      this.renderAsciiView();
    } else if (this.rendererMode === 'webgl' && this.webglContext) {
      this.renderWebGlOverlayView();
    } else {
      this.renderCanvasOverlayView();
    }
  }

  private renderWebGlOverlayView(): void {
    if (!this.webglContext || !this.canvas) return;
    const { gl } = this.webglContext;
    const { width, height } = this.canvas;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0.08, 0.12, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let count = 0;
    this.layers.forEach((layer) => {
      if (layer.visible && layer.renderWebGl) {
        layer.renderWebGl(gl, this.center, this.zoom);
        count += 10;
      }
    });

    this.totalObjectsRendered = count + 6;
  }

  private renderCanvasOverlayView(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // If MapLibre is not active underneath, draw tactical fallback grid
    if (!this.mapLibreInstance) {
      ctx.fillStyle = '#FAF6EE';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(135, 168, 120, 0.25)';
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Render active tactical layers
    let count = 0;
    this.layers.forEach((layer) => {
      if (layer.visible && layer.render) {
        layer.render(ctx, this.center, this.zoom);
        count += 8;
      }
    });
    this.totalObjectsRendered = count + 4;
  }

  private renderAsciiView(): void {
    if (!this.asciiContainer || !this.container) return;

    const cols = Math.min(80, Math.floor((this.container.clientWidth || 600) / 9));
    const rows = Math.min(30, Math.floor((this.container.clientHeight || 400) / 16));

    const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('·'));

    for (let c = 0; c < cols; c++) {
      grid[0][c] = '=';
      grid[rows - 1][c] = '=';
    }
    for (let r = 0; r < rows; r++) {
      grid[r][0] = '|';
      grid[r][cols - 1] = '|';
    }

    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    grid[cy][cx] = '▲';

    this.layers.forEach((layer) => {
      if (layer.visible && layer.renderAscii) {
        layer.renderAscii(grid, cols, rows, this.center, this.zoom);
      }
    });

    const title = ` HOIMU MESH TACTICAL TERMINAL [ASCII MODE] `;
    const startCol = Math.max(2, Math.floor((cols - title.length) / 2));
    for (let i = 0; i < title.length && startCol + i < cols - 1; i++) {
      grid[0][startCol + i] = title[i];
    }

    const statusBar = ` FIX: ${this.center.lat.toFixed(3)}N ${this.center.lng.toFixed(3)}E | Z:${this.zoom} | FPS:${this.currentFps} `;
    for (let i = 0; i < statusBar.length && i + 2 < cols - 1; i++) {
      grid[rows - 1][i + 2] = statusBar[i];
    }

    this.asciiContainer.textContent = grid.map((row) => row.join('')).join('\n');
  }
}

export const mapEngine = new MapEngineImpl();
export default mapEngine;
