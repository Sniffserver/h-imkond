import { describe, it, expect } from 'vitest';
import { GOLDEN_VECTORS } from '../../protocol/vectors';
import {
  encodeBinaryPacket,
  decodeBinaryPacket,
  verifyFrameCRC,
} from '../../protocol/codec';
import { fromHex, toHex } from '../../core/crypto/utils';
import { HoimuPacket } from '../../protocol/types';

describe('Cross-Platform Protocol Golden Vectors', () => {
  it('decodes and re-encodes DATA-001 identically', () => {
    const vector = GOLDEN_VECTORS['data-001'];
    const raw = fromHex(vector.hex);

    expect(verifyFrameCRC(raw)).toBe(true);
    const decoded = decodeBinaryPacket(raw);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(vector.type);
    expect(decoded?.header.originId).toBe(vector.originId);
    expect(decoded?.header.destinationId).toBe(vector.destinationId);
    expect(decoded?.header.packetId).toBe(vector.packetId);
    expect(decoded?.header.sequence).toBe(vector.sequence);
    expect(decoded?.payload).toEqual(vector.payload);

    const reencoded = encodeBinaryPacket(decoded!);
    expect(toHex(reencoded)).toBe(vector.hex);
  });

  it('decodes and re-encodes ENCRYPTED-001 identically', () => {
    const vector = GOLDEN_VECTORS['encrypted-001'];
    const raw = fromHex(vector.hex);

    expect(verifyFrameCRC(raw)).toBe(true);
    const decoded = decodeBinaryPacket(raw);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(vector.type);
    expect(decoded?.header.originId).toBe(vector.originId);
    expect(decoded?.header.destinationId).toBe(vector.destinationId);
    expect(decoded?.header.packetId).toBe(vector.packetId);
    expect(decoded?.payload).toEqual(vector.payload);

    const reencoded = encodeBinaryPacket(decoded!);
    expect(toHex(reencoded)).toBe(vector.hex);
  });

  it('decodes and re-encodes SOS-001 identically', () => {
    const vector = GOLDEN_VECTORS['sos-001'];
    const raw = fromHex(vector.hex);

    expect(verifyFrameCRC(raw)).toBe(true);
    const decoded = decodeBinaryPacket(raw);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(vector.type);
    expect(decoded?.header.originId).toBe(vector.originId);
    expect(decoded?.header.destinationId).toBe(vector.destinationId);
    expect(decoded?.header.packetId).toBe(vector.packetId);
    expect(decoded?.payload).toEqual(vector.payload);

    const reencoded = encodeBinaryPacket(decoded!);
    expect(toHex(reencoded)).toBe(vector.hex);
  });

  it('decodes and re-encodes ACK-001 identically', () => {
    const vector = GOLDEN_VECTORS['ack-001'];
    const raw = fromHex(vector.hex);

    expect(verifyFrameCRC(raw)).toBe(true);
    const decoded = decodeBinaryPacket(raw);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(vector.type);
    expect(decoded?.header.originId).toBe(vector.originId);
    expect(decoded?.header.destinationId).toBe(vector.destinationId);
    expect(decoded?.header.packetId).toBe(vector.packetId);
    expect(decoded?.payload).toEqual(vector.payload);

    const reencoded = encodeBinaryPacket(decoded!);
    expect(toHex(reencoded)).toBe(vector.hex);
  });

  it('decodes and re-encodes ROUTING-001 identically', () => {
    const vector = GOLDEN_VECTORS['routing-001'];
    const raw = fromHex(vector.hex);

    expect(verifyFrameCRC(raw)).toBe(true);
    const decoded = decodeBinaryPacket(raw);

    expect(decoded).not.toBeNull();
    expect(decoded?.header.type).toBe(vector.type);
    expect(decoded?.header.originId).toBe(vector.originId);
    expect(decoded?.header.destinationId).toBe(vector.destinationId);
    expect(decoded?.header.packetId).toBe(vector.packetId);
    expect(decoded?.payload).toEqual(vector.payload);

    const reencoded = encodeBinaryPacket(decoded!);
    expect(toHex(reencoded)).toBe(vector.hex);
  });
});
