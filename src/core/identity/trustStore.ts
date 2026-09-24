/**
 * HÕIMU Standalone Peer Trust Store & Lifecycle Manager
 */

import { PeerIdentity, TrustState } from './peerIdentity';

export type TrustChangeListener = (peers: PeerIdentity[]) => void;

export class PeerTrustStore {
  private static instance: PeerTrustStore;
  private peers: Map<string, PeerIdentity> = new Map();
  private listeners: Set<TrustChangeListener> = new Set();

  public static getInstance(): PeerTrustStore {
    if (!PeerTrustStore.instance) {
      PeerTrustStore.instance = new PeerTrustStore();
    }
    return PeerTrustStore.instance;
  }

  public registerPeer(peer: PeerIdentity): void {
    const existing = this.peers.get(peer.nodeId);
    if (existing) {
      this.peers.set(peer.nodeId, {
        ...existing,
        ...peer,
        lastSeenAt: Date.now(),
      });
    } else {
      this.peers.set(peer.nodeId, {
        ...peer,
        firstSeenAt: peer.firstSeenAt || Date.now(),
        lastSeenAt: Date.now(),
      });
    }
    this.notify();
  }

  public getPeer(nodeId: string): PeerIdentity | undefined {
    return this.peers.get(nodeId);
  }

  public getAllPeers(): PeerIdentity[] {
    return Array.from(this.peers.values());
  }

  public updateTrustState(nodeId: string, nextState: TrustState, reason?: string): boolean {
    const peer = this.peers.get(nodeId);
    if (!peer) return false;

    peer.trustState = nextState;
    if (reason) {
      peer.revokedReason = reason;
    }
    peer.lastSeenAt = Date.now();
    this.peers.set(nodeId, peer);
    this.notify();
    return true;
  }

  public revokePeer(nodeId: string, reason: string): boolean {
    return this.updateTrustState(nodeId, 'revoked', reason);
  }

  public isPeerTrusted(nodeId: string): boolean {
    const peer = this.peers.get(nodeId);
    if (!peer) return false;
    return peer.trustState === 'verified' || peer.trustState === 'trusted';
  }

  public subscribe(listener: TrustChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllPeers());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const all = this.getAllPeers();
    this.listeners.forEach((fn) => fn(all));
  }
}

export const peerTrustStore = PeerTrustStore.getInstance();
