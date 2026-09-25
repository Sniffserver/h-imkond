/**
 * Canonical Key Rotation Engine (HÕIMU Core)
 * Handles key rotation announcements and revocation proofs.
 */

import { canonicalIdentity } from './identity';

export interface KeyRotationNotice {
  nodeId: string;
  oldPublicKey: string;
  newPublicKey: string;
  timestamp: number;
  signature: string;
}

export class CanonicalRotationEngine {
  public static createRotationNotice(newPublicKeyHex: string): KeyRotationNotice {
    const id = canonicalIdentity.getIdentity();
    const noticeData = new TextEncoder().encode(`${id.nodeId}:${id.signingPublicKey}:${newPublicKeyHex}`);
    const sig = canonicalIdentity.sign(noticeData);

    return {
      nodeId: id.nodeId,
      oldPublicKey: id.signingPublicKey,
      newPublicKey: newPublicKeyHex,
      timestamp: Date.now(),
      signature: Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join(''),
    };
  }
}
