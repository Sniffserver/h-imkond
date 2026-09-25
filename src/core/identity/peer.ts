/**
 * Canonical Peer Model (HÕIMU Core)
 * Single source of truth for peer discovery, capabilities, and last active tracking.
 */

export interface PeerCapability {
  relay: boolean;
  gateway: boolean;
  storage: boolean;
  powerSource: 'battery' | 'mains' | 'solar';
}

export interface Peer {
  id: string; // NodeId / Callsign (e.g. "TARTU-02")
  signingPublicKey: string; // 64-hex char Ed25519 public key
  encryptionPublicKey?: string;
  trustLevel: 'unverified' | 'verified' | 'trusted' | 'blocked';
  lastSeenAt: number;
  rssi?: number;
  snr?: number;
  distanceMeters?: number;
  capabilities: PeerCapability;
}

export class CanonicalPeerRegistry {
  private static instance: CanonicalPeerRegistry | null = null;
  private peers: Map<string, Peer> = new Map();
  private listeners: Set<(peers: Peer[]) => void> = new Set();

  private constructor() {}

  public static getInstance(): CanonicalPeerRegistry {
    if (!CanonicalPeerRegistry.instance) {
      CanonicalPeerRegistry.instance = new CanonicalPeerRegistry();
    }
    return CanonicalPeerRegistry.instance;
  }

  public upsertPeer(peer: Partial<Peer> & { id: string; signingPublicKey: string }): Peer {
    const existing = this.peers.get(peer.id);
    const updated: Peer = {
      id: peer.id,
      signingPublicKey: peer.signingPublicKey,
      encryptionPublicKey: peer.encryptionPublicKey || existing?.encryptionPublicKey,
      trustLevel: peer.trustLevel || existing?.trustLevel || 'unverified',
      lastSeenAt: peer.lastSeenAt || Date.now(),
      rssi: peer.rssi !== undefined ? peer.rssi : existing?.rssi,
      snr: peer.snr !== undefined ? peer.snr : existing?.snr,
      distanceMeters: peer.distanceMeters !== undefined ? peer.distanceMeters : existing?.distanceMeters,
      capabilities: peer.capabilities || existing?.capabilities || {
        relay: true,
        gateway: false,
        storage: true,
        powerSource: 'battery',
      },
    };

    this.peers.set(peer.id, updated);
    this.notify();
    return updated;
  }

  public getPeer(id: string): Peer | undefined {
    return this.peers.get(id);
  }

  public getAllPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public subscribe(listener: (peers: Peer[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllPeers());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = this.getAllPeers();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (err) {
        console.error('[CanonicalPeerRegistry] Listener error:', err);
      }
    });
  }
}

export const canonicalPeerRegistry = CanonicalPeerRegistry.getInstance();
