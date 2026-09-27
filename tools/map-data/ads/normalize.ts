/**
 * Estonian Address Data System (ADS) Ingestion Worker: Normalize
 * Transforms official ADS records and builds address validation indexes.
 */

import { NormalizedRecord } from '../types';
import { RawAdsAddressRecord, RawAdsFetchResult } from './fetch';

export interface AdsAddressLookupItem {
  adrId: number;
  officialFullAddress: string;
  street: string;
  houseNumber: string;
  postalCode?: string;
  district: string;
  lat: number;
  lng: number;
}

export function normalizeAdsRecord(
  raw: RawAdsAddressRecord,
  metadata: RawAdsFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  return {
    id: `ads_obj_${raw.adr_id}`,
    source: 'ads',
    sourceName: 'Maa- ja Ruumiamet ADS (Official State Address Register)',
    sourceId: String(raw.adr_id),
    name: raw.lahiaadress,
    lat: raw.lat,
    lng: raw.lng,
    mainCategory: 'finds',
    subCategory: 'other',
    address: `${raw.lahiaadress}, ${raw.linnaosa}`,
    tags: {
      koodaadress: raw.koodaadress,
      postiindeks: raw.postiindeks || '',
      omavalitsus: raw.omavalitsus,
    },
    sourceUpdatedAt: raw.viimati_muudetud,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export class AdsIndex {
  private addressMap = new Map<string, AdsAddressLookupItem>();

  constructor(records: RawAdsAddressRecord[]) {
    for (const r of records) {
      const key = `${r.tanav.toLowerCase().trim()} ${r.majanumber.toLowerCase().trim()}`;
      this.addressMap.set(key, {
        adrId: r.adr_id,
        officialFullAddress: r.taisaadress,
        street: r.tanav,
        houseNumber: r.majanumber,
        postalCode: r.postiindeks,
        district: r.linnaosa,
        lat: r.lat,
        lng: r.lng,
      });
    }
  }

  public lookup(street: string, houseNumber: string): AdsAddressLookupItem | undefined {
    const key = `${street.toLowerCase().trim()} ${houseNumber.toLowerCase().trim()}`;
    return this.addressMap.get(key);
  }

  public size(): number {
    return this.addressMap.size;
  }
}

export function buildAdsIndex(fetchResult: RawAdsFetchResult): AdsIndex {
  return new AdsIndex(fetchResult.records);
}
