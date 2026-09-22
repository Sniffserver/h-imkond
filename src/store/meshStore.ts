import { create } from 'zustand';
import { MeshNode, BridgePeer } from '../types';
import { INITIAL_PEERS } from '../data/initialData';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';
import { MeshStoreState, RevealedCircle, SyncPulseEvent } from './types';
import { buildUnifiedPeersArray } from './selectors';

export * from './types';
export * from './selectors';

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

export const useMeshStore = create<MeshStoreState>((set, get) => ({
  gpsPosition: null,
  peers: loadInitialPeersMap(),
  bridgePeers: new Map<string, BridgePeer>(),
  revealedCircles: loadInitialRevealedCircles(),
  activeLayer: 'infrastructure',
  showMeshNodes: loadInitialShowMeshNodes(),
  lastSyncTimestamp: Date.now(),
  lastSyncPulse: null,
  recentSyncPulses: {},

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

  triggerSyncPulse: (pulse) => {
    const now = Date.now();
    const event: SyncPulseEvent = {
      peerId: pulse?.peerId,
      callsign: pulse?.callsign,
      timestamp: pulse?.timestamp || now,
      packetCount: pulse?.packetCount ?? 1,
      isBackgroundSync: pulse?.isBackgroundSync ?? true,
    };

    const nextRecent = { ...get().recentSyncPulses };
    if (event.peerId) {
      nextRecent[event.peerId] = now;
    }
    if (event.callsign) {
      nextRecent[event.callsign] = now;
    }

    set({
      lastSyncPulse: event,
      lastSyncTimestamp: now,
      recentSyncPulses: nextRecent,
    });

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('hoimu:sync-pulse', { detail: event }));
      } catch {}
    }
  },

  clearSyncPulse: () => {
    set({ lastSyncPulse: null });
  },

  getPeersArray: () => {
    const { peers, bridgePeers } = get();
    return buildUnifiedPeersArray(peers, bridgePeers);
  },
}));
