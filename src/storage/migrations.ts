/**
 * IndexedDB Schema Migrations for HÕIMU Canonical Storage Engine
 */

export const DB_NAME = 'hoimu_canonical_storage_v2';
export const DB_VERSION = 3;

export const STORES = {
  // Identity & Secrets
  IDENTITY: 'identity',
  SECURE_SECRETS: 'secure_secrets',

  // Mesh domain
  INBOX: 'inbox',
  OUTBOX: 'outbox',
  PEERS: 'peers',
  PACKETS: 'packets',
  EVENTS: 'events',
  DEDUP: 'dedup',

  // App Domain State
  APP_STATE: 'app_state',

  // Map domain
  MAP_PACKS: 'map_packs',
  MAP_CACHE: 'map_cache',

  // Diagnostics & Radio metrics
  DIAGNOSTICS: 'diagnostics',

  // Metadata
  META: 'meta',
} as const;

export function runMigrations(db: IDBDatabase, oldVersion: number, newVersion: number): void {
  // Version 1 stores
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

  // Version 2 stores: Canonical Domain Storage Separation
  if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
    const identityStore = db.createObjectStore(STORES.IDENTITY, { keyPath: 'nodeId' });
    identityStore.createIndex('callsign', 'callsign', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORES.SECURE_SECRETS)) {
    db.createObjectStore(STORES.SECURE_SECRETS, { keyPath: 'keyId' });
  }

  if (!db.objectStoreNames.contains(STORES.EVENTS)) {
    const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
    eventStore.createIndex('type', 'type', { unique: false });
    eventStore.createIndex('timestamp', 'timestamp', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
    db.createObjectStore(STORES.APP_STATE, { keyPath: 'domain' });
  }

  if (!db.objectStoreNames.contains(STORES.MAP_PACKS)) {
    const mapPackStore = db.createObjectStore(STORES.MAP_PACKS, { keyPath: 'id' });
    mapPackStore.createIndex('cityId', 'cityId', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORES.MAP_CACHE)) {
    const mapCacheStore = db.createObjectStore(STORES.MAP_CACHE, { keyPath: 'key' });
    mapCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORES.DIAGNOSTICS)) {
    const diagStore = db.createObjectStore(STORES.DIAGNOSTICS, { keyPath: 'id' });
    diagStore.createIndex('timestamp', 'timestamp', { unique: false });
    diagStore.createIndex('type', 'type', { unique: false });
  }

  // Version 3: Durable Mesh Deduplication Store (survives reboots)
  if (!db.objectStoreNames.contains(STORES.DEDUP)) {
    const dedupStore = db.createObjectStore(STORES.DEDUP, { keyPath: 'packetId' });
    dedupStore.createIndex('expiresAt', 'expiresAt', { unique: false });
    dedupStore.createIndex('originId', 'originId', { unique: false });
  }
}
