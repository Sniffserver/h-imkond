/**
 * Tallinn Geoportal & Open Data Source Adapter: Fetch & Snapshot Ingestion
 * Operates with explicit SourceAdapter<RawTallinnMunicipalRecord> and immutable SourceSnapshot guarantees.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RawSourceMetadata, SourceAdapter, SourceMetadata, SourceSnapshot } from '../../types';

export interface RawTallinnMunicipalRecord {
  registri_kood: string;
  nimetus: string;
  aadress: string;
  linnaosa?: string;
  kategooria: 'joogivesi_kraan' | 'looduslik_allikas' | 'politsei' | 'paaste' | 'haigla' | 'haldus';
  koordinaadid: {
    lat: number;
    lng: number;
  };
  lahtiolekuajad?: string;
  kirjeldus?: string;
  telefon?: string;
  muutmise_kuupaev: string;
  haldaja?: string;
  omadused?: Record<string, string>;
}

export interface RawTallinnFetchResult {
  metadata: RawSourceMetadata;
  records: RawTallinnMunicipalRecord[];
  snapshot: SourceSnapshot;
}

export class TallinnSourceAdapter implements SourceAdapter<RawTallinnMunicipalRecord> {
  private snapshotPath: string;

  constructor(snapshotPath?: string) {
    this.snapshotPath = snapshotPath || path.join(process.cwd(), 'tools', 'map-data', 'snapshots', 'tallinn.snapshot.json');
  }

  public async fetch(forceLive = false): Promise<{ records: RawTallinnMunicipalRecord[]; metadata: SourceMetadata; snapshot: SourceSnapshot }> {
    const fetchedAt = process.env.SOURCE_DATE_EPOCH ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000).toISOString() : '2026-09-29T00:00:00.000Z';
    let records: RawTallinnMunicipalRecord[] = [];
    let isLiveSuccess = false;

    if (forceLive) {
      try {
        const endpoint = 'https://gis.tallinn.ee/arcgis/rest/services/Avalik/Joogiveepunktid/MapServer/0/query?where=1%3D1&outFields=*&f=geojson';
        const res = await fetch(endpoint, {
          headers: { 'User-Agent': 'HoimuMapIngestionPipeline/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const geojson: any = await res.json();
          if (Array.isArray(geojson?.features) && geojson.features.length > 0) {
            records = geojson.features.map((f: any, idx: number): RawTallinnMunicipalRecord => ({
              registri_kood: f.properties?.ID || `TLN-LIVE-${idx}`,
              nimetus: f.properties?.NIMI || 'Tallinna Avalik Joogiveepunkt',
              aadress: f.properties?.AADRESS || 'Tallinn',
              linnaosa: f.properties?.LINNAOSA,
              kategooria: 'joogivesi_kraan',
              koordinaadid: {
                lat: f.geometry?.coordinates[1] || 59.437,
                lng: f.geometry?.coordinates[0] || 24.753,
              },
              muutmise_kuupaev: fetchedAt,
              haldaja: 'Tallinna Keskkonna- ja Kommunaalamet',
            }));
            isLiveSuccess = true;
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    if (!isLiveSuccess || records.length === 0) {
      if (fs.existsSync(this.snapshotPath)) {
        const raw = JSON.parse(fs.readFileSync(this.snapshotPath, 'utf8'));
        records = raw.data || raw.records || [];
      }
    }

    const payloadStr = JSON.stringify(records);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const sourceSnapshot: SourceSnapshot = {
      provider: 'tallinn',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      snapshotId: `tln-mun-${checksum.substring(0, 12)}`,
      sourceUrl: 'https://gis.tallinn.ee',
      fetchedAt,
      sourceUpdatedAt: '2026-09-29T00:00:00.000Z',
      sha256: checksum,
      recordCount: records.length,
      license: 'Tallinna Avaandmete Litsents / Public Municipal Domain',
    };

    const metadata: SourceMetadata = {
      provider: 'tallinn',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      fetchedAt,
      sourceUrl: isLiveSuccess ? 'https://gis.tallinn.ee' : undefined,
      recordCount: records.length,
      checksum,
      license: 'Tallinna Avaandmete Litsents / Public Municipal Domain',
    };

    return { records, metadata, snapshot: sourceSnapshot };
  }
}

export async function fetchTallinnData(forceLive = false): Promise<RawTallinnFetchResult> {
  const adapter = new TallinnSourceAdapter();
  const { records, metadata, snapshot } = await adapter.fetch(forceLive);

  return {
    metadata: {
      source: 'tallinn',
      name: 'Tallinna Linnavalitsuse Geoportaal & Avaandmed',
      mode: metadata.mode,
      fetchedAt: metadata.fetchedAt,
      checksum: metadata.checksum,
      snapshotId: snapshot.snapshotId,
      recordCount: records.length,
    },
    records,
    snapshot,
  };
}

export const fetchTallinnMunicipalData = fetchTallinnData;
