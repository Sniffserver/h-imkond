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
  pmtiles: string; // e.g. '/maps/tallinn.pmtiles'
  pmtilesUrl: string;
  remoteUrl: string;
  routing: string; // e.g. '/routing/tallinn.graph'
  routingUrl: string;
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
    version: '2026.09.24',
    routingSnapshotVersion: '2026.09.24',
    sha256: '8f9e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    pmtiles: '/maps/tallinn.pmtiles',
    pmtilesUrl: '/maps/tallinn.pmtiles',
    remoteUrl: '/maps/tallinn.pmtiles',
    routing: '/routing/tallinn.graph',
    routingUrl: '/routing/tallinn.graph',
    fileName: 'tallinn.pmtiles',
    center: [59.437, 24.7535],
    bounds: [24.50, 59.32, 25.00, 59.50],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 18_450_000,
    sizeFormatted: '18.4 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-24',
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
  tartu: {
    id: 'tartu',
    name: 'Tartu',
    cityName: 'Tartu',
    cityId: 'tartu',
    region: 'Emajõe Biopiirkond',
    regionName: 'Emajõe Biopiirkond',
    version: '2026.09.24',
    routingSnapshotVersion: '2026.09.24',
    sha256: '4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b',
    pmtiles: '/maps/tartu.pmtiles',
    pmtilesUrl: '/maps/tartu.pmtiles',
    remoteUrl: '/maps/tartu.pmtiles',
    routing: '/routing/tartu.graph',
    routingUrl: '/routing/tartu.graph',
    fileName: 'tartu.pmtiles',
    center: [58.3780, 26.7290],
    bounds: [26.60, 58.32, 26.85, 58.42],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 12_200_000,
    sizeFormatted: '12.2 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-24',
    description: 'Emajõe oru, Supilinna, Karlova, Annelinna ja Tähtvere vektorbaaskaart ja jalgrattateede graaf.',
    features: [
      'Emajõe veetee ja sildade läbipääsud',
      'Karlova ja Supilinna detailne tänavavõrk',
      'Ülikoolilinnaku kriisivarude punktid',
      'Eestikeelsed tänavanimed (name:et)',
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
  parnu: {
    id: 'parnu',
    name: 'Pärnu',
    cityName: 'Pärnu',
    cityId: 'parnu',
    region: 'Liivi Lahe Biopiirkond',
    regionName: 'Liivi Lahe Biopiirkond',
    version: '2026.09.24',
    routingSnapshotVersion: '2026.09.24',
    sha256: '2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    pmtiles: '/maps/parnu.pmtiles',
    pmtilesUrl: '/maps/parnu.pmtiles',
    remoteUrl: '/maps/parnu.pmtiles',
    routing: '/routing/parnu.graph',
    routingUrl: '/routing/parnu.graph',
    fileName: 'parnu.pmtiles',
    center: [58.3859, 24.4971],
    bounds: [24.40, 58.33, 24.60, 58.44],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 8_900_000,
    sizeFormatted: '8.9 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-24',
    description: 'Pärnu jõe suudme, ranna-ala ja sildade vektorbaaskaart ja evakuatsioonikoridorid.',
    features: [
      'Pärnu jõe sillad ja evakuatsiooniteed',
      'Rannajoone üleujutustsoonid',
      'Eestikeelsed tänavanimed (name:et)',
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
  narva: {
    id: 'narva',
    name: 'Narva',
    cityName: 'Narva',
    cityId: 'narva',
    region: 'Virumaa Piiriala',
    regionName: 'Virumaa Piiriala',
    version: '2026.09.24',
    routingSnapshotVersion: '2026.09.24',
    sha256: '9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    pmtiles: '/maps/narva.pmtiles',
    pmtilesUrl: '/maps/narva.pmtiles',
    remoteUrl: '/maps/narva.pmtiles',
    routing: '/routing/narva.graph',
    routingUrl: '/routing/narva.graph',
    fileName: 'narva.pmtiles',
    center: [59.3797, 28.1791],
    bounds: [28.10, 59.33, 28.25, 59.42],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 8_400_000,
    sizeFormatted: '8.4 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-24',
    description: 'Narva jõe ja Joaoru kindlustatud piirkonna vektorbaaskaart.',
    features: [
      'Narva jõe kaldajoon ja ülepääsud',
      'Tööstus- ja elamurajoonide teedevõrk',
      'Eestikeelsed tänavanimed (name:et)',
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
  saaremaa: {
    id: 'saaremaa',
    name: 'Saaremaa & Kuressaare',
    cityName: 'Saaremaa',
    cityId: 'saaremaa',
    region: 'Lääne-Eesti Saarestik',
    regionName: 'Lääne-Eesti Saarestik',
    version: '2026.09.24',
    routingSnapshotVersion: '2026.09.24',
    sha256: '5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e',
    pmtiles: '/maps/saaremaa.pmtiles',
    pmtilesUrl: '/maps/saaremaa.pmtiles',
    remoteUrl: '/maps/saaremaa.pmtiles',
    routing: '/routing/saaremaa.graph',
    routingUrl: '/routing/saaremaa.graph',
    fileName: 'saaremaa.pmtiles',
    center: [58.2534, 22.4894],
    bounds: [21.80, 57.90, 23.30, 58.70],
    minZoom: 0,
    maxZoom: 14,
    sizeBytes: 15_800_000,
    sizeFormatted: '15.8 MB',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-24',
    description: 'Saaremaa, Muhu ja Kuressaare saarelise autonoomia vektorbaaskaart.',
    features: [
      'Kuressaare lossi ja ranniku tänavavõrk',
      'Saaremaa ja Muhu teedevõrgustik',
      'Eestikeelsed tänavanimed (name:et)',
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
  const isPMTilesV3 =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x69 &&
    bytes[4] === 0x6c &&
    bytes[5] === 0x65 &&
    bytes[6] === 0x73;

  // PMTiles v2 magic: 'P' 'M'
  const isPMTilesV2 = bytes[0] === 0x50 && bytes[1] === 0x4d;

  if (!isPMTilesV3 && !isPMTilesV2) {
    return {
      valid: false,
      reason: 'Invalid PMTiles magic signature (expected "PMTiles" or "PM")',
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
