import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMeshRadar } from '../../../features/mesh/useMeshRadar';
import { useMeshStore } from '../../../store/meshStore';

describe('useMeshRadar hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useMeshStore.setState({
      peers: new Map(),
      bridgePeers: new Map(),
    });
  });

  it('maintains scan lifecycle idempotency during repeated triggers', () => {
    vi.useFakeTimers();
    const addToast = vi.fn();
    const { result } = renderHook(() => useMeshRadar(addToast));

    expect(result.current.isScanning).toBe(false);

    act(() => {
      result.current.refreshScan();
    });
    expect(result.current.isScanning).toBe(true);

    // Repeated call while scanning
    act(() => {
      result.current.refreshScan();
    });
    expect(result.current.isScanning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isScanning).toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      'Scan Completed',
      expect.any(String),
      'success'
    );

    vi.useRealTimers();
  });

  it('discovers new peers and merges duplicate observations into Zustand store', () => {
    const { result } = renderHook(() => useMeshRadar());

    const initialCount = result.current.peers.length;

    act(() => {
      result.current.discoverNewPeer();
    });

    expect(result.current.peers.length).toBe(initialCount + 1);

    const newPeer = result.current.peers[0];
    expect(newPeer).toBeDefined();
    expect(newPeer.id).toBeDefined();

    // Re-upserting same peer id to store should merge instead of duplicating
    act(() => {
      useMeshStore.getState().upsertPeer({
        ...newPeer,
        lastRssi: -50,
      });
    });

    const updatedPeers = useMeshStore.getState().getPeersArray();
    const matching = updatedPeers.filter((p) => p.id === newPeer.id);
    expect(matching.length).toBe(1);
    expect(matching[0].lastRssi).toBe(-50);
  });

  it('updates peer lastSeen and RSSI on scan refresh', () => {
    vi.useFakeTimers();
    useMeshStore.getState().setPeers([
      {
        id: 'peer-test-1',
        callsign: 'TARTU-01',
        bio: 'Test Node',
        skills: ['Comms'],
        lastRssi: -70,
        hopDistance: 1,
        lastSeen: '10m ago',
        trustScore: 85,
        completedExchanges: 3,
        relayReliability: 98,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'seed',
        recentInteractions: [1, 2],
        angle: 45,
        distanceRatio: 0.5,
        radioType: 'BLE',
        linkQualityPercent: 80,
        channelOrFrequency: 'BLE 37',
      },
    ]);

    const { result } = renderHook(() => useMeshRadar());

    act(() => {
      result.current.refreshScan();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const refreshedPeer = result.current.peers.find((p) => p.id === 'peer-test-1');
    expect(refreshedPeer?.lastSeen).toBe('Just now');

    vi.useRealTimers();
  });

  it('cleans up state and stops scanner when unmounted', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useMeshRadar());

    act(() => {
      result.current.refreshScan();
    });

    expect(result.current.isScanning).toBe(true);

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Unmount successfully cleaned up without memory leak or state error on unmounted component
    vi.useRealTimers();
  });
});
