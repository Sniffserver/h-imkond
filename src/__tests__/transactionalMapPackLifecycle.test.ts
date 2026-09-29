import { describe, it, expect, beforeEach } from 'vitest';
import { generationRepository } from '../features/map/data/GenerationRepository';
import { mapPackStorageEngine } from '../services/storage/mapPackStorageEngine';

describe('Phase 6 — Transactional Map-Pack GenerationRepository & Atomicity', () => {
  beforeEach(() => {
    localStorage.clear();
    generationRepository.resetMemoryCache();
  });

  function createValidBasemap(): Uint8Array {
    const bytes = new Uint8Array(256);
    // Write PMTiles magic bytes: 'P', 'M', 'T', 'i', 'l', 'e', 's'
    const magic = [0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73];
    bytes.set(magic, 0);
    return bytes;
  }

  it('1. Executes complete 11-step transactional installation flow', async () => {
    const basemap = createValidBasemap();
    const poi = new Uint8Array(150);
    poi.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);

    const genId = 'gen-tallinn-2026-release-01';

    // 1-3. Stage generation
    await generationRepository.stageGeneration(genId, {
      basemap: basemap.buffer as ArrayBuffer,
      poi: poi.buffer as ArrayBuffer,
      manifest: { cityName: 'Tallinn', generationId: genId },
    });

    // 4-8. Verify generation
    const isValid = await generationRepository.verifyGeneration(genId, async (arts) => {
      return arts.basemap.byteLength > 100;
    });
    expect(isValid).toBe(true);

    // 9-11. Activate generation & commit ACTIVE pointer
    const activated = await generationRepository.activateGeneration(genId);
    expect(activated).toBe(true);

    const activePointer = await generationRepository.getActivePointer();
    expect(activePointer).toBe(genId);

    const activeMeta = await generationRepository.getActiveGeneration();
    expect(activeMeta?.status).toBe('ACTIVE');
    expect(activeMeta?.generationId).toBe(genId);
  });

  it('2. Atomicity on verification failure: purges staging and keeps existing ACTIVE pointer intact', async () => {
    // Initial active generation
    const initialGen = 'gen-good-baseline';
    localStorage.setItem('hoimu_map_active_generation_pointer', initialGen);
    localStorage.setItem(
      `hoimu_generation_${initialGen}_meta`,
      JSON.stringify({ generationId: initialGen, status: 'ACTIVE' })
    );

    // Corrupt generation attempt (missing PMTiles header)
    const corruptBasemap = new Uint8Array(50); // <127 bytes, invalid header
    const badGenId = 'gen-corrupted-staging';

    await expect(
      generationRepository.stageAndCommitGeneration(
        badGenId,
        {
          basemap: corruptBasemap.buffer as ArrayBuffer,
          manifest: { generationId: badGenId },
        },
        async () => false // verification failed
      )
    ).rejects.toThrow();

    // Active pointer MUST still be the initial generation
    const currentActive = await generationRepository.getActivePointer();
    expect(currentActive).toBe(initialGen);

    // Staging files must be purged
    const stagedFile = await mapPackStorageEngine.readBinaryFile(`generations/${badGenId}.staging/basemap.pmtiles`);
    expect(stagedFile).toBeNull();
  });

  it('3. repairGenerations detects corrupt active generation and resets cleanly', async () => {
    localStorage.setItem('hoimu_map_active_generation_pointer', 'gen-broken-pointer');
    
    // No actual files exist for gen-broken-pointer
    const repairResult = await generationRepository.repairGenerations();
    expect(repairResult.repaired).toBe(true);
    expect(repairResult.activeGeneration).toBeNull();

    const active = await generationRepository.getActivePointer();
    expect(active).toBeNull();
  });
});
