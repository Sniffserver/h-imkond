/**
 * Ingestion Pipeline: Conflict & Discrepancy Detection Engine
 * Explicitly surfaces field-by-field variance between official state registers and OpenStreetMap tags.
 */

import { DataDiscrepancy } from '../../../src/types';
import { haversineDistanceMeters } from '../../../src/geo/projection';
import { NormalizedRecord, ConflictReport } from '../types';

export function detectConflicts(auth: NormalizedRecord, osm: NormalizedRecord): ConflictReport {
  const discrepancies: DataDiscrepancy[] = [];

  // 1. Address discrepancy check (e.g. cadastral parcel vs doorway entrance)
  if (
    auth.address &&
    osm.address &&
    auth.address.trim().toLowerCase() !== osm.address.trim().toLowerCase()
  ) {
    discrepancies.push({
      sourceA: auth.sourceName,
      sourceB: osm.sourceName,
      field: 'Address & Parcel Designation',
      valueA: auth.address,
      valueB: osm.address,
      warningNote: 'State registry references official land parcel; OSM tag records pedestrian entrance doorway.',
    });
  }

  // 2. Coordinate pin offset (> 15 meters)
  const offsetMeters = Math.round(haversineDistanceMeters(auth.lat, auth.lng, osm.lat, osm.lng));
  if (offsetMeters > 15) {
    discrepancies.push({
      sourceA: auth.sourceName,
      sourceB: osm.sourceName,
      field: 'Geographic Pin Offset',
      valueA: `${auth.lat.toFixed(5)}, ${auth.lng.toFixed(5)} (Parcel Center)`,
      valueB: `${osm.lat.toFixed(5)}, ${osm.lng.toFixed(5)} (${offsetMeters}m offset to entrance)`,
      warningNote: `Displacement of ${offsetMeters} meters detected between registry footprint and mapped entryway.`,
    });
  }

  // 3. Operating hours discrepancy
  if (
    auth.openingHours &&
    osm.openingHours &&
    auth.openingHours.trim().toLowerCase() !== osm.openingHours.trim().toLowerCase()
  ) {
    discrepancies.push({
      sourceA: auth.sourceName,
      sourceB: osm.sourceName,
      field: 'Operating Hours',
      valueA: auth.openingHours,
      valueB: osm.openingHours,
      warningNote: 'Registry reflects 24/7 emergency dispatch duty; OSM tag specifies public desk schedule.',
    });
  }

  const hasMismatch = discrepancies.length > 0;
  const summaryNote = hasMismatch
    ? `Discrepancy identified between ${auth.sourceName} and ${osm.sourceName} (${discrepancies.length} field variance)`
    : undefined;

  return {
    hasMismatch,
    discrepancies,
    summaryNote,
  };
}
