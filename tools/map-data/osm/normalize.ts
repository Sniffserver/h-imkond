/**
 * OpenStreetMap (OSM) Ingestion Worker: Normalize
 * Transforms raw OSM nodes & ways into canonical NormalizedRecord format.
 */

import { PlaceMainCategory, PlaceSubCategory } from '../../../src/types';
import { NormalizedRecord } from '../types';
import { RawOsmElement, RawOsmFetchResult } from './fetch';

export function mapOsmTagsToCategory(tags: Record<string, string>): {
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
} {
  const amenity = tags.amenity?.toLowerCase();
  const shop = tags.shop?.toLowerCase();
  const natural = tags.natural?.toLowerCase();

  if (amenity === 'police') return { mainCategory: 'safety', subCategory: 'police' };
  if (amenity === 'hospital' || tags.healthcare === 'hospital') return { mainCategory: 'safety', subCategory: 'hospital' };
  if (amenity === 'pharmacy' || tags.healthcare === 'pharmacy') return { mainCategory: 'safety', subCategory: 'pharmacy' };
  if (amenity === 'shelter' || tags.shelter_type) return { mainCategory: 'safety', subCategory: 'shelter' };
  if (amenity === 'fire_station') return { mainCategory: 'safety', subCategory: 'fire_station' };
  if (amenity === 'drinking_water') return { mainCategory: 'water', subCategory: 'tap' };
  if (natural === 'spring') return { mainCategory: 'water', subCategory: 'spring' };

  if (shop === 'hardware' || shop === 'doityourself') return { mainCategory: 'tools', subCategory: 'hardware' };
  if (shop === 'bicycle') return { mainCategory: 'tools', subCategory: 'bicycle_shop' };
  if (shop === 'supermarket') return { mainCategory: 'stores', subCategory: 'supermarket' };
  if (shop === 'second_hand' || shop === 'charity') return { mainCategory: 'finds', subCategory: 'second_hand' };

  return { mainCategory: 'finds', subCategory: 'other' };
}

export function formatOsmAddress(tags: Record<string, string>): string {
  const street = tags['addr:street'];
  const number = tags['addr:housenumber'];
  const district = tags['addr:district'] || tags['addr:suburb'];
  const city = tags['addr:city'] || 'Tallinn';

  if (!street && !number) {
    return district ? `${district}, ${city}` : city;
  }

  const baseAddr = number ? `${street} ${number}` : street;
  return district ? `${baseAddr}, ${district}` : `${baseAddr}, ${city}`;
}

export function normalizeOsmRecord(
  element: RawOsmElement,
  metadata: RawOsmFetchResult['metadata'],
  ingestedAt: string
): NormalizedRecord {
  const tags = element.tags || {};
  const { mainCategory, subCategory } = mapOsmTagsToCategory(tags);
  const osmId = `${element.type}/${element.id}`;
  const address = formatOsmAddress(tags);

  const sourceUpdatedAt = element.timestamp || new Date(Date.now() - 7 * 86400000).toISOString();

  return {
    id: `osm_${element.type}_${element.id}`,
    source: 'osm',
    sourceName: `OpenStreetMap (${osmId})`,
    sourceId: osmId,
    name: tags.name || tags['name:et'] || tags['name:en'] || `OSM ${subCategory} #${element.id}`,
    lat: element.lat,
    lng: element.lon,
    mainCategory,
    subCategory,
    address,
    phone: tags.phone || tags['contact:phone'],
    openingHours: tags.opening_hours,
    website: tags.website || tags['contact:website'],
    description: tags.description || tags['description:et'],
    tags,
    sourceUpdatedAt,
    ingestedAt,
    snapshotId: metadata.snapshotId,
    checksum: metadata.checksum.substring(0, 16),
  };
}

export function normalizeOsmBatch(fetchResult: RawOsmFetchResult): NormalizedRecord[] {
  const ingestedAt = new Date().toISOString();
  return fetchResult.elements
    .filter((el) => el.tags && (el.tags.name || el.tags.amenity || el.tags.shop || el.tags.natural))
    .map((el) => normalizeOsmRecord(el, fetchResult.metadata, ingestedAt));
}
