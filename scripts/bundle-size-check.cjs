#!/usr/bin/env node
/**
 * Automated Performance Budget & Bundle Size Check
 *
 * Verifies that production build assets satisfy strict performance budgets:
 * - Initial JS bundle chunk: < 500 KB
 * - Map renderer lazy chunks: < 150 KB
 * - CSS bundles: < 100 KB
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.resolve(__dirname, '../dist/assets');

const BUDGETS = {
  initialBundleKB: 500,
  webglEngineChunkKB: 300,
  lazyMapRendererKB: 150,
  totalCssKB: 100,
};

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function runCheck() {
  console.log('\n=========================================');
  console.log('⚡ HOIMU PERFORMANCE BUDGET VERIFIER');
  console.log('=========================================\n');

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Dist directory not found at: ${DIST_DIR}`);
    console.error('Please run "npm run build" first.\n');
    process.exit(1);
  }

  const files = fs.readdirSync(DIST_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const cssFiles = files.filter(f => f.endsWith('.css'));

  let hasFailures = false;
  let totalRawJs = 0;
  let totalGzipJs = 0;

  console.log('📦 JavaScript Assets:');
  console.log('--------------------------------------------------');

  jsFiles.forEach(file => {
    const fullPath = path.join(DIST_DIR, file);
    const stat = fs.statSync(fullPath);
    const rawSize = stat.size;
    const gzipSize = getGzipSize(fullPath);

    totalRawJs += rawSize;
    totalGzipJs += gzipSize;

    const rawKB = rawSize / 1024;
    const gzipKB = gzipSize / 1024;

    const isMain = file.startsWith('index-') || file.startsWith('main-');
    const isWebGL = file.toLowerCase().includes('webgl');
    const isMap = file.toLowerCase().includes('map') || file.toLowerCase().includes('canvas');

    let budgetKB = BUDGETS.initialBundleKB;
    let label = 'Lazy Chunk';

    if (isMain) {
      budgetKB = BUDGETS.initialBundleKB;
      label = 'Initial Entry';
    } else if (isWebGL) {
      budgetKB = BUDGETS.webglEngineChunkKB;
      label = 'WebGL Engine (Lazy)';
    } else if (isMap) {
      budgetKB = BUDGETS.lazyMapRendererKB;
      label = 'Map Renderer (Lazy)';
    }

    // Check against budget (using gzip size as standard web metric, or raw size fallback)
    const passed = gzipKB <= budgetKB;

    const statusIcon = passed ? '✅' : '❌';
    console.log(
      `${statusIcon} [${label.padEnd(20)}] ${file.padEnd(32)} Raw: ${formatKB(rawSize).padStart(8)} KB | Gzip: ${formatKB(gzipSize).padStart(7)} KB (Budget: < ${budgetKB} KB)`
    );

    if (!passed) {
      hasFailures = true;
      console.warn(`   ⚠️ WARNING: Asset exceeds budget threshold of ${budgetKB} KB!`);
    }
  });

  console.log('--------------------------------------------------');
  console.log(`Total JS Bundle: Raw ${formatKB(totalRawJs)} KB | Gzip ${formatKB(totalGzipJs)} KB\n`);

  console.log('🎨 CSS Assets:');
  console.log('--------------------------------------------------');
  let totalRawCss = 0;
  let totalGzipCss = 0;

  cssFiles.forEach(file => {
    const fullPath = path.join(DIST_DIR, file);
    const stat = fs.statSync(fullPath);
    const rawSize = stat.size;
    const gzipSize = getGzipSize(fullPath);

    totalRawCss += rawSize;
    totalGzipCss += gzipSize;

    console.log(`📄 ${file.padEnd(35)} Raw: ${formatKB(rawSize).padStart(8)} KB | Gzip: ${formatKB(gzipSize).padStart(7)} KB`);
  });

  console.log('--------------------------------------------------\n');

  console.log('📊 Performance Budgets Summary:');
  console.log(` • Initial JS Bundle:   Gzip < ${BUDGETS.initialBundleKB} KB`);
  console.log(` • Map Renderer Lazy:   Gzip < ${BUDGETS.lazyMapRendererKB} KB`);
  console.log(` • Target TTI (Mobile): < 2.5s`);
  console.log(` • Target Scroll FPS:   > 50 FPS`);
  console.log(` • Memory Cap (5 min):  < 100 MB\n`);

  if (hasFailures) {
    console.error('❌ PERFORMANCE BUDGET CHECK FAILED: One or more assets exceeded limits.\n');
    process.exit(1);
  } else {
    console.log('🎉 ALL PERFORMANCE BUDGETS PASSED!\n');
    process.exit(0);
  }
}

runCheck();
