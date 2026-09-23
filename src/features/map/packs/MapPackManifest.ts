/**
 * HÕIMU Map Pack Manifest Definition
 * Unified specification for single-file vector basemaps (PMTiles)
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
  id: string;
  name: string;
  region: string;
  version: string;
  routingSnapshotVersion: string;
  center: [number, number]; // [lat, lng]
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  minZoom: number;
  maxZoom: number;
  sizeBytes: number;
  sizeFormatted: string;
  sha256: string;
  source: string;
  license: string;
  attribution: string;
  features: MapPackFeatureList;
  description: string;
  remoteUrl: string;
  releaseDate: string;
}

/**
 * Standard Estonian Regional Map Pack Manifests
 * Version 2026.09 (Basemap + Routing graph unified snapshot)
 */
export const MAP_PACK_MANIFESTS: Record<string, MapPackManifest> = {
  tallinn: {
    id: 'tallinn',
    name: 'Tallinn',
    region: 'Harju Biopiirkond & Pealinn',
    version: '2026.09',
    routingSnapshotVersion: '2026.09',
    center: [59.437, 24.7535],
    bounds: [24.50, 59.32, 25.00, 59.50],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 18_450_000,
    sizeFormatted: '18.4 MB',
    sha256: '8f9e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-01',
    description: 'Täielik Tallinna ja Harju ranniku vektorbaaskaart koos Kitseküla, Kesklinna, Kalamaja ja Nõmme tänavavõrguga.',
    remoteUrl: '/maps/tallinn.pmtiles',
    features: {
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
    region: 'Emajõe Biopiirkond',
    version: '2026.09',
    routingSnapshotVersion: '2026.09',
    center: [58.3780, 26.7290],
    bounds: [26.60, 58.32, 26.85, 58.42],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 12_200_000,
    sizeFormatted: '12.2 MB',
    sha256: '4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-01',
    description: 'Emajõe oru, Supilinna, Karlova ja Annelinna vektorbaaskaart ja jalgrattateede graaf.',
    remoteUrl: '/maps/tartu.pmtiles',
    features: {
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
    region: 'Liivi Lahe Biopiirkond',
    version: '2026.09',
    routingSnapshotVersion: '2026.09',
    center: [58.3859, 24.4971],
    bounds: [24.40, 58.33, 24.60, 58.44],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 8_900_000,
    sizeFormatted: '8.9 MB',
    sha256: '2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-01',
    description: 'Pärnu jõe suudme, ranna-ala ja sildade vektorbaaskaart ja evakuatsioonikoridorid.',
    remoteUrl: '/maps/parnu.pmtiles',
    features: {
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
    region: 'Virumaa Piiriala',
    version: '2026.09',
    routingSnapshotVersion: '2026.09',
    center: [59.3797, 28.1791],
    bounds: [28.10, 59.33, 28.25, 59.42],
    minZoom: 0,
    maxZoom: 15,
    sizeBytes: 8_400_000,
    sizeFormatted: '8.4 MB',
    sha256: '9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-01',
    description: 'Narva jõe kaldajoone, kindluse ja Kreenholmi piirkonna vektorbaaskaart.',
    remoteUrl: '/maps/narva.pmtiles',
    features: {
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
    region: 'Lääne-Eesti Saarestik',
    version: '2026.09',
    routingSnapshotVersion: '2026.09',
    center: [58.2534, 22.4894],
    bounds: [21.80, 57.90, 23.30, 58.70],
    minZoom: 0,
    maxZoom: 14,
    sizeBytes: 15_800_000,
    sizeFormatted: '15.8 MB',
    sha256: '5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e',
    source: 'OpenStreetMap',
    license: 'ODbL',
    attribution: '© OpenStreetMap contributors',
    releaseDate: '2026-09-01',
    description: 'Saaremaa, Muhu ja Kuressaare saarelise autonoomia vektorbaaskaart.',
    remoteUrl: '/maps/saaremaa.pmtiles',
    features: {
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
