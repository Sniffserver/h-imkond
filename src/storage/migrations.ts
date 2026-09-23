/**
 * IndexedDB Schema Migrations for HÕIMU Storage
 */

export const DB_NAME = 'hoimu_mesh_v2';
export const DB_VERSION = 1;

export const STORES = {
  PACKETS: 'packets',
  OUTBOX: 'outbox',
  INBOX: 'inbox',
  PEERS: 'peers',
  META: 'meta',
} as const;

export function runMigrations(db: IDBDatabase, oldVersion: number, newVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(STORES.PACKETS)) {
      const packetStore = db.createObjectStore(STORES.PACKETS, { keyPath: 'packetId' });
      packetStore.createIndex('originId', 'header.originId', { unique: false });
      packetStore.createIndex('destinationId', 'header.destinationId', { unique: false });
      packetStore.createIndex('createdAt', 'header.createdAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
      const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' });
      outboxStore.createIndex('status', 'status', { unique: false });
      outboxStore.createIndex('queuedAt', 'queuedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.INBOX)) {
      const inboxStore = db.createObjectStore(STORES.INBOX, { keyPath: 'packetId' });
      inboxStore.createIndex('originId', 'header.originId', { unique: false });
      inboxStore.createIndex('receivedAt', 'receivedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.PEERS)) {
      const peerStore = db.createObjectStore(STORES.PEERS, { keyPath: 'nodeId' });
      peerStore.createIndex('callsign', 'callsign', { unique: false });
      peerStore.createIndex('lastSeen', 'lastSeen', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.META)) {
      db.createObjectStore(STORES.META, { keyPath: 'key' });
    }
  }
}
