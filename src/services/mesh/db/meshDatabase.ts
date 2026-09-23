/**
 * HÕIMU Mesh Network — Persistent Storage Architecture (IndexedDB)
 * 
 * Database Schema: `hoimu_mesh_db`
 * Object Stores:
 *  - `outbox`: Pending and relay store-and-forward packets awaiting transmission
 *  - `inbox`: Received messages and payloads
 *  - `seen_packets`: Deduplication routing cache entries with expiration
 *  - `peers`: Discovered mesh peer nodes and telemetry
 *  - `routes`: Known multi-hop routing table entries
 *  - `identities`: Local and remote cryptographic identity keys
 *  - `crdt_events`: Append-only signed CRDT event log for P2P ledger replication
 */

import { MeshMessage } from '../../../types';
import { SeenPacketEntry } from '../routing/SeenPacketCache';

export const MESH_DB_NAME = 'hoimu_mesh_db';
export const MESH_DB_VERSION = 1;

export const STORES = {
  OUTBOX: 'outbox',
  INBOX: 'inbox',
  SEEN_PACKETS: 'seen_packets',
  PEERS: 'peers',
  ROUTES: 'routes',
  IDENTITIES: 'identities',
  CRDT_EVENTS: 'crdt_events',
} as const;

export interface PersistentOutboxRecord {
  id: string; // Message ID / Packet ID
  message: MeshMessage;
  queuedAt: number;
  status: 'queued' | 'relayed' | 'transmitted' | 'delivered';
  transmittedAt?: number;
  attempts?: number;
}

export interface PersistentRouteRecord {
  destinationId: string;
  nextHopId: string;
  metric: number;
  lastUpdated: number;
  hopCount: number;
}

// Memory fallback store when IndexedDB is unavailable (Node.js/Test/SSR)
class MemoryStorageProvider {
  public outbox = new Map<string, PersistentOutboxRecord>();
  public inbox = new Map<string, any>();
  public seenPackets = new Map<string, SeenPacketEntry>();
  public peers = new Map<string, any>();
  public routes = new Map<string, PersistentRouteRecord>();
  public identities = new Map<string, any>();
  public crdtEvents = new Map<string, any>();

  clear() {
    this.outbox.clear();
    this.inbox.clear();
    this.seenPackets.clear();
    this.peers.clear();
    this.routes.clear();
    this.identities.clear();
    this.crdtEvents.clear();
  }
}

