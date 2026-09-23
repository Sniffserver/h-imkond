import { BaseTransport } from './transport';
import { HoimuPacket } from '../protocol/types';
import { encodeBinaryPacket, decodeBinaryPacket } from '../protocol/codec';

export class WifiAwareTransport extends BaseTransport {
  public readonly name = 'Wi-Fi Local / WebSocket';
  private ws: WebSocket | null = null;
  private serverUrl: string;

  constructor(serverUrl = 'ws://localhost:8080/hoimu-mesh') {
    super();
    this.serverUrl = serverUrl;
    this.isAvailable = typeof WebSocket !== 'undefined';
  }

  public async start(): Promise<void> {
    if (!this.isAvailable) return;
    try {
      this.ws = new WebSocket(this.serverUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const rawBytes = new Uint8Array(event.data);
          const packet = decodeBinaryPacket(rawBytes);
          if (packet) {
            this.emitPacket(packet, rawBytes);
          }
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch {
      this.metrics.errors += 1;
    }
  }

  public async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const rawBytes = encodeBinaryPacket(packet);
      this.ws.send(rawBytes);
      this.metrics.packetsSent += 1;
      this.metrics.bytesSent += rawBytes.length;
      return true;
    } catch {
      this.metrics.errors += 1;
      return false;
    }
  }
}
