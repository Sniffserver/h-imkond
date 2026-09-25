import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSymbolDurationMs,
  isLdroRequired,
  calculateAirtimeMs,
  DEFAULT_RADIO_PROFILE,
} from '../mesh/radioProfile';
import {
  getBridgeStatus,
  getMeshPeersFromBridge,
  isMockBridgeMode,
  setMockBridgeMode,
  createTelemetryValue,
} from '../services/comms/piBridge';
import { TelemetryValue, TelemetrySource, BridgeStatus } from '../types';

describe('Hardware Radio Physics, LDRO Symbol Duration & Telemetry Grounding', () => {
  beforeEach(() => {
    localStorage.clear();
    setMockBridgeMode(false);
  });

  // =========================================================================
  // 1. Physical LDRO Logic & Symbol Duration (Req 26 & 27)
  // =========================================================================
  describe('Symbol Duration & Physical LDRO Mandate', () => {
    it('calculates physical symbol duration Tsym = 2^SF / BW_kHz', () => {
      // SF7 @ 125kHz: 128 / 125 = 1.024 ms
      expect(getSymbolDurationMs(7, 125.0)).toBeCloseTo(1.024, 3);

      // SF10 @ 125kHz: 1024 / 125 = 8.192 ms
      expect(getSymbolDurationMs(10, 125.0)).toBeCloseTo(8.192, 3);

      // SF11 @ 125kHz: 2048 / 125 = 16.384 ms
      expect(getSymbolDurationMs(11, 125.0)).toBeCloseTo(16.384, 3);

      // SF12 @ 125kHz: 4096 / 125 = 32.768 ms
      expect(getSymbolDurationMs(12, 125.0)).toBeCloseTo(32.768, 3);

      // SF11 @ 250kHz: 2048 / 250 = 8.192 ms
      expect(getSymbolDurationMs(11, 250.0)).toBeCloseTo(8.192, 3);

      // SF12 @ 250kHz: 4096 / 250 = 16.384 ms
      expect(getSymbolDurationMs(12, 250.0)).toBeCloseTo(16.384, 3);
    });

    it('enforces LDRO based strictly on symbol duration >= 16.0 ms', () => {
      // Under 16ms: LDRO not required
      expect(isLdroRequired(10, 125.0)).toBe(false);
      expect(isLdroRequired(11, 250.0)).toBe(false); // Doubled bandwidth brings Tsym under 16ms!

      // 16.384ms or higher: LDRO physically required by Semtech SX1261/SX1262
      expect(isLdroRequired(11, 125.0)).toBe(true);
      expect(isLdroRequired(12, 125.0)).toBe(true);
      expect(isLdroRequired(12, 250.0)).toBe(true);
    });

    it('calculates physical LoRa Time-on-Air across matrix of SF, BW, and payloads', () => {
      const sfs = [7, 8, 9, 10, 11, 12];
      const payloads = [16, 32, 64, 128, 200];

      for (const sf of sfs) {
        let prevToa = 0;
        for (const pl of payloads) {
          const toa = calculateAirtimeMs(pl, sf, 125.0, 1);
          expect(toa).toBeGreaterThan(0);
          expect(toa).toBeGreaterThan(prevToa);
          prevToa = toa;
        }
      }

      // BW 250kHz takes substantially less airtime than BW 125kHz (roughly half)
      const toa125 = calculateAirtimeMs(64, 7, 125.0, 1);
      const toa250 = calculateAirtimeMs(64, 7, 250.0, 1);
      expect(toa250).toBeLessThan(toa125);
      expect(toa250).toBeGreaterThan(toa125 * 0.45);
      expect(toa250).toBeLessThan(toa125 * 0.65);
    });
  });

  // =========================================================================
  // 2. Pi Bridge Mock Mode Default & Telemetry Grounding (Req 29 & 30)
  // =========================================================================
  describe('Pi Bridge Real Default & Telemetry Grounding', () => {
    it('defaults to REAL hardware mode, not mock mode', () => {
      // Default should be false (REAL), mock is dev-only
      expect(isMockBridgeMode()).toBe(false);
    });

    it('marks simulated bridge status clearly with isSimulated and simulated source', async () => {
      setMockBridgeMode(true);
      expect(isMockBridgeMode()).toBe(true);

      const status = await getBridgeStatus();
      expect(status.connected).toBe(true);
      expect(status.isSimulated).toBe(true);
      expect(status.telemetrySource).toBe('simulated');
      expect(status.batteryTelemetry?.source).toBe('simulated');
      expect(status.solarWattsTelemetry?.source).toBe('simulated');
      expect(status.solarVoltageTelemetry?.source).toBe('simulated');
    });

    it('clears synthetic values to null when disconnected from real Pi', async () => {
      setMockBridgeMode(false);
      expect(isMockBridgeMode()).toBe(false);

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      try {
        const status = await getBridgeStatus();
        expect(status.connected).toBe(false);
        expect(status.isSimulated).toBe(false);
        expect(status.piBatteryPercent).toBeNull();
        expect(status.solarWatts).toBeNull();
        expect(status.solarVoltage).toBeNull();
        expect(status.batteryTelemetry).toBeUndefined();
        expect(status.solarWattsTelemetry).toBeUndefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('creates and verifies TelemetryValue structure with sources', () => {
      const hwValue: TelemetryValue<number> = createTelemetryValue(14.2, 'hardware', 'V');
      expect(hwValue.value).toBe(14.2);
      expect(hwValue.source).toBe('hardware');
      expect(hwValue.unit).toBe('V');
      expect(hwValue.timestamp).toBeGreaterThan(0);

      const simValue: TelemetryValue<number> = createTelemetryValue(12.4, 'simulated', 'W');
      expect(simValue.source).toBe('simulated');
      expect(simValue.value).toBe(12.4);

      const measuredValue: TelemetryValue<number> = createTelemetryValue(-78, 'measured', 'dBm');
      expect(measuredValue.source).toBe('measured');
    });

    it('tags peer telemetry with TelemetryValue (RSSI, SNR, state, latency)', async () => {
      setMockBridgeMode(true);
      const peers = await getMeshPeersFromBridge();
      expect(peers.length).toBeGreaterThan(0);
      const peer = peers[0];
      expect(peer.rssiTelemetry?.source).toBe('simulated');
      expect(peer.snrTelemetry?.source).toBe('simulated');
      expect(peer.stateTelemetry?.source).toBe('simulated');
      expect(peer.latencyTelemetry?.source).toBe('simulated');
    });
  });
});
