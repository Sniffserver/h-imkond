/**
 * Message Verifier
 * 
 * Verifies envelope cryptographic signatures and peer authorization.
 */

import { MeshMessageEnvelope } from '../../types';
import { getSubtleCrypto, fromHex } from '../../core/crypto';
import { getEnvelopeCanonicalString } from './envelopeService';
import { trustStore, TrustStore } from '../identity/trustStore';

export interface EnvelopeVerificationResult {
  valid: boolean;
  authorized: boolean;
  senderCallsign: string;
  senderIdentityKey: string;
  error?: string;
}

export class MessageVerifier {
  constructor(private trustStoreRef: TrustStore = trustStore) {}

  /**
   * Verifies an envelope's Ed25519 signature against the sender's identity key
   */
  public async verifyEnvelopeSignature(envelope: MeshMessageEnvelope): Promise<boolean> {
    const subtle = getSubtleCrypto();

    try {
      let pubBytes = fromHex(envelope.senderIdentityKey.replace(/^(0x|ed25519:)/i, ''));
      if (pubBytes.length !== 32) {
        const hash = await subtle.digest('SHA-256', new TextEncoder().encode(envelope.senderIdentityKey));
        pubBytes = new Uint8Array(hash);
      }

      const senderPublicKey = await subtle.importKey(
        'raw',
        pubBytes,
        { name: 'Ed25519' },
        false,
        ['verify']
      );

      const canonicalData = getEnvelopeCanonicalString({
        version: envelope.version,
        id: envelope.id,
        sender: envelope.sender,
        recipient: envelope.recipient,
        ephemeralPublicKey: envelope.ephemeralPublicKey,
        nonce: envelope.nonce,
        ciphertext: envelope.ciphertext,
        createdAt: envelope.createdAt,
      });

      const signatureBytes = fromHex(envelope.signature);

      return await subtle.verify(
        { name: 'Ed25519' },
        senderPublicKey,
        signatureBytes,
        new TextEncoder().encode(canonicalData)
      );
    } catch (err) {
      console.warn('[MessageVerifier] Signature verification error:', err);
      return false;
    }
  }

  /**
   * Validates both cryptographic integrity and authorization in the peer trust store
   */
  public async verifyAndAuthorize(envelope: MeshMessageEnvelope): Promise<EnvelopeVerificationResult> {
    // 1. Verify signature
    const valid = await this.verifyEnvelopeSignature(envelope);
    if (!valid) {
      return {
        valid: false,
        authorized: false,
        senderCallsign: envelope.sender,
        senderIdentityKey: envelope.senderIdentityKey,
        error: 'Invalid cryptographic signature on message envelope',
      };
    }

    // 2. Check authorization in trust store
    const authorized = await this.trustStoreRef.isPeerAuthorized(envelope.senderIdentityKey || envelope.sender);
    if (!authorized) {
      return {
        valid: true,
        authorized: false,
        senderCallsign: envelope.sender,
        senderIdentityKey: envelope.senderIdentityKey,
        error: 'Peer is blocked or unverified in TrustStore',
      };
    }

    return {
      valid: true,
      authorized: true,
      senderCallsign: envelope.sender,
      senderIdentityKey: envelope.senderIdentityKey,
    };
  }
}

export const messageVerifier = new MessageVerifier();
