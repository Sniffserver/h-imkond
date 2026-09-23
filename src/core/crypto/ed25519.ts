/**
 * HÕIMU Core Ed25519 Signing & Verification
 */

import { toHex, fromHex } from './utils';

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available');
}

export interface Ed25519KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyHex: string;
}

export async function generateEd25519KeyPair(extractable = false): Promise<Ed25519KeyPair> {
  const subtle = getSubtle();
  const pair = (await subtle.generateKey({ name: 'Ed25519' }, extractable, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;

  const rawPub = await subtle.exportKey('raw', pair.publicKey);
  const publicKeyHex = toHex(new Uint8Array(rawPub));

  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyHex,
  };
}

export async function signEd25519(data: Uint8Array, privateKey: CryptoKey): Promise<Uint8Array> {
  const subtle = getSubtle();
  const sig = await subtle.sign({ name: 'Ed25519' }, privateKey, data);
  return new Uint8Array(sig);
}

export async function verifyEd25519(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: CryptoKey | Uint8Array | string
): Promise<boolean> {
  const subtle = getSubtle();
  let key: CryptoKey;

  if (typeof publicKey === 'string') {
    const raw = fromHex(publicKey);
    key = await subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
  } else if (publicKey instanceof Uint8Array) {
    key = await subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
  } else {
    key = publicKey;
  }

  return await subtle.verify({ name: 'Ed25519' }, key, signature, data);
}

export async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const sig = await signEd25519(data, privateKey);
  return toHex(sig);
}

export async function verifySignature(
  publicKey: CryptoKey | Uint8Array | string,
  data: Uint8Array,
  signatureHex: string
): Promise<boolean> {
  const sigBytes = fromHex(signatureHex);
  return await verifyEd25519(data, sigBytes, publicKey);
}
