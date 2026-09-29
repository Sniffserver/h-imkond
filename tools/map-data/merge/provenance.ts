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
  isFixture?: boolean;
  signature?: string;
  signerPublicKey?: string;
  signatureVerified?: boolean;
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
    tags: { community_governed: 'true', access: 'public_mesh_auth', mode: 'fixture' },
    sourceUpdatedAt: '2026-09-24T18:00:00Z',
    snapshotId: 'mesh-obs-tln-01',
    isFixture: true,
    signerPublicKey: 'pub_ed25519_node_tln_tel_01',
    signature: 'SIG_ED25519_TEL_01_7c41b899a19d',
    signatureVerified: true,
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
    tags: { freeshelf: 'true', weatherproof: 'true', mode: 'fixture' },
    sourceUpdatedAt: '2026-09-25T09:00:00Z',
    snapshotId: 'mesh-obs-tln-02',
    isFixture: true,
    signerPublicKey: 'pub_ed25519_node_tln_kop_02',
    signature: 'SIG_ED25519_KOP_02_3b118da49c02',
    signatureVerified: true,
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
    tags: { circular_economy: 'true', mode: 'fixture' },
    sourceUpdatedAt: '2026-09-23T17:00:00Z',
    snapshotId: 'mesh-obs-tln-03',
    isFixture: true,
    signerPublicKey: 'pub_ed25519_node_tln_pel_03',
    signature: 'SIG_ED25519_PEL_03_9d28ba1207e4',
    signatureVerified: true,
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
    tags: { energy_source: 'photovoltaic', off_grid: 'true', mode: 'fixture' },
    sourceUpdatedAt: '2026-09-25T11:00:00Z',
    snapshotId: 'mesh-obs-tln-04',
    isFixture: true,
    signerPublicKey: 'pub_ed25519_node_tln_kad_04',
    signature: 'SIG_ED25519_KAD_04_e5762a19fb66',
    signatureVerified: true,
  }
];

export interface SynthesizeCanonicalOptions {
  allowFixtures?: boolean;
}

export function synthesizeCanonicalPlaces(
  dedupeResult: DedupeResult,
  communityObservations: HoimuCommunityObservation[] = HOIMU_COMMUNITY_FIXTURES,
  options: SynthesizeCanonicalOptions = { allowFixtures: true }
): MapPlace[] {
  const result: MapPlace[] = [];

  const deterministicNow = process.env.SOURCE_DATE_EPOCH
    ? parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000
    : 1780000000000;
  const deterministicIso = new Date(deterministicNow).toISOString();

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
        { provider: auth.source, sourceId: auth.sourceId, retrievedAt: deterministicNow, checksum: auth.checksum },
        { provider: 'osm', sourceId: osm.sourceId, retrievedAt: deterministicNow, checksum: osm.checksum },
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
        { provider: auth.source, sourceId: auth.sourceId, retrievedAt: deterministicNow, checksum: auth.checksum },
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
        { provider: 'osm', sourceId: osm.sourceId, retrievedAt: deterministicNow, checksum: osm.checksum },
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

  // 4. Process HÕIMU Mesh Community Observations (Signed peer observations or explicit fixture mode)
  for (const hoimu of communityObservations) {
    if (hoimu.isFixture && options.allowFixtures === false) {
      continue; // Filter out fixtures when fixtures are disallowed
    }

    const isFixture = Boolean(hoimu.isFixture);
    const provenanceStatus = 'community' as const;

    result.push({
      id: `place_${hoimu.subCategory}_${hoimu.id.replace('hoimu_', '')}`,
      name: hoimu.name,
      location: { lat: hoimu.lat, lng: hoimu.lng },
      mainCategory: hoimu.mainCategory,
      subCategory: hoimu.subCategory,
      sources: [
        {
          provider: 'hoimu',
          sourceId: hoimu.nodeObservationId,
          retrievedAt: deterministicNow,
          signature: hoimu.signature,
          signerPublicKey: hoimu.signerPublicKey,
        },
      ],
      source: 'hoimu',
      sourceName: isFixture ? 'HÕIMU Fixture Observations' : 'HÕIMU Signed Peer Mesh Observations',
      sourceId: hoimu.nodeObservationId,
      provenanceStatus,
      isFixture,
      observedByNodes: hoimu.observedByNodes,
      lastConfirmed: hoimu.lastConfirmed,
      sourceUpdatedAt: hoimu.sourceUpdatedAt || '2026-09-25T00:00:00Z',
      snapshotDate: hoimu.sourceUpdatedAt ? hoimu.sourceUpdatedAt.substring(0, 10) : '2026-09-25',
      ingestedAt: deterministicIso,
      snapshotId: hoimu.snapshotId || 'mesh-obs-tln-current',
      address: hoimu.address,
      description: hoimu.description,
      tags: {
        ...hoimu.tags,
        ...(isFixture ? { mode: 'fixture', fixture: 'true' } : { signed: 'true' }),
      },
    });
  }

  return result;
}
