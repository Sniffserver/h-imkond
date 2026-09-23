/**
 * Real Canonical Packet Signatures using Ed25519
 * 
 * Provides high-level signing and verification utilities for HÕIMU mesh packets,
 * canonical JSON serialization envelopes, and detached payloads.
 */

import { HoimuPacket, HoimuPacketHeader } from '../protocol/types';
import { canonicalizeToBytes } from '../protocol/canonical';
import { signBytes, verifySignature } from './ed25519';

/**
 * Signs a HoimuPacket envelope canonically using the sender's Ed25519 private key.
 * Guarantees that headers and payload fields are serialized deterministically (RFC 8785).
 */
export async function signPacket<T = any>(
  packet: HoimuPacket<T>,
  privateKey: CryptoKey
): Promise<HoimuPacket<T>> {
  const envelopeToSign = {
    header: packet.header,
    payload: packet.payload,
  };

  const canonicalBytes = canonicalizeToBytes(envelopeToSign);
  const signature = await signBytes(privateKey, canonicalBytes);

  return {
    ...packet,
    signature,
  };
}

/**
 * Alias for verifyPacketSignature with strict validation.
 */
export async function verifyPacket<T = any>(
  packet: HoimuPacket<T>,
  publicKeyHexOrKey?: string | CryptoKey
): Promise<boolean> {
  return verifyPacketSignature(packet, publicKeyHexOrKey);
}

/**
 * Verifies the Ed25519 signature of a HoimuPacket.
 * Returns true if the signature matches the canonical byte representation, false otherwise.
 */
export async function verifyPacketSignature<T = any>(
  packet: HoimuPacket<T>,
  publicKeyHexOrKey?: string | CryptoKey
): Promise<boolean> {
  if (!packet.signature || packet.signature.trim() === '') {
    return false; // Missing signature
  }

  const envelopeToVerify = {
    header: packet.header,
    payload: packet.payload,
  };

  try {
    const canonicalBytes = canonicalizeToBytes(envelopeToVerify);
    const keyToUse = publicKeyHexOrKey || packet.header.originId;
    return await verifySignature(keyToUse, canonicalBytes, packet.signature);
  } catch (err) {
    console.warn('[Crypto:Signatures] Verification error:', err);
    return false;
  }
}

/**
 * Throws an error if packet signature is missing or invalid.
 */
export async function assertValidPacketSignature<T = any>(
  packet: HoimuPacket<T>,
  publicKeyHexOrKey?: string | CryptoKey
): Promise<void> {
  const isValid = await verifyPacketSignature(packet, publicKeyHexOrKey);
  if (!isValid) {
    throw new Error(`Invalid or forged Ed25519 signature on packet ${packet.header.packetId}`);
  }
}

/**
 * Signs an arbitrary data object or primitive canonically.
 */
export async function signPayload(
  payload: any,
  privateKey: CryptoKey
): Promise<string> {
  const canonicalBytes = canonicalizeToBytes(payload);
  return await signBytes(privateKey, canonicalBytes);
}

/**
 * Verifies an arbitrary data object against an Ed25519 signature.
 */
export async function verifyPayloadSignature(
  payload: any,
  signatureHex: string,
  publicKeyHexOrKey: string | CryptoKey
): Promise<boolean> {
  try {
    const canonicalBytes = canonicalizeToBytes(payload);
    return await verifySignature(publicKeyHexOrKey, canonicalBytes, signatureHex);
  } catch {
    return false;
  }
}

/**
 * Creates and signs a complete HoimuPacket in a single step.
 */
export async function createSignedEnvelope<T = any>(
  header: HoimuPacketHeader,
  payload: T,
  privateKey: CryptoKey
): Promise<HoimuPacket<T>> {
  const unsignedPacket: HoimuPacket<T> = {
    header,
    payload,
  };
  return await signPacket(unsignedPacket, privateKey);
}
