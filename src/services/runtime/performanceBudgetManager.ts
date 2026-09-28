/**
 * HÕIMU Performance Budget Manager
 * Monitors, enforces, and reports on system performance limits:
 * - App load < 1.5s
 * - Map initialization < 1.5s
 * - Search response < 50ms
 * - Route calculation < 50ms (small) / < 200ms (city)
 * - Memory thresholds (100MB target, 150MB warning, 250MB critical)
 */

export interface PerformanceBudgets {
  initialAppUiMs: number;
  mapInitMs: number;
  searchLatencyMs: number;
  smallRouteMs: number;
  cityRouteMs: number;
  memoryTargetMb: number;
  memoryWarningMb: number;
  memoryCriticalMb: number;
}

export const TARGET_PERFORMANCE_BUDGETS: PerformanceBudgets = {
  initialAppUiMs: 1500,
  mapInitMs: 1500,
  searchLatencyMs: 50,
  smallRouteMs: 50,
  cityRouteMs: 200,
  memoryTargetMb: 100,
  memoryWarningMb: 150,
  memoryCriticalMb: 250,
};

export interface PerformanceMetricRecord {
  metric: keyof PerformanceBudgets;
  value: number;
  budgetLimit: number;
  withinBudget: boolean;
  timestamp: number;
}

export class PerformanceBudgetManager {
  private static instance: PerformanceBudgetManager | null = null;
  private metricsHistory: PerformanceMetricRecord[] = [];
  private listeners: Set<(record: PerformanceMetricRecord) => void> = new Set();

  public static getInstance(): PerformanceBudgetManager {
    if (!PerformanceBudgetManager.instance) {
      PerformanceBudgetManager.instance = new PerformanceBudgetManager();
    }
    return PerformanceBudgetManager.instance;
  }

  public recordMetric(metric: keyof PerformanceBudgets, valueMsOrMb: number): PerformanceMetricRecord {
    const budgetLimit = TARGET_PERFORMANCE_BUDGETS[metric];
    const withinBudget = valueMsOrMb <= budgetLimit;
    const record: PerformanceMetricRecord = {
      metric,
      value: valueMsOrMb,
      budgetLimit,
      withinBudget,
      timestamp: Date.now(),
    };

    this.metricsHistory.push(record);
    if (this.metricsHistory.length > 100) this.metricsHistory.shift();

    if (!withinBudget) {
      console.warn(`[PerformanceBudgetManager] Budget limit exceeded for ${metric}: ${valueMsOrMb} (limit: ${budgetLimit})`);
    }

    this.listeners.forEach((fn) => {
      try {
        fn(record);
      } catch (err) {
        console.error('[PerformanceBudgetManager] Listener error:', err);
      }
    });

    return record;
  }

  public getHistory(): PerformanceMetricRecord[] {
    return [...this.metricsHistory];
  }

  public subscribe(fn: (record: PerformanceMetricRecord) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const performanceBudgetManager = PerformanceBudgetManager.getInstance();
