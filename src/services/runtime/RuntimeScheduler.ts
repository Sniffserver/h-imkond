/**
 * RuntimeScheduler
 * Central performance and battery optimization scheduler for HÕIMU field terminals.
 * Consolidates background timers across mesh, radio, telemetry, theme, quality, and diagnostics.
 * Adaptively throttles intervals based on screen state, map visibility, radio activity, and emergency mode.
 */

export interface SchedulerState {
  foreground: boolean;
  background: boolean;
  screenActive: boolean;
  radioActive: boolean;
  mapActive: boolean;
  emergencyMode: boolean;
}

export type JobCategory =
  | 'mesh'
  | 'lora'
  | 'theme'
  | 'network'
  | 'telemetry'
  | 'solar'
  | 'performance'
  | 'map_quality'
  | 'peer_ping'
  | 'diagnostics';

export interface SchedulerJob {
  id: string;
  name?: string;
  category: JobCategory;
  baseIntervalMs: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  run: () => Promise<void> | void;
  adaptiveInterval?: (state: SchedulerState, baseIntervalMs: number) => number;
}

export class RuntimeScheduler {
  private static instance: RuntimeScheduler | null = null;

  private state: SchedulerState = {
    foreground: typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
    background: typeof document !== 'undefined' ? document.visibilityState !== 'visible' : false,
    screenActive: true,
    radioActive: false,
    mapActive: false,
    emergencyMode: false,
  };

  private jobs: Map<string, { job: SchedulerJob; timerId: any | null; nextRunAt: number }> = new Map();
  private listeners: Set<(state: SchedulerState) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const isVis = document.visibilityState === 'visible';
        this.updateState({
          foreground: isVis,
          background: !isVis,
          screenActive: isVis,
        });
      });

      window.addEventListener('focus', () => {
        this.updateState({ foreground: true, background: false, screenActive: true });
      });

      window.addEventListener('blur', () => {
        // Blur doesn't necessarily mean hidden, but screen focus changed
      });
    }
  }

  public static getInstance(): RuntimeScheduler {
    if (!RuntimeScheduler.instance) {
      RuntimeScheduler.instance = new RuntimeScheduler();
    }
    return RuntimeScheduler.instance;
  }

  public getState(): SchedulerState {
    return { ...this.state };
  }

  public updateState(partial: Partial<SchedulerState>): void {
    const changed = Object.entries(partial).some(
      ([key, val]) => this.state[key as keyof SchedulerState] !== val
    );

    if (changed) {
      this.state = { ...this.state, ...partial };
      this.notifyListeners();
      this.recalculateAllJobs();
    }
  }

  public setMapActive(active: boolean): void {
    this.updateState({ mapActive: active });
  }

  public setRadioActive(active: boolean): void {
    this.updateState({ radioActive: active });
  }

  public setEmergencyMode(active: boolean): void {
    this.updateState({ emergencyMode: active });
  }

  public subscribe(listener: (state: SchedulerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const copy = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (err) {
        console.error('[RuntimeScheduler] Listener error:', err);
      }
    });
  }

  /**
   * Register a scheduled recurring job with adaptive battery optimization
   */
  public registerJob(job: SchedulerJob): () => void {
    if (this.jobs.has(job.id)) {
      this.unregisterJob(job.id);
    }

    const entry = {
      job,
      timerId: null,
      nextRunAt: 0,
    };

    this.jobs.set(job.id, entry);
    this.scheduleNextTick(job.id);

    return () => this.unregisterJob(job.id);
  }

  public unregisterJob(jobId: string): void {
    const entry = this.jobs.get(jobId);
    if (entry) {
      if (entry.timerId) {
        clearTimeout(entry.timerId);
      }
      this.jobs.delete(jobId);
    }
  }

  /**
   * Calculate effective interval for a job based on runtime state
   */
  public calculateInterval(job: SchedulerJob): number {
    if (job.adaptiveInterval) {
      const custom = job.adaptiveInterval(this.getState(), job.baseIntervalMs);
      if (custom === 0) return 0; // Paused
      return this.clamp(custom, job.minIntervalMs, job.maxIntervalMs);
    }

    const { foreground, mapActive, emergencyMode, radioActive } = this.state;

    // Emergency mode: run high-priority jobs frequently
    if (emergencyMode) {
      if (job.category === 'mesh' || job.category === 'lora' || job.category === 'peer_ping') {
        return Math.max(1000, job.minIntervalMs || 1000);
      }
    }

    // Category-specific adaptive rules
    switch (job.category) {
      case 'map_quality':
      case 'performance':
        if (!mapActive) return 0; // 0 FPS / paused when map is hidden
        if (!foreground) return 0;
        return job.baseIntervalMs;

      case 'telemetry':
      case 'solar':
        if (!foreground) return 30_000; // Throttle telemetry in background
        return job.baseIntervalMs; // 1 Hz default

      case 'peer_ping':
        if (!radioActive && !foreground) return 120_000; // 120 sec in background
        if (!foreground) return 60_000; // 60 sec background with active radio
        return 30_000; // 30 sec active foreground

      case 'mesh':
      case 'lora':
        if (!foreground && !radioActive) return 60_000;
        return job.baseIntervalMs;

      case 'theme':
      case 'network':
      case 'diagnostics':
        if (!foreground) return 60_000;
        return job.baseIntervalMs;

      default:
        return foreground ? job.baseIntervalMs : job.baseIntervalMs * 2;
    }
  }

  private clamp(val: number, min?: number, max?: number): number {
    let result = val;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  }

  private scheduleNextTick(jobId: string): void {
    const entry = this.jobs.get(jobId);
    if (!entry) return;

    if (entry.timerId) {
      clearTimeout(entry.timerId);
      entry.timerId = null;
    }

    const interval = this.calculateInterval(entry.job);

    // 0 means job is paused under current state (e.g. map hidden)
    if (interval <= 0) {
      return;
    }

    entry.timerId = setTimeout(async () => {
      try {
        await entry.job.run();
      } catch (err) {
        console.error(`[RuntimeScheduler] Job ${jobId} failed:`, err);
      } finally {
        this.scheduleNextTick(jobId);
      }
    }, interval);
  }

  private recalculateAllJobs(): void {
    for (const jobId of this.jobs.keys()) {
      this.scheduleNextTick(jobId);
    }
  }
}

export const runtimeScheduler = RuntimeScheduler.getInstance();
