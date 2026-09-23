import { HoimuPacket } from '../protocol/types';

export interface TransportMetrics {
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  errors: number;
}

export type PacketHandler = (packet: HoimuPacket, rawBytes?: Uint8Array) => void;

export interface MeshTransport {
  readonly name: string;
  readonly isAvailable: boolean;
  readonly isConnected: boolean;

  start(): Promise<void>;
  stop(): Promise<void>;
  send(packet: HoimuPacket): Promise<boolean>;
  onPacket(handler: PacketHandler): () => void;
  getMetrics(): TransportMetrics;
}

export abstract class BaseTransport implements MeshTransport {
  public abstract readonly name: string;
  public isAvailable = true;
  public isConnected = false;

  protected handlers = new Set<PacketHandler>();
  protected metrics: TransportMetrics = {
    bytesSent: 0,
    bytesReceived: 0,
    packetsSent: 0,
    packetsReceived: 0,
    errors: 0,
  };

  public abstract start(): Promise<void>;
  public abstract stop(): Promise<void>;
  public abstract send(packet: HoimuPacket): Promise<boolean>;

  public onPacket(handler: PacketHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  protected emitPacket(packet: HoimuPacket, rawBytes?: Uint8Array): void {
    this.metrics.packetsReceived += 1;
    if (rawBytes) {
      this.metrics.bytesReceived += rawBytes.length;
    }
    for (const handler of this.handlers) {
      try {
        handler(packet, rawBytes);
      } catch (err) {
        console.error(`[Transport:${this.name}] Handler error:`, err);
      }
    }
  }

  public getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }
}
