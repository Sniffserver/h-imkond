/**
 * HÕIMU Core Identity Module
 * Canonical Public API for Node Identity, Cryptographic Operations, and Envelopes
 */

import { getIdentityProvider } from './provider';

export * from './types';
export * from './provider';

/**
 * Universal signing helper for application features.
 * Signs any arbitrary structured payload using RFC 8785 canonicalization and the node's non-extractable identity key.
 */
export async function signCanonicalPayload(payload: any): Promise<string> {
  const provider = getIdentityProvider();
  await provider.initialize();
  return await provider.signPayload(payload);
}

/**
 * Universal verification helper for application features.
 * Verifies payload signature against an optional public key hex.
 */
export async function verifyCanonicalPayload(
  payload: any,
  signatureHex: string,
  publicKeyHex?: string
): Promise<boolean> {
  const provider = getIdentityProvider();
  await provider.initialize();
  return await provider.verifyPayload(payload, signatureHex, publicKeyHex);
}
