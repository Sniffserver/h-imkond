/**
 * HÕIMU Formal Truth Firewall Architecture
 * 
 * Enforces strict boundary verification between empirical runtime evidence
 * and reported capability states across all system layers.
 * 
 * Core Invariant:
 * OBSERVED / DERIVED   ──> may contribute to READY
 * ESTIMATED            ──> may contribute only to DEGRADED / ESTIMATED
 * SIMULATED / FIXTURE  ──> test/demo only; never production READY
 * UNAVAILABLE / FAILED ──> never become READY
 */

export type EvidenceLevel =
  | 'OBSERVED'
  | 'DERIVED'
  | 'ESTIMATED'
  | 'SIMULATED'
  | 'FIXTURE'
  | 'UNAVAILABLE'
  | 'FAILED';

export type CapabilityReadiness =
  | 'READY'
  | 'DEGRADED'
  | 'MISSING'
  | 'UNAVAILABLE'
  | 'FAILED';

export interface EvidenceRecord<T = any> {
  level: EvidenceLevel;
  readiness: CapabilityReadiness;
  source: string;
  checkedAt: number;
  data?: T;
  provenanceProof?: string;
  error?: string;
  recovery?: string;
}

export class TruthFirewall {
  /**
   * Filters and enforces truth boundary constraints on capability readiness.
   * Prevents synthetic or estimated evidence from escalating to READY.
   */
  public static filterReadiness(level: EvidenceLevel, targetReadiness: CapabilityReadiness): CapabilityReadiness {
    switch (level) {
      case 'FAILED':
        return 'FAILED';
      case 'UNAVAILABLE':
        return 'UNAVAILABLE';
      case 'FIXTURE':
      case 'SIMULATED':
        // Test fixtures and simulation values are never certified as production READY
        return 'DEGRADED';
      case 'ESTIMATED':
        // Telemetry estimates can at most certify DEGRADED capability
        return targetReadiness === 'READY' ? 'DEGRADED' : targetReadiness;
      case 'OBSERVED':
      case 'DERIVED':
        // Strictly empirical hardware observations or verified cryptographic derivations
        return targetReadiness;
      default:
        return 'UNAVAILABLE';
    }
  }

  /**
   * Evaluates offline readiness:
   * navigator.onLine === false ≠ offline map works
   */
  public static evaluateOfflineReadiness(
    isOnline: boolean,
    mapReady: boolean,
    routingReady: boolean,
    searchReady: boolean
  ): EvidenceRecord<{ isOnline: boolean; localDataReady: boolean }> {
    const localDataReady = mapReady && routingReady && searchReady;
    const now = Date.now();

    if (!localDataReady) {
      return {
        level: 'OBSERVED',
        readiness: 'DEGRADED',
        source: 'TruthFirewall.OfflineEvaluator',
        checkedAt: now,
        data: { isOnline, localDataReady },
        error: 'Local map, routing, or search data structures are missing or incomplete',
        recovery: 'Install and verify the local map generation pack',
      };
    }

    return {
      level: 'OBSERVED',
      readiness: 'READY',
      source: 'TruthFirewall.OfflineEvaluator',
      checkedAt: now,
      data: { isOnline, localDataReady },
    };
  }

