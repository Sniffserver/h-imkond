/**
 * HÕIMU 5-Gate Release Verification Engine
 * 
 * Gate A — Reproducibility: Clean build of map-data artifacts
 * Gate B — Data Integrity: Container, metadata, MVT content, bounds, checksums, routing, indices
 * Gate C — Runtime Integrity: Typecheck, lint, test, build
 * Gate D — Browser E2E & Invariants: No fake truth invariant & E2E smoke tests
 * Gate E — Device Matrix: Desktop, mobile, Capacitor & low-memory constraints
 */

import { execSync } from 'child_process';

function runStep(gateName: string, command: string) {
  console.log(`\n====================================================================`);
  console.log(` [${gateName}] Running: ${command}`);
  console.log(`====================================================================`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`      ✓ [${gateName}] PASSED`);
  } catch (err: any) {
    console.error(`\n❌ [${gateName}] FAILED command: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log('====================================================================');
  console.log('  HÕIMU 5-GATE RELEASE VERIFICATION PIPELINE');
  console.log('====================================================================');

  // Gate A: Reproducibility
  runStep('Gate A — Reproducibility', 'npm run build:map-data');

  // Gate B: Data Integrity
  runStep('Gate B — Data Integrity', 'npm run maps:verify');

  // Gate C: Runtime Integrity
  runStep('Gate C — TypeCheck', 'npm run typecheck');
  runStep('Gate C — Linting', 'npm run lint');
  runStep('Gate C — Test Suite', 'npm test');
  runStep('Gate C — Production Build', 'npm run build');

  // Gate D: E2E & Invariant Gate
  runStep('Gate D — No Fake Truth Invariant', 'npx vitest run src/__tests__/noFakeTruthInvariant.test.ts');
  runStep('Gate D — E2E Smoke Test', 'npx vitest run src/__tests__/e2eSmoke.test.tsx');

  // Gate E: Device Matrix
  runStep('Gate E — Device Matrix Tests', 'npx vitest run src/__tests__/deviceMatrix.test.ts');

  console.log('\n====================================================================');
  console.log('  ✓ ALL 5 RELEASE GATES PASSED (ZERO DEFECTS)');
  console.log('====================================================================');
}

main();
