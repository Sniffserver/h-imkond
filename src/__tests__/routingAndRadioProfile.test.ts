import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MeshRouter,
  DEFAULT_RADIO_PROFILE,
  EU868_HOIMU_PROFILE,
  calculateAirtimeMs,
  DutyCycleRegulator,
} from '../mesh';
import { HoimuPacket } from '../protocol/types';
import { HoimuPacketType, PROTOCOL_VERSION } from '../protocol/constants';
import { BaseTransport } from '../transport/transport';
import { signPacket } from '../crypto/signatures';
import { generateEd25519KeyPair, Ed25519KeyPair } from '../core/crypto/ed25519';
import { PeerStore } from '../storage/peers';

class MockTestTransport extends BaseTransport {
  public sentPackets: HoimuPacket[] = [];

  constructor(public readonly name: string) {
    super();
    this.isAvailable = true;
    this.isConnected = true;
  }

  public async start(): Promise<void> {
    this.isConnected = true;
  }

  public async stop(): Promise<void> {
    this.isConnected = false;
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    this.sentPackets.push(packet);
    this.metrics.packetsSent += 1;
    return true;
  }

  public injectPacket(packet: HoimuPacket): void {
    this.emitPacket(packet);
  }
}

describe('Routing vs Flooding & Unified Radio Profile', () => {
  let router: MeshRouter;
  let transportA: MockTestTransport;
  let transportB: MockTestTransport;
  let transportC: MockTestTransport;
  let keyPair: Ed25519KeyPair;

  beforeEach(async () => {
    keyPair = await generateEd25519KeyPair(true);
    router = new MeshRouter({
      localNodeId: keyPair.publicKeyHex,
      signingPrivateKey: keyPair.privateKey,
      routingMode: 'route_aware',
      minForwardingDelayMs: 20,
      maxForwardingDelayMs: 40,
      fanoutLimit: 2,
    });

    transportA = new MockTestTransport('Transport_BLE');
    transportB = new MockTestTransport('Transport_LoRa_868');
    transportC = new MockTestTransport('Transport_WiFiAware');

    router.registerTransport(transportA);
    router.registerTransport(transportB);
    router.registerTransport(transportC);
  });

  afterEach(() => {
    if (router) {
      router.destroy();
    }
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Unified Radio Profile & Regional Compliance
  // =========================================================================
  describe('Unified Radio Profile & Regional Policy (EU868)', () => {
    it('provides unified EU868_HOIMU_PROFILE as single source of truth', () => {
      expect(DEFAULT_RADIO_PROFILE.region).toBe('EU868');
      expect(DEFAULT_RADIO_PROFILE.defaultChannel.frequencyMhz).toBe(868.1);
      expect(DEFAULT_RADIO_PROFILE.defaultChannel.bandwidthKhz).toBe(125.0);
      expect(DEFAULT_RADIO_PROFILE.defaultChannel.spreadingFactor).toBe(7);
      expect(DEFAULT_RADIO_PROFILE.defaultChannel.txPowerDbm).toBe(14);
    });

    it('models CAD parameters grounded in Semtech SX1261/SX1262 datasheet & AN1200.48', () => {
      const cad = DEFAULT_RADIO_PROFILE.cadPolicy;
      expect(cad.cadSymbolNum).toBe(4); // Semtech recommended 4 symbols
      expect(cad.cadDetPeak).toBe(22); // SF7-SF8 peak threshold
      expect(cad.cadDetMin).toBe(10);
      expect(cad.cadExitMode).toBe(0); // STDBY_RC
    });

    it('calculates physical airtime accurately according to Semtech LoRa equations', () => {
      const smallAirtime = calculateAirtimeMs(32, 7, 125, 1);
      const largeAirtime = calculateAirtimeMs(200, 7, 125, 1);
      expect(smallAirtime).toBeGreaterThan(30);
      expect(largeAirtime).toBeGreaterThan(smallAirtime);
    });

    it('enforces priority-aware duty cycle quotas', () => {
      const regulator = new DutyCycleRegulator(EU868_HOIMU_PROFILE);
      // Simulate 16,000 ms used (out of 36,000 ms)
      regulator.recordTransmission(16_000);

      // Normal message (50% quota = 18,000 ms): 16,000 + 3,000 = 19,000 > 18,000 -> rejected!
      expect(regulator.canTransmit(3_000, 'normal')).toBe(false);

      // ACK / Direct message (80% quota = 28,800 ms): 16,000 + 3,000 = 19,000 <= 28,800 -> allowed!
      expect(regulator.canTransmit(3_000, 'ack')).toBe(true);

      // Emergency SOS (100% quota = 36,000 ms): allowed!
      expect(regulator.canTransmit(15_000, 'emergency')).toBe(true);
    });
  });

  // =========================================================================
  // 2. v1 Bounded Epidemic Forwarding & Duplicate Heard Relay Cancellation
  // =========================================================================
  describe('v1 Bounded Epidemic Forwarding', () => {
    it('cancels scheduled relay if duplicate is heard over the air during jitter window', async () => {
      vi.useFakeTimers();

      const senderKeyPair = await generateEd25519KeyPair(true);
      await PeerStore.upsertPeer({
        nodeId: senderKeyPair.publicKeyHex,
        callsign: 'NODE_SENDER',
        signingPublicKeyHex: senderKeyPair.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      });

      let packet: HoimuPacket = {
        header: {
          version: PROTOCOL_VERSION,
          type: HoimuPacketType.MESSAGE,
          packetId: 'EPIDEMIC_PKT_001',
          senderId: senderKeyPair.publicKeyHex.slice(0, 8),
          originId: senderKeyPair.publicKeyHex,
          destinationId: '*', // broadcast
          ttl: 4,
          hopCount: 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          flags: 0,
          sequence: 1,
          length: 20,
        },
        payload: { text: 'Community alert' },
      };
      packet = await signPacket(packet, senderKeyPair.privateKey);

      // 1. First reception from Transport_BLE -> schedules delayed epidemic relay
      await router.handleIncomingPacket(packet, 'Transport_BLE');

      expect(router.getMetrics().packetsReceived).toBe(1);
      // Scheduled relay is in flight, has not transmitted yet
      expect(transportB.sentPackets.length).toBe(0);

      // 2. Duplicate packet heard from Transport_LoRa_868 while waiting in jitter window!
      await router.handleIncomingPacket(packet, 'Transport_LoRa_868');

      // The duplicate cancels the scheduled relay!
      expect(router.getMetrics().scheduledRelaysCancelled).toBe(1);

      // Advance timers past jitter window
      await vi.advanceTimersByTimeAsync(300);

      // Relay was cancelled, so transports should NOT have forwarded the packet!
      expect(transportB.sentPackets.length).toBe(0);
      expect(transportC.sentPackets.length).toBe(0);

      vi.useRealTimers();
    });

    it('enforces fanout limit on epidemic relay', async () => {
      vi.useFakeTimers();

      const senderKeyPair = await generateEd25519KeyPair(true);
      await PeerStore.upsertPeer({
        nodeId: senderKeyPair.publicKeyHex,
        callsign: 'NODE_SENDER',
        signingPublicKeyHex: senderKeyPair.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      });

      let packet: HoimuPacket = {
        header: {
          version: PROTOCOL_VERSION,
          type: HoimuPacketType.MESSAGE,
          packetId: 'FANOUT_PKT_002',
          senderId: senderKeyPair.publicKeyHex.slice(0, 8),
          originId: senderKeyPair.publicKeyHex,
          destinationId: '*', // broadcast
          ttl: 4,
          hopCount: 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          flags: 0,
          sequence: 1,
          length: 20,
        },
        payload: { text: 'Alert' },
      };
      packet = await signPacket(packet, senderKeyPair.privateKey);

      // Incoming without duplicate
      await router.handleIncomingPacket(packet);

      // Advance timer to trigger execution
      await vi.advanceTimersByTimeAsync(300);

      // Fanout limit is 2, but we have 3 transports. Exactly 2 transports should have sent!
      const totalSent =
        transportA.sentPackets.length +
        transportB.sentPackets.length +
        transportC.sentPackets.length;
      expect(totalSent).toBe(2);
      expect(router.getMetrics().fanoutSuppressed).toBe(1);
      expect(router.getMetrics().relayedBoundedEpidemic).toBe(1);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // 3. v2 Route-Aware Unicast Forwarding
  // =========================================================================
  describe('v2 Route-Aware Unicast Forwarding', () => {
    it('relays unicast packet directly to next-hop transport instead of flooding', async () => {
      const destKeyPair = await generateEd25519KeyPair(true);
      const senderKeyPair = await generateEd25519KeyPair(true);

      await PeerStore.upsertPeer({
        nodeId: senderKeyPair.publicKeyHex,
        callsign: 'NODE_SENDER',
        signingPublicKeyHex: senderKeyPair.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      });

      // Populate route-aware table for destination
      router.routingTable.updateRoute(
        destKeyPair.publicKeyHex,
        destKeyPair.publicKeyHex,
        1,
        'Transport_LoRa_868',
        1.0,
        1.1, // low ETX
        95 // high link quality
      );

      let packet: HoimuPacket = {
        header: {
          version: PROTOCOL_VERSION,
          type: HoimuPacketType.DIRECT_ENCRYPTED,
          packetId: 'ROUTE_AWARE_PKT_003',
          senderId: senderKeyPair.publicKeyHex.slice(0, 8),
          originId: senderKeyPair.publicKeyHex,
          destinationId: destKeyPair.publicKeyHex,
          ttl: 4,
          hopCount: 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          flags: 0,
          sequence: 1,
          length: 30,
        },
        payload: { ciphertext: 'ENCRYPTED' },
      };
      packet = await signPacket(packet, senderKeyPair.privateKey);

      // Forward packet arriving from BLE transport
      await router.handleIncomingPacket(packet, 'Transport_BLE');

      // Unicast route-aware forwarding sent immediately and ONLY to Transport_LoRa_868!
      expect(transportB.sentPackets.length).toBe(1);
      expect(transportB.sentPackets[0].header.packetId).toBe('ROUTE_AWARE_PKT_003');

      // Transport_BLE (ingress) and Transport_WiFiAware (unrelated) did NOT receive flooded copy
      expect(transportA.sentPackets.length).toBe(0);
      expect(transportC.sentPackets.length).toBe(0);

      expect(router.getMetrics().relayedRouteAware).toBe(1);
      expect(router.getMetrics().packetsForwarded).toBe(1);
    });

    it('falls back to bounded epidemic forwarding if destination is unknown in routing table', async () => {
      vi.useFakeTimers();

      const unknownDest = 'UNKNOWN_NODE_' + Math.random().toString(36);
      const senderKeyPair = await generateEd25519KeyPair(true);
      await PeerStore.upsertPeer({
        nodeId: senderKeyPair.publicKeyHex,
        callsign: 'NODE_SENDER',
        signingPublicKeyHex: senderKeyPair.publicKeyHex,
        lastSeen: Date.now(),
        hopCount: 1,
      });

      let packet: HoimuPacket = {
        header: {
          version: PROTOCOL_VERSION,
          type: HoimuPacketType.MESSAGE,
          packetId: 'FALLBACK_PKT_004',
          senderId: senderKeyPair.publicKeyHex.slice(0, 8),
          originId: senderKeyPair.publicKeyHex,
          destinationId: unknownDest,
          ttl: 3,
          hopCount: 1,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          flags: 0,
          sequence: 1,
          length: 20,
        },
        payload: { text: 'Hello unknown' },
      };
      packet = await signPacket(packet, senderKeyPair.privateKey);

      await router.handleIncomingPacket(packet, 'Transport_BLE');

      // Advance timers to trigger bounded epidemic fallback
      await vi.advanceTimersByTimeAsync(300);

      expect(router.getMetrics().relayedBoundedEpidemic).toBe(1);

      vi.useRealTimers();
    });
  });
});
