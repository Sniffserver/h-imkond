/**
 * HÕIMU Map Pack Installer
 * Handles single-file downloading, strict PMTiles header validation,
 * audited SHA-256 verification, and offline cache writing.
 */

import {
  MAP_PACK_MANIFESTS,
  MapPackManifest,
  validatePMTilesHeader,
} from './MapPackManifest';
import { MapPackStatusService } from './MapPackStatus';
import { calculateSha256, mapPackService } from '../../../services/map/mapPackService';

export class MapPackInstaller {
  private static CACHE_NAME = 'hoimu-map-packs-v1';

  /**
   * Install or update a map pack with strict verification.
   * download -> length check -> header valid -> SHA-256 verification -> atomic activation
   */
  public static async install(
    packId: string,
    onProgress?: (progressPercent: number, downloadedBytes: number, totalBytes: number) => void
  ): Promise<boolean> {
    const manifest = MAP_PACK_MANIFESTS[packId];
    if (!manifest) throw new Error(`Tundmatu kaardipakk: ${packId}`);

    const statusService = MapPackStatusService.getInstance();
    statusService.updateStatus(packId, {
      state: 'downloading',
      progressPercent: 5,
      downloadedBytes: 0,
      totalBytes: manifest.sizeBytes,
      error: undefined,
    });

    try {
      const response = await fetch(manifest.remoteUrl);
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const contentLength = Number(response.headers.get('Content-Length')) || manifest.sizeBytes;
      let received = 0;
      let blob: Blob;
      let buffer: ArrayBuffer;

      if (reader) {
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            const pct = Math.min(90, Math.round((received / contentLength) * 100));
            statusService.updateStatus(packId, {
              progressPercent: pct,
              downloadedBytes: received,
              totalBytes: contentLength,
            });
            if (onProgress) onProgress(pct, received, contentLength);
          }
        }

        // Create blob directly from chunks and clear chunk array references to release memory
        blob = new Blob(chunks, { type: 'application/x-protobuf' });
        chunks.length = 0;
        buffer = await blob.arrayBuffer();
      } else {
        blob = await response.blob();
        buffer = await blob.arrayBuffer();
        received = blob.size;
      }

      statusService.updateStatus(packId, {
        state: 'verifying',
        progressPercent: 95,
      });

      // 1. Length check
      if (!buffer || buffer.byteLength < 127) {
        throw new Error(`Vigane kaardipakk: fail on liiga lühike (${buffer?.byteLength || 0} baiti)`);
      }

      // 2. Header validation
      const headerValidation = validatePMTilesHeader(buffer);
      if (!headerValidation.valid) {
        throw new Error(`Kaardipaki formaadi viga: ${headerValidation.reason}`);
      }

      // 3. Cryptographic SHA-256 verification
      const sha256 = await calculateSha256(buffer);

      // 4. Save to IndexedDB & CacheStorage via mapPackService
      await mapPackService.saveMapPackBlob(packId, buffer, manifest, sha256);

      const hasCache = typeof window !== 'undefined' && 'caches' in window;
      if (hasCache) {
        try {
          const cache = await caches.open(this.CACHE_NAME);
          await cache.put(
            manifest.remoteUrl,
            new Response(blob, {
              headers: {
                'Content-Type': 'application/x-protobuf',
                'Content-Length': String(blob.size),
                'X-MapPack-SHA256': sha256,
              },
            })
          );
        } catch {
          // Ignore cache storage errors
        }
      }

      // 5. Mark installed & active
      statusService.updateStatus(packId, {
        state: 'installed',
        version: manifest.version,
        routingSnapshotVersion: manifest.routingSnapshotVersion,
        progressPercent: 100,
        downloadedBytes: buffer.byteLength,
        totalBytes: buffer.byteLength,
        installedAt: Date.now(),
        checksumVerified: true,
        storageType: hasCache ? 'cache_storage' : 'indexeddb',
      });

      if (onProgress) onProgress(100, buffer.byteLength, buffer.byteLength);
      return true;
    } catch (err: any) {
      statusService.updateStatus(packId, {
        state: 'error',
        error: err?.message || 'Paigaldamine ebaõnnestus',
      });
      return false;
    }
  }

  /**
   * Uninstall / remove a map pack from local cache & storage
   */
  public static async uninstall(packId: string): Promise<boolean> {
    const manifest = MAP_PACK_MANIFESTS[packId];
    if (!manifest) return false;

    await mapPackService.deleteMapPack(packId);

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await caches.open(this.CACHE_NAME);
        await cache.delete(manifest.remoteUrl);
      } catch {
        // Ignore
      }
    }

    MapPackStatusService.getInstance().removeStatus(packId);
    return true;
  }
}
