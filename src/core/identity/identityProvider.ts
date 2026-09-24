/**
 * HÕIMU Unified IdentityProvider Specification & Implementation
 */

import { IdentityProvider, NodeIdentity, EncryptedEnvelope } from './types';
import { PeerIdentity, SessionKey } from './peerIdentity';
import { DeviceIdentityInspector, HardwareCapabilityState } from './deviceIdentity';
import { generateEd25519KeyPair, signEd25519, Ed25519KeyPair } from '../crypto/ed25519';
import { generateX25519KeyPair, deriveSharedBits, X25519KeyPair } from '../crypto/x25519';
import { deriveKeyHKDF } from '../crypto/aead';
import { fromHex, getRandomBytes, toHex } from '../crypto/utils';
import { canonicalizeToBytes, canonicalize } from '../../protocol/canonical';
import { signCanonicalPayload, verifyCanonicalPayload } from '../../services/crypto/meshCrypto';

export class CanonicalIdentityProvider implements IdentityProvider {
  private initialized = false;
  private signingKeyPair: Ed25519KeyPair | null = null;
  private dhKeyPair: X25519KeyPair | null = null;
  private nodeId: string = '';

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    this.signingKeyPair = await generateEd25519KeyPair(false);
    this.dhKeyPair = await generateX25519KeyPair(false);
    this.nodeId = this.signingKeyPair.publicKeyHex.slice(0, 16).toUpperCase();
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public async getNodeId(): Promise<string> {
    await this.ensureInitialized();
    return this.nodeId;
  }

  public async getSigningPublicKey(): Promise<Uint8Array> {
    await this.ensureInitialized();
    return fromHex(this.signingKeyPair!.publicKeyHex);
  }

  public async sign(data: Uint8Array): Promise<Uint8Array> {
    await this.ensureInitialized();
    return await signEd25519(data, this.signingKeyPair!.privateKey);
  }

  public async getEncryptionPublicKey(): Promise<Uint8Array> {
    await this.ensureInitialized();
    return fromHex(this.dhKeyPair!.publicKeyHex);
  }

  public async establishSession(peer: PeerIdentity): Promise<SessionKey> {
    await this.ensureInitialized();
    const sharedBits = await deriveSharedBits(this.dhKeyPair!.privateKey, peer.encryptionPublicKey);
    const salt = getRandomBytes(16);
    const sessionKey = await deriveKeyHKDF(sharedBits, salt, 'hoimu_session_v1');
    const exportedRaw = await crypto.subtle.exportKey('raw', sessionKey);

    return {
      sessionId: `sess_${toHex(getRandomBytes(8))}`,
      peerNodeId: peer.nodeId,
      sharedKey: new Uint8Array(exportedRaw),
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 3600 * 1000,
    };
  }

  public async getHardwareCapabilities(): Promise<HardwareCapabilityState> {
    return DeviceIdentityInspector.inspectHardwareCapabilities(true);
  }

  public async getNodeIdentity(): Promise<NodeIdentity> {
    await this.ensureInitialized();
    return {
      nodeId: this.nodeId,
      callsign: 'TALLINN-01',
      signingPublicKey: fromHex(this.signingKeyPair!.publicKeyHex),
      signingPublicKeyHex: this.signingKeyPair!.publicKeyHex,
      dhPublicKey: fromHex(this.dhKeyPair!.publicKeyHex),
      dhPublicKeyHex: this.dhKeyPair!.publicKeyHex,
      createdAt: Date.now(),
    };
  }

  public async getPublicKey(): Promise<Uint8Array> {
    return this.getSigningPublicKey();
  }

  public async encryptForPeer(peerPublicKey: Uint8Array, plaintext: Uint8Array): Promise<EncryptedEnvelope> {
    await this.ensureInitialized();
    const ephemeralPair = await generateX25519KeyPair(false);
    const sharedBits = await deriveSharedBits(ephemeralPair.privateKey, peerPublicKey);
    const salt = getRandomBytes(16);
    const sessionKey = await deriveKeyHKDF(sharedBits, salt, 'hoimu_p2p_envelope_v1');
    const nonce = getRandomBytes(12);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      sessionKey,
      plaintext
    );

    return {
      ciphertext: new Uint8Array(ciphertextBuffer),
      nonce,
      senderEphemeralPublicKey: fromHex(ephemeralPair.publicKeyHex),
    };
  }

  public async decrypt(ciphertext: Uint8Array, senderPublicKey: Uint8Array, nonce?: Uint8Array): Promise<Uint8Array> {
    await this.ensureInitialized();
    const sharedBits = await deriveSharedBits(this.dhKeyPair!.privateKey, senderPublicKey);
    const sessionKey = await deriveKeyHKDF(sharedBits, nonce || new Uint8Array(12), 'hoimu_p2p_envelope_v1');

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce || new Uint8Array(12) },
      sessionKey,
      ciphertext
    );

    return new Uint8Array(plaintextBuffer);
  }

  public async signPayload(payload: any): Promise<string> {
    return signCanonicalPayload(payload);
  }

  public async verifyPayload(payload: any, signatureHex: string, publicKeyHex?: string): Promise<boolean> {
    return verifyCanonicalPayload(payload, signatureHex, publicKeyHex);
  }
}

export const canonicalIdentityProvider = new CanonicalIdentityProvider();

export function getIdentityProvider(): CanonicalIdentityProvider {
  return canonicalIdentityProvider;
}
