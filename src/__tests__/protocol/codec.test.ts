import { describe, it, expect } from 'vitest';
import {
  encodeBinaryPacket,
  decodeBinaryPacket,
  calculateCRC32,
  verifyFrameCRC,
} from '../../protocol/codec';
import { HoimuPacketType, PacketFlags } from '../../protocol/constants';
import { HoimuPacket } from '../../protocol/types';

describe('HÕIMU Protocol Binary Codec', () => {
  it('encodes and decodes a broadcast message packet with full fidelity', () => {
    const packet: HoimuPacket = {
      header: {
        version: 1,
        type: HoimuPacketType.MESSAGE,
        flags: PacketFlags.NONE,
        ttl: 7,
        hopCount: 0,
        sequence: 1234,
        senderId: 'TAL-01',
        originId: 'TAL-01',
        destinationId: '*',
        packetId: 'PKT1234',
        length: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
      payload: { text: 'Testing binary mesh packet' },
    };

    const encoded = encodeBinaryPacket(packet);
    expect(encoded.length).toBeGreaterThanOrEqual(43);
    expect(verifyFrameCRC(encoded)).toBe(true);

    const decoded = decodeBinaryPacket(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(HoimuPacketType.MESSAGE);
    expect(decoded?.header.originId).toBe('TAL-01');
    expect(decoded?.header.destinationId).toBe('*');
    expect(decoded?.header.packetId).toBe('PKT1234');
    expect(decoded?.header.sequence).toBe(1234);
    expect(decoded?.payload).toEqual({ text: 'Testing binary mesh packet' });
  });

  it('rejects bit corruption via CRC32 check', () => {
    const packet: HoimuPacket = {
      header: {
        version: 1,
        type: HoimuPacketType.SOS,
        flags: PacketFlags.IS_PRIORITY,
        ttl: 10,
        hopCount: 0,
        sequence: 99,
        senderId: 'SOS-01',
        originId: 'SOS-01',
        destinationId: '*',
        packetId: 'SOS99',
        length: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
      payload: { emergency: true },
    };

    const encoded = encodeBinaryPacket(packet);
    // Flip a bit in the payload area
    encoded[25] ^= 0xff;

    expect(verifyFrameCRC(encoded)).toBe(false);
    expect(decodeBinaryPacket(encoded)).toBeNull();
  });

  it('rejects truncated frames', () => {
    const packet: HoimuPacket = {
      header: {
        version: 1,
        type: HoimuPacketType.ACK,
        flags: PacketFlags.NONE,
        ttl: 3,
        hopCount: 1,
        sequence: 55,
        senderId: 'NODE-A',
        originId: 'NODE-A',
        destinationId: 'NODE-B',
        packetId: 'ACK55',
        length: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
      payload: { ack: true },
    };

    const encoded = encodeBinaryPacket(packet);
    const truncated = encoded.subarray(0, 30); // Less than minimum 43 bytes
    expect(decodeBinaryPacket(truncated)).toBeNull();
  });
});
