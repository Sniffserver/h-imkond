import { MeshNode } from '../../types';
import { soundFeedback } from '../utils/soundFeedback';
import { a11yAnnouncer } from '../a11y/a11yAnnouncer';
import { getReputationTier } from '../../components/ReputationPill';

/**
 * Immediate Bluetooth Discovery RSSI Threshold
 * Peers with RSSI stronger than -70 dBm (e.g. -68, -55, -42 dBm) are in immediate line-of-sight proximity (~1-10 meters).
 */
export const IMMEDIATE_BLE_RSSI_THRESHOLD = -70;

/**
 * Evaluates whether a peer node meets the 'High Trust' reputation criteria.
 */
export function isHighTrustPeer(peer: MeshNode): boolean {
  if (!peer) return false;

  // Direct tier check
  const tier = peer.reputationTier?.toLowerCase() || '';
  if (
    tier.includes('high trust') ||
    tier.includes('steward') ||
    tier.includes('verified') ||
    tier.includes('pillar') ||
    tier.includes('champion')
  ) {
    return true;
  }

  // Trust score check (>= 75 is high trust in Solarpunk mesh)
  if (typeof peer.trustScore === 'number' && peer.trustScore >= 75) {
    return true;
  }

  // Completed exchange history check
  if (typeof peer.completedExchanges === 'number' && peer.completedExchanges >= 8) {
    return true;
  }

  // Derived tier check from exchange volume
  if (typeof peer.completedExchanges === 'number') {
    const derivedTier = getReputationTier(peer.completedExchanges);
    if (derivedTier === 'Steward' || derivedTier === 'Verified Peer') {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a peer is currently within immediate Bluetooth discovery range (RSSI > -70 dBm).
 */
export function isImmediateBleProximity(peer: MeshNode): boolean {
  if (!peer) return false;
  const rssi = typeof peer.lastRssi === 'number' ? peer.lastRssi : -999;
  const isBle = !peer.radioType || peer.radioType === 'BLE' || peer.hopDistance === 1;
  return isBle && rssi > IMMEDIATE_BLE_RSSI_THRESHOLD;
}

/**
 * Service to manage peer proximity state transitions and trigger haptic & audible notifications.
 */
class HighTrustProximityManager {
  // Track timestamp of last notification per peer ID to avoid rapid repetitive triggering
  private notifiedPeers = new Map<string, number>();
  private readonly COOLDOWN_MS = 25000; // 25 seconds cooldown per peer

  /**
   * Evaluates a peer or list of peers and triggers audible + haptic alert if criteria met.
   */
  public checkAndNotify(
    peers: MeshNode | MeshNode[],
    onToast?: (title: string, description?: string, type?: 'success' | 'warning' | 'info') => void
  ): MeshNode[] {
    const peerList = Array.isArray(peers) ? peers : [peers];
    const triggeredPeers: MeshNode[] = [];
    const now = Date.now();

    for (const peer of peerList) {
      if (!isHighTrustPeer(peer)) continue;
      if (!isImmediateBleProximity(peer)) continue;

      const lastNotified = this.notifiedPeers.get(peer.id) || 0;
      if (now - lastNotified > this.COOLDOWN_MS) {
        this.notifiedPeers.set(peer.id, now);
        triggeredPeers.push(peer);

        // 1. Trigger Haptic + Audible Harmonic Chime
        soundFeedback.playHighTrustProximityNotification();

        // 2. Announce for Screen Readers & A11y
        const tierName = peer.reputationTier || (peer.completedExchanges >= 8 ? 'Verified Steward' : 'High Trust Peer');
        a11yAnnouncer.announce(
          `High-trust peer ${peer.callsign} (${tierName}) entered immediate Bluetooth range at ${peer.lastRssi} dBm.`,
          'assertive'
        );

        // 3. Trigger User-Visible UI Toast
        if (onToast) {
          onToast(
            `🛡️ High-Trust Peer in Range: ${peer.callsign}`,
            `Immediate Bluetooth signal lock (${peer.lastRssi} dBm, ~${Math.max(1, Math.round(10 ** ((-45 - peer.lastRssi) / 25)))}m). ${tierName} with ${peer.trustScore ?? 88}% trust score.`,
            'success'
          );
        }
      }
    }

    return triggeredPeers;
  }

  public reset() {
    this.notifiedPeers.clear();
  }
}

export const highTrustProximityManager = new HighTrustProximityManager();
