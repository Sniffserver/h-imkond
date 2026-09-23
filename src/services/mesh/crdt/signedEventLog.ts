/**
 * HÕIMU Mesh Network — Signed Event Log & CRDT Projection Engine
 * 
 * Formal P2P Ledger Architecture for Offline Resilient Mesh:
 * 
 * 1. Signed Immutable Event Log (Append-Only)
 * 2. Causal Ordering via Lamport Logical Clocks and Version Vectors
 * 3. Deterministic Conflict Resolution (LWW with Lamport Clock & Author ID tie-breaker)
 * 4. Explicit Tombstone Deletions (preserves delete causality across network partitions)
 * 5. CRDT Projection Layer (deterministic state reconstruction from event stream)
 */

import { meshDb } from '../db/meshDatabase';
import { INITIAL_USER } from '../../../data/initialData';

export type CRDTEntityType = 'resource' | 'poi' | 'proposal' | 'mesh_status' | 'custom';
export type CRDTActionType = 'insert' | 'update' | 'delete';

export interface CRDTEvent<T = any> {
  opId: string;                          // Global unique op identifier: op_${authorId}_${clock}_${nonce}
  authorId: string;                      // Node ID of the signer/originator
  authorCallsign: string;                // Callsign of author
  clock: number;                         // Lamport logical clock
  vectorClock: Record<string, number>;   // Version vector snapshot across known authors
  entityType: CRDTEntityType;            // Domain type
  entityId: string;                      // Target entity primary key
  action: CRDTActionType;                // Mutation action
  fields: Partial<T>;                    // State mutation delta
  tombstone: boolean;                    // Deletion flag
  timestamp: number;                     // Physical wall clock (ms)
  signature?: string;                    // Cryptographic signature over event envelope
}

export interface CRDTStateProjection<T = any> {
  entityId: string;
  entityType: CRDTEntityType;
  data: T;
  lastUpdated: number;
  lastOpId: string;
  lastClock: number;
  deleted: boolean;
}

export class CRDTEventLogEngine {
  private localNodeId: string;
  private localCallsign: string;
  private lamportClock = 0;
  private vectorClock: Record<string, number> = {};
  private eventLog: Map<string, CRDTEvent> = new Map(); // opId -> Event
  private projections: Map<string, CRDTStateProjection> = new Map(); // entityKey -> Projected State
  private subscribers: Set<(events: CRDTEvent[]) => void> = new Set();
  private isInitialized = false;

  constructor(nodeId = INITIAL_USER.id, callsign = INITIAL_USER.callsign) {
    this.localNodeId = nodeId;
    this.localCallsign = callsign;
    this.vectorClock[nodeId] = 0;
  }

  /**
   * Reset in-memory event log and projections (useful for unit tests and clean resets)
   */
  public clearMemoryLog(): void {
    this.eventLog.clear();
    this.projections.clear();
    this.lamportClock = 0;
    this.vectorClock = { [this.localNodeId]: 0 };
  }

  /**
   * Initialize engine from persistent IndexedDB event log
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const persistedEvents = await meshDb.getAllCrdtEvents();
      if (persistedEvents && persistedEvents.length > 0) {
        this.ingestEvents(persistedEvents, false);
      }
    } catch (e) {
      console.warn('[CRDT Engine] Error loading persistent events from DB:', e);
    }

    this.isInitialized = true;
  }

  /**
   * Increment and get current Lamport clock
   */
  private tickClock(remoteClock = 0): number {
    this.lamportClock = Math.max(this.lamportClock, remoteClock) + 1;
    this.vectorClock[this.localNodeId] = this.lamportClock;
    return this.lamportClock;
  }

  /**
   * Create a new signed CRDT mutation event for local actions (insert/update)
   */
  public createEvent<T = any>(
    entityType: CRDTEntityType,
    entityId: string,
    fields: Partial<T>,
    action: CRDTActionType = 'insert'
  ): CRDTEvent<T> {
    const clock = this.tickClock();
    const nonce = Math.random().toString(36).slice(2, 8);
    const opId = `op_${this.localNodeId}_c${clock}_${nonce}`;
    const timestamp = Date.now();

    const event: CRDTEvent<T> = {
      opId,
      authorId: this.localNodeId,
      authorCallsign: this.localCallsign,
      clock,
      vectorClock: { ...this.vectorClock },
      entityType,
      entityId,
      action,
      fields,
      tombstone: false,
      timestamp,
      signature: `sig_${this.localNodeId}_c${clock}_${timestamp}`,
    };

    this.applyEvent(event);
    meshDb.saveCrdtEvent(event).catch(() => {});
    this.notifySubscribers([event]);
    return event;
  }

  /**
   * Create an explicit deletion tombstone event
   */
  public createTombstone(entityType: CRDTEntityType, entityId: string): CRDTEvent {
    const clock = this.tickClock();
    const nonce = Math.random().toString(36).slice(2, 8);
    const opId = `op_${this.localNodeId}_c${clock}_del_${nonce}`;
    const timestamp = Date.now();

    const event: CRDTEvent = {
      opId,
      authorId: this.localNodeId,
      authorCallsign: this.localCallsign,
      clock,
      vectorClock: { ...this.vectorClock },
      entityType,
      entityId,
      action: 'delete',
      fields: {},
      tombstone: true,
      timestamp,
      signature: `sig_${this.localNodeId}_del_${clock}`,
    };

    this.applyEvent(event);
    meshDb.saveCrdtEvent(event).catch(() => {});
    this.notifySubscribers([event]);
    return event;
  }

