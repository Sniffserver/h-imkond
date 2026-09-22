/**
 * mapCapabilities.ts
 *
 * Unified capability detection for map engine and graphics pipelines.
 * Analyzes hardware memory, battery level, network connection constraints,
 * and graphics APIs (WebGL2, WebGL, Canvas 2D) to recommend optimal renderers
 * (WebGL → Canvas → ASCII) and quality modes.
 */

export type MapRenderer = 'webgl' | 'canvas' | 'ascii';

export type MapQualityMode = 'power_saver' | 'balanced' | 'detail';

export interface SystemCapabilities {
  hasWebGL: boolean;
  hasWebGL2: boolean;
  hasCanvas2D: boolean;
  deviceMemoryGB: number;
  hardwareConcurrency: number;
  isLowDataMode: boolean;
  effectiveConnectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  isLowBattery: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
  recommendedQuality: MapQualityMode;
  recommendedRenderer: MapRenderer;
}

/**
 * Synchronously analyzes system capabilities with optional pre-fetched battery status.
 */
export function detectMapCapabilities(batteryLevel?: number, isCharging?: boolean): SystemCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasWebGL: false,
      hasWebGL2: false,
      hasCanvas2D: true,
      deviceMemoryGB: 4,
      hardwareConcurrency: 4,
      isLowDataMode: false,
      effectiveConnectionType: '4g',
      isLowBattery: false,
      recommendedQuality: 'balanced',
      recommendedRenderer: 'canvas',
    };
  }

  // 1. Test WebGL & WebGL2 safely
  let hasWebGL = false;
  let hasWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      hasWebGL2 = true;
      hasWebGL = true;
    } else {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      hasWebGL = !!(gl && gl instanceof WebGLRenderingContext);
    }
  } catch {
    hasWebGL = false;
    hasWebGL2 = false;
  }

  // 2. Test Canvas 2D
  let hasCanvas2D = false;
  try {
    const canvas = document.createElement('canvas');
    hasCanvas2D = !!canvas.getContext('2d');
  } catch {
    hasCanvas2D = false;
  }

  // 3. Device Memory & Hardware Concurrency
  const nav = navigator as any;
  const deviceMemoryGB: number = nav.deviceMemory || 4;
  const hardwareConcurrency: number = nav.hardwareConcurrency || 4;

  // 4. Network Connection Constraints
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const isLowDataMode = !!(conn && conn.saveData);
  const effectiveConnectionType = (conn && conn.effectiveType) || 'unknown';
  const isSlowNetwork = effectiveConnectionType === 'slow-2g' || effectiveConnectionType === '2g';

  // 5. Battery Status Evaluation
  const isLowBattery = batteryLevel !== undefined ? batteryLevel < 0.20 && isCharging === false : false;
  const isCriticalBattery = batteryLevel !== undefined ? batteryLevel < 0.10 && isCharging === false : false;

  // 6. Quality Mode Recommendation
  let recommendedQuality: MapQualityMode = 'balanced';
  if (isLowBattery || isLowDataMode || isSlowNetwork || deviceMemoryGB <= 2) {
    recommendedQuality = 'power_saver';
  } else if (deviceMemoryGB >= 8 && hardwareConcurrency >= 8 && !isLowDataMode) {
    recommendedQuality = 'detail';
  }

  // 7. Smart Renderer Selection (WebGL → Canvas → ASCII)
  let recommendedRenderer: MapRenderer = 'canvas';

  if (isCriticalBattery || deviceMemoryGB < 1 || (!hasWebGL && !hasCanvas2D)) {
    // Ultra-low overhead ASCII terminal mode for emergency survival / extreme constraints
    recommendedRenderer = 'ascii';
  } else if (hasWebGL && !isLowBattery && recommendedQuality !== 'power_saver' && deviceMemoryGB >= 2) {
    // High-performance hardware accelerated WebGL
    recommendedRenderer = 'webgl';
  } else if (hasCanvas2D) {
    // Lightweight, highly compatible Canvas 2D
    recommendedRenderer = 'canvas';
  } else {
    // Fallback
    recommendedRenderer = 'ascii';
  }

  return {
    hasWebGL,
    hasWebGL2,
    hasCanvas2D,
    deviceMemoryGB,
    hardwareConcurrency,
    isLowDataMode,
    effectiveConnectionType,
    isLowBattery,
    batteryLevel,
    isCharging,
    recommendedQuality,
    recommendedRenderer,
  };
}

/**
 * Asynchronous capability detection that queries the Battery Status API.
 */
export async function detectMapCapabilitiesAsync(): Promise<SystemCapabilities> {
  let batteryLevel: number | undefined;
  let isCharging: boolean | undefined;

  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const battery = await (navigator as any).getBattery();
      batteryLevel = battery.level;
      isCharging = battery.charging;
    } catch {
      // Battery API not supported or permissions denied
    }
  }

  return detectMapCapabilities(batteryLevel, isCharging);
}
