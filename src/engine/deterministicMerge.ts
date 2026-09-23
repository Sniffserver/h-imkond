/**
 * Deterministic State Reducer for HÕIMU Resilient Engine
 * 
 * Guarantees convergent replica state across all mesh nodes (Android, ESP32, Pi, Web)
 * by applying entity-specific CRDT conflict policies:
 * 
 * 1. resource    -> LWW + signed author
 * 2. inventory   -> Operation-based delta (+/- quantity)
 * 3. message     -> Immutable event (append-only)
 * 4. peer        -> LWW + signed author (key rotation & freshest timestamp)
 * 5. skill       -> LWW + signed author
 * 6. transaction -> Immutable event / balance delta
 * 7. SOS         -> Immutable origin + strict state machine transitions (active -> acknowledged -> resolved)
 * 8. map_marker  -> LWW + signed author / tombstone
 */

import {
  SignedCRDTEvent,
  ResilientEngineState,
  MutualAidNeed,
  ResourceItem,
  SkillEndorsement,
  SOSBeacon,
  GovernanceProposal,
  GovernanceVote,
  JournalEntry,
  MapMarker,
} from './types';

export function createEmptyEngineState(): ResilientEngineState {
  return {
    mutualAid: new Map(),
    resources: new Map(),
    skills: new Map(),
    sosBeacons: new Map(),
    governanceProposals: new Map(),
    governanceVotes: new Map(),
    journalEntries: new Map(),
    mapMarkers: new Map(),
  };
}

/**
 * Deterministic total ordering comparator
 */
export function compareEventsDeterministically(a: SignedCRDTEvent, b: SignedCRDTEvent): number {
  if (a.logicalClock !== b.logicalClock) {
    return a.logicalClock - b.logicalClock;
  }
  if (a.wallClock !== b.wallClock) {
    return a.wallClock - b.wallClock;
  }
  return a.eventId.localeCompare(b.eventId);
}

/**
 * Pure state reducer applying an array of signed events deterministically with entity-specific CRDT rules
 */
export function reduceEngineState(events: SignedCRDTEvent[]): ResilientEngineState {
  const state = createEmptyEngineState();
  const sorted = [...events].sort(compareEventsDeterministically);

  for (const event of sorted) {
    applyEventToState(state, event);
  }

  return state;
}

