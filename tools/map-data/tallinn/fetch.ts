/**
 * Tallinn Geoportal & Open Data Ingestion Worker: Fetch
 * Queries Tallinn municipal open-data APIs and GIS feature services (joogiveekraanid, allikad, ametiasutused)
 * with explicit SourceAdapter<RawTallinnMunicipalRecord> and LIVE / SNAPSHOT mode tagging.
 */

import * as crypto from 'crypto';
import { RawSourceMetadata, SourceAdapter, SourceMetadata } from '../types';

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
}

/**
 * Official registry snapshot of Tallinn municipal points (Tallinna Keskkonna- ja Kommunaalamet / Tallinna Vesi / PPA)
 */
const TALLINN_MUNICIPAL_SNAPSHOT: RawTallinnMunicipalRecord[] = [
  {
    registri_kood: 'TLN-VESI-01',
    nimetus: 'Glehni Pargi Looduslik Allikas (Glehn Springs)',
    aadress: 'Lossi tee 13',
    linnaosa: 'Nõmme',
    kategooria: 'looduslik_allikas',
    koordinaadid: { lat: 59.3875, lng: 24.6540 },
    lahtiolekuajad: '24/7 (Looduslik vaba vool)',
    kirjeldus: 'Looduslik kõrge tootlikkusega arteesia allikas puhta joogiveega. Pidev vaba vool.',
    muutmise_kuupaev: '2026-09-14T09:00:00Z',
    haldaja: 'Tallinna Keskkonna- ja Kommunaalamet',
    omadused: { vee_tyyp: 'looduslik_allikas', joogikolblik: 'jah', vooluhulk: 'suur' }
  },
  {
    registri_kood: 'TLN-VESI-02',
    nimetus: 'Kadrioru Avalik Joogiveekraan (Kadriorg Park Tap)',
    aadress: 'August Weizenbergi 26',
    linnaosa: 'Kadriorg',
    kategooria: 'joogivesi_kraan',
    koordinaadid: { lat: 59.4385, lng: 24.7890 },
    lahtiolekuajad: '24/7 (Hooajaline mai-oktoober)',
    kirjeldus: 'Filtreeritud munitsipaal-joogivee sammas joogipudelite täitmiseks ja hüdratsiooniks.',
    muutmise_kuupaev: '2026-09-14T10:00:00Z',
    haldaja: 'AS Tallinna Vesi',
    omadused: { vee_tyyp: 'munitsipaalvesi', kraani_tyyp: 'surunupuga' }
  },
  {
    registri_kood: 'TLN-VESI-03',
    nimetus: 'Snelli Tiigi Avalik Kraan',
    aadress: 'Toompuiestee 24',
    linnaosa: 'Kesklinn',
    kategooria: 'joogivesi_kraan',
    koordinaadid: { lat: 59.4388, lng: 24.7398 },
    lahtiolekuajad: '24/7 (Mai-Oktoober)',
    kirjeldus: 'Avalik joogiveepost Snelli tiigi ja Toompargi jooksuraja ääres.',
    muutmise_kuupaev: '2026-09-14T10:30:00Z',
    haldaja: 'AS Tallinna Vesi',
    omadused: { vee_tyyp: 'munitsipaalvesi' }
  },
  {
    registri_kood: 'TLN-VESI-04',
    nimetus: 'Kalamaja Pargi Avalik Joogiveepunkt',
    aadress: 'Tööstuse 50',
    linnaosa: 'Põhja-Tallinn',
    kategooria: 'joogivesi_kraan',
    koordinaadid: { lat: 59.4510, lng: 24.7290 },
    lahtiolekuajad: '24/7 (Hooajaline)',
    kirjeldus: 'Roostevabast terasest joogiveekraan laste mänguväljaku ja kalmistupargi vahel.',
    muutmise_kuupaev: '2026-09-14T11:00:00Z',
    haldaja: 'AS Tallinna Vesi',
    omadused: { vee_tyyp: 'munitsipaalvesi' }
  },
  {
    registri_kood: 'TLN-VESI-VIRU',
    nimetus: 'Viru Väljaku Avalik Joogiveepunkt',
    aadress: 'Viru väljak 4',
    linnaosa: 'Kesklinn',
    kategooria: 'joogivesi_kraan',
    koordinaadid: { lat: 59.4365, lng: 24.7540 },
    lahtiolekuajad: '24/7 (Avalik veevõtukoht)',
    kirjeldus: 'Munitsipaal-joogiveekraan Viru Keskuse sissepääsu juures.',
    muutmise_kuupaev: '2026-09-14T11:00:00Z',
    haldaja: 'AS Tallinna Vesi',
    omadused: { vee_tyyp: 'munitsipaalvesi', joogikolblik: 'jah' }
  },
  {
    registri_kood: 'PPA-REG-TLN-01',
    nimetus: 'Põhja Prefektuur (Kesklinna Jaoskond)',
    aadress: 'Pärnu mnt 139',
    linnaosa: 'Kesklinn',
    kategooria: 'politsei',
    koordinaadid: { lat: 59.4215, lng: 24.7330 },
    lahtiolekuajad: '24/7 (Hädaabi ja valve)',
    telefon: '112 / +372 612 3000',
    kirjeldus: 'Politsei- ja Piirivalveameti Põhja prefektuuri peakorter ja Kesklinna politseijaoskond.',
    muutmise_kuupaev: '2026-09-01T08:00:00Z',
    haldaja: 'Politsei- ja Piirivalveamet',
    omadused: { staatus: 'operatiivne', varustuse_tase: 'korge' }
  },
  {
    registri_kood: 'PPA-REG-TLN-02',
    nimetus: 'Lääne-Harju Politseijaoskond (Kolde)',
    aadress: 'Kolde pst 65',
    linnaosa: 'Pelgulinn',
    kategooria: 'politsei',
    koordinaadid: { lat: 59.4398, lng: 24.7082 },
    lahtiolekuajad: '24/7',
    telefon: '112 / +372 612 5400',
    kirjeldus: 'Lääne-Harju politseijaoskond Pelgulinnas. 24/7 patrullteenistus.',
    muutmise_kuupaev: '2026-09-01T08:00:00Z',
    haldaja: 'Politsei- ja Piirivalveamet',
    omadused: { staatus: 'operatiivne' }
  },
  {
    registri_kood: 'PPA-REG-TLN-03',
    nimetus: 'Ida-Harju Politseijaoskond (Pinna)',
    aadress: 'P. Pinna 4',
    linnaosa: 'Lasnamäe',
    kategooria: 'politsei',
    koordinaadid: { lat: 59.4362, lng: 24.8395 },
    lahtiolekuajad: '24/7',
    telefon: '112 / +372 612 4800',
    kirjeldus: 'Ida-Harju politseijaoskond Lasnamäel. Patrullide juhtimiskeskus.',
    muutmise_kuupaev: '2026-09-01T08:00:00Z',
    haldaja: 'Politsei- ja Piirivalveamet',
    omadused: { staatus: 'operatiivne' }
  }
];

