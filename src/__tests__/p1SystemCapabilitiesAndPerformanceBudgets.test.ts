import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyPMTilesArchiveDeep } from '../../tools/map-data/verify-maps';
import { systemCapabilityService, SystemCapabilityService } from '../services/runtime/SystemCapabilityService';
import { performanceBudgetManager, PerformanceBudgetManager } from '../services/runtime/performanceBudgetManager';
import { MapQualityManager, MODE_CONFIGS } from '../features/map/qualityManager';
import * as fs from 'fs';
import * as path from 'path';

describe('P1 System Capabilities, Subsystem Health & Performance Budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    systemCapabilityService.setTestDoubleOverrides({
      peerCount: 2,
      routingNodes: 120,
      routingEdges: 240,
    });
  });

  // =========================================================================
  // Task 29: Async PMTiles Deep Verification (No Fake Sync Wrapper)
  // =========================================================================
  describe('Task 29: Async PMTiles Deep Verification API', () => {
    it('executes async verifyPMTilesArchiveDeep directly and returns verification status', async () => {
      const generatedBasemap = path.join(process.cwd(), 'src', 'data', 'generated', 'tallinn-basemap.pmtiles');
      expect(fs.existsSync(generatedBasemap)).toBe(true);

      const res = await verifyPMTilesArchiveDeep(generatedBasemap, false);
      expect(res.valid).toBe(true);
      expect(res.details).toContain('3-Level Verification Passed');
    });
  });

  // =========================================================================
  // Task 30 & 31: SystemCapabilityService & Subsystem Health States
  // =========================================================================
  describe('Task 30 & 31: SystemCapabilityService Central Control Plane', () => {
    it('exposes standardized subsystem health states (Location, Map, Routing, Search, Mesh, Storage, Observations, Offline)', () => {
      const report = systemCapabilityService.getCapabilitiesReport();

      expect(report.timestamp).toBeGreaterThan(0);
      expect(['ready', 'starting', 'degraded', 'failed']).toContain(report.overallStatus);

      const { location, map, routing, search, mesh, storage, observations, offline } = report.subsystems;

      expect(location.id).toBe('location');
      expect(location.label === 'ACQUIRING FIX' || location.label.includes('±')).toBe(true);

      expect(map.id).toBe('map');
      expect(map.status).toBe('ready');

      expect(routing.id).toBe('routing');
      expect(routing.status).toBe('ready');

      expect(search.id).toBe('search');
      expect(['ready', 'starting']).toContain(search.status);

      expect(mesh.id).toBe('mesh');
      expect(mesh.label).toContain('peers');

      expect(storage.id).toBe('storage');
      expect(storage.label).toContain('MB free');

      expect(observations.id).toBe('observations');
      expect(observations.label).toContain('signals');

      expect(offline.id).toBe('offline');
      expect(offline.label).toContain('READY');
    });

    it('notifies subscribers reactively on capability updates', () => {
      let receivedReport: any = null;
      const unsubscribe = systemCapabilityService.subscribe((report) => {
        receivedReport = report;
      });

      expect(receivedReport).not.toBeNull();
      expect(receivedReport.subsystems.mesh.label).toBe('2 peers');

      systemCapabilityService.setMockPeerCount(5);
      expect(receivedReport.subsystems.mesh.label).toBe('5 peers');

      unsubscribe();
    });
  });

  // =========================================================================
  // Task 32: Performance Budget Manager
  // =========================================================================
  describe('Task 32: Performance Budget Manager', () => {
    it('records performance metrics and validates against target budgets', () => {
      const rec1 = performanceBudgetManager.recordMetric('searchLatencyMs', 35);
      expect(rec1.withinBudget).toBe(true);
      expect(rec1.budgetLimit).toBe(50);

      const rec2 = performanceBudgetManager.recordMetric('initialAppUiMs', 2100);
      expect(rec2.withinBudget).toBe(false);
      expect(rec2.budgetLimit).toBe(1500);

      const history = performanceBudgetManager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Task 33: Low-End Device / Field Mode Quality Manager
  // =========================================================================
  describe('Task 33: Map Quality Manager FIELD Mode & Presets', () => {
    it('defines FIELD mode configuration with simplified labels, low animation, reduced POI density', () => {
      const fieldConfig = MODE_CONFIGS['FIELD'];
      expect(fieldConfig).toBeDefined();
      expect(fieldConfig.simplifiedLabels).toBe(true);
      expect(fieldConfig.lowAnimation).toBe(true);
      expect(fieldConfig.reducedPoiDensity).toBe(true);
      expect(fieldConfig.reducedSignalRedraw).toBe(true);
      expect(fieldConfig.reducedShadows).toBe(true);
    });

    it('allows setting quality mode to FIELD manually or automatically', () => {
      const manager = new MapQualityManager();
      manager.setQualityMode('FIELD', true);
      expect(manager.getQualityMode()).toBe('FIELD');

      manager.setQualityMode('FULL', true);
      expect(manager.getQualityMode()).toBe('FULL');

      manager.destroy();
    });
  });
});
