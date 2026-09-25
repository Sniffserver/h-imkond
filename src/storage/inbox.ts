import { HoimuPacket } from '../protocol/types';
import { storageDB } from './db';
import { STORES } from './migrations';

export interface InboxItem {
  packetId: string;
  packet: HoimuPacket;
  receivedAt: number;
  deliveredToApp: boolean;
  decryptedPayload?: any;
}

const memoryInbox = new Map<string, InboxItem>();

export class InboxStore {
  public static async save(
    packet: HoimuPacket,
    decryptedPayload?: any
  ): Promise<InboxItem> {
    const item: InboxItem = {
      packetId: packet.header.packetId,
      packet,
      receivedAt: Date.now(),
      deliveredToApp: true,
      decryptedPayload,
    };

    memoryInbox.set(item.packetId, item);

    try {
      await storageDB.writeDurably(STORES.INBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Memory fallback active
    }

    return item;
  }

  public static async getAll(): Promise<InboxItem[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.INBOX, 'readonly');
        const req = tx.objectStore(STORES.INBOX).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(memoryInbox.values()));
      });
    } catch {
      return Array.from(memoryInbox.values());
    }
  }

  public static clearMemory(): void {
    memoryInbox.clear();
  }
}
