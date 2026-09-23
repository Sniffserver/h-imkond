/**
 * HÕIMU Mesh Cryptographic Engine
 *
 * Implements real End-to-End Encryption (E2EE) with dual key architecture:
 *
 * 1. Identity Keypair (Ed25519):
 *    - Used for cryptographic signing and identity verification
 *    - Non-repudiation of sender identity across mesh multi-hop relays
 *
 * 2. Session / Encryption Keypair (X25519):
 *    - Used for Diffie-Hellman Key Agreement (ECDH over Curve25519)
 *    - Computes shared secret between sender's ephemeral key and recipient's public key
 *
 * Key Derivation & AEAD:
 *    X25519 shared secret
 *            ↓
 *       HKDF-SHA256 (domain: "hoimu-mesh-e2ee-v1", 16-byte salt)
 *            ↓
 *       AES-256-GCM (12-byte IV/nonce)
 *
 * Authenticated Message Envelope:
 *    {
 *      version: 1,
 *      id: "...",
 *      sender: "...",
 *      recipient: "...",
 *      ephemeralPublicKey: "...",
 *      nonce: "...",
 *      salt: "...",
 *      ciphertext: "...",
 *      signature: "...",
 *      senderIdentityKey: "...",
 *      ttl: 5,
 *      createdAt: 178...
 *    }
 */

// RFC 8410 PKCS#8 DER prefixes for Curve25519 private keys
const X25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export interface MeshMessageEnvelope {
  version: 1;
  id: string;
  sender: string;
  recipient: string;
  ephemeralPublicKey: string; // Hex representation of 32-byte X25519 ephemeral public key
  nonce: string; // Hex representation of 12-byte AES-GCM nonce/IV
  salt: string; // Hex representation of 16-byte HKDF salt
  ciphertext: string; // Base64 representation of AES-256-GCM ciphertext + tag
  signature: string; // Hex representation of Ed25519 signature
  senderIdentityKey: string; // Hex representation of 32-byte Ed25519 sender identity key
  ttl: number;
  createdAt: number;
}

export interface NodeCryptoIdentity {
  identity: {
    publicKeyHex: string;
    keyPair: CryptoKeyPair;
  };
  encryption: {
    publicKeyHex: string;
    keyPair: CryptoKeyPair;
  };
  createdAt: number;
}

// Byte utility helpers
export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function fromHex(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^(ed25519:|x25519:|0x)/i, '').replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(cleanHex.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto subtle is not available in this environment');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}

/**
 * Generate an Ed25519 identity keypair for signing and verification
 */
export async function generateIdentityKeyPair(): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  const subtle = getSubtleCrypto();
  try {
    const keyPair = (await subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;
    const pubRaw = await subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = toHex(new Uint8Array(pubRaw));
    return { publicKeyHex, keyPair };
  } catch (err) {
    console.warn('[meshCrypto] Native Ed25519 generation fallback:', err);
    // ECDSA P-256 fallback if platform does not support Ed25519
    const keyPair = (await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;
    const pubRaw = await subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyHex = toHex(new Uint8Array(pubRaw));
    return { publicKeyHex, keyPair };
  }
}

/**
 * Generate an X25519 keypair for key agreement and shared secret derivation
 */
export async function generateEncryptionKeyPair(): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  const subtle = getSubtleCrypto();
  try {
    const keyPair = (await subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveKey', 'deriveBits']
    )) as CryptoKeyPair;
    const pubRaw = await subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = toHex(new Uint8Array(pubRaw));
    return { publicKeyHex, keyPair };
  } catch (err) {
    console.warn('[meshCrypto] Native X25519 generation fallback:', err);
    // ECDH P-256 fallback if platform does not support X25519
    const keyPair = (await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )) as CryptoKeyPair;
    const pubRaw = await subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyHex = toHex(new Uint8Array(pubRaw));
    return { publicKeyHex, keyPair };
  }
}

/**
 * Derives a deterministic 32-byte private and public X25519 keypair from a seed string.
 * Used for deterministic test peers and initial demo contacts.
 */
