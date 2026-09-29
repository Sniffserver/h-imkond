/**
 * HÕIMU Transactional Map Pack Generation Repository & Active Pointer Commit
 * 
 * Implements the atomic generation lifecycle:
 * 
 *   SourceSnapshotRegistry
 *           ↓
 *     ReleaseManifest
 *           ↓
 *   GenerationRepository
 *      ├── Stage Generation (`generations/gen-X.staging/`)
 *      ├── Verify Staged Files
 *      ├── Re-open & Verify Handles from OPFS / Native Storage
 *      └── Atomic Commit ACTIVE Pointer (`ACTIVE_POINTER` -> `gen-X`)
 */

import { mapPackStorageEngine } from '../../../services/storage/mapPackStorageEngine';

export interface GenerationArtifacts {
  basemap: ArrayBuffer;
  poi?: ArrayBuffer;
  routingGraph?: ArrayBuffer;
  streetIndex?: ArrayBuffer;
  searchIndex?: ArrayBuffer;
  manifest: any;
}

export interface GenerationMetadata {
  generationId: string;
  cityName: string;
  committedAt: number;
  status: 'STAGING' | 'VERIFIED' | 'ACTIVE' | 'ARCHIVED';
  artifactHashes: Record<string, string>;
}

export class GenerationRepository {
  private static instance: GenerationRepository | null = null;
  private activePointer: string | null = null;
  private stagingCache: Map<string, GenerationArtifacts> = new Map();

  public static getInstance(): GenerationRepository {
    if (!GenerationRepository.instance) {
      GenerationRepository.instance = new GenerationRepository();
    }
    return GenerationRepository.instance;
  }

  public resetMemoryCache(): void {
    this.activePointer = null;
    this.stagingCache.clear();
  }

  /**
   * Reads current ACTIVE generation pointer from storage
   */
  public async getActivePointer(): Promise<string | null> {
    if (this.activePointer) return this.activePointer;

    try {
      const storedPointer = localStorage.getItem('hoimu_map_active_generation_pointer');
      if (storedPointer) {
        this.activePointer = storedPointer;
        return storedPointer;
      }
    } catch {
      // Fall through
    }
    return null;
  }

  /**
   * Returns metadata of the currently active generation
   */
  public async getActiveGeneration(): Promise<GenerationMetadata | null> {
    const pointer = await this.getActivePointer();
    if (!pointer) return null;

    try {
      const metaStr = localStorage.getItem(`hoimu_generation_${pointer}_meta`);
      if (metaStr) {
        return JSON.parse(metaStr) as GenerationMetadata;
      }
      return {
        generationId: pointer,
        cityName: 'Tallinn',
        committedAt: Date.now(),
        status: 'ACTIVE',
        artifactHashes: {},
      };
    } catch {
      return null;
    }
  }

