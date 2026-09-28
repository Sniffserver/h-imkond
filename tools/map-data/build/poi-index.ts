/**
 * HÕIMU POI Index Builder
 * Generates JSON canonical place datasets and spatial POI index (`HPOII`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { MapPlace } from '../../../src/types';

export function writePoiArtifacts(
  places: MapPlace[],
  outputJsonDir: string,
  outputIndexDir: string
): { jsonPath: string; indexPath: string } {
  if (!fs.existsSync(outputJsonDir)) fs.mkdirSync(outputJsonDir, { recursive: true });
  if (!fs.existsSync(outputIndexDir)) fs.mkdirSync(outputIndexDir, { recursive: true });

  const jsonPath = path.join(outputJsonDir, 'tallinn-places.json');
  fs.writeFileSync(jsonPath, JSON.stringify(places, null, 2), 'utf8');

  // Binary Spatial POI Index (`HPOII` magic)
  const headerBuf = Buffer.alloc(16);
  headerBuf.write('HPOII', 0, 5, 'ascii'); // Magic HPOII
  headerBuf.writeUInt16LE(1, 5); // Version 1
  headerBuf.writeUInt32LE(places.length, 8); // Record Count at offset 8

  // 32 bytes per POI entry
  const recordSize = 32;
  const bodyBuf = Buffer.alloc(places.length * recordSize);

  places.forEach((p, idx) => {
    const offset = idx * recordSize;
    bodyBuf.writeFloatLE(p.location.lat, offset);
    bodyBuf.writeFloatLE(p.location.lng, offset + 4);
    bodyBuf.writeUInt32LE(idx, offset + 8); // Index
    bodyBuf.write(p.id.substring(0, 16), offset + 12, 16, 'ascii');
  });

  const fullBuf = Buffer.concat([headerBuf, bodyBuf]);
  const indexPath = path.join(outputIndexDir, 'tallinn-poi.index');
  fs.writeFileSync(indexPath, fullBuf);

  return { jsonPath, indexPath };
}

export function buildPoiBinaryIndex(places: MapPlace[]): Buffer {
  const tempDir = path.join(process.cwd(), 'node_modules');
  const { indexPath } = writePoiArtifacts(places, tempDir, tempDir);
  const buf = fs.readFileSync(indexPath);
  try {
    fs.unlinkSync(indexPath);
  } catch {}
  return buf;
}
