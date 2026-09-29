import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
const requireFn = createRequire(import.meta.url);
(globalThis as any).nodeZlib = requireFn('zlib');

import { locationManager } from '../services/location/LocationManager';
import { mapPackStorageEngine } from '../services/storage/mapPackStorageEngine';
import { MapPackInstaller } from '../features/map/packs/MapPackInstaller';
import { MAP_PACK_MANIFESTS } from '../features/map/packs/MapPackManifest';
import * as mapPackServiceModule from '../services/map/mapPackService';
import { compilePMTilesBuffer } from '../../tools/map-data/build/pmtiles';

describe('Unified LocationContext Stream & Atomic Map Pack Storage Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------
  // Test 1: Single Location Authority via LocationManager
  // -------------------------------------------------------------
  it('unifies location authority into LocationManager and supports provider switching', async () => {
    const initialType = locationManager.getActiveProviderType();
    expect(['browser', 'android', 'gnss_serial', 'mesh_triangulation', 'replay']).toContain(initialType);

    // Subscribe to canonical LocationManager stream
    const fixLog: any[] = [];
    const unsubscribe = locationManager.subscribe((fix) => {
      fixLog.push(fix);
    });

    // Switch to replay provider and start
    await locationManager.setProvider('replay');
    await locationManager.start();
    expect(locationManager.getActiveProviderType()).toBe('replay');

    const replayFix = locationManager.getLastFix();
    expect(replayFix).toBeDefined();
    expect(typeof replayFix?.lat).toBe('number');
    expect(typeof replayFix?.lng).toBe('number');

    // Switch back
    await locationManager.setProvider('browser');
    expect(locationManager.getActiveProviderType()).toBe('browser');

    unsubscribe();
  });

  // -------------------------------------------------------------
  // Test 2: MapPackStorageEngine OPFS / Capacitor Native Writer & Reader
  // -------------------------------------------------------------
  it('writes and reads binary map pack artifacts using MapPackStorageEngine', async () => {
    const testFilename = 'test_tallinn_basemap.pmtiles';
    // Valid PMTiles v3 Header (7 bytes ASCII 'PMTiles') + padding
    const mockPmtiles = new Uint8Array([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73, 0x03, 0x00, 0x00]);

    await mapPackStorageEngine.writeBinaryFile(testFilename, mockPmtiles.buffer);
    const readBuffer = await mapPackStorageEngine.readBinaryFile(testFilename);

    expect(readBuffer).not.toBeNull();
    if (readBuffer) {
      const readBytes = new Uint8Array(readBuffer);
      expect(readBytes[0]).toBe(0x50); // 'P'
      expect(readBytes[1]).toBe(0x4d); // 'M'
      expect(readBytes[2]).toBe(0x54); // 'T'
      expect(readBytes[3]).toBe(0x69); // 'i'
    }

    await mapPackStorageEngine.deleteBinaryFile(testFilename);
  });

  // -------------------------------------------------------------
  // Test 3: MapPackInstaller Atomic Installation & Strict Checksum Verification
  // -------------------------------------------------------------
  it('validates PMTiles header and SHA-256 during MapPackInstaller execution', async () => {
    const packManifest = MAP_PACK_MANIFESTS['tallinn'];
    expect(packManifest).toBeDefined();
    expect(packManifest.routingSnapshotVersion).toBeDefined();

    // Mock fetch response returning valid artifact bytes with corresponding binary headers
    const mockPmtilesBytes = compilePMTilesBuffer({
      outputPath: 'mock-basemap.pmtiles',
      name: 'Mock Tallinn Vector Basemap',
      description: 'Mock Tallinn Vector Basemap Description',
      layers: [
        { id: 'roads' },
        { id: 'paths' },
        { id: 'buildings' },
        { id: 'water' },
        { id: 'landuse' },
        { id: 'transit' },
        { id: 'places' },
        { id: 'labels' },
      ],
    });

    const mockPoiPmtilesBytes = compilePMTilesBuffer({
      outputPath: 'mock-poi.pmtiles',
      name: 'Mock Tallinn POI',
      description: 'Mock Tallinn POI Description',
      layers: [
        { id: 'safety' },
        { id: 'health' },
        { id: 'water' },
        { id: 'tools' },
        { id: 'stores' },
        { id: 'shelters' },
        { id: 'community' },
      ],
      isPoi: true,
    });

    const mockRoutingBytes = new Uint8Array(32);
    'HROUTG'.split('').forEach((c, i) => { mockRoutingBytes[i] = c.charCodeAt(0); });

    const mockStreetIndexBytes = new Uint8Array(32);
    'HSTRIDX'.split('').forEach((c, i) => { mockStreetIndexBytes[i] = c.charCodeAt(0); });

    const mockSearchIndexBytes = new Uint8Array(32);
    'HSRCHDX'.split('').forEach((c, i) => { mockSearchIndexBytes[i] = c.charCodeAt(0); });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      let data = mockPmtilesBytes;
      if (urlStr.includes('-poi')) data = mockPoiPmtilesBytes;
      if (urlStr.includes('.graph')) data = mockRoutingBytes;
      if (urlStr.includes('street-index')) data = mockStreetIndexBytes;
      if (urlStr.includes('search-index')) data = mockSearchIndexBytes;

      return {
        ok: true,
        headers: new Headers({ 'Content-Length': String(data.byteLength) }),
        blob: async () => new Blob([data]),
        arrayBuffer: async () => data.buffer,
      } as any;
    });

    // Mock SHA-256 calculator to return manifest's expected checksum for each artifact
    let pmCallCount = 0;
    const shaSpy = vi.spyOn(mapPackServiceModule, 'calculateSha256').mockImplementation(async (buf: any) => {
      const bytes = new Uint8Array(buf);
      const magic = String.fromCharCode(...bytes.slice(0, 7));
      if (magic === 'PMTiles') {
        pmCallCount++;
        if (pmCallCount === 1) {
          return packManifest.artifacts?.basemap?.sha256 || packManifest.sha256;
        } else {
          return packManifest.artifacts?.poi?.sha256 || 'poi-sha';
        }
      }
      const magicRouting = String.fromCharCode(...bytes.slice(0, 6));
      if (magicRouting === 'HROUTG') {
        return packManifest.artifacts?.routing?.sha256 || 'routing-sha';
      }
      const magicStreet = String.fromCharCode(...bytes.slice(0, 7));
      if (magicStreet === 'HSTRIDX') {
        return packManifest.artifacts?.streetIndex?.sha256 || 'street-sha';
      }
      if (magicStreet === 'HSRCHDX') {
        return packManifest.artifacts?.searchIndex?.sha256 || 'search-sha';
      }
      return 'custom';
    });

    const success = await MapPackInstaller.install('tallinn');
    expect(success).toBe(true);

    fetchSpy.mockRestore();
    shaSpy.mockRestore();
  });
});
