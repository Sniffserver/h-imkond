import { HoimuPacket } from './types';
import { MAX_PACKET_SIZE_BYTES } from './constants';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePacket(packet: HoimuPacket): ValidationResult {
  if (!packet || !packet.header) {
    return { valid: false, reason: 'Packet is null or missing header' };
  }

  const { header, payload } = packet;

  if (!header.originId || header.originId.trim() === '') {
    return { valid: false, reason: 'Origin ID is required' };
  }

  if (!header.packetId || header.packetId.trim() === '') {
    return { valid: false, reason: 'Packet ID is required' };
  }

  if (typeof header.ttl !== 'number' || header.ttl < 0) {
    return { valid: false, reason: 'TTL must be non-negative integer' };
  }

  if (header.expiresAt && Date.now() > header.expiresAt) {
    return { valid: false, reason: 'Packet has expired' };
  }

  if (payload === undefined) {
    return { valid: false, reason: 'Payload must not be undefined' };
  }

  return { valid: true };
}
