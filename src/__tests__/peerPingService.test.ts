import { describe, it, expect } from 'vitest';
import { peerPingService } from '../services/mesh/peerPingService';
import { MeshNode } from '../types';

describe('peerPingService', () => {
  const directPeer: MeshNode = {
    id: 'test-direct-peer-1',
    callsign: 'Tuuleväli Node',
    bio: 'Direct peer',
    skills: ['Solar'],
    lastRssi: -50,
    hopDistance: 1,
    isDirect: true,
    connectionState: 'direct',
    lastSeen: new Date().toISOString(),
    trustScore: 92,
    completedExchanges: 6,
    relayReliability: 98,
    avatarSeed: 'seed-test-1',
    recentInteractions: [1],
    angle: 0,
    distanceRatio: 0.2,
  };

  const multiHopPeer: MeshNode = {
    id: 'test-multihop-peer-2',
    callsign: 'Metsanurk Relay',
    bio: 'Multi-hop relay peer',
    skills: ['Radio'],
    lastRssi: -82,
    hopDistance: 3,
    isDirect: false,
    connectionState: 'relayed',
    lastSeen: new Date().toISOString(),
    trustScore: 78,
    completedExchanges: 2,
    relayReliability: 88,
    avatarSeed: 'seed-test-2',
    recentInteractions: [1],
    angle: 120,
    distanceRatio: 0.85,
  };

  it('sends low-energy BLE heartbeat packet and measures realistic RTT latency', async () => {
    const result = await peerPingService.pingPeer(directPeer);
    expect(result.success).toBe(true);
    expect(result.peerId).toBe(directPeer.id);
    expect(result.packetSizeBytes).toBe(16); // 16-byte low power BLE packet
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.isDirectBle).toBe(true);
    expect(result.status).toBeDefined();
  });

  it('records ping history for the peer', async () => {
    await peerPingService.pingPeer(directPeer);
    const history = peerPingService.getPingHistory(directPeer.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].peerId).toBe(directPeer.id);
  });

  it('handles multi-hop peer pings with appropriate hop modeling', async () => {
    const result = await peerPingService.pingPeer(multiHopPeer);
    expect(result.success).toBe(true);
    expect(result.hopCount).toBe(3);
    expect(result.isDirectBle).toBe(false);
  });
});
