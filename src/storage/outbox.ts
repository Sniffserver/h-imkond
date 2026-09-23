import { HoimuPacket } from '../protocol/types';
import { storageDB } from './db';
import { STORES } from './migrations';

export interface OutboxItem {
  id: string;
  packet: HoimuPacket;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  status: 'queued' | 'transmitting' | 'delivered' | 'failed';
}

const memoryOutbox = new Map<string, OutboxItem>();

export class OutboxStore {
  public static async enqueue(packet: HoimuPacket): Promise<OutboxItem> {
    const item: OutboxItem = {
      id: packet.header.packetId,
      packet,
      queuedAt: Date.now(),
      attempts: 0,
      status: 'queued',
    };

    memoryOutbox.set(item.id, item);

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      tx.objectStore(STORES.OUTBOX).put(item);
    } catch {
      // Memory fallback active
    }

    return item;
  }

  public static async getPending(): Promise<OutboxItem[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.OUTBOX).getAll();
        req.onsuccess = () => {
          const items: OutboxItem[] = req.result || [];
          resolve(items.filter((i) => i.status === 'queued' || i.status === 'transmitting'));
        };
        req.onerror = () => resolve(Array.from(memoryOutbox.values()).filter((i) => i.status === 'queued'));
      });
    } catch {
      return Array.from(memoryOutbox.values()).filter((i) => i.status === 'queued');
    }
  }

  public static async updateStatus(id: string, status: OutboxItem['status']): Promise<void> {
    const item = memoryOutbox.get(id);
    if (item) {
      item.status = status;
      item.attempts += 1;
      item.lastAttemptAt = Date.now();
    }

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      const store = tx.objectStore(STORES.OUTBOX);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          const updated = {
            ...req.result,
            status,
            attempts: (req.result.attempts || 0) + 1,
            lastAttemptAt: Date.now(),
          };
          store.put(updated);
        }
      };
    } catch {
      // Memory fallback
    }
  }

  public static clearMemory(): void {
    memoryOutbox.clear();
  }
}
