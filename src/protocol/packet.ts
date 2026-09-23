import { HoimuPacket, HoimuPacketHeader, HoimuPayload } from './types';
import {
  HoimuPacketType,
  PacketFlags,
  DEFAULT_TTL,
  DEFAULT_PACKET_EXPIRY_MS,
  PROTOCOL_VERSION,
} from './constants';

export interface CreateHoimuPacketOptions<T = HoimuPayload> {
  type?: HoimuPacketType;
  originId?: string;
  senderId?: string;
  destinationId?: string;
  payload: T;
  ttl?: number;
  sequence?: number;
  flags?: number;
  packetId?: string;
  createdAt?: number;
  expiresAt?: number;
}

let localSequenceCounter = 0;

export function generatePacketId(senderId: string, sequence: number, timestamp: number): string {
  const shortSender = senderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `pkt_${shortSender}_${sequence}_${timestamp.toString(36)}`;
}

export function createHoimuPacket<T = HoimuPayload>(options: CreateHoimuPacketOptions<T>): HoimuPacket<T> {
  const now = options.createdAt ?? Date.now();
  const sequence = options.sequence ?? ++localSequenceCounter;
  const senderId = options.senderId || options.originId || 'ANON';
  const destinationId = options.destinationId || '*';
  const packetId = options.packetId || generatePacketId(senderId, sequence, now);
  const ttl = options.ttl !== undefined ? options.ttl : DEFAULT_TTL;
  const expiresAt = options.expiresAt ?? now + DEFAULT_PACKET_EXPIRY_MS;

  const payloadStr = typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
  const length = new TextEncoder().encode(payloadStr).length;

  const header: HoimuPacketHeader = {
    version: PROTOCOL_VERSION,
    type: options.type ?? HoimuPacketType.MESSAGE,
    flags: options.flags ?? PacketFlags.NONE,
    ttl,
    hopCount: 0,
    sequence,
    senderId,
    originId: senderId,
    destinationId,
    packetId,
    length,
    createdAt: now,
    expiresAt,
  };

  return {
    header,
    payload: options.payload,
  };
}

export function decrementPacketTTL<T = HoimuPayload>(packet: HoimuPacket<T>): HoimuPacket<T> {
  return {
    ...packet,
    header: {
      ...packet.header,
      ttl: packet.header.ttl - 1,
      hopCount: packet.header.hopCount + 1,
    },
  };
}
