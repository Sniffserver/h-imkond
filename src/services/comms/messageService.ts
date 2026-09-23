import { queueMessageForSync } from '../mesh/meshSync';
import { MeshMessage, MeshMessageEnvelope } from '../../types';
import { INITIAL_PEERS, INITIAL_USER, INITIAL_MESSAGES } from '../../data/initialData';
import {
  generateIdentityKeyPair,
  generateEncryptionKeyPair,
  deriveX25519KeyPairFromSeed,
  deriveEd25519KeyPairFromSeed,
  encryptMeshMessage,
  decryptMeshMessage,
  parseEnvelope,
  toHex,
} from '../crypto/meshCrypto';

const DB_NAME = 'hoimu_mesh_encrypted_db';
const DB_VERSION = 2; // Incremented for dual-key schema support
const STORE_MESSAGES = 'mesh_messages';
const STORE_KEYS = 'node_crypto_keys';

// In-memory cache for snappy UI rendering
let memoryMessages: MeshMessage[] = [];
let isDbInitialized = false;
const messageListeners: Set<() => void> = new Set();

// Local dual-key pair memory caches
let localIdentityKeyPair: CryptoKeyPair | null = null;
let localIdentityPublicKeyHex = '';
let localEncryptionKeyPair: CryptoKeyPair | null = null;
let localEncryptionPublicKeyHex = '';

function notifyListeners() {
  messageListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('[MessageService] Listener error:', e);
    }
  });
}

/**
 * Open IndexedDB for encrypted mesh message storage
 */
function openMessageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('from', 'from', { unique: false });
        msgStore.createIndex('to', 'to', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('isRead', 'isRead', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'keyId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface LocalDualCrypto {
  identity: {
    publicKeyHex: string;
    keyPair: CryptoKeyPair;
  };
  encryption: {
    publicKeyHex: string;
    keyPair: CryptoKeyPair;
  };
}

/**
 * Get or initialize both the local node's Ed25519 identity key and X25519 encryption key
 */
export async function getLocalUserDualCrypto(): Promise<LocalDualCrypto> {
  if (localIdentityKeyPair && localIdentityPublicKeyHex && localEncryptionKeyPair && localEncryptionPublicKeyHex) {
    return {
      identity: { publicKeyHex: localIdentityPublicKeyHex, keyPair: localIdentityKeyPair },
      encryption: { publicKeyHex: localEncryptionPublicKeyHex, keyPair: localEncryptionKeyPair },
    };
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openMessageDB();
  } catch {
    // Fall back to memory
  }

  // 1. Identity Key (Ed25519)
  if (!localIdentityKeyPair) {
    let storedIdKey: { keyId: string; pubKey: string; keyPair: CryptoKeyPair } | null = null;
    if (db) {
      storedIdKey = await new Promise((res) => {
        try {
          const tx = db!.transaction(STORE_KEYS, 'readonly');
          const req = tx.objectStore(STORE_KEYS).get('local_ed25519');
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        } catch {
          res(null);
        }
      });
    }

    if (storedIdKey && storedIdKey.keyPair && storedIdKey.pubKey) {
      localIdentityKeyPair = storedIdKey.keyPair;
      localIdentityPublicKeyHex = storedIdKey.pubKey;
    } else {
      const genId = await generateIdentityKeyPair();
      localIdentityKeyPair = genId.keyPair;
      localIdentityPublicKeyHex = genId.publicKeyHex;

      if (db) {
        try {
          const tx = db.transaction(STORE_KEYS, 'readwrite');
          tx.objectStore(STORE_KEYS).put({
            keyId: 'local_ed25519',
            pubKey: localIdentityPublicKeyHex,
            keyPair: localIdentityKeyPair,
            createdAt: Date.now(),
          });
        } catch (e) {
          console.warn('[MessageService] Could not persist identity key to IndexedDB:', e);
        }
      }
    }
  }

  // 2. Encryption Key (X25519)
  if (!localEncryptionKeyPair) {
    let storedEncKey: { keyId: string; pubKey: string; keyPair: CryptoKeyPair } | null = null;
    if (db) {
      storedEncKey = await new Promise((res) => {
        try {
          const tx = db!.transaction(STORE_KEYS, 'readonly');
          const req = tx.objectStore(STORE_KEYS).get('local_x25519');
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        } catch {
          res(null);
        }
      });
    }

    if (storedEncKey && storedEncKey.keyPair && storedEncKey.pubKey) {
      localEncryptionKeyPair = storedEncKey.keyPair;
      localEncryptionPublicKeyHex = storedEncKey.pubKey;
    } else {
      const genEnc = await generateEncryptionKeyPair();
      localEncryptionKeyPair = genEnc.keyPair;
      localEncryptionPublicKeyHex = genEnc.publicKeyHex;

      if (db) {
        try {
          const tx = db.transaction(STORE_KEYS, 'readwrite');
          tx.objectStore(STORE_KEYS).put({
            keyId: 'local_x25519',
            pubKey: localEncryptionPublicKeyHex,
            keyPair: localEncryptionKeyPair,
            createdAt: Date.now(),
          });
        } catch (e) {
          console.warn('[MessageService] Could not persist encryption key to IndexedDB:', e);
        }
      }
    }
  }

  return {
    identity: { publicKeyHex: localIdentityPublicKeyHex, keyPair: localIdentityKeyPair },
    encryption: { publicKeyHex: localEncryptionPublicKeyHex, keyPair: localEncryptionKeyPair },
  };
}

/**
 * Get or initialize the local node's Ed25519 cryptographic identity (backwards compatible)
 */
export async function getLocalUserCrypto(): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  const dual = await getLocalUserDualCrypto();
  return {
    publicKeyHex: dual.identity.publicKeyHex,
    keyPair: dual.identity.keyPair,
  };
}

