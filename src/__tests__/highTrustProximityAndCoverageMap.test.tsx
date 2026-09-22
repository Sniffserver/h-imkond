import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  isHighTrustPeer,
  isImmediateBleProximity,
  highTrustProximityManager,
  IMMEDIATE_BLE_RSSI_THRESHOLD,
} from '../services/mesh/highTrustProximityService';
import { soundFeedback } from '../services/utils/soundFeedback';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';
import { D3MeshSignalCoverageMap } from '../features/map/components/D3MeshSignalCoverageMap';
import { MeshNode, UserProfile } from '../types';

const mockUser: UserProfile = {
  id: 'usr_self',
  callsign: 'Kestrel-7',
  bio: 'Local solar station runner',
  skills: ['Solar Inverters', 'Ham Radio'],
  offeredResources: ['LiFePO4 Cells'],
  symbiosisScore: 88,
  completedExchanges: 14,
  meshVisible: true,
  avatarSeed: 'user-kestrel-7',
  symbiosisHistory: [{ date: '2026-01-01', score: 88 }],
};

const mockPeers: MeshNode[] = [
  {
    id: 'peer_high_trust_close',
    callsign: 'Fern-Spire',
    bio: 'Resilient node steward',
    skills: ['Solar Power'],
    lastRssi: -58, // > -70 dBm (Immediate range)
    hopDistance: 1,
    lastSeen: 'Just now',
    trustScore: 92,
    reputationTier: 'Steward',
    completedExchanges: 18,
    relayReliability: 99.4,
    isDirect: true,
    connectionState: 'direct',
    avatarSeed: 'seed-fern',
    recentInteractions: [10, 20, 30],
    angle: 45,
    distanceRatio: 0.25,
    radioType: 'BLE',
  },
  {
    id: 'peer_low_trust_close',
    callsign: 'Unknown-Wanderer',
    bio: 'Transiting stranger',
    skills: ['Water Filter'],
    lastRssi: -52, // > -70 dBm but low trust
    hopDistance: 1,
    lastSeen: 'Just now',
    trustScore: 40,
    reputationTier: 'New Kin',
    completedExchanges: 0,
    relayReliability: 70.0,
    isDirect: true,
    connectionState: 'direct',
    avatarSeed: 'seed-unknown',
    recentInteractions: [1],
    angle: 180,
    distanceRatio: 0.2,
    radioType: 'BLE',
  },
  {
    id: 'peer_high_trust_distant',
    callsign: 'Birch-Ridge',
    bio: 'Forest mountain relay',
    skills: ['Permaculture'],
    lastRssi: -84, // <= -70 dBm (Fringe range)
    hopDistance: 2,
    lastSeen: '2m ago',
    trustScore: 95,
    reputationTier: 'Verified Peer',
    completedExchanges: 22,
    relayReliability: 98.1,
    isDirect: false,
    connectionState: 'relayed',
    avatarSeed: 'seed-birch',
    recentInteractions: [15, 25],
    angle: 270,
    distanceRatio: 0.8,
    radioType: 'BLE',
  },
];