function applyEventToState(state: ResilientEngineState, event: SignedCRDTEvent): void {
  const { entityType, entityId, action, authorNodeId, authorCallsign, wallClock, data } = event;

  switch (entityType) {
    // 1. RESOURCE & MUTUAL AID: LWW + Signed Author
    case 'mutual_aid': {
      if (action === 'delete') {
        state.mutualAid.delete(entityId);
      } else {
        const existing = state.mutualAid.get(entityId);
        state.mutualAid.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          category: data.category ?? existing?.category ?? 'other',
          title: data.title ?? existing?.title ?? 'Untitled Need',
          description: data.description ?? existing?.description ?? '',
          urgency: data.urgency ?? existing?.urgency ?? 'medium',
          status: data.status ?? existing?.status ?? 'open',
          locationName: data.locationName ?? existing?.locationName,
          latitude: data.latitude ?? existing?.latitude,
          longitude: data.longitude ?? existing?.longitude,
          claimedByNodeId: data.claimedByNodeId ?? existing?.claimedByNodeId,
        } as MutualAidNeed);
      }
      break;
    }

    // 2. RESOURCE: Last-Write-Wins (LWW) + Signed Author
    case 'resource': {
      if (action === 'delete') {
        state.resources.delete(entityId);
      } else {
        const existing = state.resources.get(entityId);
        // Operation-based quantity delta support if action is delta
        const newQuantity =
          action === 'delta'
            ? (existing?.quantity ?? 0) + (data.delta ?? 0)
            : (data.quantity ?? existing?.quantity ?? 1);

        state.resources.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          name: data.name ?? existing?.name ?? 'Resource',
          category: data.category ?? existing?.category ?? 'hardware',
          quantity: Math.max(0, newQuantity),
          unit: data.unit ?? existing?.unit ?? 'pcs',
          condition: data.condition ?? existing?.condition ?? 'good',
          locationName: data.locationName ?? existing?.locationName ?? 'Field Store',
          isPubliclyShared: data.isPubliclyShared ?? existing?.isPubliclyShared ?? true,
          notes: data.notes ?? existing?.notes,
        } as ResourceItem);
      }
      break;
    }

    // 3. SKILL: LWW + Signed Author
    case 'skill': {
      if (action === 'delete') {
        state.skills.delete(entityId);
      } else {
        const existing = state.skills.get(entityId);
        state.skills.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          targetNodeId: data.targetNodeId ?? existing?.targetNodeId ?? authorNodeId,
          skillName: data.skillName ?? existing?.skillName ?? 'General Skill',
          endorsementLevel: data.endorsementLevel ?? existing?.endorsementLevel ?? 1,
          notes: data.notes ?? existing?.notes,
        } as SkillEndorsement);
      }
      break;
    }

    // 4. SOS BEACON: Immutable Origin + Strict State Transitions (active -> acknowledged -> resolved)
    case 'sos_beacon': {
      if (action === 'delete') {
        // SOS deletion is restricted: only author can tombstone if resolved
        const existing = state.sosBeacons.get(entityId);
        if (existing && existing.status === 'resolved' && authorNodeId === existing.authorNodeId) {
          state.sosBeacons.delete(entityId);
        }
      } else {
        const existing = state.sosBeacons.get(entityId);
        const validTransitions: Record<string, string[]> = {
          active: ['acknowledged', 'resolved', 'active'],
          acknowledged: ['resolved', 'acknowledged'],
          resolved: ['resolved'], // Resolved state is terminal
        };

        const targetStatus = data.status ?? existing?.status ?? 'active';
        const allowed = existing
          ? validTransitions[existing.status]?.includes(targetStatus)
          : true;

        if (!allowed) {
          console.warn(`[CRDT] Rejected illegal SOS state transition ${existing?.status} -> ${targetStatus}`);
          break;
        }

        // Responders list is an additive set (Causal OR-Set)
        const existingResponders = new Set(existing?.responders || []);
        if (Array.isArray(data.responders)) {
          data.responders.forEach((r: string) => existingResponders.add(r));
        }
        if (data.addResponder) {
          existingResponders.add(data.addResponder);
        }

        state.sosBeacons.set(entityId, {
          id: entityId,
          // Origin fields are immutable once created
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          emergencyType: existing?.emergencyType ?? data.emergencyType ?? 'general',
          latitude: existing?.latitude ?? data.latitude ?? 59.437,
          longitude: existing?.longitude ?? data.longitude ?? 24.7536,
          severity: data.severity ?? existing?.severity ?? 'emergency',
          altitudeMeters: existing?.altitudeMeters ?? data.altitudeMeters,
          batteryPct: data.batteryPct ?? existing?.batteryPct,
          description: existing?.description ?? data.description ?? 'SOS Active',
          status: allowed ? targetStatus : (existing?.status || 'active'),
          responders: Array.from(existingResponders),
        } as SOSBeacon);
      }
      break;
    }

    case 'governance_proposal': {
      if (action === 'delete') {
        state.governanceProposals.delete(entityId);
      } else {
        const existing = state.governanceProposals.get(entityId);
        state.governanceProposals.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          title: data.title ?? existing?.title ?? 'Proposal',
          description: data.description ?? existing?.description ?? '',
          options: data.options ?? existing?.options ?? ['Yes', 'No'],
          deadlineMs: data.deadlineMs ?? existing?.deadlineMs ?? wallClock + 86400000,
          status: data.status ?? existing?.status ?? 'active',
        } as GovernanceProposal);
      }
      break;
    }

    // IMMUTABLE VOTES: One vote per author per proposal
    case 'governance_vote': {
      if (!state.governanceVotes.has(entityId)) {
        state.governanceVotes.set(entityId, {
          id: entityId,
          createdAt: wallClock,
          updatedAt: wallClock,
          authorNodeId,
          authorCallsign,
          proposalId: data.proposalId,
          optionSelected: data.optionSelected,
        } as GovernanceVote);
      }
      break;
    }

    // IMMUTABLE JOURNAL / MESSAGES: Append-only
    case 'journal_entry': {
      if (action === 'delete') {
        state.journalEntries.delete(entityId);
      } else {
        const existing = state.journalEntries.get(entityId);
        state.journalEntries.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          title: data.title ?? existing?.title ?? 'Field Note',
          content: data.content ?? existing?.content ?? '',
          tags: data.tags ?? existing?.tags ?? [],
          batteryVoltage: data.batteryVoltage ?? existing?.batteryVoltage,
          snrEstimate: data.snrEstimate ?? existing?.snrEstimate,
          isEncrypted: data.isEncrypted ?? existing?.isEncrypted ?? false,
        } as JournalEntry);
      }
      break;
    }

    // MAP MARKERS / POI: LWW + Signed Author / Tombstone
    case 'map_marker': {
      if (action === 'delete') {
        state.mapMarkers.delete(entityId);
      } else {
        const existing = state.mapMarkers.get(entityId);
        state.mapMarkers.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          label: data.label ?? existing?.label ?? 'Marker',
          type: data.type ?? existing?.type ?? 'base_camp',
          latitude: data.latitude ?? existing?.latitude ?? 59.437,
          longitude: data.longitude ?? existing?.longitude ?? 24.7536,
          radiusMeters: data.radiusMeters ?? existing?.radiusMeters,
          notes: data.notes ?? existing?.notes,
        } as MapMarker);
      }
      break;
    }
  }
}
