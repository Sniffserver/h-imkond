/**
 * Real X25519 Key Exchange (ECDH) using Web Crypto API
 */

import { toHex, fromHex } from './aead';

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available');
}

export interface X25519KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyHex: string;
}

export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  const subtle = getSubtle();
  const pair = (await subtle.generateKey({ name: 'X25519' }, true, [
    'deriveBits',
    'deriveKey',
  ])) as CryptoKeyPair;

  const rawPub = await subtle.exportKey('raw', pair.publicKey);
  const publicKeyHex = toHex(new Uint8Array(rawPub));

  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyHex,
  };
}

export async function deriveX25519FromSeed(seed: string): Promise<X25519KeyPair> {
  const subtle = getSubtle();
  const seedBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(`hoimu_x25519_${seed}`));
  const seedBytes = new Uint8Array(seedBuffer);

  const pkcs8Der = new Uint8Array(48);
  pkcs8Der.set([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
  ], 0);
  pkcs8Der.set(seedBytes, 16);

  const privateKey = await subtle.importKey('pkcs8', pkcs8Der, { name: 'X25519' }, true, [
    'deriveBits',
    'deriveKey',
  ]);

  const jwk = await subtle.exportKey('jwk', privateKey);
  const rawPubBytes = fromHex(
    Array.from(atob(jwk.x!.replace(/-/g, '+').replace(/_/g, '/')))
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );

  const publicKey = await subtle.importKey('raw', rawPubBytes, { name: 'X25519' }, true, []);

  return {
    publicKey,
    privateKey,
    publicKeyHex: toHex(rawPubBytes),
  };
}

export async function computeSharedSecret(
  ourPrivateKey: CryptoKey,
  theirPublicKeyHex: string
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const theirPubKeyBytes = fromHex(theirPublicKeyHex);
  const theirPubKey = await subtle.importKey('raw', theirPubKeyBytes, { name: 'X25519' }, false, []);

  const sharedBits = await subtle.deriveBits(
    { name: 'X25519', public: theirPubKey },
    ourPrivateKey,
    256
  );

  return new Uint8Array(sharedBits);
}
