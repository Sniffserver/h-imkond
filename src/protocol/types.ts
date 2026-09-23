/**
 * HÕIMU Protocol Type Definitions
 * 
 * Defines TypeScript interfaces for fixed-length packet headers (senderId, destinationId, ttl, type, length, etc.)
 * and distinct structured message payload types according to the protocol specification.
 */

import { HoimuPacketType, PacketFlags } from './constants';

/**
 * Fixed-length Binary Header Layout (39 bytes on wire):
 * - Magic (4 bytes): 0x484F494D
 * - Version (1 byte): uint8
 * - Type (1 byte): uint8 (HoimuPacketType)
 * - Flags (1 byte): uint8 (PacketFlags)
 * - TTL (1 byte): uint8 (Time-To-Live remaining hops)
 * - HopCount (1 byte): uint8 (Hops traveled)
 * - Sequence (4 bytes): uint32 BE
 * - SenderId / OriginId (8 bytes): ASCII / Hex
 * - DestinationId (8 bytes): ASCII / Hex ('*' for broadcast)
 * - PacketId (8 bytes): ASCII identifier / hash
 * - PayloadLength (2 bytes): uint16 BE
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
  packetId: string; // Unique packet identifier
  length: number; // Payload length in bytes
}

export interface HoimuPacketHeader extends HoimuFixedHeader {
  originId: string; // Alias for senderId
  createdAt: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
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

/**
 * Type 0x06: Packet Acknowledgment (ACK)
 */
export interface AckPayload {
  acknowledgedPacketId: string;
  receiverNodeId: string;
  ackStatus: 'received' | 'decrypted' | 'relayed' | 'rejected';
  latencyMs?: number;
  timestamp: number;
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
}

/**
 * Low-level Raw Binary Frame with CRC32
 */
export interface RawBinaryPacket {
  header: HoimuPacketHeader;
  payloadBytes: Uint8Array;
  crc32: number;
}
