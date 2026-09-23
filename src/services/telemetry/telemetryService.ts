/**
 * Standardized Telemetry & Diagnostic Logging Engine for HÕIMU
 * 
 * Enforces unified observability categories across Browser, PWA, and Pi Hardware Bridge:
 * - mesh.packet, mesh.route, mesh.retry, mesh.ack
 * - crypto.sign, crypto.decrypt
 * - radio.tx, radio.rx, radio.error
 * - map.tile, gps.fix
 * - storage.write, storage.error
 * 
 * Features a circular diagnostic buffer in browser memory for instant offline inspection.
 */

export type TelemetryCategory =
  | 'mesh.packet'
  | 'mesh.route'
  | 'mesh.retry'
  | 'mesh.ack'
  | 'crypto.sign'
  | 'crypto.decrypt'
  | 'radio.tx'
  | 'radio.rx'
  | 'radio.error'
  | 'map.tile'
  | 'gps.fix'
  | 'storage.write'
  | 'storage.error';

export type TelemetryLevel = 'info' | 'warn' | 'error';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  category: TelemetryCategory;
  level: TelemetryLevel;
  details: Record<string, any>;
  nodeId?: string;
}

export class CircularTelemetryBuffer {
  private buffer: TelemetryEvent[] = [];
  private capacity: number;
  private listeners: Array<(event: TelemetryEvent) => void> = [];

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  public record(
    category: TelemetryCategory,
    details: Record<string, any> = {},
    level: TelemetryLevel = 'info',
    nodeId?: string
  ): TelemetryEvent {
    const event: TelemetryEvent = {
      id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      category,
      level,
      details,
      nodeId,
    };

    if (this.buffer.length >= this.capacity) {
      this.buffer.shift(); // Evict oldest
    }
    this.buffer.push(event);

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Suppress listener error
      }
    });

    return event;
  }

  public getEvents(category?: TelemetryCategory, limit?: number): TelemetryEvent[] {
    let filtered = category
      ? this.buffer.filter((e) => e.category === category)
      : [...this.buffer];

    if (limit && limit > 0) {
      filtered = filtered.slice(-limit);
    }
    return filtered;
  }

  public subscribe(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public clear(): void {
    this.buffer = [];
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getSize(): number {
    return this.buffer.length;
  }

  public exportJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEvents: this.buffer.length,
        events: this.buffer,
      },
      null,
      2
    );
  }
}

export const telemetryBuffer = new CircularTelemetryBuffer(500);
