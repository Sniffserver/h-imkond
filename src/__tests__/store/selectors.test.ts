import { describe, it, expect, beforeEach } from 'vitest';
import { useMeshStore, selectPeersArray, selectMeshStatus, selectActiveLayer, selectShowMeshNodes } from '../../store/meshStore';
import { buildUnifiedPeersArray } from '../../store/selectors';
import { MeshNode, BridgePeer } from '../../types';

describe('Zustand Store & Selectors Isolation Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    useMeshStore.setState({
      gpsPosition: null,
      peers: new Map(),
      bridgePeers: new Map(),
      revealedCircles: [{ lat: 58.378, lng: 26.729, radius: 65 }],
      activeLayer: 'infrastructure',
      showMeshNodes: true,
      lastSyncTimestamp: 1000,
    });
  });

  describe('Unified Peer Merge Logic', () => {
    it('merges direct store peers and pi bridge peers seamlessly', () => {
      const peer1: MeshNode = {
        id: 'peer-1',
        callsign: 'TARTU-01',
        bio: 'Local Node',
        skills: ['Comms'],
        lastRssi: -75,
        hopDistance: 1,
        lastSeen: '1m ago',
        trustScore: 90,
        completedExchanges: 4,
        relayReliability: 98,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'seed1',
        recentInteractions: [1],
        angle: 120,
        distanceRatio: 0.4,
        radioType: 'BLE',
        linkQualityPercent: 80,
        channelOrFrequency: 'BLE 37',
      };

      const bridgePeer1: BridgePeer = {
        id: 'bridge-peer-2',
        callsign: 'LORA-RELAY-02',
        rssi: -62,
        protocol: 'lora',
        hops: 2,
        lastHeard: Date.now(),
      };

      const peersMap = new Map<string, MeshNode>([['peer-1', peer1]]);
      const bridgeMap = new Map<string, BridgePeer>([['bridge-peer-2', bridgePeer1]]);

      const unified = buildUnifiedPeersArray(peersMap, bridgeMap);
      expect(unified.length).toBe(2);

      const p1 = unified.find((p) => p.id === 'peer-1');
      expect(p1?.callsign).toBe('TARTU-01');

      const bp2 = unified.find((p) => p.id === 'bridge-peer-2');
      expect(bp2?.callsign).toBe('LORA-RELAY-02');
      expect(bp2?.hopDistance).toBe(2);
      expect(bp2?.radioType).toBe('LoRa 868MHz');
    });

    it('enriches existing peer with latest RSSI and hop distance when present in both maps', () => {
      const peer1: MeshNode = {
        id: 'shared-node-01',
        callsign: 'ROWAN-RIDGE',
        bio: 'Shared Node',
        skills: [],
        lastRssi: -85,
        hopDistance: 2,
        lastSeen: '5m ago',
        trustScore: 88,
        completedExchanges: 2,
        relayReliability: 95,
        isDirect: false,
        connectionState: 'relayed',
        avatarSeed: 'seed-shared',
        recentInteractions: [],
        angle: 90,
        distanceRatio: 0.6,
        radioType: 'BLE',
        linkQualityPercent: 60,
        channelOrFrequency: 'BLE 37',
      };

      const bridgePeer1: BridgePeer = {
        id: 'shared-node-01',
        callsign: 'ROWAN-RIDGE',
        rssi: -58, // Stronger RSSI from Pi Bridge
        protocol: 'lora',
        hops: 1, // Direct link from Pi Bridge
        lastHeard: Date.now(),
      };

      const peersMap = new Map<string, MeshNode>([['shared-node-01', peer1]]);
      const bridgeMap = new Map<string, BridgePeer>([['shared-node-01', bridgePeer1]]);

      const unified = buildUnifiedPeersArray(peersMap, bridgeMap);
      expect(unified.length).toBe(1);
      expect(unified[0].lastRssi).toBe(-58);
      expect(unified[0].hopDistance).toBe(1);
    });
  });

  describe('Selector Purity & Memoization', () => {
    it('returns exact same memoized array reference when state maps have not mutated', () => {
      const peersMap = new Map<string, MeshNode>();
      const bridgeMap = new Map<string, BridgePeer>();

      const array1 = buildUnifiedPeersArray(peersMap, bridgeMap);
      const array2 = buildUnifiedPeersArray(peersMap, bridgeMap);

      expect(array1).toBe(array2); // Same reference
    });
  });

  describe('Stale Peer Filtering & Targeted Action Updates', () => {
    it('updates only targeted peer fields without corrupting other store state', () => {
      const p1: MeshNode = {
        id: 'node-a',
        callsign: 'ALPHA',
        bio: '',
        skills: [],
        lastRssi: -70,
        hopDistance: 1,
        lastSeen: '1m ago',
        trustScore: 80,
        completedExchanges: 1,
        relayReliability: 90,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'a',
        recentInteractions: [],
        angle: 0,
        distanceRatio: 0.1,
        radioType: 'BLE',
        linkQualityPercent: 80,
        channelOrFrequency: '',
      };

      const p2: MeshNode = {
        id: 'node-b',
        callsign: 'BETA',
        bio: '',
        skills: [],
        lastRssi: -75,
        hopDistance: 1,
        lastSeen: '1m ago',
        trustScore: 85,
        completedExchanges: 2,
        relayReliability: 92,
        isDirect: true,
        connectionState: 'direct',
        avatarSeed: 'b',
        recentInteractions: [],
        angle: 180,
        distanceRatio: 0.2,
        radioType: 'BLE',
        linkQualityPercent: 75,
        channelOrFrequency: '',
      };

      useMeshStore.getState().setPeers([p1, p2]);

      // Update node-a only
      useMeshStore.getState().updatePeer('node-a', { trustScore: 99 });

      const updatedMap = useMeshStore.getState().peers;
      expect(updatedMap.get('node-a')?.trustScore).toBe(99);
      expect(updatedMap.get('node-b')?.trustScore).toBe(85); // Unchanged!
    });

    it('filters stale peers using timestamp thresholds', () => {
      const now = Date.now();
      const freshPeer: BridgePeer = {
        id: 'fresh-1',
        callsign: 'FRESH-NODE',
        rssi: -60,
        protocol: 'ble',
        hops: 1,
        lastHeard: now - 1000 * 60 * 2, // 2 minutes ago
      };

      const stalePeer: BridgePeer = {
        id: 'stale-1',
        callsign: 'STALE-NODE',
        rssi: -90,
        protocol: 'ble',
        hops: 3,
        lastHeard: now - 1000 * 60 * 30, // 30 minutes ago
      };

      const bridgeMap = new Map<string, BridgePeer>([
        ['fresh-1', freshPeer],
        ['stale-1', stalePeer],
      ]);

      const STALE_THRESHOLD_MS = 1000 * 60 * 15; // 15 minutes
      const activePeers = Array.from(bridgeMap.values()).filter(
        (p) => now - p.lastHeard < STALE_THRESHOLD_MS
      );

      expect(activePeers.length).toBe(1);
      expect(activePeers[0].id).toBe('fresh-1');
    });
  });
});
