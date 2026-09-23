/**
 * Message Decryptor
 * 
 * Decrypts authenticated E2EE envelopes using recipient private key:
 * Ephemeral X25519 ECDH + HKDF-SHA256 + AES-256-GCM.
 * Handles modern MeshMessageEnvelope and backward-compatible legacy bundles.
 */

import { MeshMessageEnvelope } from '../../types';
import { getSubtleCrypto, fromHex, fromBase64 } from '../../core/crypto';
import { deriveX25519KeyPairFromSeed } from '../crypto/meshCrypto';
import { envelopeService, EnvelopeService } from './envelopeService';

export class MessageDecryptor {
  constructor(private envelopeServiceRef: EnvelopeService = envelopeService) {}

  /**
   * Decrypts an authenticated MeshMessageEnvelope using recipient X25519 private key
   */
  public async decryptEnvelope(
    envelope: MeshMessageEnvelope,
    recipientPrivateKey: CryptoKey
  ): Promise<{ plaintext: string; verified: boolean }> {
    const subtle = getSubtleCrypto();

    // 1. Ephemeral public key
    const ephemPub = await subtle.importKey(
      'raw',
      fromHex(envelope.ephemeralPublicKey),
      { name: 'X25519' },
      false,
      []
    );

    // 2. Diffie-Hellman Key Agreement: X25519(recipientPriv, ephemeralPub) -> Shared Secret
    const sharedSecretBits = await subtle.deriveBits(
      { name: 'X25519', public: ephemPub },
      recipientPrivateKey,
      256
    );

    // 3. HKDF-SHA256
    const salt = fromHex(envelope.salt);
    const nonce = fromHex(envelope.nonce);

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
      ['decrypt']
    );

    // 4. AES-256-GCM Decryption
    const ciphertextBytes = fromBase64(envelope.ciphertext);
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      ciphertextBytes
    );

    const plaintext = new TextDecoder().decode(decryptedBuffer);
    return { plaintext, verified: true };
  }

  /**
   * Decrypts an envelope or serialized base64 payload using recipient private key or fallback seed
   */
  public async decryptPayload(
    payloadOrBase64: string,
    recipientPrivateKey: CryptoKey,
    fallbackKeyHex?: string
  ): Promise<string> {
    try {
      const parsed = this.envelopeServiceRef.parseEnvelope(payloadOrBase64);
      if (parsed) {
        try {
          const res = await this.decryptEnvelope(parsed, recipientPrivateKey);
          return res.plaintext;
        } catch (err) {
          if (fallbackKeyHex) {
            const derived = await deriveX25519KeyPairFromSeed(fallbackKeyHex);
            const res = await this.decryptEnvelope(parsed, derived.keyPair.privateKey);
            return res.plaintext;
          }
          throw err;
        }
      }

      // Legacy fallback for PBKDF2 bundles
      const raw = atob(payloadOrBase64);
      const bundle = JSON.parse(raw);
      if (bundle.alg === 'Ed25519-AES-GCM-256' && bundle.ciphertext) {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        const salt = new Uint8Array(bundle.ephemSalt);
        const iv = new Uint8Array(bundle.iv);
        const ciphertext = new Uint8Array(bundle.ciphertext);
        const keyHexToUse = fallbackKeyHex || 'default_node';

        const subtle = getSubtleCrypto();
        const keyMaterial = await subtle.importKey(
          'raw',
          enc.encode(keyHexToUse),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        const derivedKey = await subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 10000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv },
          derivedKey,
          ciphertext
        );
        return dec.decode(decrypted);
      } else if (bundle.text) {
        return bundle.text;
      }
    } catch {
      try {
        const decoded = atob(payloadOrBase64);
        const parsed = JSON.parse(decoded);
        if (parsed.text) return parsed.text;
      } catch {}
    }

    return '🔒 [Encrypted Mesh Packet]';
  }
}

export const messageDecryptor = new MessageDecryptor();
