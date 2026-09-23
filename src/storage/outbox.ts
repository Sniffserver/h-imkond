import { HoimuPacket } from '../protocol/types';
import { storageDB } from './db';
import { STORES } from './migrations';

export type OutboxState =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'acknowledged'
  | 'retrying'
  | 'expired'
  | 'failed';

export interface RetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  ttlSeconds: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 5,
  ttlSeconds: 86400,
};

export interface OutboxItem {
  id: string;
  packet: HoimuPacket;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  status: OutboxState;
  retryPolicy: RetryPolicy;
  expiresAt: number;
}

const memoryOutbox = new Map<string, OutboxItem>();

export class OutboxStore {
  public static async enqueue(
    packet: HoimuPacket,
    policy: Partial<RetryPolicy> = {}
  ): Promise<OutboxItem> {
    const fullPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
    const now = Date.now();
    const expiresAt = packet.header.expiresAt
      ? packet.header.expiresAt * 1000
      : now + fullPolicy.ttlSeconds * 1000;

    const item: OutboxItem = {
      id: packet.header.packetId,
      packet,
      queuedAt: now,
      attempts: 0,
      status: 'queued',
      retryPolicy: fullPolicy,
      expiresAt,
    };

    memoryOutbox.set(item.id, item);

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      tx.objectStore(STORES.OUTBOX).put(item);
    } catch {
      // Memory fallback
    }

    return item;
  }

  public static async getPending(): Promise<OutboxItem[]> {
    const now = Date.now();
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.OUTBOX).getAll();
        req.onsuccess = () => {
          const items: OutboxItem[] = req.result || [];
          const pending = items.filter(
            (i) =>
              (i.status === 'queued' ||
                i.status === 'sending' ||
                i.status === 'sent' ||
                i.status === 'retrying') &&
              i.expiresAt > now
          );
          resolve(pending);
        };
        req.onerror = () =>
          resolve(
            Array.from(memoryOutbox.values()).filter(
              (i) =>
                (i.status === 'queued' ||
                  i.status === 'sending' ||
                  i.status === 'sent' ||
                  i.status === 'retrying') &&
                i.expiresAt > now
            )
          );
      });
    } catch {
      return Array.from(memoryOutbox.values()).filter(
        (i) =>
          (i.status === 'queued' ||
            i.status === 'sending' ||
            i.status === 'sent' ||
            i.status === 'retrying') &&
          i.expiresAt > now
      );
    }
  }

  public static async updateStatus(id: string, status: OutboxState): Promise<void> {
    const item = memoryOutbox.get(id);
    if (item) {
      item.status = status;
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
            lastAttemptAt: Date.now(),
          };
          store.put(updated);
        }
      };
    } catch {
      // Memory fallback
    }
  }

  public static async recordAttempt(id: string, success: boolean): Promise<OutboxItem | null> {
    let item = memoryOutbox.get(id) || null;
    const now = Date.now();

    if (!item) {
      try {
        const db = await storageDB.getDB();
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.OUTBOX).get(id);
        item = await new Promise((resolve) => {
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch {
        item = null;
      }
    }

    if (!item) return null;

    item.attempts += 1;
    item.lastAttemptAt = now;

    if (success) {
      item.status = 'sent';
    } else {
      if (now >= item.expiresAt) {
        item.status = 'expired';
      } else if (item.attempts >= item.retryPolicy.maxAttempts) {
        item.status = 'failed';
      } else {
        item.status = 'retrying';
        const delay = Math.min(
          item.retryPolicy.initialDelayMs * Math.pow(2, item.attempts - 1),
          item.retryPolicy.maxDelayMs
        );
        item.nextAttemptAt = now + delay;
      }
    }

    memoryOutbox.set(id, item);

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      tx.objectStore(STORES.OUTBOX).put(item);
    } catch {
      // Memory fallback
    }

    return item;
  }

  /**
   * After reboot / app initialization:
   * Restores persistent outbox, removes/marks expired packets, and resumes valid pending packets.
   */
  public static async restoreAndCleanExpired(): Promise<OutboxItem[]> {
    const now = Date.now();
    let allItems: OutboxItem[] = [];

    try {
      const db = await storageDB.getDB();
      allItems = await new Promise((resolve) => {
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.OUTBOX).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(memoryOutbox.values()));
      });
    } catch {
      allItems = Array.from(memoryOutbox.values());
    }

    const validPending: OutboxItem[] = [];

    for (const item of allItems) {
      if (now > item.expiresAt && item.status !== 'acknowledged' && item.status !== 'failed') {
        item.status = 'expired';
        memoryOutbox.set(item.id, item);
        try {
          const db = await storageDB.getDB();
          const tx = db.transaction(STORES.OUTBOX, 'readwrite');
          tx.objectStore(STORES.OUTBOX).put(item);
        } catch {
          // ignore
        }
      } else if (
        item.status === 'queued' ||
        item.status === 'sending' ||
        item.status === 'sent' ||
        item.status === 'retrying'
      ) {
        memoryOutbox.set(item.id, item);
        validPending.push(item);
      }
    }

    return validPending;
  }

  public static clearMemory(): void {
    memoryOutbox.clear();
  }
}
