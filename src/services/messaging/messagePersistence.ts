/**
 * Message Persistence
 * 
 * IndexedDB and in-memory caching store for encrypted and decrypted MeshMessages.
 */

import { MeshMessage } from '../../types';
import { INITIAL_MESSAGES } from '../../data/initialData';

const DB_NAME = 'hoimu_mesh_encrypted_db';
const DB_VERSION = 2;
const STORE_MESSAGES = 'mesh_messages';
const STORE_KEYS = 'node_crypto_keys';

export class MessagePersistence {
  private memoryMessages: MeshMessage[] = [];
  private isDbInitialized = false;
  private listeners = new Set<() => void>();

  public async initStorage(): Promise<void> {
    if (this.isDbInitialized) return;

    try {
      const db = await this.openMessageDB();
      const stored = await new Promise<MeshMessage[]>((res) => {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const store = tx.objectStore(STORE_MESSAGES);
        const req = store.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });

      if (stored.length === 0) {
        // Seed with demo messages on fresh database
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        INITIAL_MESSAGES.forEach((m) => {
          store.put(m);
        });
        await new Promise((res) => {
          tx.oncomplete = () => res(true);
        });
        this.memoryMessages = [...INITIAL_MESSAGES];
      } else {
        this.memoryMessages = stored;
      }

      this.isDbInitialized = true;
    } catch (err) {
      console.warn('[MessagePersistence] IndexedDB init fallback to memory:', err);
      this.memoryMessages = [...INITIAL_MESSAGES];
      this.isDbInitialized = true;
    }
  }

  public async openMessageDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
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

  public async saveMessage(message: MeshMessage): Promise<void> {
    await this.initStorage();

    // Check duplicate in memory
    const index = this.memoryMessages.findIndex((m) => m.id === message.id);
    if (index >= 0) {
      this.memoryMessages[index] = message;
    } else {
      this.memoryMessages.push(message);
    }

    try {
      const db = await this.openMessageDB();
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.objectStore(STORE_MESSAGES).put(message);
      await new Promise((res) => {
        tx.oncomplete = () => res(true);
      });
    } catch (e) {
      console.warn('[MessagePersistence] Could not write message to IndexedDB:', e);
    }

    this.notify();
  }

  public async getMessageById(id: string): Promise<MeshMessage | null> {
    await this.initStorage();
    return this.memoryMessages.find((m) => m.id === id) || null;
  }

  public async getAllMessages(): Promise<MeshMessage[]> {
    await this.initStorage();
    try {
      const db = await this.openMessageDB();
      const all = await new Promise<MeshMessage[]>((res) => {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const req = tx.objectStore(STORE_MESSAGES).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res(this.memoryMessages);
      });
      this.memoryMessages = all;
      return all;
    } catch {
      return [...this.memoryMessages];
    }
  }

  public async markAsRead(predicate: (m: MeshMessage) => boolean): Promise<boolean> {
    await this.initStorage();
    let updated = false;

    try {
      const db = await this.openMessageDB();
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      const req = store.getAll();

      req.onsuccess = () => {
        const msgs = req.result as MeshMessage[];
        msgs.forEach((m) => {
          if (predicate(m) && m.isRead !== true) {
            m.isRead = true;
            store.put(m);
            updated = true;
          }
        });
      };

      await new Promise((res) => {
        tx.oncomplete = () => res(true);
      });
    } catch (e) {
      console.warn('[MessagePersistence] Error marking messages as read in DB:', e);
    }

    this.memoryMessages = this.memoryMessages.map((m) => {
      if (predicate(m) && m.isRead !== true) {
        updated = true;
        return { ...m, isRead: true };
      }
      return m;
    });

    if (updated) {
      this.notify();
    }
    return updated;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('[MessagePersistence] Listener error:', e);
      }
    });
  }
}

export const messagePersistence = new MessagePersistence();
