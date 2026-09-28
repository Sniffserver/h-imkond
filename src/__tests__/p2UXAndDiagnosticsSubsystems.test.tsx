import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { diagnosticsManager } from '../services/diagnostics/DiagnosticsManager';
import { UserStateExplanationBanner } from '../components/UserStateExplanationBanner';

describe('P2 Sprints: UX Refinements, Diagnostics & User State Explanations', () => {
  // =========================================================================
  // Sprint 7 & 9: Diagnostics Subsystem Health & Data Integrity
  // =========================================================================
  describe('Diagnostics Subsystem', () => {
    it('aggregates status and metrics correctly across all 8 subsystems', () => {
      const report = diagnosticsManager.getFullDiagnosticsReport();

      expect(report.overallStatus).toBeDefined();
      expect(report.subsystems.app).toBeDefined();
      expect(report.subsystems.map).toBeDefined();
      expect(report.subsystems.location).toBeDefined();
      expect(report.subsystems.routing).toBeDefined();
      expect(report.subsystems.mesh).toBeDefined();
      expect(report.subsystems.storage).toBeDefined();
      expect(report.subsystems.data).toBeDefined();
      expect(report.subsystems.performance).toBeDefined();

      expect(report.subsystems.app.status).toBe('ready');
      expect(report.subsystems.map.source).toBe('MapPackService / PMTiles v3');
      expect(report.subsystems.routing.title).toBe('Offline Routing Engine');
    });
  });

  // =========================================================================
  // Sprint 7 & 35: Actionable "Why" Explanations
  // =========================================================================
  describe('UserStateExplanationBanner component', () => {
    it('explains why route fails and offers a directional bypass', () => {
      render(
        <UserStateExplanationBanner
          type="route_failed"
          onShowDirection={() => {}}
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText("Offline street routing isn't ready yet.")).toBeDefined();
      expect(screen.getByText("Show direction")).toBeDefined();
    });

    it('explains why location is unavailable and offers an enablement action', () => {
      render(
        <UserStateExplanationBanner
          type="location_unavailable"
          onEnableLocation={() => {}}
        />
      );

      expect(screen.getByText("GPS unavailable")).toBeDefined();
      expect(screen.getByText("Enable location")).toBeDefined();
    });

    it('explains why map pack is corrupt and offers repair action', () => {
      render(
        <UserStateExplanationBanner
          type="map_pack_corrupt"
          onRepairMapPack={() => {}}
        />
      );

      expect(screen.getByText("Map pack damaged")).toBeDefined();
      expect(screen.getByText("Repair")).toBeDefined();
    });
  });
});
