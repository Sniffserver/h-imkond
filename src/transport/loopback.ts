import { BaseTransport } from './transport';
import { HoimuPacket } from '../protocol/types';

export class LoopbackTransport extends BaseTransport {
  public readonly name = 'Loopback';
  private static globalBus = new Set<LoopbackTransport>();

  public async start(): Promise<void> {
    this.isConnected = true;
    LoopbackTransport.globalBus.add(this);
  }

  public async stop(): Promise<void> {
    this.isConnected = false;
    LoopbackTransport.globalBus.delete(this);
  }

  public async send(packet: HoimuPacket): Promise<boolean> {
    if (!this.isConnected) return false;
    this.metrics.packetsSent += 1;

    // Dispatch asynchronously to other loopback transports
    setTimeout(() => {
      for (const peer of LoopbackTransport.globalBus) {
        if (peer !== this) {
          peer.emitPacket(packet);
        }
      }
    }, 5);

    return true;
  }
}
