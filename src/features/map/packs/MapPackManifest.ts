/**
 * HÕIMU Canonical Map Pack Manifest Definition (Build Artifact Schema)
 * Unified single source of truth for single-file vector basemaps (PMTiles)
 * synchronized with exact routing graph topology.
 */

export interface MapPackFeatureList {
  streetLabels: boolean;
  buildings: boolean;
  parks: boolean;
  poi: boolean;
  offline: boolean;
  tacticalThemes: boolean;
  routingGraph: boolean;
}

export interface MapPackManifest {
  id: string; // e.g. 'tallinn'
  name: string; // e.g. 'Tallinn'
  cityName: string; // e.g. 'Tallinn'
  cityId: string; // e.g. 'tallinn'
  region: string;
  regionName: string;
  countryCode?: string;
  version: string;
  updatedAt?: string;
  routingSnapshotVersion: string;
  sha256: string;
  checksumSha256?: string;
  provenanceType?: 'official_published' | 'custom_unverified';
  isCustomUnverified?: boolean;
  pmtiles: string; // e.g. '/maps/tallinn.pmtiles'
  pmtilesUrl: string;
  downloadUrl?: string;
  poiUrl?: string;
  remoteUrl: string;
  routing: string; // e.g. '/routing/tallinn.graph'
  routingUrl: string;
  streetIndexUrl?: string;
  fileName: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  bbox?: [number, number, number, number];
  center: [number, number] | { lat: number; lng: number }; // [lat, lng] or { lat, lng }
  minZoom: number;
  maxZoom: number;
  sizeBytes: number;
  sizeFormatted: string;
  formattedSize?: string;
  source: string;
  license: string;
  attribution: string;
  description: string;
  releaseDate: string;
  features: string[];
  featureFlags: MapPackFeatureList;
  artifacts?: {
    basemap: { path: string; sha256: string; sizeBytes: number };
    poi: { path: string; sha256: string; sizeBytes: number; index?: string; count?: number };
    routing: { path: string; sha256: string; sizeBytes: number; nodes?: number; edges?: number };
    streetIndex: { path: string; sha256: string; sizeBytes: number; streetCount?: number };
    searchIndex?: { path: string; sha256: string; sizeBytes: number };
  };
  artifactsMeta?: Record<string, string>;
  sources?: string[];
}

/**
 * Single Source of Truth for all Estonian Regional Map Packs.
 * Generated build artifact definitions matching actual PMTiles distribution.
 */