  /**
   * 1. stageGeneration: Writes all artifacts to /generations/<generationId>.staging/
   */
  public async stageGeneration(
    generationId: string,
    artifacts: GenerationArtifacts
  ): Promise<void> {
    const stagingPath = `generations/${generationId}.staging`;
    this.stagingCache.set(generationId, artifacts);

    await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/basemap.pmtiles`, artifacts.basemap);
    if (artifacts.poi) {
      await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/poi.pmtiles`, artifacts.poi);
    }
    if (artifacts.routingGraph) {
      await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/routing.graph`, artifacts.routingGraph);
    }
    if (artifacts.streetIndex) {
      await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/street-index.bin`, artifacts.streetIndex);
    }
    if (artifacts.searchIndex) {
      await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/search-index.bin`, artifacts.searchIndex);
    }
    if (artifacts.manifest) {
      const manifestStr = JSON.stringify(artifacts.manifest);
      const encoder = new TextEncoder();
      const buf = encoder.encode(manifestStr).buffer;
      await mapPackStorageEngine.writeBinaryFile(`${stagingPath}/manifest.json`, buf as ArrayBuffer);
    }
  }

  /**
   * 2. verifyGeneration: Verifies staged files from storage
   */
  public async verifyGeneration(
    generationId: string,
    customVerifier?: (arts: GenerationArtifacts) => Promise<boolean>
  ): Promise<boolean> {
    const stagingPath = `generations/${generationId}.staging`;
    const reopenedBasemap = await mapPackStorageEngine.readBinaryFile(`${stagingPath}/basemap.pmtiles`);
    if (!reopenedBasemap || reopenedBasemap.byteLength < 127) {
      return false;
    }

    // Verify PMTiles header magic bytes "PMTiles" (0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73)
    const headerBytes = new Uint8Array(reopenedBasemap.slice(0, 7));
    const magic = String.fromCharCode(...headerBytes);
    if (magic !== 'PMTiles') {
      return false;
    }

    if (customVerifier) {
      const cached = this.stagingCache.get(generationId);
      if (cached) {
        const customValid = await customVerifier(cached);
        if (!customValid) return false;
      }
    }

    return true;
  }

  /**
   * 3. activateGeneration: Commits the generation to final path and updates ACTIVE pointer
   */
  public async activateGeneration(generationId: string): Promise<boolean> {
    const stagingPath = `generations/${generationId}.staging`;
    const finalPath = `generations/${generationId}`;

    const reopenedBasemap = await mapPackStorageEngine.readBinaryFile(`${stagingPath}/basemap.pmtiles`);
    if (!reopenedBasemap || reopenedBasemap.byteLength < 127) {
      throw new Error(`Cannot activate generation ${generationId}: Staged basemap is invalid`);
    }

    await mapPackStorageEngine.writeBinaryFile(`${finalPath}/basemap.pmtiles`, reopenedBasemap);

    const reopenedPoi = await mapPackStorageEngine.readBinaryFile(`${stagingPath}/poi.pmtiles`);
    if (reopenedPoi) {
      await mapPackStorageEngine.writeBinaryFile(`${finalPath}/poi.pmtiles`, reopenedPoi);
    }

    const reopenedRouting = await mapPackStorageEngine.readBinaryFile(`${stagingPath}/routing.graph`);
    if (reopenedRouting) {
      await mapPackStorageEngine.writeBinaryFile(`${finalPath}/routing.graph`, reopenedRouting);
    }

    // Mark previous generation as old/garbage-collectable if changed
    const previousPointer = await this.getActivePointer();
    if (previousPointer && previousPointer !== generationId) {
      try {
        const prevMetaStr = localStorage.getItem(`hoimu_generation_${previousPointer}_meta`);
        if (prevMetaStr) {
          const prevMeta = JSON.parse(prevMetaStr);
          prevMeta.status = 'ARCHIVED';
          localStorage.setItem(`hoimu_generation_${previousPointer}_meta`, JSON.stringify(prevMeta));
        }
      } catch {
        // Ignore
      }
    }

    // Atomic Pointer Update
    this.activePointer = generationId;
    localStorage.setItem('hoimu_map_active_generation_pointer', generationId);
    localStorage.setItem('/ACTIVE', generationId);
    localStorage.setItem(
      `hoimu_generation_${generationId}_meta`,
      JSON.stringify({
        generationId,
        cityName: 'Tallinn',
        committedAt: Date.now(),
        status: 'ACTIVE',
        artifactHashes: {},
      })
    );

    // Cleanup staging
    await this.rollbackStaging(generationId);
    this.stagingCache.delete(generationId);

    return true;
  }

  /**
   * 4. rollbackGeneration: Discards staging and preserves or restores active pointer
   */
  public async rollbackGeneration(generationId?: string): Promise<void> {
    if (generationId) {
      await this.rollbackStaging(generationId);
      this.stagingCache.delete(generationId);
    }
  }

  /**
   * 5. repairGenerations: Checks active pointer and ensures storage files are consistent
   */
  public async repairGenerations(): Promise<{ repaired: boolean; activeGeneration: string | null }> {
    const active = await this.getActivePointer();
    if (!active) {
      return { repaired: false, activeGeneration: null };
    }

    const activeBasemap = await mapPackStorageEngine.readBinaryFile(`generations/${active}/basemap.pmtiles`);
    if (!activeBasemap || activeBasemap.byteLength < 127) {
      // Corrupt active generation, reset active pointer
      this.activePointer = null;
      localStorage.removeItem('hoimu_map_active_generation_pointer');
      localStorage.removeItem('/ACTIVE');
      return { repaired: true, activeGeneration: null };
    }

    return { repaired: false, activeGeneration: active };
  }

  /**
   * Atomic Transactional Staging & Commit Flow
   */
  public async stageAndCommitGeneration(
    generationId: string,
    artifacts: GenerationArtifacts,
    verifyFn: (arts: GenerationArtifacts) => Promise<boolean>
  ): Promise<boolean> {
    try {
      // 1. Stage
      await this.stageGeneration(generationId, artifacts);

      // 2. Verify
      const isValid = await this.verifyGeneration(generationId, verifyFn);
      if (!isValid) {
        throw new Error(`Staged artifacts failed verification check for ${generationId}`);
      }

      // 3. Activate
      return await this.activateGeneration(generationId);
    } catch (err) {
      console.error(`[GenerationRepository] Transaction aborted for ${generationId}:`, err);
      await this.rollbackGeneration(generationId);
      throw err;
    }
  }

  /**
   * Rollback & purge non-active staging generations
   */
  public async rollbackStaging(generationId: string): Promise<void> {
    const stagingPath = `generations/${generationId}.staging`;
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/basemap.pmtiles`);
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/poi.pmtiles`);
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/routing.graph`);
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/street-index.bin`);
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/search-index.bin`);
    await mapPackStorageEngine.deleteBinaryFile(`${stagingPath}/manifest.json`);
  }
}

export const generationRepository = GenerationRepository.getInstance();
