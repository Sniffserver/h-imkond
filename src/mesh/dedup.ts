/**
 * LRU Deduplication Cache for Routing Loops Prevention
 */

export interface CacheOptions {
  maxCapacity?: number;
  defaultTtlMs?: number;
}

export class DedupCache {
  private cache = new Map<string, number>();
  private maxCapacity: number;
  private defaultTtlMs: number;

  constructor(options?: CacheOptions) {
    this.maxCapacity = options?.maxCapacity ?? 2000;
    this.defaultTtlMs = options?.defaultTtlMs ?? 15 * 60 * 1000; // 15 mins
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

  public markSeen(packetId: string, customExpiryMs?: number): void {
    if (this.cache.size >= this.maxCapacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    const expiry = customExpiryMs ?? Date.now() + this.defaultTtlMs;
    this.cache.set(packetId, expiry);
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
  }
}
