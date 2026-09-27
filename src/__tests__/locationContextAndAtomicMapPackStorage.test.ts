import { describe, it, expect, beforeEach, vi } from 'vitest';
import { locationManager } from '../services/location/LocationManager';
import { mapPackStorageEngine } from '../services/storage/mapPackStorageEngine';
import { MapPackInstaller } from '../features/map/packs/MapPackInstaller';
import { MAP_PACK_MANIFESTS } from '../features/map/packs/MapPackManifest';
import * as mapPackServiceModule from '../services/map/mapPackService';

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

    // Mock fetch response returning valid PMTiles bytes
    const mockPmtilesBytes = new Uint8Array(200);
    // Write PMTiles magic bytes
    mockPmtilesBytes[0] = 0x50; // P
    mockPmtilesBytes[1] = 0x4d; // M
    mockPmtilesBytes[2] = 0x54; // T
    mockPmtilesBytes[3] = 0x69; // i
    mockPmtilesBytes[4] = 0x6c; // l
    mockPmtilesBytes[5] = 0x65; // e
    mockPmtilesBytes[6] = 0x73; // s
    mockPmtilesBytes[7] = 0x03; // PMTiles v3 specVersion

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Length': '200' }),
      blob: async () => new Blob([mockPmtilesBytes]),
      arrayBuffer: async () => mockPmtilesBytes.buffer,
    } as any);

    // Mock SHA-256 calculator to return manifest's expected checksum
    const shaSpy = vi.spyOn(mapPackServiceModule, 'calculateSha256').mockResolvedValue(packManifest.sha256 || 'custom');

    const success = await MapPackInstaller.install('tallinn');
    expect(success).toBe(true);

    fetchSpy.mockRestore();
    shaSpy.mockRestore();
  });
});
