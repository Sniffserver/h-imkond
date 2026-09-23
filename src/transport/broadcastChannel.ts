import { BaseTransport } from './transport';
import { HoimuPacket } from '../protocol/types';
import { encodeBinaryPacket, decodeBinaryPacket } from '../protocol/codec';

export class BroadcastChannelTransport extends BaseTransport {
  public readonly name = 'BroadcastChannel';
  private channel: BroadcastChannel | null = null;
  private channelName: string;

  constructor(channelName = 'hoimu_mesh_broadcast') {
    super();
    this.channelName = channelName;
    this.isAvailable = typeof BroadcastChannel !== 'undefined';
  }

  public async start(): Promise<void> {
    if (!this.isAvailable) return;
    if (this.channel) return;

    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event) => {
      try {
        if (event.data instanceof Uint8Array || event.data instanceof ArrayBuffer) {
          const bytes = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
          const packet = decodeBinaryPacket(bytes);
          if (packet) {
            this.emitPacket(packet, bytes);
          }
        } else if (event.data && event.data.header) {
          this.emitPacket(event.data as HoimuPacket);
        }
      } catch (err) {
        this.metrics.errors += 1;
      }
    };

    this.isConnected = true;
  }

  public async stop(): Promise<void> {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.isConnected = false;
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    if (!this.channel) return false;
    try {
      const bytes = encodeBinaryPacket(packet);
      this.channel.postMessage(bytes);
      this.metrics.packetsSent += 1;
      this.metrics.bytesSent += bytes.length;
      return true;
    } catch {
      this.metrics.errors += 1;
      return false;
    }
  }
}
