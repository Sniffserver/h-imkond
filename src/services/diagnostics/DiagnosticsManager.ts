/**
 * HÕIMU First-Class Diagnostics Subsystem
 * Reports status, last update, source, error, and recovery actions for all core subsystems:
 * App, Map, Location, Routing, Mesh, Storage, Data, Performance.
 */

import { systemCapabilityService } from '../runtime/SystemCapabilityService';
import { LocationManager } from '../location/LocationManager';
import { performanceBudgetManager } from '../runtime/performanceBudgetManager';

export type SubsystemStatus = 'ready' | 'starting' | 'degraded' | 'failed' | 'missing' | 'unavailable' | 'unknown';

export interface SubsystemDiagnosticsRecord {
  subsystemId: 'app' | 'map' | 'location' | 'routing' | 'mesh' | 'storage' | 'data' | 'performance';
  title: string;
  status: SubsystemStatus;
  lastUpdateIso: string;
  source: string;
  error?: string;
  recoveryAction?: {
    label: string;
    description: string;
    actionType: 'reload' | 'repair_map' | 'request_permission' | 'clear_cache' | 'switch_provider';
  };
  metrics?: Record<string, string | number | boolean>;
}

export interface SystemDiagnosticsReport {
  timestamp: string;
  overallStatus: SubsystemStatus;
  subsystems: Record<string, SubsystemDiagnosticsRecord>;
}

export type DiagnosticsListener = (report: SystemDiagnosticsReport) => void;

export class DiagnosticsManager {
  private static instance: DiagnosticsManager | null = null;
  private listeners: Set<DiagnosticsListener> = new Set();

  public static getInstance(): DiagnosticsManager {
    if (!DiagnosticsManager.instance) {
      DiagnosticsManager.instance = new DiagnosticsManager();
    }
    return DiagnosticsManager.instance;
  }

  public getFullDiagnosticsReport(): SystemDiagnosticsReport {
    const caps = systemCapabilityService.getCapabilitiesReport();
    const nowIso = new Date().toISOString();
    const locState = LocationManager.getInstance().getState();
    const perfHistory = performanceBudgetManager.getHistory();

    const app: SubsystemDiagnosticsRecord = {
      subsystemId: 'app',
      title: 'App Lifecycle & PWA',
      status: 'ready',
      lastUpdateIso: nowIso,
      source: 'HoimuRuntime / ServiceWorker',
      metrics: {
        environment: 'PWA / Vite',
        serviceWorkerRegistered: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      },
    };

    const map: SubsystemDiagnosticsRecord = {
      subsystemId: 'map',
      title: 'Vector Basemap Engine',
      status: caps.subsystems.map.status,
      lastUpdateIso: nowIso,
      source: 'MapPackService / PMTiles v3',
      metrics: {
        format: 'PMTiles v3 Vector',
        layers: 'Basemap, POI, Bounding Box',
      },
      recoveryAction: caps.subsystems.map.status === 'failed' ? {
        label: 'Repair map pack',
        description: 'Download and re-verify primary map pack generation',
        actionType: 'repair_map',
      } : undefined,
    };

    const location: SubsystemDiagnosticsRecord = {
      subsystemId: 'location',
      title: 'GPS & Spatial Position',
      status: locState.isLive ? 'ready' : 'degraded',
      lastUpdateIso: nowIso,
      source: `LocationManager (${locState.activeProvider})`,
      error: !locState.isLive ? 'GPS unavailable or acquiring fix. Routes use map center.' : undefined,
      recoveryAction: !locState.isLive ? {
        label: 'Enable location',
        description: 'Grant location permission or switch to GNSS / Mesh provider',
        actionType: 'request_permission',
      } : undefined,
      metrics: {
        provider: locState.activeProvider,
        accuracyMeters: locState.activeFix?.accuracyMeters || 'N/A',
      },
    };

    const routing: SubsystemDiagnosticsRecord = {
      subsystemId: 'routing',
      title: 'Offline Routing Engine',
      status: caps.subsystems.routing.status,
      lastUpdateIso: nowIso,
      source: 'RoutingEngine / AStarMinHeap',
      metrics: {
        topologyNodes: caps.subsystems.routing.details?.nodes ?? 0,
        topologyEdges: caps.subsystems.routing.details?.edges ?? 0,
        engine: 'Contiguous ArrayBuffer Graph',
      },
      recoveryAction: caps.subsystems.routing.status === 'failed' ? {
        label: 'Re-index graph',
        description: 'Reload routing graph from local storage',
        actionType: 'clear_cache',
      } : undefined,
    };

    const mesh: SubsystemDiagnosticsRecord = {
      subsystemId: 'mesh',
      title: 'Mesh Radio Transport',
      status: caps.subsystems.mesh.status,
      lastUpdateIso: nowIso,
      source: 'MeshTransportManager (BLE / BroadcastChannel)',
      metrics: {
        activePeers: caps.subsystems.mesh.details?.peersCount ?? 0,
        transports: 'BLE, BroadcastChannel, LoRa Bridge',
      },
    };

    const storage: SubsystemDiagnosticsRecord = {
      subsystemId: 'storage',
      title: 'Artifact Storage & OPFS',
      status: caps.subsystems.storage.status,
      lastUpdateIso: nowIso,
      source: 'MapPackStorageEngine (OPFS / Capacitor)',
      metrics: {
        freeMb: caps.subsystems.storage.details?.freeMb ?? 0,
        storageType: 'OPFS / Capacitor Native Filesystem',
      },
    };

    const data: SubsystemDiagnosticsRecord = {
      subsystemId: 'data',
      title: 'Map Data & Provenance',
      status: 'ready',
      lastUpdateIso: nowIso,
      source: 'MapRepository / Canonical Dataset',
      metrics: {
        provenanceSources: 'OSM + Tallinn Open Data + Päästeamet + ADS',
      },
    };

    const performanceRecord: SubsystemDiagnosticsRecord = {
      subsystemId: 'performance',
      title: 'Runtime Performance Budgets',
      status: 'ready',
      lastUpdateIso: nowIso,
      source: 'PerformanceBudgetManager',
      metrics: {
        totalLoggedMetrics: perfHistory.length,
        searchTargetMs: 50,
        routeTargetMs: 200,
      },
    };

    const subsystems = { app, map, location, routing, mesh, storage, data, performance: performanceRecord };
    const statuses = Object.values(subsystems).map((s) => s.status);
    const overallStatus: SubsystemStatus = statuses.includes('failed')
      ? 'failed'
      : statuses.includes('degraded')
      ? 'degraded'
      : 'ready';

    return {
      timestamp: nowIso,
      overallStatus,
      subsystems,
    };
  }

  public subscribe(listener: DiagnosticsListener): () => void {
    this.listeners.add(listener);
    listener(this.getFullDiagnosticsReport());
    return () => this.listeners.delete(listener);
  }
}

export const diagnosticsManager = DiagnosticsManager.getInstance();
