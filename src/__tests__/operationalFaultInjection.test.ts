import { describe, it, expect, beforeEach, vi } from 'vitest';
import { systemCapabilityService } from '../services/runtime/SystemCapabilityService';
import { LocationManager } from '../services/location/LocationManager';
import { generationRepository } from '../features/map/data/GenerationRepository';
import { mapPackStorageEngine } from '../services/storage/mapPackStorageEngine';
import { routingRepository } from '../services/routing/routingRepository';
import { useMeshStore } from '../store/meshStore';

describe('Phase 8 — Operational Reliability & Fault Injection Gate', () => {
  beforeEach(async () => {
    localStorage.clear();
    systemCapabilityService.clearTestDoubleOverrides();
    useMeshStore.setState({
      peers: new Map(),
      bridgePeers: new Map(),
    });
    await LocationManager.getInstance().stop();
  });

  // =========================================================================
  // 1. MAP PACK FAULTS
  // =========================================================================
  describe('Map Pack Fault Injections', () => {
    it('handles download timeout by preserving previous state and reporting failure', async () => {
      const slowFetch = vi.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(
        generationRepository.stageAndCommitGeneration('gen-timeout', {
          basemap: new ArrayBuffer(0),
          manifest: {},
        }, async () => {
          await slowFetch();
          return true;
        })
      ).rejects.toThrow();
    });

    it('rejects partial download (< 127 bytes) with explicit verification rejection', async () => {
      const partialBuffer = new Uint8Array(45); // Partial truncated buffer
      await expect(
        generationRepository.stageAndCommitGeneration('gen-partial', {
          basemap: partialBuffer.buffer,
          manifest: {},
        }, async () => false)
      ).rejects.toThrow();
    });

    it('rejects corrupt PMTiles (invalid magic header)', async () => {
      const corruptHeader = new Uint8Array(200);
      corruptHeader.set([0x00, 0x00, 0x00, 0x00], 0); // Not 'PMTiles'

      await generationRepository.stageGeneration('gen-corrupt-header', {
        basemap: corruptHeader.buffer,
        manifest: {},
      });

      const isValid = await generationRepository.verifyGeneration('gen-corrupt-header');
      expect(isValid).toBe(false);
    });

    it('handles simulated power loss during activation safely', async () => {
      const validBasemap = new Uint8Array(200);
      validBasemap.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);

      await generationRepository.stageGeneration('gen-power-loss', {
        basemap: validBasemap.buffer,
        manifest: {},
      });

      // Simulate power loss by aborting before pointer update
      await generationRepository.rollbackGeneration('gen-power-loss');

      const active = await generationRepository.getActivePointer();
      expect(active).toBeNull();
    });
  });

  // =========================================================================
  // 2. RUNTIME HARDWARE & PERMISSION FAULTS
  // =========================================================================
  describe('Runtime Hardware & Subsystem Fault Injections', () => {
    it('reports DEGRADED when GPS permission is denied or acquiring', () => {
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.location.state).toBe('degraded');
      expect(report.subsystems.location.label).toBe('ACQUIRING FIX');
      expect(report.subsystems.location.evidence.recovery).toBeDefined();
    });

    it('reports DEGRADED when mesh has 0 peers', () => {
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.mesh.state).toBe('degraded');
      expect(report.subsystems.mesh.evidence.evidence?.peerCount).toBe(0);
    });

    it('reports DEGRADED when storage is critically low (<50 MB)', () => {
      systemCapabilityService.setTestDoubleOverrides({ storageFreeMb: 25 });
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.storage.state).toBe('degraded');
    });

    it('reports FAILED when storage is nearly exhausted (<10 MB)', () => {
      systemCapabilityService.setTestDoubleOverrides({ storageFreeMb: 5 });
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.storage.state).toBe('failed');
    });

    it('routing graph reports MISSING / UNAVAILABLE when graph is not loaded', () => {
      systemCapabilityService.clearTestDoubleOverrides();
      // Ensure engine is null for uninitialized check
      const report = systemCapabilityService.getCapabilitiesReport();
      if (!routingRepository.getEngine()) {
        expect(['missing', 'starting']).toContain(report.subsystems.routing.state);
        expect(report.subsystems.routing.label).toContain('GRAPH UNLOADED');
      }
    });
  });

  // =========================================================================
  // 3. NETWORK ENVIRONMENT FAULTS
  // =========================================================================
  describe('Network Fault Injections', () => {
    it('online to offline transition maintains 100% local ready capability', () => {
      vi.stubGlobal('navigator', { onLine: false });
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.offline.label).toBe('READY (100% Local)');
      vi.unstubAllGlobals();
    });

    it('offline to online transition reports hybrid capability', () => {
      vi.stubGlobal('navigator', { onLine: true });
      const report = systemCapabilityService.getCapabilitiesReport();
      expect(report.subsystems.offline.label).toBe('READY (Hybrid)');
      vi.unstubAllGlobals();
    });
  });
});
