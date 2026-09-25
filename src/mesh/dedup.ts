/**
 * HÕIMU Durable LRU Deduplication Cache
 * Prevents routing loops and duplicate packet processing.
 *
 * Grounded in:
 * - Durable persistence: survives reboots via DurableDedupStore
 * - Sliding sequence window per origin: (originId, sequence window)
 * - Strict unambiguous API: markSeenUntil(id, expiresAt) and markSeenFor(id, ttlMs)
 */

import { DurableDedupStore } from '../storage/dedupStore';

export interface CacheOptions {
  maxCapacity?: number;
  defaultTtlMs?: number;
  autoHydrateDurable?: boolean;
}

export interface DedupMeta {
  originId?: string;
  sequence?: number;
  bootEpoch?: number;
}

export class DedupCache {
  private cache = new Map<string, number>(); // packetId -> expiresAt timestamp ms
  // Sliding sequence window per origin: originId -> maxSequenceSeen
  private originSequenceWindow = new Map<string, number>();
  private maxCapacity: number;
  private defaultTtlMs: number;
  private isHydrated = false;

  constructor(options?: CacheOptions) {
    this.maxCapacity = options?.maxCapacity ?? 2000;
    this.defaultTtlMs = options?.defaultTtlMs ?? 15 * 60 * 1000; // 15 mins

    if (options?.autoHydrateDurable !== false) {
      this.hydrateFromStorage().catch(() => {});
    }
  }

  /**
   * Rehydrates cache from durable storage so duplicates are suppressed across reboots.
   */
  public async hydrateFromStorage(): Promise<number> {
    try {
      const records = await DurableDedupStore.loadActiveRecords();
      let count = 0;
      for (const rec of records) {
        if (rec.expiresAt > Date.now()) {
          this.cache.set(rec.packetId, rec.expiresAt);
          if (rec.originId && rec.sequence !== undefined) {
            const currentMax = this.originSequenceWindow.get(rec.originId) ?? 0;
            if (rec.sequence > currentMax) {
              this.originSequenceWindow.set(rec.originId, rec.sequence);
            }
          }
          count += 1;
        }
      }
      this.isHydrated = true;
      return count;
    } catch {
      this.isHydrated = true;
      return 0;
    }
  }

  public isDuplicate(packetId: string): boolean {
    this.cleanup();
    const expiry = this.cache.get(packetId);
    if (expiry !== undefined) {
      if (Date.now() <= expiry) {
        return true;
      }
      this.cache.delete(packetId);
    }
    return false;
  }

  /**
   * Checks if a sequence number from an origin is within an already seen window.
   */
  public isSequenceOldOrSeen(originId: string, sequence: number, windowMargin = 100): boolean {
    const highestSeen = this.originSequenceWindow.get(originId);
    if (highestSeen === undefined) return false;
    // If sequence is significantly behind highest seen sequence, it's stale/replayed
    return sequence < highestSeen - windowMargin;
  }

  /**
   * Explicitly marks a packet as seen until an absolute timestamp (expiresAt).
   * Persists durably across reboots.
   */
  public markSeenUntil(packetId: string, expiresAt: number, meta?: DedupMeta): void {
    if (this.cache.size >= this.maxCapacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(packetId, expiresAt);

    if (meta?.originId && meta.sequence !== undefined) {
      const currentMax = this.originSequenceWindow.get(meta.originId) ?? 0;
      if (meta.sequence > currentMax) {
        this.originSequenceWindow.set(meta.originId, meta.sequence);
      }
    }

    // Persist to durable storage
    DurableDedupStore.recordSeen(packetId, expiresAt, meta).catch(() => {});
  }

  /**
   * Explicitly marks a packet as seen for a relative duration (ttlMs).
   * Persists durably across reboots.
   */
  public markSeenFor(packetId: string, ttlMs: number, meta?: DedupMeta): void {
    const expiresAt = Date.now() + ttlMs;
    this.markSeenUntil(packetId, expiresAt, meta);
  }

  /**
   * Disambiguated backwards-compatibility wrapper.
   * If value > 1e11 (~year 1973 ms timestamp), treats as absolute expiry timestamp;
   * otherwise treats as relative TTL duration ms.
   */
  public markSeen(packetId: string, customExpiresOrTtlMs?: number, meta?: DedupMeta): void {
    if (!customExpiresOrTtlMs) {
      this.markSeenFor(packetId, this.defaultTtlMs, meta);
    } else if (customExpiresOrTtlMs > 100_000_000_000) {
      this.markSeenUntil(packetId, customExpiresOrTtlMs, meta);
    } else {
      this.markSeenFor(packetId, customExpiresOrTtlMs, meta);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cache.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
    this.originSequenceWindow.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }
}
