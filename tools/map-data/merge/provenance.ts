/**
 * Ingestion Pipeline: Provenance & Synthesis Engine
 * Merges deduplicated sources into canonical MapPlace records with strict provenance guarantees.
 */

import { MapPlace } from '../../../src/types';
import { DedupeResult } from './dedupe';
import { detectConflicts } from './conflicts';
import { NormalizedRecord } from '../types';

export interface HoimuCommunityObservation {
  id: string;
  nodeObservationId: string;
  name: string;
  lat: number;
  lng: number;
  mainCategory: MapPlace['mainCategory'];
  subCategory: MapPlace['subCategory'];
  address: string;
  observedByNodes: number;
  lastConfirmed: string;
  description: string;
  tags?: Record<string, string>;
  sourceUpdatedAt?: string;
  snapshotId?: string;
}

export const HOIMU_COMMUNITY_FIXTURES: HoimuCommunityObservation[] = [
  {
    id: 'hoimu_tool_lib_telliskivi',
    nodeObservationId: 'HOIMU-NODE-TLN-TEL-01',
    name: 'Telliskivi Mutual Aid Tool Library',
    lat: 59.4395,
    lng: 24.7290,
    mainCategory: 'finds',
    subCategory: 'tool_library',
    address: 'Telliskivi 60a (Hoov), Kalamaja',
    observedByNodes: 3,
    lastConfirmed: '2026-09-24 (Yesterday)',
    description: 'Community-maintained open tool chest: angle grinders, torque wrenches, multimeter, wire strippers, bolt cutters, and socket sets.',
    tags: { community_governed: 'true', access: 'public_mesh_auth' },
    sourceUpdatedAt: '2026-09-24T18:00:00Z',
    snapshotId: 'mesh-obs-tln-01',
  },
  {
    id: 'hoimu_give_box_kopli',
    nodeObservationId: 'HOIMU-NODE-TLN-KOP-02',
    name: 'Kopli Rahvamaja Community Give Box',
    lat: 59.4530,
    lng: 24.6980,
    mainCategory: 'finds',
    subCategory: 'give_box',
    address: 'Kopli 93, Põhja-Tallinn',
    observedByNodes: 2,
    lastConfirmed: '2026-09-25 (Today)',
    description: 'Free resource box: dry sealed oats, warm socks, matchboxes, spare 18650 batteries, and water purification tablets.',
    tags: { freeshelf: 'true', weatherproof: 'true' },
    sourceUpdatedAt: '2026-09-25T09:00:00Z',
    snapshotId: 'mesh-obs-tln-02',
  },
  {
    id: 'hoimu_repair_cafe_pelgu',
    nodeObservationId: 'HOIMU-NODE-TLN-PEL-03',
    name: 'Pelgulinna Paranduskohvik (Repair Café)',
    lat: 59.4375,
    lng: 24.7140,
    mainCategory: 'finds',
    subCategory: 'repair_cafe',
    address: 'Roo 21b, Pelgulinn',
    observedByNodes: 4,
    lastConfirmed: '2026-09-23',
    description: 'Weekly community repair space with soldering stations, 3D printer for spare gears, sewing machines, and bicycle truing stand.',
    tags: { circular_economy: 'true' },
    sourceUpdatedAt: '2026-09-23T17:00:00Z',
    snapshotId: 'mesh-obs-tln-03',
  },
  {
    id: 'hoimu_solar_hub_kadriorg',
    nodeObservationId: 'HOIMU-NODE-TLN-KAD-04',
    name: 'Kadriorg Autonomous Solar & LoRa Relay Hub',
    lat: 59.4372,
    lng: 24.7935,
    mainCategory: 'energy',
    subCategory: 'solar_hub',
    address: 'Mäekalda 2, Kadriorg',
    observedByNodes: 2,
    lastConfirmed: '2026-09-25 (Today)',
    description: 'Off-grid autonomous solar and LoRa relay station with emergency device charging ports.',
    tags: { energy_source: 'photovoltaic', off_grid: 'true' },
    sourceUpdatedAt: '2026-09-25T11:00:00Z',
    snapshotId: 'mesh-obs-tln-04',
  }
];

