import { describe, it, expect } from 'vitest';
import { calculateMeshHealthScore } from '../utils/meshHealthCalculator';
import { MeshNode } from '../types';

describe('calculateMeshHealthScore', () => {
  it('returns default offline metric when peers list is empty', () => {
    const metrics = calculateMeshHealthScore([]);
    expect(metrics.overallScore).toBe(0);
    expect(metrics.statusLabel).toBe('Offline / Searching');
    expect(metrics.totalPeersCount).toBe(0);
    expect(metrics.activeRelayCount).toBe(0);
  });

  it('calculates optimal score for high quality direct & relay peers', () => {
    const mockPeers: MeshNode[] = [
      {
        id: 'peer-1',
        callsign: 'Tuulemäe Node',
        bio: 'Tuulemäe permaculture hub main relay',
        skills: ['Solar PV', 'Rainwater Harvesting'],
        lastRssi: -45,
        hopDistance: 1,
        isDirect: true,
        connectionState: 'direct',
        lastSeen: new Date().toISOString(),
        trustScore: 95,
        completedExchanges: 12,
        relayReliability: 98,
        avatarSeed: 'seed1',
        recentInteractions: [2, 5, 4],
        angle: 45,
        distanceRatio: 0.25,
      },
      {
        id: 'peer-2',
        callsign: 'Saare Kogu Relay',
        bio: 'Shared community hub transceiver node',
        skills: ['LoRa Mesh', 'Seed Saving'],
        lastRssi: -52,
        hopDistance: 2,
        isDirect: false,
        connectionState: 'relayed',
        lastSeen: new Date().toISOString(),
        trustScore: 88,
        completedExchanges: 8,
        relayReliability: 96,
        avatarSeed: 'seed2',
        recentInteractions: [1, 2],
        angle: 120,
        distanceRatio: 0.5,
      },
    ];

    const metrics = calculateMeshHealthScore(mockPeers);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(80);
    expect(metrics.totalPeersCount).toBe(2);
    expect(metrics.avgRssiDbm).toBe(-48);
    expect(metrics.activeRelayCount).toBe(1);
    expect(metrics.directPeerCount).toBe(1);
    expect(metrics.statusLabel).toContain('Health');
  });

  it('correctly degrades score when signal strength RSSI is very weak', () => {
    const weakPeers: MeshNode[] = [
      {
        id: 'peer-weak',
        callsign: 'Metsa Edge Node',
        bio: 'Weak node at the forest edge',
        skills: ['Foraging'],
        lastRssi: -95,
        hopDistance: 3,
        isDirect: false,
        connectionState: 'store_forward',
        lastSeen: new Date().toISOString(),
        trustScore: 60,
        completedExchanges: 1,
        relayReliability: 70,
        avatarSeed: 'seed3',
        recentInteractions: [0, 1],
        angle: 270,
        distanceRatio: 0.9,
      },
    ];

    const metrics = calculateMeshHealthScore(weakPeers);
    expect(metrics.rssiScore).toBeLessThan(30);
    expect(metrics.recommendation).toContain('signal strength is low');
  });

  it('computes accurate node density and hop distribution metrics', () => {
    const clusterPeers: MeshNode[] = [
      {
        id: 'p1',
        callsign: 'Node Alpha',
        bio: 'Alpha',
        skills: ['Solar'],
        lastRssi: -55,
        hopDistance: 1,
        isDirect: true,
        connectionState: 'direct',
        lastSeen: new Date().toISOString(),
        trustScore: 90,
        completedExchanges: 5,
        relayReliability: 95,
        avatarSeed: 'p1',
        recentInteractions: [1],
        angle: 10,
        distanceRatio: 0.2,
      },
      {
        id: 'p2',
        callsign: 'Node Beta',
        bio: 'Beta',
        skills: ['Radio'],
        lastRssi: -65,
        hopDistance: 1,
        isDirect: true,
        connectionState: 'direct',
        lastSeen: new Date().toISOString(),
        trustScore: 85,
        completedExchanges: 3,
        relayReliability: 90,
        avatarSeed: 'p2',
        recentInteractions: [1],
        angle: 45,
        distanceRatio: 0.3,
      },
      {
        id: 'p3',
        callsign: 'Node Gamma',
        bio: 'Gamma',
        skills: ['Tools'],
        lastRssi: -88,
        hopDistance: 2,
        isDirect: false,
        connectionState: 'relayed',
        lastSeen: new Date().toISOString(),
        trustScore: 70,
        completedExchanges: 2,
        relayReliability: 85,
        avatarSeed: 'p3',
        recentInteractions: [1],
        angle: 180,
        distanceRatio: 0.8,
      },
    ];

    const metrics = calculateMeshHealthScore(clusterPeers);
    expect(metrics.totalPeersCount).toBe(3);
    expect(metrics.immediateBleNodesCount).toBe(2); // -55 dBm and -65 dBm are >= -70 dBm
    expect(metrics.nodesPerHopBreakdown.immediate).toBe(2);
    expect(metrics.nodesPerHopBreakdown.direct).toBe(2);
    expect(metrics.nodesPerHopBreakdown.relayed).toBe(1);
    expect(metrics.nodesPerHopBreakdown.fringe).toBe(1); // -88 dBm is <= -85 dBm
    expect(metrics.nodeDensityScore).toBeGreaterThan(50);
  });
});
