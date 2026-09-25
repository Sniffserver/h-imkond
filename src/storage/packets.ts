import { HoimuPacket } from '../protocol/types';
import { storageDB } from './db';
import { STORES } from './migrations';

const memoryPackets = new Map<string, HoimuPacket>();

export class PacketStore {
  public static async save(packet: HoimuPacket): Promise<void> {
    const packetId = packet.header.packetId;
    memoryPackets.set(packetId, packet);

    try {
      await storageDB.writeDurably(STORES.PACKETS, (store) => {
        return store.put({
          packetId,
          ...packet,
        });
      });
    } catch {
      // Memory fallback active
    }
  }

  public static async get(packetId: string): Promise<HoimuPacket | null> {
    if (memoryPackets.has(packetId)) {
      return memoryPackets.get(packetId) || null;
    }

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.PACKETS, 'readonly');
        const req = tx.objectStore(STORES.PACKETS).get(packetId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public static clearMemory(): void {
    memoryPackets.clear();
  }
}
