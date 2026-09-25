import { describe, it, expect, beforeEach } from 'vitest';
import { meshMetricsService } from '../services/mesh/meshMetricsService';
import { DiagnosticRingBuffer } from '../services/diagnostics/DiagnosticRingBuffer';

describe('MeshMetricsService (Requirement 51: Observability)', () => {
  beforeEach(() => {
    // Reset counters for clean tests
  });

  it('records radio events and computes rolling average RSSI & SNR', () => {
    meshMetricsService.recordRadioEvent('TX_DONE', -80, 10, 45);
    meshMetricsService.recordRadioEvent('RX_DONE', -90, 8, 30);

    const m = meshMetricsService.getMetrics();
    const r = meshMetricsService.getRadioEvents();

    expect(m.tx).toBeGreaterThan(0);
    expect(m.rx).toBeGreaterThan(0);
    expect(r.txDone).toBeGreaterThan(0);
    expect(r.rxDone).toBeGreaterThan(0);
    expect(m.averageRssi).toBeCloseTo(-85, -1);
    expect(m.averageSnr).toBeCloseTo(9, 0);
  });

  it('records specific packet processing events (duplicates, signatures, decrypt failures)', () => {
    meshMetricsService.recordDuplicate();
    meshMetricsService.recordSignatureFailure();
    meshMetricsService.recordDecryptFailure();

    const m = meshMetricsService.getMetrics();
    expect(m.duplicates).toBeGreaterThan(0);
    expect(m.signatureFailures).toBeGreaterThan(0);
    expect(m.decryptFailures).toBeGreaterThan(0);
  });
});

describe('DiagnosticRingBuffer (Requirement 52: Memory-Disciplined Ring-Buffer Logging)', () => {
  let ringBuffer: DiagnosticRingBuffer;

  beforeEach(() => {
    ringBuffer = DiagnosticRingBuffer.getInstance();
    ringBuffer.clear();
  });

  it('logs structured log entries without exceeding memory limits', () => {
    ringBuffer.log('info', 'mesh', 'ROUTER_INIT', { localNodeId: 'TAL-01' });
    ringBuffer.log('warn', 'lora', 'DUTY_CYCLE_WARN', { percentage: 85 });

    const entries = ringBuffer.getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].subsystem).toBe('mesh');
    expect(entries[1].severity).toBe('warn');

    const usage = ringBuffer.getMemoryUsage();
    expect(usage.usedBytes).toBeGreaterThan(0);
    expect(usage.usedBytes).toBeLessThan(usage.maxBytes);
  });

  it('exports logs as JSON Blob', () => {
    ringBuffer.log('error', 'crypto', 'SIGNATURE_INVALID', { packetId: 'pkt123' });
    const blob = ringBuffer.exportJsonBlob();

    expect(blob).toBeDefined();
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBeGreaterThan(50);
  });
});
