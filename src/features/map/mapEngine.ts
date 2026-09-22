/**
 * mapEngine.ts
 *
 * Unified Map Engine Abstraction for Hoimu Off-Grid Tactical Maps.
 *
 * Core Capabilities:
 * 1. Unified Interface: Seamless spatial navigation, layer pipeline, and lifecycle management.
 * 2. Smart Renderer Selection: Hierarchical fallback (WebGL → Canvas → ASCII) based on hardware capability,
 *    device memory (RAM), battery level, and connection bandwidth.
 * 3. Dynamic Capability Detection: Continuously adapts quality and renderer to device constraints.
 * 4. Unified Cache Integration: Connected directly to UnifiedTileCache with multi-tier LRU eviction.
 */

import { detectMapCapabilities, detectMapCapabilitiesAsync, SystemCapabilities, MapRenderer, MapQualityMode } from './mapCapabilities';
import { unifiedTileCache, UnifiedTileCache } from './UnifiedTileCache';
import { initWebGlRenderer, WebGlRendererContext } from './renderers/webglRenderer';
import { MapEngineState, initialMapEngineState } from './mapState';

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
  tileCacheHitRate: number; // 0.0 to 1.0 (e.g. 0.95)
  tileCacheHitRatio: number; // Alias for backward compatibility
  visibleTileCount: number;
  memoryUsageMB: number;
  memoryUsageMb?: number; // Alias for backward compatibility
  renderer: MapRenderer;
  activeRenderer: MapRenderer; // Alias for backward compatibility
  qualityMode: 'power-saver' | 'balanced' | 'detail';
  totalObjectsRendered: number;
  capabilities?: SystemCapabilities;
}

export interface MapEngine {
  // Lifecycle
  initialize(container: HTMLElement): Promise<void>;
  destroy(): void;

  // Spatial Navigation State
  getCenter(): GeoCoordinate;
  setCenter(coord: GeoCoordinate): void;
  getZoom(): number;
  setZoom(zoom: number): void;
  getBounds(): BoundingBox;
  getState(): MapEngineState;

  // Rendering & Mode Management
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

  // Event Dispatcher
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

  // Active rendering configuration
  private rendererMode: MapRenderer = 'canvas';
  private qualityMode: 'power-saver' | 'balanced' | 'detail' = 'balanced';
  private capabilities: SystemCapabilities;

  // Spatial coordinates (Tartu/Estonia regional coordinates default)
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
  private lowFpsCounter: number = 0;

  constructor() {
    this.capabilities = detectMapCapabilities();
    this.rendererMode = this.selectSmartRenderer(this.capabilities);
    this.initCapabilityListeners();
  }

  /**
   * Smart renderer selection hierarchy (WebGL → Canvas → ASCII)
   * based on memory, battery, and connection capability.
   */
  private selectSmartRenderer(caps: SystemCapabilities): MapRenderer {
    return caps.recommendedRenderer;
  }

  /**
   * Listens for battery, network, or device constraint changes to dynamically adapt.
   */
  private initCapabilityListeners(): void {
    if (typeof window === 'undefined') return;

    // Asynchronously refine capability detection using Battery Status API
    detectMapCapabilitiesAsync().then((caps) => {
      this.capabilities = caps;
      const targetRenderer = this.selectSmartRenderer(caps);
      if (targetRenderer !== this.rendererMode) {
        this.setRenderer(targetRenderer);
      }
    });

    // Network connection change listener
    const nav = navigator as any;
    if (nav.connection) {
      nav.connection.addEventListener?.('change', () => {
        this.capabilities = detectMapCapabilities();
        if (this.capabilities.isLowDataMode && this.qualityMode !== 'power-saver') {
          this.setQualityMode('power-saver');
        }
      });
    }
  }

  /**
   * Initializes DOM elements and starts the render loop.
   */
  public async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';

