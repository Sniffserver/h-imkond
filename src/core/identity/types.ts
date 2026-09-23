/**
 * HÕIMU Core Identity Provider Interface & Types
 */

export interface NodeIdentity {
  nodeId: string; // 16-hex character deterministic node identifier derived from Ed25519 public key
  callsign: string; // Human-readable callsign (e.g. 'TALLINN-01')
  signingPublicKey: Uint8Array; // Raw Ed25519 public key bytes (32 bytes)
  signingPublicKeyHex: string; // Hex representation (64 chars)
  dhPublicKey: Uint8Array; // Raw X25519 public key bytes (32 bytes)
  dhPublicKeyHex: string; // Hex representation (64 chars)
  createdAt: number;
}

export interface EncryptedEnvelope {
  ciphertext: Uint8Array;
  nonce: Uint8Array; // 12-byte IV for AES-GCM
  senderEphemeralPublicKey: Uint8Array; // 32-byte raw X25519 public key
  tag?: Uint8Array; // Optional separate tag if not appended to ciphertext
}

export interface IdentityProvider {
  /**
   * Initializes hardware/storage-bound keys, setting up IndexedDB or Android Keystore
   */
  initialize(): Promise<void>;

  /**
   * Retrieves the current node's identity metadata and public keys
   */
  getNodeIdentity(): Promise<NodeIdentity>;

  /**
   * Signs arbitrary payload bytes using the non-extractable Ed25519 identity key
   */
  sign(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Returns the node's Ed25519 public key in raw bytes (32 bytes)
   */
  getPublicKey(): Promise<Uint8Array>;

  /**
   * Performs ephemeral X25519 Diffie-Hellman + HKDF-SHA-256 + AES-GCM-256 encryption for peer
   */
  encryptForPeer(peerPublicKey: Uint8Array, plaintext: Uint8Array): Promise<EncryptedEnvelope>;

  /**
   * Decrypts ciphertext from a peer using the node's DH private key and peer's public key
   */
  decrypt(ciphertext: Uint8Array, senderPublicKey: Uint8Array, nonce?: Uint8Array): Promise<Uint8Array>;

  /**
   * Deterministically signs any structured JSON/object payload using RFC 8785 canonicalization
   */
  signPayload(payload: any): Promise<string>;

  /**
   * Verifies a digital signature against a structured payload and optional public key hex
   */
  verifyPayload(payload: any, signatureHex: string, publicKeyHex?: string): Promise<boolean>;
}