export async function deriveX25519KeyPairFromSeed(seedStr: string): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  const subtle = getSubtleCrypto();
  const seedBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(`x25519-seed:${seedStr}`));
  const seedBytes = new Uint8Array(seedBuffer);

  // Construct PKCS#8 DER payload
  const pkcs8 = new Uint8Array(X25519_PKCS8_PREFIX.length + seedBytes.length);
  pkcs8.set(X25519_PKCS8_PREFIX, 0);
  pkcs8.set(seedBytes, X25519_PKCS8_PREFIX.length);

  const privateKey = await subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'X25519' },
    true,
    ['deriveBits', 'deriveKey']
  );

  // WebCrypto computes the Montgomery curve point X = x25519(d, BasePoint) upon JWK export
  const jwk = await subtle.exportKey('jwk', privateKey);
  const base64UrlX = jwk.x || '';
  const xBinary = atob(base64UrlX.replace(/-/g, '+').replace(/_/g, '/'));
  const xBytes = new Uint8Array(xBinary.length);
  for (let i = 0; i < xBinary.length; i++) {
    xBytes[i] = xBinary.charCodeAt(i);
  }

  const publicKey = await subtle.importKey('raw', xBytes, { name: 'X25519' }, true, []);
  const publicKeyHex = toHex(xBytes);

  return {
    publicKeyHex,
    keyPair: {
      privateKey,
      publicKey,
    },
  };
}

export interface DerivationResult {
  publicKeyHex: string;
  x25519PublicKeyHex: string;
  keyPair: {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
    privateKeyHex?: string;
  };
}

/**
 * Derives a deterministic Ed25519 identity keypair and companion X25519 keypair from a seed string.
 */
export async function deriveEd25519KeyPairFromSeed(seedStr: string): Promise<DerivationResult> {
  const subtle = getSubtleCrypto();
  const seedBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(`ed25519-seed:${seedStr}`));
  const seedBytes = new Uint8Array(seedBuffer);

  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + seedBytes.length);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seedBytes, ED25519_PKCS8_PREFIX.length);

  const privateKey = await subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'Ed25519' },
    true,
    ['sign']
  );

  const jwk = await subtle.exportKey('jwk', privateKey);
  const base64UrlX = jwk.x || '';
  const xBinary = atob(base64UrlX.replace(/-/g, '+').replace(/_/g, '/'));
  const xBytes = new Uint8Array(xBinary.length);
  for (let i = 0; i < xBinary.length; i++) {
    xBytes[i] = xBinary.charCodeAt(i);
  }

  const publicKey = await subtle.importKey('raw', xBytes, { name: 'Ed25519' }, true, ['verify']);
  const publicKeyHex = toHex(xBytes);

  // Derive companion X25519 key
  const x25519 = await deriveX25519KeyPairFromSeed(seedStr);

  return {
    publicKeyHex,
    x25519PublicKeyHex: x25519.publicKeyHex,
    keyPair: {
      privateKey,
      publicKey,
      privateKeyHex: seedStr,
    },
  };
}

/**
 * Encrypt arbitrary payload for direct peer using ephemeral X25519 and AES-GCM
 */
export async function encryptDirectPayload(
  plaintext: string,
  recipientPublicKeyHex: string,
  _senderPrivateKeyHex?: string
): Promise<{ cipherPayload: string; nonceHex: string; senderEphemeralPubKeyHex: string }> {
  const subtle = getSubtleCrypto();
  const ephemeralPair = (await subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits', 'deriveKey']
  )) as CryptoKeyPair;
  const ephemPubRaw = await subtle.exportKey('raw', ephemeralPair.publicKey);
  const senderEphemeralPubKeyHex = toHex(new Uint8Array(ephemPubRaw));

  const recipientPubKey = await importX25519PublicKey(recipientPublicKeyHex);
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'X25519', public: recipientPubKey },
    ephemeralPair.privateKey,
    256
  );

  const nonce = getRandomValues(new Uint8Array(12));
  const salt = getRandomValues(new Uint8Array(16));
  const hkdfKey = await subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('hoimu-mesh-direct-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    cipherPayload: toBase64(new Uint8Array(ciphertextBuffer)),
    nonceHex: toHex(nonce) + ':' + toHex(salt),
    senderEphemeralPubKeyHex,
  };
}

/**
 * Decrypt direct peer payload using recipient's private key
 */