export function synthesizeCanonicalPlaces(
  dedupeResult: DedupeResult,
  communityObservations: HoimuCommunityObservation[] = HOIMU_COMMUNITY_FIXTURES
): MapPlace[] {
  const result: MapPlace[] = [];

  // 1. Process Matched Pairs (Authoritative + OSM Candidate)
  for (const pair of dedupeResult.matchedPairs) {
    const auth = pair.primary;
    const osm = pair.secondary;
    const conflict = detectConflicts(auth, osm);

    const conflictData = conflict.hasMismatch
      ? conflict.discrepancies.map((d, i) => ({
          id: `conf_${i}_${auth.id}`,
          field: d.field,
          status: 'sources_disagree' as const,
          summary: d.warningNote || 'Sources disagree on value',
          claims: [
            { provider: auth.source, value: d.valueA, sourceName: auth.sourceName },
            { provider: 'osm' as const, value: d.valueB, sourceName: osm.sourceName },
          ],
        }))
      : undefined;

    result.push({
      id: `place_${auth.subCategory}_${auth.id.replace('auth_', '')}`,
      name: auth.name,
      location: { lat: auth.lat, lng: auth.lng },
      mainCategory: auth.mainCategory,
      subCategory: auth.subCategory,
      sources: [
        { provider: auth.source, sourceId: auth.sourceId, retrievedAt: Date.now(), checksum: auth.checksum },
        { provider: 'osm', sourceId: osm.sourceId, retrievedAt: Date.now(), checksum: osm.checksum },
      ],
      conflicts: conflictData,
      source: auth.source,
      sourceName: auth.sourceName,
      sourceId: auth.sourceId,
      secondarySource: 'osm',
      secondarySourceName: osm.sourceName,
      hasMismatch: conflict.hasMismatch,
      mismatchDetails: conflict.summaryNote,
      discrepancies: conflict.hasMismatch ? conflict.discrepancies : undefined,
      provenanceStatus: conflict.hasMismatch ? 'conflict' : 'official',
      sourceUpdatedAt: auth.sourceUpdatedAt,
      snapshotDate: auth.sourceUpdatedAt ? auth.sourceUpdatedAt.substring(0, 10) : '2026-09-26',
      ingestedAt: auth.ingestedAt,
      snapshotId: auth.snapshotId,
      checksum: auth.checksum,
      address: auth.address,
      phone: auth.phone || osm.phone,
      openingHours: auth.openingHours || osm.openingHours,
      website: auth.website || osm.website,
      description: auth.description || osm.description,
      tags: { ...auth.tags, ...osm.tags },
    });
  }

  // 2. Process Unmatched Authoritative Records (State/Municipal without OSM counterpart)
  for (const auth of dedupeResult.unmatchedAuthoritative) {
    result.push({
      id: `place_${auth.subCategory}_${auth.id.replace('auth_', '')}`,
      name: auth.name,
      location: { lat: auth.lat, lng: auth.lng },
      mainCategory: auth.mainCategory,
      subCategory: auth.subCategory,
      sources: [
        { provider: auth.source, sourceId: auth.sourceId, retrievedAt: Date.now(), checksum: auth.checksum },
      ],
      source: auth.source,
      sourceName: auth.sourceName,
      sourceId: auth.sourceId,
      provenanceStatus: 'official',
      sourceUpdatedAt: auth.sourceUpdatedAt,
      snapshotDate: auth.sourceUpdatedAt ? auth.sourceUpdatedAt.substring(0, 10) : '2026-09-26',
      ingestedAt: auth.ingestedAt,
      snapshotId: auth.snapshotId,
      checksum: auth.checksum,
      address: auth.address,
      phone: auth.phone,
      openingHours: auth.openingHours,
      website: auth.website,
      description: auth.description,
      tags: auth.tags,
    });
  }

  // 3. Process Unmatched OSM Records (Community Vector Baseline)
  for (const osm of dedupeResult.unmatchedOsm) {
    result.push({
      id: `place_${osm.subCategory}_${osm.id.replace('osm_', '')}`,
      name: osm.name,
      location: { lat: osm.lat, lng: osm.lng },
      mainCategory: osm.mainCategory,
      subCategory: osm.subCategory,
      sources: [
        { provider: 'osm', sourceId: osm.sourceId, retrievedAt: Date.now(), checksum: osm.checksum },
      ],
      source: 'osm',
      sourceName: osm.sourceName,
      sourceId: osm.sourceId,
      provenanceStatus: 'osm',
      sourceUpdatedAt: osm.sourceUpdatedAt,
      snapshotDate: osm.sourceUpdatedAt ? osm.sourceUpdatedAt.substring(0, 10) : '2026-09-26',
      ingestedAt: osm.ingestedAt,
      snapshotId: osm.snapshotId,
      checksum: osm.checksum,
      address: osm.address,
      phone: osm.phone,
      openingHours: osm.openingHours,
      website: osm.website,
      description: osm.description,
      tags: osm.tags,
    });
  }

  // 4. Process HÕIMU Mesh Community Observations (Strictly 'community', never official)
  for (const hoimu of communityObservations) {
    result.push({
      id: `place_${hoimu.subCategory}_${hoimu.id.replace('hoimu_', '')}`,
      name: hoimu.name,
      location: { lat: hoimu.lat, lng: hoimu.lng },
      mainCategory: hoimu.mainCategory,
      subCategory: hoimu.subCategory,
      sources: [
        { provider: 'hoimu', sourceId: hoimu.nodeObservationId, retrievedAt: Date.now() },
      ],
      source: 'hoimu',
      sourceName: 'HÕIMU Peer Mesh Observations',
      sourceId: hoimu.nodeObservationId,
      provenanceStatus: 'community',
      observedByNodes: hoimu.observedByNodes,
      lastConfirmed: hoimu.lastConfirmed,
      sourceUpdatedAt: hoimu.sourceUpdatedAt || '2026-09-25T00:00:00Z',
      snapshotDate: hoimu.sourceUpdatedAt ? hoimu.sourceUpdatedAt.substring(0, 10) : '2026-09-25',
      ingestedAt: new Date().toISOString(),
      snapshotId: hoimu.snapshotId || 'mesh-obs-tln-current',
      address: hoimu.address,
      description: hoimu.description,
      tags: hoimu.tags,
    });
  }

  return result;
}
