/**
 * Deterministic State Reducer for HÕIMU Resilient Engine
 * 
 * Guarantees convergent replica state across all mesh nodes (Android, ESP32, Pi, Web)
 * by applying total ordering over cryptographically verified events:
 * 1. Logical Clock (Lamport timestamp)
 * 2. Wall Clock (UTC ms timestamp)
 * 3. Event ID (Lexicographical tie-breaker)
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
 * Pure state reducer applying an array of signed events deterministically
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

    case 'resource': {
      if (action === 'delete') {
        state.resources.delete(entityId);
      } else {
        const existing = state.resources.get(entityId);
        state.resources.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          name: data.name ?? existing?.name ?? 'Resource',
          category: data.category ?? existing?.category ?? 'hardware',
          quantity: data.quantity ?? existing?.quantity ?? 1,
          unit: data.unit ?? existing?.unit ?? 'pcs',
          condition: data.condition ?? existing?.condition ?? 'good',
          locationName: data.locationName ?? existing?.locationName ?? 'Field Store',
          isPubliclyShared: data.isPubliclyShared ?? existing?.isPubliclyShared ?? true,
          notes: data.notes ?? existing?.notes,
        } as ResourceItem);
      }
      break;
    }

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

    case 'sos_beacon': {
      if (action === 'delete') {
        state.sosBeacons.delete(entityId);
      } else {
        const existing = state.sosBeacons.get(entityId);
        state.sosBeacons.set(entityId, {
          id: entityId,
          createdAt: existing?.createdAt ?? wallClock,
          updatedAt: wallClock,
          authorNodeId: existing?.authorNodeId ?? authorNodeId,
          authorCallsign: existing?.authorCallsign ?? authorCallsign,
          emergencyType: data.emergencyType ?? existing?.emergencyType ?? 'general',
          severity: data.severity ?? existing?.severity ?? 'emergency',
          latitude: data.latitude ?? existing?.latitude ?? 59.437,
          longitude: data.longitude ?? existing?.longitude ?? 24.7536,
          altitudeMeters: data.altitudeMeters ?? existing?.altitudeMeters,
          batteryPct: data.batteryPct ?? existing?.batteryPct,
          description: data.description ?? existing?.description ?? 'SOS Active',
          status: data.status ?? existing?.status ?? 'active',
          responders: data.responders ?? existing?.responders ?? [],
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

    case 'governance_vote': {
      state.governanceVotes.set(entityId, {
        id: entityId,
        createdAt: wallClock,
        updatedAt: wallClock,
        authorNodeId,
        authorCallsign,
        proposalId: data.proposalId,
        optionSelected: data.optionSelected,
      } as GovernanceVote);
      break;
    }

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
