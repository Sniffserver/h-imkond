/**
 * Canonical IdentityProvider Implementation for HÕIMU
 * 
 * Securely integrates WebCrypto, non-extractable keys, X25519 key agreement,
 * and Ed25519 authentication under the unified IdentityProvider interface.
 */

import { IdentityProvider, NodeIdentity, EncryptedEnvelope } from './types';
import {
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  Ed25519KeyPair,
} from '../crypto/ed25519';
import {
  generateX25519KeyPair,
  deriveSharedBits,
  X25519KeyPair,
} from '../crypto/x25519';
import {
  deriveKeyHKDF,
  encryptAesGcm,
  decryptAesGcm,
} from '../crypto/aead';
import { toHex, fromHex, getRandomBytes } from '../crypto/utils';
import { canonicalizeToBytes } from '../../protocol/canonical';

const DEFAULT_CALLSIGN = 'TALLINN-01';

export class CanonicalIdentityProvider implements IdentityProvider {
  private initialized = false;
  private signingKeyPair: Ed25519KeyPair | null = null;
  private dhKeyPair: X25519KeyPair | null = null;
  private rawSigningPublicKey: Uint8Array | null = null;
  private rawDhPublicKey: Uint8Array | null = null;
  private callsign: string = DEFAULT_CALLSIGN;
  private nodeId: string = '';

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // Generate non-extractable identity signing keypair
    this.signingKeyPair = await generateEd25519KeyPair(false);
    this.dhKeyPair = await generateX25519KeyPair(false);

    this.rawSigningPublicKey = fromHex(this.signingKeyPair.publicKeyHex);
    this.rawDhPublicKey = fromHex(this.dhKeyPair.publicKeyHex);
    this.nodeId = this.signingKeyPair.publicKeyHex.slice(0, 16).toUpperCase();

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.signingKeyPair || !this.dhKeyPair) {
      throw new Error('IdentityProvider is not initialized. Call initialize() first.');
    }
  }

  public async getNodeIdentity(): Promise<NodeIdentity> {
    this.ensureInitialized();
    return {
      nodeId: this.nodeId,
      callsign: this.callsign,
      signingPublicKey: this.rawSigningPublicKey!,
      signingPublicKeyHex: this.signingKeyPair!.publicKeyHex,
      dhPublicKey: this.rawDhPublicKey!,
      dhPublicKeyHex: this.dhKeyPair!.publicKeyHex,
      createdAt: Date.now(),
    };
  }

  public async sign(data: Uint8Array): Promise<Uint8Array> {
    this.ensureInitialized();
    return await signEd25519(data, this.signingKeyPair!.privateKey);
  }

  public async getPublicKey(): Promise<Uint8Array> {
    this.ensureInitialized();
    return this.rawSigningPublicKey!;
  }

  public async encryptForPeer(
    peerPublicKey: Uint8Array,
    plaintext: Uint8Array
  ): Promise<EncryptedEnvelope> {
    this.ensureInitialized();

    // 1. Generate single-use ephemeral X25519 keypair for Perfect Forward Secrecy
    const ephemeralPair = await generateX25519KeyPair(false);
    const ephemeralPubRaw = fromHex(ephemeralPair.publicKeyHex);

    // 2. Derive shared bits using ephemeral private key and recipient's peer public key
    const sharedBits = await deriveSharedBits(ephemeralPair.privateKey, peerPublicKey);

    // 3. Derive 256-bit AES-GCM session key using HKDF-SHA-256
    const salt = getRandomBytes(16);
    const sessionKey = await deriveKeyHKDF(sharedBits, salt, 'hoimu_p2p_envelope_v1');

    // 4. Encrypt plaintext
    const nonce = getRandomBytes(12);
    const { ciphertext } = await encryptAesGcm(plaintext, sessionKey, nonce);

    // Combine salt + ciphertext so recipient has the HKDF salt
    const combinedCiphertext = new Uint8Array(salt.length + ciphertext.length);
    combinedCiphertext.set(salt, 0);
    combinedCiphertext.set(ciphertext, salt.length);

    return {
      ciphertext: combinedCiphertext,
      nonce,
      senderEphemeralPublicKey: ephemeralPubRaw,
    };
  }

  public async decrypt(
    combinedCiphertext: Uint8Array,
    senderPublicKey: Uint8Array,
    nonce?: Uint8Array
  ): Promise<Uint8Array> {
    this.ensureInitialized();

    if (combinedCiphertext.length < 16) {
      throw new Error('Ciphertext is too short to contain HKDF salt');
    }

    const salt = combinedCiphertext.subarray(0, 16);
    const rawCiphertext = combinedCiphertext.subarray(16);
    const effectiveNonce = nonce || new Uint8Array(12);

    // 1. Derive shared secret using node's private DH key and sender's ephemeral public key
    const sharedBits = await deriveSharedBits(this.dhKeyPair!.privateKey, senderPublicKey);

    // 2. Derive 256-bit AES-GCM session key using identical HKDF-SHA-256 info
    const sessionKey = await deriveKeyHKDF(sharedBits, salt, 'hoimu_p2p_envelope_v1');

    // 3. Decrypt ciphertext
    return await decryptAesGcm(rawCiphertext, sessionKey, effectiveNonce);
  }

  public async signPayload(payload: any): Promise<string> {
    this.ensureInitialized();
    const bytes = canonicalizeToBytes(payload);
    const sig = await this.sign(bytes);
    return toHex(sig);
  }

  public async verifyPayload(
    payload: any,
    signatureHex: string,
    publicKeyHex?: string
  ): Promise<boolean> {
    const bytes = canonicalizeToBytes(payload);
    const sigBytes = fromHex(signatureHex);
    const pubKey = publicKeyHex ? fromHex(publicKeyHex) : await this.getPublicKey();
    return await verifyEd25519(bytes, sigBytes, pubKey);
  }

  public setCallsign(callsign: string): void {
    this.callsign = callsign;
  }
}

// Global Singleton Instance
let defaultProvider: IdentityProvider = new CanonicalIdentityProvider();

export function getIdentityProvider(): IdentityProvider {
  return defaultProvider;
}

export function setIdentityProvider(provider: IdentityProvider): void {
  defaultProvider = provider;
}
