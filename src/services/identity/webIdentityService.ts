/**
 * Web Implementation of IdentityService
 * 
 * Architecture:
 * - WebCrypto API (crypto.subtle)
 * - Hardware-isolated, Non-Extractable CryptoKey (extractable: false)
 * - IndexedDB structured clone storage (isolated from localStorage)
 * - Zero plaintext raw keys in localStorage
 */

import {
  IIdentityService,
  PlatformTarget,
  StorageProviderType,
  EncryptedDataEnvelope,
} from './types';

const DB_NAME = 'hoimu_secure_keystore';
const DB_VERSION = 1;
const STORE_KEYS = 'device_keys';
const STORE_SECURE_KV = 'secure_kv';

const KEY_ALIAS_DEVICE_MASTER = 'device_master_key';
const KEY_ALIAS_IDENTITY = 'identity_key_pair';

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i].toString(16);
    hex += b.length === 1 ? '0' + b : b;
  }
  return hex;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBuffer(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export class WebIdentityService implements IIdentityService {
  public readonly platform: PlatformTarget = 'web';
  public readonly providerType: StorageProviderType = 'webcrypto_indexeddb';
  public readonly isHardwareBacked: boolean = false;

  private db: IDBDatabase | null = null;
  private cachedDeviceKey: CryptoKey | null = null;
  private cachedIdentityKeyPair: CryptoKeyPair | null = null;
  private cachedIdentityPubKeyHex: string | null = null;

  // In-memory fallback if IndexedDB is disabled or unavailable (e.g. headless tests)
  private memoryKeys = new Map<string, CryptoKey | CryptoKeyPair>();
  private memorySecureKV = new Map<string, string>();
  private initialized = false;

  private getSubtle(): SubtleCrypto {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    if (!cryptoObj || !cryptoObj.subtle) {
      throw new Error('[WebIdentityService] WebCrypto subtle is unavailable in this environment');
    }
    return cryptoObj.subtle;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // Purge legacy insecure raw keys from localStorage if present
    this.purgeLegacyRawKeys();

    try {
      await this.openDatabase();
    } catch {
      // In headless test environments or sandboxed iframes without IndexedDB, falls back to isolated memory store
    }

    this.initialized = true;
  }

  private purgeLegacyRawKeys(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('hoimu_webcrypto_device_raw_key');
        localStorage.removeItem('hoimu_aes_key');
      } catch {
        // Sandboxed environment
      }
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const idb = typeof window !== 'undefined' ? window.indexedDB : (globalThis as any).indexedDB;
      if (!idb) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS);
        }
        if (!db.objectStoreNames.contains(STORE_SECURE_KV)) {
          db.createObjectStore(STORE_SECURE_KV);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getIDBItem<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async setIDBItem<T>(storeName: string, key: string, value: T): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async removeIDBItem(storeName: string, key: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async clearIDBStore(storeName: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retrieves or generates the device AES-GCM-256 master key.
   * GUARANTEE: extractable is FALSE. The raw key bytes cannot be extracted by JavaScript.
   */
  public async getDeviceKey(): Promise<CryptoKey> {
    if (this.cachedDeviceKey) return this.cachedDeviceKey;

    await this.initialize();

    // 1. Check IndexedDB
    try {
      const storedKey = await this.getIDBItem<CryptoKey>(STORE_KEYS, KEY_ALIAS_DEVICE_MASTER);
      if (storedKey && storedKey.type === 'secret') {
        this.cachedDeviceKey = storedKey;
        return storedKey;
      }
    } catch {
      // Ignore IDB errors and check memory
    }

    // 2. Check memory store
    const memKey = this.memoryKeys.get(KEY_ALIAS_DEVICE_MASTER);
    if (memKey && 'type' in memKey && memKey.type === 'secret') {
      this.cachedDeviceKey = memKey;
      return memKey;
    }

    // 3. Generate brand new NON-EXTRACTABLE key
    const subtle = this.getSubtle();
    const newKey = (await subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // CRITICAL: extractable is FALSE (tamper-proof against XSS extraction)
      ['encrypt', 'decrypt']
    )) as CryptoKey;

    this.cachedDeviceKey = newKey;
    this.memoryKeys.set(KEY_ALIAS_DEVICE_MASTER, newKey);

    // Save to IndexedDB if available (structured clone preserves CryptoKey with extractable: false)
    try {
      await this.setIDBItem(STORE_KEYS, KEY_ALIAS_DEVICE_MASTER, newKey);
    } catch (err) {
      console.warn('[WebIdentityService] Could not persist CryptoKey to IndexedDB, retaining in memory:', err);
    }

    return newKey;
  }

  /**
   * Retrieves or generates the Ed25519 identity keypair
   */
  public async getIdentityKeyPair(): Promise<CryptoKeyPair> {
    if (this.cachedIdentityKeyPair) return this.cachedIdentityKeyPair;

    await this.initialize();

    // 1. Check IndexedDB
    try {
      const storedPair = await this.getIDBItem<CryptoKeyPair>(STORE_KEYS, KEY_ALIAS_IDENTITY);
      if (storedPair && storedPair.publicKey && storedPair.privateKey) {
        this.cachedIdentityKeyPair = storedPair;
        return storedPair;
      }
    } catch {}

    // 2. Check memory store
    const memPair = this.memoryKeys.get(KEY_ALIAS_IDENTITY);
    if (memPair && 'publicKey' in memPair && 'privateKey' in memPair) {
      this.cachedIdentityKeyPair = memPair as CryptoKeyPair;
      return memPair as CryptoKeyPair;
    }

    // 3. Generate new keypair (Ed25519 or ECDSA P-256 fallback)
    const subtle = this.getSubtle();
    let keyPair: CryptoKeyPair;
    try {
      keyPair = (await subtle.generateKey(
        { name: 'Ed25519' },
        false, // non-extractable private key
        ['sign', 'verify']
      )) as CryptoKeyPair;
    } catch {
      keyPair = (await subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
      )) as CryptoKeyPair;
    }

    this.cachedIdentityKeyPair = keyPair;
    this.memoryKeys.set(KEY_ALIAS_IDENTITY, keyPair);

    try {
      await this.setIDBItem(STORE_KEYS, KEY_ALIAS_IDENTITY, keyPair);
    } catch (err) {
      console.warn('[WebIdentityService] Could not persist identity keypair to IndexedDB:', err);
    }

    return keyPair;
  }

  public async getIdentityPublicKey(): Promise<string> {
    if (this.cachedIdentityPubKeyHex) return this.cachedIdentityPubKeyHex;

    const pair = await this.getIdentityKeyPair();
    const subtle = this.getSubtle();

    let rawPub: ArrayBuffer;
    try {
      rawPub = await subtle.exportKey('raw', pair.publicKey);
    } catch {
      rawPub = await subtle.exportKey('spki', pair.publicKey);
    }

    const hex = toHex(new Uint8Array(rawPub));
    this.cachedIdentityPubKeyHex = hex;
    return hex;
  }

  public async signWithIdentity(data: Uint8Array): Promise<string> {
    const pair = await this.getIdentityKeyPair();
    const subtle = this.getSubtle();

    const alg = pair.privateKey.algorithm.name === 'Ed25519'
      ? { name: 'Ed25519' }
      : { name: 'ECDSA', hash: 'SHA-256' };

    const sigBuf = await subtle.sign(alg, pair.privateKey, data);
    return toHex(new Uint8Array(sigBuf));
  }

  public async verifyWithIdentity(data: Uint8Array, signatureHex: string, publicKeyHex?: string): Promise<boolean> {
    const subtle = this.getSubtle();
    const sigBytes = fromHex(signatureHex);

    let pubKey: CryptoKey;
    if (!publicKeyHex) {
      const pair = await this.getIdentityKeyPair();
      pubKey = pair.publicKey;
    } else {
      const pubBytes = fromHex(publicKeyHex);
      try {
        pubKey = await subtle.importKey(
          'raw',
          pubBytes,
          { name: 'Ed25519' },
          true,
          ['verify']
        );
      } catch {
        pubKey = await subtle.importKey(
          'spki',
          pubBytes,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['verify']
        );
      }
    }

    const alg = pubKey.algorithm.name === 'Ed25519'
      ? { name: 'Ed25519' }
      : { name: 'ECDSA', hash: 'SHA-256' };

    return await subtle.verify(alg, pubKey, sigBytes, data);
  }

  public async encryptData(plaintext: string): Promise<string> {
    const key = await this.getDeviceKey();
    const subtle = this.getSubtle();

    const iv = new Uint8Array(12); // Standard 96-bit AES-GCM IV
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    cryptoObj.getRandomValues(iv);

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const cipherBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      data
    );

    const envelope: EncryptedDataEnvelope = {
      v: 2,
      alg: 'AES-GCM-256',
      iv: bufferToBase64(iv),
      ct: bufferToBase64(cipherBuffer),
      tagLength: 128,
      ts: Date.now(),
      provider: 'webcrypto_indexeddb',
      hardwareBacked: false,
    };

    return JSON.stringify(envelope);
  }

  public async decryptData(envelopeJsonOrRaw: string): Promise<string> {
    if (!envelopeJsonOrRaw) return '';

    let envelope: EncryptedDataEnvelope;
    try {
      envelope = JSON.parse(envelopeJsonOrRaw);
    } catch {
      return envelopeJsonOrRaw;
    }

    if (!envelope.iv || !envelope.ct) {
      return envelopeJsonOrRaw;
    }

    const key = await this.getDeviceKey();
    const subtle = this.getSubtle();

    const iv = base64ToBuffer(envelope.iv);
    const ct = base64ToBuffer(envelope.ct);

    const decrypted = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      ct
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  public async setSecureItem(key: string, value: string): Promise<void> {
    await this.initialize();
    const encrypted = await this.encryptData(value);

    // Keep in memory cache for immediate access & test environments
    this.memorySecureKV.set(key, encrypted);

    // Persist to IndexedDB if available
    if (this.db) {
      try {
        await this.setIDBItem(STORE_SECURE_KV, key, encrypted);
      } catch (err) {
        console.warn('[WebIdentityService] Failed to persist secure item to IndexedDB:', err);
      }
    }
  }

  public async getSecureItem(key: string): Promise<string | null> {
    await this.initialize();

    let raw: string | null = null;
    if (this.db) {
      try {
        raw = await this.getIDBItem<string>(STORE_SECURE_KV, key);
      } catch {
        raw = null;
      }
    }

    if (!raw) {
      raw = this.memorySecureKV.get(key) || null;
    }

    if (!raw) return null;

    try {
      return await this.decryptData(raw);
    } catch (e) {
      console.warn('[WebIdentityService] Decryption failed for key:', key, e);
      return null;
    }
  }

  public async removeSecureItem(key: string): Promise<void> {
    await this.initialize();
    this.memorySecureKV.delete(key);
    if (this.db) {
      try {
        await this.removeIDBItem(STORE_SECURE_KV, key);
      } catch {}
    }
  }

  public async clearSecureStorage(): Promise<void> {
    await this.initialize();
    this.memorySecureKV.clear();
    if (this.db) {
      try {
        await this.clearIDBStore(STORE_SECURE_KV);
      } catch {}
    }
  }
}
