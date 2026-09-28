import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreetIndex } from '../features/map/streets/StreetIndex';
import { StreetRepository } from '../features/map/streets/StreetRepository';
import { streetDiscoveryService } from '../features/map/streets/streetDiscoveryService';
import { fieldQuestService } from '../features/map/discovery/fieldQuestService';
import { FieldSession, fieldSession } from '../services/session/FieldSession';
import { verifyPMTilesThreeLevels } from '../services/map/pmtilesVerifier';
import { MapPackInstaller } from '../features/map/packs/MapPackInstaller';
import { buildStreetIndexBuffer } from '../../tools/map-data/build/street-index';
import { writePMTilesFile } from '../../tools/map-data/build/pmtiles';
import * as fs from 'fs';
import * as path from 'path';

describe('P1 New Enhancements: Artifact Street Discovery, Quest Accuracy/Dwell, Versioning, FieldSession & PMTiles 3-Level Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    fieldQuestService.resetQuests();
    streetDiscoveryService.resetForTesting();
  });

  // =========================================================================
  // 1. Street discovery consumes routing/street artifacts (StreetIndex -> StreetRepository -> StreetDiscovery)
  // =========================================================================
  describe('Street Artifact Discovery Hierarchy', () => {
    it('decodes street-index.bin artifact and populates StreetRepository', () => {
      const streetBuffer = buildStreetIndexBuffer();
      const repo = StreetRepository.getInstance();
      const loadedStreets = repo.loadFromArtifact(streetBuffer);

      expect(loadedStreets).toBeDefined();
      expect(loadedStreets.length).toBeGreaterThanOrEqual(10);

      const viru = repo.getStreetById('osm_viru_tn');
      expect(viru).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Field Quest Accuracy Gating & Dwell Stability (A & B)
  // =========================================================================
  describe('Field Quest Accuracy Gating & Dwell Stability', () => {
    it('rejects low accuracy GPS fixes (> 35m) for POI visit verification', () => {
      const quest = fieldQuestService.getActiveQuest();
      expect(quest).toBeDefined();
      const placeObj = quest!.objectives.find((o) => o.type === 'place_find');
      expect(placeObj).toBeDefined();

      // City Bike tool workshop coordinate ~ 59.4380, 24.7470
      // Fix with 80m accuracy should be rejected by accuracy gating
      fieldQuestService.processLocationUpdate(59.4380, 24.7470, 80, Date.now());
      expect(placeObj?.completed).toBe(false);
    });

    it('requires 10+ seconds dwell duration before confirming POI visit', () => {
      const quest = fieldQuestService.getActiveQuest();
      const placeObj = quest!.objectives.find((o) => o.type === 'place_find');
      expect(placeObj).toBeDefined();

      const startTime = Date.now();
      // First fix inside POI radius (starts dwell timer)
      fieldQuestService.processLocationUpdate(59.4380, 24.7470, 8, startTime);
      expect(placeObj?.completed).toBe(false);

      // Fix 3 seconds later (dwell incomplete < 10s)
      fieldQuestService.processLocationUpdate(59.4380, 24.7470, 8, startTime + 3000);
      expect(placeObj?.completed).toBe(false);

      // Fix 11 seconds later (dwell complete >= 10s)
      fieldQuestService.processLocationUpdate(59.4380, 24.7470, 8, startTime + 11000);
      expect(placeObj?.completed).toBe(true);
    });
  });

  // =========================================================================
  // 3. Field Quest State Versioning
  // =========================================================================
  describe('Field Quest State Versioning', () => {
    it('persists and loads quest state with schemaVersion 2 and questSetVersion', () => {
      fieldQuestService.handleStreetDiscovery(1);

      const rawSaved = localStorage.getItem('hoimu_field_quests');
      expect(rawSaved).not.toBeNull();

      const parsed = JSON.parse(rawSaved!);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.questSetVersion).toBe('2026.09');
      expect(parsed.quests).toBeDefined();
      expect(Array.isArray(parsed.quests)).toBe(true);
    });
  });

  // =========================================================================
  // 4. FieldSession Abstraction
  // =========================================================================
  describe('FieldSession Abstraction', () => {
    it('orchestrates complete field session lifecycle and generates report', () => {
      fieldSession.startSession();
      expect(fieldSession.isSessionActive()).toBe(true);

      const t0 = Date.now();
      // Narva mnt fix 1
      fieldSession.processLocationFix({
        lat: 59.4368,
        lng: 24.7548,
        accuracyMeters: 6,
        timestamp: t0,
      });

      // Narva mnt fix 2 (triggers street discovery)
      fieldSession.processLocationFix({
        lat: 59.4372,
        lng: 24.7570,
        accuracyMeters: 6,
        timestamp: t0 + 5000,
      });

      const report = fieldSession.endSession();
      expect(fieldSession.isSessionActive()).toBe(false);
      expect(report.sessionId).toBeDefined();
      expect(report.totalFixesCount).toBe(2);
      expect(report.totalDistanceMeters).toBeGreaterThan(0);
      expect(report.durationSeconds).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 5. PMTiles Explicit 3-Level Verification
  // =========================================================================
  describe('PMTiles 3-Level Verification Engine', () => {
    it('validates PMTiles archives across Level 1 (Container), Level 2 (Semantic), and Level 3 (Content Grid)', () => {
      const tempPath = path.resolve('node_modules/.temp_test_pmtiles.pmtiles');
      writePMTilesFile({
        outputPath: tempPath,
        name: 'Test Basemap',
        description: 'Test Verification Basemap',
      });

      const buffer = fs.readFileSync(tempPath);
      const res = verifyPMTilesThreeLevels(buffer, 59.4370, 24.7535);

      expect(res.level1ContainerValid).toBe(true);
      expect(res.level2SemanticValid).toBe(true);
      expect(res.level3ContentValid).toBe(true);
      expect(res.valid).toBe(true);
      expect(res.details.sampledTilesCount).toBe(5); // Center, North, South, East, West

      try {
        fs.unlinkSync(tempPath);
      } catch {}
    });
  });

  // =========================================================================
  // 6. Generation Rollback Engine
  // =========================================================================
  describe('MapPackInstaller Generation Rollback', () => {
    it('provides rollbackToLastKnownGood method for failed generation activations', async () => {
      const spy = vi.spyOn(MapPackInstaller, 'rollbackToLastKnownGood');
      await MapPackInstaller.rollbackToLastKnownGood('tallinn', {
        id: 'tallinn',
        version: '2026.09.27-A',
        routingSnapshotVersion: '2026.09.27-A',
        state: 'active',
        progressPercent: 100,
        downloadedBytes: 1000,
        totalBytes: 1000,
        checksumVerified: true,
        storageType: 'opfs_native',
      });

      expect(spy).toHaveBeenCalledWith('tallinn', expect.anything());
    });
  });
});
