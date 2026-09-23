/**
 * HÕIMU Identity & Hardware-Bound Secure Storage Architecture
 * 
 * Provides hardware-backed key protection, non-extractable cryptographic key management,
 * and isolated storage across Web (WebCrypto + IndexedDB) and Android (Android Keystore + Native Secure Storage).
 */

export type PlatformTarget = 'web' | 'android' | 'test';

export type StorageProviderType = 'webcrypto_indexeddb' | 'android_keystore' | 'memory_fallback';

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
   * Retrieves the node's hex-encoded public identity key.
   */
  getIdentityPublicKey(): Promise<string>;

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
