/**
 * HÕIMU Core Cryptographic Types
 */

export interface CryptoKeyPairBytes {
  publicKey: Uint8Array;
  publicKeyHex: string;
}

export interface SharedSecretResult {
  sharedKey: Uint8Array;
}

export interface AeadEncryptionResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  tag?: Uint8Array;
}
