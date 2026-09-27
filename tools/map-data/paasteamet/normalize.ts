/**
 * Päästeamet Ingestion Worker: Normalize
 * Normalizes official Rescue Board shelter and command records into canonical NormalizedRecord format.
 */

import { PlaceMainCategory, PlaceSubCategory } from '../../../src/types';
import { NormalizedRecord } from '../types';
import { RawPaasteametShelterRecord, RawPaasteametFetchResult } from './fetch';

export function mapPaasteametCategory(code: string): {
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
} {
  if (code.startsWith('VARJ')) {
    return { mainCategory: 'safety', subCategory: 'shelter' };
  }
  if (code.startsWith('KOM')) {
    return { mainCategory: 'safety', subCategory: 'fire_station' };
  }
  if (code.startsWith('EMO') || code.startsWith('HAIG')) {
    return { mainCategory: 'safety', subCategory: 'hospital' };
  }
  return { mainCategory: 'safety', subCategory: 'shelter' };
}

export function normalizePaasteametRecord(
  raw: RawPaasteametShelterRecord,
  metadata: RawPaasteametFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  const { mainCategory, subCategory } = mapPaasteametCategory(raw.objekti_kood);
  const address = `${raw.aadress}, ${raw.omavalitsus}`;

  const tags: Record<string, string> = {
    official_code: raw.objekti_kood,
    authority: 'Päästeamet',
    subterranean: raw.maa_alune ? 'true' : 'false',
  };

  if (raw.mahutavus > 0) {
    tags.capacity = String(raw.mahutavus);
  }
  if (raw.korruselisus) {
    tags.level = raw.korruselisus;
  }

  return {
    id: `auth_paaste_${raw.objekti_kood.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    source: 'paasteamet',
    sourceName: 'Päästeamet (Estonian Rescue Board)',
    sourceId: raw.objekti_kood,
    name: raw.nimetus,
    lat: raw.lat,
    lng: raw.lng,
    mainCategory,
    subCategory,
    address,
    phone: raw.kontakt_telefon,
    openingHours: subCategory === 'shelter' ? '24/7 (Kriisiolukorras või häire korral avatud)' : '24/7',
    description: raw.kirjeldus,
    tags,
    sourceUpdatedAt: raw.viimati_kontrollitud,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export function normalizePaasteametBatch(fetchResult: RawPaasteametFetchResult): NormalizedRecord[] {
  const ingestedAt = new Date().toISOString();
  return fetchResult.records.map((r) => normalizePaasteametRecord(r, fetchResult.metadata, ingestedAt));
}
