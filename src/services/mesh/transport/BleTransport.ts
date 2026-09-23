import { MeshTransport, MeshPacket, SendResult, TransportPeer, TransportType } from './types';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

const HOIMU_BLE_SERVICE_UUID = '000000ff-0000-1000-8000-00805f9b34fb';
const HOIMU_BLE_TX_CHAR_UUID = '00000001-0000-1000-8000-00805f9b34fb';
const HOIMU_BLE_RX_CHAR_UUID = '00000002-0000-1000-8000-00805f9b34fb';

/**
 * BleTransport
 * Physical Bluetooth Low Energy transport for Android / Capacitor.
 * Discovers nearby ESP32 mesh nodes, relays, and other mobile devices advertising HÕIMU service.
 */
export class BleTransport implements MeshTransport {
  public readonly id = 'ble-transport';
  public readonly name = 'Bluetooth Low Energy (BLE)';
  public readonly type: TransportType = 'ble';
  public readonly isPhysical = true;

  private isRunning = false;
  private isScanning = false;
  private isNative = false;
  private subscribers = new Set<(packet: MeshPacket) => Promise<void> | void>();
  private discoveredPeers = new Map<string, TransportPeer>();

  constructor(options?: { isNative?: boolean }) {
    this.isNative = options?.isNative ?? (typeof window !== 'undefined' && Capacitor.isNativePlatform());
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.isNative) {
      // In web browser / simulation environment, BLE transport is available in simulation mode
      return true;
    }
    try {
      await BleClient.initialize();
      return true;
    } catch {
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.isNative) {
      try {
        await BleClient.initialize();
        this.startContinuousScan();
      } catch (err) {
        console.warn('[BleTransport] Failed to initialize native BLE:', err);
      }
    } else {
      // In development / web preview, register simulated BLE field beacons
      this.populateSimulatedPeers();
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.isNative && this.isScanning) {
      try {
        await BleClient.stopLEScan();
        this.isScanning = false;
      } catch {
        // Safe stop
      }
    }
  }

  public async discover(): Promise<TransportPeer[]> {
    if (this.isNative && !this.isScanning) {
      await this.scanOnce(2500);
    }
    return Array.from(this.discoveredPeers.values());
  }

  public async send(packet: MeshPacket): Promise<SendResult> {
    const startTime = performance.now();

    if (!this.isRunning) {
      await this.start();
    }

    const payloadJson = JSON.stringify(packet);
    const data = new TextEncoder().encode(payloadJson);

    if (!this.isNative) {
      // Browser / dev simulation: record packet transmission to nearby peers
      const duration = Math.round(performance.now() - startTime);
      return {
        success: true,
        transport: this.type,
        txId: `ble-sim-tx-${Date.now()}`,
        recipientCount: this.discoveredPeers.size,
        latencyMs: Math.max(12, duration),
      };
    }

    try {
      // Broadcast over connected BLE peripherals
      let deliveredCount = 0;
      for (const [deviceId] of this.discoveredPeers.entries()) {
        try {
          await BleClient.write(
            deviceId,
            HOIMU_BLE_SERVICE_UUID,
            HOIMU_BLE_TX_CHAR_UUID,
            new DataView(data.buffer)
          );
          deliveredCount++;
        } catch {
          // Peripheral might be advertising only or out of range
        }
      }

      const duration = Math.round(performance.now() - startTime);
      return {
        success: deliveredCount > 0,
        transport: this.type,
        txId: `ble-tx-${Date.now()}`,
        recipientCount: deliveredCount,
        latencyMs: duration,
      };
    } catch (err: any) {
      return {
        success: false,
        transport: this.type,
        error: err?.message || 'BLE transmit error',
      };
    }
  }

  public subscribe(handler: (packet: MeshPacket) => Promise<void> | void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Dispatches incoming packet payload received from BLE GATT characteristic
   */
  public handleBleIncomingPacket(rawJson: string, rssi = -60): void {
    try {
      const packet: MeshPacket = JSON.parse(rawJson);
      packet.transportMeta = {
        originTransport: this.type,
        rssi,
      };

      this.discoveredPeers.set(packet.senderId || packet.senderCallsign, {
        id: packet.senderId || `ble-${packet.senderCallsign}`,
        callsign: packet.senderCallsign,
        transport: this.type,
        rssi,
        lastSeen: Date.now(),
        deviceInfo: 'ESP32 BLE Mesh Transceiver',
        isOnline: true,
        hopDistance: packet.hopCount || 1,
      });

      this.subscribers.forEach((handler) => {
        try {
          handler(packet);
        } catch (e) {
          console.error('[BleTransport] Handler error:', e);
        }
      });
    } catch (err) {
      console.warn('[BleTransport] Malformed BLE packet:', err);
    }
  }

  private async scanOnce(durationMs = 2500): Promise<void> {
    if (!this.isNative) return;
    try {
      this.isScanning = true;
      await BleClient.requestLEScan(
        {
          services: [HOIMU_BLE_SERVICE_UUID],
        },
        (result) => {
          if (result.device && result.device.deviceId) {
            const callsign = result.device.name || `BLE-${result.device.deviceId.slice(-4)}`;
            this.discoveredPeers.set(result.device.deviceId, {
              id: result.device.deviceId,
              callsign,
              transport: this.type,
              rssi: result.rssi || -65,
              lastSeen: Date.now(),
              deviceInfo: 'HÕIMU BLE Mesh Node',
              isOnline: true,
              hopDistance: 1,
            });
          }
        }
      );

      await new Promise((res) => setTimeout(res, durationMs));
      await BleClient.stopLEScan();
    } catch (err) {
      console.warn('[BleTransport] BLE scan failed:', err);
    } finally {
      this.isScanning = false;
    }
  }

  private startContinuousScan(): void {
    // Opportunistic scan every 45 seconds to preserve phone battery
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.scanOnce(2000);
    }, 45000);
  }

  private populateSimulatedPeers(): void {
    this.discoveredPeers.set('esp32-field-node-1', {
      id: 'esp32-field-node-1',
      callsign: 'KIVI-BEACON-01',
      transport: this.type,
      rssi: -52,
      lastSeen: Date.now(),
      deviceInfo: 'ESP32 BLE Transceiver',
      isOnline: true,
      hopDistance: 1,
    });
    this.discoveredPeers.set('esp32-solar-tracker', {
      id: 'esp32-solar-tracker',
      callsign: 'METSA-RELAY-02',
      transport: this.type,
      rssi: -71,
      lastSeen: Date.now() - 5000,
      deviceInfo: 'ESP32 BLE Solar Node',
      isOnline: true,
      hopDistance: 2,
    });
  }
}
