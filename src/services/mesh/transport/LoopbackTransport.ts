import { MeshTransport, MeshPacket, SendResult, TransportPeer, TransportType } from './types';

/**
 * LoopbackTransport
 * In-memory deterministic transport designed for Vitest test suites and isolated mock runs.
 */
export class LoopbackTransport implements MeshTransport {
  public readonly id = 'loopback-transport';
  public readonly name = 'In-Memory Loopback';
  public readonly type: TransportType = 'loopback';
  public readonly isPhysical = false;

  private isRunning = false;
  private subscribers = new Set<(packet: MeshPacket) => Promise<void> | void>();
  private mockPeers: TransportPeer[] = [];
  public sentPackets: MeshPacket[] = [];

  constructor(options?: { initialPeers?: TransportPeer[] }) {
    if (options?.initialPeers) {
      this.mockPeers = [...options.initialPeers];
    } else {
      this.mockPeers = [
        {
          id: 'mock-peer-1',
          callsign: 'TARTU-ECHO-1',
          transport: 'loopback',
          rssi: -42,
          lastSeen: Date.now(),
          isOnline: true,
          hopDistance: 1,
        },
      ];
    }
  }

  public isAvailable(): boolean {
    return true;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
  }

  public async discover(): Promise<TransportPeer[]> {
    return [...this.mockPeers];
  }

  public setMockPeers(peers: TransportPeer[]): void {
    this.mockPeers = [...peers];
  }

  public async send(packet: MeshPacket): Promise<SendResult> {
    if (!this.isRunning) {
      return {
        success: false,
        transport: this.type,
        error: 'Loopback transport is stopped',
      };
    }

    this.sentPackets.push(packet);

    // If targeted or broadcast, deliver to local loopback subscribers asynchronously
    const deliveryPacket: MeshPacket = {
      ...packet,
      transportMeta: {
        originTransport: this.type,
        rssi: -35,
      },
    };

    queueMicrotask(() => {
      this.subscribers.forEach((handler) => {
        try {
          handler(deliveryPacket);
        } catch (e) {
          console.error('[LoopbackTransport] Handler error:', e);
        }
      });
    });

    return {
      success: true,
      transport: this.type,
      txId: `loopback-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientCount: this.mockPeers.length,
      latencyMs: 1,
    };
  }

  /**
   * Manually inject an incoming packet as if received from an external node
   */
  public injectIncomingPacket(packet: MeshPacket): void {
    this.subscribers.forEach((handler) => {
      try {
        handler({
          ...packet,
          transportMeta: {
            originTransport: this.type,
            rssi: -48,
          },
        });
      } catch (e) {
        console.error('[LoopbackTransport] Inject handler error:', e);
      }
    });
  }

  public subscribe(handler: (packet: MeshPacket) => Promise<void> | void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }
}
