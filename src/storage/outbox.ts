import { HoimuPacket } from '../protocol/types';
import { storageDB } from './db';
import { STORES } from './migrations';

/**
 * Outbox State Machine Lifecycle:
 * QUEUED -> CLAIMED -> SENDING -> TX_CONFIRMED -> WAITING_ACK -> ACKED
 *                               \-> RETRYING -> (QUEUED / CLAIMED ...)
 *                               \-> EXPIRED / FAILED
 */
export type OutboxState =
  | 'queued'
  | 'claimed'
  | 'sending'
  | 'tx_confirmed'
  | 'waiting_ack'
  | 'acked'
  | 'retrying'
  | 'expired'
  | 'failed'
  // Backward-compatibility aliases
  | 'sent'
  | 'acknowledged';

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
  attemptId?: string;
  workerId?: string;
  leaseUntil?: number;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  status: OutboxState;
  retryPolicy: RetryPolicy;
  expiresAt: number;
  txConfirmedAt?: number;
  ackedAt?: number;
  lastError?: string;
}

/**
 * Volatile in-memory fallback stores.
 * NOTE: These are strictly non-durable process memory. If IndexedDB is unavailable,
 * data in this store will be lost on page reload / reboot.
 */
const memoryOutbox = new Map<string, OutboxItem>();
const volatileFallbackStore = new Map<string, OutboxItem>();

export class OutboxStore {
  /**
   * Returns true if storage is operating in volatile fallback mode without durable persistence.
   */
  public static isVolatileFallbackMode(): boolean {
    return storageDB.isMemoryMode || typeof indexedDB === 'undefined';
  }

  public static getStorageDurability(): { isDurable: boolean; mode: 'durable_indexeddb' | 'volatile_memory'; label: string } {
    const isDurable = !this.isVolatileFallbackMode();
    return {
      isDurable,
      mode: isDurable ? 'durable_indexeddb' : 'volatile_memory',
      label: isDurable ? 'DURABLE (IndexedDB)' : 'LOCAL ONLY / NOT DURABLE (Volatile Fallback)',
    };
  }

  public static async enqueue(
    packet: HoimuPacket,
    policy: Partial<RetryPolicy> = {}
  ): Promise<OutboxItem> {
    const fullPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
    const now = Date.now();
    const expiresAt = packet.header.expiresAt
      ? (packet.header.expiresAt > 1e11 ? packet.header.expiresAt : packet.header.expiresAt * 1000)
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
    volatileFallbackStore.set(item.id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile in-memory fallback
    }

    return item;
  }

  /**
   * Atomically claims a queued or retry-ready item with a workerId, attemptId, and lease duration.
   */
  public static async claim(
    id: string,
    workerId: string,
    leaseDurationMs: number = 10000
  ): Promise<OutboxItem | null> {
    const now = Date.now();
    let item = await this.getItem(id);
    if (!item) return null;

    // Check if eligible to claim: queued, retrying, or expired lease
    const canClaim =
      item.status === 'queued' ||
      item.status === 'retrying' ||
      (item.status === 'claimed' && item.leaseUntil && item.leaseUntil < now) ||
      (item.status === 'sending' && item.leaseUntil && item.leaseUntil < now);

    if (!canClaim) return null;

    item.status = 'claimed';
    item.workerId = workerId;
    item.attemptId = `att_${now}_${Math.random().toString(36).slice(2, 7)}`;
    item.leaseUntil = now + leaseDurationMs;
    item.lastAttemptAt = now;

    memoryOutbox.set(id, item);
    volatileFallbackStore.set(id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile fallback
    }

    return item;
  }

  /**
   * Sets state to 'sending' during radio transmission.
   */
  public static async startSending(id: string, attemptId?: string): Promise<OutboxItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;

    if (attemptId && item.attemptId && item.attemptId !== attemptId) {
      console.warn(`[Outbox] AttemptId mismatch on startSending: ${item.attemptId} vs ${attemptId}`);
    }

    item.status = 'sending';
    item.lastAttemptAt = Date.now();
    memoryOutbox.set(id, item);
    volatileFallbackStore.set(id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile fallback
    }

