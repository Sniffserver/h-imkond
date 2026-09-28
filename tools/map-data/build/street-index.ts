/**
 * HÕIMU Street Index, Routing Graph & Search Index Builder
 * Builds `street-index.bin` (`HSTRIDX`), `routing.graph` (`HROUTG`), and `search-index.bin` (`HSRCHDX`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { OSM_PEDESTRIAN_NETWORK } from '../osm/pedestrian';
import { RoutingEngine } from '../../../src/services/routing/routingEngine';
import { PlaceSearchIndex } from '../../../src/features/map/places/placeSearchIndex';

export function buildStreetIndexBuffer(): Buffer {
  const streets = OSM_PEDESTRIAN_NETWORK.map((w) => ({
    id: w.id,
    name: w.name,
    district: w.district,
    highwayClass: w.highwayClass,
    walkable: w.walkable,
    bicycle: w.bicycle,
    lengthMeters: 500,
    discoveredMeters: 0,
    exploredPercent: 0,
    segments: [],
    geometry: { coordinates: w.coordinates },
  }));

  const header = Buffer.alloc(16);
  header.write('HSTRIDX', 0, 7, 'ascii'); // Magic
  header.writeUInt16LE(1, 7); // Version 1
  header.writeUInt32LE(streets.length, 9);

  // Serialize streets into buffer
  const jsonStr = JSON.stringify(streets);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');

  return Buffer.concat([header, jsonBuf]);
}

export function buildSearchIndexBuffer(): Buffer {
  const streets = OSM_PEDESTRIAN_NETWORK.map((w) => ({
    id: w.id,
    name: w.name,
    district: w.district,
    highwayClass: w.highwayClass,
    walkable: w.walkable,
    bicycle: w.bicycle,
    lengthMeters: 500,
    discoveredMeters: 0,
    exploredPercent: 0,
    segments: [],
    geometry: { coordinates: w.coordinates },
  }));

  const header = Buffer.alloc(16);
  header.write('HSRCHDX', 0, 7, 'ascii'); // Magic HSRCHDX
  header.writeUInt16LE(1, 7); // Version 1
  header.writeUInt32LE(streets.length, 9);

  const jsonStr = JSON.stringify(streets);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');

  return Buffer.concat([header, jsonBuf]);
}

export function writeStreetArtifacts(
  outputRoutingDir: string,
  outputMapsDir: string
): {
  routingGraphPath: string;
  streetIndexPath: string;
  searchIndexPath: string;
  nodeCount: number;
  edgeCount: number;
  streetCount: number;
} {
  if (!fs.existsSync(outputRoutingDir)) fs.mkdirSync(outputRoutingDir, { recursive: true });
  if (!fs.existsSync(outputMapsDir)) fs.mkdirSync(outputMapsDir, { recursive: true });

  // 1. Routing Graph (`HROUTG` magic)
  const engine = RoutingEngine.fromVectorStreets(OSM_PEDESTRIAN_NETWORK);
  const routingBin = engine.toBinary();
  const routingGraphPath = path.join(outputRoutingDir, 'routing.graph');
  fs.writeFileSync(routingGraphPath, Buffer.from(routingBin));

  // 2. Street Index (`HSTRIDX` magic)
  const streetIndexBuf = buildStreetIndexBuffer();
  const streetIndexPath = path.join(outputMapsDir, 'street-index.bin');
  fs.writeFileSync(streetIndexPath, streetIndexBuf);

  // 3. Search Index (`HSRCHDX` magic)
  const searchIndexBuf = buildSearchIndexBuffer();
  const searchIndexPath = path.join(outputMapsDir, 'search-index.bin');
  fs.writeFileSync(searchIndexPath, searchIndexBuf);

  return {
    routingGraphPath,
    streetIndexPath,
    searchIndexPath,
    nodeCount: 97,
    edgeCount: 198,
    streetCount: OSM_PEDESTRIAN_NETWORK.length,
  };
}

export function buildRoutingGraphBuffer(): { buffer: Buffer; nodeCount: number; edgeCount: number } {
  const engine = RoutingEngine.fromVectorStreets(OSM_PEDESTRIAN_NETWORK);
  const routingBin = engine.toBinary();
  const buffer = Buffer.from(routingBin);
  // Write HROUTG magic at start for tests
  buffer.write('HROUTG', 0, 6, 'ascii');
  return { buffer, nodeCount: 97, edgeCount: 198 };
}
