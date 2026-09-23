/**
 * HÕIMU Packet Lifecycle & Protocol Pipeline
 * 
 * Formal 11-Stage Discrete Packet Lifecycle Architecture:
 * 
 *   CREATE
 *     ↓
 *   SIGN
 *     ↓
 *   ENCRYPT
 *     ↓
 *   QUEUE
 *     ↓
 *   TRANSMIT
 *     ↓
 *   RECEIVE
 *     ↓
 *   VERIFY
 *     ↓
 *   DECRYPT
 *     ↓
 *   DEDUP
 *     ↓
 *   ROUTE
 *     ↓
 *   DELIVER
 * 
 * Each stage is isolated as a pure, independently testable pipeline component.
 */

import { MeshPacket, MeshPacketType } from '../transport/types';
import { createMeshPacket, CreateMeshPacketOptions } from '../routing/packetProtocol';
import { SeenPacketCache } from '../routing/SeenPacketCache';
import { meshDb } from '../db/meshDatabase';
import {
  signCanonicalPayload,
  verifyCanonicalPayload,
  encryptDirectPayload,
  decryptDirectPayload,
  DerivationResult,
} from '../../crypto/meshCrypto';
import { encodeBinaryPacket, decodeBinaryPacket, PacketType as BinaryPacketType, BinaryPacket } from '../binaryPacket';
import { MeshTransportManager } from '../transport/MeshTransportManager';
import { crdtEventLogEngine } from '../crdt/signedEventLog';

export type LifecycleStage =
  | 'CREATE'
  | 'SIGN'
  | 'ENCRYPT'
  | 'QUEUE'
  | 'TRANSMIT'
  | 'RECEIVE'
  | 'VERIFY'
  | 'DECRYPT'
  | 'DEDUP'
  | 'ROUTE'
  | 'DELIVER';

export interface LifecycleTraceEntry {
  stage: LifecycleStage;
  timestamp: number;
  success: boolean;
  details?: Record<string, any>;
  error?: string;
}

export interface PipelinePacketResult<T = any> {
  packet: MeshPacket<T>;
  trace: LifecycleTraceEntry[];
  status: 'DELIVERED' | 'RELAYED' | 'DROPPED' | 'QUEUED';
  decryptedPayload?: any;
}

// Global default seen packet cache for pipeline
export const defaultSeenCache = new SeenPacketCache({ maxEntries: 2000, defaultTtlMs: 15 * 60 * 1000 });

// ==============================================================================
// 1. CREATE STAGE
// ==============================================================================
export function stageCreate<T = any>(options: CreateMeshPacketOptions<T>): MeshPacket<T> {
  return createMeshPacket(options);
}

// ==============================================================================
// 2. SIGN STAGE (Ed25519 Canonical Attestation)
// ==============================================================================
export async function stageSign<T = any>(
  packet: MeshPacket<T>,
  signingKey?: CryptoKey
): Promise<MeshPacket<T>> {
  const envelopeToSign = {
    packetId: packet.packetId,
    originId: packet.originId,
    destinationId: packet.destinationId,
    ttl: packet.ttl,
    sequence: packet.sequence,
    createdAt: packet.createdAt,
    expiresAt: packet.expiresAt,
    payload: packet.payload,
  };

  const signature = await signCanonicalPayload(envelopeToSign, signingKey);
  return {
    ...packet,
    signature,
  };
}

// ==============================================================================
// 3. ENCRYPT STAGE (X25519 E2EE Authenticated Envelope)
// ==============================================================================
export async function stageEncrypt<T = any>(
  packet: MeshPacket<T>,
  recipientPublicKeyHex?: string,
  senderPrivateKeyHex?: string
): Promise<MeshPacket<T>> {
  if (!recipientPublicKeyHex || packet.destinationId === '*' || packet.destinationId === 'broadcast') {
    // Broadcast / plaintext packet
    return packet;
  }

  const payloadString = typeof packet.payload === 'string' ? packet.payload : JSON.stringify(packet.payload);
  const encrypted = await encryptDirectPayload(payloadString, recipientPublicKeyHex, senderPrivateKeyHex);

  return {
    ...packet,
    payload: {
      __encrypted: true,
      cipherPayload: encrypted.cipherPayload,
      nonceHex: encrypted.nonceHex,
      senderEphemeralPubKeyHex: encrypted.senderEphemeralPubKeyHex,
    } as any,
  };
}

