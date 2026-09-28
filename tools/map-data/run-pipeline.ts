/**
 * HÕIMU Map Data Ingestion & Artifact Pipeline Runner
 * 
 * Pipeline Architecture:
 *   Raw Sources (OSM + Tallinn Geoportal + Päästeamet + ADS + HÕIMU Mesh)
 *     ↓
 *   Normalized Source Records (NormalizedRecord)
 *     ↓
 *   Validation (Geographic Bounds, Tags, Integrity)
 *     ↓
 *   Deduplication (Haversine Proximity & Lexical Corroboration)
 *     ↓
 *   Provenance & Conflict Surface (Discrepancy Detection)
 *     ↓
 *   Canonical Dataset (MapPlace[])
 *     ↓
 *   Generated Artifacts (PMTiles, POI Index, Routing Graph, Street Index, Manifest)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchOsmData } from './osm/fetch';
import { normalizeOsmBatch } from './osm/normalize';
import { validateOsmBatch } from './osm/validate';
import { fetchTallinnMunicipalData } from './tallinn/fetch';
import { normalizeTallinnBatch } from './tallinn/normalize';
import { validateTallinnBatch } from './tallinn/validate';
import { fetchPaasteametData } from './paasteamet/fetch';
import { normalizePaasteametBatch } from './paasteamet/normalize';
import { fetchAdsData } from './ads/fetch';
import { deduplicateRecords } from './merge/dedupe';
import { synthesizeCanonicalPlaces } from './merge/provenance';
import { writePMTilesFile } from './build/pmtiles';
import { writePoiArtifacts } from './build/poi-index';
import { writeStreetArtifacts } from './build/street-index';
import { verifyArtifactsAndGenerateManifest, writeManifestFile } from './build/manifest';

export async function runIngestionPipeline(options?: { forceLive?: boolean }): Promise<{
  success: boolean;
  totalPlaces: number;
  conflictsCount: number;
  artifacts: Record<string, { path: string; sha256: string; sizeBytes: number }>;
}> {
  console.log('====================================================================');
  console.log('  HÕIMU Map Data Ingestion Pipeline: Tallinn Bioregion');
  console.log('====================================================================');

  const rootDir = process.cwd();
  const publicMapsDir = path.join(rootDir, 'public', 'maps');
  const publicRoutingDir = path.join(rootDir, 'public', 'routing');
  const generatedDataDir = path.join(rootDir, 'src', 'data', 'generated');

  [publicMapsDir, publicRoutingDir, generatedDataDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // Step 1: Fetch Raw Sources
  console.log('[1/6] Fetching raw authoritative & community sources...');
  const [osmFetch, tallinnFetch, paasteametFetch, adsFetch] = await Promise.all([
    fetchOsmData(undefined, options?.forceLive),
    fetchTallinnMunicipalData(options?.forceLive),
    fetchPaasteametData(options?.forceLive),
    fetchAdsData(options?.forceLive),
  ]);

  console.log(`      ✓ OSM: ${osmFetch.elements.length} elements (Checksum: ${osmFetch.metadata.checksum.substring(0, 8)}...)`);
  console.log(`      ✓ Tallinn Open Data: ${tallinnFetch.records.length} records (Checksum: ${tallinnFetch.metadata.checksum.substring(0, 8)}...)`);
  console.log(`      ✓ Päästeamet: ${paasteametFetch.records.length} records (Checksum: ${paasteametFetch.metadata.checksum.substring(0, 8)}...)`);
  console.log(`      ✓ ADS Register: ${adsFetch.records.length} records (Checksum: ${adsFetch.metadata.checksum.substring(0, 8)}...)`);

  // Step 2: Normalize
  console.log('[2/6] Normalizing heterogeneous source records...');
  const normOsm = normalizeOsmBatch(osmFetch);
  const normTallinn = normalizeTallinnBatch(tallinnFetch);
  const normPaasteamet = normalizePaasteametBatch(paasteametFetch);
  console.log(`      Normalized: ${normOsm.length} OSM, ${normTallinn.length} Tallinn, ${normPaasteamet.length} Rescue`);

  // Step 3: Validate
  console.log('[3/6] Validating coordinate bounds & data integrity...');
  const { validRecords: validOsm } = validateOsmBatch(normOsm);
  const { validRecords: validTallinn } = validateTallinnBatch(normTallinn);

  // Step 4: Deduplicate & Merge
  console.log('[4/6] Deduplicating & cross-referencing authoritative state registries vs OSM...');
  const authoritativeRecords = [...validTallinn, ...normPaasteamet];
  const dedupeResult = deduplicateRecords(authoritativeRecords, validOsm, 65);
  console.log(`      Matched pairs: ${dedupeResult.matchedPairs.length}`);
  console.log(`      Unmatched authoritative: ${dedupeResult.unmatchedAuthoritative.length}`);
  console.log(`      Unmatched OSM: ${dedupeResult.unmatchedOsm.length}`);

  // Step 5: Synthesize Canonical Dataset
  console.log('[5/6] Synthesizing canonical MapPlace dataset with provenance guarantees...');
  const canonicalPlaces = synthesizeCanonicalPlaces(dedupeResult);
  const conflictsCount = canonicalPlaces.filter((p) => p.hasMismatch).length;
  console.log(`      Total canonical places: ${canonicalPlaces.length}`);
  console.log(`      Explicit conflict / mismatch alerts: ${conflictsCount}`);

  // Step 6: Generate Binary Artifacts
  console.log('[6/6] Generating binary artifacts (PMTiles, Indexes, Routing Graph)...');

  // 6a. Basemap PMTiles
  const basemapOutput = path.join(publicMapsDir, 'tallinn-basemap.pmtiles');
  const basemapSymlink = path.join(publicMapsDir, 'tallinn.pmtiles');
  const basemapGenerated = path.join(generatedDataDir, 'tallinn-basemap.pmtiles');
  writePMTilesFile({
    outputPath: basemapOutput,
    name: 'Tallinn Vector Basemap',
    description: 'HÕIMU Harju & Tallinn Bioregional Offline Vector Basemap',
  });
  // Mirror for convenience
  fs.copyFileSync(basemapOutput, basemapSymlink);
  fs.copyFileSync(basemapOutput, basemapGenerated);

  // 6b. POI PMTiles & Spatial Index
  const poiPmtilesOutput = path.join(publicMapsDir, 'tallinn-poi.pmtiles');
  const poiPmtilesGenerated = path.join(generatedDataDir, 'tallinn-poi.pmtiles');
  writePMTilesFile({
    outputPath: poiPmtilesOutput,
    name: 'Tallinn Civilian Resilience POI Layer',
    description: 'Civilian shelters, water points, police, hospitals, and repair hubs',
    layers: [
      { id: 'places' },
      { id: 'shelters' },
      { id: 'water' },
      { id: 'police' },
      { id: 'tools' },
    ],
    isPoi: true,
  });
  fs.copyFileSync(poiPmtilesOutput, poiPmtilesGenerated);

  const poiArtifacts = writePoiArtifacts(canonicalPlaces, generatedDataDir, generatedDataDir);
  // Mirror POI index & places to public/maps
  fs.copyFileSync(poiArtifacts.jsonPath, path.join(publicMapsDir, 'tallinn-places.json'));
  fs.copyFileSync(poiArtifacts.indexPath, path.join(publicMapsDir, 'tallinn-poi.index'));

  // 6c. Street Index & Routing Graph
  const streetArtifacts = writeStreetArtifacts(generatedDataDir, generatedDataDir);
  // Mirror routing graph to public/routing and public/maps
  fs.copyFileSync(streetArtifacts.routingGraphPath, path.join(publicRoutingDir, 'tallinn.graph'));
  fs.copyFileSync(streetArtifacts.routingGraphPath, path.join(publicMapsDir, 'routing.graph'));
  fs.copyFileSync(streetArtifacts.streetIndexPath, path.join(publicMapsDir, 'street-index.bin'));
  fs.copyFileSync(streetArtifacts.searchIndexPath, path.join(publicMapsDir, 'search-index.bin'));

  // Step 7: Cryptographic Manifest Generation (Gandalf Gate #2 Enforcement)
  console.log('[Gandalf Gate #2] Running artifact verification & manifest generation pipeline...');
  const manifestData = verifyArtifactsAndGenerateManifest(
    {
      basemapPmtiles: basemapGenerated,
      poiPmtiles: poiPmtilesGenerated,
      poiIndex: poiArtifacts.indexPath,
      routingGraph: streetArtifacts.routingGraphPath,
      streetIndex: streetArtifacts.streetIndexPath,
      searchIndex: streetArtifacts.searchIndexPath,
      placesJson: poiArtifacts.jsonPath,
    },
    {
      region: 'tallinn',
      version: '2026.09.27-A',
      poiCount: canonicalPlaces.length,
      routingNodes: streetArtifacts.nodeCount,
      routingEdges: streetArtifacts.edgeCount,
      streetCount: streetArtifacts.streetCount,
    }
  );

  const manifestPath = path.join(generatedDataDir, 'manifest.json');
  writeManifestFile(manifestData, manifestPath);
  fs.copyFileSync(manifestPath, path.join(publicMapsDir, 'manifest.json'));

  console.log('====================================================================');
  console.log('  SUCCESS: Ingestion pipeline execution completed!');
  console.log(`  Artifact Manifest: ${manifestPath}`);
  console.log(`    - basemap:      ${manifestData.basemap.filename} (${manifestData.basemap.sha256.substring(0, 16)}... ${manifestData.basemap.sizeBytes} B)`);
  console.log(`    - poi:          ${manifestData.poi.filename} (${manifestData.poi.sha256.substring(0, 16)}... ${manifestData.poi.sizeBytes} B, ${manifestData.poi.count} places)`);
  console.log(`    - routing:      ${manifestData.routing.filename} (${manifestData.routing.sha256.substring(0, 16)}... ${manifestData.routing.sizeBytes} B, ${manifestData.routing.nodes} nodes)`);
  console.log(`    - streetIndex:  ${manifestData.streetIndex.filename} (${manifestData.streetIndex.sha256.substring(0, 16)}... ${manifestData.streetIndex.sizeBytes} B)`);
  if (manifestData.searchIndex) {
    console.log(`    - searchIndex:  ${manifestData.searchIndex.filename} (${manifestData.searchIndex.sha256.substring(0, 16)}... ${manifestData.searchIndex.sizeBytes} B)`);
  }
  console.log('====================================================================');

  return {
    success: true,
    totalPlaces: canonicalPlaces.length,
    conflictsCount,
    artifacts: {
      basemap: {
        path: basemapGenerated,
        sha256: manifestData.basemap.sha256,
        sizeBytes: manifestData.basemap.sizeBytes,
      },
      poi: {
        path: poiPmtilesGenerated,
        sha256: manifestData.poi.sha256,
        sizeBytes: manifestData.poi.sizeBytes,
      },
      routing: {
        path: streetArtifacts.routingGraphPath,
        sha256: manifestData.routing.sha256,
        sizeBytes: manifestData.routing.sizeBytes,
      },
      streetIndex: {
        path: streetArtifacts.streetIndexPath,
        sha256: manifestData.streetIndex.sha256,
        sizeBytes: manifestData.streetIndex.sizeBytes,
      },
      searchIndex: {
        path: streetArtifacts.searchIndexPath,
        sha256: manifestData.searchIndex?.sha256 || '',
        sizeBytes: manifestData.searchIndex?.sizeBytes || 0,
      },
    },
  };
}

// Run immediately if invoked as main CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  runIngestionPipeline().catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}
