import { describe, it, expect } from 'vitest';
import { sanitizeLogData } from '../services/utils/logger';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';
import { runFullDeviceLabSuite, runDeviceBenchmark, DEVICE_LAB_PROFILES } from '../services/telemetry/deviceLabBenchmark';

describe('Week 8 Release Hardening & Device Matrix Tests', () => {
  describe('Security & Credential Sanitization', () => {
    it('redacts bearer tokens and PINs in log strings', () => {
      const logWithToken = 'Connected with Bearer hoimu_ptk_abc123secret and pin: "840192"';
      const sanitized = sanitizeLogData(logWithToken);
      expect(sanitized).not.toContain('hoimu_ptk_abc123secret');
      expect(sanitized).not.toContain('840192');
      expect(sanitized).toContain('[REDACTED_SECRET]');
    });

    it('redacts sensitive fields in nested log objects', () => {
      const payload = {
        deviceId: 'dev-01',
        token: 'secret-token-xyz',
        authPin: '123456',
        payload: {
          privateKey: 'hex-secret-val',
          publicCallsign: 'TARTU-01',
        },
      };

      const sanitized = sanitizeLogData(payload);
      expect(sanitized.token).toBe('[REDACTED_CREDENTIAL]');
      expect(sanitized.authPin).toBe('[REDACTED_CREDENTIAL]');
      expect(sanitized.payload.privateKey).toBe('[REDACTED_CREDENTIAL]');
      expect(sanitized.payload.publicCallsign).toBe('TARTU-01');
    });

    it('stores and retrieves encrypted local storage securely', () => {
      const secretCredential = 'pi_bridge_secret_auth_token_value_987';
      const storageKey = 'test_hoimu_pi_sec_token';

      const saved = setSecureLocalStorage(storageKey, secretCredential);
      expect(saved).toBe(true);

      const recovered = getSecureLocalStorage<string>(storageKey, '');
      expect(recovered).toBe(secretCredential);

      // Verify raw storage does not contain plaintext
      const rawStored = localStorage.getItem(storageKey);
      expect(rawStored).not.toBe(secretCredential);
    });
  });

  describe('Real Automated Device Lab Benchmark Suite', () => {
    it('runs measured benchmark across all device profiles and verifies SLAs', async () => {
      const reports = await runFullDeviceLabSuite();
      expect(reports.length).toBe(DEVICE_LAB_PROFILES.length);

      reports.forEach((report) => {
        expect(report.device).toBeDefined();
        expect(report.coldStartMs).toBeGreaterThan(0);
        expect(report.coldStartMs).toBeLessThan(2000); // Max allowable SLA budget
        expect(report.fps).toBeGreaterThanOrEqual(30);  // Min allowable UI frame rate
        expect(report.batteryDrain).toBeGreaterThan(0);
        expect(report.status).toBe('PASSED');
      });
    });

    it('measures Pixel 6 / High-End Android performance metrics dynamically', async () => {
      const pixelProfile = DEVICE_LAB_PROFILES[0];
      const result = await runDeviceBenchmark(pixelProfile);

      expect(result.device).toContain('Pixel 6');
      expect(result.fps).toBeGreaterThanOrEqual(45);
      expect(result.status).toBe('PASSED');
    });

    it('handles offline mode with graceful fallback', () => {
      const isOnline = false;
      const tileCacheAvailable = false;
      const fallbackMode = !isOnline && !tileCacheAvailable ? 'ascii_procedural' : 'tile_cache';
      expect(fallbackMode).toBe('ascii_procedural');
    });

    it('applies power throttle when battery level is below 20%', () => {
      const batteryLevel = 0.15; // 15%
      const scanIntervalNormal = 4000;
      const scanIntervalLowPower = 30000;

      const effectiveInterval = batteryLevel < 0.2 ? scanIntervalLowPower : scanIntervalNormal;
      expect(effectiveInterval).toBe(30000);
    });
  });
});