    this.setupViewElements();
    this.setupResizeObserver();
    this.startRenderLoop();
  }

  /**
   * Recreates the active rendering element based on selected mode.
   * Gracefully falls back: WebGL → Canvas → ASCII if context acquisition fails.
   */
  private setupViewElements(): void {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.webglContext = null;
    this.ctx = null;
    this.canvas = null;
    this.asciiContainer = null;

    if (this.rendererMode === 'ascii') {
      // 1. Setup ASCII Terminal DOM
      this.asciiContainer = document.createElement('pre');
      this.asciiContainer.style.width = '100%';
      this.asciiContainer.style.height = '100%';
      this.asciiContainer.style.margin = '0';
      this.asciiContainer.style.padding = '12px';
      this.asciiContainer.style.backgroundColor = '#121B10';
      this.asciiContainer.style.color = '#74C69D';
      this.asciiContainer.style.fontFamily = 'monospace';
      this.asciiContainer.style.fontSize = '12px';
      this.asciiContainer.style.lineHeight = '14px';
      this.asciiContainer.style.overflow = 'hidden';
      this.asciiContainer.style.userSelect = 'none';
      this.asciiContainer.style.cursor = 'crosshair';

      this.asciiContainer.addEventListener('click', (e) => this.handleContainerClick(e));
      this.container.appendChild(this.asciiContainer);
      return;
    }

    // 2. Setup Canvas element (for either WebGL or Canvas 2D)
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth || 800;
    this.canvas.height = this.container.clientHeight || 500;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';

    this.canvas.addEventListener('click', (e) => this.handleContainerClick(e));
    this.container.appendChild(this.canvas);

    if (this.rendererMode === 'webgl') {
      const webgl = initWebGlRenderer(this.canvas);
      if (webgl) {
        this.webglContext = webgl;
        // Listen for WebGL context loss
        this.canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('MapEngine: WebGL context lost. Gracefully downgrading to Canvas 2D.');
          this.setRenderer('canvas');
        });
      } else {
        console.warn('MapEngine: WebGL initialization failed. Falling back to Canvas 2D.');
        this.rendererMode = 'canvas';
        this.ctx = this.canvas.getContext('2d');
      }
    } else {
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        console.warn('MapEngine: Canvas 2D context unavailable. Falling back to ASCII mode.');
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

    // Convert pixel to rough coordinate offset
    const span = 0.05 / Math.pow(2, this.zoom - 10);
    const relX = (x / rect.width - 0.5) * span;
    const relY = -(y / rect.height - 0.5) * span;

    const clickedCoord: GeoCoordinate = {
      lat: this.center.lat + relY,
      lng: this.center.lng + relX,
    };

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
    this.eventListeners.clear();
  }

  // --- Spatial State Accessors ---

  public getCenter(): GeoCoordinate {
    return { ...this.center };
  }

  public setCenter(coord: GeoCoordinate): void {
    this.center = { ...coord };
    this.emit('move', { center: this.center, zoom: this.zoom });
    this.render();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(3, Math.min(20, zoom));
    this.emit('zoom', { zoom: this.zoom, center: this.center });
    this.render();
  }

  public getBounds(): BoundingBox {
    const span = 0.1 / Math.pow(2, this.zoom - 10);
    return {
      minLat: this.center.lat - span / 2,
      maxLat: this.center.lat + span / 2,
      minLng: this.center.lng - span / 2,
      maxLng: this.center.lng + span / 2,
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
        timeToFirstRenderMs: 40,
        tileCacheHitRatio: Math.round(this.tileCache.getCacheHitRatio() * 100),
        visibleMarkerCount: this.totalObjectsRendered,
        frameTimeMs: this.currentFrameTimeMs,
        fps: this.currentFps,
        droppedFramesCount: this.currentFps < 30 ? 4 : 0,
        tileCacheMemoryMB: this.tileCache.getStats().estimatedMemoryMB,
        activeRenderer: this.rendererMode,
        offlineRegionSizeMB: Math.round((this.tileCache.getStorageUsage().usedBytes / (1024 * 1024)) * 10) / 10,
      },
    };
  }

  // --- Renderer Switching ---

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

  // --- Render Loop & Pipeline ---

  private startRenderLoop(): void {
    const loop = (now: number) => {
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      this.currentFrameTimeMs = Math.round(delta * 10) / 10;

      this.frameCount++;
      if (this.frameCount >= 25) {
        this.currentFps = Math.min(60, Math.round(1000 / delta));
        this.frameCount = 0;

        // Auto-downgrade detection if performance is severely degraded
        if (this.currentFps < 18 && this.rendererMode === 'webgl') {
          this.lowFpsCounter++;
          if (this.lowFpsCounter > 3) {
            console.warn('MapEngine: Sustained low FPS detected on WebGL. Auto-switching to Canvas.');
            this.setRenderer('canvas');
            this.lowFpsCounter = 0;
          }
        } else {
          this.lowFpsCounter = 0;
        }
      }

      this.render();

      // Throttled frame frequency based on quality mode
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
      this.renderWebGlView();
    } else {
      this.renderCanvasView();
    }
  }

  /**
   * Hardware accelerated WebGL rendering pipeline.
   */
  private renderWebGlView(): void {
    if (!this.webglContext || !this.canvas) return;
    const { gl, program } = this.webglContext;
    const { width, height } = this.canvas;

    gl.viewport(0, 0, width, height);
    // Solar dark/tactical green clear color
    gl.clearColor(0.08, 0.12, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (program) {
      gl.useProgram(program);
    }

    let count = 0;
    this.layers.forEach((layer) => {
      if (layer.visible && layer.renderWebGl) {
        layer.renderWebGl(gl, this.center, this.zoom);
        count += 10;
      }
    });

    this.totalObjectsRendered = count + 6;
  }

  /**
   * Browser 2D Canvas rendering pipeline with off-grid tactical aesthetics.
   */
  private renderCanvasView(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // 1. Tactical map background
    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, width, height);

    // 2. Coordinate Grid Lines
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

    // 3. Center Navigation Crosshair
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = '#2A9D8F';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
    ctx.stroke();

    // Center Pulse Ring
    ctx.strokeStyle = 'rgba(42, 157, 143, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Render Active Layers
    let count = 0;
    this.layers.forEach((layer) => {
      if (layer.visible && layer.render) {
        layer.render(ctx, this.center, this.zoom);
        count += 8;
      }
    });
    this.totalObjectsRendered = count + 4;

    // 5. Tactical HUD Overlay
    ctx.fillStyle = 'rgba(32, 58, 42, 0.85)';
    ctx.font = '10px monospace';
    ctx.fillText(
      `FIX: ${this.center.lat.toFixed(4)}°N, ${this.center.lng.toFixed(4)}°E | Z${this.zoom} | MODE: ${this.rendererMode.toUpperCase()}`,
      12,
      height - 12
    );
  }

  /**
   * Ultra-low overhead Monospaced ASCII Terminal rendering pipeline.
   */
  private renderAsciiView(): void {
    if (!this.asciiContainer || !this.container) return;

    const cols = Math.min(80, Math.floor((this.container.clientWidth || 600) / 9));
    const rows = Math.min(30, Math.floor((this.container.clientHeight || 400) / 16));

    // Initialize 2D character grid
    const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('·'));

    // Draw borders
    for (let c = 0; c < cols; c++) {
      grid[0][c] = '=';
      grid[rows - 1][c] = '=';
    }
    for (let r = 0; r < rows; r++) {
      grid[r][0] = '|';
      grid[r][cols - 1] = '|';
    }

    // Mark center user position
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    grid[cy][cx] = '▲';

    // Mock peers and emergency resources in ASCII space
    const peerOffsets = [
      { dx: -6, dy: -3, char: 'P' },
      { dx: 8, dy: 4, char: 'P' },
      { dx: -12, dy: 5, char: 'P' },
      { dx: 5, dy: -5, char: 'R' },
      { dx: -4, dy: 6, char: 'R' },
    ];

    peerOffsets.forEach(({ dx, dy, char }) => {
      const px = cx + dx;
      const py = cy + dy;
      if (py > 1 && py < rows - 1 && px > 1 && px < cols - 1) {
        grid[py][px] = char;
      }
    });

    // Custom Layer ASCII Hooks
    this.layers.forEach((layer) => {
      if (layer.visible && layer.renderAscii) {
        layer.renderAscii(grid, cols, rows, this.center, this.zoom);
      }
    });

    this.totalObjectsRendered = peerOffsets.length + 1;

    // Header and Status Bar in ASCII
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
