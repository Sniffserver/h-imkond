/**
 * HÕIMU Strict Entropy Linter (AST / Pattern Checker)
 * Invariant: Math.random() is strictly forbidden in crypto, identity, protocol, storage, and engine domains.
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_DIRS = [
  'src/core/crypto',
  'src/crypto',
  'src/protocol',
  'src/core/identity',
  'src/storage',
  'src/engine',
];

const ROOT_DIR = path.resolve(__dirname, '..');
let violations = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignore comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (line.includes('Math.random')) {
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: idx + 1,
        code: trimmed,
      });
    }
  });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
        walk(full);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      checkFile(full);
    }
  }
}

for (const d of FORBIDDEN_DIRS) {
  walk(path.join(ROOT_DIR, d));
}

if (violations.length > 0) {
  console.error('\n❌ ENTROPY LINT VIOLATIONS DETECTED (Math.random in security/protocol path):');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line}: ${v.code}`);
  }
  console.error('\nFix: Use getSecureRandomBytes(), secureId(), randomId(), or pairingToken() from src/core/crypto/entropy.\n');
  process.exit(1);
} else {
  console.log('✓ Entropy check passed: Zero Math.random() in crypto/identity/protocol/storage/engine code paths.');
  process.exit(0);
}
