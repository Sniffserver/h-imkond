/**
 * HÕIMU Map Pipeline Reproducibility Gate (Phase 3)
 * 
 * Verifies that two clean builds produce bit-identical artifacts and identical manifests:
 *   Build Run #1 -> compute artifact sha256 sums
 *   Build Run #2 -> compute artifact sha256 sums
 *   Verify hashes match 100%
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { runIngestionPipeline } from '../run-pipeline';

export async function runReproducibilityGate(): Promise<boolean> {
  console.log('====================================================================');
  console.log('  HÕIMU Reproducibility Gate: Bit-Identical Artifact Verification');
  console.log('====================================================================');

  const rootDir = process.cwd();
  const generatedDir = path.join(rootDir, 'src', 'data', 'generated');

  // Run 1
  console.log('\n[Gate 1/3] Executing Deterministic Release Build Run #1...');
  process.env.SOURCE_DATE_EPOCH = '1780000000';
  const run1 = await runIngestionPipeline({ forceLive: false });

  const run1Hashes: Record<string, string> = {};
  const artifactFiles = [
    'tallinn-basemap.pmtiles',
    'tallinn-poi.pmtiles',
    'tallinn-places.json',
    'tallinn-poi.index',
    'routing.graph',
    'street-index.bin',
    'search-index.bin',
    'manifest.json',
  ];

  for (const file of artifactFiles) {
    const p = path.join(generatedDir, file);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      run1Hashes[file] = crypto.createHash('sha256').update(buf).digest('hex');
    }
  }

  // Run 2
  console.log('\n[Gate 2/3] Executing Deterministic Release Build Run #2...');
  const run2 = await runIngestionPipeline({ forceLive: false });

  const run2Hashes: Record<string, string> = {};
  for (const file of artifactFiles) {
    const p = path.join(generatedDir, file);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      run2Hashes[file] = crypto.createHash('sha256').update(buf).digest('hex');
    }
  }

  // Comparison
  console.log('\n[Gate 3/3] Comparing Bit-Identical SHA-256 Hashes Across Runs:');
  let allMatch = true;

  for (const file of artifactFiles) {
    const h1 = run1Hashes[file];
    const h2 = run2Hashes[file];
    const match = h1 && h2 && h1 === h2;
    if (!match) {
      allMatch = false;
      console.error(`  ❌ [MISMATCH] ${file}: Run 1 (${h1}) !== Run 2 (${h2})`);
    } else {
      console.log(`  ✓ [IDENTICAL] ${file}: ${h1.substring(0, 16)}...`);
    }
  }

  if (!allMatch) {
    console.error('\n❌ REPRODUCIBILITY GATE FAILED: Builds produced divergent artifact bytes.');
    process.exit(1);
  }

  console.log('\n====================================================================');
  console.log('  ✓ REPRODUCIBILITY GATE PASSED: Bit-Identical Outputs Guaranteed');
  console.log('====================================================================\n');
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReproducibilityGate().catch((err) => {
    console.error('Reproducibility check failed:', err);
    process.exit(1);
  });
}