/**
 * Retrieve peer's public identity key or derive a consistent identity
 */
export function getPeerPublicKey(peerCallsignOrId: string): string {
  const clean = peerCallsignOrId.toLowerCase().trim();
  const foundPeer = INITIAL_PEERS.find(
    (p) =>
      p.id.toLowerCase() === clean ||
      p.callsign.toLowerCase() === clean
  );

  if (foundPeer?.publicKey) {
    return foundPeer.publicKey;
  }

  // Consistent fallback hex identifier for mock nodes
  let hash = 0;
  for (let i = 0; i < peerCallsignOrId.length; i++) {
    hash = (hash << 5) - hash + peerCallsignOrId.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').repeat(4).slice(0, 32);
  return `ed25519:${hex}`;
}

/**
 * Retrieve or derive a 32-byte X25519 public key hex for a peer
 */
export async function getPeerEncryptionKey(peerCallsignOrId: string): Promise<string> {
  const clean = peerCallsignOrId.toLowerCase().trim();
  const foundPeer = INITIAL_PEERS.find(
    (p) =>
      p.id.toLowerCase() === clean ||
      p.callsign.toLowerCase() === clean
  );

  if (foundPeer?.publicKey && foundPeer.publicKey.startsWith('x25519:')) {
    return foundPeer.publicKey.replace('x25519:', '');
  }

  // Deterministically derive a valid 32-byte Curve25519 keypair for known mock peers
  const derived = await deriveX25519KeyPairFromSeed(clean);
  return derived.publicKeyHex;
}

/**
 * True End-to-End Encryption with recipient's X25519 public key & sender's Ed25519 identity key:
 * - Ephemeral X25519 Key Agreement
 * - HKDF-SHA256 AEAD key derivation ("hoimu-mesh-e2ee-v1")
 * - AES-256-GCM authenticated encryption (12-byte IV)
 * - Ed25519 digital signature of envelope for non-repudiation
 */
export async function encryptWithPublicKey(
  plaintext: string,
  recipientPublicKeyHex: string
): Promise<string> {
  const userDual = await getLocalUserDualCrypto();

  // If recipient key is not a 64-char hex, derive deterministic 32-byte X25519 key
  let targetX25519Key = recipientPublicKeyHex.replace(/^(ed25519:|x25519:|0x)/i, '');
  if (targetX25519Key.length !== 64) {
    const derived = await deriveX25519KeyPairFromSeed(recipientPublicKeyHex);
    targetX25519Key = derived.publicKeyHex;
  }

  const envelope = await encryptMeshMessage({
    content: plaintext,
    senderCallsign: INITIAL_USER.callsign,
    recipientCallsign: 'Peer',
    recipientX25519PublicKeyHex: targetX25519Key,
    senderIdentityKeyPair: userDual.identity.keyPair,
    senderIdentityPublicKeyHex: userDual.identity.publicKeyHex,
  });

  // Return base64 serialized envelope string
  return btoa(JSON.stringify(envelope));
}

/**
 * Decrypt ciphertext using recipient's private key:
 * - Ephemeral X25519 + Recipient Private X25519 -> Shared Secret
 * - HKDF-SHA256 -> AES-256-GCM key
 * - AES-256-GCM authenticated decryption
 * - Graceful fallback for legacy mock bundles / test inputs
 */
export async function decryptWithKey(
  encryptedBase64: string,
  expectedKeyHex?: string
): Promise<string> {
  try {
    // 1. Check if payload is a modern MeshMessageEnvelope
    const parsedEnvelope = parseEnvelope(encryptedBase64);
    if (parsedEnvelope) {
      let recipientPrivKey: CryptoKey | null = null;

      if (expectedKeyHex) {
        // Derive corresponding test private key if a specific key was requested
        const derivedTest = await deriveX25519KeyPairFromSeed(expectedKeyHex);
        recipientPrivKey = derivedTest.keyPair.privateKey;
      } else {
        const dual = await getLocalUserDualCrypto();
        recipientPrivKey = dual.encryption.keyPair.privateKey;
      }

      try {
        const result = await decryptMeshMessage(parsedEnvelope, recipientPrivKey);
        return result.plaintext;
      } catch (err) {
        // If decryption with test key fails, try local user's private key as fallback
        const dual = await getLocalUserDualCrypto();
        if (dual.encryption.keyPair.privateKey !== recipientPrivKey) {
          const fallbackResult = await decryptMeshMessage(parsedEnvelope, dual.encryption.keyPair.privateKey);
          return fallbackResult.plaintext;
        }
        throw err;
      }
    }

    // 2. Legacy fallback for old test bundles (Ed25519-AES-GCM-256 PBKDF2)
    const raw = atob(encryptedBase64);
    const bundle = JSON.parse(raw);

    if (bundle.alg === 'Ed25519-AES-GCM-256' && bundle.ephemSalt && bundle.iv && bundle.ciphertext) {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const salt = new Uint8Array(bundle.ephemSalt);
      const iv = new Uint8Array(bundle.iv);
      const ciphertext = new Uint8Array(bundle.ciphertext);
      const keyHexToUse = expectedKeyHex || (await getLocalUserDualCrypto()).identity.publicKeyHex;

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(keyHexToUse),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 20000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        ciphertext
      );

      return dec.decode(decrypted);
    } else if (bundle.text) {
      return bundle.text;
    }
  } catch (err) {
    // If parsing or decrypting fails, inspect if it's already plaintext or JSON
    try {
      const decoded = atob(encryptedBase64);
      const parsed = JSON.parse(decoded);
      if (parsed.text) return parsed.text;
    } catch {
      // Not a base64 JSON
    }
  }

  return '🔒 [Encrypted Mesh Packet]';
}

