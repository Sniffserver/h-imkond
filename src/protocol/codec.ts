/**
 * HÕIMU Compact Binary Frame Codec for Physical Radio (LoRa SX1262 / BLE / Wi-Fi Aware)
 * 
 * Frame Layout:
 * [0..3]    Magic Bytes 0x48 0x4F 0x49 0x4D ("HOIM")
 * [4]       Version (uint8)
 * [5]       Type (uint8)
 * [6]       Flags (uint8)
 * [7]       TTL (uint8)
 * [8]       Hop Count (uint8)
 * [9..12]   Sequence (uint32 big-endian)
 * [13..20]  Origin ID (8 bytes UTF-8 ASCII)
 * [21..28]  Destination ID (8 bytes UTF-8 ASCII)
 * [29..36]  Packet ID Hash (8 bytes ASCII)
 * [37..38]  Payload Length N (uint16 big-endian)
 * [39..39+N] Variable Length Payload Bytes
 * [39+N..42+N] CRC32 (uint32 big-endian)
 */

import { HoimuPacket, HoimuPacketHeader } from './types';
import { PROTOCOL_MAGIC, PROTOCOL_VERSION, HoimuPacketType, PacketFlags } from './constants';
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
  if (rawBytes.length < 43) return false;
  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const payloadLen = view.getUint16(37, false);
  const expectedTotal = 39 + payloadLen + 4;
  if (rawBytes.length < expectedTotal) return false;

  const content = rawBytes.subarray(0, 39 + payloadLen);
  const computedCrc = calculateCRC32(content);
  const storedCrc = view.getUint32(39 + payloadLen, false);
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
 * Encodes a structured packet into binary format with fixed header, variable payload, and CRC32.
 */
export function encodeBinaryPacket<T = any>(packet: HoimuPacket<T>): Uint8Array {
  const payloadContainer: { data: any; signature?: string } = {
    data: packet.payload,
  };
  if (packet.signature) {
    payloadContainer.signature = packet.signature;
  }
  const payloadStr = canonicalize(payloadContainer);
  const payloadBytes = new TextEncoder().encode(payloadStr);

  const headerSize = 39;
  const crcSize = 4;
  const totalLength = headerSize + payloadBytes.length + crcSize;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // 1. Magic bytes "HOIM"
  view.setUint32(0, PROTOCOL_MAGIC, false);
  view.setUint8(4, packet.header.version || PROTOCOL_VERSION);
  view.setUint8(5, packet.header.type);
  view.setUint8(6, packet.header.flags || PacketFlags.NONE);
  view.setUint8(7, packet.header.ttl);
  view.setUint8(8, packet.header.hopCount || 0);
  view.setUint32(9, packet.header.sequence || 0, false);

  writePaddedAscii(buffer, 13, 8, packet.header.originId || 'UNK');
  writePaddedAscii(buffer, 21, 8, packet.header.destinationId || '*');
  writePaddedAscii(buffer, 29, 8, packet.header.packetId || 'PKT');

  view.setUint16(37, payloadBytes.length, false);
  buffer.set(payloadBytes, headerSize);

  // Calculate CRC over header + payload
  const crc = calculateCRC32(buffer.subarray(0, headerSize + payloadBytes.length));
  view.setUint32(headerSize + payloadBytes.length, crc, false);

  return buffer;
}

/**
 * Decodes binary frame into a structured HoimuPacket, validating header magic, length, and CRC32.
 */
export function decodeBinaryPacket<T = any>(raw: Uint8Array): HoimuPacket<T> | null {
  if (raw.length < 43) {
    return null; // Too short to even have header + crc
  }

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const magic = view.getUint32(0, false);
  if (magic !== PROTOCOL_MAGIC) {
    return null; // Invalid magic
  }

  const headerSize = 39;
  const payloadLength = view.getUint16(37, false);
  const expectedTotal = headerSize + payloadLength + 4;

  if (raw.length < expectedTotal) {
    return null; // Truncated
  }

  // Verify CRC32
  const computedCrc = calculateCRC32(raw.subarray(0, headerSize + payloadLength));
  const packetCrc = view.getUint32(headerSize + payloadLength, false);
  if (computedCrc !== packetCrc) {
    return null; // CRC mismatch
  }

  const version = view.getUint8(4);
  const type = view.getUint8(5) as HoimuPacketType;
  const flags = view.getUint8(6);
  const ttl = view.getUint8(7);
  const hopCount = view.getUint8(8);
  const sequence = view.getUint32(9, false);
  const originId = readPaddedAscii(raw, 13, 8);
  const destinationId = readPaddedAscii(raw, 21, 8);
  const packetId = readPaddedAscii(raw, 29, 8);

  const payloadBytes = raw.subarray(headerSize, headerSize + payloadLength);
  const payloadStr = new TextDecoder().decode(payloadBytes);
  
  let parsedPayload: any = payloadStr;
  let signature: string | undefined = undefined;

  try {
    const parsed = JSON.parse(payloadStr);
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      parsedPayload = parsed.data;
      signature = parsed.signature;
    } else {
      parsedPayload = parsed;
    }
  } catch {
    parsedPayload = payloadStr;
  }

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
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  return {
    header,
    payload: parsedPayload as T,
    signature,
  };
}
