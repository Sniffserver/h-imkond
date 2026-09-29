/**
 * Tallinn Municipal Data Normalizer
 * Transforms raw Tallinn Geoportal & municipal records into canonical NormalizedRecord format.
 */

import { PlaceMainCategory, PlaceSubCategory } from '../../../src/types';
import { NormalizedRecord } from '../types';
import { RawTallinnMunicipalRecord, RawTallinnFetchResult } from '../sources/tallinn/fetch';

export function mapTallinnCategory(cat: RawTallinnMunicipalRecord['kategooria']): {
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
} {
  switch (cat) {
    case 'looduslik_allikas':
      return { mainCategory: 'water', subCategory: 'spring' };
    case 'joogivesi_kraan':
      return { mainCategory: 'water', subCategory: 'tap' };
    case 'politsei':
      return { mainCategory: 'safety', subCategory: 'police' };
    case 'paaste':
      return { mainCategory: 'safety', subCategory: 'fire_station' };
    case 'haigla':
      return { mainCategory: 'safety', subCategory: 'hospital' };
    case 'haldus':
    default:
      return { mainCategory: 'finds', subCategory: 'community_centre' };
  }
}

export function normalizeTallinnRecord(
  rec: RawTallinnMunicipalRecord,
  metadata: RawTallinnFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  const { mainCategory, subCategory } = mapTallinnCategory(rec.kategooria);

  return {
    id: `tln_${rec.registri_kood.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    source: 'tallinn',
    sourceName: `Tallinna Avaandmed (${rec.registri_kood})`,
    sourceId: rec.registri_kood,
    name: rec.nimetus,
    lat: rec.koordinaadid.lat,
    lng: rec.koordinaadid.lng,
    mainCategory,
    subCategory,
    address: rec.linnaosa ? `${rec.aadress}, ${rec.linnaosa}, Tallinn` : `${rec.aadress}, Tallinn`,
    phone: rec.telefon,
    openingHours: rec.lahtiolekuajad,
    description: rec.kirjeldus,
    tags: {
      registri_kood: rec.registri_kood,
      haldaja: rec.haldaja || 'Tallinna Linnavalitsus',
      ...(rec.omadused || {}),
    },
    sourceUpdatedAt: rec.muutmise_kuupaev,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export function normalizeTallinnBatch(fetchResult: RawTallinnFetchResult): NormalizedRecord[] {
  const ingestedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000).toISOString()
    : (fetchResult.metadata.fetchedAt || '2026-09-29T00:00:00.000Z');

  return fetchResult.records.map((rec) => normalizeTallinnRecord(rec, fetchResult.metadata, ingestedAt));
}