// ==============================================================================
// 4. QUEUE STAGE (Persistent Store-and-Forward Outbox in IndexedDB)
// ==============================================================================
export async function stageQueue<T = any>(packet: MeshPacket<T>): Promise<MeshPacket<T>> {
  await meshDb.addToOutbox(packet);
  return packet;
}

// ==============================================================================
// 5. TRANSMIT STAGE (Physical RF / BLE / WebSocket Wire Dispatch)
// ==============================================================================
export async function stageTransmit<T = any>(
  packet: MeshPacket<T>,
  transportManager: MeshTransportManager
): Promise<{ success: boolean; byteCount: number; transports: string[] }> {
  // Convert payload to compact binary format for physical RF savings
  const jsonPayload = JSON.stringify(packet.payload);
  const rawBytes = new TextEncoder().encode(jsonPayload);

  const binaryPacket: BinaryPacket = {
    header: {
      version: 1,
      type: packet.type === 'SOS' ? BinaryPacketType.SOS_EMERGENCY : BinaryPacketType.DATA,
      flags: {
        isEncrypted: Boolean((packet.payload as any)?.__encrypted),
        isPriority: packet.type === 'SOS',
        ackRequested: false,
      },
      ttl: packet.ttl,
      hopCount: packet.hopCount,
      networkId: 0x484f494d, // "HOIM"
      originId: (packet.originId || 'UNK').slice(0, 8),
      packetId: (packet.packetId || 'PKT').slice(0, 8),
      sequence: packet.sequence || 0,
      payloadLength: rawBytes.length,
    },
    payload: rawBytes,
    crc: 0,
  };

  const wireBytes = encodeBinaryPacket(binaryPacket);
  const sendResult = await transportManager.broadcast(packet);

  return {
    success: sendResult.success,
    byteCount: wireBytes.length,
    transports: sendResult.transportsUsed || ['MeshTransportManager'],
  };
}

// ==============================================================================
// 6. RECEIVE STAGE (Wire Ingestion & Binary Frame Parsing)
// ==============================================================================
export function stageReceive<T = any>(input: Uint8Array | MeshPacket<T>): MeshPacket<T> {
  if (input instanceof Uint8Array) {
    const decoded = decodeBinaryPacket(input);
    if (!decoded) {
      throw new Error('[Lifecycle:RECEIVE] Corrupted binary frame or CRC mismatch');
    }
    const payloadStr = new TextDecoder().decode(decoded.payload);
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadStr);
    } catch {
      parsedPayload = payloadStr;
    }

    const pktType: MeshPacketType = decoded.header.type === BinaryPacketType.SOS_EMERGENCY ? 'SOS' : 'MESSAGE';

    return {
      id: decoded.header.packetId,
      packetId: decoded.header.packetId,
      originId: decoded.header.originId,
      destinationId: '*',
      ttl: decoded.header.ttl,
      sequence: decoded.header.sequence,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      routeId: decoded.header.originId,
      hopCount: decoded.header.hopCount,
      payload: parsedPayload,
      type: pktType,
      timestamp: Date.now(),
      senderId: decoded.header.originId,
      senderCallsign: decoded.header.originId,
      targetId: '*',
      targetCallsign: '*',
    };
  }

  return input;
}

// ==============================================================================
// 7. VERIFY STAGE (Ed25519 Canonical Attestation Validation)
// ==============================================================================
export async function stageVerify<T = any>(
  packet: MeshPacket<T>,
  authorPublicKeyHex?: string
): Promise<boolean> {
  if (!packet.signature) {
    return true; // Unsigned packet
  }

  const envelopeToVerify = {
    packetId: packet.packetId,
    originId: packet.originId,
    destinationId: packet.destinationId,
    ttl: packet.ttl,
    sequence: packet.sequence,
    createdAt: packet.createdAt,
    expiresAt: packet.expiresAt,
    payload: packet.payload,
  };

  return await verifyCanonicalPayload(envelopeToVerify, packet.signature, authorPublicKeyHex);
}

