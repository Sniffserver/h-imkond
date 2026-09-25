/**
 * HÕIMU Protocol Type Definitions
 * 
 * Defines TypeScript interfaces for fixed-length packet headers (53 bytes),
 * separate raw binary signature (64 bytes), CRC32 (4 bytes),
 * and structured application message payload types according to the protocol specification.
 */

import { HoimuPacketType, PacketFlags } from './constants';

/**
 * Fixed-length Binary Header Layout (53 bytes on wire):
 * - Magic (4 bytes): 0x484F494D ("HOIM")
 * - Version (1 byte): uint8 (0x01)
 * - Type (1 byte): uint8 (HoimuPacketType)
 * - Flags (1 byte): uint8 (PacketFlags: 0x01 = IS_SIGNED, 0x02 = IS_ENCRYPTED, etc.)
 * - TTL (1 byte): uint8 (Time-To-Live remaining hops)
 * - HopCount (1 byte): uint8 (Hops traveled)
 * - Sequence (4 bytes): uint32 BE (Persistent sequence counter)
 * - OriginId / SenderId (8 bytes): 8-byte UTF-8 ASCII node fingerprint
 * - DestinationId (8 bytes): 8-byte UTF-8 ASCII node identifier ('*' for broadcast)
 * - PacketId (16 bytes): 16-byte raw UUID or hash
 * - CreatedAtEpochSeconds (4 bytes): uint32 BE (Unix timestamp in seconds)
 * - LifetimeSeconds (2 bytes): uint16 BE (Packet lifetime; expiresAt = createdAt + lifetime)
 * - PayloadLength N (2 bytes): uint16 BE
 */
export interface HoimuFixedHeader {
  version: number;
  type: HoimuPacketType;
  flags: number;
  ttl: number;
  hopCount: number;
  sequence: number;
  senderId: string; // 8-character ASCII or hex node ID
  destinationId: string; // 8-character ASCII or hex node ID ('*' for broadcast)
  packetId: string; // 16-character/byte unique packet identifier
  length: number; // Application payload length in bytes (N)
}

export interface HoimuPacketHeader extends HoimuFixedHeader {
  originId: string; // Alias for senderId (8 bytes)
  createdAt: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
  createdAtEpochSeconds?: number;
  lifetimeSeconds?: number;
  receivedAtLocal?: number; // Local monotonic timestamp when frame arrived
}

// -------------------------------------------------------------
// Message Payload Structures
// -------------------------------------------------------------

/**
 * Type 0x01: Plaintext Broadcast / Mesh Chat Message
 */
export interface PlaintextMessagePayload {
  text: string;
  senderCallsign?: string;
  timestamp?: number;
  replyToId?: string;
  urgent?: boolean;
}

/**
 * Type 0x02: End-to-End Direct Encrypted Message
 */
export interface DirectEncryptedPayload {
  ciphertextHex: string;
  nonceHex: string;
  senderDhPubKeyHex: string;
  recipientDhPubKeyHex?: string;
  tagHex?: string;
  encryptedMetadata?: string;
}

export interface EncryptedPayloadEnvelope extends DirectEncryptedPayload {
  cipherPayloadHex?: string;
  senderEphemeralPubKeyHex?: string;
}

/**
 * Type 0x03: SOS / Emergency Distress Beacon
 */
export interface SOSPayload {
  emergencyType: 'medical' | 'rescue' | 'fire' | 'radiation' | 'grid_down' | 'general';
  callsign: string;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  batteryPercent?: number;
  description: string;
  medicalDetails?: string;
  timestamp: number;
}

/**
 * Type 0x04: CRDT Event Log Sync Payload
 */
export interface CRDTSyncPayload {
  vectorClock: Record<string, number>;
  events: Array<{
    opId: string;
    authorId: string;
    authorCallsign?: string;
    clock: number;
    entityType: string;
    entityId: string;
    action: 'insert' | 'update' | 'delete';
    fields: Record<string, any>;
    timestamp: number;
    tombstone?: boolean;
  }>;
}

/**
 * Type 0x05: Routing Discovery & Link Announcement
 */
export interface RouteAnnouncePayload {
  routerNodeId: string;
  callsign: string;
  uptimeSeconds: number;
  batteryLevel?: number;
  supportedBands?: string[];
  neighbors: Array<{
    nodeId: string;
    rssi: number;
    snr: number;
    cost: number;
  }>;
}

export type PacketId = string;
export type NodeId = string;

/**
 * Type 0x06: Packet Acknowledgment (ACK)
 * Signed, authenticated, compact priority confirmation frame.
 */
export interface AckPayload {
  ackedPacketId: PacketId;
  originNodeId: NodeId;
  receiverNodeId: NodeId;
  status: 'received' | 'processed' | 'rejected';
  originalSequence: number;
  latencyMs?: number;
  timestamp?: number;
  // Backward compatibility fields
  acknowledgedPacketId?: string;
  ackStatus?: 'received' | 'decrypted' | 'relayed' | 'rejected';
  ackForPacketId?: string;
}

/**
 * Discriminated union of all standard payload structures
 */
export type HoimuPayload =
  | PlaintextMessagePayload
  | DirectEncryptedPayload
  | SOSPayload
  | CRDTSyncPayload
  | RouteAnnouncePayload
  | AckPayload
  | Record<string, any>
  | string;

/**
 * Full Canonical HÕIMU Packet Envelope
 */
export interface HoimuPacket<T = HoimuPayload> {
  header: HoimuPacketHeader;
  payload: T;
  signature?: string; // Canonical Ed25519 signature in hex (64 bytes / 128 hex chars)
  signatureBytes?: Uint8Array; // Raw 64 bytes binary signature
}

/**
 * Low-level Raw Binary Frame with CRC32
 */
export interface RawBinaryPacket {
  header: HoimuPacketHeader;
  payloadBytes: Uint8Array;
  signatureBytes?: Uint8Array;
  crc32: number;
}
