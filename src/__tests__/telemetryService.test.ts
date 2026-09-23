import { describe, it, expect } from 'vitest';
import { CircularTelemetryBuffer, TelemetryCategory } from '../services/telemetry/telemetryService';
import { getPhysicalHardwareBenchmarks, runSyntheticBenchmark } from '../services/telemetry/deviceLabBenchmark';

describe('Standardized Observability & Telemetry Engine', () => {
  it('records events with standardized categories and enforces circular capacity', () => {
    const buffer = new CircularTelemetryBuffer(5);
    const categories: TelemetryCategory[] = [
      'mesh.packet',
      'mesh.route',
      'mesh.retry',
      'mesh.ack',
      'crypto.sign',
      'crypto.decrypt',
      'radio.tx',
    ];

    categories.forEach((cat, idx) => {
      buffer.record(cat, { seq: idx });
    });

    // Buffer capacity is 5, so 7 events should evict the 2 oldest
    expect(buffer.getSize()).toBe(5);
    const events = buffer.getEvents();
    expect(events[0].category).toBe('mesh.retry');
    expect(events[4].category).toBe('radio.tx');
  });

  it('filters recorded logs by standardized category', () => {
    const buffer = new CircularTelemetryBuffer(20);
    buffer.record('radio.tx', { frequencyHz: 868000000 });
    buffer.record('radio.rx', { rssi: -85 });
    buffer.record('radio.tx', { frequencyHz: 868100000 });

    const txLogs = buffer.getEvents('radio.tx');
    expect(txLogs.length).toBe(2);
    expect(txLogs[0].details.frequencyHz).toBe(868000000);
  });

  it('strictly separates synthetic execution benchmarks from physical hardware specs', async () => {
    const synth = await runSyntheticBenchmark();
    expect(synth.category).toBe('Synthetic Execution Benchmark');
    expect(synth.cpuOpsPerSec).toBeGreaterThan(0);
    expect(synth.fpsFrameRate).toBeGreaterThanOrEqual(30);

    const physical = getPhysicalHardwareBenchmarks();
    expect(physical.length).toBeGreaterThan(0);
    physical.forEach((hw) => {
      expect(hw.category).toBe('Physical Hardware Measurement');
      expect(hw.status).toBe('VERIFIED_PHYSICAL_BENCHMARK');
    });
  });
});
