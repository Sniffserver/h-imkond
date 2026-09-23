/**
 * HÕIMU Resilient Local State Engine Types
 * 
 * Defines domain entities and signed CRDT event mutations for:
 * - Mutual Aid & Needs
 * - Shared Resources & Inventory
 * - Skills & Certifications
 * - SOS & Emergency Beacons
 * - Governance & Mesh Proposals
 * - Field Journal & Telemetry
 * - Offline Geo-Points & Hazard Zones
 */

export type DomainEntityType =
  | 'mutual_aid'
  | 'resource'
  | 'skill'
  | 'sos_beacon'
  | 'governance_proposal'
  | 'governance_vote'
  | 'journal_entry'
  | 'map_marker';

export interface BaseDomainEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  authorNodeId: string;
  authorCallsign: string;
  deleted?: boolean;
}

export interface MutualAidNeed extends BaseDomainEntity {
  category: 'food' | 'water' | 'medical' | 'shelter' | 'tools' | 'power' | 'transport' | 'other';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'claimed' | 'fulfilled' | 'cancelled';
  locationName?: string;
  latitude?: number;
  longitude?: number;
  claimedByNodeId?: string;
}

export interface ResourceItem extends BaseDomainEntity {
  name: string;
  category: 'energy' | 'comms' | 'medical' | 'fuel' | 'water' | 'food' | 'hardware' | 'vehicle';
  quantity: number;
  unit: string;
  condition: 'new' | 'good' | 'fair' | 'damaged' | 'in_use';
  locationName: string;
  isPubliclyShared: boolean;
  notes?: string;
}

export interface SkillEndorsement extends BaseDomainEntity {
  targetNodeId: string;
  skillName: string;
  endorsementLevel: 1 | 2 | 3 | 4 | 5; // 1-Novice .. 5-Expert
  notes?: string;
}

export interface SOSBeacon extends BaseDomainEntity {
  emergencyType: 'medical' | 'rescue' | 'fire' | 'radiation' | 'grid_down' | 'general';
  severity: 'warning' | 'emergency' | 'catastrophic';
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  batteryPct?: number;
  description: string;
  status: 'active' | 'responding' | 'resolved';
  responders: string[];
}

export interface GovernanceProposal extends BaseDomainEntity {
  title: string;
  description: string;
  options: string[]; // e.g. ["Yes", "No", "Abstain"]
  deadlineMs: number;
  status: 'active' | 'passed' | 'rejected' | 'expired';
}

export interface GovernanceVote extends BaseDomainEntity {
  proposalId: string;
  optionSelected: string;
}

export interface JournalEntry extends BaseDomainEntity {
  title: string;
  content: string;
  tags: string[];
  batteryVoltage?: number;
  snrEstimate?: number;
  isEncrypted?: boolean;
}

export interface MapMarker extends BaseDomainEntity {
  label: string;
  type: 'base_camp' | 'water_source' | 'repeater' | 'hazard' | 'aid_station' | 'shelter';
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  notes?: string;
}

/**
 * Signed CRDT Mutation Event
 */
export interface SignedCRDTEvent<T = any> {
  eventId: string; // Unique hash/ID of event
  previousEventHash?: string; // Merkle hash chain
  entityType: DomainEntityType;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  authorNodeId: string; // Ed25519 public key hex
  authorCallsign: string;
  logicalClock: number; // Lamport timestamp
  wallClock: number; // UTC unix epoch ms
  data: Partial<T>;
  signature: string; // Ed25519 signature over canonical event content
}

export interface ResilientEngineState {
  mutualAid: Map<string, MutualAidNeed>;
  resources: Map<string, ResourceItem>;
  skills: Map<string, SkillEndorsement>;
  sosBeacons: Map<string, SOSBeacon>;
  governanceProposals: Map<string, GovernanceProposal>;
  governanceVotes: Map<string, GovernanceVote>;
  journalEntries: Map<string, JournalEntry>;
  mapMarkers: Map<string, MapMarker>;
}
