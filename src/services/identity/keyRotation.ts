/**
 * KeyRotation
 * 
 * Cryptographically verifies and manages key rotations across the mesh.
 * Provides proofs signed by both previous and new keys to prevent identity takeovers.
 */

import { KeyRotationProof } from './types';
import { verifyEd25519 } from '../../core/crypto/ed25519';
import { canonicalizeToBytes } from '../../protocol/canonical';
import { fromHex } from '../../core/crypto/utils';
import { peerIdentityStore, PeerIdentityStore } from './peerIdentityStore';

export class KeyRotationManager {
  constructor(private peerStore: PeerIdentityStore = peerIdentityStore) {}

  /**
   * Constructs payload to be signed for key rotation
   */
  public getRotationPayload(proof: Omit<KeyRotationProof, 'signatureByPreviousKey' | 'signatureByNewKey'>): Uint8Array {
    return canonicalizeToBytes({
      action: 'KEY_ROTATION',
      newPublicKeyHex: proof.newPublicKeyHex.toLowerCase(),
      previousPublicKeyHex: proof.previousPublicKeyHex.toLowerCase(),
      rotationEpoch: proof.rotationEpoch,
      timestamp: proof.timestamp,
    });
  }

  /**
   * Verifies key rotation proof:
   * 1. Must be signed by previous key (proves owner initiated)
   * 2. Must be signed by new key (proves ownership of new key)
   */
  public async verifyRotationProof(proof: KeyRotationProof): Promise<boolean> {
    try {
      const payloadBytes = this.getRotationPayload(proof);

      const sigPrevBytes = fromHex(proof.signatureByPreviousKey);
      const sigNewBytes = fromHex(proof.signatureByNewKey);

      const validPrev = await verifyEd25519(
        payloadBytes,
        sigPrevBytes,
        proof.previousPublicKeyHex
      );

      if (!validPrev) {
        console.warn('[KeyRotation] Signature by previous key failed verification');
        return false;
      }

      const validNew = await verifyEd25519(
        payloadBytes,
        sigNewBytes,
        proof.newPublicKeyHex
      );

      if (!validNew) {
        console.warn('[KeyRotation] Signature by new key failed verification');
        return false;
      }

      return true;
    } catch (e) {
      console.warn('[KeyRotation] Error verifying rotation proof:', e);
      return false;
    }
  }

  /**
   * Applies verified key rotation to peer identity store
   */
  public async applyPeerKeyRotation(proof: KeyRotationProof, newEncryptionKeyHex?: string): Promise<boolean> {
    const isValid = await this.verifyRotationProof(proof);
    if (!isValid) {
      return false;
    }

    const peer = await this.peerStore.getPeerBySigningKey(proof.previousPublicKeyHex);
    if (!peer) {
      console.warn('[KeyRotation] Peer with previous public key not found in store');
      return false;
    }

    peer.signingPublicKey = proof.newPublicKeyHex.toLowerCase();
    if (newEncryptionKeyHex) {
      peer.encryptionPublicKey = newEncryptionKeyHex.toLowerCase();
    }
    peer.lastSeenAt = Date.now();

    await this.peerStore.putPeer(peer);
    return true;
  }
}

export const keyRotationManager = new KeyRotationManager();
