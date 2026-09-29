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

import tallinnGeneratedManifest from '../../../data/generated/manifest.json';

/**
 * Single Source of Truth for all Estonian Regional Map Packs.
 * Generated build artifact definitions matching actual PMTiles distribution.
 */
export const MAP_PACK_MANIFESTS: Record<string, MapPackManifest> = {
  tallinn: tallinnGeneratedManifest as any,
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
