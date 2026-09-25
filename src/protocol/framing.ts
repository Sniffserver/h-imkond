/**
 * HÕIMU Wire Framing & Packet Boundaries Utility
 */

import {
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  HEADER_SIZE_BYTES,
  SIGNATURE_SIZE_BYTES,
  CRC_SIZE_BYTES,
  PacketFlags,
} from './constants';

export interface FrameInfo {
  magic: number;
  version: number;
  packetType: number;
  flags: number;
  ttl: number;
  hopCount: number;
  sequence: number;
  originId: string;
  destinationId: string;
  packetId: string;
  createdAtEpochSeconds: number;
  lifetimeSeconds: number;
  payloadLength: number;
  isSigned: boolean;
  totalLength: number;
  isValidHeader: boolean;
}

export function parseFrameInfo(rawBytes: Uint8Array): FrameInfo | null {
  if (rawBytes.length < HEADER_SIZE_BYTES + CRC_SIZE_BYTES) return null;

  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const magic = view.getUint32(0, false);
  const version = view.getUint8(4);
  const packetType = view.getUint8(5);
  const flags = view.getUint8(6);
  const ttl = view.getUint8(7);
  const hopCount = view.getUint8(8);
  const sequence = view.getUint32(9, false);

  const decoder = new TextDecoder('utf-8');
  const originId = decoder.decode(rawBytes.subarray(13, 21)).trim();
  const destinationId = decoder.decode(rawBytes.subarray(21, 29)).trim();
  const packetId = decoder.decode(rawBytes.subarray(29, 45)).trim();

  const createdAtEpochSeconds = view.getUint32(45, false);
  const lifetimeSeconds = view.getUint16(49, false);
  const payloadLength = view.getUint16(51, false);

  const isSigned = (flags & PacketFlags.IS_SIGNED) !== 0;
  const sigLen = isSigned ? SIGNATURE_SIZE_BYTES : 0;
  const totalLength = HEADER_SIZE_BYTES + payloadLength + sigLen + CRC_SIZE_BYTES;

  const isValidHeader =
    magic === PROTOCOL_MAGIC &&
    version === PROTOCOL_VERSION &&
    rawBytes.length >= totalLength;

  return {
    magic,
    version,
    packetType,
    flags,
    ttl,
    hopCount,
    sequence,
    originId,
    destinationId,
    packetId,
    createdAtEpochSeconds,
    lifetimeSeconds,
    payloadLength,
    isSigned,
    totalLength,
    isValidHeader,
  };
}
