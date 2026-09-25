import { HoimuPacket, HoimuPacketHeader, HoimuPayload } from './types';
import {
  HoimuPacketType,
  PacketFlags,
  DEFAULT_TTL,
  DEFAULT_PACKET_EXPIRY_MS,
  PROTOCOL_VERSION,
} from './constants';
import { getNextPersistentSequence } from './codec';

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
  createdAtEpochSeconds?: number;
  lifetimeSeconds?: number;
  signature?: string;
  signatureBytes?: Uint8Array;
}

/**
 * Generates a unique 16-byte packet identifier (32 hex characters on wire).
 */
export function generatePacketId(senderId?: string, sequence?: number, timestamp?: number): string {
  const t = timestamp ?? Date.now();
  const hexTime = Math.floor(t / 1000).toString(16).padStart(8, '0');
  const s = (sequence ?? 1) & 0xffff;
  const hexSeq = s.toString(16).padStart(4, '0');
  
  const rand = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 10; i++) rand[i] = Math.floor(Math.random() * 256);
  }
  const hexRand = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hexTime}${hexSeq}${hexRand}`;
}

export function createHoimuPacket<T = HoimuPayload>(options: CreateHoimuPacketOptions<T>): HoimuPacket<T> {
  const now = options.createdAt ?? Date.now();
  const sequence = options.sequence ?? getNextPersistentSequence();
  const senderId = (options.senderId || options.originId || 'ANON').slice(0, 8);
  const destinationId = (options.destinationId || '*').slice(0, 8);
  const packetId = options.packetId || generatePacketId(senderId, sequence, now);
  const ttl = options.ttl !== undefined ? options.ttl : DEFAULT_TTL;
  const expiresAt = options.expiresAt ?? (now + DEFAULT_PACKET_EXPIRY_MS);

  const createdAtEpochSeconds = options.createdAtEpochSeconds ?? Math.floor(now / 1000);
  const lifetimeSeconds = options.lifetimeSeconds ?? Math.max(1, Math.floor((expiresAt - now) / 1000));

  const payloadStr = typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
  const length = new TextEncoder().encode(payloadStr).length;

  let flags = options.flags ?? PacketFlags.NONE;
  if (options.signature || options.signatureBytes) {
    flags |= PacketFlags.IS_SIGNED;
  }

  const header: HoimuPacketHeader = {
    version: PROTOCOL_VERSION,
    type: options.type ?? HoimuPacketType.MESSAGE,
    flags,
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
    createdAtEpochSeconds,
    lifetimeSeconds,
    receivedAtLocal: now,
  };

  return {
    header,
    payload: options.payload,
    signature: options.signature,
    signatureBytes: options.signatureBytes,
  };
}

export function decrementPacketTTL<T = HoimuPayload>(packet: HoimuPacket<T>): HoimuPacket<T> {
  return {
    ...packet,
    header: {
      ...packet.header,
      ttl: Math.max(0, packet.header.ttl - 1),
      hopCount: packet.header.hopCount + 1,
    },
  };
}
