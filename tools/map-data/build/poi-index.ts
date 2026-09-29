import * as fs from 'fs';
import * as path from 'path';
import { MapPlace } from '../../../src/types';

export function buildPoiBinaryIndex(places: MapPlace[]): Buffer {
  const magic = 'HPOII';
  // Use a 16-byte aligned header format like our index signature checks
  const headerBuf = Buffer.alloc(16);
  headerBuf.write(magic, 0, magic.length, 'ascii');
  headerBuf.writeUInt32LE(places.length, 8); // Start count at offset 8

  const placeRecordBuffers: Buffer[] = [];
  for (const place of places) {
    const nameBytes = Buffer.from(place.name, 'utf8');
    const id = typeof place.id === 'number' ? place.id : parseInt(place.id, 10) || 12345;
    
    // id (4 bytes) + lat (8 bytes) + lng (8 bytes) + name length (2 bytes) + name
    const recBuf = Buffer.alloc(4 + 8 + 8 + 2 + nameBytes.length);
    recBuf.writeUInt32LE(id, 0);
    recBuf.writeDoubleLE(place.location.lat, 4);
    recBuf.writeDoubleLE(place.location.lng, 12);
    recBuf.writeUInt16LE(nameBytes.length, 20);
    nameBytes.copy(recBuf, 22);
    placeRecordBuffers.push(recBuf);
  }

  return Buffer.concat([headerBuf, ...placeRecordBuffers]);
}

export function writePoiArtifacts(
  places: MapPlace[],
  outputDirJson: string,
  outputDirIndex: string
): { jsonPath: string; indexPath: string } {
  console.log(`      Writing POI Artifacts: ${places.length} places...`);

  const jsonPath = path.join(outputDirJson, 'tallinn-places.json');
  const indexPath = path.join(outputDirIndex, 'tallinn-poi.index');

  // 1. Write tallinn-places.json
  fs.writeFileSync(jsonPath, JSON.stringify(places, null, 2), 'utf8');

  // 2. Write binary tallinn-poi.index
  const finalIndexBuffer = buildPoiBinaryIndex(places);
  fs.writeFileSync(indexPath, finalIndexBuffer);

  console.log(`      ✓ POI artifacts written: ${jsonPath} | ${indexPath} (${finalIndexBuffer.length} bytes)`);

  return { jsonPath, indexPath };
}