/**
 * Initialize and seed IndexedDB from INITIAL_MESSAGES if empty
 */
export async function initMessageStorage(): Promise<void> {
  if (isDbInitialized) return;

  try {
    const db = await openMessageDB();
    const stored = await new Promise<MeshMessage[]>((res) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    if (stored.length === 0) {
      // Seed with initial messages
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      INITIAL_MESSAGES.forEach((m) => {
        store.put(m);
      });
      await new Promise((res) => {
        tx.oncomplete = () => res(true);
      });
      memoryMessages = [...INITIAL_MESSAGES];
    } else {
      memoryMessages = stored;
    }

    isDbInitialized = true;
  } catch (err) {
    console.warn('[MessageService] IndexedDB init fallback to memory:', err);
    memoryMessages = [...INITIAL_MESSAGES];
    isDbInitialized = true;
  }

  // Pre-initialize dual keys in background
  getLocalUserDualCrypto().catch((err) => {
    console.warn('[MessageService] Dual crypto background init:', err);
  });
}

/**
 * Send an authentic E2EE Direct Message to a peer:
 * - Ephemeral X25519 ECDH + HKDF-SHA256 + AES-256-GCM
 * - Ed25519 sender identity signature
 * - Encapsulated in MeshMessageEnvelope conforming to user specification
 * - Persisted to IndexedDB & queued for CRDT multi-bearer mesh sync
 */
export async function sendDirectMessage(peerId: string, content: string): Promise<MeshMessage> {
  await initMessageStorage();

  const user = INITIAL_USER;
  const senderCallsign = user.callsign;

  // Resolve target peer and public encryption key
  const targetPeer = INITIAL_PEERS.find(
    (p) => p.id === peerId || p.callsign.toLowerCase() === peerId.toLowerCase()
  );
  const recipientCallsign = targetPeer ? targetPeer.callsign : peerId;
  const recipientEncKey = await getPeerEncryptionKey(recipientCallsign);

  const userDual = await getLocalUserDualCrypto();
  const messageId = `01J${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;

  // 1. Create authenticated E2EE envelope
  const envelope = await encryptMeshMessage({
    content,
    senderCallsign,
    recipientCallsign,
    recipientX25519PublicKeyHex: recipientEncKey,
    senderIdentityKeyPair: userDual.identity.keyPair,
    senderIdentityPublicKeyHex: userDual.identity.publicKeyHex,
    messageId,
    ttl: 5,
  });

  const serializedContent = btoa(JSON.stringify(envelope));

  // 2. Construct conforming MeshMessage
  const message: MeshMessage = {
    id: messageId,
    from: senderCallsign,
    to: recipientCallsign,
    content: serializedContent,
    timestamp: envelope.createdAt,
    ttl: envelope.ttl,
    signature: envelope.signature,
    // Modern envelope metadata
    envelope,
    ephemeralPublicKey: envelope.ephemeralPublicKey,
    nonce: envelope.nonce,
    senderIdentityKey: envelope.senderIdentityKey,
    // Local metadata
    senderId: user.id,
    senderCallsign,
    recipientId: targetPeer ? targetPeer.id : peerId,
    recipientCallsign,
    text: content,
    decryptedText: content,
    status: 'pending',
    isRead: true, // Sender's own message is read
    hopCount: 1,
  };

  // 3. Persist to IndexedDB
  try {
    const db = await openMessageDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    tx.objectStore(STORE_MESSAGES).put(message);
    await new Promise((res) => {
      tx.oncomplete = () => res(true);
    });
  } catch (err) {
    console.warn('[MessageService] IndexedDB put error, keeping in memory:', err);
  }

  // Update memory cache
  memoryMessages = [...memoryMessages, message];

  // 4. Queue for next multi-bearer mesh sync
  try {
    queueMessageForSync(message);
  } catch (e) {
    console.warn('[MessageService] Could not queue message for sync:', e);
  }

  notifyListeners();
  return message;
}

/**
 * Get conversation thread between the local user and a peer from local IndexedDB
 */
export async function getConversation(peerId: string): Promise<MeshMessage[]> {
  await initMessageStorage();

  const user = INITIAL_USER;
  const myCallsign = user.callsign.toLowerCase();

  const targetPeer = INITIAL_PEERS.find(
    (p) => p.id === peerId || p.callsign.toLowerCase() === peerId.toLowerCase()
  );
  const peerCallsign = (targetPeer ? targetPeer.callsign : peerId).toLowerCase();

  // Load from IndexedDB to ensure fresh multi-tab updates
  let allMsgs: MeshMessage[] = [];
  try {
    const db = await openMessageDB();
    allMsgs = await new Promise<MeshMessage[]>((res) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const req = tx.objectStore(STORE_MESSAGES).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res(memoryMessages);
    });
    memoryMessages = allMsgs;
  } catch {
    allMsgs = memoryMessages;
  }

  // Filter messages belonging to this conversation
  const conversation = allMsgs.filter((m) => {
    const from = (m.from || m.senderCallsign || '').toLowerCase();
    const to = (m.to || m.recipientCallsign || '').toLowerCase();

    return (
      (from === myCallsign && to === peerCallsign) ||
      (from === peerCallsign && to === myCallsign) ||
      (m.senderId === peerId && m.recipientId === user.id) ||
      (m.senderId === user.id && m.recipientId === peerId)
    );
  });

  // Decrypt contents where necessary
  const decryptedConversation = await Promise.all(
    conversation.map(async (msg) => {
      if (msg.decryptedText) {
        return msg;
      }

      let text = msg.text || '';
      if (!text && msg.content) {
        try {
          text = await decryptWithKey(msg.content);
        } catch (e) {
          text = '🔒 [Encrypted Mesh Packet]';
        }
      }

      return {
        ...msg,
        decryptedText: text || '🔒 Encrypted message',
        text: text || msg.text || '🔒 Encrypted message',
      };
    })
  );

  return decryptedConversation.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Returns total unread messages count across all conversations
 */
export async function getUnreadCount(): Promise<number> {
  await initMessageStorage();

  const user = INITIAL_USER;
  const myCallsign = user.callsign.toLowerCase();

  let allMsgs: MeshMessage[] = [];
  try {
    const db = await openMessageDB();
    allMsgs = await new Promise<MeshMessage[]>((res) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const req = tx.objectStore(STORE_MESSAGES).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res(memoryMessages);
    });
    memoryMessages = allMsgs;
  } catch {
    allMsgs = memoryMessages;
  }

  const unread = allMsgs.filter((m) => {
    const to = (m.to || m.recipientCallsign || '').toLowerCase();
    const isForMe = to === myCallsign || m.recipientId === user.id;
    return isForMe && m.isRead === false;
  });

  return unread.length;
}

/**
 * Mark all messages in a conversation as read
 */
export async function markConversationAsRead(peerId: string): Promise<void> {
  await initMessageStorage();

  const user = INITIAL_USER;
  const myCallsign = user.callsign.toLowerCase();
  const targetPeer = INITIAL_PEERS.find(
    (p) => p.id === peerId || p.callsign.toLowerCase() === peerId.toLowerCase()
  );
  const peerCallsign = (targetPeer ? targetPeer.callsign : peerId).toLowerCase();

  let hasUpdates = false;

  try {
    const db = await openMessageDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const req = store.getAll();

    req.onsuccess = () => {
      const msgs = req.result as MeshMessage[];
      msgs.forEach((m) => {
        const from = (m.from || m.senderCallsign || '').toLowerCase();
        const to = (m.to || m.recipientCallsign || '').toLowerCase();

        if ((from === peerCallsign || m.senderId === peerId) && (to === myCallsign || m.recipientId === user.id)) {
          if (m.isRead !== true) {
            m.isRead = true;
            store.put(m);
            hasUpdates = true;
          }
        }
      });
    };

    await new Promise((res) => {
      tx.oncomplete = () => res(true);
    });
  } catch (e) {
    console.warn('[MessageService] Error marking as read in IndexedDB:', e);
  }

  memoryMessages = memoryMessages.map((m) => {
    const from = (m.from || m.senderCallsign || '').toLowerCase();
    const to = (m.to || m.recipientCallsign || '').toLowerCase();
    if ((from === peerCallsign || m.senderId === peerId) && (to === myCallsign || m.recipientId === user.id)) {
      return { ...m, isRead: true };
    }
    return m;
  });

  if (hasUpdates) {
    notifyListeners();
  }
}

/**
 * Save an incoming message received from the mesh sync layer
 */
export async function saveIncomingMessage(message: MeshMessage): Promise<boolean> {
  await initMessageStorage();

  // Check if message is already stored
  const exists = memoryMessages.some((m) => m.id === message.id);
  if (exists) return false;

  const user = INITIAL_USER;
  const myCallsign = user.callsign.toLowerCase();
  const isForMe = (message.to || message.recipientCallsign || '').toLowerCase() === myCallsign;

  // Try to decrypt content if it is meant for us
  let decryptedText = message.decryptedText || message.text;
  if (!decryptedText && isForMe && message.content) {
    try {
      decryptedText = await decryptWithKey(message.content);
    } catch {
      decryptedText = '🔒 [Encrypted Mesh Packet]';
    }
  }

  const enrichedMessage: MeshMessage = {
    ...message,
    decryptedText,
    text: decryptedText || message.text,
    isRead: !isForMe, // unread if for me, read if relayed
    status: 'delivered',
  };

  try {
    const db = await openMessageDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    tx.objectStore(STORE_MESSAGES).put(enrichedMessage);
    await new Promise((res) => {
      tx.oncomplete = () => res(true);
    });
  } catch (err) {
    console.warn('[MessageService] Failed to persist incoming message to IndexedDB:', err);
  }

  memoryMessages = [...memoryMessages, enrichedMessage];
  notifyListeners();
  return true;
}

/**
 * Subscribe to message updates across the app
 */
export function subscribeToMessages(callback: () => void): () => void {
  messageListeners.add(callback);
  return () => {
    messageListeners.delete(callback);
  };
}

import { IMessageService } from '../types';

export const messageService: IMessageService = {
  getLocalUserCrypto,
  getLocalUserDualCrypto,
  getPeerPublicKey,
  getPeerEncryptionKey,
  encryptWithPublicKey,
  decryptWithKey,
  initMessageStorage,
  sendDirectMessage,
  getConversation,
  getUnreadCount,
  markConversationAsRead,
  saveIncomingMessage,
  subscribeToMessages,
};
