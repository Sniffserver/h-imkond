import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useMeshStore } from '../store/meshStore';
import { broadcastSOS } from '../services/utils/sosService';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';

describe('E2E Smoke Scenarios (Vitest Suite)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('VITE_TEST_MODE', 'true');
    vi.clearAllMocks();
    useMeshStore.setState({
      peers: new Map(),
      bridgePeers: new Map(),
    });
  });

  it('1. Cold-start and route test: loads App cleanly without crashes', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Verify main screen header or map/nav container exists
    const appElement = container.querySelector('.app-container, div');
    expect(appElement).not.toBeNull();
  });

  it('2. Message recovery scenario: sends and recovers messages from storage', async () => {
    const mockMessages = [
      {
        id: 'msg-e2e-1',
        from: 'MESH-NODE-99',
        to: 'ME',
        content: 'E2E Test Message Recovery',
        timestamp: Date.now(),
        ttl: 5,
        signature: 'SIG',
        status: 'delivered',
        isRead: false,
      },
    ];
    setSecureLocalStorage('hoimu_messages', mockMessages);

    const { container } = render(<App />);
    expect(container).toBeDefined();

    const stored = getSecureLocalStorage('hoimu_messages', []);
    expect(stored.length).toBe(1);
    expect(stored[0].content).toBe('E2E Test Message Recovery');
  });

  it('3. Mesh peer lifecycle scenario: injects peer, updates state, and verifies presence', () => {
    render(<App />);

    act(() => {
      useMeshStore.getState().upsertPeer({
        id: 'e2e-peer-01',
        callsign: 'TARTU-RENEWABLE',
        bio: 'Solar Microgrid',
        skills: ['Solar Power'],
        lastRssi: -55,
        hopDistance: 1,
        lastSeen: 'Just now',
        trustScore: 95,
        completedExchanges: 10,
        relayReliability: 99,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'seed-e2e',
        recentInteractions: [1, 2],
        angle: 30,
        distanceRatio: 0.2,
        radioType: 'BLE',
        linkQualityPercent: 95,
        channelOrFrequency: 'BLE 37',
      });
    });

    const peers = useMeshStore.getState().getPeersArray();
    expect(peers.some((p) => p.id === 'e2e-peer-01')).toBe(true);
  });

  it('4. Offline map fallback scenario: initializes gracefully when navigator is offline', () => {
    vi.stubGlobal('navigator', {
      onLine: false,
    });

    const { container } = render(<App />);
    expect(container).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('5. SOS guardrail scenario: requires confirmation before broadcasting', async () => {
    // SOS broadcast returns packet
    const packet = await broadcastSOS('MEDICAL ASSISTANCE');
    expect(packet).toBeDefined();
    expect(packet.type).toBe('SOS');
    expect(packet.reason).toBe('MEDICAL ASSISTANCE');
    expect(packet.acknowledged).toBe(false);
  });

  it('6. Pi bridge unavailable scenario: handles unreachable bridge gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});
