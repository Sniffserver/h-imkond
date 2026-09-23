import { MeshTransport, MeshPacket, SendResult, TransportPeer, TransportType } from './types';

const DEFAULT_CHANNEL_NAME = 'hoimu_mesh_transport_bc';
const STORAGE_BACKUP_KEY = 'hoimu_mesh_sync_packet';

/**
 * BroadcastChannelTransport
 * Standard development and multi-tab browser transport.
 * Allows simulating multiple HÕIMU nodes across different browser tabs/windows.
 */
export class BroadcastChannelTransport implements MeshTransport {
  public readonly id = 'broadcast-channel-transport';
  public readonly name = 'Browser Multi-Tab Broadcast';
  public readonly type: TransportType = 'broadcast_channel';
  public readonly isPhysical = false;

  private channelName: string;
  private channel: BroadcastChannel | null = null;
  private isRunning = false;
  private subscribers = new Set<(packet: MeshPacket) => Promise<void> | void>();
  private discoveredPeers = new Map<string, TransportPeer>();
  private storageEventListener: ((e: StorageEvent) => void) | null = null;

  constructor(channelName = DEFAULT_CHANNEL_NAME) {
    this.channelName = channelName;
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'BroadcastChannel' in window;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    if (this.isAvailable()) {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event: MessageEvent) => {
          this.handleRawIncoming(event.data);
        };
      } catch (err) {
        console.warn('[BroadcastChannelTransport] Failed to open BroadcastChannel:', err);
      }
    }

    // Storage fallback for cross-origin or older contexts
    if (typeof window !== 'undefined') {
      this.storageEventListener = (event: StorageEvent) => {
        if (event.key === STORAGE_BACKUP_KEY && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            this.handleRawIncoming(parsed);
          } catch {
            // Ignore parse errors
          }
        }
      };
      window.addEventListener('storage', this.storageEventListener);
    }

    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Safe close
      }
      this.channel = null;
    }

    if (this.storageEventListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageEventListener);
      this.storageEventListener = null;
    }

    this.isRunning = false;
  }

  public async discover(): Promise<TransportPeer[]> {
    const now = Date.now();
    // Prune stale peers not heard from in 60s
    for (const [id, peer] of this.discoveredPeers.entries()) {
      if (now - peer.lastSeen > 60000) {
        this.discoveredPeers.delete(id);
      }
    }
    return Array.from(this.discoveredPeers.values());
  }

  public async send(packet: MeshPacket): Promise<SendResult> {
    if (!this.isRunning) {
      await this.start();
    }

    const wirePacket: MeshPacket = {
      ...packet,
      transportMeta: {
        originTransport: this.type,
        rssi: -45,
      },
    };

    let deliveredViaBc = false;
    if (this.channel) {
      try {
        this.channel.postMessage(wirePacket);
        deliveredViaBc = true;
      } catch (err) {
        console.warn('[BroadcastChannelTransport] postMessage failed:', err);
      }
    }

    // Backup via localStorage for tab sync
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_BACKUP_KEY,
          JSON.stringify({ ...wirePacket, _ts: Date.now(), _nonce: Math.random() })
        );
      } catch {
        // LocalStorage quota may be exceeded
      }
    }

    return {
      success: deliveredViaBc || typeof window !== 'undefined',
      transport: this.type,
      txId: `bc-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      latencyMs: 3,
    };
  }

  public subscribe(handler: (packet: MeshPacket) => Promise<void> | void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  private handleRawIncoming(raw: any): void {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.senderCallsign) {
      return;
    }

    const packet = raw as MeshPacket;

    // Track sending peer
    this.discoveredPeers.set(packet.senderId || packet.senderCallsign, {
      id: packet.senderId || `bc-${packet.senderCallsign}`,
      callsign: packet.senderCallsign,
      transport: this.type,
      rssi: -48,
      lastSeen: Date.now(),
      deviceInfo: 'Browser Tab Client',
      isOnline: true,
      hopDistance: packet.hopCount || 1,
    });

    this.subscribers.forEach((handler) => {
      try {
        handler(packet);
      } catch (e) {
        console.error('[BroadcastChannelTransport] Handler error:', e);
      }
    });
  }
}
