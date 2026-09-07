import { MeshNode, BridgePeer } from '../types';
import { MeshState } from './types';

// Convert a BridgePeer to a MeshNode if not already in peers Map
function convertBridgePeerToMeshNode(bp: BridgePeer): MeshNode {
  return {
    id: bp.id,
    callsign: bp.callsign || bp.id,
    bio: `Relay node heard via Pi Bridge (${bp.protocol.toUpperCase()}, ${bp.hops} hop${bp.hops > 1 ? 's' : ''})`,
    skills: [bp.protocol === 'lora' ? 'LoRa 868MHz' : 'BLE Coded PHY', 'Pi Hardware Relay'],
    lastRssi: bp.rssi,
    hopDistance: bp.hops,
    lastSeen: new Date(bp.lastHeard).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    trustScore: 92,
    reputationScore: 88,
    completedExchanges: 5,
    relayReliability: 99.2,
    isDirect: bp.hops === 1,
    connectionState: bp.hops === 1 ? 'direct' : 'relayed',
    avatarSeed: bp.id,
    recentInteractions: [12, 18, 22, 30, 42],
    angle: (Math.abs(bp.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) * 37) % 360,
    distanceRatio: Math.min(0.85, 0.2 + bp.hops * 0.22),
    radioType: bp.protocol === 'lora' ? ('LoRa 868MHz' as any) : 'BLE',
    linkQualityPercent: Math.max(10, Math.min(100, 100 + bp.rssi)),
    channelOrFrequency: bp.protocol === 'lora' ? 'LoRa 868.1 MHz' : 'BLE 5.2 Coded PHY',
    relayedPackets: 210,
  };
}

// Cached array of unified peers
let cachedPeersMapRef: Map<string, MeshNode> | null = null;
let cachedBridgePeersMapRef: Map<string, BridgePeer> | null = null;
let cachedPeersArrayRef: MeshNode[] = [];

export function buildUnifiedPeersArray(
  peers: Map<string, MeshNode>,
  bridgePeers: Map<string, BridgePeer>
): MeshNode[] {
  if (cachedPeersMapRef === peers && cachedBridgePeersMapRef === bridgePeers) {
    return cachedPeersArrayRef;
  }

  const merged = new Map<string, MeshNode>(peers);

  bridgePeers.forEach((bp, id) => {
    if (!merged.has(id)) {
      merged.set(id, convertBridgePeerToMeshNode(bp));
    } else {
      // Enrich existing node with latest RSSI and protocol from bridge
      const existing = merged.get(id)!;
      merged.set(id, {
        ...existing,
        lastRssi: bp.rssi,
        hopDistance: Math.min(existing.hopDistance, bp.hops),
        radioType: bp.protocol === 'lora' ? ('LoRa 868MHz' as any) : existing.radioType,
      });
    }
  });

  cachedPeersMapRef = peers;
  cachedBridgePeersMapRef = bridgePeers;
  cachedPeersArrayRef = Array.from(merged.values());
  return cachedPeersArrayRef;
}

/**
 * Custom selector to get a stable reference to the unified peers array.
 */
export const selectPeersArray = (state: MeshState): MeshNode[] => {
  return buildUnifiedPeersArray(state.peers, state.bridgePeers);
};

/**
 * Selects the last sync timestamp status.
 */
export const selectMeshStatus = (state: MeshState) => state.lastSyncTimestamp;

/**
 * Selects the active map layer.
 */
export const selectActiveLayer = (state: MeshState) => state.activeLayer;

/**
 * Selects whether to show mesh nodes.
 */
export const selectShowMeshNodes = (state: MeshState) => state.showMeshNodes;
