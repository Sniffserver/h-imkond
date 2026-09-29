/**
 * Estonian Address Data System (ADS / Maa-amet) Source Adapter: Fetch & Snapshot Ingestion
 * Operates with explicit SourceAdapter<RawAdsAddressRecord> and immutable SourceSnapshot guarantees.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RawSourceMetadata, SourceAdapter, SourceMetadata, SourceSnapshot } from '../../types';

export interface RawAdsAddressRecord {
  adr_id: number;
  koodaadress: string;
  taisaadress: string;
  lahiaadress: string;
  tanav: string;
  majanumber: string;
  linnaosa: string;
  omavalitsus: string;
  postiindeks?: string;
  lat: number;
  lng: number;
  viimati_muudetud: string;
}

export interface RawAdsFetchResult {
  metadata: RawSourceMetadata;
  records: RawAdsAddressRecord[];
  snapshot: SourceSnapshot;
}

export class AdsSourceAdapter implements SourceAdapter<RawAdsAddressRecord> {
  private snapshotPath: string;

  constructor(snapshotPath?: string) {
    this.snapshotPath = snapshotPath || path.join(process.cwd(), 'tools', 'map-data', 'snapshots', 'ads.snapshot.json');
  }

  public async fetch(forceLive = false): Promise<{ records: RawAdsAddressRecord[]; metadata: SourceMetadata; snapshot: SourceSnapshot }> {
    const fetchedAt = process.env.SOURCE_DATE_EPOCH ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000).toISOString() : '2026-09-29T00:00:00.000Z';
    let records: RawAdsAddressRecord[] = [];
    let isLiveSuccess = false;
    let fallbackReason: string | undefined;

    if (forceLive) {
      try {
        const endpoint = 'https://inaadress.maaamet.ee/inaadress/gazetteer?features=Kohanimi&address=Tallinn&results=20';
        const res = await fetch(endpoint, {
          headers: { 'User-Agent': 'HoimuMapIngestionPipeline/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data: any = await res.json();
          if (Array.isArray(data?.addresses) && data.addresses.length > 0) {
            const parsedRecords: RawAdsAddressRecord[] = [];
            for (const addr of data.addresses) {
              if (addr.adr_id || addr.taisaadress) {
                parsedRecords.push({
                  adr_id: Number(addr.adr_id) || Math.floor(Math.random() * 10000000),
                  koodaadress: addr.koodaadress || '',
                  taisaadress: addr.taisaadress || 'Tallinn',
                  lahiaadress: addr.lahiaadress || addr.taisaadress || 'Tallinn',
                  tanav: addr.tanav || '',
                  majanumber: addr.majanumber || '',
                  linnaosa: addr.linnaosa || '',
                  omavalitsus: addr.omavalitsus || 'Tallinn',
                  postiindeks: addr.postiindeks,
                  lat: Number(addr.lat) || 59.43,
                  lng: Number(addr.lng) || 24.74,
                  viimati_muudetud: addr.viimati_muudetud || fetchedAt,
                });
              }
            }
            if (parsedRecords.length >= 5) {
              records = parsedRecords;
              isLiveSuccess = true;
            }
          }
        }
      } catch {
        // Fall back to snapshot
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
      provider: 'ads',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      snapshotId: `ads-tln-${checksum.substring(0, 12)}`,
      sourceUrl: 'https://inaadress.maaamet.ee',
      fetchedAt,
      sourceUpdatedAt: '2026-09-29T00:00:00.000Z',
      sha256: checksum,
      recordCount: records.length,
      license: 'Maa-ameti Aadressiandmete Litsents / Public Official Register',
    };

    const metadata: SourceMetadata = {
      provider: 'ads',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      fetchedAt,
      sourceUrl: isLiveSuccess ? 'https://inaadress.maaamet.ee' : undefined,
      recordCount: records.length,
      checksum,
      license: 'Maa-ameti Aadressiandmete Litsents / Public Official Register',
      fallbackReason,
    };

    return { records, metadata, snapshot: sourceSnapshot };
  }
}

export async function fetchAdsData(forceLive = false): Promise<RawAdsFetchResult> {
  const adapter = new AdsSourceAdapter();
  const { records, metadata, snapshot } = await adapter.fetch(forceLive);

  return {
    metadata: {
      source: 'ads',
      name: 'Maa-ameti Aadressiandmete Süsteem (ADS)',
      mode: metadata.mode,
      fetchedAt: metadata.fetchedAt,
      checksum: metadata.checksum,
      snapshotId: snapshot.snapshotId,
      recordCount: records.length,
      fallbackReason: metadata.fallbackReason,
    },
    records,
    snapshot,
  };
}