export class TallinnSourceAdapter implements SourceAdapter<RawTallinnMunicipalRecord> {
  public async fetch(forceLive = false): Promise<{ records: RawTallinnMunicipalRecord[]; metadata: SourceMetadata }> {
    const fetchedAt = new Date().toISOString();
    let records: RawTallinnMunicipalRecord[] = [];
    let isLiveSuccess = false;

    if (forceLive) {
      try {
        // Query Tallinn Geoportal Open Data endpoint
        const endpoint = 'https://gis.tallinn.ee/arcgis/rest/services/Avalik/Joogiveepunktid/MapServer/0/query?where=1%3D1&outFields=*&f=geojson';
        const res = await fetch(endpoint, {
          headers: { 'User-Agent': 'HoimuMapIngestionPipeline/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const geojson: any = await res.json();
          if (Array.isArray(geojson?.features) && geojson.features.length > 0) {
            const parsed = geojson.features.map((f: any, idx: number): RawTallinnMunicipalRecord => ({
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
            records = parsed;
            isLiveSuccess = true;
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    if (!isLiveSuccess || records.length === 0) {
      records = TALLINN_MUNICIPAL_SNAPSHOT;
    }

    const payloadStr = JSON.stringify(records);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const metadata: SourceMetadata = {
      provider: 'tallinn',
      mode: isLiveSuccess ? 'LIVE' : 'SNAPSHOT',
      fetchedAt: isLiveSuccess ? fetchedAt : '2026-09-29T00:00:00.000Z',
      sourceUrl: isLiveSuccess ? 'https://gis.tallinn.ee' : undefined,
      recordCount: records.length,
      checksum,
      license: 'Tallinna Avaandmete Litsents / Public Municipal Domain',
    };

    return { records, metadata };
  }
}

export async function fetchTallinnData(forceLive = false): Promise<RawTallinnFetchResult> {
  const adapter = new TallinnSourceAdapter();
  const { records, metadata } = await adapter.fetch(forceLive);

  const snapshotId = `tln-mun-${metadata.checksum.substring(0, 12)}`;

  return {
    metadata: {
      source: 'tallinn',
      name: 'Tallinna Linnavalitsuse Geoportaal & Avaandmed',
      mode: metadata.mode,
      fetchedAt: metadata.fetchedAt,
      checksum: metadata.checksum,
      snapshotId,
      recordCount: records.length,
    },
    records,
  };
}

export const fetchTallinnMunicipalData = fetchTallinnData;

