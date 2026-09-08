export type MapRenderer = 'webgl' | 'canvas' | 'ascii';

export type MapQualityMode = 'power_saver' | 'balanced' | 'detail';

export interface SystemCapabilities {
  hasWebGL: boolean;
  hasCanvas2D: boolean;
  deviceMemoryGB?: number;
  hardwareConcurrency?: number;
  isLowDataMode: boolean;
  isLowBattery: boolean;
  recommendedQuality: MapQualityMode;
  recommendedRenderer: MapRenderer;
}

export function detectMapCapabilities(batteryLevel?: number, isCharging?: boolean): SystemCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasWebGL: false,
      hasCanvas2D: true,
      isLowDataMode: false,
      isLowBattery: false,
      recommendedQuality: 'balanced',
      recommendedRenderer: 'canvas',
    };
  }

  // Check WebGL support safely
  let hasWebGL = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    hasWebGL = !!(gl && gl instanceof WebGLRenderingContext);
  } catch {
    hasWebGL = false;
  }

  // Check Canvas 2D support
  let hasCanvas2D = false;
  try {
    const canvas = document.createElement('canvas');
    hasCanvas2D = !!canvas.getContext('2d');
  } catch {
    hasCanvas2D = false;
  }

  // Memory & Concurrency
  const nav = navigator as any;
  const deviceMemoryGB = nav.deviceMemory || 4;
  const hardwareConcurrency = nav.hardwareConcurrency || 4;

  // Connection Save Data
  const isLowDataMode = !!(nav.connection && nav.connection.saveData);

  // Battery status check
  const isLowBattery = batteryLevel !== undefined ? batteryLevel < 0.20 && isCharging === false : false;

  // Determine quality recommendation
  let recommendedQuality: MapQualityMode = 'balanced';
  if (isLowBattery || isLowDataMode || deviceMemoryGB <= 2) {
    recommendedQuality = 'power_saver';
  } else if (deviceMemoryGB >= 8 && hardwareConcurrency >= 8) {
    recommendedQuality = 'detail';
  }

  // Determine renderer recommendation
  let recommendedRenderer: MapRenderer = 'canvas';
  if (hasWebGL && recommendedQuality !== 'power_saver') {
    recommendedRenderer = 'webgl';
  } else if (hasCanvas2D) {
    recommendedRenderer = 'canvas';
  } else {
    recommendedRenderer = 'ascii';
  }

  return {
    hasWebGL,
    hasCanvas2D,
    deviceMemoryGB,
    hardwareConcurrency,
    isLowDataMode,
    isLowBattery,
    recommendedQuality,
    recommendedRenderer,
  };
}
