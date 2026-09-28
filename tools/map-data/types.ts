/**
 * HÕIMU Map Ingestion Pipeline: Core Types & Interfaces
 * Governs multi-source spatial data ingestion, normalization, cross-validation, and artifact generation.
 */

import { MapPlace, DataSource, PlaceMainCategory, PlaceSubCategory, DataDiscrepancy } from '../../src/types';

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export const TALLINN_BBOX: BoundingBox = {
  minLng: 24.50,
  minLat: 59.32,
  maxLng: 25.00,
  maxLat: 59.50,
};

export interface SourceMetadata {
  provider: 'osm' | 'tallinn' | 'paasteamet' | 'ads';
  mode: 'LIVE' | 'SNAPSHOT' | 'FIXTURE';
  fetchedAt: string;
  sourceUrl?: string;
  recordCount: number;
  checksum: string;
  license: string;
}

export interface SourceAdapter<T> {
  fetch(forceLive?: boolean): Promise<{
    records: T[];
    metadata: SourceMetadata;
  }>;
}

export interface RawSourceMetadata {
  source: DataSource;
  name: string;
  url?: string;
  mode?: 'LIVE' | 'SNAPSHOT' | 'FIXTURE';
  fetchedAt: string;
  checksum: string;
  snapshotId: string;
  recordCount: number;
}

export interface NormalizedRecord {
  id: string;
  source: DataSource;
  sourceName: string;
  sourceId: string;
  name: string;
  lat: number;
  lng: number;
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
  address: string;
  phone?: string;
  openingHours?: string;
  website?: string;
  description?: string;
  tags?: Record<string, string>;
  sourceUpdatedAt: string;
  ingestedAt: string;
  snapshotId: string;
  checksum?: string;
  observedByNodes?: number;
  lastConfirmed?: string;
}

export interface ValidationIssue {
  recordId: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface DedupeMatch {
  primary: NormalizedRecord;
  secondary: NormalizedRecord;
  distanceMeters: number;
  nameSimilarity: number;
}

export interface ConflictReport {
  hasMismatch: boolean;
  discrepancies: DataDiscrepancy[];
  summaryNote?: string;
}

export interface ArtifactFileSpec {
  filename: string;
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface ManifestSourceEntry {
  provider: string;
  snapshot: string;
  license: string;
}

export interface GeneratedManifest {
  id?: string;
  region: string;
  version: string;
  generatedAt: string;
  sources?: ManifestSourceEntry[];
  artifacts?: {
    basemap: {
      path: string;
      sha256: string;
      sizeBytes: number;
    };
    poi: {
      path: string;
      sha256: string;
      sizeBytes: number;
      index?: string;
      count?: number;
    };
    routing: {
      path: string;
      sha256: string;
      sizeBytes?: number;
      nodes?: number;
      edges?: number;
    };
    streetIndex: {
      path: string;
      sha256: string;
      sizeBytes?: number;
      streetCount?: number;
    };
    searchIndex?: {
      path: string;
      sha256: string;
      sizeBytes?: number;
    };
  };
  basemap: {
    filename: string;
    sha256: string;
    sizeBytes: number;
  };
  poi: {
    filename: string;
    index: string;
    sha256: string;
    sizeBytes: number;
    count: number;
  };
  routing: {
    filename: string;
    sha256: string;
    sizeBytes: number;
    nodes: number;
    edges: number;
  };
  streetIndex: {
    filename: string;
    sha256: string;
    sizeBytes: number;
    streetCount: number;
  };
  searchIndex?: {
    filename: string;
    sha256: string;
    sizeBytes: number;
  };
}
