import { describe, it, expect, beforeEach } from 'vitest';
import { offlineCapabilityService } from '../services/capabilities/offlineCapabilityService';
import { transformDomainToMapViewModel } from '../features/map/viewmodel/MapViewModel';
import { MeshNode } from '../types';

describe('OfflineCapabilities & Geometric Truth Verification', () => {
  it('evaluates real offline capabilities without hardcoded true fallbacks', async () => {
    const caps = await offlineCapabilityService.evaluateCapabilities({
      peers: [],
      messages: [],
    });

    expect(caps.map).toBe('ready');
    expect(caps.places).toBe('ready');
    // Before graph engine completes initialization, routing is partial
    expect(['ready', 'partial']).toContain(caps.routing);
    expect(caps.search).toBe('ready');
    expect(caps.messages).toBe('ready');
    // 0 peers in range without active radio -> unavailable
    expect(caps.mesh).toBe('unavailable');
  });

  it('reports mesh as ready when actual active peers exist', async () => {
    const mockPeer: MeshNode = {
      id: 'p1',
      callsign: 'SOLAR1',
      bio: '',
      skills: [],
      lastRssi: -55,
      hopDistance: 1,
      lastSeen: '1m ago',
      trustScore: 80,
      completedExchanges: 1,
      relayReliability: 95,
      isDirect: true,
      connectionState: 'direct',
      avatarSeed: 'seed',
      recentInteractions: [],
      angle: 0,
      distanceRatio: 0,
    };

    const caps = await offlineCapabilityService.evaluateCapabilities({
      peers: [mockPeer],
      messages: [],
    });

    expect(caps.mesh).toBe('ready');
  });

  it('MeshNode with no position produces NO geographic map marker (Unknown is valid state)', () => {
    const peers: MeshNode[] = [
      {
        id: 'gps_peer',
        callsign: 'GPS-PEER',
        bio: '',
        skills: [],
        lastRssi: -60,
        hopDistance: 1,
        lastSeen: 'now',
        trustScore: 90,
        completedExchanges: 0,
        relayReliability: 99,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: '',
        recentInteractions: [],
        angle: 45,
        distanceRatio: 0.5,
        location: { lat: 59.438, lng: 24.754 },
        locationProvenance: 'observed',
      },
      {
        id: 'no_gps_peer',
        callsign: 'NO-GPS',
        bio: '',
        skills: [],
        lastRssi: -75,
        hopDistance: 2,
        lastSeen: 'now',
        trustScore: 80,
        completedExchanges: 0,
        relayReliability: 90,
        isDirect: false,
        connectionState: 'relayed',
        avatarSeed: '',
        recentInteractions: [],
        angle: 120,
        distanceRatio: 0.8,
        // No location!
      },
    ];

    const vm = transformDomainToMapViewModel({
      peers,
      userLocation: { lat: 59.437, lng: 24.753 },
    });

    // Only the GPS peer gets a map marker
    expect(vm.peers).toHaveLength(1);
    expect(vm.peers[0].id).toBe('gps_peer');
    expect(vm.peers[0].locationProvenance).toBe('observed');
    expect(vm.peers[0].distanceProvenance).toBe('derived');
    expect(vm.peers[0].rssiProvenance).toBe('observed');

    // Zero fake mesh links synthesized
    expect(vm.meshLinks).toHaveLength(0);
  });
});
