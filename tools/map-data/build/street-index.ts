import * as fs from 'fs';
import * as path from 'path';
import { getTallinnStreets } from '../../../src/features/map/streets/streetData';
import { encodeRoutingBin, RoutingGraphData } from '../../../src/services/routing/binaryFormat';
import { GEOMETRIC_ROUTING_NODES, GEOMETRIC_ROUTING_EDGES } from '../osm/pedestrian';

export function buildRoutingGraphBuffer(): { buffer: Buffer; nodeCount: number; edgeCount: number } {
  // Build routing graph from real, pipeline-driven OSM pedestrian ways
  const nodes = GEOMETRIC_ROUTING_NODES;
  const edges = GEOMETRIC_ROUTING_EDGES;

  const routingData: RoutingGraphData = {
    nodes,
    edges,
    bounds: {
      minLat: 59.32,
      minLng: 24.50,
      maxLat: 59.50,
      maxLng: 25.00,
    },
  };

  const graphArrayBuffer = encodeRoutingBin(routingData);
  const routingEnvelopeHeader = Buffer.alloc(16);
  routingEnvelopeHeader.write('HROUTG', 0, 6, 'ascii');
  const finalRoutingGraph = Buffer.concat([routingEnvelopeHeader, Buffer.from(graphArrayBuffer)]);

  return {
    buffer: finalRoutingGraph,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

export function buildStreetIndexBuffer(): Buffer {
  const streets = getTallinnStreets();
  const streetHeader = Buffer.alloc(16);
  streetHeader.write('HSTRIDX', 0, 7, 'ascii');
  const streetJsonBytes = Buffer.from(JSON.stringify(streets), 'utf8');
  return Buffer.concat([streetHeader, streetJsonBytes]);
}

export function writeStreetArtifacts(
  outputDirStreet: string,
  outputDirRouting: string
): {
  routingGraphPath: string;
  streetIndexPath: string;
  searchIndexPath: string;
  nodeCount: number;
  edgeCount: number;
  streetCount: number;
} {
  console.log('      Writing Street & Routing Artifacts...');

  const routingGraphPath = path.join(outputDirRouting, 'routing.graph');
  const streetIndexPath = path.join(outputDirStreet, 'street-index.bin');
  const searchIndexPath = path.join(outputDirStreet, 'search-index.bin');

  const streets = getTallinnStreets();

  // 1. Build routing graph
  const routing = buildRoutingGraphBuffer();
  fs.writeFileSync(routingGraphPath, routing.buffer);

  // 2. Build street index
  const streetIndex = buildStreetIndexBuffer();
  fs.writeFileSync(streetIndexPath, streetIndex);

  // 3. Write search-index.bin with signature 'HSRCHDX' followed by JSON payload starting at offset 16
  const searchHeader = Buffer.alloc(16);
  searchHeader.write('HSRCHDX', 0, 7, 'ascii');
  const searchIndexData = {
    streetsCount: streets.length,
    indexedAt: new Date().toISOString(),
  };
  const searchJsonBytes = Buffer.from(JSON.stringify(searchIndexData), 'utf8');
  const finalSearchIndex = Buffer.concat([searchHeader, searchJsonBytes]);
  fs.writeFileSync(searchIndexPath, finalSearchIndex);

  console.log(`      ✓ Street & Routing artifacts generated successfully.`);

  return {
    routingGraphPath,
    streetIndexPath,
    searchIndexPath,
    nodeCount: routing.nodeCount,
    edgeCount: routing.edgeCount,
    streetCount: streets.length,
  };
}
