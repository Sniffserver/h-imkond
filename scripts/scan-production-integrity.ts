#!/usr/bin/env tsx
/**
 * HÕIMU Production Integrity & Synthetic Data Scanner
 * Scans production codebase to prevent test fixtures and mock data from leaking into production builds.
 */

import fs from 'fs';
import path from 'path';

const PRODUCTION_DIRS = [
  path.resolve(process.cwd(), 'src/features'),
  path.resolve(process.cwd(), 'src/services'),
  path.resolve(process.cwd(), 'src/core'),
  path.resolve(process.cwd(), 'src/geo'),
  path.resolve(process.cwd(), 'src/data/generated'),
  path.resolve(process.cwd(), 'public/maps'),
  path.resolve(process.cwd(), 'tools/map-data'),
];

const FORBIDDEN_PATTERNS = [
  { pattern: /from\s+['"].*data\/fixtures.*['"]/, message: 'Forbidden import of test fixtures in production code' },
  { pattern: /source:\s*['"]fixture['"]/, message: 'Hardcoded fixture source in production domain code' },
  { pattern: /\[FIXTURE\]/, message: 'Hardcoded [FIXTURE] label in production code' },
];

let errorsFound = 0;

function scanDirectory(dir: string): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'fixtures') {
        continue; // Tests and fixtures are exempted
      }
      scanDirectory(fullPath);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json'))
    ) {
      const content = fs.readFileSync(fullPath, 'utf8');

      FORBIDDEN_PATTERNS.forEach(({ pattern, message }) => {
        // Reset lastIndex if global regex was supplied
        if ('lastIndex' in pattern) {
          (pattern as any).lastIndex = 0;
        }
        if (pattern.test(content)) {
          console.error(`[SYNTHETIC DATA LEAK] ${fullPath}: ${message}`);
          errorsFound++;
        }
      });
    }
  }
}

console.log('====================================================================');
console.log('  HÕIMU Production Integrity Scanner: No Synthetic Production Data');
console.log('====================================================================');

PRODUCTION_DIRS.forEach((dir) => {
  scanDirectory(dir);
});

if (errorsFound > 0) {
  console.error(`\n❌ FAILED: Found ${errorsFound} synthetic data leak(s) in production paths!`);
  process.exit(1);
} else {
  console.log('✓ No forbidden fixture imports found in production directories.');
  console.log('✓ Production dataset strictly isolated from test fixtures.');
  console.log('====================================================================');
  console.log('  ✓ PRODUCTION INTEGRITY VERIFIED');
  console.log('====================================================================');
  process.exit(0);
}
