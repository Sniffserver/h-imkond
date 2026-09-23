/**
 * HÕIMU Canonical Mesh Routing Packet Protocol
 * 
 * Formal packet envelope specification:
 * - packetId: Unique message UUID/identifier for deduplication
 * - originId: Author / originator node ID or callsign
 * - destinationId: Target node ID or 'broadcast' / '*'
 * - ttl: Remaining hop budget (decremented at each hop)
 * - sequence: Monotonically increasing sequence number from origin
 * - createdAt: Timestamp (ms) when packet was generated
 * - expiresAt: Expiration timestamp (ms) after which packet is dropped
 * - routeId: Route path trace (e.g., 'NODE_A->NODE_B')
 * - hopCount: Number of relay hops traversed
 * - payload: Generic typed payload
 * - signature: Cryptographic signature over packet envelope
 */

import { MeshPacket, MeshPacketType } from '../transport/types';

let globalSequenceCounter = 1;

export function getNextSequence(): number {
  return globalSequenceCounter++;
}

export function resetSequenceForTesting(startSeq = 1): void {
  globalSequenceCounter = startSeq;
}

export interface CreateMeshPacketOptions<T = any> {
  originId: string;
  destinationId?: string;
  payload: T;
  type?: MeshPacketType;
  ttl?: number;
  sequence?: number;
  lifetimeMs?: number;
  routeId?: string;
  signature?: string;
  senderCallsign?: string;
  targetCallsign?: string;
}

const DEFAULT_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes default packet lifetime
const DEFAULT_TTL = 7; // Standard 7-hop mesh limit

/**
 * Creates a fully validated canonical MeshPacket
 */
export function createMeshPacket<T = any>(options: CreateMeshPacketOptions<T>): MeshPacket<T> {
  const createdAt = Date.now();
  const lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS;
  const expiresAt = createdAt + lifetimeMs;
  const sequence = options.sequence ?? getNextSequence();
  const destinationId = options.destinationId || options.targetCallsign || '*';
  const type = options.type || 'MESSAGE';

  const nonce = Math.random().toString(36).slice(2, 8);
  const packetId = `pkt_${options.originId}_seq${sequence}_${nonce}`;

  const packet: MeshPacket<T> = {
    // Canonical Mesh Protocol Fields
    packetId,
    originId: options.originId,
    destinationId,
    ttl: options.ttl ?? DEFAULT_TTL,
    sequence,
    createdAt,
    expiresAt,
    routeId: options.routeId || options.originId,
    hopCount: 0,
    payload: options.payload,
    signature: options.signature,

    // Aliases / Compatibility fields
    id: packetId,
    type,
    senderId: options.originId,
    senderCallsign: options.senderCallsign || options.originId,
    targetId: destinationId,
    targetCallsign: options.targetCallsign || destinationId,
    timestamp: createdAt,
  };

  return packet;
}

/**
 * Normalizes any incoming raw or legacy packet into the Canonical MeshPacket schema
 */
export function normalizeMeshPacket<T = any>(raw: any): MeshPacket<T> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[PacketProtocol] Invalid raw packet: must be an object');
  }

  const now = Date.now();
  const packetId = raw.packetId || raw.id || `pkt_anon_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const originId = raw.originId || raw.senderId || raw.senderCallsign || 'unknown';
  const destinationId = raw.destinationId || raw.targetCallsign || raw.targetId || '*';
  const createdAt = raw.createdAt || raw.timestamp || now;
  const expiresAt = raw.expiresAt || (createdAt + DEFAULT_LIFETIME_MS);
  const ttl = typeof raw.ttl === 'number' ? raw.ttl : DEFAULT_TTL;
  const hopCount = typeof raw.hopCount === 'number' ? raw.hopCount : 0;
  const sequence = typeof raw.sequence === 'number' ? raw.sequence : 0;
  const type: MeshPacketType = raw.type || 'MESSAGE';

  return {
    packetId,
    originId,
    destinationId,
    ttl,
    sequence,
    createdAt,
    expiresAt,
    routeId: raw.routeId || originId,
    hopCount,
    payload: raw.payload,
    signature: raw.signature,

    // Aliases
    id: packetId,
    type,
    senderId: raw.senderId || originId,
    senderCallsign: raw.senderCallsign || originId,
    targetId: destinationId,
    targetCallsign: raw.targetCallsign || destinationId,
    timestamp: createdAt,
    transportMeta: raw.transportMeta,
  };
}

/**
 * Checks if a packet has exceeded its lifetime
 */
export function isPacketExpired(packet: MeshPacket): boolean {
  if (!packet) return true;
  const now = Date.now();
  return typeof packet.expiresAt === 'number' && now > packet.expiresAt;
}

/**
 * Generates a store-and-forward relay copy of a packet for the next mesh hop:
 * - Decrements TTL (must be > 0)
 * - Increments hopCount
 * - Appends current relayer to routeId path
 */
export function relayMeshPacket<T = any>(
  packet: MeshPacket<T>,
  relayerNodeId: string
): MeshPacket<T> | null {
  if (!packet || packet.ttl <= 1 || isPacketExpired(packet)) {
    return null; // TTL exhausted or expired
  }

  const updatedRouteId = packet.routeId
    ? `${packet.routeId}->${relayerNodeId}`
    : `${packet.originId}->${relayerNodeId}`;

  return {
    ...packet,
    ttl: packet.ttl - 1,
    hopCount: (packet.hopCount || 0) + 1,
    routeId: updatedRouteId,
    // Keep original origin, sequence, createdAt, expiresAt, and signature intact
  };
}
