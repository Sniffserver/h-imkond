import { describe, it, expect } from 'vitest';
import { encodeBinaryPacket, decodeBinaryPacket, serializePacket, deserializePacket, calculateCRC32, verifyFrameCRC } from '../protocol/codec';
import { createHoimuPacket } from '../protocol/packet';
import { HoimuPacketType, PacketFlags } from '../protocol/constants';
import { PlaintextMessagePayload, SOSPayload } from '../protocol/types';

describe('HÕIMU Protocol Binary Codec & Types', () => {
  it('serializes and deserializes fixed headers (senderId, destinationId, ttl, type, length)', () => {
    const payload: PlaintextMessagePayload = {
      text: 'Radio check from field node',
      senderCallsign: 'ALPHA-01',
      timestamp: Date.now(),
    };

    const packet = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      senderId: 'NODE_01',
      destinationId: 'NODE_02',
      ttl: 5,
      sequence: 42,
      flags: PacketFlags.IS_PRIORITY,
      payload,
    });

    const rawBuffer = encodeBinaryPacket(packet);
    expect(rawBuffer).toBeInstanceOf(Uint8Array);
    expect(rawBuffer.length).toBeGreaterThan(39 + 4); // 39 header + payload + 4 CRC

    // Verify CRC validity
    expect(verifyFrameCRC(rawBuffer)).toBe(true);

    const decoded = decodeBinaryPacket<PlaintextMessagePayload>(rawBuffer);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.header.senderId).toBe('NODE_01');
    expect(decoded.header.originId).toBe('NODE_01');
    expect(decoded.header.destinationId).toBe('NODE_02');
    expect(decoded.header.ttl).toBe(5);
    expect(decoded.header.type).toBe(HoimuPacketType.MESSAGE);
    expect(decoded.header.flags).toBe(PacketFlags.IS_PRIORITY);
    expect(decoded.header.sequence).toBe(42);
    expect(decoded.header.length).toBeGreaterThan(0);
    expect(decoded.payload.text).toBe('Radio check from field node');
  });

  it('correctly calculates IEEE 802.3 CRC32 and detects corrupted frames', () => {
    const data = new Uint8Array([0x48, 0x4F, 0x49, 0x4D, 0x01, 0x02, 0x03]);
    const crc = calculateCRC32(data);
    expect(typeof crc).toBe('number');
    expect(crc).toBeGreaterThan(0);

    const packet = createHoimuPacket<SOSPayload>({
      type: HoimuPacketType.SOS,
      senderId: 'SOS_NODE',
      destinationId: '*',
      payload: {
        emergencyType: 'medical',
        callsign: 'MEDIC-1',
        latitude: 59.437,
        longitude: 24.7536,
        description: 'Need oxygen cylinder',
        timestamp: Date.now(),
      },
    });

    const buffer = serializePacket(packet);

    // Corrupt one byte in payload
    const corrupted = new Uint8Array(buffer);
    corrupted[40] = corrupted[40] ^ 0xFF;

    expect(verifyFrameCRC(corrupted)).toBe(false);
    expect(deserializePacket(corrupted)).toBeNull();
  });
});
