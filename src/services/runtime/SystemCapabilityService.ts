/**
 * HÕIMU SystemCapabilityService — Central System Control Plane
 * Single source of truth for runtime capabilities and standardized subsystem health state.
 * Subsystems: Location, Map, Routing, Search, Mesh, Storage, Observations, Offline.
 * 
 * Truth principle: Observe, do not invent.
 * Subsystem metrics reflect real hardware, loaded data structures, and actual storage estimates.
 */

import { LocationManager } from '../location/LocationManager';
import { observationManager } from '../observation/ObservationManager';
import { routingRepository } from '../routing/routingRepository';
import { searchWorkerClient } from '../../features/search/searchWorkerClient';
import { useMeshStore } from '../../store/meshStore';
import { CapabilityEvidence } from '../capabilities/offlineCapabilityService';
import { EvidenceLevel, CapabilityReadiness, TruthFirewall } from '../../core/truth/truthFirewall';

export type HealthStatus = 'ready' | 'starting' | 'degraded' | 'failed' | 'missing' | 'unavailable' | 'unknown';

export interface SystemSubsystemCapability {
  id: 'location' | 'map' | 'routing' | 'search' | 'mesh' | 'storage' | 'observations' | 'offline';
  title: string;
  state: HealthStatus;
  status: HealthStatus;
  evidenceLevel?: EvidenceLevel;
  readiness?: CapabilityReadiness;
  evidence: CapabilityEvidence;
  updatedAt: number;
  source: string;
  error?: string;
  recovery?: string;
  label: string; // Live UI summary label
  details?: Record<string, any>;
}

export interface SystemCapabilitiesReport {
  timestamp: number;
  overallStatus: HealthStatus;
  subsystems: {
    location: SystemSubsystemCapability;
    map: SystemSubsystemCapability;
    routing: SystemSubsystemCapability;
    search: SystemSubsystemCapability;
    mesh: SystemSubsystemCapability;
    storage: SystemSubsystemCapability;
    observations: SystemSubsystemCapability;
    offline: SystemSubsystemCapability;
  };
}

export type CapabilityListener = (report: SystemCapabilitiesReport) => void;

export class SystemCapabilityService {
  private static instance: SystemCapabilityService | null = null;
  private listeners: Set<CapabilityListener> = new Set();
  
  // Test double overrides (strictly for unit test suites that inject test doubles)
  private testOverrides: Partial<Record<'peerCount' | 'storageFreeMb' | 'routingNodes' | 'routingEdges', number>> = {};

  private storageFreeMb: number | null = null;

  private constructor() {
    this.refreshStorageEstimate();
  }

  public static getInstance(): SystemCapabilityService {
    if (!SystemCapabilityService.instance) {
      SystemCapabilityService.instance = new SystemCapabilityService();
    }
    return SystemCapabilityService.instance;
  }

