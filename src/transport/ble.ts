import { BaseTransport } from './transport';
import { HoimuPacket } from '../protocol/types';
import { encodeBinaryPacket, decodeBinaryPacket } from '../protocol/codec';

export const HOIMU_BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const HOIMU_BLE_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const HOIMU_BLE_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export class BleTransport extends BaseTransport {
  public readonly name = 'Bluetooth LE';
  private txCharacteristic: any = null;
  private rxCharacteristic: any = null;
  private server: any = null;

  constructor() {
    super();
    this.isAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async start(): Promise<void> {
    if (!this.isAvailable) return;
  }

  public async connectToDevice(): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [HOIMU_BLE_SERVICE_UUID] }],
      });

      this.server = await device.gatt.connect();
      const service = await this.server.getPrimaryService(HOIMU_BLE_SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(HOIMU_BLE_TX_CHAR_UUID);
      this.rxCharacteristic = await service.getCharacteristic(HOIMU_BLE_RX_CHAR_UUID);

      await this.rxCharacteristic.startNotifications();
      this.rxCharacteristic.addEventListener('characteristicvaluechanged', (e: any) => {
        const rawBytes = new Uint8Array(e.target.value.buffer);
        const packet = decodeBinaryPacket(rawBytes);
        if (packet) {
          this.emitPacket(packet, rawBytes);
        }
      });

      this.isConnected = true;
      return true;
    } catch {
      this.metrics.errors += 1;
      return false;
    }
  }

  public async stop(): Promise<void> {
    if (this.server && this.server.connected) {
      this.server.disconnect();
    }
    this.isConnected = false;
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    const rawBytes = encodeBinaryPacket(packet);
    if (this.txCharacteristic && this.isConnected) {
      try {
        await this.txCharacteristic.writeValue(rawBytes);
        this.metrics.packetsSent += 1;
        this.metrics.bytesSent += rawBytes.length;
        return true;
      } catch {
        this.metrics.errors += 1;
        return false;
      }
    }
    return false;
  }
}
