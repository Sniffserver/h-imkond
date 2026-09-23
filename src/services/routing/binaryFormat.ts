/**
 * Binary Format Specification for `routing.bin`
 * 
 * Header (32 bytes):
 * - Magic (4 bytes): 0x48525447 ("HRTG")
 * - Version (4 bytes): 1
 * - Node Count (4 bytes uint32)
 * - Edge Count (4 bytes uint32)
 * - Min Lat (4 bytes float32)
 * - Min Lng (4 bytes float32)
 * - Max Lat (4 bytes float32)
 * - Max Lng (4 bytes float32)
 */

export const ROUTING_BIN_MAGIC = 0x48525447; // "HRTG"
export const ROUTING_BIN_VERSION = 1;

export const EDGE_FLAGS = {
  STAIRS: 0x01,
  UNSAFE_ZONE: 0x02,
  COBBLESTONE: 0x04,
  STEEP_SLOPE: 0x08,
  ONE_WAY: 0x10,
  BIKE_PATH: 0x20,
  PEDESTRIAN_ONLY: 0x40,
  WHEELCHAIR_ACCESSIBLE: 0x80,
};

export interface BinaryNode {
  id: number;
  lat: number;
  lng: number;
  flags: number;
}

export interface BinaryEdge {
  sourceId: number;
  targetId: number;
  distanceMeters: number;
  flags: number;
  maxSpeedKmh: number;
  streetName: string;
}

export interface RoutingGraphData {
  nodes: BinaryNode[];
  edges: BinaryEdge[];
  bounds: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  };
}

/**
 * Packs a graph into a compact contiguous ArrayBuffer (`routing.bin`).
 */
export function encodeRoutingBin(data: RoutingGraphData): ArrayBuffer {
  // Calculate buffer size
  let stringTableSize = 0;
  const encoder = new TextEncoder();
  const encodedNames: Uint8Array[] = [];

  for (const edge of data.edges) {
    const bytes = encoder.encode(edge.streetName || '');
    encodedNames.push(bytes);
    stringTableSize += 1 + bytes.length; // 1 byte length prefix + UTF-8 string
  }

  const headerSize = 32;
  const nodeSize = 16; // id(4) + lat(4) + lng(4) + flags(2) + pad(2)
  const edgeFixedSize = 16; // src(4) + tgt(4) + dist(4) + flags(2) + speed(1) + pad(1)

  const totalSize = headerSize + (data.nodes.length * nodeSize) + (data.edges.length * edgeFixedSize) + stringTableSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Header
  view.setUint32(0, ROUTING_BIN_MAGIC, false);
  view.setUint32(4, ROUTING_BIN_VERSION, false);
  view.setUint32(8, data.nodes.length, false);
  view.setUint32(12, data.edges.length, false);
  view.setFloat32(16, data.bounds.minLat, false);
  view.setFloat32(20, data.bounds.minLng, false);
  view.setFloat32(24, data.bounds.maxLat, false);
  view.setFloat32(28, data.bounds.maxLng, false);

  let offset = headerSize;

  // Nodes
  for (const node of data.nodes) {
    view.setUint32(offset, node.id, false);
    view.setFloat32(offset + 4, node.lat, false);
    view.setFloat32(offset + 8, node.lng, false);
    view.setUint16(offset + 12, node.flags, false);
    view.setUint16(offset + 14, 0, false); // padding
    offset += nodeSize;
  }

  // Edges
  for (let i = 0; i < data.edges.length; i++) {
    const edge = data.edges[i];
    const nameBytes = encodedNames[i];

    view.setUint32(offset, edge.sourceId, false);
    view.setUint32(offset + 4, edge.targetId, false);
    view.setFloat32(offset + 8, edge.distanceMeters, false);
    view.setUint16(offset + 12, edge.flags, false);
    view.setUint8(offset + 14, edge.maxSpeedKmh);
    view.setUint8(offset + 15, nameBytes.length);
    offset += edgeFixedSize;

    uint8View.set(nameBytes, offset);
    offset += nameBytes.length;
  }

  return buffer;
}

/**
 * Decodes a `routing.bin` ArrayBuffer into a structured graph representation.
 */
export function decodeRoutingBin(buffer: ArrayBuffer): RoutingGraphData {
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  const magic = view.getUint32(0, false);
  if (magic !== ROUTING_BIN_MAGIC) {
    throw new Error(`Invalid routing.bin header magic: 0x${magic.toString(16)}`);
  }

  const version = view.getUint32(4, false);
  const nodeCount = view.getUint32(8, false);
  const edgeCount = view.getUint32(12, false);

  const bounds = {
    minLat: view.getFloat32(16, false),
    minLng: view.getFloat32(20, false),
    maxLat: view.getFloat32(24, false),
    maxLng: view.getFloat32(28, false),
  };

  let offset = 32;
  const nodes: BinaryNode[] = [];
  const decoder = new TextDecoder();

  for (let i = 0; i < nodeCount; i++) {
    const id = view.getUint32(offset, false);
    const lat = view.getFloat32(offset + 4, false);
    const lng = view.getFloat32(offset + 8, false);
    const flags = view.getUint16(offset + 12, false);
    nodes.push({ id, lat, lng, flags });
    offset += 16;
  }

  const edges: BinaryEdge[] = [];

  for (let i = 0; i < edgeCount; i++) {
    const sourceId = view.getUint32(offset, false);
    const targetId = view.getUint32(offset + 4, false);
    const distanceMeters = view.getFloat32(offset + 8, false);
    const flags = view.getUint16(offset + 12, false);
    const maxSpeedKmh = view.getUint8(offset + 14);
    const nameLen = view.getUint8(offset + 15);
    offset += 16;

    const nameBytes = uint8View.subarray(offset, offset + nameLen);
    const streetName = decoder.decode(nameBytes);
    offset += nameLen;

    edges.push({
      sourceId,
      targetId,
      distanceMeters,
      flags,
      maxSpeedKmh,
      streetName,
    });
  }

  return { nodes, edges, bounds };
}