export const MAP_PACK_MANIFESTS: Record<string, MapPackManifest> = {
  tallinn: {
    id: 'tallinn',
    name: 'Tallinn',
    cityName: 'Tallinn',
    cityId: 'tallinn',
    region: 'tallinn',
    regionName: 'Tallinn & Harjumaa Bioregion',
    countryCode: 'EE',
    version: '2026.09.27-A',
    routingSnapshotVersion: '2026.09.27-A',
    updatedAt: '2026-09-28T21:46:58.129Z',
    sha256: '0976658f89da095f77848fb99811068b48634f6a15fcd493d5fa6927dc53f8cb',
    checksumSha256: '0976658f89da095f77848fb99811068b48634f6a15fcd493d5fa6927dc53f8cb',
    sizeBytes: 32109,
    formattedSize: '0.0 MB',
    sizeFormatted: '0.0 MB',
    bbox: [24.50, 59.32, 25.00, 59.50],
    bounds: [24.50, 59.32, 25.00, 59.50],
    center: { lat: 59.4370, lng: 24.7535 },
    minZoom: 10,
    maxZoom: 16,
    fileName: 'tallinn.pmtiles',
    pmtiles: '/maps/tallinn.pmtiles',
    pmtilesUrl: '/maps/tallinn.pmtiles',
    downloadUrl: '/maps/tallinn.pmtiles',
    remoteUrl: '/maps/tallinn.pmtiles',
    routing: '/routing/tallinn.graph',
    routingUrl: '/routing/tallinn.graph',
    streetIndexUrl: '/maps/street-index.bin',
    artifacts: {
      basemap: { path: 'tallinn-basemap.pmtiles', sha256: '0976658f89da095f77848fb99811068b48634f6a15fcd493d5fa6927dc53f8cb', sizeBytes: 1919 },
      poi: { path: 'tallinn-poi.pmtiles', sha256: '7b9a6becd5bb5c40c400b7b851bb50f9d115b9597f6e546dcd11aa35462f168c', sizeBytes: 1919, count: 31 },
      routing: { path: 'routing.graph', sha256: 'a7f2f8d351b460fc7bf86a0b80b3df19bf7fcaa99b4607706b02f5f1fc06fd1a', sizeBytes: 5615, nodes: 97, edges: 198 },
      streetIndex: { path: 'street-index.bin', sha256: '065967d96c6c798667b859942288a91a77b775893723525d5308e1cc1c4c6a28', sizeBytes: 11328, streetCount: 36 },
      searchIndex: { path: 'search-index.bin', sha256: 'a22392f21848e4057e086c99e4f218bdd0fea679ee818bb8eb31857f9c5fe92b', sizeBytes: 11328 },
    },
    artifactsMeta: {
      basemapSha256: '0976658f89da095f77848fb99811068b48634f6a15fcd493d5fa6927dc53f8cb',
      poiSha256: '7b9a6becd5bb5c40c400b7b851bb50f9d115b9597f6e546dcd11aa35462f168c',
      routingSha256: 'a7f2f8d351b460fc7bf86a0b80b3df19bf7fcaa99b4607706b02f5f1fc06fd1a',
      streetIndexSha256: '065967d96c6c798667b859942288a91a77b775893723525d5308e1cc1c4c6a28',
      searchIndexSha256: 'a22392f21848e4057e086c99e4f218bdd0fea679ee818bb8eb31857f9c5fe92b',
    },
    sources: [
      'OSM Pedestrian & Infrastructure Network (2026)',
      'Tallinn Geoportal & Open Data',
      'Päästeamet Official Rescue & Shelter Registry',
      'Maa-amet ADS Address Register',
    ],
    source: 'OSM + Tallinn Geoportal',
    license: 'ODbL / Tallinn Open Data',
    attribution: 'HÕIMU Bioregional Resilience Data',
    description: 'Tallinn & Harjumaa Bioregional Vector Basemap & Routing Graph',
    releaseDate: '2026.09.27',
    features: ['Basemap Vector', 'POI Resilience', 'Offline Routing', 'Street Index', 'Full-Text Search', 'Estonian Localization (name:et)'],
    featureFlags: {
      streetLabels: true,
      buildings: true,
      parks: true,
      poi: true,
      offline: true,
      tacticalThemes: true,
      routingGraph: true,
    },
  },
};

/**
 * Validates PMTiles file header (magic bytes: "PMTiles" or "PM", minimum 127 bytes).
 */
export function validatePMTilesHeader(buffer: ArrayBuffer | Uint8Array): { valid: boolean; reason?: string } {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 127) {
    return {
      valid: false,
      reason: `File length ${bytes.byteLength} bytes is too short for a valid PMTiles v3 header (min 127 bytes)`,
    };
  }

  // PMTiles v3 magic: 'P' 'M' 'T' 'i' 'l' 'e' 's'
  const isPMTilesV3Magic =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x69 &&
    bytes[4] === 0x6c &&
    bytes[5] === 0x65 &&
    bytes[6] === 0x73;

  const specVersion = bytes[7];

  if (!isPMTilesV3Magic) {
    return {
      valid: false,
      reason: 'Invalid PMTiles v3 magic signature (expected "PMTiles")',
    };
  }

  if (specVersion !== 3) {
    return {
      valid: false,
      reason: `Unsupported PMTiles spec version ${specVersion} (strictly expected version 3)`,
    };
  }

  return { valid: true };
}

/**
 * Creates a synthetic minimal valid PMTiles v3 header buffer for testing/mocking.
 */
export function createMockPMTilesHeader(sizeBytes: number = 256): ArrayBuffer {
  const buffer = new ArrayBuffer(Math.max(128, sizeBytes));
  const view = new Uint8Array(buffer);
  // Write "PMTiles" magic
  const magic = [0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73, 0x03];
  magic.forEach((byte, idx) => {
    view[idx] = byte;
  });
  return buffer;
}
