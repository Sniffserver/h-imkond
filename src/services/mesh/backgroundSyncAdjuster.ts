/**
 * HÕIMU Background Sync Interval Adjuster
 * 
 * Dynamically regulates the cadence of background RF beacon scanning and
 * store-and-forward mesh synchronization based on physical device battery levels.
 * 
 * Core Behavior:
 * - Normal State (Battery >= 15%): High-cadence beacon scanning (every 8 seconds / ~0.125 Hz)
 * - Low Battery State (Battery < 15%): Throttles beacon scanning to eco cadence (every 45 seconds / ~0.022 Hz)
 *   reducing radio wakeups by >80% to protect critical battery reserves.
 * - Critical State (Battery < 5%): Emergency conservation mode (every 90 seconds / ~0.011 Hz).
 */

import { setMeshSyncInterval } from './meshSync';

export const STANDARD_BEACON_INTERVAL_MS = 8000;
export const LOW_BATTERY_BEACON_INTERVAL_MS = 45000;
export const CRITICAL_BATTERY_BEACON_INTERVAL_MS = 90000;
export const LOW_BATTERY_THRESHOLD_PERCENT = 15;
export const CRITICAL_BATTERY_THRESHOLD_PERCENT = 5;

export type SyncAdjusterMode = 'normal' | 'low_power_throttled' | 'extreme_conservation' | 'manual_override';

export interface SyncAdjusterState {
  batteryPercent: number;
  isCharging: boolean;
  isLowBattery: boolean;
  isCriticalBattery: boolean;
  currentIntervalMs: number;
  standardIntervalMs: number;
  lowBatteryIntervalMs: number;
  mode: SyncAdjusterMode;
  frequencyHz: number;
  reductionPercentage: number;
  isSimulated: boolean;
  lastAdjustedAt: number;
}

type SyncAdjusterListener = (state: SyncAdjusterState) => void;

class BackgroundSyncIntervalAdjuster {
  private listeners: Set<SyncAdjusterListener> = new Set();
  private batteryPercent: number = 88;
  private isCharging: boolean = false;
  private isManual: boolean = false;
  private isSimulated: boolean = false;
  private manualIntervalMs: number = STANDARD_BEACON_INTERVAL_MS;
  private lastAdjustedAt: number = Date.now();
  private isInitialized: boolean = false;

  constructor() {
    // Attempt automatic battery manager subscription in browser environments
    if (typeof window !== 'undefined') {
      this.initBatteryListener();
    }
  }

  private async initBatteryListener() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        if (battery) {
          this.batteryPercent = Math.round((battery.level || 0.88) * 100);
          this.isCharging = Boolean(battery.charging);
          this.applyIntervalAdjustment();

          battery.addEventListener('levelchange', () => {
            if (!this.isSimulated) {
              this.batteryPercent = Math.round((battery.level || 0.88) * 100);
              this.applyIntervalAdjustment();
            }
          });

          battery.addEventListener('chargingchange', () => {
            if (!this.isSimulated) {
              this.isCharging = Boolean(battery.charging);
              this.applyIntervalAdjustment();
            }
          });
        }
      }
    } catch {
      // getBattery rejected or blocked by browser permissions policy
    }
  }

  private calculateCurrentInterval(): { intervalMs: number; mode: SyncAdjusterMode } {
    if (this.isManual) {
      return {
        intervalMs: this.manualIntervalMs,
        mode: 'manual_override',
      };
    }

    // When charging, prioritize fast mesh synchronization regardless of low battery
    if (this.isCharging && this.batteryPercent >= 10) {
      return {
        intervalMs: STANDARD_BEACON_INTERVAL_MS,
        mode: 'normal',
      };
    }

    if (this.batteryPercent < CRITICAL_BATTERY_THRESHOLD_PERCENT) {
      return {
        intervalMs: CRITICAL_BATTERY_BEACON_INTERVAL_MS,
        mode: 'extreme_conservation',
      };
    }

    if (this.batteryPercent < LOW_BATTERY_THRESHOLD_PERCENT) {
      return {
        intervalMs: LOW_BATTERY_BEACON_INTERVAL_MS,
        mode: 'low_power_throttled',
      };
    }

    return {
      intervalMs: STANDARD_BEACON_INTERVAL_MS,
      mode: 'normal',
    };
  }

  private applyIntervalAdjustment() {
    const { intervalMs } = this.calculateCurrentInterval();
    this.lastAdjustedAt = Date.now();

    // Propagate adjusted interval to meshSync service
    try {
      setMeshSyncInterval(intervalMs);
    } catch (e) {
      console.warn('[SyncAdjuster] Failed to set mesh sync interval:', e);
    }

    this.notify();
  }

  public getState(): SyncAdjusterState {
    const { intervalMs, mode } = this.calculateCurrentInterval();
    const isLowBattery = this.batteryPercent < LOW_BATTERY_THRESHOLD_PERCENT;
    const isCriticalBattery = this.batteryPercent < CRITICAL_BATTERY_THRESHOLD_PERCENT;

    const frequencyHz = parseFloat((1 / (intervalMs / 1000)).toFixed(4));
    const reductionPercentage =
      intervalMs > STANDARD_BEACON_INTERVAL_MS
        ? Math.round(((intervalMs - STANDARD_BEACON_INTERVAL_MS) / intervalMs) * 100)
        : 0;

    return {
      batteryPercent: this.batteryPercent,
      isCharging: this.isCharging,
      isLowBattery,
      isCriticalBattery,
      currentIntervalMs: intervalMs,
      standardIntervalMs: STANDARD_BEACON_INTERVAL_MS,
      lowBatteryIntervalMs: LOW_BATTERY_BEACON_INTERVAL_MS,
      mode,
      frequencyHz,
      reductionPercentage,
      isSimulated: this.isSimulated,
      lastAdjustedAt: this.lastAdjustedAt,
    };
  }

  /**
   * Updates battery level from app state or physical sensors
   */
  public updateBatteryLevel(percent: number, isCharging?: boolean) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.batteryPercent = clamped;
    if (isCharging !== undefined) {
      this.isCharging = isCharging;
    }
    this.applyIntervalAdjustment();
  }

  /**
   * Toggles simulated low battery (< 15%) mode for easy verification and testing
   */
  public simulateLowBattery(enable: boolean, targetPercent: number = 12) {
    this.isSimulated = enable;
    this.isManual = false;
    if (enable) {
      this.batteryPercent = Math.min(LOW_BATTERY_THRESHOLD_PERCENT - 1, targetPercent);
      this.isCharging = false;
    } else {
      this.batteryPercent = 88;
    }
    this.applyIntervalAdjustment();
  }

  /**
   * Manually adjusts the background sync interval (in milliseconds)
   */
  public setManualInterval(intervalMs: number) {
    this.isManual = true;
    this.manualIntervalMs = Math.max(2000, Math.min(180000, intervalMs));
    this.applyIntervalAdjustment();
  }

  /**
   * Resets adjuster back to automatic battery-driven cadence
   */
  public resetToAuto() {
    this.isManual = false;
    this.isSimulated = false;
    this.applyIntervalAdjustment();
  }

  public subscribe(listener: SyncAdjusterListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[SyncAdjuster] Listener error:', err);
      }
    });
  }
}

export const backgroundSyncAdjuster = new BackgroundSyncIntervalAdjuster();