describe('High-Trust Immediate Bluetooth Proximity & D3 Coverage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    highTrustProximityManager.reset();
  });

  describe('Feature 1: High-Trust Proximity Evaluation & Notification Engine', () => {
    it('accurately identifies High-Trust peers based on reputationTier, trustScore, and exchanges', () => {
      expect(isHighTrustPeer(mockPeers[0])).toBe(true); // Steward, trustScore 92
      expect(isHighTrustPeer(mockPeers[1])).toBe(false); // New Kin, trustScore 40
      expect(isHighTrustPeer(mockPeers[2])).toBe(true); // Verified Peer, trustScore 95

      // Borderline cases
      expect(isHighTrustPeer({ ...mockPeers[1], trustScore: 78 })).toBe(true);
      expect(isHighTrustPeer({ ...mockPeers[1], completedExchanges: 10 })).toBe(true);
      expect(isHighTrustPeer({ ...mockPeers[1], reputationTier: 'Pillar of Trust' })).toBe(true);
    });

    it('correctly checks immediate Bluetooth discovery range (RSSI > -70 dBm)', () => {
      expect(isImmediateBleProximity(mockPeers[0])).toBe(true); // -58 dBm > -70 dBm
      expect(isImmediateBleProximity(mockPeers[1])).toBe(true); // -52 dBm > -70 dBm
      expect(isImmediateBleProximity(mockPeers[2])).toBe(false); // -84 dBm <= -70 dBm
      expect(IMMEDIATE_BLE_RSSI_THRESHOLD).toBe(-70);
    });

    it('triggers audible chime, haptic vibration, and a11y announcement when high-trust peer enters immediate BLE range', () => {
      const playSpy = vi.spyOn(soundFeedback, 'playHighTrustProximityNotification').mockImplementation(() => {});
      const announceSpy = vi.spyOn(a11yAnnouncer, 'announce').mockImplementation(() => {});
      const toastMock = vi.fn();

      const triggered = highTrustProximityManager.checkAndNotify(mockPeers, toastMock);

      expect(triggered).toHaveLength(1);
      expect(triggered[0].callsign).toBe('Fern-Spire');

      // Audio & Haptic verification
      expect(playSpy).toHaveBeenCalledTimes(1);

      // A11y accessibility voice announcement
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining('High-trust peer Fern-Spire'),
        'assertive'
      );

      // Toast feedback verification
      expect(toastMock).toHaveBeenCalledWith(
        expect.stringContaining('High-Trust Peer in Range: Fern-Spire'),
        expect.stringContaining('-58 dBm'),
        'success'
      );
    });

    it('does not trigger for low trust peers even if RSSI is strong (> -70 dBm)', () => {
      const playSpy = vi.spyOn(soundFeedback, 'playHighTrustProximityNotification').mockImplementation(() => {});
      const toastMock = vi.fn();

      const triggered = highTrustProximityManager.checkAndNotify(mockPeers[1], toastMock);

      expect(triggered).toHaveLength(0);
      expect(playSpy).not.toHaveBeenCalled();
      expect(toastMock).not.toHaveBeenCalled();
    });

    it('does not trigger for high trust peers if RSSI is outside immediate range (RSSI <= -70 dBm)', () => {
      const playSpy = vi.spyOn(soundFeedback, 'playHighTrustProximityNotification').mockImplementation(() => {});
      const toastMock = vi.fn();

      const triggered = highTrustProximityManager.checkAndNotify(mockPeers[2], toastMock);

      expect(triggered).toHaveLength(0);
      expect(playSpy).not.toHaveBeenCalled();
      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  describe('Feature 2: D3 Mesh Signal Strength & Optimal Placement Visualization', () => {
    it('renders D3MeshSignalCoverageMap with coverage telemetry HUD and controls', () => {
      render(
        <D3MeshSignalCoverageMap
          peers={mockPeers}
          user={mockUser}
          isNightMode={false}
        />
      );

      // Verify Header Telemetry HUD
      expect(screen.getByText(/Mesh Coverage Index/i)).toBeDefined();
      expect(screen.getAllByText(/Forest\/Suburban/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Simulate Placement/i)).toBeDefined();

      // Verify Layer Toggle Buttons
      expect(screen.getByText(/Signal Heatmap/i)).toBeDefined();
      expect(screen.getByText(/RSSI Rings/i)).toBeDefined();
      expect(screen.getByText(/Optimal Relays/i)).toBeDefined();
      expect(screen.getByText(/Bearings/i)).toBeDefined();
    });

    it('allows toggling virtual repeater placement simulation mode', () => {
      const toastMock = vi.fn();
      const { container } = render(
        <D3MeshSignalCoverageMap
          peers={mockPeers}
          user={mockUser}
          onAddToast={toastMock}
        />
      );

      const simButton = container.querySelector('#btn-simulate-placement');
      expect(simButton).not.toBeNull();
      fireEvent.click(simButton!);

      expect(screen.getByText(/Click to Place Relay/i)).toBeDefined();
      expect(toastMock).toHaveBeenCalledWith(
        'Placement Simulator Active',
        expect.stringContaining('virtual solar repeater'),
        'info'
      );
    });

    it('allows switching RF environment terrain models (Open field, Dense urban)', () => {
      render(
        <D3MeshSignalCoverageMap
          peers={mockPeers}
          user={mockUser}
        />
      );

      const selectElems = screen.getAllByTitle('Select RF Path Loss Terrain Model');
      expect(selectElems.length).toBeGreaterThan(0);
      fireEvent.change(selectElems[0], { target: { value: 'open_field' } });

      expect(screen.getAllByText(/Open Field/i).length).toBeGreaterThan(0);
    });
  });
});
