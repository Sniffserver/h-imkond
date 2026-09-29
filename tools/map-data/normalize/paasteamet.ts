/**
 * Päästeamet (Estonian Rescue Board) Normalizer
 * Transforms official Estonian Rescue Board shelter records into canonical NormalizedRecord format.
 */

import { NormalizedRecord } from '../types';
import { RawPaasteametShelterRecord, RawPaasteametFetchResult } from '../sources/paasteamet/fetch';

export function normalizePaasteametRecord(
  rec: RawPaasteametShelterRecord,
  metadata: RawPaasteametFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  const isRescueHQ = rec.objekti_kood.startsWith('KOM-');

  return {
    id: `rescue_${rec.objekti_kood.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    source: 'paasteamet',
    sourceName: `Päästeamet (${rec.objekti_kood})`,
    sourceId: rec.objekti_kood,
    name: rec.nimetus,
    lat: rec.lat,
    lng: rec.lng,
    mainCategory: 'safety',
    subCategory: isRescueHQ ? 'fire_station' : 'shelter',
    address: `${rec.aadress}, ${rec.omavalitsus}`,
    phone: rec.kontakt_telefon || '112',
    openingHours: isRescueHQ ? '24/7' : 'Hädaolukorras avatud 24/7',
    description: rec.kirjeldus || (isRescueHQ ? 'Päästekomando ja erakorraline abi.' : `Ametlik avalik varjumiskoht. Mahutavus: ${rec.mahutavus} inimest.`),
    tags: {
      objekti_kood: rec.objekti_kood,
      mahutavus: rec.mahutavus.toString(),
      maa_alune: rec.maa_alune ? 'jah' : 'ei',
      korruselisus: rec.korruselisus || '0',
      viimati_kontrollitud: rec.viimati_kontrollitud,
    },
    sourceUpdatedAt: rec.viimati_kontrollitud,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export function normalizePaasteametBatch(fetchResult: RawPaasteametFetchResult): NormalizedRecord[] {
  const ingestedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000).toISOString()
    : (fetchResult.metadata.fetchedAt || '2026-09-29T00:00:00.000Z');

  return fetchResult.records.map((rec) => normalizePaasteametRecord(rec, fetchResult.metadata, ingestedAt));
}
