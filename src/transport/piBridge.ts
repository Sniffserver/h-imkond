import { BaseTransport } from './transport';
import { HoimuPacket } from '../protocol/types';
import { encodeBinaryPacket, decodeBinaryPacket } from '../protocol/codec';

export interface PiGatewayStatus {
  online: boolean;
  frequencyMhz: number;
  bandwidthKhz: number;
  spreadingFactor: number;
  txPowerDbm: number;
  packetsRelayed: number;
}

export class PiBridgeTransport extends BaseTransport {
  public readonly name = 'Raspberry Pi SX1262 Bridge';
  private bridgeUrl: string;

  constructor(bridgeUrl = 'http://localhost:5000/api/lora') {
    super();
    this.bridgeUrl = bridgeUrl;
    this.isAvailable = true;
  }

  public async start(): Promise<void> {
    try {
      const res = await fetch(`${this.bridgeUrl}/status`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        this.isConnected = true;
      }
    } catch {
      this.isConnected = false;
    }
  }

  public async stop(): Promise<void> {
    this.isConnected = false;
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    const rawBytes = encodeBinaryPacket(packet);
    try {
      const res = await fetch(`${this.bridgeUrl}/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: rawBytes,
      });

      if (res.ok) {
        this.metrics.packetsSent += 1;
        this.metrics.bytesSent += rawBytes.length;
        this.isConnected = true;
        return true;
      }
      return false;
    } catch {
      this.metrics.errors += 1;
      return false;
    }
  }

  public injectReceivedWireBytes(bytes: Uint8Array): void {
    const packet = decodeBinaryPacket(bytes);
    if (packet) {
      this.emitPacket(packet, bytes);
    }
  }
}