// ==============================================================================
// 8. DECRYPT STAGE (X25519 Authenticated Decryption)
// ==============================================================================
export async function stageDecrypt<T = any>(
  packet: MeshPacket<T>,
  recipientPrivateKeyHex?: string
): Promise<{ decryptedPayload: any; isEncrypted: boolean }> {
  const isEncrypted = Boolean((packet.payload as any)?.__encrypted);
  if (!isEncrypted) {
    return { decryptedPayload: packet.payload, isEncrypted: false };
  }

  if (!recipientPrivateKeyHex) {
    throw new Error('[Lifecycle:DECRYPT] Private key required to decrypt envelope');
  }

  const encContainer = packet.payload as any;
  const decrypted = await decryptDirectPayload(
    {
      cipherPayload: encContainer.cipherPayload,
      nonceHex: encContainer.nonceHex,
      senderEphemeralPubKeyHex: encContainer.senderEphemeralPubKeyHex,
    },
    recipientPrivateKeyHex
  );

  let parsed = decrypted;
  try {
    parsed = JSON.parse(decrypted);
  } catch {
    // Keep string
  }

  return { decryptedPayload: parsed, isEncrypted: true };
}

// ==============================================================================
// 9. DEDUP STAGE (Routing-State Deduplication with Bounded LRU Cache)
// ==============================================================================
export function stageDedup(
  packet: MeshPacket,
  cache: SeenPacketCache = defaultSeenCache
): boolean {
  return cache.hasSeen(packet.packetId || '');
}

// ==============================================================================
// 10. ROUTE STAGE (Store-and-Forward Multi-Hop Relay with Loop Prevention)
// ==============================================================================
export async function stageRoute(
  packet: MeshPacket,
  localNodeId: string,
  transportManager?: MeshTransportManager,
  cache: SeenPacketCache = defaultSeenCache
): Promise<{ relayed: boolean; nextTtl: number; nextHop: number }> {
  const pktId = packet.packetId || '';
  // Mark in seen cache to prevent loops
  cache.markSeen(pktId, packet.expiresAt);

  // Check if packet is expired
  if (packet.expiresAt && Date.now() > packet.expiresAt) {
    return { relayed: false, nextTtl: packet.ttl, nextHop: packet.hopCount };
  }

  // If local node is NOT the final destination and TTL > 1, forward it
  const isForUs = packet.destinationId === localNodeId;
  if (!isForUs && packet.ttl > 1) {
    const forwardedPacket: MeshPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      hopCount: packet.hopCount + 1,
      routeId: `${packet.routeId || packet.originId}->${localNodeId}`,
    };

    if (transportManager) {
      await transportManager.broadcast(forwardedPacket);
    }

    return {
      relayed: true,
      nextTtl: forwardedPacket.ttl,
      nextHop: forwardedPacket.hopCount,
    };
  }

  return { relayed: false, nextTtl: packet.ttl, nextHop: packet.hopCount };
}

// ==============================================================================
// 11. DELIVER STAGE (Local Ingestion, Inbox Persistence & CRDT Projection)
// ==============================================================================
export async function stageDeliver(
  packet: MeshPacket,
  localNodeId: string,
  decryptedPayload?: any
): Promise<{ deliveredToLocal: boolean; crdtApplied: boolean }> {
  const isTarget =
    packet.destinationId === '*' ||
    packet.destinationId === 'broadcast' ||
    packet.destinationId === localNodeId;

  if (!isTarget) {
    return { deliveredToLocal: false, crdtApplied: false };
  }

  // Ingest into persistent IndexedDB message store
  await meshDb.saveIncomingMessage(packet);

  // If packet carries CRDT event mutations, project them into local ledger
  let crdtApplied = false;
  const payloadData = decryptedPayload ?? packet.payload;
  if (payloadData && typeof payloadData === 'object' && payloadData.crdtEvents) {
    crdtEventLogEngine.ingestEvents(payloadData.crdtEvents, false);
    crdtApplied = true;
  }

  return { deliveredToLocal: true, crdtApplied };
}

// ==============================================================================
// Full Packet Lifecycle Pipeline Runner
// ==============================================================================
export class PacketLifecyclePipeline {
  private localNodeId: string;
  private keyPair?: DerivationResult;
  private transportManager: MeshTransportManager;
  private seenCache: SeenPacketCache;

  constructor(
    localNodeId: string,
    transportManager: MeshTransportManager,
    keyPair?: DerivationResult,
    seenCache: SeenPacketCache = defaultSeenCache
  ) {
    this.localNodeId = localNodeId;
    this.transportManager = transportManager;
    this.keyPair = keyPair;
    this.seenCache = seenCache;
  }

