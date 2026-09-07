import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSos } from '../../../features/sos/useSos';
import {
  broadcastSOS,
  acknowledgeSos,
  getActiveSosAlerts,
  getAllSosHistory,
  initSosService,
  clearSosServiceForTesting,
} from '../../../services/utils/sosService';

describe('useSos & SOS Emergency Protocol Service', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSosServiceForTesting();
    vi.clearAllMocks();
  });

  describe('SOS Packet Schema & Guardrails', () => {
    it('constructs a valid SOS packet schema with explicit defaults', async () => {
      const packet = await broadcastSOS('MEDICAL ASSISTANCE NEEDED', 58.378, 26.729);

      expect(packet).toBeDefined();
      expect(packet.type).toBe('SOS');
      expect(packet.from).toBeDefined();
      expect(packet.lat).toBe(58.378);
      expect(packet.lng).toBe(26.729);
      expect(packet.ttl).toBe(10);
      expect(packet.reason).toBe('MEDICAL ASSISTANCE NEEDED');
      expect(packet.acknowledged).toBe(false);
      expect(packet.id).toContain(packet.from);
    });

    it('falls back to default regional coordinates when location is unavailable', async () => {
      const packet = await broadcastSOS('GENERAL EMERGENCY', undefined, undefined);

      expect(packet.lat).toBe(47.6062);
      expect(packet.lng).toBe(-122.3321);
    });
  });

  describe('Offline Queue & Persistence', () => {
    it('persists emergency broadcast packets to localStorage for offline queueing', async () => {
      await broadcastSOS('COMMUNITY POWER GRID FAILURE');

      const storedHistoryRaw = localStorage.getItem('hoimu_sos_history');
      expect(storedHistoryRaw).not.toBeNull();

      const storedHistory = JSON.parse(storedHistoryRaw!);
      expect(storedHistory.length).toBeGreaterThan(0);
      expect(storedHistory[0].reason).toBe('COMMUNITY POWER GRID FAILURE');

      const broadcastPacketRaw = localStorage.getItem('hoimu_sos_broadcast_packet');
      expect(broadcastPacketRaw).not.toBeNull();
      const broadcastObj = JSON.parse(broadcastPacketRaw!);
      expect(broadcastObj.type).toBe('SOS');
    });

    it('reloads offline queued SOS packets on service initialization', async () => {
      const mockOfflinePackets = [
        {
          type: 'SOS',
          from: 'OFFLINE-NODE-01',
          lat: 58.38,
          lng: 26.73,
          timestamp: Date.now() - 5000,
          ttl: 8,
          reason: 'FLOOD ALERT',
          id: 'sos_offline_123',
          acknowledged: false,
        },
      ];
      localStorage.setItem('hoimu_sos_history', JSON.stringify(mockOfflinePackets));

      initSosService();
      const active = getActiveSosAlerts();
      expect(active.length).toBe(1);
      expect(active[0].from).toBe('OFFLINE-NODE-01');
    });
  });

  describe('Cancellation and Acknowledgement Path', () => {
    it('allows cancelling / acknowledging an active SOS alert', async () => {
      const packet = await broadcastSOS('CANCEL TEST');
      expect(getActiveSosAlerts().some((a) => a.id === packet.id)).toBe(true);

      act(() => {
        acknowledgeSos(packet.id);
      });

      expect(getActiveSosAlerts().some((a) => a.id === packet.id)).toBe(false);

      const allHistory = getAllSosHistory();
      const acked = allHistory.find((a) => a.id === packet.id);
      expect(acked?.acknowledged).toBe(true);
    });
  });

  describe('useSos React Hook', () => {
    it('manages crisis mode toggle and local alerts list state', () => {
      const { result } = renderHook(() => useSos());

      expect(result.current.isCrisisMode).toBe(false);

      act(() => {
        result.current.setIsCrisisMode(true);
      });
      expect(result.current.isCrisisMode).toBe(true);

      act(() => {
        result.current.broadcastAlert({
          type: 'Other',
          message: 'Extreme Heatwave - Cooling center open at community hub.',
          locationName: 'Tartu Central Square',
          severity: 'High',
        });
      });

      expect(result.current.crisisAlerts.length).toBeGreaterThan(0);
      expect(result.current.crisisAlerts[0].message).toContain('Extreme Heatwave');
    });
  });
});
