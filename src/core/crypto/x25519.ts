/**
 * HÕIMU Core X25519 Diffie-Hellman Key Exchange
 */

import { toHex, fromHex } from './utils';

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

export async function generateX25519KeyPair(extractable = false): Promise<X25519KeyPair> {
  const subtle = getSubtle();
  const pair = (await subtle.generateKey({ name: 'X25519' }, extractable, [
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

export async function deriveSharedBits(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey | Uint8Array | string,
  bitLength = 256
): Promise<Uint8Array> {
  const subtle = getSubtle();
  let peerKey: CryptoKey;

  if (typeof peerPublicKey === 'string') {
    const raw = fromHex(peerPublicKey);
    peerKey = await subtle.importKey('raw', raw, { name: 'X25519' }, false, []);
  } else if (peerPublicKey instanceof Uint8Array) {
    peerKey = await subtle.importKey('raw', peerPublicKey, { name: 'X25519' }, false, []);
  } else {
    peerKey = peerPublicKey;
  }

  const bits = await subtle.deriveBits(
    {
      name: 'X25519',
      public: peerKey,
    },
    privateKey,
    bitLength
  );

  return new Uint8Array(bits);
}
