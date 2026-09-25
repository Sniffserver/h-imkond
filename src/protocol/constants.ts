/**
 * HÕIMU Protocol Constants & Binary Framing Specifications
 */

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_MAGIC = 0x484f494d; // "HOIM" in ASCII (0x48 0x4F 0x49 0x4D)

// Physical SX1262 LoRa MTU and Framing Overhead
export const MAX_PACKET_SIZE_BYTES = 255; // SX1262 LoRa physical hardware MTU
export const HEADER_SIZE_BYTES = 53; // Fixed 53-byte binary header
export const SIGNATURE_SIZE_BYTES = 64; // Ed25519 binary signature (64 raw bytes)
export const CRC_SIZE_BYTES = 4; // IEEE 802.3 CRC32 (4 bytes uint32 BE)

export const MIN_FRAME_SIZE_BYTES = HEADER_SIZE_BYTES + CRC_SIZE_BYTES; // 57 bytes
export const MAX_PAYLOAD_SIZE_SIGNED_BYTES = MAX_PACKET_SIZE_BYTES - HEADER_SIZE_BYTES - SIGNATURE_SIZE_BYTES - CRC_SIZE_BYTES; // 134 bytes
export const MAX_PAYLOAD_SIZE_UNSIGNED_BYTES = MAX_PACKET_SIZE_BYTES - HEADER_SIZE_BYTES - CRC_SIZE_BYTES; // 198 bytes
export const MAX_PAYLOAD_SIZE_BYTES = MAX_PAYLOAD_SIZE_UNSIGNED_BYTES;

export const DEFAULT_TTL = 7;
export const MAX_TTL = 15;

export const DEFAULT_PACKET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (900 seconds)
export const EMERGENCY_PACKET_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export enum HoimuPacketType {
  MESSAGE = 0x01,
  DIRECT_ENCRYPTED = 0x02,
  SOS = 0x03,
  CRDT_SYNC = 0x04,
  ROUTE_ANNOUNCE = 0x05,
  ACK = 0x06,
}

export enum PacketFlags {
  NONE = 0x00,
  IS_SIGNED = 0x01,
  IS_ENCRYPTED = 0x02,
  IS_PRIORITY = 0x04,
  ACK_REQUESTED = 0x08,
  COMPRESSED = 0x10,
}