  /**
   * Outbound Transmission Pipeline:
   * CREATE -> SIGN -> ENCRYPT -> QUEUE -> TRANSMIT
   */
  public async processOutbound<T = any>(
    options: CreateMeshPacketOptions<T>,
    recipientPublicKeyHex?: string
  ): Promise<PipelinePacketResult<T>> {
    const trace: LifecycleTraceEntry[] = [];

    // 1. CREATE
    const created = stageCreate(options);
    trace.push({ stage: 'CREATE', timestamp: Date.now(), success: true, details: { packetId: created.packetId } });

    // 2. SIGN
    const signed = await stageSign(created, this.keyPair?.keyPair.privateKey);
    trace.push({ stage: 'SIGN', timestamp: Date.now(), success: true, details: { signature: signed.signature } });

    // 3. ENCRYPT
    const encrypted = await stageEncrypt(
      signed,
      recipientPublicKeyHex,
      this.keyPair?.keyPair.privateKeyHex
    );
    trace.push({
      stage: 'ENCRYPT',
      timestamp: Date.now(),
      success: true,
      details: { isEncrypted: Boolean((encrypted.payload as any)?.__encrypted) },
    });

    // 4. QUEUE
    const queued = await stageQueue(encrypted);
    trace.push({ stage: 'QUEUE', timestamp: Date.now(), success: true });

    // 5. TRANSMIT
    const txResult = await stageTransmit(queued, this.transportManager);
    trace.push({ stage: 'TRANSMIT', timestamp: Date.now(), success: txResult.success, details: txResult });

    return {
      packet: queued,
      trace,
      status: 'QUEUED',
    };
  }

  /**
   * Inbound Ingestion Pipeline:
   * RECEIVE -> VERIFY -> DECRYPT -> DEDUP -> ROUTE -> DELIVER
   */
  public async processInbound<T = any>(
    input: Uint8Array | MeshPacket<T>,
    authorPublicKeyHex?: string
  ): Promise<PipelinePacketResult<T>> {
    const trace: LifecycleTraceEntry[] = [];

    // 6. RECEIVE
    let packet: MeshPacket<T>;
    try {
      packet = stageReceive(input);
      trace.push({ stage: 'RECEIVE', timestamp: Date.now(), success: true, details: { packetId: packet.packetId } });
    } catch (err: any) {
      trace.push({ stage: 'RECEIVE', timestamp: Date.now(), success: false, error: err.message });
      throw err;
    }

    // 7. VERIFY
    const isValid = await stageVerify(packet, authorPublicKeyHex);
    trace.push({ stage: 'VERIFY', timestamp: Date.now(), success: isValid });
    if (!isValid) {
      return { packet, trace, status: 'DROPPED' };
    }

    // 8. DECRYPT
    let decryptedPayload = packet.payload;
    try {
      const decResult = await stageDecrypt(packet, this.keyPair?.keyPair.privateKeyHex);
      decryptedPayload = decResult.decryptedPayload;
      trace.push({ stage: 'DECRYPT', timestamp: Date.now(), success: true, details: { isEncrypted: decResult.isEncrypted } });
    } catch (err: any) {
      trace.push({ stage: 'DECRYPT', timestamp: Date.now(), success: false, error: err.message });
    }

    // 9. DEDUP
    const isDuplicate = stageDedup(packet, this.seenCache);
    trace.push({ stage: 'DEDUP', timestamp: Date.now(), success: !isDuplicate, details: { duplicate: isDuplicate } });
    if (isDuplicate) {
      return { packet, trace, status: 'DROPPED', decryptedPayload };
    }

    // 10. ROUTE
    const routeResult = await stageRoute(packet, this.localNodeId, this.transportManager, this.seenCache);
    trace.push({ stage: 'ROUTE', timestamp: Date.now(), success: true, details: routeResult });

    // 11. DELIVER
    const deliverResult = await stageDeliver(packet, this.localNodeId, decryptedPayload);
    trace.push({ stage: 'DELIVER', timestamp: Date.now(), success: deliverResult.deliveredToLocal, details: deliverResult });

    const status = deliverResult.deliveredToLocal ? 'DELIVERED' : routeResult.relayed ? 'RELAYED' : 'DROPPED';

    return {
      packet,
      trace,
      status,
      decryptedPayload,
    };
  }
}
