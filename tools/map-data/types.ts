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

export interface SourceSnapshot {
  provider: string;
  mode: 'LIVE' | 'SNAPSHOT' | 'FIXTURE';
  snapshotId: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceUpdatedAt?: string;
  sha256: string;
  recordCount: number;
  license: string;
}

export interface SourceMetadata {
  provider: 'osm' | 'tallinn' | 'paasteamet' | 'ads';
  mode: 'LIVE' | 'SNAPSHOT' | 'FIXTURE' | 'FAILED';
  fetchedAt: string;
  sourceUrl?: string;
  recordCount: number;
  checksum: string;
  license: string;
  fallbackReason?: string;
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
  mode?: 'LIVE' | 'SNAPSHOT' | 'FIXTURE' | 'FAILED';
  fetchedAt: string;
  checksum: string;
  snapshotId: string;
  recordCount: number;
  fallbackReason?: string;
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

export interface SourceManifest {
  provider: string;
  snapshot: string;
  license: string;
}

export interface ArtifactManifest {
  filename?: string;
  path: string;
  sha256: string;
  sizeBytes: number;
  index?: string;
  count?: number;
  nodes?: number;
  edges?: number;
  streetCount?: number;
}

export interface MapPackManifest {
  id?: string;
  generationId: string;
  region: string;
  version: string;
  generatedAt: string;

  sources: SourceManifest[];

  artifacts: {
    basemap: ArtifactManifest;
    poi: ArtifactManifest;
    routing: ArtifactManifest;
    streetIndex: ArtifactManifest;
    searchIndex: ArtifactManifest;
  };

  basemap?: ArtifactManifest;
  poi?: ArtifactManifest;
  routing?: ArtifactManifest;
  streetIndex?: ArtifactManifest;
  searchIndex?: ArtifactManifest;

  compatibility: {
    mapSchema: number;
    routingSchema: number;
    streetSchema: number;
    searchSchema: number;
  };
}

export type ManifestSourceEntry = SourceManifest;
export type GeneratedManifest = MapPackManifest;
