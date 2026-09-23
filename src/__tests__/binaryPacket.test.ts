import { describe, it, expect } from 'vitest';
import {
  encodeBinaryPacket,
  decodeBinaryPacket,
  computeCrc32,
  calculateBinaryAirtimeMs,
  PacketType,
  BinaryPacket,
} from '../services/mesh/binaryPacket';

describe('HÕIMU Compact Binary RF Protocol & LoRa Wire Framing', () => {
  it('encodes and decodes a compact binary packet accurately with CRC32 verification', () => {
    const originalPayload = new TextEncoder().encode('Hello Bioregion Mesh SOS Alert!');
    const packet: BinaryPacket = {
      header: {
        version: 1,
        type: PacketType.SOS_EMERGENCY,
        flags: {
          isEncrypted: true,
          isPriority: true,
          ackRequested: true,
        },
        ttl: 4,
        hopCount: 1,
        networkId: 0x484f494d,
        originId: 'TARTU-01',
        packetId: 'PKT-9988',
        sequence: 42,
        payloadLength: originalPayload.length,
      },
      payload: originalPayload,
      crc: 0,
    };

    const encoded = encodeBinaryPacket(packet);
    expect(encoded.length).toBe(33 + originalPayload.length + 4);
    expect(encoded[0]).toBe(0x48); // 'H'
    expect(encoded[1]).toBe(0x4f); // 'O'

    const decoded = decodeBinaryPacket(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.header.version).toBe(1);
    expect(decoded?.header.type).toBe(PacketType.SOS_EMERGENCY);
    expect(decoded?.header.flags.isEncrypted).toBe(true);
    expect(decoded?.header.flags.isPriority).toBe(true);
    expect(decoded?.header.flags.ackRequested).toBe(true);
    expect(decoded?.header.ttl).toBe(4);
    expect(decoded?.header.hopCount).toBe(1);
    expect(decoded?.header.originId).toBe('TARTU-01');
    expect(decoded?.header.packetId).toBe('PKT-9988');
    expect(decoded?.header.sequence).toBe(42);
    expect(new TextDecoder().decode(decoded?.payload)).toBe('Hello Bioregion Mesh SOS Alert!');
  });

  it('detects and rejects bit corruption / CRC32 mismatch', () => {
    const originalPayload = new TextEncoder().encode('Test Data Frame');
    const packet: BinaryPacket = {
      header: {
        version: 1,
        type: PacketType.DATA,
        flags: { isEncrypted: false, isPriority: false, ackRequested: false },
        ttl: 3,
        hopCount: 0,
        networkId: 0x484f494d,
        originId: 'NODE-A',
        packetId: 'PKT-100',
        sequence: 1,
        payloadLength: originalPayload.length,
      },
      payload: originalPayload,
      crc: 0,
    };

    const encoded = encodeBinaryPacket(packet);
    
    // Corrupt one byte in the payload
    encoded[35] = encoded[35] ^ 0xff;

    const decoded = decodeBinaryPacket(encoded);
    expect(decoded).toBeNull(); // Rejected by CRC32 check
  });

  it('calculates realistic low Airtime (ToA) compared to JSON overhead', () => {
    // 33-byte binary payload + 37-byte header/CRC = ~70 bytes total
    const binaryToa = calculateBinaryAirtimeMs(33, 7, 125, '4/5');
    
    // Equivalent JSON packet (~400 bytes)
    const jsonToa = calculateBinaryAirtimeMs(400, 7, 125, '4/5');

    expect(binaryToa).toBeLessThan(150); // ~120ms at SF7
    expect(jsonToa).toBeGreaterThan(300); // >300ms at SF7
    expect(binaryToa).toBeLessThan(jsonToa / 2.0); // Significant airtime reduction
  });
});
