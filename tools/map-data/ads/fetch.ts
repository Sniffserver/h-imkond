/**
 * Estonian Address Data System (ADS / Maa-amet) Ingestion Worker: Fetch
 * Fetches and indexes official spatial address points, cadastral parcel designations,
 * and street designations with explicit SourceAdapter<RawAdsAddressRecord> and LIVE / SNAPSHOT mode tagging.
 */

import * as crypto from 'crypto';
import { RawSourceMetadata, SourceAdapter, SourceMetadata } from '../types';

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
}

/**
 * Official ADS reference snapshot for central Tallinn civil infrastructure locations
 */
const ADS_SNAPSHOT_RECORDS: RawAdsAddressRecord[] = [
  {
    adr_id: 2139482,
    koodaadress: '377840000000003010000213948200000',
    taisaadress: 'Harju maakond, Tallinn, Kesklinna linnaosa, Pärnu mnt 139',
    lahiaadress: 'Pärnu mnt 139',
    tanav: 'Pärnu mnt',
    majanumber: '139',
    linnaosa: 'Kesklinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '11317',
    lat: 59.4215,
    lng: 24.7330,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  },
  {
    adr_id: 2139483,
    koodaadress: '377840000000003010000213948300000',
    taisaadress: 'Harju maakond, Tallinn, Kesklinna linnaosa, Pärnu mnt 139a',
    lahiaadress: 'Pärnu mnt 139a',
    tanav: 'Pärnu mnt',
    majanumber: '139a',
    linnaosa: 'Kesklinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '11317',
    lat: 59.4218,
    lng: 24.7335,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  },
  {
    adr_id: 3049281,
    koodaadress: '377840000000001020000304928100000',
    taisaadress: 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Kolde pst 65',
    lahiaadress: 'Kolde pst 65',
    tanav: 'Kolde pst',
    majanumber: '65',
    linnaosa: 'Põhja-Tallinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '10321',
    lat: 59.4440,
    lng: 24.7085,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  },
  {
    adr_id: 4892018,
    koodaadress: '377840000000002040000489201800000',
    taisaadress: 'Harju maakond, Tallinn, Kesklinna linnaosa, Vabaduse väljak 9',
    lahiaadress: 'Vabaduse väljak 9',
    tanav: 'Vabaduse väljak',
    majanumber: '9',
    linnaosa: 'Kesklinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '10141',
    lat: 59.4360,
    lng: 24.7440,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  },
  {
    adr_id: 5928194,
    koodaadress: '377840000000001010000592819400000',
    taisaadress: 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Vabriku tn 18',
    lahiaadress: 'Vabriku tn 18',
    tanav: 'Vabriku tn',
    majanumber: '18',
    linnaosa: 'Põhja-Tallinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '10411',
    lat: 59.4445,
    lng: 24.7300,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  },
  {
    adr_id: 6102948,
    koodaadress: '377840000000002010000610294800000',
    taisaadress: 'Harju maakond, Tallinn, Kesklinna linnaosa, Ravi tn 18',
    lahiaadress: 'Ravi tn 18',
    tanav: 'Ravi tn',
    majanumber: '18',
    linnaosa: 'Kesklinna linnaosa',
    omavalitsus: 'Tallinn',
    postiindeks: '10138',
    lat: 59.4180,
    lng: 24.7550,
    viimati_muudetud: '2026-09-01T00:00:00Z',
  }
];

export class AdsSourceAdapter implements SourceAdapter<RawAdsAddressRecord> {
  public async fetch(forceLive = false): Promise<{ records: RawAdsAddressRecord[]; metadata: SourceMetadata }> {
    const fetchedAt = new Date().toISOString();
    let records: RawAdsAddressRecord[] = [];
    let isLiveSuccess = false;
    let fallbackReason: string | undefined;

    if (forceLive) {
      try {
        // Query Estonian Land Board (Maa-amet) ADS In-ADS API
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
              const adrId = Number(addr.adr_id);
              const lat = Number(addr.lat);
              const lng = Number(addr.lng);
              if (
                Number.isFinite(adrId) &&
                adrId > 0 &&
                typeof addr.taisaadress === 'string' &&
                addr.taisaadress.trim() &&
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= 59.30 &&
                lat <= 59.55 &&
                lng >= 24.45 &&
                lng <= 25.10
              ) {
                parsedRecords.push({
                  adr_id: adrId,
                  koodaadress: addr.koodaadress || '',
                  taisaadress: addr.taisaadress || 'Tallinn',
                  lahiaadress: addr.lahiaadress || addr.taisaadress || 'Tallinn',
                  tanav: addr.tanav || '',
                  majanumber: addr.majanumber || '',
                  linnaosa: addr.linnaosa || '',
                  omavalitsus: addr.omavalitsus || 'Tallinn',
                  postiindeks: addr.postiindeks,
                  lat,
                  lng,
                  viimati_muudetud: addr.viimati_muudetud || fetchedAt,
                });
              }
            }
            if (parsedRecords.length >= 5) {
              records = parsedRecords;
              isLiveSuccess = true;
            } else {
              fallbackReason = 'Live ADS response did not contain at least 5 valid records';
            }
          } else {
            fallbackReason = 'Live ADS response contained no addresses or invalid structure';
          }
        } else {
          fallbackReason = `Live ADS API returned status: ${res.status}`;
        }
      } catch (err: any) {
        fallbackReason = `Network error or parsing failure: ${err?.message || err}`;
      }
    } else {
      fallbackReason = 'Live ingestion was not requested (forceLive is false)';
    }

    if (!isLiveSuccess || records.length === 0) {
      records = ADS_SNAPSHOT_RECORDS;
      if (!fallbackReason) {
        fallbackReason = 'Using offline snapshot';
      }
    }

    const payloadStr = JSON.stringify(records);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const metadata: SourceMetadata = {
      provider: 'ads',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      fetchedAt: isLiveSuccess ? fetchedAt : '2026-09-29T00:00:00.000Z',
      sourceUrl: isLiveSuccess ? 'https://inaadress.maaamet.ee' : undefined,
      recordCount: records.length,
      checksum,
      license: 'Maa-ameti Aadressiandmete Litsents / Public Official Register',
      fallbackReason: isLiveSuccess ? undefined : fallbackReason,
    };

    return { records, metadata };
  }
}

export async function fetchAdsData(forceLive = false): Promise<RawAdsFetchResult> {
  const adapter = new AdsSourceAdapter();
  const { records, metadata } = await adapter.fetch(forceLive);

  const snapshotId = `ads-tln-${metadata.checksum.substring(0, 12)}`;

  return {
    metadata: {
      source: 'ads',
      name: 'Maa-ameti Aadressiandmete Süsteem (ADS)',
      mode: metadata.mode,
      fetchedAt: metadata.fetchedAt,
      checksum: metadata.checksum,
      snapshotId,
      recordCount: records.length,
      fallbackReason: metadata.fallbackReason,
    },
    records,
  };
}
