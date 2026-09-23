import { storageDB } from './db';
import { STORES } from './migrations';

export interface StoredPeer {
  nodeId: string;
  callsign: string;
  signingPublicKeyHex: string;
  dhPublicKeyHex?: string;
  lastSeen: number;
  hopCount: number;
  snr?: number;
  rssi?: number;
  viaTransport?: string;
}

const memoryPeers = new Map<string, StoredPeer>();

export class PeerStore {
  public static async upsertPeer(peer: StoredPeer): Promise<void> {
    memoryPeers.set(peer.nodeId, peer);

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.PEERS, 'readwrite');
      tx.objectStore(STORES.PEERS).put(peer);
    } catch {
      // Memory fallback active
    }
  }

  public static async getPeer(nodeId: string): Promise<StoredPeer | null> {
    if (memoryPeers.has(nodeId)) {
      return memoryPeers.get(nodeId) || null;
    }

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.PEERS, 'readonly');
        const req = tx.objectStore(STORES.PEERS).get(nodeId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public static async getAllPeers(): Promise<StoredPeer[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.PEERS, 'readonly');
        const req = tx.objectStore(STORES.PEERS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(memoryPeers.values()));
      });
    } catch {
      return Array.from(memoryPeers.values());
    }
  }

  public static clearMemory(): void {
    memoryPeers.clear();
  }
}
