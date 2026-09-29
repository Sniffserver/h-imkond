import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const requireFn = createRequire(import.meta.url);
(globalThis as any).nodeZlib = requireFn('zlib');

import { verifyPMTilesThreeLevels } from '../services/map/pmtilesVerifier';
import { zxyToTileId } from 'pmtiles';

// -------------------------------------------------------------
// STANDALONE, INDEPENDENT VECTOR TILE & PMTILES BUILDER
// (Generated completely independently of production tools)
// -------------------------------------------------------------

function standaloneVarint(val: number): number[] {
  const buf: number[] = [];
  let n = Math.floor(val);
  while (n >= 0x80) {
    buf.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  buf.push(n & 0x7f);
  return buf;
}

function standalonePointGeom(x: number, y: number): number[] {
  const zigzag = (v: number) => (v << 1) ^ (v >> 31);
  return [
    (1 & 0x07) | (1 << 3), // MoveTo count 1
    ...standaloneVarint(zigzag(x)),
    ...standaloneVarint(zigzag(y)),
  ];
}

function standaloneMvt(layerName: string, lat: number, lng: number): Uint8Array {
  // Simple MVT layer encoding:
  // Layer name, 1 Point feature, 1 key ("name"), 1 value ("Golden Feature")
  const keyBytes = new TextEncoder().encode('name');
  const valBytes = new TextEncoder().encode('Golden Feature');

  const valueMessage = [
    (1 << 3) | 2, // Field 1 (string), wire type 2
    ...standaloneVarint(valBytes.length),
    ...Array.from(valBytes),
  ];

  const featureMessage = [
    (1 << 3) | 0, // id, field 1, varint
    ...standaloneVarint(999),
    (2 << 3) | 2, // tags, field 2, length-delimited
    ...standaloneVarint(2), // length of tags list (key 0, value 0)
    0, 0,
    (3 << 3) | 0, // type, field 3, varint (POINT = 1)
    1,
    (4 << 3) | 2, // geometry, field 4, length-delimited
    ...standaloneVarint(5), // MoveTo command length
    ...standalonePointGeom(2048, 2048), // Local tile center
  ];

  const layerMessage = [
    (15 << 3) | 0, // version, field 15, varint (2)
    2,
    (1 << 3) | 2, // name, field 1, length-delimited
    ...standaloneVarint(layerName.length),
    ...Array.from(new TextEncoder().encode(layerName)),
    (2 << 3) | 2, // features, field 2, length-delimited
    ...standaloneVarint(featureMessage.length),
    ...featureMessage,
    (3 << 3) | 2, // keys, field 3, length-delimited
    ...standaloneVarint(keyBytes.length),
    ...Array.from(keyBytes),
    (4 << 3) | 2, // values, field 4, length-delimited
    ...standaloneVarint(valueMessage.length),
    ...valueMessage,
    (5 << 3) | 0, // extent, field 5, varint (4096)
    ...standaloneVarint(4096),
  ];

  const mvtMessage = [
    (3 << 3) | 2, // Layer, field 3 in MVT
    ...standaloneVarint(layerMessage.length),
    ...layerMessage,
  ];

  return new Uint8Array(mvtMessage);
}

function standaloneDirectory(entries: { tileId: number; offset: number; length: number }[]): Uint8Array {
  const parts: number[] = [entries.length];

  // Tile IDs
  let lastTileId = 0;
  for (const e of entries) {
    parts.push(...standaloneVarint(e.tileId - lastTileId));
    lastTileId = e.tileId;
  }
  // Run Lengths
  for (const _ of entries) {
    parts.push(1);
  }
  // Lengths
  for (const e of entries) {
    parts.push(...standaloneVarint(e.length));
  }
  // Offset Deltas
  let lastOffset = 0;
  let lastLength = 0;
  for (const e of entries) {
    parts.push(...standaloneVarint(e.offset - lastOffset - lastLength));
    lastOffset = e.offset;
    lastLength = e.length;
  }

  return new Uint8Array(parts);
}

describe('Golden Independently Generated PMTiles Verification Test', () => {
  it('verifies a fully conformant independently compiled PMTiles v3 fixture with zero tautology', () => {
    // We will build a small, correct uncompressed PMTiles v3 buffer
    // that contains 5 real MVT tiles corresponding to center, north, south, east, west at z=13
    const samplePoints = [
      { lat: 59.4370, lng: 24.7535 }, // center
      { lat: 59.4670, lng: 24.7535 }, // north
      { lat: 59.4070, lng: 24.7535 }, // south
      { lat: 59.4370, lng: 24.8035 }, // east
      { lat: 59.4370, lng: 24.7035 }, // west
    ];

    const entries: { tileId: number; offset: number; length: number }[] = [];
    const tileItems: { tileId: number; mvtBytes: Uint8Array }[] = [];
    const tilesBlocks: Uint8Array[] = [];
    let curOffset = 0;

    const getTileCoords = (lat: number, lng: number) => {
      const latRad = (lat * Math.PI) / 180;
      const x = Math.floor(((lng + 180) / 360) * 8192);
      const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 8192
      );
      return { x, y };
    };

    for (const pt of samplePoints) {
      const tile = getTileCoords(pt.lat, pt.lng);
      const tileId = zxyToTileId(13, tile.x, tile.y);
      const mvtBytes = standaloneMvt('places', pt.lat, pt.lng);
      tileItems.push({ tileId, mvtBytes });
    }

    // Sort tileItems by tileId
    tileItems.sort((a, b) => a.tileId - b.tileId);

    for (const item of tileItems) {
      tilesBlocks.push(item.mvtBytes);
      entries.push({
        tileId: item.tileId,
        offset: curOffset,
        length: item.mvtBytes.length,
      });
      curOffset += item.mvtBytes.length;
    }

    // Build uncompressed PMTiles Root Directory
    const rawDir = standaloneDirectory(entries);

    // Build uncompressed Metadata JSON
    const metadata = JSON.stringify({
      vector_layers: [{ id: 'places', fields: { name: 'String' } }],
    });
    const metaBytes = new TextEncoder().encode(metadata);

    // Assemble file
    const headerBuf = new ArrayBuffer(127);
    const header = new Uint8Array(headerBuf);
    const view = new DataView(headerBuf);

    // Write "PMTiles" magic
    const magic = [0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73]; // PMTiles
    magic.forEach((b, idx) => header[idx] = b);
    header[7] = 3; // spec version 3

    const rootOffset = 127;
    const rootBytes = rawDir.length;
    const metaOffset = rootOffset + rootBytes;
    const metaBytesCount = metaBytes.length;
    const tileDataOffset = metaOffset + metaBytesCount;
    const tileDataBytes = curOffset;

    view.setBigUint64(8, BigInt(rootOffset), true);
    view.setBigUint64(16, BigInt(rootBytes), true);
    view.setBigUint64(24, BigInt(metaOffset), true);
    view.setBigUint64(32, BigInt(metaBytesCount), true);
    view.setBigUint64(40, BigInt(0), true);
    view.setBigUint64(48, BigInt(0), true);
    view.setBigUint64(56, BigInt(tileDataOffset), true);
    view.setBigUint64(64, BigInt(tileDataBytes), true);

    view.setBigUint64(72, BigInt(entries.length), true);
    view.setBigUint64(80, BigInt(entries.length), true);
    view.setBigUint64(88, BigInt(entries.length), true);

    header[96] = 1; // clustered
    header[97] = 1; // internal compression = none (uncompressed directory & metadata)
    header[98] = 1; // tile compression = none
    header[99] = 1; // tile type = MVT
    header[100] = 10; // min zoom
    header[101] = 16; // max zoom

    view.setInt32(102, Math.round(24.50 * 10000000), true);
    view.setInt32(106, Math.round(59.32 * 10000000), true);
    view.setInt32(110, Math.round(25.00 * 10000000), true);
    view.setInt32(114, Math.round(59.50 * 10000000), true);

    header[118] = 13;
    view.setInt32(119, Math.round(24.7535 * 10000000), true);
    view.setInt32(123, Math.round(59.4370 * 10000000), true);

    const finalBuffer = new Uint8Array(127 + rootBytes + metaBytesCount + tileDataBytes);
    finalBuffer.set(header, 0);
    finalBuffer.set(rawDir, 127);
    finalBuffer.set(metaBytes, 127 + rootBytes);
    
    let blockOffset = 127 + rootBytes + metaBytesCount;
    for (const block of tilesBlocks) {
      finalBuffer.set(block, blockOffset);
      blockOffset += block.length;
    }

    // ACT: Run the deep HÕIMU 3-Level Verifier
    const result = verifyPMTilesThreeLevels(finalBuffer, 59.4370, 24.7535);

    if (!result.valid) {
      console.log('Verification Errors:', result.errors);
    }

    // ASSERT:
    expect(result.valid).toBe(true);
    expect(result.level1ContainerValid).toBe(true);
    expect(result.level2SemanticValid).toBe(true);
    expect(result.level3ContentValid).toBe(true);
    expect(result.details.sampledTilesCount).toBe(5);
    expect(result.details.layersCount).toBe(1);
    expect(result.errors.length).toBe(0);
  });
});
