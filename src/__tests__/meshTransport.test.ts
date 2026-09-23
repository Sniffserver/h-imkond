import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoopbackTransport,
  BroadcastChannelTransport,
  BleTransport,
  WifiAwareTransport,
  LoRaBridgeTransport,
  MeshTransportManager,
  MeshPacket,
} from '../services/mesh/transport';
import { initMeshSync, triggerMeshSync, queueMessageForSync } from '../services/mesh/meshSync';
import { MeshMessage } from '../types';

describe('MeshTransport Architecture', () => {
  describe('LoopbackTransport', () => {
    let loopback: LoopbackTransport;

    beforeEach(async () => {
      loopback = new LoopbackTransport();
      await loopback.start();
    });

    afterEach(async () => {
      await loopback.stop();
    });

    it('has correct metadata and availability', () => {
      expect(loopback.type).toBe('loopback');
      expect(loopback.isPhysical).toBe(false);
      expect(loopback.isAvailable()).toBe(true);
    });

    it('discovers mock peers', async () => {
      const peers = await loopback.discover();
      expect(peers.length).toBeGreaterThan(0);
      expect(peers[0].callsign).toBe('TARTU-ECHO-1');
      expect(peers[0].transport).toBe('loopback');
    });

    it('sends and receives packets via subscription', async () => {
      const receivedPackets: MeshPacket[] = [];
      const unsub = loopback.subscribe((pkt) => {
        receivedPackets.push(pkt);
      });

      const testPacket: MeshPacket = {
        id: 'test-pkt-1',
        type: 'MESSAGE',
        senderId: 'user-1',
        senderCallsign: 'ILVES',
        targetCallsign: 'TARTU-ECHO-1',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        payload: { text: 'Tere tulemast metsa' },
      };

      const result = await loopback.send(testPacket);
      expect(result.success).toBe(true);
      expect(result.transport).toBe('loopback');
      expect(loopback.sentPackets.length).toBe(1);

      // Wait microtask for loopback delivery
      await new Promise((r) => setTimeout(r, 20));
      expect(receivedPackets.length).toBe(1);
      expect(receivedPackets[0].payload.text).toBe('Tere tulemast metsa');

      unsub();
    });

    it('supports direct packet injection', async () => {
      const received: MeshPacket[] = [];
      loopback.subscribe((p) => {
        received.push(p);
      });

      loopback.injectIncomingPacket({
        id: 'injected-1',
        type: 'PING',
        senderId: 'remote-node',
        senderCallsign: 'VÕRU-GATEWAY',
        timestamp: Date.now(),
        ttl: 2,
        hopCount: 1,
        payload: {},
      });

      expect(received.length).toBe(1);
      expect(received[0].senderCallsign).toBe('VÕRU-GATEWAY');
      expect(received[0].transportMeta?.originTransport).toBe('loopback');
    });
  });

  describe('BroadcastChannelTransport', () => {
    let bcTransport: BroadcastChannelTransport;

    beforeEach(async () => {
      bcTransport = new BroadcastChannelTransport('test_hoimu_channel');
      await bcTransport.start();
    });

    afterEach(async () => {
      await bcTransport.stop();
    });

    it('defines standard multi-tab transport properties', () => {
      expect(bcTransport.type).toBe('broadcast_channel');
      expect(bcTransport.isPhysical).toBe(false);
    });

    it('dispatches packet and returns delivery result', async () => {
      const testPacket: MeshPacket = {
        id: 'bc-pkt-1',
        type: 'CRDT_SYNC',
        senderId: 'peer-abc',
        senderCallsign: 'HAANJA-RADIO',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        payload: { test: true },
      };

      const res = await bcTransport.send(testPacket);
      expect(res.success).toBe(true);
      expect(res.transport).toBe('broadcast_channel');
    });
  });

  describe('BleTransport', () => {
    let bleTransport: BleTransport;

    beforeEach(async () => {
      bleTransport = new BleTransport();
      await bleTransport.start();
    });

    afterEach(async () => {
      await bleTransport.stop();
    });

    it('has physical BLE characteristics and fallback discovery', async () => {
      expect(bleTransport.type).toBe('ble');
      expect(bleTransport.isPhysical).toBe(true);

      const peers = await bleTransport.discover();
      expect(peers.length).toBeGreaterThan(0);
      expect(peers.some((p) => p.callsign.includes('BEACON') || p.callsign.includes('RELAY'))).toBe(true);
    });

    it('handles simulated BLE transmission', async () => {
      const testPacket: MeshPacket = {
        id: 'ble-pkt-1',
        type: 'MESSAGE',
        senderId: 'phone-1',
        senderCallsign: 'LEMBI-01',
        timestamp: Date.now(),
        ttl: 2,
        hopCount: 1,
        payload: { text: 'BLE Direct message' },
      };

      const result = await bleTransport.send(testPacket);
      expect(result.success).toBe(true);
      expect(result.transport).toBe('ble');
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('handles incoming BLE packets and updates peer table', () => {
      const incoming: MeshPacket[] = [];
      bleTransport.subscribe((pkt) => {
        incoming.push(pkt);
      });

      const payload = JSON.stringify({
        id: 'ble-rx-101',
        type: 'MESSAGE',
        senderId: 'esp32-rx',
        senderCallsign: 'METSA-ESP32',
        timestamp: Date.now(),
        ttl: 2,
        hopCount: 1,
        payload: { text: 'Sensor telemetry' },
      });

      bleTransport.handleBleIncomingPacket(payload, -58);

      expect(incoming.length).toBe(1);
      expect(incoming[0].senderCallsign).toBe('METSA-ESP32');
      expect(incoming[0].transportMeta?.rssi).toBe(-58);
      expect(incoming[0].transportMeta?.originTransport).toBe('ble');
    });
  });

  describe('WifiAwareTransport', () => {
    let wifiTransport: WifiAwareTransport;

    beforeEach(async () => {
      wifiTransport = new WifiAwareTransport();
      await wifiTransport.start();
    });

    afterEach(async () => {
      await wifiTransport.stop();
    });

    it('discovers Wi-Fi direct group owners', async () => {
      expect(wifiTransport.type).toBe('wifi_aware');
      expect(wifiTransport.isPhysical).toBe(true);

      const peers = await wifiTransport.discover();
      expect(peers.length).toBeGreaterThan(0);
      expect(peers[0].callsign).toContain('POLVA-BARN-AP');
    });

    it('transmits packets across Wi-Fi peer network', async () => {
      const res = await wifiTransport.send({
        id: 'wifi-pkt-1',
        type: 'CRDT_SYNC',
        senderId: 'node-w1',
        senderCallsign: 'CALL-1',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        payload: { tiles: [1, 2, 3] },
      });

      expect(res.success).toBe(true);
      expect(res.transport).toBe('wifi_aware');
    });
  });

  describe('LoRaBridgeTransport', () => {
    let loraTransport: LoRaBridgeTransport;

    beforeEach(async () => {
      loraTransport = new LoRaBridgeTransport();
      await loraTransport.start();
    });

    afterEach(async () => {
      await loraTransport.stop();
    });

    it('defines physical 868MHz LoRa properties', () => {
      expect(loraTransport.type).toBe('lora_bridge');
      expect(loraTransport.isPhysical).toBe(true);
    });

    it('handles incoming LoRa frame with RF SNR and RSSI metadata', () => {
      const incoming: MeshPacket[] = [];
      loraTransport.subscribe((pkt) => {
        incoming.push(pkt);
      });

      loraTransport.handleIncomingLoRaPacket(
        {
          id: 'lora-rx-1',
          type: 'SOS',
          senderId: 'remote-ranger',
          senderCallsign: 'METSAVAHI',
          timestamp: Date.now(),
          ttl: 4,
          hopCount: 2,
          payload: { alert: 'Storm incoming' },
        },
        11.2,
        -96
      );

      expect(incoming.length).toBe(1);
      expect(incoming[0].transportMeta?.originTransport).toBe('lora_bridge');
      expect(incoming[0].transportMeta?.snr).toBe(11.2);
      expect(incoming[0].transportMeta?.rssi).toBe(-96);
      expect(incoming[0].transportMeta?.frequencyMhz).toBe(868.1);
    });
  });

  describe('MeshTransportManager', () => {
    let manager: MeshTransportManager;

    beforeEach(async () => {
      manager = new MeshTransportManager();
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('registers all 5 primary transports', () => {
      const transports = manager.getAllTransports();
      expect(transports.length).toBe(5);

      const types = transports.map((t) => t.type);
      expect(types).toContain('broadcast_channel');
      expect(types).toContain('ble');
      expect(types).toContain('wifi_aware');
      expect(types).toContain('lora_bridge');
      expect(types).toContain('loopback');
    });

    it('broadcasts packets across multi-bearer transports', async () => {
      const packet: MeshPacket = {
        id: 'multi-bearer-pkt',
        type: 'MESSAGE',
        senderId: 'me',
        senderCallsign: 'USER',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        payload: { text: 'Multi-bearer propagation' },
      };

      const results = await manager.send(packet);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.success)).toBe(true);
    });

    it('routes packet to a preferred specific transport', async () => {
      const packet: MeshPacket = {
        id: 'targeted-pkt',
        type: 'MESSAGE',
        senderId: 'me',
        senderCallsign: 'USER',
        timestamp: Date.now(),
        ttl: 3,
        hopCount: 1,
        payload: { text: 'Targeted BLE' },
      };

      const results = await manager.send(packet, 'ble');
      expect(results.length).toBe(1);
      expect(results[0].transport).toBe('ble');
      expect(results[0].success).toBe(true);
    });

    it('gathers discovered peers across all physical and local transports', async () => {
      const allPeers = await manager.discoverAllPeers();
      expect(allPeers.length).toBeGreaterThan(0);

      // Verify that peers are mapped with their respective transport bearer
      const transportTypesFound = new Set(allPeers.map((p) => p.transport));
      expect(transportTypesFound.size).toBeGreaterThanOrEqual(1);
    });

    it('tracks telemetry stats and bearer statuses', async () => {
      const stats = await manager.getStats();
      expect(stats.bearers.length).toBe(5);
      expect(stats.totalSent).toBeGreaterThanOrEqual(0);
      expect(stats.totalReceived).toBeGreaterThanOrEqual(0);

      const loraBearer = stats.bearers.find((b) => b.type === 'lora_bridge');
      expect(loraBearer).toBeDefined();
      expect(loraBearer?.isPhysical).toBe(true);
    });
  });

  describe('Integration with meshSync', () => {
    it('initializes and triggers mesh sync over transport manager', () => {
      initMeshSync();

      const dummyMessage: MeshMessage = {
        id: `msg_sync_test_${Date.now()}`,
        from: 'TEST-SENDER',
        to: 'TEST-TARGET',
        content: 'Encr',
        timestamp: Date.now(),
        ttl: 3,
        signature: 'sig',
      };

      const syncResult = queueMessageForSync(dummyMessage);

      expect(syncResult).not.toBeNull();
      expect(syncResult?.messages.length).toBeGreaterThan(0);
    });
  });
});
