/**
 * MeshMetricsService
 * Standardized telemetry and observability metric model for HÕIMU field nodes.
 * Tracks radio events, airtime, packet processing, and signal health.
 */

export interface MeshMetrics {
  rx: number;
  tx: number;
  crcErrors: number;
  signatureFailures: number;
  decryptFailures: number;
  duplicates: number;
  ttlDrops: number;
  forwarded: number;
  ackSent: number;
  ackReceived: number;
  retries: number;
  txAirtimeMs: number;
  rxAirtimeMs: number;
  averageRssi: number;
  averageSnr: number;
  routeFailures: number;
}

export type RadioEvent =
  | 'TX_DONE'
  | 'RX_DONE'
  | 'CRC_ERROR'
  | 'CAD_DETECTED'
  | 'TIMEOUT'
  | 'BUSY_TIMEOUT';

export interface RadioEventCounter {
  txDone: number;
  rxDone: number;
  crcError: number;
  cadDetected: number;
  timeout: number;
  busyTimeout: number;
}

export class MeshMetricsService {
  private static instance: MeshMetricsService | null = null;

  private metrics: MeshMetrics = {
    rx: 0,
    tx: 0,
    crcErrors: 0,
    signatureFailures: 0,
    decryptFailures: 0,
    duplicates: 0,
    ttlDrops: 0,
    forwarded: 0,
    ackSent: 0,
    ackReceived: 0,
    retries: 0,
    txAirtimeMs: 0,
    rxAirtimeMs: 0,
    averageRssi: -85,
    averageSnr: 9,
    routeFailures: 0,
  };

  private radioEvents: RadioEventCounter = {
    txDone: 0,
    rxDone: 0,
    crcError: 0,
    cadDetected: 0,
    timeout: 0,
    busyTimeout: 0,
  };

  private rssiSamples: number[] = [];
  private snrSamples: number[] = [];

  private listeners: Set<(m: MeshMetrics, r: RadioEventCounter) => void> = new Set();

  private constructor() {}

  public static getInstance(): MeshMetricsService {
    if (!MeshMetricsService.instance) {
      MeshMetricsService.instance = new MeshMetricsService();
    }
    return MeshMetricsService.instance;
  }

  public getMetrics(): MeshMetrics {
    return { ...this.metrics };
  }

  public getRadioEvents(): RadioEventCounter {
    return { ...this.radioEvents };
  }

  public subscribe(fn: (m: MeshMetrics, r: RadioEventCounter) => void): () => void {
    this.listeners.add(fn);
    fn(this.getMetrics(), this.getRadioEvents());
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const m = this.getMetrics();
    const r = this.getRadioEvents();
    this.listeners.forEach((listener) => {
      try {
        listener(m, r);
      } catch (err) {
        console.error('[MeshMetricsService] Listener error:', err);
      }
    });
  }

  public recordRadioEvent(event: RadioEvent, rssi?: number, snr?: number, airtimeMs?: number): void {
    switch (event) {
      case 'TX_DONE':
        this.radioEvents.txDone++;
        this.metrics.tx++;
        if (airtimeMs) this.metrics.txAirtimeMs += airtimeMs;
        break;
      case 'RX_DONE':
        this.radioEvents.rxDone++;
        this.metrics.rx++;
        if (airtimeMs) this.metrics.rxAirtimeMs += airtimeMs;
        break;
      case 'CRC_ERROR':
        this.radioEvents.crcError++;
        this.metrics.crcErrors++;
        break;
      case 'CAD_DETECTED':
        this.radioEvents.cadDetected++;
        break;
      case 'TIMEOUT':
        this.radioEvents.timeout++;
        break;
      case 'BUSY_TIMEOUT':
        this.radioEvents.busyTimeout++;
        break;
    }

    if (rssi !== undefined) {
      this.rssiSamples.push(rssi);
      if (this.rssiSamples.length > 50) this.rssiSamples.shift();
      const avgRssi = Math.round(this.rssiSamples.reduce((a, b) => a + b, 0) / this.rssiSamples.length);
      this.metrics.averageRssi = avgRssi;
    }

    if (snr !== undefined) {
      this.snrSamples.push(snr);
      if (this.snrSamples.length > 50) this.snrSamples.shift();
      const avgSnr = Number((this.snrSamples.reduce((a, b) => a + b, 0) / this.snrSamples.length).toFixed(1));
      this.metrics.averageSnr = avgSnr;
    }

    this.notify();
  }

  public recordDuplicate(): void {
    this.metrics.duplicates++;
    this.notify();
  }

  public recordSignatureFailure(): void {
    this.metrics.signatureFailures++;
    this.notify();
  }

  public recordDecryptFailure(): void {
    this.metrics.decryptFailures++;
    this.notify();
  }

  public recordTtlDrop(): void {
    this.metrics.ttlDrops++;
    this.notify();
  }

  public recordForwarded(): void {
    this.metrics.forwarded++;
    this.notify();
  }

  public recordAckSent(): void {
    this.metrics.ackSent++;
    this.notify();
  }

  public recordAckReceived(): void {
    this.metrics.ackReceived++;
    this.notify();
  }

  public recordRetry(): void {
    this.metrics.retries++;
    this.notify();
  }

  public recordRouteFailure(): void {
    this.metrics.routeFailures++;
    this.notify();
  }
}

export const meshMetricsService = MeshMetricsService.getInstance();
