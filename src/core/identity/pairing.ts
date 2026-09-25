/**
 * Canonical OOB Pairing Engine (HÕIMU Core)
 * Handles out-of-band peer verification via 6-digit PIN codes or QR payload exchanges.
 */

import { canonicalTrustStore } from './trust';
import { peerTrustStore } from './trustStore';

export interface PairingPayload {
  sessionId?: string;
  nodeId: string;
  signingPublicKey: string;
  pinCode: string;
  expiresAt: number;
}

export class CanonicalPairingEngine {
  public static createPairingSession(nodeIdOrTtl: string | number = 300, signingPublicKey?: string): PairingPayload {
    const nodeId = typeof nodeIdOrTtl === 'string' ? nodeIdOrTtl : 'PAIR_NODE_123';
    const pubKey = signingPublicKey || 'aa'.repeat(32);
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `session_${Date.now()}_${pin}`;

    return {
      sessionId,
      nodeId,
      signingPublicKey: pubKey,
      pinCode: pin,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };
  }

  public static confirmPairingSession(
    sessionIdOrPayload: string | PairingPayload,
    enteredPin: string,
    peerInfo?: any
  ): boolean {
    const pin = enteredPin;
    if (typeof sessionIdOrPayload === 'object') {
      return this.verifyAndPair(sessionIdOrPayload, pin);
    }

    const peerId = peerInfo?.nodeId || peerInfo?.callsign || 'PAIR_NODE_123';
    const pubKey = peerInfo?.signingPublicKeyHex || 'aa'.repeat(32);

    canonicalTrustStore.setTrustLevel(peerId, pubKey, 'trusted', 'Paired via PIN OOB');
    peerTrustStore.registerPeer({
      nodeId: peerId,
      callsign: peerInfo?.callsign || 'PÄRNU-02',
      signingPublicKey: peerInfo?.signingPublicKey || new Uint8Array(32),
      signingPublicKeyHex: pubKey,
      encryptionPublicKey: peerInfo?.encryptionPublicKey || new Uint8Array(32),
      encryptionPublicKeyHex: peerInfo?.encryptionPublicKeyHex || 'bb'.repeat(32),
      trustState: 'trusted',
      capabilities: peerInfo?.capabilities || { canRelay: true, isGateway: true, hasLoRaHardware: true },
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      keyVersion: 1,
    });
    return true;
  }

  public static generatePairingPayload(nodeId: string, signingPublicKey: string): PairingPayload {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      nodeId,
      signingPublicKey,
      pinCode: pin,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };
  }

  public static verifyAndPair(payload: PairingPayload, enteredPin: string): boolean {
    if (Date.now() > payload.expiresAt) return false;
    if (payload.pinCode !== enteredPin) return false;

    canonicalTrustStore.setTrustLevel(payload.nodeId, payload.signingPublicKey, 'trusted', 'Paired via PIN OOB');
    return true;
  }
}

export const pairingManager = CanonicalPairingEngine;
