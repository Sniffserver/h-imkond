import { describe, it, expect } from 'vitest';
import { PacketCompressor, COMPRESSION_THRESHOLD_BYTES } from '../services/mesh/packetCompressor';
import { CompactBinaryCodec } from '../services/mesh/compactBinaryCodec';
import { PacketType } from '../services/mesh/binaryPacket';

describe('PacketCompressor (Requirement 45: Adaptive Compression Policy)', () => {
  it('does NOT compress small payloads (< COMPRESSION_THRESHOLD_BYTES)', () => {
    const smallPayload = new TextEncoder().encode('Hello LoRa');
    expect(smallPayload.length).toBeLessThan(COMPRESSION_THRESHOLD_BYTES);

    const result = PacketCompressor.processOutbound(smallPayload);
    expect(result.compressed).toBe(false);
    expect(result.data).toEqual(smallPayload);
    expect(result.finalSize).toBe(smallPayload.length);
  });

  it('compresses repeated large payloads (>= COMPRESSION_THRESHOLD_BYTES)', () => {
    // 100 repeated bytes
    const repeatedPayload = new Uint8Array(100).fill(0xaa);
    const result = PacketCompressor.processOutbound(repeatedPayload);

    expect(result.compressed).toBe(true);
    expect(result.finalSize).toBeLessThan(repeatedPayload.length);
    expect(result.savingPercent).toBeGreaterThan(50);

    const decompressed = PacketCompressor.processInbound(result.data, result.compressed);
    expect(decompressed).toEqual(repeatedPayload);
  });

  it('falls back to original uncompressed payload if compression expands the data', () => {
    // 80 random uncompressible bytes
    const randomPayload = new Uint8Array(80);
    for (let i = 0; i < 80; i++) {
      randomPayload[i] = (i * 37 + 13) % 256;
    }

    const result = PacketCompressor.processOutbound(randomPayload);
    // If output size >= original, compressed must be false
    expect(result.compressed).toBe(false);
    expect(result.data).toEqual(randomPayload);
  });
});

describe('CompactBinaryCodec (Requirement 46: Binary Serialization as Primary RF Layer)', () => {
  it('encodes and decodes SOS emergency packet into compact 24-byte binary body', () => {
    const sosData = {
      latitude: 59.437012,
      longitude: 24.753515,
      batteryPercent: 88,
      emergencyCode: 3,
      callsign: 'TAL-01',
    };

    const binaryBuf = CompactBinaryCodec.encodeSosBody(sosData);
    expect(binaryBuf.length).toBe(24);

    const decoded = CompactBinaryCodec.decodeSosBody(binaryBuf);
    expect(decoded.latitude).toBeCloseTo(sosData.latitude, 4);
    expect(decoded.longitude).toBeCloseTo(sosData.longitude, 4);
    expect(decoded.batteryPercent).toBe(sosData.batteryPercent);
    expect(decoded.emergencyCode).toBe(sosData.emergencyCode);
    expect(decoded.callsign).toBe('TAL-01');
  });

  it('encodes and decodes Telemetry packet into compact 18-byte binary body', () => {
    const telemData = {
      latitude: 59.4382,
      longitude: 24.7551,
      batteryPercent: 92,
      solarWatts: 14.5,
      queueLength: 2,
    };

    const binaryBuf = CompactBinaryCodec.encodeTelemetryBody(telemData);
    expect(binaryBuf.length).toBe(18);

    const decoded = CompactBinaryCodec.decodeTelemetryBody(binaryBuf);
    expect(decoded.latitude).toBeCloseTo(telemData.latitude, 4);
    expect(decoded.longitude).toBeCloseTo(telemData.longitude, 4);
    expect(decoded.batteryPercent).toBe(telemData.batteryPercent);
    expect(decoded.solarWatts).toBeCloseTo(telemData.solarWatts, 1);
    expect(decoded.queueLength).toBe(2);
  });

  it('generates debug JSON object representation from binary packet', () => {
    const sosData = {
      latitude: 59.437,
      longitude: 24.753,
      batteryPercent: 85,
      emergencyCode: 1,
      callsign: 'TARTU-02',
    };

    const binaryPayload = CompactBinaryCodec.encodeSosBody(sosData);

    const mockPacket = {
      header: {
        version: 1,
        type: PacketType.SOS_EMERGENCY,
        flags: { isEncrypted: false, isPriority: true, ackRequested: true },
        ttl: 5,
        hopCount: 0,
        networkId: 0x484f494d,
        originId: 'TARTU-02',
        packetId: 'pkt99999',
        sequence: 42,
        payloadLength: binaryPayload.length,
      },
      payload: binaryPayload,
      crc: 0x12345678,
    };

    const debugJson = CompactBinaryCodec.toDebugJson(mockPacket);
    expect(debugJson.rfHeader.originId).toBe('TARTU-02');
    expect(debugJson.debugData.callsign).toBe('TARTU-02');
    expect(debugJson.debugData.batteryPercent).toBe(85);
  });
});
