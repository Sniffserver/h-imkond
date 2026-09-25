/**
 * DiagnosticRingBuffer
 * Memory-disciplined rolling log buffer capped at 2–5 MB memory budget.
 * Prevents mobile browser memory leak & crash in long field operations.
 * 
 * Features:
 * - Fixed maximum memory allocation (default 3 MB)
 * - Structured entries: severity, timestamp, subsystem, event, metadata
 * - JSON and export zip bundle generation
 */

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  id: string;
  timestamp: string;
  epochMs: number;
  severity: LogSeverity;
  subsystem: string;
  event: string;
  metadata?: Record<string, any>;
}

export class DiagnosticRingBuffer {
  private static instance: DiagnosticRingBuffer | null = null;

  private maxMemoryBytes: number = 3 * 1024 * 1024; // 3 MB max
  private estimatedCurrentBytes: number = 0;
  private entries: LogEntry[] = [];
  private listeners: Set<(entry: LogEntry) => void> = new Set();

  private constructor(maxMb: number = 3) {
    this.maxMemoryBytes = maxMb * 1024 * 1024;
  }

  public static getInstance(): DiagnosticRingBuffer {
    if (!DiagnosticRingBuffer.instance) {
      DiagnosticRingBuffer.instance = new DiagnosticRingBuffer();
    }
    return DiagnosticRingBuffer.instance;
  }

  public log(
    severity: LogSeverity,
    subsystem: string,
    event: string,
    metadata?: Record<string, any>
  ): LogEntry {
    const now = new Date();
    const entry: LogEntry = {
      id: `${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      epochMs: now.getTime(),
      severity,
      subsystem,
      event,
      metadata,
    };

    const entrySize = this.estimateEntrySize(entry);

    // Evict oldest entries if memory budget exceeded
    while (this.estimatedCurrentBytes + entrySize > this.maxMemoryBytes && this.entries.length > 0) {
      const removed = this.entries.shift();
      if (removed) {
        this.estimatedCurrentBytes -= this.estimateEntrySize(removed);
      }
    }

    this.entries.push(entry);
    this.estimatedCurrentBytes += entrySize;

    this.notifyListeners(entry);
    return entry;
  }

  public getEntries(): LogEntry[] {
    return [...this.entries];
  }

  public getMemoryUsage(): { usedBytes: number; maxBytes: number; count: number; usagePercent: number } {
    return {
      usedBytes: this.estimatedCurrentBytes,
      maxBytes: this.maxMemoryBytes,
      count: this.entries.length,
      usagePercent: Number(((this.estimatedCurrentBytes / this.maxMemoryBytes) * 100).toFixed(1)),
    };
  }

  public clear(): void {
    this.entries = [];
    this.estimatedCurrentBytes = 0;
  }

  public subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        console.error('[DiagnosticRingBuffer] Listener error:', err);
      }
    });
  }

  private estimateEntrySize(entry: LogEntry): number {
    // Rough estimate of JSON string length in bytes
    const str = JSON.stringify(entry);
    return str.length * 2; // UTF-16 in JS string
  }

  /**
   * Export all diagnostic logs as a formatted JSON Blob for download / export
   */
  public exportJsonBlob(): Blob {
    const payload = {
      exportedAt: new Date().toISOString(),
      system: 'HÕIMU Field Terminal Diagnostics',
      memory: this.getMemoryUsage(),
      logs: this.entries,
    };

    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  /**
   * Trigger direct browser download of diagnostic bundle
   */
  public downloadDiagnosticsFile(): void {
    if (typeof window === 'undefined') return;
    const blob = this.exportJsonBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu_diagnostics_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const diagnosticRingBuffer = DiagnosticRingBuffer.getInstance();