  public async refreshStorageEstimate(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) {
          const usage = est.usage || 0;
          this.storageFreeMb = Math.round((est.quota - usage) / (1024 * 1024));
        }
      } catch {
        // Leave as is
      }
    }
  }

  public setTestDoubleOverrides(overrides: Partial<Record<'peerCount' | 'storageFreeMb' | 'routingNodes' | 'routingEdges', number>>): void {
    this.testOverrides = { ...this.testOverrides, ...overrides };
    this.notifyListeners();
  }

  public setMockPeerCount(count: number): void {
    this.setTestDoubleOverrides({ peerCount: count });
  }

  public clearTestDoubleOverrides(): void {
    this.testOverrides = {};
    this.notifyListeners();
  }

  public getCapabilitiesReport(): SystemCapabilitiesReport {
    const now = Date.now();

    // 1. Location Subsystem
    const locationState = LocationManager.getInstance().getState();
    const locAccuracy = locationState.activeFix?.accuracyMeters;
    const locIsLive = locationState.isLive;
    const locStatus: HealthStatus = locIsLive ? 'ready' : 'degraded';
    const locationCapability: SystemSubsystemCapability = {
      id: 'location',
      title: 'Location',
      state: locStatus,
      status: locStatus,
      updatedAt: locationState.activeFix?.timestamp || now,
      source: locationState.activeProvider || 'LocationManager',
      label: locIsLive ? `LIVE ±${Math.round(locAccuracy || 0)}m` : 'ACQUIRING FIX',
      evidence: {
        state: locStatus === 'ready' ? 'ready' : 'partial',
        checkedAt: now,
        source: locationState.activeProvider || 'LocationManager',
        evidence: {
          lastFixAt: locationState.activeFix?.timestamp,
          recordCount: locIsLive ? 1 : 0,
          accuracyMeters: locAccuracy,
        },
        recovery: locIsLive ? undefined : 'Enable GPS and verify line-of-sight to sky',
      },
      details: { accuracyMeters: locAccuracy, provider: locationState.activeProvider },
    };

    // 2. Map Subsystem (Observed from GenerationRepository with Truth Firewall enforcement)
    const activePointer = typeof localStorage !== 'undefined' ? localStorage.getItem('hoimu_map_active_generation_pointer') : null;
    const rawMeta = activePointer && typeof localStorage !== 'undefined' ? localStorage.getItem(`hoimu_generation_${activePointer}_meta`) : null;
    const mapEval = TruthFirewall.evaluateGenerationIntegrity(activePointer, rawMeta);
    const mapReady = mapEval.readiness === 'READY';
    const mapGenId = mapEval.data?.generationId;
    const mapArtifactSha = mapEval.data?.artifactSha256;

    const mapCapability: SystemSubsystemCapability = {
      id: 'map',
      title: 'Map',
      state: mapReady ? 'ready' : 'missing',
      status: mapReady ? 'ready' : 'missing',
      evidenceLevel: mapEval.level,
      readiness: mapEval.readiness,
      updatedAt: now,
      source: 'GenerationRepository',
      label: mapReady ? `READY (${mapGenId})` : 'MAP NOT VERIFIED',
      evidence: {
        state: mapReady ? 'ready' : 'missing',
        checkedAt: now,
        source: 'GenerationRepository',
        evidence: {
          generationId: mapGenId,
          artifactSha256: mapArtifactSha,
          evidenceLevel: mapEval.level,
        },
      },
      details: { format: 'pmtiles', layers: ['basemap', 'poi'], generationId: mapGenId },
    };

    // 3. Routing Subsystem (Observed strictly from loaded RoutingEngine or 0)
    const engine = routingRepository.getEngine();
    const routingNodes = this.testOverrides.routingNodes ?? (engine ? engine.getNodeCount() : 0);
    const routingEdges = this.testOverrides.routingEdges ?? (engine ? engine.getEdgeCount() : 0);
    const routingEval = TruthFirewall.evaluateRoutingGraph(Boolean(engine || routingNodes > 0), routingNodes, routingEdges);
    const routingReady = routingEval.readiness === 'READY';
    const routingStatus: HealthStatus = routingReady ? 'ready' : (engine ? 'starting' : 'missing');
    const routingCapability: SystemSubsystemCapability = {
      id: 'routing',
      title: 'Routing',
      state: routingStatus,
      status: routingStatus,
      evidenceLevel: routingEval.level,
      readiness: routingEval.readiness,
      updatedAt: now,
      source: 'RoutingRepository',
      label: routingReady ? `READY (${routingNodes} nodes, ${routingEdges} edges)` : 'GRAPH UNLOADED',
      evidence: {
        state: routingReady ? 'ready' : 'missing',
        checkedAt: now,
        source: 'RoutingRepository',
        evidence: {
          recordCount: routingNodes,
          edgeCount: routingEdges,
          evidenceLevel: routingEval.level,
        },
        error: routingReady ? undefined : 'No active pedestrian routing graph in memory',
        recovery: routingReady ? undefined : 'Install or load regional routing graph pack',
      },
      details: { nodes: routingNodes, edges: routingEdges, engine: 'AStarMinHeap' },
    };

    // 4. Search Subsystem (Observed from SearchWorker)
    const searchReady = searchWorkerClient.isReady();
    const searchStatus: HealthStatus = searchReady ? 'ready' : 'starting';
    const searchCapability: SystemSubsystemCapability = {
      id: 'search',
      title: 'Search',
      state: searchStatus,
      status: searchStatus,
      updatedAt: now,
      source: 'SearchWorkerClient',
      label: searchReady ? 'READY (<50ms Worker)' : 'INITIALIZING',
      evidence: {
        state: searchReady ? 'ready' : 'partial',
        checkedAt: now,
        source: 'SearchWorkerClient',
      },
      details: { worker: true, rankMode: 'MultiToken' },
    };

    // 5. Mesh Subsystem (Observed from live connected peers)
    const realPeers = useMeshStore.getState().getPeersArray();
    const peerCount = this.testOverrides.peerCount ?? realPeers.length;
    const meshStatus: HealthStatus = peerCount > 0 ? 'ready' : 'degraded';
    const meshCapability: SystemSubsystemCapability = {
      id: 'mesh',
      title: 'Mesh',
      state: meshStatus,
      status: meshStatus,
      updatedAt: now,
      source: 'MeshTransportManager',
      label: peerCount > 0 ? `${peerCount} peer${peerCount === 1 ? '' : 's'}` : 'TRANSPORT READY (0 peers)',
      evidence: {
        state: peerCount > 0 ? 'ready' : 'partial',
        checkedAt: now,
        source: 'MeshTransportManager',
        evidence: {
          peerCount,
        },
        recovery: peerCount === 0 ? 'Searching for nearby BLE / LoRa peers' : undefined,
      },
      details: { peersCount: peerCount, transports: ['ble', 'broadcastChannel'] },
    };

    // 6. Storage Subsystem (Observed from navigator.storage or test double)
    const freeMb = this.testOverrides.storageFreeMb ?? this.storageFreeMb;
    const storageStatus: HealthStatus =
      freeMb === null ? 'unknown' : freeMb > 50 ? 'ready' : (freeMb > 10 ? 'degraded' : 'failed');
    const storageCapability: SystemSubsystemCapability = {
      id: 'storage',
      title: 'Storage',
      state: storageStatus,
      status: storageStatus,
      updatedAt: now,
      source: 'StorageEngine',
      label: freeMb === null ? 'STORAGE UNKNOWN' : `${freeMb} MB free`,
      evidence: {
        state: storageStatus === 'ready' ? 'ready' : (storageStatus === 'degraded' ? 'partial' : (storageStatus === 'failed' ? 'corrupt' : 'unknown')),
        checkedAt: now,
        source: 'StorageEngine',
        evidence: {
          fileSize: freeMb === null ? undefined : freeMb * 1024 * 1024,
        },
      },
      details: { freeMb, engine: 'OPFS/Filesystem' },
    };

    // 7. Observations Subsystem (Observed from ObservationManager)
    const obsCount = observationManager.getAllObservations().length;
    const obsCapability: SystemSubsystemCapability = {
      id: 'observations',
      title: 'Observation',
      state: 'ready',
      status: 'ready',
      updatedAt: now,
      source: 'ObservationManager',
      label: `${obsCount} signals`,
      evidence: {
        state: 'ready',
        checkedAt: now,
        source: 'ObservationManager',
        evidence: {
          recordCount: obsCount,
        },
      },
      details: { historyCount: obsCount },
    };

    // 8. Offline Subsystem (Evaluated through Truth Firewall)
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const offlineEval = TruthFirewall.evaluateOfflineReadiness(
      isOnline,
      mapCapability.state === 'ready',
      routingCapability.state === 'ready',
      searchCapability.state === 'ready'
    );
    const localDataReady = Boolean(offlineEval.data?.localDataReady);
    const offlineState: HealthStatus = offlineEval.readiness === 'READY' ? 'ready' : 'degraded';
    const offlineCapability: SystemSubsystemCapability = {
      id: 'offline',
      title: 'Offline',
      state: offlineState,
      status: offlineState,
      evidenceLevel: offlineEval.level,
      readiness: offlineEval.readiness,
      updatedAt: now,
      source: 'NetworkMonitor + local capability evidence',
      label: isOnline
        ? (localDataReady ? 'READY (Hybrid)' : 'LOCAL CAPABILITIES INCOMPLETE')
        : (localDataReady ? 'READY (100% Local)' : 'OFFLINE BUT LOCAL DATA INCOMPLETE'),
      evidence: {
        state: offlineState === 'ready' ? 'ready' : 'partial',
        checkedAt: now,
        source: 'NetworkMonitor + local capability evidence',
        evidence: {
          isOnline,
          mapReady: mapCapability.state === 'ready',
          routingReady: routingCapability.state === 'ready',
          searchReady: searchCapability.state === 'ready',
          evidenceLevel: offlineEval.level,
        },
        recovery: localDataReady ? undefined : 'Install and verify the local map, routing, and search artifacts',
      },
      details: { isOnline, localDataReady },
    };

    const subsystems = {
      location: locationCapability,
      map: mapCapability,
      routing: routingCapability,
      search: searchCapability,
      mesh: meshCapability,
      storage: storageCapability,
      observations: obsCapability,
      offline: offlineCapability,
    };

    const states = Object.values(subsystems).map((s) => s.state);
    const overallStatus: HealthStatus = states.includes('failed')
      ? 'failed'
      : (states.includes('degraded') || states.includes('missing') || states.includes('unavailable'))
      ? 'degraded'
      : (states.includes('starting') ? 'starting' : 'ready');

    return {
      timestamp: now,
      overallStatus,
      subsystems,
    };
  }

  public subscribe(listener: CapabilityListener): () => void {
    this.listeners.add(listener);
    listener(this.getCapabilitiesReport());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const report = this.getCapabilitiesReport();
    this.listeners.forEach((fn) => {
      try {
        fn(report);
      } catch (err) {
        console.error('[SystemCapabilityService] Listener error:', err);
      }
    });
  }
}

export const systemCapabilityService = SystemCapabilityService.getInstance();