    return item;
  }

  /**
   * Confirms physical radio / transport frame transmission (TX_CONFIRMED).
   * Note: Radio TX success != message delivered.
   * If packet requires an end-to-end ACK, moves to 'waiting_ack'.
   */
  public static async confirmTx(
    id: string,
    _attemptId?: string,
    requiresAck: boolean = false
  ): Promise<OutboxItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;

    const now = Date.now();
    item.txConfirmedAt = now;
    item.leaseUntil = undefined;
    item.status = requiresAck ? 'waiting_ack' : 'tx_confirmed';

    memoryOutbox.set(id, item);
    volatileFallbackStore.set(id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile fallback
    }

    return item;
  }

  /**
   * Confirms that an end-to-end ACK packet has been received from destination (ACKED).
   */
  public static async confirmAck(
    id: string,
    _details?: { status?: string; latencyMs?: number }
  ): Promise<OutboxItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;

    const now = Date.now();
    item.status = 'acked';
    item.ackedAt = now;
    item.leaseUntil = undefined;

    memoryOutbox.set(id, item);
    volatileFallbackStore.set(id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile fallback
    }

    return item;
  }

  public static async getItem(id: string): Promise<OutboxItem | null> {
    let item = memoryOutbox.get(id) || volatileFallbackStore.get(id) || null;
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
                i.status === 'claimed' ||
                i.status === 'sending' ||
                i.status === 'tx_confirmed' ||
                i.status === 'waiting_ack' ||
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
                  i.status === 'claimed' ||
                  i.status === 'sending' ||
                  i.status === 'tx_confirmed' ||
                  i.status === 'waiting_ack' ||
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
            i.status === 'claimed' ||
            i.status === 'sending' ||
            i.status === 'tx_confirmed' ||
            i.status === 'waiting_ack' ||
            i.status === 'sent' ||
            i.status === 'retrying') &&
          i.expiresAt > now
      );
    }
  }

  public static async updateStatus(id: string, status: OutboxState): Promise<void> {
    const item = await this.getItem(id);
    if (item) {
      item.status = status;
      item.lastAttemptAt = Date.now();
      if (status === 'acked' || status === 'acknowledged') {
        item.ackedAt = Date.now();
        item.leaseUntil = undefined;
      }
      memoryOutbox.set(id, item);
      volatileFallbackStore.set(id, item);
    }

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            const updated = {
              ...req.result,
              status,
              lastAttemptAt: Date.now(),
              ...(status === 'acked' || status === 'acknowledged' ? { ackedAt: Date.now(), leaseUntil: undefined } : {}),
            };
            store.put(updated);
          }
        };
      });
    } catch {
      // Volatile fallback
    }
  }

  public static async recordAttempt(
    id: string,
    success: boolean,
    requiresAck: boolean = false,
    errorMessage?: string
  ): Promise<OutboxItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;

    const now = Date.now();
    item.attempts += 1;
    item.lastAttemptAt = now;
    item.lastError = errorMessage;

    if (success) {
      item.status = requiresAck ? 'waiting_ack' : 'tx_confirmed';
      item.txConfirmedAt = now;
      item.leaseUntil = undefined;
    } else {
      item.leaseUntil = undefined;
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
    volatileFallbackStore.set(id, item);

    try {
      await storageDB.writeDurably(STORES.OUTBOX, (store) => {
        return store.put(item);
      });
    } catch {
      // Volatile fallback
    }

    return item;
  }

  /**
   * After reboot / app initialization:
   * 1. Restores persistent outbox from durable storage.
   * 2. Evaluates expiration: marks expired packets as 'expired'.
   * 3. Fixes stranded 'sending' / 'claimed' packets: resets lease and transitions to 'retrying' or 'queued'.
   * 4. Returns ready and valid pending packets.
   */
  public static async restoreAndCleanExpired(): Promise<OutboxItem[]> {
    const now = Date.now();
    let allItems: OutboxItem[] = [];

    try {
      const db = await storageDB.getDB();
      allItems = await new Promise((resolve) => {
        const tx = db.transaction(STORES.OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.OUTBOX).getAll();
        req.onsuccess = () => resolve(req.result && req.result.length > 0 ? req.result : Array.from(volatileFallbackStore.values()));
        req.onerror = () => resolve(Array.from(volatileFallbackStore.values()));
      });
    } catch {
      allItems = Array.from(volatileFallbackStore.values());
    }

    const validPending: OutboxItem[] = [];

    for (const item of allItems) {
      if (
        now > item.expiresAt &&
        item.status !== 'acked' &&
        item.status !== 'acknowledged' &&
        item.status !== 'failed'
      ) {
        item.status = 'expired';
        item.leaseUntil = undefined;
        memoryOutbox.set(item.id, item);
        try {
          await storageDB.writeDurably(STORES.OUTBOX, (store) => {
            return store.put(item);
          });
        } catch {
          // ignore
        }
      } else {
        // Handle crash / reboot recovery for in-flight packets
        if (item.status === 'sending' || item.status === 'claimed') {
          // Reset stranded lease on startup
          item.leaseUntil = undefined;
          item.workerId = undefined;
          item.status = item.attempts > 0 ? 'retrying' : 'queued';
          item.nextAttemptAt = now; // Ready to re-send immediately
          try {
            await storageDB.writeDurably(STORES.OUTBOX, (store) => {
              return store.put(item);
            });
          } catch {
            // ignore
          }
        }

        if (
          item.status === 'queued' ||
          item.status === 'tx_confirmed' ||
          item.status === 'waiting_ack' ||
          item.status === 'sent' ||
          item.status === 'retrying'
        ) {
          memoryOutbox.set(item.id, item);
          validPending.push(item);
        }
      }
    }

    return validPending;
  }

  public static clearMemory(): void {
    memoryOutbox.clear();
  }

  public static clearVolatileFallback(): void {
    volatileFallbackStore.clear();
  }
}
