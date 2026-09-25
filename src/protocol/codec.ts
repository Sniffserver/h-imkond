/**
 * HÕIMU Canonical Binary Frame Codec for Physical Radio (LoRa SX1262 / BLE / Wi-Fi Aware)
 * 
 * Strict Binary Wire Layout (PROTOCOL-001..005):
 * [0..3]    Magic Bytes 0x48 0x4F 0x49 0x4D ("HOIM") (4 bytes)
 * [4]       Version (uint8, 0x01) (1 byte)
 * [5]       Type (uint8, HoimuPacketType) (1 byte)
 * [6]       Flags (uint8, PacketFlags: 0x01 = IS_SIGNED, etc.) (1 byte)
 * [7]       TTL (uint8) (1 byte)
 * [8]       Hop Count (uint8) (1 byte)
 * [9..12]   Sequence (uint32 big-endian) (4 bytes)
 * [13..20]  Origin ID (8 bytes UTF-8 ASCII) (8 bytes)
 * [21..28]  Destination ID (8 bytes UTF-8 ASCII) (8 bytes)
 * [29..44]  Packet ID (16 bytes raw UUID/hash or ASCII) (16 bytes)
 * [45..48]  CreatedAt (uint32 big-endian Unix epoch seconds) (4 bytes)
 * [49..50]  Lifetime (uint16 big-endian seconds; expiresAt = createdAt + lifetime) (2 bytes)
 * [51..52]  Payload Length N (uint16 big-endian) (2 bytes)
 * [53..53+N-1] Application Payload Bytes (N bytes)
 * [53+N..53+N+63] Binary Ed25519 Signature (64 raw bytes, ONLY IF flags & IS_SIGNED)
 * [Tail-4..Tail-1] IEEE 802.3 CRC32 (uint32 big-endian) (4 bytes)
 */

import { HoimuPacket, HoimuPacketHeader } from './types';
import {
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  HoimuPacketType,
  PacketFlags,
  HEADER_SIZE_BYTES,
  SIGNATURE_SIZE_BYTES,
  CRC_SIZE_BYTES,
  DEFAULT_PACKET_EXPIRY_MS,
} from './constants';
import { canonicalize } from './canonical';

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

/**
 * Calculates standard IEEE 802.3 CRC32 checksum for a byte array.
 */
export function calculateCRC32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Verifies if the trailing 4 bytes match the CRC32 of the leading frame content.
 */
export function verifyFrameCRC(rawBytes: Uint8Array): boolean {
  if (rawBytes.length < HEADER_SIZE_BYTES + CRC_SIZE_BYTES) return false;
  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const payloadLen = view.getUint16(51, false);
  const flags = view.getUint8(6);
  const isSigned = (flags & PacketFlags.IS_SIGNED) !== 0;
  const sigLen = isSigned ? SIGNATURE_SIZE_BYTES : 0;
  const expectedTotal = HEADER_SIZE_BYTES + payloadLen + sigLen + CRC_SIZE_BYTES;

  if (rawBytes.length < expectedTotal) return false;

  const content = rawBytes.subarray(0, expectedTotal - CRC_SIZE_BYTES);
  const computedCrc = calculateCRC32(content);
  const storedCrc = view.getUint32(expectedTotal - CRC_SIZE_BYTES, false);
  return computedCrc === storedCrc;
}

function writePaddedAscii(target: Uint8Array, offset: number, length: number, str: string): void {
  const bytes = new TextEncoder().encode(str);
  for (let i = 0; i < length; i++) {
    target[offset + i] = i < bytes.length ? bytes[i] : 0x20; // Space padded
  }
}

function readPaddedAscii(source: Uint8Array, offset: number, length: number): string {
  const slice = source.slice(offset, offset + length);
  return new TextDecoder().decode(slice).trim();
}

function write16BytePacketId(target: Uint8Array, offset: number, packetId: string): void {
  const cleanId = packetId.replace(/[^0-9a-fA-F]/g, '');
  if (cleanId.length === 32) {
    for (let i = 0; i < 16; i++) {
      target[offset + i] = parseInt(cleanId.slice(i * 2, i * 2 + 2), 16);
    }
    return;
  }
  writePaddedAscii(target, offset, 16, packetId);
}

function read16BytePacketId(source: Uint8Array, offset: number): string {
  const slice = source.slice(offset, offset + 16);
  let isPrintable = true;
  for (let i = 0; i < 16; i++) {
    const b = slice[i];
    if (b !== 0 && (b < 32 || b > 126)) {
      isPrintable = false;
      break;
    }
  }
  if (isPrintable) {
    const text = new TextDecoder().decode(slice).trim();
    if (text.length > 0) return text;
  }
  return Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Persistent monotonic-increasing sequence generator
let persistentSequence = 1;
try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('hoimu_seq_epoch') : null;
  const epoch = saved ? parseInt(saved, 10) : 0;
  persistentSequence = (epoch + 1) * 1000;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hoimu_seq_epoch', String(epoch + 1));
  }
} catch {
  persistentSequence = (Math.floor(Date.now() / 1000) & 0x00ffffff) * 1000;
}