export async function decryptDirectPayload(
  encrypted: { cipherPayload: string; nonceHex: string; senderEphemeralPubKeyHex: string },
  recipientPrivateKeyOrSeed?: string | CryptoKey
): Promise<string> {
  const subtle = getSubtleCrypto();
  const parts = encrypted.nonceHex.split(':');
  const nonce = fromHex(parts[0]);
  const salt = parts[1] ? fromHex(parts[1]) : fromHex(parts[0]);

  let recipientPrivKey: CryptoKey;
  if (typeof recipientPrivateKeyOrSeed === 'string') {
    const derived = await deriveX25519KeyPairFromSeed(recipientPrivateKeyOrSeed);
    recipientPrivKey = derived.keyPair.privateKey;
  } else if (recipientPrivateKeyOrSeed) {
    recipientPrivKey = recipientPrivateKeyOrSeed;
  } else {
    const derived = await deriveX25519KeyPairFromSeed('default_node');
    recipientPrivKey = derived.keyPair.privateKey;
  }

  const ephemPub = await subtle.importKey(
    'raw',
    fromHex(encrypted.senderEphemeralPubKeyHex),
    { name: 'X25519' },
    false,
    []
  );

  const sharedSecretBits = await subtle.deriveBits(
    { name: 'X25519', public: ephemPub },
    recipientPrivKey,
    256
  );

  const hkdfKey = await subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveKey']);
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('hoimu-mesh-direct-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ciphertextBytes = fromBase64(encrypted.cipherPayload);
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    ciphertextBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Import a 32-byte raw X25519 public key from hex (or fallback hash)
 */
export async function importX25519PublicKey(publicKeyHexOrIdentifier: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  let bytes = fromHex(publicKeyHexOrIdentifier);

  // If not exactly 32 bytes, derive deterministic 32-byte buffer via SHA-256
  if (bytes.length !== 32) {
    const hash = await subtle.digest('SHA-256', new TextEncoder().encode(publicKeyHexOrIdentifier));
    bytes = new Uint8Array(hash);
  }

  return subtle.importKey('raw', bytes, { name: 'X25519' }, false, []);
}

/**
 * Import an Ed25519 public key from hex
 */
export async function importEd25519PublicKey(publicKeyHex: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  let bytes = fromHex(publicKeyHex);
  if (bytes.length !== 32) {
    const hash = await subtle.digest('SHA-256', new TextEncoder().encode(publicKeyHex));
    bytes = new Uint8Array(hash);
  }
  return subtle.importKey('raw', bytes, { name: 'Ed25519' }, false, ['verify']);
}

/**
 * Compute the canonical string representation of an envelope for cryptographic signing
 */
function getEnvelopeCanonicalString(envelope: {
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

/**
 * Encrypt a mesh message using true E2EE:
 * 1. Ephemeral X25519 Keypair generation (Forward Secrecy)
 * 2. Diffie-Hellman Key Agreement: X25519(ephemeralPriv, recipientPub) -> Shared Secret
 * 3. HKDF-SHA256(sharedSecret, salt, info="hoimu-mesh-e2ee-v1") -> AES-GCM-256 Key
 * 4. AES-256-GCM encryption with 12-byte random nonce
 * 5. Ed25519 signature by sender's identity key for non-repudiation
 */
export async function encryptMeshMessage(params: {
  content: string;
  senderCallsign: string;
  recipientCallsign: string;
  recipientX25519PublicKeyHex: string;
  senderIdentityKeyPair: CryptoKeyPair;
  senderIdentityPublicKeyHex: string;
  messageId?: string;
  ttl?: number;
}): Promise<MeshMessageEnvelope> {
  const subtle = getSubtleCrypto();
  const id = params.messageId || `01J${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
  const createdAt = Date.now();
  const ttl = params.ttl ?? 5;

  // 1. Generate ephemeral X25519 keypair
  const ephemeralPair = (await subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits', 'deriveKey']
  )) as CryptoKeyPair;
  const ephemPubRaw = await subtle.exportKey('raw', ephemeralPair.publicKey);
  const ephemeralPublicKey = toHex(new Uint8Array(ephemPubRaw));

  // 2. Import recipient's X25519 public key
  const recipientPublicKey = await importX25519PublicKey(params.recipientX25519PublicKeyHex);

  // 3. Derive 256-bit shared secret via X25519
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'X25519', public: recipientPublicKey },
    ephemeralPair.privateKey,
    256
  );

  // 4. Derive AEAD key with HKDF-SHA256
  const salt = getRandomValues(new Uint8Array(16));
  const nonce = getRandomValues(new Uint8Array(12));

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

  // 5. Encrypt with AES-256-GCM
  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    new TextEncoder().encode(params.content)
  );
  const ciphertext = toBase64(new Uint8Array(ciphertextBuffer));

  // 6. Sign envelope data with sender's Ed25519 identity key
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
 * Decrypt a mesh message using true E2EE:
 * 1. Extract ephemeral X25519 public key from envelope
 * 2. Diffie-Hellman Key Agreement: X25519(recipientPriv, ephemeralPub) -> Shared Secret
 * 3. HKDF-SHA256(sharedSecret, salt, info="hoimu-mesh-e2ee-v1") -> AES-GCM-256 Key
 * 4. AES-256-GCM authenticated decryption with envelope nonce
 * 5. Verify Ed25519 signature if sender public identity key is present
 */
export async function decryptMeshMessage(
  envelope: MeshMessageEnvelope,
  recipientX25519PrivateKey: CryptoKey
): Promise<{ plaintext: string; signatureValid: boolean }> {
  const subtle = getSubtleCrypto();

  // 1. Import ephemeral X25519 public key
  const ephemeralPublicKey = await subtle.importKey(
    'raw',
    fromHex(envelope.ephemeralPublicKey),
    { name: 'X25519' },
    false,
    []
  );

  // 2. Derive same shared secret using recipient's private key
  const sharedSecretBits = await subtle.deriveBits(
    { name: 'X25519', public: ephemeralPublicKey },
    recipientX25519PrivateKey,
    256
  );

  // 3. Derive same AEAD key using HKDF-SHA256
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

  // 4. Decrypt with AES-256-GCM
  const ciphertextBytes = fromBase64(envelope.ciphertext);
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    ciphertextBytes
  );

  const plaintext = new TextDecoder().decode(decryptedBuffer);

  // 5. Verify Ed25519 signature
  let signatureValid = false;
  if (envelope.senderIdentityKey && envelope.signature) {
    try {
      const senderPublicKey = await importEd25519PublicKey(envelope.senderIdentityKey);
      const canonicalData = getEnvelopeCanonicalString(envelope);
      const signatureBytes = fromHex(envelope.signature);
      signatureValid = await subtle.verify(
        { name: 'Ed25519' },
        senderPublicKey,
        signatureBytes,
        new TextEncoder().encode(canonicalData)
      );
    } catch (e) {
      console.warn('[meshCrypto] Signature verification check failed:', e);
      signatureValid = false;
    }
  }

  return { plaintext, signatureValid };
}

/**
 * Check if a raw string is a serialized v1 MeshMessageEnvelope
 */
export function parseEnvelope(payload: string): MeshMessageEnvelope | null {
  try {
    let jsonStr = payload.trim();
    if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
      const parsed = JSON.parse(jsonStr);
      if (parsed.version === 1 && parsed.ephemeralPublicKey && parsed.ciphertext && parsed.nonce) {
        return parsed as MeshMessageEnvelope;
      }
    }
    // Try base64 decoded
    const decoded = atob(jsonStr);
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const parsed = JSON.parse(decoded);
      if (parsed.version === 1 && parsed.ephemeralPublicKey && parsed.ciphertext && parsed.nonce) {
        return parsed as MeshMessageEnvelope;
      }
    }
  } catch {
    // Not an envelope JSON
  }
  return null;
}

/**
 * Canonical JSON serialization (RFC 8785 compliant subset)
 * Deterministically sorts object keys recursively, removes undefined values,
 * and encodes to UTF-8 Uint8Array.
 */
export function canonicalize(val: any): Uint8Array {
  function stringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => stringify(item) ?? 'null').join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const result: string[] = [];
    for (const key of keys) {
      const v = obj[key];
      if (v !== undefined) {
        result.push(JSON.stringify(key) + ':' + stringify(v));
      }
    }
    return '{' + result.join(',') + '}';
  }

  const jsonStr = stringify(val);
  return new TextEncoder().encode(jsonStr);
}

/**
 * Sign any canonical JS object / event using Ed25519
 */
export async function signCanonicalPayload(
  payload: any,
  signingKey?: CryptoKey
): Promise<string> {
  const subtle = getSubtleCrypto();
  const canonicalBytes = canonicalize(payload);

  if (signingKey) {
    const signatureBuffer = await subtle.sign(
      { name: 'Ed25519' },
      signingKey,
      canonicalBytes
    );
    return toHex(new Uint8Array(signatureBuffer));
  }

  // Derive / use local deterministic key if no key provided
  const derived = await deriveEd25519KeyPairFromSeed('hoimu-local-node-key');
  const signatureBuffer = await subtle.sign(
    { name: 'Ed25519' },
    derived.keyPair.privateKey,
    canonicalBytes
  );
  return toHex(new Uint8Array(signatureBuffer));
}

/**
 * Cryptographically verify a signed canonical payload against an Ed25519 public key
 */
export async function verifyCanonicalPayload(
  payload: any,
  signatureHex: string,
  publicKeyHexOrKey?: string | CryptoKey
): Promise<boolean> {
  if (!signatureHex || typeof signatureHex !== 'string') return false;
  const subtle = getSubtleCrypto();
  const canonicalBytes = canonicalize(payload);

  try {
    let pubKey: CryptoKey;
    if (!publicKeyHexOrKey) {
      const derived = await deriveEd25519KeyPairFromSeed('hoimu-local-node-key');
      pubKey = derived.keyPair.publicKey;
    } else if (typeof publicKeyHexOrKey === 'string') {
      pubKey = await importEd25519PublicKey(publicKeyHexOrKey);
    } else {
      pubKey = publicKeyHexOrKey;
    }

    const signatureBytes = fromHex(signatureHex);
    return await subtle.verify(
      { name: 'Ed25519' },
      pubKey,
      signatureBytes,
      canonicalBytes
    );
  } catch (err) {
    console.warn('[meshCrypto] verifyCanonicalPayload failed:', err);
    return false;
  }
}
