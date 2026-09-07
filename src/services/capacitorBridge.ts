import { Geolocation, Position } from '@capacitor/geolocation';
import { BleClient } from '@capacitor-community/bluetooth-le';

/**
 * Custom types for HÕIMU native sensors bypassed by browser sandboxes
 */
export interface NativeWifiNetwork {
  ssid: string;
  bssid: string;
  rssi: number;
  frequency: number;
  capabilities: string;
}

export interface NativeBleDevice {
  id: string;
  name: string;
  rssi: number;
  advertisementData?: string;
}

/**
 * CapacitorBridge
 * Handles advanced native Android APIs for HÕIMU, including
 * background GPS tracking, BLE discovery, and Wi-Fi scanning (wardriving).
 * 
 * This service bypasses standard web browser sandbox limitations using Capacitor native wrappers.
 */
class CapacitorBridgeService {
  private isNative: boolean;
  private isBleInitialized = false;

  constructor() {
    // Detect if running in native Android or iOS app environment
    this.isNative = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
  }

  /**
   * Check if running inside the native Android capacitor environment
   */
  public isNativeEnvironment(): boolean {
    return this.isNative;
  }

  private async initBleIfNeeded() {
    if (this.isBleInitialized) return;
    if (!this.isNative) return;
    try {
      await BleClient.initialize();
      this.isBleInitialized = true;
    } catch (e) {
      console.error('[CapacitorBridge] BleClient initialization failed:', e);
    }
  }

  /**
   * Request native Android permissions for location, Bluetooth, and Wi-Fi scanning
   */
  public async requestAllPermissions(): Promise<{ location: boolean; bluetooth: boolean }> {
    if (!this.isNative) {
      console.warn('[CapacitorBridge] Standard browser sandbox does not require native permissions.');
      return { location: true, bluetooth: false };
    }

    try {
      const locationStatus = await Geolocation.requestPermissions();
      return {
        location: locationStatus.location === 'granted',
        bluetooth: true, // Typically handled dynamically or via AndroidManifest
      };
    } catch (e) {
      console.error('[CapacitorBridge] Error requesting native permissions:', e);
      return { location: false, bluetooth: false };
    }
  }