export function getNextPersistentSequence(): number {
  persistentSequence = (persistentSequence + 1) >>> 0;
  return persistentSequence;
}

/**
 * Builds the canonical invariant preimage (with masked TTL=0 and hopCount=0) for Ed25519 signature.
 */
export function buildSignaturePreimage(header: HoimuPacketHeader, payloadBytes: Uint8Array): Uint8Array {
  const buffer = new Uint8Array(HEADER_SIZE_BYTES + payloadBytes.length);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, PROTOCOL_MAGIC, false);
  view.setUint8(4, header.version || PROTOCOL_VERSION);
  view.setUint8(5, header.type);
  view.setUint8(6, (header.flags || PacketFlags.NONE) | PacketFlags.IS_SIGNED);
  view.setUint8(7, 0); // Masked TTL = 0 for invariant relay verification
  view.setUint8(8, 0); // Masked HopCount = 0 for invariant relay verification
  view.setUint32(9, header.sequence || 0, false);

  writePaddedAscii(buffer, 13, 8, header.originId || header.senderId || 'UNK');
  writePaddedAscii(buffer, 21, 8, header.destinationId || '*');
  write16BytePacketId(buffer, 29, header.packetId || 'PKT');

  const nowSec = Math.floor((header.createdAt || Date.now()) / 1000);
  const lifetimeSec = header.lifetimeSeconds || Math.max(1, Math.floor(((header.expiresAt || (header.createdAt || Date.now()) + DEFAULT_PACKET_EXPIRY_MS) - (header.createdAt || Date.now())) / 1000));
  view.setUint32(45, nowSec, false);
  view.setUint16(49, lifetimeSec, false);
  view.setUint16(51, payloadBytes.length, false);

  buffer.set(payloadBytes, HEADER_SIZE_BYTES);
  return buffer;
}

/**
 * Serializes a HoimuPacket into compact binary wire bytes suitable for LoRa / BLE transmission.
 */
export function serializePacket<T = any>(packet: HoimuPacket<T>): Uint8Array {
  return encodeBinaryPacket(packet);
}

/**
 * Deserializes binary wire bytes into a structured HoimuPacket.
 */
export function deserializePacket<T = any>(rawBytes: Uint8Array): HoimuPacket<T> | null {
  return decodeBinaryPacket<T>(rawBytes);
}

/**
 * Encodes a structured packet into binary format with 53-byte fixed header, application payload,
 * 64-byte Ed25519 binary signature (if signed), and trailing 4-byte CRC32.
 */
export function encodeBinaryPacket<T = any>(packet: HoimuPacket<T>): Uint8Array {
  let payloadBytes: Uint8Array;
  if (typeof packet.payload === 'string') {
    payloadBytes = new TextEncoder().encode(packet.payload);
  } else if (packet.payload instanceof Uint8Array) {
    payloadBytes = packet.payload;
  } else {
    const payloadStr = canonicalize(packet.payload);
    payloadBytes = new TextEncoder().encode(payloadStr);
  }

  let signatureBytes: Uint8Array | null = null;
  if (packet.signatureBytes && packet.signatureBytes.length === SIGNATURE_SIZE_BYTES) {
    signatureBytes = packet.signatureBytes;
  } else if (packet.signature && packet.signature.length === 128) {
    signatureBytes = hexToBytes(packet.signature);
  }

  let flags = packet.header.flags || PacketFlags.NONE;
  if (signatureBytes) {
    flags |= PacketFlags.IS_SIGNED;
  }

  const sigLen = signatureBytes ? SIGNATURE_SIZE_BYTES : 0;
  const totalLength = HEADER_SIZE_BYTES + payloadBytes.length + sigLen + CRC_SIZE_BYTES;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // 1. Magic bytes "HOIM"
  view.setUint32(0, PROTOCOL_MAGIC, false);
  view.setUint8(4, packet.header.version || PROTOCOL_VERSION);
  view.setUint8(5, packet.header.type);
  view.setUint8(6, flags);
  view.setUint8(7, packet.header.ttl);
  view.setUint8(8, packet.header.hopCount || 0);
  view.setUint32(9, packet.header.sequence ?? getNextPersistentSequence(), false);

  writePaddedAscii(buffer, 13, 8, packet.header.originId || packet.header.senderId || 'UNK');
  writePaddedAscii(buffer, 21, 8, packet.header.destinationId || '*');
  write16BytePacketId(buffer, 29, packet.header.packetId || 'PKT');

  const createdAtMs = packet.header.createdAt || Date.now();
  const createdAtSec = packet.header.createdAtEpochSeconds ?? Math.floor(createdAtMs / 1000);
  const expiresAtMs = packet.header.expiresAt || (createdAtMs + DEFAULT_PACKET_EXPIRY_MS);
  const lifetimeSec = packet.header.lifetimeSeconds ?? Math.max(1, Math.floor((expiresAtMs - createdAtMs) / 1000));

  view.setUint32(45, createdAtSec, false);
  view.setUint16(49, lifetimeSec, false);
  view.setUint16(51, payloadBytes.length, false);

  // 2. Application Payload
  buffer.set(payloadBytes, HEADER_SIZE_BYTES);

  // 3. Binary Signature (64 bytes)
  if (signatureBytes) {
    buffer.set(signatureBytes, HEADER_SIZE_BYTES + payloadBytes.length);
  }

  // 4. Calculate CRC32 over (Header + Payload + Signature)
  const crcOffset = HEADER_SIZE_BYTES + payloadBytes.length + sigLen;
  const crc = calculateCRC32(buffer.subarray(0, crcOffset));
  view.setUint32(crcOffset, crc, false);

  return buffer;
}

