/**
 * HÕIMU Resilient Local State Engine
 * 
 * Coordinates signed event logging, deterministic CRDT merge, mesh synchronization,
 * and high-level domain operations for Mutual Aid, Resources, Skills, SOS, Governance, Journal, and Maps.
 */

import { SignedEventLog } from './signedEventLog';
import { reduceEngineState, createEmptyEngineState } from './deterministicMerge';
import {
  ResilientEngineState,
  SignedCRDTEvent,
  DomainEntityType,
  MutualAidNeed,
  ResourceItem,
  SkillEndorsement,
  SOSBeacon,
  GovernanceProposal,
  GovernanceVote,
  JournalEntry,
  MapMarker,
} from './types';
import { MeshRouter } from '../mesh/router';
import { createHoimuPacket } from '../protocol/packet';
import { HoimuPacketType, PacketFlags } from '../protocol/constants';
import { signPacket } from '../crypto/signatures';
import { HoimuIdentity } from '../crypto/identity';

export type StateChangeListener = (state: ResilientEngineState, latestEvent?: SignedCRDTEvent) => void;

export class LocalStateEngine {
  private log: SignedEventLog;
  private state: ResilientEngineState;
  private listeners = new Set<StateChangeListener>();
  private identity: HoimuIdentity;
  private router?: MeshRouter;

  constructor(identity: HoimuIdentity, router?: MeshRouter) {
    this.identity = identity;
    this.router = router;
    this.log = new SignedEventLog();
    this.state = createEmptyEngineState();

    if (this.router) {
      this.attachToMeshRouter(this.router);
    }
  }

  public getState(): ResilientEngineState {
    return this.state;
  }

  public getEventLog(): SignedEventLog {
    return this.log;
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(latestEvent?: SignedCRDTEvent): void {
    this.state = reduceEngineState(this.log.getEvents());
    for (const listener of this.listeners) {
      try {
        listener(this.state, latestEvent);
      } catch (err) {
        console.error('[LocalStateEngine] Listener error:', err);
      }
    }
  }

  public attachToMeshRouter(router: MeshRouter): void {
    this.router = router;
    router.deliveryManager.onDelivery(async (packet) => {
      if (packet.header.type === HoimuPacketType.CRDT_SYNC && typeof packet.payload === 'object' && packet.payload !== null && 'events' in packet.payload) {
        const syncPayload = packet.payload as { events: SignedCRDTEvent[] };
        let changed = false;
        for (const evt of syncPayload.events) {
          const appended = await this.log.verifyAndAppend(evt);
          if (appended) changed = true;
        }
        if (changed) {
          this.notify();
        }
      }
    });
  }

  /**
   * Broadcasts missing events across the mesh
   */
  public async syncWithMesh(): Promise<void> {
    if (!this.router) return;

    const events = this.log.getEvents();
    if (events.length === 0) return;

    const packet = createHoimuPacket({
      type: HoimuPacketType.CRDT_SYNC,
      originId: this.identity.signingPublicKeyHex,
      destinationId: '*',
      flags: PacketFlags.NONE,
      payload: {
        vectorClock: this.log.getVectorClock(),
        events,
      },
    });

    const signed = await signPacket(packet, this.identity.signingKeyPair.privateKey);
    await this.router.sendOutbound(signed);
  }

  // -------------------------------------------------------------
  // Domain Mutation Operations
  // -------------------------------------------------------------

  public async mutateEntity<T = any>(
    entityType: DomainEntityType,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    data: Partial<T>
  ): Promise<SignedCRDTEvent<T>> {
    const event = await this.log.createSignedEvent<T>({
      entityType,
      entityId,
      action,
      authorNodeId: this.identity.signingPublicKeyHex,
      authorCallsign: this.identity.callsign,
      data,
      signingPrivateKey: this.identity.signingKeyPair.privateKey,
    });

    this.notify(event);
    await this.syncWithMesh();
    return event;
  }

  // Mutual Aid Helpers
  public async postMutualAidNeed(need: Omit<MutualAidNeed, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign'>): Promise<string> {
    const id = `need_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.mutateEntity('mutual_aid', id, 'create', need);
    return id;
  }

  public async claimMutualAidNeed(needId: string): Promise<void> {
    await this.mutateEntity('mutual_aid', needId, 'update', {
      status: 'claimed',
      claimedByNodeId: this.identity.nodeId,
    });
  }

  // Resources Helpers
  public async addResourceItem(item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign'>): Promise<string> {
    const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.mutateEntity('resource', id, 'create', item);
    return id;
  }

  // Skills Helpers
  public async endorsePeerSkill(targetNodeId: string, skillName: string, level: 1 | 2 | 3 | 4 | 5, notes?: string): Promise<string> {
    const id = `skill_${targetNodeId.slice(0, 8)}_${skillName.toLowerCase().replace(/\s+/g, '_')}`;
    await this.mutateEntity('skill', id, 'create', {
      targetNodeId,
      skillName,
      endorsementLevel: level,
      notes,
    });
    return id;
  }

  // SOS Emergency Helpers
  public async broadcastSOS(sos: Omit<SOSBeacon, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign' | 'status' | 'responders'>): Promise<string> {
    const id = `sos_${this.identity.nodeId}_${Date.now()}`;
    await this.mutateEntity('sos_beacon', id, 'create', {
      ...sos,
      status: 'active',
      responders: [],
    });
    return id;
  }

  public async respondToSOS(sosId: string): Promise<void> {
    const existing = this.state.sosBeacons.get(sosId);
    const currentResponders = existing?.responders || [];
    if (!currentResponders.includes(this.identity.callsign)) {
      await this.mutateEntity('sos_beacon', sosId, 'update', {
        status: 'responding',
        responders: [...currentResponders, this.identity.callsign],
      });
    }
  }

  // Governance Helpers
  public async createProposal(proposal: Omit<GovernanceProposal, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign' | 'status'>): Promise<string> {
    const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.mutateEntity('governance_proposal', id, 'create', {
      ...proposal,
      status: 'active',
    });
    return id;
  }

  public async castVote(proposalId: string, optionSelected: string): Promise<string> {
    const id = `vote_${proposalId}_${this.identity.nodeId}`;
    await this.mutateEntity('governance_vote', id, 'create', {
      proposalId,
      optionSelected,
    });
    return id;
  }

  // Journal Helpers
  public async addJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign'>): Promise<string> {
    const id = `jrn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.mutateEntity('journal_entry', id, 'create', entry);
    return id;
  }

  // Offline Maps Helpers
  public async addMapMarker(marker: Omit<MapMarker, 'id' | 'createdAt' | 'updatedAt' | 'authorNodeId' | 'authorCallsign'>): Promise<string> {
    const id = `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.mutateEntity('map_marker', id, 'create', marker);
    return id;
  }
}
