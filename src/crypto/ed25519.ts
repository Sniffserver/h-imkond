/**
 * Real Ed25519 Signing & Verification
 */

import { toHex, fromHex } from './aead';

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

export async function generateEd25519KeyPair(extractable: boolean = false): Promise<Ed25519KeyPair> {
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

export async function deriveEd25519FromSeed(seed: string): Promise<Ed25519KeyPair> {
  const subtle = getSubtle();
  const seedBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(`hoimu_ed25519_${seed}`));
  const seedBytes = new Uint8Array(seedBuffer);

  // PKCS#8 DER envelope for Ed25519 private key
  const pkcs8Der = new Uint8Array(48);
  pkcs8Der.set([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ], 0);
  pkcs8Der.set(seedBytes, 16);

  const privateKey = await subtle.importKey('pkcs8', pkcs8Der, { name: 'Ed25519' }, true, ['sign']);

  const jwk = await subtle.exportKey('jwk', privateKey);
  const rawPubBytes = fromHex(
    Array.from(atob(jwk.x!.replace(/-/g, '+').replace(/_/g, '/')))
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );

  const publicKey = await subtle.importKey('raw', rawPubBytes, { name: 'Ed25519' }, true, ['verify']);

  return {
    publicKey,
    privateKey,
    publicKeyHex: toHex(rawPubBytes),
  };
}

export async function signBytes(privateKey: CryptoKey, messageBytes: Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const sigBuffer = await subtle.sign({ name: 'Ed25519' }, privateKey, messageBytes);
  return toHex(new Uint8Array(sigBuffer));
}

export async function verifySignature(
  publicKeyHexOrKey: string | CryptoKey,
  messageBytes: Uint8Array,
  signatureHex: string
): Promise<boolean> {
  try {
    const subtle = getSubtle();
    let pubKey: CryptoKey;

    if (typeof publicKeyHexOrKey === 'string') {
      const pubBytes = fromHex(publicKeyHexOrKey);
      pubKey = await subtle.importKey('raw', pubBytes, { name: 'Ed25519' }, true, ['verify']);
    } else {
      pubKey = publicKeyHexOrKey;
    }

    const sigBytes = fromHex(signatureHex);
    return await subtle.verify({ name: 'Ed25519' }, pubKey, sigBytes, messageBytes);
  } catch {
    return false;
  }
}