/**
 * Decodes binary frame into a structured HoimuPacket, validating header magic, length, and CRC32.
 */
export function decodeBinaryPacket<T = any>(raw: Uint8Array): HoimuPacket<T> | null {
  if (raw.length < HEADER_SIZE_BYTES + CRC_SIZE_BYTES) {
    return null; // Too short to contain valid header + CRC
  }

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const magic = view.getUint32(0, false);
  if (magic !== PROTOCOL_MAGIC) {
    return null; // Invalid magic
  }

  const version = view.getUint8(4);
  if (version !== PROTOCOL_VERSION) {
    return null; // Unsupported protocol version
  }

  const type = view.getUint8(5) as HoimuPacketType;
  const flags = view.getUint8(6);
  const ttl = view.getUint8(7);
  const hopCount = view.getUint8(8);
  const sequence = view.getUint32(9, false);

  const originId = readPaddedAscii(raw, 13, 8);
  const destinationId = readPaddedAscii(raw, 21, 8);
  const packetId = read16BytePacketId(raw, 29);

  const createdAtEpochSeconds = view.getUint32(45, false);
  const lifetimeSeconds = view.getUint16(49, false);
  const payloadLength = view.getUint16(51, false);

  const isSigned = (flags & PacketFlags.IS_SIGNED) !== 0;
  const sigLen = isSigned ? SIGNATURE_SIZE_BYTES : 0;
  const expectedTotal = HEADER_SIZE_BYTES + payloadLength + sigLen + CRC_SIZE_BYTES;

  if (raw.length < expectedTotal) {
    return null; // Truncated frame
  }

  // Verify CRC32
  const computedCrc = calculateCRC32(raw.subarray(0, expectedTotal - CRC_SIZE_BYTES));
  const packetCrc = view.getUint32(expectedTotal - CRC_SIZE_BYTES, false);
  if (computedCrc !== packetCrc) {
    return null; // CRC mismatch
  }

  const payloadBytes = raw.subarray(HEADER_SIZE_BYTES, HEADER_SIZE_BYTES + payloadLength);
  const payloadStr = new TextDecoder().decode(payloadBytes);

  let parsedPayload: any = payloadStr;
  try {
    parsedPayload = JSON.parse(payloadStr);
  } catch {
    parsedPayload = payloadStr;
  }

  let signature: string | undefined = undefined;
  let signatureBytes: Uint8Array | undefined = undefined;

  if (isSigned) {
    signatureBytes = raw.slice(HEADER_SIZE_BYTES + payloadLength, HEADER_SIZE_BYTES + payloadLength + SIGNATURE_SIZE_BYTES);
    signature = bytesToHex(signatureBytes);
  }

  const createdAt = createdAtEpochSeconds * 1000;
  const expiresAt = (createdAtEpochSeconds + (lifetimeSeconds || 900)) * 1000;

  const header: HoimuPacketHeader = {
    version,
    type,
    flags,
    ttl,
    hopCount,
    sequence,
    senderId: originId,
    originId,
    destinationId,
    packetId,
    length: payloadLength,
    createdAtEpochSeconds,
    lifetimeSeconds,
    createdAt,
    expiresAt,
    receivedAtLocal: Date.now(),
  };

  return {
    header,
    payload: parsedPayload as T,
    signature,
    signatureBytes,
  };
}