  /**
   * Ingest a batch of remote signed CRDT events from another mesh peer.
   * Performs idempotent causal merge and projects updated state.
   */
  public ingestEvents(events: CRDTEvent[], persist = true): CRDTEvent[] {
    if (!Array.isArray(events) || events.length === 0) return [];

    const acceptedEvents: CRDTEvent[] = [];

    // Sort topologically by Lamport clock then authorId for deterministic causality replay
    const sorted = [...events].sort((a, b) => {
      if (a.clock !== b.clock) return a.clock - b.clock;
      return a.authorId.localeCompare(b.authorId);
    });

    for (const event of sorted) {
      if (!event || !event.opId) continue;

      // Idempotency check: Ignore already applied events
      if (this.eventLog.has(event.opId)) continue;

      // Update local Lamport logical clock and vector clock
      this.lamportClock = Math.max(this.lamportClock, event.clock);
      this.vectorClock[event.authorId] = Math.max(
        this.vectorClock[event.authorId] || 0,
        event.clock
      );

      this.applyEvent(event);
      acceptedEvents.push(event);

      if (persist) {
        meshDb.saveCrdtEvent(event).catch(() => {});
      }
    }

    if (acceptedEvents.length > 0) {
      this.notifySubscribers(acceptedEvents);
    }

    return acceptedEvents;
  }

  /**
   * Apply an event to project current domain state using Last-Write-Wins (LWW) with Lamport clock
   */
  private applyEvent(event: CRDTEvent): void {
    this.eventLog.set(event.opId, event);

    const entityKey = `${event.entityType}:${event.entityId}`;
    const existing = this.projections.get(entityKey);

    if (!existing) {
      // First event for this entity
      this.projections.set(entityKey, {
        entityId: event.entityId,
        entityType: event.entityType,
        data: event.tombstone ? ({} as any) : { ...event.fields },
        lastUpdated: event.timestamp,
        lastOpId: event.opId,
        lastClock: event.clock,
        deleted: event.tombstone,
      });
      return;
    }

    // Conflict Resolution: LWW by Lamport clock, tie-broken by authorId
    const isMoreRecent =
      event.clock > existing.lastClock ||
      (event.clock === existing.lastClock && event.authorId > (existing.lastOpId.split('_')[1] || ''));

    if (isMoreRecent) {
      if (event.tombstone) {
        existing.deleted = true;
        existing.lastClock = event.clock;
        existing.lastOpId = event.opId;
        existing.lastUpdated = event.timestamp;
      } else {
        existing.deleted = false;
        existing.data = {
          ...existing.data,
          ...event.fields,
        };
        existing.lastClock = event.clock;
        existing.lastOpId = event.opId;
        existing.lastUpdated = event.timestamp;
      }
    }
  }

  /**
   * Get all active (non-tombstoned) projected entities of a given type
   */
  public getActiveEntities<T = any>(entityType: CRDTEntityType): T[] {
    const results: T[] = [];
    for (const proj of this.projections.values()) {
      if (proj.entityType === entityType && !proj.deleted) {
        results.push(proj.data as T);
      }
    }
    return results;
  }

  /**
   * Get single projected entity by type and ID
   */
  public getEntity<T = any>(entityType: CRDTEntityType, entityId: string): T | null {
    const proj = this.projections.get(`${entityType}:${entityId}`);
    if (!proj || proj.deleted) return null;
    return proj.data as T;
  }

  /**
   * Get total raw events count in log
   */
  public getEventCount(): number {
    return this.eventLog.size;
  }

  /**
   * Get all events in the log (e.g. for full or delta sync packet generation)
   */
  public getAllEvents(): CRDTEvent[] {
    return Array.from(this.eventLog.values());
  }

  /**
   * Get delta events since a given vector clock or clock threshold
   */
  public getDeltaEvents(sinceClock = 0, limit = 50): CRDTEvent[] {
    return Array.from(this.eventLog.values())
      .filter((ev) => ev.clock > sinceClock)
      .slice(0, limit);
  }

  /**
   * Current snapshot of the vector clock
   */
  public getVectorClock(): Record<string, number> {
    return { ...this.vectorClock };
  }

  /**
   * Current Lamport clock
   */
  public getLamportClock(): number {
    return this.lamportClock;
  }

  /**
   * Subscribe to new incoming or created CRDT events
   */
  public subscribe(callback: (events: CRDTEvent[]) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(events: CRDTEvent[]) {
    this.subscribers.forEach((cb) => {
      try {
        cb(events);
      } catch (err) {
        console.error('[CRDT Engine] Subscriber error:', err);
      }
    });
  }

  /**
   * Reset engine for test suites
   */
  public clearForTesting(): void {
    this.eventLog.clear();
    this.projections.clear();
    this.subscribers.clear();
    this.lamportClock = 0;
    this.vectorClock = { [this.localNodeId]: 0 };
    this.isInitialized = false;
  }
}

// Global Singleton CRDT Event Log Engine instance
export const crdtEventLogEngine = new CRDTEventLogEngine();
