/**
 * HÕIMU Mesh Network — SeenPacketCache
 * 
 * High-performance bounded LRU cache with time-based expiration for mesh packet deduplication
 * and routing loop prevention.
 * 
 * Semantics:
 * - "Seen Packet" = "This node has physically received and processed/routed this packet."
 * - Completely separated from Outbox / Queued Packet Delivery State ("I still need to transmit/relay this").
 */

export interface SeenPacketEntry {
  packetId: string;
  firstSeen: number;
  expires: number;
  originId?: string;
  sequence?: number;
}

export interface SeenPacketCacheOptions {
  maxCapacity?: number;
  maxEntries?: number;
  defaultTtlMs?: number;
}

const DEFAULT_MAX_CAPACITY = 2000;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SeenPacketCache {
  private readonly maxCapacity: number;
  private readonly defaultTtlMs: number;
  private entries: Map<string, SeenPacketEntry> = new Map();

  constructor(options?: SeenPacketCacheOptions) {
    this.maxCapacity = options?.maxCapacity ?? options?.maxEntries ?? DEFAULT_MAX_CAPACITY;
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * Check if a packetId has already been seen and is not expired.
   * Promotes the entry to most recently used in LRU order.
   */
  public has(packetId: string): boolean {
    if (!packetId) return false;

    const entry = this.entries.get(packetId);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.expires) {
      this.entries.delete(packetId);
      return false;
    }

    // Refresh LRU order (delete & re-insert)
    this.entries.delete(packetId);
    this.entries.set(packetId, entry);
    return true;
  }

  /**
   * Alias for has()
   */
  public hasSeen(packetId: string): boolean {
    return this.has(packetId);
  }

  /**
   * Alias for add()
   */
  public markSeen(packetId: string, customExpiresOrTtlMs?: number, meta?: { originId?: string; sequence?: number }): void {
    if (customExpiresOrTtlMs && customExpiresOrTtlMs > Date.now()) {
      this.add(packetId, undefined, customExpiresOrTtlMs, meta);
    } else {
      this.add(packetId, customExpiresOrTtlMs, undefined, meta);
    }
  }

  /**
   * Get an entry if it exists and is not expired.
   */
  public get(packetId: string): SeenPacketEntry | undefined {
    if (!this.has(packetId)) return undefined;
    return this.entries.get(packetId);
  }

  /**
   * Mark a packet as seen by adding it to the deduplication cache.
   * Automatically evicts expired or oldest LRU entries when capacity is exceeded.
   */
  public add(
    packetId: string,
    ttlMs?: number,
    customExpires?: number,
    meta?: { originId?: string; sequence?: number }
  ): void {
    if (!packetId) return;

    const now = Date.now();
    const expires = customExpires ?? (now + (ttlMs ?? this.defaultTtlMs));

    // If entry already exists, delete to update position
    if (this.entries.has(packetId)) {
      this.entries.delete(packetId);
    } else if (this.entries.size >= this.maxCapacity) {
      // First try to prune expired entries
      const pruned = this.prune();
      // If still at capacity, evict the oldest LRU item
      if (pruned === 0 && this.entries.size >= this.maxCapacity) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey !== undefined) {
          this.entries.delete(oldestKey);
        }
      }
    }

    this.entries.set(packetId, {
      packetId,
      firstSeen: now,
      expires,
      originId: meta?.originId,
      sequence: meta?.sequence,
    });
  }

  /**
   * Prune all expired entries from cache.
   * Returns the count of deleted entries.
   */
  public prune(): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expires) {
        this.entries.delete(key);
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Get total current entries count
   */
  public size(): number {
    return this.entries.size;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.entries.clear();
  }

  /**
   * Export all active (unexpired) entries for diagnostics or storage persistence
   */
  public getActiveEntries(): SeenPacketEntry[] {
    const now = Date.now();
    const active: SeenPacketEntry[] = [];
    for (const entry of this.entries.values()) {
      if (now <= entry.expires) {
        active.push(entry);
      }
    }
    return active;
  }
}

// Global singleton instance for mesh routing engine
export const seenPacketCache = new SeenPacketCache();
