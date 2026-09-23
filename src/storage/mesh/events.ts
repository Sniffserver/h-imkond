/**
 * Storage Domain: mesh.events
 * 
 * Records topology updates, route changes, peer discoveries, link metrics,
 * and mesh sync state transitions.
 * 
 * RULE: Backed by IndexedDB. NEVER stored in localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface MeshEventRecord {
  id: string;
  type: 'peer_discovered' | 'peer_expired' | 'route_updated' | 'packet_relayed' | 'link_quality_changed' | 'sync_completed';
  timestamp: number;
  nodeId?: string;
  details?: Record<string, any>;
}

const memoryEvents: MeshEventRecord[] = [];

export class MeshEventStore {
  public static async recordEvent(event: Omit<MeshEventRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<MeshEventRecord> {
    const record: MeshEventRecord = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: event.timestamp || Date.now(),
      type: event.type,
      nodeId: event.nodeId,
      details: event.details,
    };

    memoryEvents.push(record);
    if (memoryEvents.length > 500) {
      memoryEvents.shift();
    }

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.EVENTS, 'readwrite');
      tx.objectStore(STORES.EVENTS).put(record);
    } catch {
      // Memory fallback active
    }

    return record;
  }

  public static async getRecentEvents(limit = 50): Promise<MeshEventRecord[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.EVENTS, 'readonly');
        const req = tx.objectStore(STORES.EVENTS).getAll();
        req.onsuccess = () => {
          const events = (req.result || []) as MeshEventRecord[];
          events.sort((a, b) => b.timestamp - a.timestamp);
          resolve(events.slice(0, limit));
        };
        req.onerror = () => resolve(memoryEvents.slice(-limit).reverse());
      });
    } catch {
      return memoryEvents.slice(-limit).reverse();
    }
  }

  public static async clear(): Promise<void> {
    memoryEvents.length = 0;
    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.EVENTS, 'readwrite');
      tx.objectStore(STORES.EVENTS).clear();
    } catch {
      // Memory fallback active
    }
  }
}
