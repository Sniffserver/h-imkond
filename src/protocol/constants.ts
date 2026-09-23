/**
 * HÕIMU Protocol Constants
 */

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_MAGIC = 0x484f494d; // "HOIM" in ASCII

export const MAX_PACKET_SIZE_BYTES = 255; // SX1262 LoRa physical MTU is 255 bytes
export const MAX_PAYLOAD_SIZE_BYTES = 200; // Payload buffer after header + CRC

export const DEFAULT_TTL = 7;
export const MAX_TTL = 15;

export const DEFAULT_PACKET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
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
  IS_ENCRYPTED = 0x01,
  IS_PRIORITY = 0x02,
  ACK_REQUESTED = 0x04,
  COMPRESSED = 0x08,
}
