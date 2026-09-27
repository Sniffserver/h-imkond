/**
 * Canonical Tallinn MapPlace Database
 * Unified Universal POI Pipeline with Explicit Multi-Source Provenance & Deduplication
 * 
 * Sources:
 * - Politsei- ja Piirivalveamet (PPA): Authoritative state law enforcement registers
 * - Päästeamet: Authoritative public shelters, civil defense, emergency medical & hydrants
 * - Tallinn Open Data: Municipal spatial assets, natural water springs, libraries, parks & transit
 * - OpenStreetMap: Commercial stores, hardware, supermarkets, bicycle shops & pharmacies
 * - HÕIMU / Community: Mutual aid tool libraries, give boxes, public bookcases, repair cafes & solar hubs
 */

import generatedPlaces from '../../../data/generated/tallinn-places.json';
import { CANONICAL_TALLINN_PLACES, buildCanonicalMapPlaces } from './poiPipeline';
import { MapPlace } from '../../../types';

export * from './poiPipeline';
const rawPlaces: MapPlace[] = Array.isArray(generatedPlaces) && generatedPlaces.length > 0
  ? (generatedPlaces as MapPlace[])
  : CANONICAL_TALLINN_PLACES;

export const TALLINN_MAP_PLACES: MapPlace[] = rawPlaces.map((p) => ({
  ...p,
  sources: p.sources && p.sources.length > 0
    ? p.sources
    : [{ provider: p.source || 'osm', sourceId: p.sourceId || p.id, retrievedAt: Date.now() }],
}));

export const getTallinnMapPlaces = (): MapPlace[] => TALLINN_MAP_PLACES;
