import { describe, it, expect, beforeEach } from 'vitest';
import { systemCapabilityService } from '../services/runtime/SystemCapabilityService';
import { useMeshStore } from '../store/meshStore';
import { routingRepository } from '../services/routing/routingRepository';

describe('Phase 7 — Truthful System Capability Control Plane (No Synthetic Runtime Inventions)', () => {
  beforeEach(() => {
    localStorage.clear();
    systemCapabilityService.clearTestDoubleOverrides();
    useMeshStore.setState({
      peers: new Map(),
      bridgePeers: new Map(),
    });
  });

  it('1. Reports true 0 peers when mesh is empty, without hardcoded fallback', () => {
    const report = systemCapabilityService.getCapabilitiesReport();
    
    // In production with 0 peers, mesh must reflect 0 peers
    expect(report.subsystems.mesh.details?.peersCount).toBe(0);
    expect(report.subsystems.mesh.label).toContain('0 peers');
    expect(report.subsystems.mesh.evidence.evidence?.peerCount).toBe(0);
    expect(report.subsystems.mesh.state).toBe('degraded');
  });

  it('2. Exposes CapabilityEvidence structure on all subsystems', () => {
    const report = systemCapabilityService.getCapabilitiesReport();

    const subsystems = Object.values(report.subsystems);
    expect(subsystems.length).toBe(8);

    subsystems.forEach(sub => {
      expect(sub.id).toBeDefined();
      expect(sub.state).toBeDefined();
      expect(sub.updatedAt).toBeGreaterThan(0);
      expect(sub.source).toBeDefined();
      expect(sub.evidence).toBeDefined();
      expect(sub.evidence.state).toBeDefined();
      expect(sub.evidence.checkedAt).toBeGreaterThan(0);
      expect(sub.evidence.source).toBeDefined();
    });
  });

  it('3. Injects test doubles explicitly via test double hooks without polluting production runtime', () => {
    systemCapabilityService.setTestDoubleOverrides({
      peerCount: 5,
      storageFreeMb: 450,
      routingNodes: 412831,
      routingEdges: 891220,
    });

    const report = systemCapabilityService.getCapabilitiesReport();
    expect(report.subsystems.mesh.evidence.evidence?.peerCount).toBe(5);
    expect(report.subsystems.storage.details?.freeMb).toBe(450);
    expect(report.subsystems.routing.details?.nodes).toBe(412831);
    expect(report.subsystems.routing.details?.edges).toBe(891220);
    expect(report.subsystems.routing.state).toBe('ready');

    // Clearing returns to true underlying state
    systemCapabilityService.clearTestDoubleOverrides();
    const cleanReport = systemCapabilityService.getCapabilitiesReport();
    expect(cleanReport.subsystems.mesh.evidence.evidence?.peerCount).toBe(0);
  });
});
