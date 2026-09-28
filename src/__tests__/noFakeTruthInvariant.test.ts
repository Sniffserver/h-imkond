import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getProductionFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('__tests__') && !file.includes('fixtures') && !file.includes('mocks')) {
        results = results.concat(getProductionFiles(fullPath));
      }
    } else {
      if (
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.spec.tsx')
      ) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

describe('Gate Invariant Test: No Fake Truth in Production Code', () => {
  it('scans production source and asserts absence of fake fallback shortcuts like "|| true"', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const prodFiles = getProductionFiles(srcDir);

    expect(prodFiles.length).toBeGreaterThan(20);

    const violations: { file: string; line: number; text: string }[] = [];

    prodFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Ignore comments
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        // Banned pattern: fallback "|| true" in production logic
        if (line.includes('|| true') && !file.includes('noFakeTruthInvariant')) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            text: trimmed,
          });
        }
      });
    });

    if (violations.length > 0) {
      console.error('Fake truth invariant violations found in production code:', violations);
    }

    expect(violations.length).toBe(0);
  });

  it('verifies that developer internal jargon is hidden from civilian UI labels', () => {
    const srcDir = path.join(process.cwd(), 'src', 'components');
    if (!fs.existsSync(srcDir)) return;

    const uiFiles = getProductionFiles(srcDir);
    const bannedJargon = ['HSTRIDX', 'HSRCHDX', 'sourceId', 'provenanceStatus'];
    const violations: string[] = [];

    uiFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      bannedJargon.forEach((jargon) => {
        if (content.includes(`"${jargon}"`) || content.includes(`'${jargon}'`)) {
          violations.push(`${path.relative(process.cwd(), file)} contains internal jargon "${jargon}"`);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
