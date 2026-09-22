import { MeshNode, BridgePeer } from '../types';

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

export interface SyncPulseEvent {
  peerId?: string;
  callsign?: string;
  timestamp: number;
  packetCount?: number;
  isBackgroundSync?: boolean;
}

export interface MeshState {
  gpsPosition: GpsCoordinate | null;
  peers: Map<string, MeshNode>;
  bridgePeers: Map<string, BridgePeer>;
  revealedCircles: RevealedCircle[];
  activeLayer: ActiveMapLayerType;
  showMeshNodes: boolean;
  lastSyncTimestamp: number | null;
  lastSyncPulse: SyncPulseEvent | null;
  recentSyncPulses: Record<string, number>;
}

export interface MeshActions {
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
  triggerSyncPulse: (pulse?: Partial<SyncPulseEvent>) => void;
  clearSyncPulse: () => void;

  getPeersArray: () => MeshNode[];
}

export type MeshStoreState = MeshState & MeshActions;
