import * as fs from 'fs';
import * as crypto from 'crypto';

export interface ArtifactFilePaths {
  basemapPmtiles: string;
  poiPmtiles: string;
  poiIndex: string;
  routingGraph: string;
  streetIndex: string;
  searchIndex: string;
  placesJson: string;
}

export interface IngestionMetrics {
  region: string;
  version: string;
  poiCount: number;
  routingNodes: number;
  routingEdges: number;
  streetCount: number;
}

function calculateSha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function verifyArtifactsAndGenerateManifest(
  paths: ArtifactFilePaths,
  metrics: IngestionMetrics,
  sourcesMetadata: any[]
): any {
  console.log('      Generating manifest.json with real SHA-256 hashes...');

  // Derive deterministic timestamps from the actual sources metadata
  const latestFetchedAt = sourcesMetadata.reduce(
    (latest, s) => (s.fetchedAt && s.fetchedAt > latest ? s.fetchedAt : latest),
    '2026-09-29T00:00:00.000Z'
  );

  const manifest = {
    id: metrics.region,
    name: metrics.region.toUpperCase(),
    cityName: metrics.region.toUpperCase(),
    cityId: metrics.region,
    region: metrics.region,
    regionName: 'Tallinn & Harjumaa Bioregion',
    countryCode: 'EE',
    version: metrics.version,
    routingSnapshotVersion: metrics.version,
    generatedAt: latestFetchedAt,
    updatedAt: latestFetchedAt,
    bbox: [24.50, 59.32, 25.00, 59.50],
    bounds: [24.50, 59.32, 25.00, 59.50],
    center: { lat: 59.4370, lng: 24.7535 },
    minZoom: 10,
    maxZoom: 16,
    fileName: `${metrics.region}.pmtiles`,
    pmtiles: `/maps/${metrics.region}.pmtiles`,
    pmtilesUrl: `/maps/${metrics.region}.pmtiles`,
    downloadUrl: `/maps/${metrics.region}.pmtiles`,
    remoteUrl: `/maps/${metrics.region}.pmtiles`,
    routing: `/routing/${metrics.region}.graph`,
    routingUrl: `/routing/${metrics.region}.graph`,
    streetIndexUrl: `/maps/street-index.bin`,
    sizeBytes: fs.statSync(paths.basemapPmtiles).size,
    formattedSize: '0.0 MB',
    sizeFormatted: '0.0 MB',
    source: 'OSM + Tallinn Geoportal',
    license: 'ODbL / Tallinn Open Data',
    attribution: 'HÕIMU Bioregional Resilience Data',
    description: 'Tallinn & Harjumaa Bioregional Vector Basemap & Routing Graph',
    releaseDate: latestFetchedAt.split('T')[0],
    features: [
      'Basemap Vector',
      'POI Resilience',
      'Offline Routing',
      'Street Index',
      'Full-Text Search',
      'Estonian Localization (name:et)',
    ],
    featureFlags: {
      streetLabels: true,
      buildings: true,
      parks: true,
      poi: true,
      offline: true,
      tacticalThemes: true,
      routingGraph: true,
    },
    artifacts: {
      basemap: {
        path: 'tallinn-basemap.pmtiles',
        sha256: calculateSha256(paths.basemapPmtiles),
        sizeBytes: fs.statSync(paths.basemapPmtiles).size,
      },
      poi: {
        path: 'tallinn-poi.pmtiles',
        sha256: calculateSha256(paths.poiPmtiles),
        sizeBytes: fs.statSync(paths.poiPmtiles).size,
        count: metrics.poiCount,
      },
      routing: {
        path: 'routing.graph',
        sha256: calculateSha256(paths.routingGraph),
        sizeBytes: fs.statSync(paths.routingGraph).size,
        nodes: metrics.routingNodes,
        edges: metrics.routingEdges,
      },
      streetIndex: {
        path: 'street-index.bin',
        sha256: calculateSha256(paths.streetIndex),
        sizeBytes: fs.statSync(paths.streetIndex).size,
        streetCount: metrics.streetCount,
      },
      searchIndex: {
        path: 'search-index.bin',
        sha256: calculateSha256(paths.searchIndex),
        sizeBytes: fs.statSync(paths.searchIndex).size,
      },
    },
    sources: sourcesMetadata.map((s) => ({
      provider: s.source,
      mode: s.mode || 'SNAPSHOT',
      snapshotId: s.snapshotId || `snap-${s.checksum?.substring(0, 8)}`,
      inputSha256: s.checksum || '',
      recordCount: s.recordCount || 0,
      fetchedAt: s.fetchedAt || '2026-09-29T00:00:00.000Z',
      license: s.source === 'osm'
        ? 'ODbL 1.0 (OpenStreetMap contributors)'
        : s.source === 'tallinn'
        ? 'Tallinna Avaandmete Litsents'
        : s.source === 'paasteamet'
        ? 'CC BY 4.0'
        : 'Maa-ameti Avaandmete Litsents',
    })),
  };

  // Calculate global sha256 as basemap's sha256 to ensure consistency
  (manifest as any).sha256 = manifest.artifacts.basemap.sha256;
  (manifest as any).checksumSha256 = manifest.artifacts.basemap.sha256;

  // Root level attributes for legacy unit test compatibility
  (manifest as any).basemap = {
    filename: 'tallinn-basemap.pmtiles',
    path: 'tallinn-basemap.pmtiles',
    sha256: manifest.artifacts.basemap.sha256,
    sizeBytes: manifest.artifacts.basemap.sizeBytes,
  };
  (manifest as any).poi = {
    filename: 'tallinn-poi.pmtiles',
    path: 'tallinn-poi.pmtiles',
    sha256: manifest.artifacts.poi.sha256,
    sizeBytes: manifest.artifacts.poi.sizeBytes,
    index: 'tallinn-poi.index',
  };
  (manifest as any).routing = {
    filename: 'routing.graph',
    path: 'routing.graph',
    sha256: manifest.artifacts.routing.sha256,
    sizeBytes: manifest.artifacts.routing.sizeBytes,
  };
  (manifest as any).streetIndex = {
    filename: 'street-index.bin',
    path: 'street-index.bin',
    sha256: manifest.artifacts.streetIndex.sha256,
    sizeBytes: manifest.artifacts.streetIndex.sizeBytes,
  };
  (manifest as any).searchIndex = {
    filename: 'search-index.bin',
    path: 'search-index.bin',
    sha256: manifest.artifacts.searchIndex.sha256,
    sizeBytes: manifest.artifacts.searchIndex.sizeBytes,
  };

  return manifest;
}

export function writeManifestFile(manifest: any, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`      ✓ Manifest written to: ${outputPath}`);
}
