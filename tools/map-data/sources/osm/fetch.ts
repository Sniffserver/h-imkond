/**
 * OpenStreetMap (OSM) Source Adapter: Fetch & Snapshot Ingestion
 * Operates with explicit SourceAdapter<RawOsmElement> and immutable SourceSnapshot guarantees.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TALLINN_BBOX, RawSourceMetadata, SourceAdapter, SourceMetadata, SourceSnapshot } from '../../types';

export interface RawOsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  timestamp?: string;
  version?: number;
}

export interface RawOsmFetchResult {
  metadata: RawSourceMetadata;
  elements: RawOsmElement[];
  snapshot: SourceSnapshot;
}

export function buildOverpassQuery(bbox = TALLINN_BBOX): string {
  const bboxStr = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
  return `
    [out:json][timeout:35];
    (
      node["amenity"="police"](${bboxStr});
      node["amenity"="hospital"](${bboxStr});
      node["amenity"="pharmacy"](${bboxStr});
      node["amenity"="drinking_water"](${bboxStr});
      node["amenity"="shelter"](${bboxStr});
      node["natural"="spring"](${bboxStr});
      node["shop"~"hardware|doityourself|bicycle|supermarket|second_hand"](${bboxStr});
      way["amenity"~"hospital|police|pharmacy"](${bboxStr});
      way["shop"~"supermarket|hardware"](${bboxStr});
    );
    out center tags qt;
  `.trim();
}

export class OsmSourceAdapter implements SourceAdapter<RawOsmElement> {
  private snapshotPath: string;

  constructor(snapshotPath?: string) {
    this.snapshotPath = snapshotPath || path.join(process.cwd(), 'tools', 'map-data', 'snapshots', 'osm.snapshot.json');
  }

  public async fetch(forceLive = false): Promise<{ records: RawOsmElement[]; metadata: SourceMetadata; snapshot: SourceSnapshot }> {
    const fetchedAt = process.env.SOURCE_DATE_EPOCH ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000).toISOString() : '2026-09-29T00:00:00.000Z';
    let elements: RawOsmElement[] = [];
    let isLiveSuccess = false;

    if (forceLive) {
      try {
        const query = buildOverpassQuery(TALLINN_BBOX);
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'HoimuMapIngestionPipeline/1.0 (Tallinn Local Mesh)' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.elements) && data.elements.length > 0) {
            elements = data.elements;
            isLiveSuccess = true;
          }
        }
      } catch {
        // Fall through to snapshot
      }
    }

    if (!isLiveSuccess || elements.length === 0) {
      if (fs.existsSync(this.snapshotPath)) {
        const raw = JSON.parse(fs.readFileSync(this.snapshotPath, 'utf8'));
        elements = raw.data || raw.elements || [];
      }
    }

    const payloadStr = JSON.stringify(elements);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const sourceSnapshot: SourceSnapshot = {
      provider: 'osm',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      snapshotId: `osm-tln-${checksum.substring(0, 12)}`,
      sourceUrl: 'https://overpass-api.de/api/interpreter',
      fetchedAt,
      sourceUpdatedAt: '2026-09-29T00:00:00.000Z',
      sha256: checksum,
      recordCount: elements.length,
      license: 'ODbL 1.0 (OpenStreetMap contributors)',
    };

    const metadata: SourceMetadata = {
      provider: 'osm',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      fetchedAt,
      sourceUrl: isLiveSuccess ? 'https://overpass-api.de/api/interpreter' : undefined,
      recordCount: elements.length,
      checksum,
      license: 'ODbL 1.0 (OpenStreetMap contributors)',
    };

    return { records: elements, metadata, snapshot: sourceSnapshot };
  }
}

export async function fetchOsmData(bbox = TALLINN_BBOX, forceLive = false): Promise<RawOsmFetchResult> {
  const adapter = new OsmSourceAdapter();
  const { records, metadata, snapshot } = await adapter.fetch(forceLive);

  return {
    metadata: {
      source: 'osm',
      name: 'OpenStreetMap Overpass API (Tallinn Bounding Box)',
      mode: metadata.mode,
      fetchedAt: metadata.fetchedAt,
      checksum: metadata.checksum,
      snapshotId: snapshot.snapshotId,
      recordCount: records.length,
    },
    elements: records,
    snapshot,
  };
}
