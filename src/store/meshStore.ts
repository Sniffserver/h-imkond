import { create } from 'zustand';
import { MeshNode, BridgePeer } from '../types';
import { INITIAL_PEERS } from '../data/initialData';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';

export type ActiveMapLayerType = 'terrain' | 'infrastructure' | 'mesh';

export interface GpsCoordinate {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface RevealedCircle {
  lat: number;
  lng: number;
  radius: number;
}

export interface MeshStoreState {
  // Required Core State
  gpsPosition: GpsCoordinate | null;
  peers: Map<string, MeshNode>;
  bridgePeers: Map<string, BridgePeer>;
  revealedCircles: RevealedCircle[];
  activeLayer: ActiveMapLayerType;
  showMeshNodes: boolean;
  lastSyncTimestamp: number | null;

  // Actions
  setGpsPosition: (pos: GpsCoordinate | null) => void;
  setPeers: (peers: MeshNode[] | Map<string, MeshNode>) => void;
  setBridgePeers: (bPeers: BridgePeer[] | Map<string, BridgePeer>) => void;
  upsertBridgePeer: (peer: BridgePeer) => void;
  upsertPeer: (peer: MeshNode) => void;
  updatePeer: (id: string, updates: Partial<MeshNode>) => void;
  removePeer: (id: string) => void;
  setRevealedCircles: (circles: RevealedCircle[]) => void;
  addRevealedCircle: (circle: RevealedCircle) => void;
  setActiveLayer: (layer: ActiveMapLayerType) => void;
  setShowMeshNodes: (show: boolean) => void;
  setLastSyncTimestamp: (timestamp: number | null) => void;

  // Helper Getters
  getPeersArray: () => MeshNode[];
}

const loadInitialPeersMap = (): Map<string, MeshNode> => {
  try {
    const parsed = getSecureLocalStorage<MeshNode[]>('hoimu_peers', []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return new Map(parsed.map((p: MeshNode) => [p.id, p]));
    }
  } catch (e) {
    console.warn('[meshStore] Could not load persisted peers:', e);
  }
  return new Map(INITIAL_PEERS.map((p) => [p.id, p]));
};

const loadInitialShowMeshNodes = (): boolean => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('hoimu_map_show_mesh_nodes');
      if (saved !== null) return saved === 'true';
    }
  } catch {}
  return true;
};

const loadInitialRevealedCircles = (): RevealedCircle[] => {
  try {
    const parsed = getSecureLocalStorage<RevealedCircle[]>('hoimu_revealed_circles_geo', []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {}
  // Default centered on Tartu Bioregion
  return [{ lat: 58.3780, lng: 26.7290, radius: 65 }];
};

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

function buildUnifiedPeersArray(
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

export const useMeshStore = create<MeshStoreState>((set, get) => ({
  gpsPosition: null,
  peers: loadInitialPeersMap(),
  bridgePeers: new Map<string, BridgePeer>(),
  revealedCircles: loadInitialRevealedCircles(),
  activeLayer: 'infrastructure',
  showMeshNodes: loadInitialShowMeshNodes(),
  lastSyncTimestamp: Date.now(),

  setGpsPosition: (pos) => {
    set({ gpsPosition: pos });
  },

  setPeers: (newPeers) => {
    const map = newPeers instanceof Map
      ? new Map(newPeers)
      : new Map(newPeers.map((p) => [p.id, p]));

    // Persist to local storage
    try {
      setSecureLocalStorage('hoimu_peers', Array.from(map.values()));
    } catch {}

    set({ peers: map, lastSyncTimestamp: Date.now() });
  },

  setBridgePeers: (newBPeers) => {
    const map = newBPeers instanceof Map
      ? new Map(newBPeers)
      : new Map(newBPeers.map((bp) => [bp.id, bp]));

    set({ bridgePeers: map, lastSyncTimestamp: Date.now() });
  },

  upsertBridgePeer: (bp) => {
    set((state) => {
      const nextMap = new Map(state.bridgePeers);
      nextMap.set(bp.id, bp);
      return { bridgePeers: nextMap, lastSyncTimestamp: Date.now() };
    });
  },

  upsertPeer: (peer) => {
    set((state) => {
      const nextMap = new Map(state.peers);
      nextMap.set(peer.id, { ...(nextMap.get(peer.id) || {}), ...peer });
      try {
        setSecureLocalStorage('hoimu_peers', Array.from(nextMap.values()));
      } catch {}
      return { peers: nextMap, lastSyncTimestamp: Date.now() };
    });
  },

  updatePeer: (id, updates) => {
    set((state) => {
      const current = state.peers.get(id);
      if (!current) return state;
      const nextMap = new Map(state.peers);
      nextMap.set(id, { ...current, ...updates });
      return { peers: nextMap };
    });
  },

  removePeer: (id) => {
    set((state) => {
      if (!state.peers.has(id)) return state;
      const nextMap = new Map(state.peers);
      nextMap.delete(id);
      return { peers: nextMap };
    });
  },

  setRevealedCircles: (circles) => {
    try {
      setSecureLocalStorage('hoimu_revealed_circles_geo', circles);
    } catch {}
    set({ revealedCircles: circles });
  },

  addRevealedCircle: (circle) => {
    set((state) => {
      const isDuplicate = state.revealedCircles.some(
        (c) =>
          Math.abs(c.lat - circle.lat) < 0.00015 &&
          Math.abs(c.lng - circle.lng) < 0.00025
      );
      if (isDuplicate) return state;

      const next = [...state.revealedCircles, circle];
      try {
        setSecureLocalStorage('hoimu_revealed_circles_geo', next);
      } catch {}
      return { revealedCircles: next };
    });
  },

  setActiveLayer: (layer) => {
    set({ activeLayer: layer });
  },

  setShowMeshNodes: (show) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hoimu_map_show_mesh_nodes', String(show));
      }
    } catch {}
    set({ showMeshNodes: show });
  },

  setLastSyncTimestamp: (timestamp) => {
    set({ lastSyncTimestamp: timestamp });
  },

  getPeersArray: () => {
    const { peers, bridgePeers } = get();
    return buildUnifiedPeersArray(peers, bridgePeers);
  },
}));

/**
 * Custom selector to get a stable reference to the unified peers array.
 */
export const selectPeersArray = (state: MeshStoreState): MeshNode[] => {
  return buildUnifiedPeersArray(state.peers, state.bridgePeers);
};
