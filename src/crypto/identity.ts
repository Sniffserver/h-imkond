/**
 * HÕIMU Node Identity & Cryptographic Key Management
 * 
 * Manages Ed25519 signing key pairs and X25519 Diffie-Hellman key pairs using the Web Crypto API (SubtleCrypto).
 * Provides node ID fingerprint derivation, secure local storage persistence, and seed-based identity recovery.
 */

import { deriveEd25519FromSeed, generateEd25519KeyPair, Ed25519KeyPair } from './ed25519';
import { deriveX25519FromSeed, generateX25519KeyPair, X25519KeyPair } from './x25519';
import { SecureSecretsStore } from '../storage/identity/secureSecretsStore';
import { IdentityStore } from '../storage/identity/identityStore';

export interface HoimuIdentity {
  nodeId: string; // 16-hex char deterministic node fingerprint derived from Ed25519 public key
  callsign: string; // Human-readable callsign (e.g. 'TALLINN-01')
  signingKeyPair: Ed25519KeyPair; // Ed25519 Web Crypto keypair for packet signing
  dhKeyPair: X25519KeyPair; // X25519 Web Crypto keypair for ECDH key agreement
  signingPublicKeyHex: string; // Hex representation of Ed25519 public key (32 bytes / 64 chars)
  dhPublicKeyHex: string; // Hex representation of X25519 public key (32 bytes / 64 chars)
  createdAt: number;
}

export interface SerializedIdentityBackup {
  version: 1;
  callsign: string;
  nodeId: string;
  seedHex?: string;
  signingPublicKeyHex: string;
  dhPublicKeyHex: string;
  createdAt: number;
}

const STORAGE_SEED_KEY = 'hoimu_identity_seed_v1';
const STORAGE_CALLSIGN_KEY = 'hoimu_identity_callsign_v1';

/**
 * Derives an 8 to 16-character hexadecimal node ID fingerprint from an Ed25519 public key hex.
 */
export function deriveNodeId(publicKeyHex: string): string {
  return publicKeyHex.slice(0, 16).toUpperCase();
}

/**
 * Derives a full deterministic HÕIMU identity from a master seed or passphrase.
 */
export async function createIdentityFromSeed(seed: string, callsign: string): Promise<HoimuIdentity> {
  const signingKeyPair = await deriveEd25519FromSeed(seed);
  const dhKeyPair = await deriveX25519FromSeed(seed);
  const nodeId = deriveNodeId(signingKeyPair.publicKeyHex);

  return {
    nodeId,
    callsign,
    signingKeyPair,
    dhKeyPair,
    signingPublicKeyHex: signingKeyPair.publicKeyHex,
    dhPublicKeyHex: dhKeyPair.publicKeyHex,
    createdAt: Date.now(),
  };
}

/**
 * Generates a brand new random HÕIMU identity using secure random entropy from SubtleCrypto.
 */
export async function generateRandomIdentity(callsign: string): Promise<HoimuIdentity> {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const seedHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return createIdentityFromSeed(seedHex, callsign);
}

/**
 * Loads an existing identity from secure storage or generates and persists a new one.
 * Conforms strictly to: localStorage = preferences only (no secrets/identities).
 */
export async function loadOrCreateLocalIdentity(defaultCallsign = 'EST-NODE'): Promise<HoimuIdentity> {
  // 1. Check canonical SecureSecretsStore (IndexedDB)
  let secret = await SecureSecretsStore.getSecret('master_identity_seed');
  let savedCallsign = defaultCallsign;

  // 2. Check and migrate any legacy seed from localStorage if present
  if (!secret && typeof localStorage !== 'undefined') {
    const legacySeed = localStorage.getItem(STORAGE_SEED_KEY);
    const legacyCallsign = localStorage.getItem(STORAGE_CALLSIGN_KEY);
    if (legacySeed) {
      await SecureSecretsStore.saveSecret({
        keyId: 'master_identity_seed',
        type: 'seed',
        secretHex: legacySeed,
      });
      secret = { keyId: 'master_identity_seed', type: 'seed', secretHex: legacySeed, createdAt: Date.now() };
      if (legacyCallsign) savedCallsign = legacyCallsign;

      // Cleanse from localStorage
      localStorage.removeItem(STORAGE_SEED_KEY);
      localStorage.removeItem(STORAGE_CALLSIGN_KEY);
    }
  }

  // 3. If no seed exists, generate a 32-byte cryptographically secure random seed
  if (!secret) {
    const randomBuf = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBuf);
    } else {
      for (let i = 0; i < 32; i++) randomBuf[i] = Math.floor(Math.random() * 256);
    }
    const seedHex = Array.from(randomBuf).map((b) => b.toString(16).padStart(2, '0')).join('');
    await SecureSecretsStore.saveSecret({
      keyId: 'master_identity_seed',
      type: 'seed',
      secretHex: seedHex,
    });
    secret = { keyId: 'master_identity_seed', type: 'seed', secretHex: seedHex, createdAt: Date.now() };
  }

  const identity = await createIdentityFromSeed(secret.secretHex, savedCallsign);

  // Persist identity metadata in canonical IdentityStore (IndexedDB)
  await IdentityStore.saveLocalIdentity({
    nodeId: identity.nodeId,
    callsign: identity.callsign,
    signingPublicKeyHex: identity.signingPublicKeyHex,
    dhPublicKeyHex: identity.dhPublicKeyHex,
    createdAt: identity.createdAt,
    updatedAt: Date.now(),
  });

  return identity;
}

/**
 * Exports an identity to an encrypted or plain JSON backup representation.
 */
export function exportIdentityBackup(identity: HoimuIdentity, seedHex?: string): SerializedIdentityBackup {
  return {
    version: 1,
    callsign: identity.callsign,
    nodeId: identity.nodeId,
    seedHex,
    signingPublicKeyHex: identity.signingPublicKeyHex,
    dhPublicKeyHex: identity.dhPublicKeyHex,
    createdAt: identity.createdAt,
  };
}

/**
 * Restores an identity from a backup seed into secure storage.
 */
export async function restoreIdentityFromSeed(seedHex: string, callsign: string): Promise<HoimuIdentity> {
  const identity = await createIdentityFromSeed(seedHex, callsign);
  await SecureSecretsStore.saveSecret({
    keyId: 'master_identity_seed',
    type: 'seed',
    secretHex: seedHex,
  });
  await IdentityStore.saveLocalIdentity({
    nodeId: identity.nodeId,
    callsign: identity.callsign,
    signingPublicKeyHex: identity.signingPublicKeyHex,
    dhPublicKeyHex: identity.dhPublicKeyHex,
    createdAt: identity.createdAt,
    updatedAt: Date.now(),
  });

  // Ensure legacy localStorage is clean
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_SEED_KEY);
    localStorage.removeItem(STORAGE_CALLSIGN_KEY);
  }

  return identity;
}
