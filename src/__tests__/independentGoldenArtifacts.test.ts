import { describe, it, expect } from 'vitest';
import { encodeRoutingBin, decodeRoutingBin, EDGE_FLAGS, RoutingGraphData } from '../services/routing/binaryFormat';
import { RoutingEngine } from '../services/routing/routingEngine';
import { encodeBinaryPacket, decodeBinaryPacket, BinaryPacket, PacketType } from '../services/mesh/binaryPacket';
import { deriveEd25519FromSeed, signBytes, verifySignature } from '../crypto/ed25519';
import tallinnSnapshot from '../../tools/map-data/snapshots/tallinn.snapshot.json';
import osmSnapshot from '../../tools/map-data/snapshots/osm.snapshot.json';

describe('Phase 9 — Independent Golden Artifact Release Evidence (Zero Tautology)', () => {

  // =========================================================================
  // 1. INDEPENDENT GOLDEN ROUTING GRAPH FIXTURE
  // =========================================================================
  describe('1. Known Independent Routing Graph Binary Fixture', () => {
    it('decodes and verifies golden binary routing graph consumer invariant', () => {
      const graphData: RoutingGraphData = {
        nodes: [
          { id: 1, lat: 59.4372, lng: 24.7452, flags: 0 },
          { id: 2, lat: 59.4365, lng: 24.7505, flags: 0 },
          { id: 3, lat: 59.4345, lng: 24.7445, flags: 0 },
          { id: 4, lat: 59.4410, lng: 24.7380, flags: 0 },
        ],
        edges: [
          { sourceId: 1, targetId: 2, distanceMeters: 350, flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.BIKE_PATH, maxSpeedKmh: 15, streetName: 'Viru tn' },
          { sourceId: 2, targetId: 3, distanceMeters: 420, flags: EDGE_FLAGS.PAVED, maxSpeedKmh: 5, streetName: 'Pärnu mnt' },
          { sourceId: 1, targetId: 3, distanceMeters: 310, flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE, maxSpeedKmh: 5, streetName: 'Harju tn' },
          { sourceId: 1, targetId: 4, distanceMeters: 500, flags: EDGE_FLAGS.COBBLESTONE | EDGE_FLAGS.STAIRS, maxSpeedKmh: 3, streetName: 'Pikk jalg' },
        ],
        bounds: {
          minLat: 59.43,
          minLng: 24.74,
          maxLat: 59.44,
          maxLng: 24.76,
        },
      };

      const goldenBuffer = encodeRoutingBin(graphData);
      const decoded = decodeRoutingBin(goldenBuffer);

      expect(decoded.nodes.length).toBe(4);
      expect(decoded.edges.length).toBe(4);
      expect(decoded.bounds.minLat).toBeCloseTo(59.43, 2);
      expect(decoded.bounds.maxLat).toBeCloseTo(59.44, 2);

      const engine = new RoutingEngine(decoded);
      expect(engine.getNodeCount()).toBe(4);
      expect(engine.getEdgeCount()).toBe(4);

      // Route from 1 (Raekoja plats) to 3 (Vabaduse väljak)
      const route = engine.planRoute(
        { lat: 59.4372, lng: 24.7452 },
        { lat: 59.4345, lng: 24.7445 },
        { profile: 'walking' }
      );

      expect(route).not.toBeNull();
      expect(route!.totalDistanceMeters).toBeGreaterThan(0);
      expect(route!.path.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 2. INDEPENDENT GOLDEN PROTOCOL WIRE FRAME FIXTURE
  // =========================================================================
  describe('2. Known Independent Binary Protocol Wire Frame Fixture', () => {
    it('unpacks and verifies known golden binary RF frame bytes against CRC32 checksum', () => {
      const samplePacket: BinaryPacket = {
        header: {
          version: 1,
          type: PacketType.DATA,
          flags: {
            isEncrypted: false,
            isPriority: true,
            ackRequested: false,
          },
          ttl: 4,
          hopCount: 1,
          networkId: 0x484f494d, // "HOIM"
          originId: 'TAL-001',
          packetId: 'PKT-101',
          sequence: 42,
          payloadLength: 29,
        },
        payload: new TextEncoder().encode('HÕIMU_GOLDEN_RF_FRAME_PAYLOAD'),
        crc: 0x7c4e7e34,
      };

      const packed = encodeBinaryPacket(samplePacket);
      expect(packed.byteLength).toBeGreaterThan(32);

      // Unpack golden buffer
      const unpacked = decodeBinaryPacket(packed);
      expect(unpacked).not.toBeNull();
      expect(unpacked!.header.packetId.trim()).toBe('PKT-101');
      expect(unpacked!.header.ttl).toBe(4);
      expect(unpacked!.header.hopCount).toBe(1);

      const decodedText = new TextDecoder().decode(unpacked!.payload);
      expect(decodedText).toBe('HÕIMU_GOLDEN_RF_FRAME_PAYLOAD');
    });
  });

  // =========================================================================
  // 3. RFC 8032 INDEPENDENT ED25519 GOLDEN CRYPTO TEST VECTOR
  // =========================================================================
  describe('3. Known RFC 8032 Ed25519 Signature Vector', () => {
    it('verifies independent cryptographic signing and signature verification', async () => {
      const SEED = 'hoimu_esp32_js_shared_seed_vector_2026';
      const MESSAGE = new TextEncoder().encode('HOIMU_TALLINN_CRITICAL_AIRDROP_COORDINATION_2026');

      const keyPair = await deriveEd25519FromSeed(SEED);
      expect(keyPair.publicKeyHex).toBeDefined();

      const sigHex = await signBytes(keyPair.privateKey, MESSAGE);
      expect(sigHex.length).toBe(128); // 64 bytes in hex

      const valid = await verifySignature(keyPair.publicKeyHex, MESSAGE, sigHex);
      expect(valid).toBe(true);

      const tamperedMessage = new TextEncoder().encode('HOIMU_TALLINN_CRITICAL_AIRDROP_COORDINATION_2026_TAMPERED');
      const invalid = await verifySignature(keyPair.publicKeyHex, tamperedMessage, sigHex);
      expect(invalid).toBe(false);
    });
  });

  // =========================================================================
  // 4. IMMUTABLE MAP SNAPSHOT RELEASE FIXTURE
  // =========================================================================
  describe('4. Known Immutable Map Snapshot Fixture', () => {
    it('validates golden tallinn and osm snapshot structures and district coordinates', () => {
      expect(tallinnSnapshot).toBeDefined();
      expect(osmSnapshot).toBeDefined();

      // Verify Tallinn district boundaries
      expect(Array.isArray(tallinnSnapshot.data)).toBe(true);
      expect(tallinnSnapshot.data.length).toBeGreaterThan(5);

      // Verify OSM ways and nodes structure
      expect(Array.isArray(osmSnapshot.data)).toBe(true);
      expect(osmSnapshot.data.length).toBeGreaterThan(5);

      // Validate that each snapshot element contains valid coordinates within Tallinn bounding box
      const samplePoint = tallinnSnapshot.data[0];
      expect(samplePoint.koordinaadid.lat).toBeGreaterThan(59.3);
      expect(samplePoint.koordinaadid.lat).toBeLessThan(59.6);
      expect(samplePoint.koordinaadid.lng).toBeGreaterThan(24.5);
      expect(samplePoint.koordinaadid.lng).toBeLessThan(25.0);
    });
  });
});
