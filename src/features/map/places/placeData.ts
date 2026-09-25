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

import { CANONICAL_TALLINN_PLACES, buildCanonicalMapPlaces } from './poiPipeline';

export * from './poiPipeline';
export const TALLINN_MAP_PLACES = CANONICAL_TALLINN_PLACES;
export const getTallinnMapPlaces = () => buildCanonicalMapPlaces();
