/**
 * TrustStore
 * 
 * Manages peer verification, trust state transitions, and authorization checks.
 * Trust States:
 * - unknown: First seen or unverified peer; default baseline.
 * - verified: Verified via out-of-band key verification, QR exchange, or signed endorsement.
 * - blocked: Explicitly denied; packets and messages from this node are dropped immediately.
 * - expired: Stale or rotated peer key needing re-verification.
 */

import { PeerIdentity, TrustState } from './types';
import { peerIdentityStore, PeerIdentityStore } from './peerIdentityStore';

export class TrustStore {
  constructor(private peerStore: PeerIdentityStore = peerIdentityStore) {}

  /**
   * Evaluates if communication from or to a peer is authorized
   */
  public async isPeerAuthorized(nodeIdOrCallsign: string): Promise<boolean> {
    const peer = await this.resolvePeer(nodeIdOrCallsign);
    if (!peer) {
      // Unknown peers without an entry are allowed in 'unknown' baseline state unless blocked
      return true;
    }
    return peer.trustState !== 'blocked' && peer.trustState !== 'expired';
  }

  /**
   * Verifies if a peer is explicitly marked as 'verified'
   */
  public async isPeerVerified(nodeIdOrCallsign: string): Promise<boolean> {
    const peer = await this.resolvePeer(nodeIdOrCallsign);
    return peer?.trustState === 'verified';
  }

  /**
   * Checks if peer is explicitly blocked
   */
  public async isPeerBlocked(nodeIdOrCallsign: string): Promise<boolean> {
    const peer = await this.resolvePeer(nodeIdOrCallsign);
    return peer?.trustState === 'blocked';
  }

  /**
   * Sets trust state of peer
   */
  public async setTrustState(nodeId: string, state: TrustState): Promise<boolean> {
    return await this.peerStore.updateTrustState(nodeId, state);
  }

  /**
   * Manually verify a peer (e.g. via QR code verification or verified mesh beacon)
   */
  public async verifyPeer(nodeId: string): Promise<boolean> {
    return await this.setTrustState(nodeId, 'verified');
  }

  /**
   * Block an adversarial node
   */
  public async blockPeer(nodeId: string): Promise<boolean> {
    return await this.setTrustState(nodeId, 'blocked');
  }

  /**
   * Mark an inactive or stale key as expired
   */
  public async expirePeer(nodeId: string): Promise<boolean> {
    return await this.setTrustState(nodeId, 'expired');
  }

  /**
   * Resolves peer by nodeId, callsign, or signing key
   */
  public async resolvePeer(identifier: string): Promise<PeerIdentity | null> {
    if (!identifier) return null;

    // 1. By nodeId
    let peer = await this.peerStore.getPeerByNodeId(identifier);
    if (peer) return peer;

    // 2. By callsign
    peer = await this.peerStore.getPeerByCallsign(identifier);
    if (peer) return peer;

    // 3. By signing public key
    peer = await this.peerStore.getPeerBySigningKey(identifier);
    if (peer) return peer;

    return null;
  }

  /**
   * Register or discover a new peer dynamically
   */
  public async registerDiscoveredPeer(params: {
    nodeId: string;
    callsign: string;
    signingPublicKey: string;
    encryptionPublicKey: string;
    capabilities?: string[];
  }): Promise<PeerIdentity> {
    const existing = await this.peerStore.getPeerByNodeId(params.nodeId);
    if (existing) {
      existing.callsign = params.callsign || existing.callsign;
      existing.signingPublicKey = params.signingPublicKey || existing.signingPublicKey;
      existing.encryptionPublicKey = params.encryptionPublicKey || existing.encryptionPublicKey;
      existing.lastSeenAt = Date.now();
      if (params.capabilities) {
        existing.capabilities = Array.from(new Set([...existing.capabilities, ...params.capabilities]));
      }
      await this.peerStore.putPeer(existing);
      return existing;
    }

    const newPeer: PeerIdentity = {
      nodeId: params.nodeId,
      callsign: params.callsign,
      signingPublicKey: params.signingPublicKey,
      encryptionPublicKey: params.encryptionPublicKey,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'unknown',
      capabilities: params.capabilities || ['mesh:v1', 'e2ee:v1'],
    };

    await this.peerStore.putPeer(newPeer);
    return newPeer;
  }
}

export const trustStore = new TrustStore();
