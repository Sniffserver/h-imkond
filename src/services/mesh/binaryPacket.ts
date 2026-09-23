/**
 * HÕIMU Compact Binary RF Wire Protocol (LoRa / BLE Framing)
 * 
 * Implements a bandwidth-efficient binary packet format (~32 byte header)
 * for physical RF transmission (Semtech SX1262 / SX1276 / BLE) to minimize Time on Air (ToA)
 * and strictly adhere to EU868 1% duty cycle limits.
 * 
 * Wire Specification:
 * ┌──────────┬──────────┬───────┬──────┬─────┬─────┬───────────┬──────────┬──────────┬──────────┬────────────┬─────────┬─────────┐
 * │ Magic    │ Version  │ Type  │ Flag │ TTL │ Hop │ NetworkId │ Origin   │ PacketId │ Sequence │ PayloadLen │ Payload │ CRC/Tag │
 * │ 2 Bytes  │ 1 Byte   │ 1 Byte│ 1 B  │ 1 B │ 1 B │ 4 Bytes   │ 8 Bytes  │ 8 Bytes  │ 4 Bytes  │ 2 Bytes    │ N Bytes │ 4 Bytes │
 * └──────────┴──────────┴───────┴──────┴─────┴─────┴───────────┴──────────┴──────────┴──────────┴────────────┴─────────┴─────────┘
 * Total Header Overhead: 32 Bytes (vs ~400+ bytes for verbose JSON strings).
 */

export const MESH_MAGIC_BYTES = new Uint8Array([0x48, 0x4f]); // "HO"
export const CURRENT_WIRE_VERSION = 1;
export const MAX_LORA_PAYLOAD_BYTES = 512; // Flexible MTU supporting encrypted envelopes and larger payloads

export enum PacketType {
  DATA = 0x01,
  ROUTING_ANNOUNCE = 0x02,
  SOS_EMERGENCY = 0x03,
  ACK = 0x04,
  TELEMETRY = 0x05,
  CRDT_MUTATION = 0x06,
}

export interface PacketFlags {
  isEncrypted: boolean;
  isPriority: boolean;
  ackRequested: boolean;
}

export interface BinaryHeader {
  version: number;
  type: PacketType;
  flags: PacketFlags;
  ttl: number;
  hopCount: number;
  networkId: number;
  originId: string; // 8-char hex or trimmed callsign
  packetId: string; // 8-char hex
  sequence: number;
  payloadLength: number;
}

export interface BinaryPacket {
  header: BinaryHeader;
  payload: Uint8Array;
  crc: number;
}

/**
 * Standard CRC32 calculation for RF frame verification
 */
export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function stringTo8Bytes(str: string): Uint8Array {
  const bytes = new Uint8Array(8);
  const encoded = new TextEncoder().encode(str);
  for (let i = 0; i < 8 && i < encoded.length; i++) {
    bytes[i] = encoded[i];
  }
  return bytes;
}

function bytesTo8String(bytes: Uint8Array, offset: number): string {
  const slice = bytes.subarray(offset, offset + 8);
  let str = '';
  for (let i = 0; i < 8; i++) {
    if (slice[i] === 0) break;
    str += String.fromCharCode(slice[i]);
  }
  return str || 'NODE_UNK';
}

export const HEADER_SIZE = 33; // 2+1+1+1+1+1+4+8+8+4+2 = 33 Bytes
export const CRC_SIZE = 4;

/**
 * Serializes a structured packet into a compact binary wire buffer
 */
