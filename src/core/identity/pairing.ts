/**
 * HÕIMU Secure Device Pairing Flow
 * QR / PIN -> Ephemeral Session -> Device Identity -> Trust Confirmation -> Capability Token -> Peer Storage
 */

import { PeerIdentity, TrustState } from './peerIdentity';
import { peerTrustStore } from './trustStore';
import { getRandomBytes, toHex } from '../crypto/utils';

export interface PairingSession {
  sessionId: string;
  pinCode: string;
  qrPayload: string;
  createdAt: number;
  expiresAt: number;
  state: 'initiated' | 'exchanging' | 'confirmed' | 'failed' | 'expired';
}

export class PairingManager {
  private activeSessions: Map<string, PairingSession> = new Map();

  public createPairingSession(ttlSeconds = 300): PairingSession {
    const sessionId = `pair_${toHex(getRandomBytes(8))}`;
    const pinCode = Math.floor(100000 + Math.random() * 900000).toString();
    const qrPayload = JSON.stringify({ sid: sessionId, pin: pinCode, v: 1 });
    const now = Date.now();

    const session: PairingSession = {
      sessionId,
      pinCode,
      qrPayload,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      state: 'initiated',
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  public confirmPairingSession(
    sessionId: string,
    pinCode: string,
    remotePeer: Omit<PeerIdentity, 'trustState'>
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    if (Date.now() > session.expiresAt) {
      session.state = 'expired';
      return false;
    }

    if (session.pinCode !== pinCode) {
      session.state = 'failed';
      return false;
    }

    session.state = 'confirmed';

    // Register paired & verified peer in standalone PeerTrustStore
    peerTrustStore.registerPeer({
      ...remotePeer,
      trustState: 'verified',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    });

    return true;
  }
}

export const pairingManager = new PairingManager();
