/**
 * PeerIdentityStore
 * 
 * Persistent store for peer identity records and cryptographic public keys.
 * Critical Security Rule:
 * INITIAL_PEERS may remain as demo fixtures. They must NEVER be the production trust source.
 * Production peers must be cryptographically verified, updated on authenticated key exchanges,
 * and persisted to secure IndexedDB / storage.
 */

import { PeerIdentity, TrustState } from './types';
import { INITIAL_PEERS } from '../../data/initialData';
import { canonicalPeerRegistry } from '../../core/identity/peer';
import { canonicalTrustStore } from '../../core/identity/trust';

const DB_NAME = 'hoimu_peer_identities_db';
const DB_VERSION = 1;
const STORE_PEERS = 'peer_identities';

export class PeerIdentityStore {
  private db: IDBDatabase | null = null;
  private memoryPeers = new Map<string, PeerIdentity>();
  private initialized = false;
  private listeners = new Set<() => void>();

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await this.openDatabase();
      const all = await this.getAllFromDB();
      all.forEach((peer) => {
        this.memoryPeers.set(peer.nodeId, peer);
      });
    } catch {
      // Memory fallback for tests
    }

    this.initialized = true;
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
        if (!db.objectStoreNames.contains(STORE_PEERS)) {
          const store = db.createObjectStore(STORE_PEERS, { keyPath: 'nodeId' });
          store.createIndex('callsign', 'callsign', { unique: false });
          store.createIndex('signingPublicKey', 'signingPublicKey', { unique: false });
          store.createIndex('trustState', 'trustState', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromDB(): Promise<PeerIdentity[]> {
    if (!this.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_PEERS, 'readonly');
        const store = tx.objectStore(STORE_PEERS);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as PeerIdentity[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Save or update a peer identity record
   */
  public async putPeer(peer: PeerIdentity): Promise<void> {
    await this.initialize();

    // Normalize keys
    const normalized: PeerIdentity = {
      ...peer,
      signingPublicKey: peer.signingPublicKey.replace(/^(0x|ed25519:)/i, '').toLowerCase(),
      encryptionPublicKey: peer.encryptionPublicKey.replace(/^(0x|x25519:)/i, '').toLowerCase(),
      lastSeenAt: peer.lastSeenAt || Date.now(),
    };

    this.memoryPeers.set(normalized.nodeId, normalized);

    // Sync to Canonical Identity Core (Single source of truth)
    try {
      canonicalPeerRegistry.upsertPeer({
        id: normalized.nodeId,
        signingPublicKey: normalized.signingPublicKey,
        encryptionPublicKey: normalized.encryptionPublicKey,
        trustLevel: normalized.trustState === 'verified' ? 'verified' : normalized.trustState === 'blocked' ? 'blocked' : 'unverified',
        lastSeenAt: normalized.lastSeenAt,
      });
      canonicalTrustStore.setTrustLevel(
        normalized.nodeId,
        normalized.signingPublicKey,
        normalized.trustState === 'verified' ? 'verified' : normalized.trustState === 'blocked' ? 'blocked' : 'unverified'
      );
    } catch {}

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_PEERS, 'readwrite');
          const store = tx.objectStore(STORE_PEERS);
          const req = store.put(normalized);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn('[PeerIdentityStore] DB write failed, using memory:', e);
      }
    }

    this.notifyListeners();
  }

  /**
   * Look up peer by nodeId
   */
  public async getPeerByNodeId(nodeId: string): Promise<PeerIdentity | null> {
    await this.initialize();
    if (this.memoryPeers.has(nodeId)) {
      return this.memoryPeers.get(nodeId)!;
    }

    // Fallback to demo fixtures for display metadata if not in production database
    const clean = nodeId.toLowerCase().trim();
    const demo = INITIAL_PEERS.find((p) => p.id.toLowerCase() === clean);
    if (demo) {
      return {
        nodeId: demo.id,
        callsign: demo.callsign,
        signingPublicKey: demo.publicKey || '',
        encryptionPublicKey: demo.publicKey?.replace('x25519:', '') || '',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        trustState: 'unknown',
        capabilities: ['mesh:v1'],
      };
    }

    return null;
  }

  /**
   * Look up peer by callsign (case-insensitive)
   */
  public async getPeerByCallsign(callsign: string): Promise<PeerIdentity | null> {
    await this.initialize();
    const clean = callsign.toLowerCase().trim();
    for (const peer of this.memoryPeers.values()) {
      if (peer.callsign.toLowerCase() === clean) {
        return peer;
      }
    }

    // Fallback to demo fixtures for display metadata
    const demo = INITIAL_PEERS.find((p) => p.callsign.toLowerCase() === clean);
    if (demo) {
      return {
        nodeId: demo.id,
        callsign: demo.callsign,
        signingPublicKey: demo.publicKey || '',
        encryptionPublicKey: demo.publicKey?.replace('x25519:', '') || '',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        trustState: 'unknown',
        capabilities: ['mesh:v1'],
      };
    }

    return null;
  }

  /**
   * Look up peer by signing public key hex
   */
  public async getPeerBySigningKey(signingKeyHex: string): Promise<PeerIdentity | null> {
    await this.initialize();
    const clean = signingKeyHex.replace(/^(0x|ed25519:)/i, '').toLowerCase();
    for (const peer of this.memoryPeers.values()) {
      if (peer.signingPublicKey.toLowerCase() === clean) {
        return peer;
      }
    }
    return null;
  }

  /**
   * Get all registered peers
   */
  public async getAllPeers(): Promise<PeerIdentity[]> {
    await this.initialize();
    return Array.from(this.memoryPeers.values());
  }

  /**
   * Update peer trust state
   */
  public async updateTrustState(nodeId: string, trustState: TrustState): Promise<boolean> {
    const peer = await this.getPeerByNodeId(nodeId);
    if (!peer) return false;

    peer.trustState = trustState;
    await this.putPeer(peer);
    return true;
  }

  /**
   * Record peer activity timestamp
   */
  public async recordPeerActivity(nodeId: string): Promise<void> {
    const peer = await this.getPeerByNodeId(nodeId);
    if (peer) {
      peer.lastSeenAt = Date.now();
      await this.putPeer(peer);
    }
  }

  /**
   * Remove peer
   */
  public async removePeer(nodeId: string): Promise<void> {
    await this.initialize();
    this.memoryPeers.delete(nodeId);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_PEERS, 'readwrite');
          const store = tx.objectStore(STORE_PEERS);
          const req = store.delete(nodeId);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch {}
    }

    this.notifyListeners();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

export const peerIdentityStore = new PeerIdentityStore();