export const memoryDbFallback = new MemoryStorageProvider();

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function openMeshDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB unavailable in current environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(MESH_DB_NAME, MESH_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Outbox Store
        if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
          const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' });
          outboxStore.createIndex('status', 'status', { unique: false });
          outboxStore.createIndex('queuedAt', 'queuedAt', { unique: false });
        }

        // 2. Inbox Store
        if (!db.objectStoreNames.contains(STORES.INBOX)) {
          const inboxStore = db.createObjectStore(STORES.INBOX, { keyPath: 'id' });
          inboxStore.createIndex('from', 'from', { unique: false });
          inboxStore.createIndex('to', 'to', { unique: false });
          inboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Seen Packets (Routing Cache) Store
        if (!db.objectStoreNames.contains(STORES.SEEN_PACKETS)) {
          const seenStore = db.createObjectStore(STORES.SEEN_PACKETS, { keyPath: 'packetId' });
          seenStore.createIndex('expires', 'expires', { unique: false });
          seenStore.createIndex('firstSeen', 'firstSeen', { unique: false });
        }

        // 4. Peers Store
        if (!db.objectStoreNames.contains(STORES.PEERS)) {
          const peersStore = db.createObjectStore(STORES.PEERS, { keyPath: 'id' });
          peersStore.createIndex('callsign', 'callsign', { unique: false });
          peersStore.createIndex('lastSeen', 'lastSeen', { unique: false });
        }

        // 5. Routes Store
        if (!db.objectStoreNames.contains(STORES.ROUTES)) {
          const routesStore = db.createObjectStore(STORES.ROUTES, { keyPath: 'destinationId' });
          routesStore.createIndex('nextHopId', 'nextHopId', { unique: false });
        }

        // 6. Identities Store
        if (!db.objectStoreNames.contains(STORES.IDENTITIES)) {
          db.createObjectStore(STORES.IDENTITIES, { keyPath: 'nodeId' });
        }

        // 7. CRDT Signed Event Log Store
        if (!db.objectStoreNames.contains(STORES.CRDT_EVENTS)) {
          const crdtStore = db.createObjectStore(STORES.CRDT_EVENTS, { keyPath: 'opId' });
          crdtStore.createIndex('entityType', 'entityType', { unique: false });
          crdtStore.createIndex('entityId', 'entityId', { unique: false });
          crdtStore.createIndex('clock', 'clock', { unique: false });
          crdtStore.createIndex('authorId', 'authorId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

// -----------------------------------------------------------------------------
// Database Access Layer for Outbox, SeenPackets, and CRDT Event Log
// -----------------------------------------------------------------------------

export const meshDb = {
  // === OUTBOX (Delivery State) ===
  async saveOutboxItem(item: PersistentOutboxRecord): Promise<void> {
    memoryDbFallback.outbox.set(item.id, item);
    try {
      const db = await openMeshDatabase();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      tx.objectStore(STORES.OUTBOX).put(item);
    } catch {
      // Memory fallback holds state
    }
  },

  async getPendingOutboxItems(): Promise<PersistentOutboxRecord[]> {
    try {
      const db = await openMeshDatabase();
      return new Promise<PersistentOutboxRecord[]>((resolve) => {
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const store = tx.objectStore(STORES.OUTBOX);
        const request = store.getAll();
        request.onsuccess = () => {
          const records = (request.result as PersistentOutboxRecord[]) || [];
          // Sync with memory
          records.forEach((r) => memoryDbFallback.outbox.set(r.id, r));
          const pending = records.filter((r) => r.status === 'queued' || r.status === 'relayed');
          resolve(pending);
        };
        request.onerror = () => {
          resolve(Array.from(memoryDbFallback.outbox.values()).filter((r) => r.status === 'queued' || r.status === 'relayed'));
        };
      });
    } catch {
      return Array.from(memoryDbFallback.outbox.values()).filter((r) => r.status === 'queued' || r.status === 'relayed');
    }
  },

  async deleteOutboxItem(id: string): Promise<void> {
    memoryDbFallback.outbox.delete(id);
    try {
      const db = await openMeshDatabase();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      tx.objectStore(STORES.OUTBOX).delete(id);
    } catch {
      // Memory fallback handled
    }
  },

  // === SEEN PACKETS (Routing Deduplication Cache) ===
  async saveSeenPacket(entry: SeenPacketEntry): Promise<void> {
    memoryDbFallback.seenPackets.set(entry.packetId, entry);
    try {
      const db = await openMeshDatabase();
      const tx = db.transaction(STORES.SEEN_PACKETS, 'readwrite');
      tx.objectStore(STORES.SEEN_PACKETS).put(entry);
    } catch {
      // Memory fallback handled
    }
  },

  async loadSeenPackets(): Promise<SeenPacketEntry[]> {
    try {
      const db = await openMeshDatabase();
      return new Promise<SeenPacketEntry[]>((resolve) => {
        const tx = db.transaction(STORES.SEEN_PACKETS, 'readonly');
        const store = tx.objectStore(STORES.SEEN_PACKETS);
        const request = store.getAll();
        request.onsuccess = () => {
          const entries = (request.result as SeenPacketEntry[]) || [];
          entries.forEach((e) => memoryDbFallback.seenPackets.set(e.packetId, e));
          resolve(entries);
        };
        request.onerror = () => resolve(Array.from(memoryDbFallback.seenPackets.values()));
      });
    } catch {
      return Array.from(memoryDbFallback.seenPackets.values());
    }
  },

  // === CRDT SIGNED EVENT LOG ===
  async saveCrdtEvent(event: any): Promise<void> {
    if (!event || !event.opId) return;
    memoryDbFallback.crdtEvents.set(event.opId, event);
    try {
      const db = await openMeshDatabase();
      const tx = db.transaction(STORES.CRDT_EVENTS, 'readwrite');
      tx.objectStore(STORES.CRDT_EVENTS).put(event);
    } catch {
      // Memory fallback handled
    }
  },

  async getAllCrdtEvents(): Promise<any[]> {
    try {
      const db = await openMeshDatabase();
      return new Promise<any[]>((resolve) => {
        const tx = db.transaction(STORES.CRDT_EVENTS, 'readonly');
        const store = tx.objectStore(STORES.CRDT_EVENTS);
        const request = store.getAll();
        request.onsuccess = () => {
          const events = (request.result as any[]) || [];
          events.forEach((e) => memoryDbFallback.crdtEvents.set(e.opId, e));
          resolve(events);
        };
        request.onerror = () => resolve(Array.from(memoryDbFallback.crdtEvents.values()));
      });
    } catch {
      return Array.from(memoryDbFallback.crdtEvents.values());
    }
  },

  // === INBOX & INCOMING MESSAGES ===
  async saveIncomingMessage(packetOrMessage: any): Promise<void> {
    const id = packetOrMessage.packetId || packetOrMessage.id || `msg_${Date.now()}`;
    memoryDbFallback.inbox.set(id, packetOrMessage);
    try {
      const db = await openMeshDatabase();
      const tx = db.transaction(STORES.INBOX, 'readwrite');
      tx.objectStore(STORES.INBOX).put({ id, ...packetOrMessage, receivedAt: Date.now() });
    } catch {
      // Memory fallback handled
    }
  },

  async addToOutbox(packetOrMessage: any): Promise<void> {
    const record: PersistentOutboxRecord = {
      id: packetOrMessage.packetId || packetOrMessage.id || `out_${Date.now()}`,
      message: packetOrMessage as any,
      queuedAt: Date.now(),
      status: 'queued',
      attempts: 0,
    };
    await this.saveOutboxItem(record);
  },

  // === DIAGNOSTICS & TEST RESET ===
  clearMemoryStorage(): void {
    memoryDbFallback.clear();
  },
};
