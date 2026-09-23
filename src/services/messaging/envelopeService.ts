/**
 * Envelope Service
 * 
 * Creates and parses E2EE MeshMessageEnvelopes:
 * X25519 Session -> HKDF-SHA256 -> AES-256-GCM -> Ed25519 Signature.
 */

import { MeshMessageEnvelope } from '../../types';
import { getSubtleCrypto, getRandomBytes, toHex, fromHex, toBase64 } from '../../core/crypto';
import { canonicalize } from '../../protocol/canonical';

export function getEnvelopeCanonicalString(envelope: {
  version: number;
  id: string;
  sender: string;
  recipient: string;
  ephemeralPublicKey: string;
  nonce: string;
  ciphertext: string;
  createdAt: number;
}): string {
  return `v${envelope.version}:${envelope.id}:${envelope.sender}:${envelope.recipient}:${envelope.ephemeralPublicKey}:${envelope.nonce}:${envelope.ciphertext}:${envelope.createdAt}`;
}

export interface CreateEnvelopeParams {
  content: string;
  senderCallsign: string;
  recipientCallsign: string;
  recipientX25519PublicKeyHex: string;
  senderIdentityKeyPair: CryptoKeyPair;
  senderIdentityPublicKeyHex: string;
  messageId?: string;
  ttl?: number;
}

export class EnvelopeService {
  /**
   * Encrypts plaintext message into a signed cryptographic MeshMessageEnvelope
   */
  public async createEnvelope(params: CreateEnvelopeParams): Promise<MeshMessageEnvelope> {
    const subtle = getSubtleCrypto();
    const id = params.messageId || `01J${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = Date.now();
    const ttl = params.ttl ?? 5;

    // 1. Ephemeral X25519 Keypair generation (Forward Secrecy)
    const ephemeralPair = (await subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveBits', 'deriveKey']
    )) as CryptoKeyPair;
    const ephemPubRaw = await subtle.exportKey('raw', ephemeralPair.publicKey);
    const ephemeralPublicKey = toHex(new Uint8Array(ephemPubRaw));

    // 2. Import recipient's X25519 public key
    let recipientPubBytes = fromHex(params.recipientX25519PublicKeyHex.replace(/^(0x|x25519:)/i, ''));
    if (recipientPubBytes.length !== 32) {
      const hash = await subtle.digest('SHA-256', new TextEncoder().encode(params.recipientX25519PublicKeyHex));
      recipientPubBytes = new Uint8Array(hash);
    }
    const recipientPublicKey = await subtle.importKey('raw', recipientPubBytes, { name: 'X25519' }, false, []);

    // 3. Diffie-Hellman Key Agreement: X25519(ephemeralPriv, recipientPub) -> Shared Secret
    const sharedSecretBits = await subtle.deriveBits(
      { name: 'X25519', public: recipientPublicKey },
      ephemeralPair.privateKey,
      256
    );

    // 4. HKDF-SHA256 AEAD key derivation
    const salt = getRandomBytes(16);
    const nonce = getRandomBytes(12);

    const hkdfKey = await subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveKey']);
    const aesKey = await subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: new TextEncoder().encode('hoimu-mesh-e2ee-v1'),
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // 5. AES-256-GCM authenticated encryption
    const ciphertextBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      new TextEncoder().encode(params.content)
    );
    const ciphertext = toBase64(new Uint8Array(ciphertextBuffer));

    // 6. Ed25519 signature of envelope for non-repudiation
    const canonicalData = getEnvelopeCanonicalString({
      version: 1,
      id,
      sender: params.senderCallsign,
      recipient: params.recipientCallsign,
      ephemeralPublicKey,
      nonce: toHex(nonce),
      ciphertext,
      createdAt,
    });

    const signatureBuffer = await subtle.sign(
      { name: 'Ed25519' },
      params.senderIdentityKeyPair.privateKey,
      new TextEncoder().encode(canonicalData)
    );
    const signature = toHex(new Uint8Array(signatureBuffer));

    return {
      version: 1,
      id,
      sender: params.senderCallsign,
      recipient: params.recipientCallsign,
      ephemeralPublicKey,
      nonce: toHex(nonce),
      salt: toHex(salt),
      ciphertext,
      signature,
      senderIdentityKey: params.senderIdentityPublicKeyHex,
      ttl,
      createdAt,
    };
  }

  /**
   * Safely parses envelope from base64 string or JSON object
   */
  public parseEnvelope(rawEnvelopeOrBase64: string | object): MeshMessageEnvelope | null {
    if (!rawEnvelopeOrBase64) return null;

    if (typeof rawEnvelopeOrBase64 === 'object') {
      const obj = rawEnvelopeOrBase64 as any;
      if (obj.version === 1 && obj.ephemeralPublicKey && obj.ciphertext && obj.nonce && obj.signature) {
        return obj as MeshMessageEnvelope;
      }
      return null;
    }

    try {
      // 1. Direct JSON
      const parsed = JSON.parse(rawEnvelopeOrBase64);
      if (parsed.version === 1 && parsed.ephemeralPublicKey && parsed.ciphertext) {
        return parsed as MeshMessageEnvelope;
      }
    } catch {
      // Not raw JSON, try base64 decode
    }

    try {
      const decoded = atob(rawEnvelopeOrBase64);
      const parsed = JSON.parse(decoded);
      if (parsed.version === 1 && parsed.ephemeralPublicKey && parsed.ciphertext) {
        return parsed as MeshMessageEnvelope;
      }
    } catch {
      // Not base64 envelope
    }

    return null;
  }
}

export const envelopeService = new EnvelopeService();