export function encodeBinaryPacket(packet: BinaryPacket): Uint8Array {
  const payloadLen = packet.payload.length;
  if (payloadLen > MAX_LORA_PAYLOAD_BYTES) {
    throw new Error(`Payload size (${payloadLen}B) exceeds max LoRa MTU (${MAX_LORA_PAYLOAD_BYTES}B)`);
  }

  const totalLength = HEADER_SIZE + payloadLen + CRC_SIZE;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // 1. Magic "HO" (2 bytes: 0..1)
  uint8[0] = MESH_MAGIC_BYTES[0];
  uint8[1] = MESH_MAGIC_BYTES[1];

  // 2. Version & Type (bytes 2, 3)
  view.setUint8(2, packet.header.version || CURRENT_WIRE_VERSION);
  view.setUint8(3, packet.header.type);

  // 3. Flags bitmask (byte 4)
  let flagBits = 0;
  if (packet.header.flags.isEncrypted) flagBits |= 0x01;
  if (packet.header.flags.isPriority) flagBits |= 0x02;
  if (packet.header.flags.ackRequested) flagBits |= 0x04;
  view.setUint8(4, flagBits);

  // 4. TTL & HopCount (bytes 5, 6)
  view.setUint8(5, packet.header.ttl);
  view.setUint8(6, packet.header.hopCount);

  // 5. NetworkId (uint32: bytes 7..10)
  view.setUint32(7, packet.header.networkId || 0x484f494d, false); // "HOIM"

  // 6. Origin ID (8 bytes: 11..18)
  const originBytes = stringTo8Bytes(packet.header.originId);
  uint8.set(originBytes, 11);

  // 7. Packet ID (8 bytes: 19..26)
  const packetIdBytes = stringTo8Bytes(packet.header.packetId);
  uint8.set(packetIdBytes, 19);

  // 8. Sequence (uint32: bytes 27..30)
  view.setUint32(27, packet.header.sequence, false);

  // 9. Payload Length (uint16: bytes 31..32)
  view.setUint16(31, payloadLen, false);

  // 10. Payload (bytes 33 .. 33+payloadLen-1)
  uint8.set(packet.payload, HEADER_SIZE);

  // 11. CRC32 over Header + Payload
  const dataToCrc = uint8.subarray(0, HEADER_SIZE + payloadLen);
  const crc = computeCrc32(dataToCrc);
  view.setUint32(HEADER_SIZE + payloadLen, crc, false);

  return uint8;
}

/**
 * Parses and verifies a compact binary RF buffer
 */
export function decodeBinaryPacket(bytes: Uint8Array): BinaryPacket | null {
  if (bytes.length < HEADER_SIZE + CRC_SIZE) {
    return null;
  }

  // 1. Magic check
  if (bytes[0] !== MESH_MAGIC_BYTES[0] || bytes[1] !== MESH_MAGIC_BYTES[1]) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(2);
  const type = view.getUint8(3) as PacketType;

  const flagBits = view.getUint8(4);
  const flags: PacketFlags = {
    isEncrypted: (flagBits & 0x01) !== 0,
    isPriority: (flagBits & 0x02) !== 0,
    ackRequested: (flagBits & 0x04) !== 0,
  };

  const ttl = view.getUint8(5);
  const hopCount = view.getUint8(6);
  const networkId = view.getUint32(7, false);

  const originId = bytesTo8String(bytes, 11);
  const packetId = bytesTo8String(bytes, 19);
  const sequence = view.getUint32(27, false);
  const payloadLength = view.getUint16(31, false);

  if (bytes.length < HEADER_SIZE + payloadLength + CRC_SIZE) {
    return null; // Incomplete packet
  }

  const payload = bytes.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength);
  const expectedCrc = view.getUint32(HEADER_SIZE + payloadLength, false);

  // Verify CRC32
  const computedCrc = computeCrc32(bytes.subarray(0, HEADER_SIZE + payloadLength));
  if (computedCrc !== expectedCrc) {
    console.warn('[binaryPacket] CRC32 checksum error. Discarding corrupted RF frame.');
    return null;
  }

  return {
    header: {
      version,
      type,
      flags,
      ttl,
      hopCount,
      networkId,
      originId,
      packetId,
      sequence,
      payloadLength,
    },
    payload,
    crc: expectedCrc,
  };
}

/**
 * Calculates LoRa packet Time on Air (ToA) in milliseconds for compact binary packets
 */
export function calculateBinaryAirtimeMs(
  payloadBytesLen: number,
  sf = 7,
  bwKhz = 125,
  cr: '4/5' | '4/6' | '4/7' | '4/8' = '4/5'
): number {
  const nPreamble = 8;
  const tSym = ((2 ** sf) / (bwKhz * 1000.0)) * 1000.0; // Symbol time in ms
  const tPreamble = (nPreamble + 4.25) * tSym;

  const crDenom = cr === '4/5' ? 1 : cr === '4/6' ? 2 : cr === '4/7' ? 3 : 4;
  const de = bwKhz === 125 && (sf === 11 || sf === 12) ? 1 : 0;

  const totalBytes = 32 + payloadBytesLen + 4;
  const tmp = (8.0 * totalBytes - 4.0 * sf + 28.0 + 16.0) / (4.0 * (sf - 2 * de));
  const payloadSymNb = 8 + Math.max(Math.ceil(tmp) * (crDenom + 4), 0);
  const tPayload = payloadSymNb * tSym;

  return Math.round((tPreamble + tPayload) * 100) / 100;
}
