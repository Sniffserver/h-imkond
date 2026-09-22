import { ITileCacheService } from '../types';
import { unifiedTileCache } from '../../features/map/UnifiedTileCache';

/**
 * TileCacheService facade backed by UnifiedTileCache.
 * Provides unified LRU memory + IndexedDB persistent caching.
 */
export class TileCacheService implements ITileCacheService {
  async cacheTile(url: string, blob: Blob): Promise<void> {
    await unifiedTileCache.cacheTileBlob(url, blob);
  }

  async getTile(url: string): Promise<Blob | undefined> {
    return unifiedTileCache.getTileBlob(url);
  }

  async clearCache(): Promise<void> {
    await unifiedTileCache.clearAll();
  }

  async getCacheSize(): Promise<number> {
    const stats = unifiedTileCache.getStats();
    return stats.offlineCount + stats.memoryCount;
  }
}

export const tileCacheService = new TileCacheService();
export default tileCacheService;