  /**
   * Evaluates active generation pointer validity:
   * activeGeneration pointer exists ≠ generation is valid
   */
  public static evaluateGenerationIntegrity(
    activePointer: string | null,
    generationMetaJson: string | null
  ): EvidenceRecord<{ generationId?: string; artifactSha256?: string }> {
    const now = Date.now();

    if (!activePointer) {
      return {
        level: 'UNAVAILABLE',
        readiness: 'MISSING',
        source: 'TruthFirewall.GenerationEvaluator',
        checkedAt: now,
        error: 'No active generation pointer configured in storage',
        recovery: 'Select and download a regional map package',
      };
    }

    if (!generationMetaJson) {
      return {
        level: 'FAILED',
        readiness: 'FAILED',
        source: 'TruthFirewall.GenerationEvaluator',
        checkedAt: now,
        error: `Active pointer points to '${activePointer}' but metadata is absent from storage`,
        recovery: 'Repair generation pointer or re-install regional map pack',
      };
    }

    try {
      const meta = JSON.parse(generationMetaJson);
      if (meta.generationId !== activePointer || meta.status !== 'ACTIVE') {
        return {
          level: 'FAILED',
          readiness: 'FAILED',
          source: 'TruthFirewall.GenerationEvaluator',
          checkedAt: now,
          error: `Generation '${activePointer}' is not committed in ACTIVE state (current: ${meta.status})`,
        };
      }

      const basemapSha = meta.artifactHashes?.basemap;
      if (!basemapSha) {
        return {
          level: 'FAILED',
          readiness: 'FAILED',
          source: 'TruthFirewall.GenerationEvaluator',
          checkedAt: now,
          error: `Generation '${activePointer}' lacks validated basemap SHA256 cryptographic evidence`,
        };
      }

      return {
        level: 'DERIVED',
        readiness: 'READY',
        source: 'TruthFirewall.GenerationEvaluator',
        checkedAt: now,
        data: { generationId: activePointer, artifactSha256: basemapSha },
      };
    } catch (err: any) {
      return {
        level: 'FAILED',
        readiness: 'FAILED',
        source: 'TruthFirewall.GenerationEvaluator',
        checkedAt: now,
        error: `Corrupt generation metadata JSON: ${err?.message || err}`,
      };
    }
  }

  /**
   * Evaluates PMTiles archive truth:
   * PMTiles header is valid ≠ map contains real geometry
   */
  public static evaluatePMTilesContent(
    level1Container: boolean,
    level2Semantic: boolean,
    level3Content: boolean,
    hasPlaceholderMarkers: boolean
  ): EvidenceRecord<{ level1: boolean; level2: boolean; level3: boolean }> {
    const now = Date.now();

    if (hasPlaceholderMarkers) {
      return {
        level: 'FAILED',
        readiness: 'FAILED',
        source: 'TruthFirewall.PMTilesContent',
        checkedAt: now,
        error: 'Archive contains placeholder markers (e.g. MVT_TILE_PAYLOAD or PMTILES_ROOT_DIR); real vector tiles required',
      };
    }

    if (!level1Container || !level2Semantic || !level3Content) {
      return {
        level: 'FAILED',
        readiness: 'FAILED',
        source: 'TruthFirewall.PMTilesContent',
        checkedAt: now,
        data: { level1: level1Container, level2: level2Semantic, level3: level3Content },
        error: 'PMTiles archive failed 3-level container, semantic, or geometry content verification',
      };
    }

    return {
      level: 'OBSERVED',
      readiness: 'READY',
      source: 'TruthFirewall.PMTilesContent',
      checkedAt: now,
      data: { level1: level1Container, level2: level2Semantic, level3: level3Content },
    };
  }

  /**
   * Evaluates routing graph readiness:
   * routing.graph exists ≠ routing graph is loaded
   */
  public static evaluateRoutingGraph(
    engineLoaded: boolean,
    nodeCount: number,
    edgeCount: number
  ): EvidenceRecord<{ nodeCount: number; edgeCount: number }> {
    const now = Date.now();

    if (!engineLoaded || nodeCount === 0 || edgeCount === 0) {
      return {
        level: 'UNAVAILABLE',
        readiness: 'MISSING',
        source: 'TruthFirewall.RoutingGraph',
        checkedAt: now,
        data: { nodeCount, edgeCount },
        error: 'Routing graph binary is not parsed and loaded into active memory',
        recovery: 'Load metric pedestrian routing graph into memory',
      };
    }

    return {
      level: 'OBSERVED',
      readiness: 'READY',
      source: 'TruthFirewall.RoutingGraph',
      checkedAt: now,
      data: { nodeCount, edgeCount },
    };
  }
}
