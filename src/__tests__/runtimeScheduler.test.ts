import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeScheduler, runtimeScheduler } from '../services/runtime/RuntimeScheduler';

describe('RuntimeScheduler (Requirement 39)', () => {
  beforeEach(() => {
    runtimeScheduler.updateState({
      foreground: true,
      background: false,
      screenActive: true,
      radioActive: false,
      mapActive: false,
      emergencyMode: false,
    });
  });

  it('initializes with default foreground state and updates state dynamically', () => {
    const state = runtimeScheduler.getState();
    expect(state.foreground).toBe(true);
    expect(state.mapActive).toBe(false);

    runtimeScheduler.setMapActive(true);
    expect(runtimeScheduler.getState().mapActive).toBe(true);
  });

  it('pauses map rendering jobs when map is inactive (0 FPS / 0 interval)', () => {
    runtimeScheduler.setMapActive(false);

    const interval = runtimeScheduler.calculateInterval({
      id: 'map-render-job',
      category: 'map_quality',
      baseIntervalMs: 16,
      run: () => {},
    });

    expect(interval).toBe(0); // Paused when map is hidden
  });

  it('runs map quality jobs when map is active', () => {
    runtimeScheduler.setMapActive(true);

    const interval = runtimeScheduler.calculateInterval({
      id: 'map-render-job',
      category: 'map_quality',
      baseIntervalMs: 16,
      run: () => {},
    });

    expect(interval).toBe(16);
  });

  it('adaptively adjusts peer discovery intervals (30s foreground vs 120s background)', () => {
    runtimeScheduler.updateState({ foreground: true, radioActive: false });
    const fgInterval = runtimeScheduler.calculateInterval({
      id: 'peer-ping-job',
      category: 'peer_ping',
      baseIntervalMs: 30_000,
      run: () => {},
    });
    expect(fgInterval).toBe(30_000);

    runtimeScheduler.updateState({ foreground: false, background: true, radioActive: false });
    const bgInterval = runtimeScheduler.calculateInterval({
      id: 'peer-ping-job',
      category: 'peer_ping',
      baseIntervalMs: 30_000,
      run: () => {},
    });
    expect(bgInterval).toBe(120_000);
  });

  it('prioritizes jobs in emergency mode', () => {
    runtimeScheduler.setEmergencyMode(true);

    const interval = runtimeScheduler.calculateInterval({
      id: 'mesh-emergency-job',
      category: 'mesh',
      baseIntervalMs: 10_000,
      run: () => {},
    });

    expect(interval).toBe(1000); // Accelerated to 1s in emergency
  });
});
