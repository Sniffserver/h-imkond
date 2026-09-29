/**
 * Estonian Address Data System (ADS / Maa-amet) Normalizer
 * Builds spatial address lookups and normalized address validation indexes.
 */

import { RawAdsAddressRecord, RawAdsFetchResult } from '../sources/ads/fetch';

export interface AdsIndexEntry {
  adrId: number;
  fullAddress: string;
  shortAddress: string;
  street: string;
  houseNumber: string;
  district: string;
  lat: number;
  lng: number;
  canonicalKey: string;
}

export function buildAdsIndex(fetchResult: RawAdsFetchResult): Map<string, AdsIndexEntry> {
  const index = new Map<string, AdsIndexEntry>();

  for (const rec of fetchResult.records) {
    const canonicalKey = `${rec.tanav.toLowerCase().trim()} ${rec.majanumber.toLowerCase().trim()}`;
    const entry: AdsIndexEntry = {
      adrId: rec.adr_id,
      fullAddress: rec.taisaadress,
      shortAddress: rec.lahiaadress,
      street: rec.tanav,
      houseNumber: rec.majanumber,
      district: rec.linnaosa,
      lat: rec.lat,
      lng: rec.lng,
      canonicalKey,
    };
    index.set(canonicalKey, entry);
    index.set(rec.lahiaadress.toLowerCase().trim(), entry);
  }

  return index;
}
