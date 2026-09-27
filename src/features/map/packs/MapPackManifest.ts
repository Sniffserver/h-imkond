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
  version: string;
  routingSnapshotVersion: string;
  sha256: string;
  provenanceType?: 'official_published' | 'custom_unverified';
  isCustomUnverified?: boolean;
  pmtiles: string; // e.g. '/maps/tallinn.pmtiles'
  pmtilesUrl: string;
  poiUrl?: string;
  remoteUrl: string;
  routing: string; // e.g. '/routing/tallinn.graph'
  routingUrl: string;
  streetIndexUrl?: string;
  fileName: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  center: [number, number]; // [lat, lng]
  minZoom: number;
  maxZoom: number;
  sizeBytes: number;
  sizeFormatted: string;
  source: string;
  license: string;
  attribution: string;
  description: string;
  releaseDate: string;
  features: string[];
  featureFlags: MapPackFeatureList;
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
    region: 'Harju Biopiirkond & Pealinn',
    regionName: 'Harju Biopiirkond & Pealinn',
    version: '2026.09.26',
    routingSnapshotVersion: '2026.09.26',
    sha256: 'e2bf5b73d6bb3a61c695c885d5595c1ff59a512dd32b832e178932ea28c8f988',
    provenanceType: 'official_published',
    isCustomUnverified: false,
    pmtiles: '/maps/tallinn-basemap.pmtiles',
    pmtilesUrl: '/maps/tallinn-basemap.pmtiles',
    poiUrl: '/maps/tallinn-poi.pmtiles',
    remoteUrl: '/maps/tallinn-basemap.pmtiles',
    routing: '/routing/tallinn.graph',
    routingUrl: '/routing/tallinn.graph',
    streetIndexUrl: '/maps/street-index.bin',
    fileName: 'tallinn.pmtiles',
    center: [59.437, 24.7535],
    bounds: [24.50, 59.32, 25.00, 59.50],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 14_200_000,
    sizeFormatted: '14.2 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-26',
    description: 'Täielik Tallinna ja Harju ranniku vektorbaaskaart (Kesklinn, Mustamäe, Lasnamäe, Pirita, Nõmme, Kalamaja ja tänavavõrk).',
    features: [
      'Täielikud eestikeelsed tänavanimed (name:et)',
      'Hoonestuse 3D/2D polügoonid ja kõrgused',
      'Tallinna laht, Ülemiste järv, Pirita jõgi',
      'Elroni ja trammide rööbasteed',
      '6 taktikalist kaarditeemat (Day, Night, High-Contrast, Direct Sun, Eco, Crisis)',
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
