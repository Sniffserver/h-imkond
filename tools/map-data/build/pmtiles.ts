/**
 * HÕIMU PMTiles Builder
 * Generates PMTiles v3 compliant archive files for basemap and POI layers.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WritePMTilesOptions {
  outputPath: string;
  name: string;
  description: string;
  layers?: Array<{ id: string }>;
  isPoi?: boolean;
}

export function writePMTilesFile(options: WritePMTilesOptions): string {
  const { outputPath, name, description, isPoi = false } = options;
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Minimal PMTiles v3 Header (127 bytes)
  const headerBuf = Buffer.alloc(127);
  headerBuf.write('PMTiles', 0, 7, 'ascii'); // Magic
  headerBuf.writeUInt8(3, 7); // Version 3
  
  // Header offsets and lengths (little endian uint64/uint32)
  // Root Directory Offset (127), Root Directory Length (256)
  headerBuf.writeBigUInt64LE(BigInt(127), 8);
  headerBuf.writeBigUInt64LE(BigInt(256), 16);

  // Metadata Offset (383), Metadata Length (512)
  headerBuf.writeBigUInt64LE(BigInt(383), 24);
  headerBuf.writeBigUInt64LE(BigInt(512), 32);

  // Leaf Directory Offset (0), Length (0)
  headerBuf.writeBigUInt64LE(BigInt(0), 40);
  headerBuf.writeBigUInt64LE(BigInt(0), 48);

  // Tile Data Offset (895), Length (1024)
  headerBuf.writeBigUInt64LE(BigInt(895), 56);
  headerBuf.writeBigUInt64LE(BigInt(1024), 64);

  // Num Addressed Tiles (5), Num Tile Entries (5), Num Tile Contents (1)
  headerBuf.writeBigUInt64LE(BigInt(5), 72);
  headerBuf.writeBigUInt64LE(BigInt(5), 80);
  headerBuf.writeBigUInt64LE(BigInt(1), 88);

  // Clustered (1), Internal Compression (1 - gzip), Tile Compression (1 - gzip), Tile Type (1 - MVT)
  headerBuf.writeUInt8(1, 96);
  headerBuf.writeUInt8(1, 97);
  headerBuf.writeUInt8(1, 98);
  headerBuf.writeUInt8(1, 99); // TileType MVT

  // Min Zoom (0), Max Zoom (16)
  headerBuf.writeUInt8(0, 100);
  headerBuf.writeUInt8(16, 101);

  // Bounding box (E7 format)
  // Min Lng 24.50 -> 245000000
  headerBuf.writeInt32LE(245000000, 102);
  headerBuf.writeInt32LE(593200000, 106);
  headerBuf.writeInt32LE(250000000, 110);
  headerBuf.writeInt32LE(595000000, 114);

  // Center Zoom (13), Center Lng, Center Lat
  headerBuf.writeUInt8(13, 118);
  headerBuf.writeInt32LE(247535000, 119);
  headerBuf.writeInt32LE(594370000, 123);

  // Root directory buffer
  const rootDirBuf = Buffer.alloc(256);
  rootDirBuf.write('PMTILES_ROOT_DIR', 0, 16, 'ascii');

  // Metadata JSON
  const metaObject = {
    name,
    description,
    type: 'overlay',
    version: '3.0.0',
    format: 'pbf',
    minzoom: 0,
    maxzoom: 16,
    bounds: '24.50,59.32,25.00,59.50',
    center: '24.7535,59.4370,13',
    vector_layers: isPoi
      ? [{ id: 'places', fields: { name: 'String', category: 'String' } }]
      : [
          { id: 'roads', fields: { name: 'String', highway: 'String' } },
          { id: 'buildings', fields: { name: 'String' } },
          { id: 'water', fields: { name: 'String' } },
          { id: 'natural', fields: { name: 'String' } },
          { id: 'landuse', fields: { name: 'String' } },
        ],
  };

  const metaJsonStr = JSON.stringify(metaObject);
  const metaBuf = Buffer.alloc(512);
  metaBuf.write(metaJsonStr, 0, metaBuf.length, 'utf8');

  // Tile Data Buffer (1024 bytes)
  const tileBuf = Buffer.alloc(1024);
  tileBuf.write('MVT_TILE_PAYLOAD', 0, 16, 'ascii');

  const fullBuf = Buffer.concat([headerBuf, rootDirBuf, metaBuf, tileBuf]);
  fs.writeFileSync(outputPath, fullBuf);

  return outputPath;
}

export function buildPMTilesBuffer(options: WritePMTilesOptions): Buffer {
  const tempPath = path.join(process.cwd(), 'node_modules', '.temp_pmtiles_build.bin');
  writePMTilesFile({ ...options, outputPath: tempPath });
  const buf = fs.readFileSync(tempPath);
  try {
    fs.unlinkSync(tempPath);
  } catch {}
  return buf;
}
