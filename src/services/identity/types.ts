/**
 * HÕIMU Identity & Trust Architecture Types
 * 
 * Defines local identity, peer identity records, trust levels, and rotation metadata.
 */

export type PlatformTarget = 'web' | 'android' | 'test';

export type StorageProviderType = 'webcrypto_indexeddb' | 'android_keystore' | 'memory_fallback';

export type TrustState = 'unknown' | 'verified' | 'blocked' | 'expired';

export interface PeerIdentity {
  nodeId: string;
  callsign: string;

  signingPublicKey: string; // Hex-encoded Ed25519 public key (64 hex characters)
  encryptionPublicKey: string; // Hex-encoded X25519 public key (64 hex characters)

  firstSeenAt: number;
  lastSeenAt: number;

  trustState: TrustState;

  capabilities: string[];
}

export interface LocalIdentityRecord {
  nodeId: string;
  callsign: string;
  signingPublicKeyHex: string;
  encryptionPublicKeyHex: string;
  createdAt: number;
  rotationEpoch: number;
  keyAlias: string;
}

export interface KeyRotationProof {
  previousPublicKeyHex: string;
  newPublicKeyHex: string;
  timestamp: number;
  rotationEpoch: number;
  signatureByPreviousKey: string; // Signature validating authorization to rotate
  signatureByNewKey: string;      // Signature proving possession of new private key
}

export interface DeviceKeyMetadata {
  algorithm: 'AES-GCM-256';
  extractable: boolean;
  storageProvider: StorageProviderType;
  isHardwareBacked: boolean;
  createdAt: number;
  keyAlias: string;
}

export interface NodeIdentityKeyInfo {
  publicKeyHex: string;
  algorithm: 'Ed25519' | 'ECDSA';
  isHardwareBacked: boolean;
  createdAt: number;
}

export interface EncryptedDataEnvelope {
  v: 2;
  alg: 'AES-GCM-256';
  iv: string; // Base64 96-bit IV
  ct: string; // Base64 Ciphertext + 128-bit authentication tag
  tagLength: 128;
  ts: number;
  provider: StorageProviderType;
  hardwareBacked?: boolean;
}

/**
 * Universal interface for device-bound Identity and Secure Storage
 */
export interface IIdentityService {
  readonly platform: PlatformTarget;
  readonly providerType: StorageProviderType;
  readonly isHardwareBacked: boolean;

  /**
   * Initializes the cryptographic provider, establishing access to IndexedDB or Android Keystore
   */
  initialize(): Promise<void>;

  /**
   * Retrieves the current local identity record (nodeId, callsign, keys)
   */
  getLocalIdentity(): Promise<LocalIdentityRecord>;

  /**
   * Retrieves or generates the device-bound master AES-GCM-256 CryptoKey.
   * On Web: Non-extractable (extractable: false) and stored directly in IndexedDB.
   * On Android: Bound to Android Keystore in the hardware TEE / StrongBox.
   */
  getDeviceKey(): Promise<CryptoKey>;

  /**
   * Retrieves the node's Ed25519 identity keypair for signing and mesh authentication.
   */
  getIdentityKeyPair(): Promise<CryptoKeyPair>;

  /**
   * Retrieves the node's X25519 encryption keypair for E2EE key agreement.
   */
  getEncryptionKeyPair(): Promise<CryptoKeyPair>;

  /**
   * Retrieves the node's hex-encoded public identity key.
   */
  getIdentityPublicKey(): Promise<string>;

  /**
   * Retrieves the node's hex-encoded public encryption key (X25519).
   */
  getEncryptionPublicKey(): Promise<string>;

  /**
   * Signs arbitrary payload using the non-extractable identity private key.
   */
  signWithIdentity(data: Uint8Array): Promise<string>;

  /**
   * Verifies a digital signature against an identity public key.
   */
  verifyWithIdentity(data: Uint8Array, signatureHex: string, publicKeyHex?: string): Promise<boolean>;

  /**
   * Encrypts plaintext using the hardware/device-bound master key.
   */
  encryptData(plaintext: string): Promise<string>;

  /**
   * Decrypts an authenticated envelope using the hardware/device-bound master key.
   */
  decryptData(envelopeJsonOrRaw: string): Promise<string>;

  /**
   * Stores a key-value pair in device-bound secure storage (never exposing keys to plaintext storage).
   */
  setSecureItem(key: string, value: string): Promise<void>;

  /**
   * Retrieves an item from device-bound secure storage.
   */
  getSecureItem(key: string): Promise<string | null>;

  /**
   * Removes an item from device-bound secure storage.
   */
  removeSecureItem(key: string): Promise<void>;

  /**
   * Wipes all items from device-bound secure storage.
   */
  clearSecureStorage(): Promise<void>;
}
