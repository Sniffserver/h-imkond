/**
 * HÕIMU Canonical Cryptographic Protocol Envelope Specification
 * 
 * Standardizes signed data envelopes across browser, node, and embedded mesh nodes.
 * Principle: No synthetic signature or public key strings unless derived from true cryptographic material.
 */

import { toHex, fromHex } from './utils';
import { verifyEd25519, signEd25519 } from './ed25519';

export interface SignedEnvelope {
  version: 1;
  algorithm: 'Ed25519';
  keyId: string;
  publicKey: string; // Hex-encoded 32-byte public key
  payloadHash: string; // Hex-encoded SHA-256 of canonical payload
  signature: string; // Hex-encoded 64-byte Ed25519 signature
}

/**
 * Computes canonical SHA-256 hash of a payload
 */
export async function computePayloadHash(payload: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest('SHA-256', payload);
    return toHex(new Uint8Array(hashBuf));
  }
  // Node.js fallback
  const nodeCrypto = await import('crypto');
  return nodeCrypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Constructs a verifiable SignedEnvelope over arbitrary payload bytes
 */
export async function createSignedEnvelope(
  payload: Uint8Array,
  privateKey: CryptoKey,
  publicKeyHex: string,
  keyId: string
): Promise<SignedEnvelope> {
  const payloadHash = await computePayloadHash(payload);
  const hashBytes = fromHex(payloadHash);
  const signatureBytes = await signEd25519(hashBytes, privateKey);

  return {
    version: 1,
    algorithm: 'Ed25519',
    keyId,
    publicKey: publicKeyHex,
    payloadHash,
    signature: toHex(signatureBytes),
  };
}

/**
 * Verifies a SignedEnvelope against the original payload bytes
 */
export async function verifySignedEnvelope(
  envelope: SignedEnvelope,
  payload: Uint8Array
): Promise<boolean> {
  if (envelope.version !== 1 || envelope.algorithm !== 'Ed25519') {
    return false;
  }

  // 1. Recompute and check payload hash
  const computedHash = await computePayloadHash(payload);
  if (computedHash.toLowerCase() !== envelope.payloadHash.toLowerCase()) {
    return false;
  }

  // 2. Verify signature over payload hash
  const hashBytes = fromHex(envelope.payloadHash);
  const sigBytes = fromHex(envelope.signature);

  if (sigBytes.length !== 64) {
    return false;
  }

  try {
    return await verifyEd25519(hashBytes, sigBytes, envelope.publicKey);
  } catch {
    return false;
  }
}
