import { describe, it, expect, beforeEach } from 'vitest';
import { generationRepository } from '../features/map/data/GenerationRepository';

describe('Transactional Map Pack GenerationRepository & Active Pointer Commit', () => {
  beforeEach(() => {
    localStorage.clear();
    generationRepository.resetMemoryCache();
  });

  it('stages artifacts, performs verification, and atomically updates ACTIVE pointer', async () => {
    const dummyBasemap = new Uint8Array(200);
    // Write valid PMTiles magic bytes "PMTiles" (0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73)
    dummyBasemap.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0);

    const committed = await generationRepository.stageAndCommitGeneration(
      'gen-test-tallinn-01',
      {
        basemap: dummyBasemap.buffer,
        manifest: { cityName: 'Tallinn' },
      },
      async (arts) => {
        return arts.basemap.byteLength >= 127;
      }
    );

    expect(committed).toBe(true);

    const activePointer = await generationRepository.getActivePointer();
    expect(activePointer).toBe('gen-test-tallinn-01');
  });

  it('aborts transaction and preserves previous active pointer if verification fails', async () => {
    // Set existing active pointer
    localStorage.setItem('hoimu_map_active_generation_pointer', 'gen-previous-good');

    const corruptBuffer = new Uint8Array(50); // <127 bytes

    await expect(
      generationRepository.stageAndCommitGeneration(
        'gen-test-corrupt',
        {
          basemap: corruptBuffer.buffer,
          manifest: { cityName: 'Corrupt' },
        },
        async () => {
          return false; // Verification failed
        }
      )
    ).rejects.toThrow();

    // Active pointer MUST remain pointing to the previous good generation
    const activePointer = await generationRepository.getActivePointer();
    expect(activePointer).toBe('gen-previous-good');
  });
});
