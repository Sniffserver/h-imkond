/**
 * Tallinn Open Data Ingestion Worker: Normalize
 * Maps municipal service records into canonical NormalizedRecord format.
 */

import { PlaceMainCategory, PlaceSubCategory, DataSource } from '../../../src/types';
import { NormalizedRecord } from '../types';
import { RawTallinnMunicipalRecord, RawTallinnFetchResult } from './fetch';

export function mapTallinnCategory(category: RawTallinnMunicipalRecord['kategooria']): {
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
  source: DataSource;
  sourceName: string;
} {
  switch (category) {
    case 'looduslik_allikas':
      return {
        mainCategory: 'water',
        subCategory: 'spring',
        source: 'tallinn',
        sourceName: 'Tallinn Open Data (Keskkonna- ja Kommunaalamet)',
      };
    case 'joogivesi_kraan':
      return {
        mainCategory: 'water',
        subCategory: 'tap',
        source: 'tallinn',
        sourceName: 'Tallinn Open Data (AS Tallinna Vesi)',
      };
    case 'politsei':
      return {
        mainCategory: 'safety',
        subCategory: 'police',
        source: 'ppa',
        sourceName: 'Politsei- ja Piirivalveamet (PPA Official Register)',
      };
    case 'paaste':
      return {
        mainCategory: 'safety',
        subCategory: 'fire_station',
        source: 'paasteamet',
        sourceName: 'Päästeamet (Estonian Rescue Board)',
      };
    case 'haigla':
      return {
        mainCategory: 'safety',
        subCategory: 'hospital',
        source: 'tallinn',
        sourceName: 'Tervisekassa / Tallinna Haiglavõrk',
      };
    default:
      return {
        mainCategory: 'safety',
        subCategory: 'emergency_services',
        source: 'tallinn',
        sourceName: 'Tallinna Linnavalitsus',
      };
  }
}

export function normalizeTallinnRecord(
  raw: RawTallinnMunicipalRecord,
  metadata: RawTallinnFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  const { mainCategory, subCategory, source, sourceName } = mapTallinnCategory(raw.kategooria);
  const address = raw.linnaosa ? `${raw.aadress}, ${raw.linnaosa}` : `${raw.aadress}, Tallinn`;

  return {
    id: `auth_${source}_${raw.registri_kood.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    source,
    sourceName,
    sourceId: raw.registri_kood,
    name: raw.nimetus,
    lat: raw.koordinaadid.lat,
    lng: raw.koordinaadid.lng,
    mainCategory,
    subCategory,
    address,
    phone: raw.telefon,
    openingHours: raw.lahtiolekuajad,
    description: raw.kirjeldus,
    tags: raw.omadused,
    sourceUpdatedAt: raw.muutmise_kuupaev,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export function normalizeTallinnBatch(fetchResult: RawTallinnFetchResult): NormalizedRecord[] {
  const ingestedAt = new Date().toISOString();
  return fetchResult.records.map((r) => normalizeTallinnRecord(r, fetchResult.metadata, ingestedAt));
}
