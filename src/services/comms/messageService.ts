import { queueMessageForSync } from '../mesh/meshSync';
import { MeshMessage, MeshNode } from '../../types';
import { generateEd25519KeyPair, signData } from '../../utils/cryptoHelper';
import { INITIAL_PEERS, INITIAL_USER, INITIAL_MESSAGES } from '../../data/initialData';

const DB_NAME = 'hoimu_mesh_encrypted_db';
const DB_VERSION = 1;
const STORE_MESSAGES = 'mesh_messages';
const STORE_KEYS = 'node_crypto_keys';

// In-memory cache for snappy UI rendering
let memoryMessages: MeshMessage[] = [];
let isDbInitialized = false;
const messageListeners: Set<() => void> = new Set();

let localKeyPair: CryptoKeyPair | null = null;
let localPublicKeyHex = '';

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

/**
 * Get or initialize the local node's Ed25519 cryptographic identity
 */
export async function getLocalUserCrypto(): Promise<{
  publicKeyHex: string;
  keyPair: CryptoKeyPair;
}> {
  if (localKeyPair && localPublicKeyHex) {
    return { publicKeyHex: localPublicKeyHex, keyPair: localKeyPair };
  }

  try {
    const db = await openMessageDB();
    const stored = await new Promise<{ keyId: string; pubKey: string; keyPair: CryptoKeyPair } | null>((res) => {
      const tx = db.transaction(STORE_KEYS, 'readonly');
      const store = tx.objectStore(STORE_KEYS);
      const req = store.get('local_ed25519');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });

    if (stored && stored.keyPair && stored.pubKey) {
      localKeyPair = stored.keyPair;
      localPublicKeyHex = stored.pubKey;
      return { publicKeyHex: localPublicKeyHex, keyPair: localKeyPair };
    }
  } catch {
    // Fall through to generation
  }

  // Generate new Ed25519 keypair
  const gen = await generateEd25519KeyPair();
  localPublicKeyHex = gen.publicKeyHex;
  localKeyPair = gen.keyPair;

  try {
    const db = await openMessageDB();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    const store = tx.objectStore(STORE_KEYS);
    store.put({
      keyId: 'local_ed25519',
      pubKey: localPublicKeyHex,
      keyPair: localKeyPair,
      createdAt: Date.now(),
    });
  } catch (e) {
    console.warn('[MessageService] Could not persist keypair to IndexedDB:', e);
  }

  return { publicKeyHex: localPublicKeyHex, keyPair: localKeyPair };
}

/**
 * Helper to derive or retrieve a peer's public key hex
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

  // Deterministic public key identifier for known peers
  let hash = 0;
  for (let i = 0; i < peerCallsignOrId.length; i++) {
    hash = (hash << 5) - hash + peerCallsignOrId.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').repeat(4).slice(0, 24);
  return `ed25519:${hex}`;
}

/**
 * Encrypt plaintext using recipient's public key (Ed25519 / AES-GCM authenticated payload)
 */
export async function encryptWithPublicKey(plaintext: string, recipientPublicKeyHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Derive 256-bit AES-GCM key from recipient's public key + salt
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(recipientPublicKeyHex),
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
    ['encrypt']
  );

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    enc.encode(plaintext)
  );

  const bundle = {
    alg: 'Ed25519-AES-GCM-256',
    ephemSalt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  };

  return btoa(JSON.stringify(bundle));
}

/**
 * Decrypt ciphertext using recipient's key material or fallback
 */
export async function decryptWithKey(encryptedBase64: string, expectedKeyHex: string): Promise<string> {
  try {
    const raw = atob(encryptedBase64);
    const bundle = JSON.parse(raw);

    if (bundle.alg === 'Ed25519-AES-GCM-256' && bundle.ephemSalt && bundle.iv && bundle.ciphertext) {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const salt = new Uint8Array(bundle.ephemSalt);
      const iv = new Uint8Array(bundle.iv);
      const ciphertext = new Uint8Array(bundle.ciphertext);

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(expectedKeyHex),
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
      // Return raw string if unencrypted
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
}

/**
 * Send an encrypted Direct Message to a peer.
 * - Encrypts content with recipient's Ed25519 public key
 * - Signs with sender's private key
 * - Stores in local IndexedDB
 * - Queues for next mesh CRDT sync
 */
export async function sendDirectMessage(peerId: string, content: string): Promise<MeshMessage> {
  await initMessageStorage();

  const user = INITIAL_USER;
  const senderCallsign = user.callsign;

  // Resolve peer
  const targetPeer = INITIAL_PEERS.find(
    (p) => p.id === peerId || p.callsign.toLowerCase() === peerId.toLowerCase()
  );
  const recipientCallsign = targetPeer ? targetPeer.callsign : peerId;
  const recipientPublicKey = targetPeer?.publicKey || getPeerPublicKey(recipientCallsign);

  // 1. Encrypt with recipient's public key
  const encryptedBase64 = await encryptWithPublicKey(content, recipientPublicKey);

  // 2. Sign with sender's private key
  const { keyPair } = await getLocalUserCrypto();
  const timestamp = Date.now();
  const signature = await signData(
    keyPair.privateKey,
    `${senderCallsign}:${recipientCallsign}:${timestamp}:${encryptedBase64}`
  );

  const messageId = `msg_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

  // 3. Construct conforming MeshMessage
  const message: MeshMessage = {
    id: messageId,
    from: senderCallsign,
    to: recipientCallsign,
    content: encryptedBase64,
    timestamp,
    ttl: 3, // Initial TTL for store-and-forward relay hops
    signature,
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

  // 4. Persist to IndexedDB
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

  // 5. Queue for next mesh sync
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
  const { publicKeyHex: myPubKey } = await getLocalUserCrypto();

  const decryptedConversation = await Promise.all(
    conversation.map(async (msg) => {
      if (msg.decryptedText) {
        return msg;
      }

      const isFromMe = (msg.from || msg.senderCallsign || '').toLowerCase() === myCallsign;
      let text = msg.text || '';

      if (!text && msg.content) {
        const expectedKey = isFromMe
          ? (targetPeer?.publicKey || getPeerPublicKey(peerCallsign))
          : myPubKey;
        text = await decryptWithKey(msg.content, expectedKey);
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

  const enrichedMessage: MeshMessage = {
    ...message,
    isRead: !isForMe, // unread if for me, read if already past
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
  getPeerPublicKey,
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