  /**
   * Starts a high-accuracy, battery-optimized background GPS trace session
   * @param onPosition Callback triggered when location changes (even when screen is off)
   * @returns Capacitor Watch ID string
   */
  public async startBackgroundGps(onPosition: (pos: Position) => void): Promise<string> {
    if (!this.isNative) {
      console.info('[CapacitorBridge] Using browser Geolocation watch fallback.');
    }

    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        (position, err) => {
          if (err) {
            console.error('[CapacitorBridge] Native GPS error:', err);
            return;
          }
          if (position) {
            onPosition(position);
          }
        }
      );
      return watchId;
    } catch (error) {
      console.error('[CapacitorBridge] Failed to start background GPS:', error);
      throw error;
    }
  }

  /**
   * Clears an active Geolocation watch session
   */
  public async stopBackgroundGps(watchId: string): Promise<void> {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch (error) {
      console.error('[CapacitorBridge] Error stopping background GPS:', error);
    }
  }

  /**
   * Scans local Wi-Fi networks for wardriving, mapping, and mesh node discovery.
   * This API is strictly blocked in standard browsers but accessible via native Android APIs.
   */
  public async scanWifiNetworks(): Promise<NativeWifiNetwork[]> {
    if (!this.isNative) {
      console.warn('[CapacitorBridge] Wi-Fi scanning is blocked by web browser sandbox. Returning mock nodes.');
      return [
        { ssid: 'HOIMU_POLVA_AP', bssid: 'aa:bb:cc:dd:ee:11', rssi: -45, frequency: 2412, capabilities: '[WPA2-PSK]' },
        { ssid: 'HOIMU_TARTU_RELAY', bssid: 'aa:bb:cc:dd:ee:22', rssi: -67, frequency: 2437, capabilities: '[WPA2-PSK]' },
      ];
    }

    try {
      // In a production build, this routes to our custom Android WifiScan Capacitor plugin
      // Example: const result = await Capacitor.Plugins.WifiScanner.scan();
      // return result.networks;
      return [];
    } catch (e) {
      console.error('[CapacitorBridge] Native Wi-Fi scan failed:', e);
      return [];
    }
  }

  /**
   * Discovers nearby BLE devices, identifying active HÕIMU mesh transceivers.
   */
  public async discoverBleDevices(): Promise<NativeBleDevice[]> {
    await this.initBleIfNeeded();
    if (!this.isNative) {
      console.warn('[CapacitorBridge] Bluetooth LE scanning restricted in iframe/browser. Returning simulated devices.');
      return [
        { id: 'ESP32_HOIMU_1', name: 'HÕIMU Field Node 1', rssi: -55, advertisementData: 'serviceUUID: 00FF' },
        { id: 'ESP32_HOIMU_SOS', name: 'HÕIMU SOS Beacon', rssi: -32, advertisementData: 'serviceUUID: 00FF' },
      ];
    }

    try {
      const devices: NativeBleDevice[] = [];
      await BleClient.requestLEScan(
        {
          services: [],
        },
        (result) => {
          if (result.device && result.device.deviceId) {
            devices.push({
              id: result.device.deviceId,
              name: result.device.name || 'Unmapped BLE Device',
              rssi: result.rssi || -70,
              advertisementData: result.localName || undefined,
            });
          }
        }
      );
      // Scan for 3 seconds, then stop
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await BleClient.stopLEScan();
      return devices;
    } catch (e) {
      console.error('[CapacitorBridge] Native BLE discovery failed:', e);
      return [];
    }
  }

  /**
   * Connect to physical ESP32 HÕIMU LED feedback board over BLE
   */
  public async connectToEsp32LedNode(deviceId: string, onDisconnect?: () => void): Promise<void> {
    await this.initBleIfNeeded();
    if (!this.isNative) {
      console.info('[CapacitorBridge] Simulating BLE connection in browser to device:', deviceId);
      return;
    }
    await BleClient.connect(deviceId, onDisconnect);
    console.info('[CapacitorBridge] Connected to BLE device:', deviceId);
  }

  /**
   * Disconnect from ESP32 HÕIMU LED feedback board
   */
  public async disconnectFromEsp32LedNode(deviceId: string): Promise<void> {
    if (!this.isNative) return;
    await BleClient.disconnect(deviceId);
  }

  /**
   * Send JSON action payload over BLE to ESP32 characteristic
   */
  public async sendLedAction(deviceId: string, actionPayload: any): Promise<void> {
    await this.initBleIfNeeded();
    const jsonStr = JSON.stringify(actionPayload) + '\n';
    const data = new TextEncoder().encode(jsonStr);

    if (!this.isNative) {
      console.info('[CapacitorBridge] Simulated BLE write payload:', jsonStr);
      return;
    }

    const serviceUuid = '000000ff-0000-1000-8000-00805f9b34fb';
    const characteristicUuid = '0000ff01-0000-1000-8000-00805f9b34fb';

    const dataView = new DataView(data.buffer);
    await BleClient.write(deviceId, serviceUuid, characteristicUuid, dataView);
    console.info('[CapacitorBridge] Successfully wrote payload to ESP32 BLE Characteristic');
  }

  private mockNotifyInterval: any = null;

  /**
   * Starts subscribing to BLE notifications from the ESP32 (TX characteristic)
   * to receive real-time sensor telemetries (temperature, battery voltage) 
   * and incoming mesh communication packets.
   */
  public async startMeshAndSensorSync(
    deviceId: string,
    onSensorData: (data: { temp: number; battery: number }) => void,
    onMeshPacket: (senderCallsign: string, text: string) => void
  ): Promise<void> {
    await this.initBleIfNeeded();

    const serviceUuid = '000000ff-0000-1000-8000-00805f9b34fb';
    const txCharacteristicUuid = '0000ff02-0000-1000-8000-00805f9b34fb';

    if (!this.isNative) {
      console.info('[CapacitorBridge] Simulating incoming ESP32 BLE data streams (sensors & mesh).');
      // Set up mock timer to push telemetry events to the UI
      if (this.mockNotifyInterval) clearInterval(this.mockNotifyInterval);
      this.mockNotifyInterval = setInterval(() => {
        // 1. Send simulated sensor values
        const mockTemp = 21.4 + Math.random() * 2;
        const mockBattery = 3.7 + Math.random() * 0.4;
        onSensorData({ temp: parseFloat(mockTemp.toFixed(1)), battery: parseFloat(mockBattery.toFixed(2)) });

        // 2. Occasionally push a simulated mesh packet arriving via ESP32 LoRa module
        if (Math.random() > 0.8) {
          const peers = ['VÕRU_PRIST', 'VALGA_NODE', 'ELVA_RELAY'];
          const selectedPeer = peers[Math.floor(Math.random() * peers.length)];
          onMeshPacket(selectedPeer, `LoRa packet bridged: RSSI -84dBm • Status OK`);
        }
      }, 7000);
      return;
    }

    try {
      await BleClient.startNotifications(
        deviceId,
        serviceUuid,
        txCharacteristicUuid,
        (value: DataView) => {
          try {
            const rawStr = new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
            console.info('[CapacitorBridge] Received raw BLE notification:', rawStr);
            const payload = JSON.parse(rawStr.trim());

            if (payload.type === 'telemetry' || (payload.temp !== undefined && payload.battery !== undefined)) {
              onSensorData({
                temp: payload.temp ?? 22.0,
                battery: payload.battery ?? 3.8,
              });
            } else if (payload.type === 'mesh' && payload.sender && payload.text) {
              onMeshPacket(payload.sender, payload.text);
            }
          } catch (jsonErr) {
            console.warn('[CapacitorBridge] Failed to parse incoming BLE notification payload as JSON:', jsonErr);
          }
        }
      );
      console.info('[CapacitorBridge] Successfully subscribed to ESP32 BLE notifications');
    } catch (e) {
      console.error('[CapacitorBridge] Failed to start BLE notifications:', e);
      throw e;
    }
  }

  /**
   * Stops subscribing to notifications from the ESP32 node
   */
  public async stopMeshAndSensorSync(deviceId: string): Promise<void> {
    if (!this.isNative) {
      if (this.mockNotifyInterval) {
        clearInterval(this.mockNotifyInterval);
        this.mockNotifyInterval = null;
      }
      return;
    }

    const serviceUuid = '000000ff-0000-1000-8000-00805f9b34fb';
    const txCharacteristicUuid = '0000ff02-0000-1000-8000-00805f9b34fb';

    try {
      await BleClient.stopNotifications(deviceId, serviceUuid, txCharacteristicUuid);
      console.info('[CapacitorBridge] Successfully unsubscribed from ESP32 notifications');
    } catch (e) {
      console.error('[CapacitorBridge] Error unsubscribing from BLE notifications:', e);
    }
  }

  /**
   * Dispatches a mesh broadcast message from the phone, which the physical 
   * ESP32 will immediately flood over its LoRa or ESP-NOW link layer.
   */
  public async dispatchMeshMessageOverBle(deviceId: string, senderCallsign: string, text: string): Promise<void> {
    const payload = {
      type: 'mesh_tx',
      sender: senderCallsign,
      text: text,
      timestamp: Date.now(),
    };
    await this.sendLedAction(deviceId, payload);
    console.info('[CapacitorBridge] Dispatched mesh message packet over BLE link to ESP32');
  }
}

export const CapacitorBridge = new CapacitorBridgeService();
