import { MapEngine } from './mapEngine';
import { MapQualityMode } from './mapCapabilities';

export type QualityMode = 'power-saver' | 'balanced' | 'detail';

export interface QualityChangeNotification {
  title: string;
  message: string;
  previousMode: QualityMode;
  newMode: QualityMode;
  reason: 'battery' | 'network' | 'memory' | 'manual';
  action: {
    label: string;
    onClick: () => void;
  };
}

export type QualityChangeCallback = (data: { mode: QualityMode; reason?: string }) => void;
export type NotificationCallback = (notification: QualityChangeNotification) => void;

export class MapQualityManager {
  private currentMode: QualityMode = 'balanced';
  private mapEngine?: MapEngine;
  private isManualOverride = false;
  private memoryIntervalId: NodeJS.Timeout | null = null;
  private batteryObj: any = null;
  private listeners = new Set<QualityChangeCallback>();
  private notificationHandlers = new Set<NotificationCallback>();

  // Bound event listeners for clean unsubscription
  private onBatteryChange = () => this.recommendQualityMode();
  private onConnectionChange = () => this.recommendQualityMode();

  constructor(mapEngine?: MapEngine) {
    this.mapEngine = mapEngine;

    // Monitor Battery Status
    if (typeof window !== 'undefined' && typeof (navigator as any)?.getBattery === 'function') {
      try {
        (navigator as any).getBattery().then((battery: any) => {
          if (!battery) return;
          this.batteryObj = battery;
          if (typeof battery.addEventListener === 'function') {
            try {
              battery.addEventListener('levelchange', this.onBatteryChange);
              battery.addEventListener('chargingchange', this.onBatteryChange);
            } catch {
              // Ignore event listener attach errors on non-standard battery implementations
            }
          }
          this.recommendQualityMode();
        }).catch(() => {
          // Battery API permission or error ignored
        });
      } catch {
        // Ignore synchronous getBattery errors
      }
    }

    // Monitor Network Connection (Save-Data, 2G, 3G)
    if (typeof window !== 'undefined' && (navigator as any).connection) {
      const conn = (navigator as any).connection;
      if (typeof conn?.addEventListener === 'function') {
        try {
          conn.addEventListener('change', this.onConnectionChange);
        } catch {
          // Ignore
        }
      }
    }

    // Monitor Memory Pressure (Chrome/Edge/Chromium)
    if (typeof window !== 'undefined' && (performance as any).memory) {
      this.memoryIntervalId = setInterval(() => {
        this.checkMemoryPressure();
      }, 5000);
    }
  }

  public async recommendQualityMode(): Promise<void> {
    if (this.isManualOverride) {
      return; // Respect user's explicit manual override
    }

    let isLowBattery = false;
    if (this.batteryObj) {
      isLowBattery = this.batteryObj.level < 0.2 && !this.batteryObj.charging;
    }

    const connection = (navigator as any)?.connection;
    const isSlowConnection = !!(
      connection?.saveData ||
      connection?.effectiveType === '2g' ||
      connection?.effectiveType === '3g' ||
      connection?.effectiveType === 'slow-2g'
    );

    if (isLowBattery || isSlowConnection) {
      if (this.currentMode !== 'power-saver') {
        const prev = this.currentMode;
        const reason = isLowBattery ? 'battery' : 'network';
        this.setQualityMode('power-saver', false);

        this.emitNotification({
          title: 'Map quality reduced',
          message: isLowBattery
            ? 'Battery below 20%. Map detail reduced to preserve energy for mesh operations.'
            : 'Slow or metered network detected. Reduced map bandwidth.',
          previousMode: prev,
          newMode: 'power-saver',
          reason,
          action: {
            label: 'Restore detail',
            onClick: () => this.setQualityMode('detail', true),
          },
        });
      }
    }
  }

  public checkMemoryPressure(): void {
    if (this.isManualOverride) return;

    const perfMem = (performance as any).memory;
    if (!perfMem) return;

    // If JS heap exceeds 180MB or 85% of total limit, trigger power-saver mode
    const usedMB = perfMem.usedJSHeapSize / (1024 * 1024);
    const limitMB = perfMem.jsHeapSizeLimit / (1024 * 1024);

    if (usedMB > 180 || (limitMB > 0 && usedMB / limitMB > 0.85)) {
      if (this.currentMode !== 'power-saver') {
        const prev = this.currentMode;
        this.setQualityMode('power-saver', false);
        this.emitNotification({
          title: 'Map memory optimized',
          message: 'Device memory pressure detected. Reduced vector tile caching.',
          previousMode: prev,
          newMode: 'power-saver',
          reason: 'memory',
          action: {
            label: 'Restore detail',
            onClick: () => this.setQualityMode('detail', true),
          },
        });
      }
    }
  }

  public setQualityMode(mode: QualityMode, isManual = true): void {
    this.currentMode = mode;
    if (isManual) {
      this.isManualOverride = true;
    }

    // Pass to map engine if hooked
    if (this.mapEngine) {
      this.mapEngine.setQualityMode(mode);
    }

    // Notify listeners
    this.emitEvent('quality-mode-changed', { mode });
  }

  public getQualityMode(): QualityMode {
    return this.currentMode;
  }

  public resetManualOverride(): void {
    this.isManualOverride = false;
    this.recommendQualityMode();
  }

  public onQualityChange(callback: QualityChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onNotification(handler: NotificationCallback): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  private emitEvent(name: string, payload: { mode: QualityMode; reason?: string }): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(name, { detail: payload })
      );
    }
    this.listeners.forEach((fn) => fn(payload));
  }

  private emitNotification(notification: QualityChangeNotification): void {
    this.notificationHandlers.forEach((handler) => handler(notification));
  }

  public destroy(): void {
    if (this.memoryIntervalId) {
      clearInterval(this.memoryIntervalId);
      this.memoryIntervalId = null;
    }
    if (this.batteryObj) {
      if (typeof this.batteryObj.removeEventListener === 'function') {
        try {
          this.batteryObj.removeEventListener('levelchange', this.onBatteryChange);
          this.batteryObj.removeEventListener('chargingchange', this.onBatteryChange);
        } catch {
          // Ignore unlisten errors
        }
      }
      this.batteryObj = null;
    }
    if (typeof window !== 'undefined' && (navigator as any).connection) {
      const conn = (navigator as any).connection;
      if (typeof conn?.removeEventListener === 'function') {
        try {
          conn.removeEventListener('change', this.onConnectionChange);
        } catch {
          // Ignore
        }
      }
    }
    this.listeners.clear();
    this.notificationHandlers.clear();
  }
}
