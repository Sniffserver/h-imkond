import {
  MeshTransport,
  MeshPacket,
  SendResult,
  TransportPeer,
  TransportType,
} from './types';
import { BroadcastChannelTransport } from './BroadcastChannelTransport';
import { LoopbackTransport } from './LoopbackTransport';
import { BleTransport } from './BleTransport';
import { WifiAwareTransport } from './WifiAwareTransport';
import { LoRaBridgeTransport } from './LoRaBridgeTransport';

export interface TransportBearerStatus {
  id: string;
  name: string;
  type: TransportType;
  isPhysical: boolean;
  isAvailable: boolean;
  isActive: boolean;
  peersCount: number;
  packetsSent: number;
  packetsReceived: number;
  lastActivityTime?: number;
}

export interface TransportManagerStats {
  totalSent: number;
  totalReceived: number;
  bearers: TransportBearerStatus[];
}

/**
 * MeshTransportManager
 * Central orchestration and routing hub for HÕIMU's multi-bearer mesh transports.
 * Implements store-and-forward relaying across heterogeneous radio technologies:
 * BLE <-> Wi-Fi Direct <-> LoRa <-> BroadcastChannel
 */
export class MeshTransportManager {
  private transports: Map<TransportType, MeshTransport> = new Map();
  private activeSubscriptions: Map<TransportType, () => void> = new Map();
  private subscribers = new Set<(packet: MeshPacket, fromTransport: TransportType) => Promise<void> | void>();
  private statsListeners = new Set<(stats: TransportManagerStats) => void>();

  private packetCounters = {
    sent: new Map<TransportType, number>(),
    received: new Map<TransportType, number>(),
    lastActivity: new Map<TransportType, number>(),
  };

  private isStarted = false;
  private peerCache: Map<string, TransportPeer> = new Map();
  public localNodeId?: string;

  constructor(options?: { localNodeId?: string }) {
    this.localNodeId = options?.localNodeId;
    // Register standard transport bearers
    this.registerTransport(new BroadcastChannelTransport());
    this.registerTransport(new BleTransport());
    this.registerTransport(new WifiAwareTransport());
    this.registerTransport(new LoRaBridgeTransport());
    this.registerTransport(new LoopbackTransport());
  }

  public async initialize(): Promise<void> {
    return this.start();
  }

  public getActiveTransports(): MeshTransport[] {
    return this.getAllTransports();
  }

  public async broadcast(packet: MeshPacket): Promise<{ success: boolean; results: SendResult[]; transportsUsed: string[] }> {
    const results = await this.send(packet);
    const successfulTransports = results.filter((r) => r.success).map((r) => r.transport);
    return {
      success: successfulTransports.length > 0,
      results,
      transportsUsed: successfulTransports,
    };
  }

  /**
   * Register a new or custom transport bearer
   */
  public registerTransport(transport: MeshTransport): void {
    this.transports.set(transport.type, transport);
    if (!this.packetCounters.sent.has(transport.type)) {
      this.packetCounters.sent.set(transport.type, 0);
      this.packetCounters.received.set(transport.type, 0);
    }
  }

  public getTransport(type: TransportType): MeshTransport | undefined {
    return this.transports.get(type);
  }

  public getAllTransports(): MeshTransport[] {
    return Array.from(this.transports.values());
  }

  /**
   * Start all registered transports
   */
  public async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    for (const [type, transport] of this.transports.entries()) {
      try {
        const available = await transport.isAvailable();
        if (available) {
          await transport.start();
          this.hookTransportSubscription(type, transport);
        }
      } catch (err) {
        console.warn(`[MeshTransportManager] Error starting transport ${type}:`, err);
      }
    }

    this.notifyStatsListeners();
  }

  /**
   * Stop all transports
   */
  public async stop(): Promise<void> {
    this.isStarted = false;

    // Unsubscribe from all
    for (const unsub of this.activeSubscriptions.values()) {
      unsub();
    }
    this.activeSubscriptions.clear();

    for (const transport of this.transports.values()) {
      try {
        await transport.stop();
      } catch (err) {
        console.warn(`[MeshTransportManager] Error stopping transport:`, err);
      }
    }

    this.notifyStatsListeners();
  }

  /**
   * Discover reachable peers across all active bearers
   */
  public async discoverAllPeers(): Promise<TransportPeer[]> {
    const peers: TransportPeer[] = [];
    const seenIds = new Set<string>();

    for (const transport of this.transports.values()) {
      try {
        const discovered = await transport.discover();
        for (const peer of discovered) {
          if (!seenIds.has(peer.id)) {
            seenIds.add(peer.id);
            peers.push(peer);
            this.peerCache.set(peer.id, peer);
          }
        }
      } catch (err) {
        console.warn(`[MeshTransportManager] Discovery error on ${transport.type}:`, err);
      }
    }

    return peers;
  }

  /**
   * Broadcast or target a packet across transports.
   * If a specific transport is requested, uses that transport.
   * Otherwise, broadcasts across all available physical & local bearers for redundant mesh propagation.
   */
  public async send(
    packet: MeshPacket,
    preferredTransport?: TransportType
  ): Promise<SendResult[]> {
    if (!this.isStarted) {
      await this.start();
    }

    const results: SendResult[] = [];

    if (preferredTransport && this.transports.has(preferredTransport)) {
      const transport = this.transports.get(preferredTransport)!;
      try {
        const res = await transport.send(packet);
        if (res.success) {
          this.recordSent(preferredTransport);
        }
        results.push(res);
      } catch (err: any) {
        results.push({
          success: false,
          transport: preferredTransport,
          error: err?.message || 'Send failed',
        });
      }
    } else {
      // Multi-bearer broadcast: transmit across all ready transports
      const promises: Promise<SendResult>[] = [];

      for (const [type, transport] of this.transports.entries()) {
        promises.push(
          (async () => {
            try {
              const res = await transport.send(packet);
              if (res.success) {
                this.recordSent(type);
              }
              return res;
            } catch (err: any) {
              return {
                success: false,
                transport: type,
                error: err?.message || 'Send failed',
              };
            }
          })()
        );
      }

      const allResults = await Promise.allSettled(promises);
      for (const r of allResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        }
      }
    }

    this.notifyStatsListeners();
    return results;
  }

  /**
   * Subscribe to incoming packets received from ANY transport bearer
   */
  public subscribe(
    handler: (packet: MeshPacket, fromTransport: TransportType) => Promise<void> | void
  ): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Get telemetry and active bearer stats
   */
  public async getStats(): Promise<TransportManagerStats> {
    const bearers: TransportBearerStatus[] = [];
    let totalSent = 0;
    let totalReceived = 0;

    for (const [type, transport] of this.transports.entries()) {
      let isAvail = false;
      try {
        isAvail = await transport.isAvailable();
      } catch {
        isAvail = false;
      }

      let peersCount = 0;
      try {
        const peers = await transport.discover();
        peersCount = peers.length;
      } catch {
        peersCount = 0;
      }

      const sent = this.packetCounters.sent.get(type) || 0;
      const rec = this.packetCounters.received.get(type) || 0;
      totalSent += sent;
      totalReceived += rec;

      bearers.push({
        id: transport.id,
        name: transport.name,
        type: transport.type,
        isPhysical: transport.isPhysical,
        isAvailable: isAvail,
        isActive: this.isStarted && (isAvail || !transport.isPhysical),
        peersCount,
        packetsSent: sent,
        packetsReceived: rec,
        lastActivityTime: this.packetCounters.lastActivity.get(type),
      });
    }

    return {
      totalSent,
      totalReceived,
      bearers,
    };
  }

  public subscribeStats(callback: (stats: TransportManagerStats) => void): () => void {
    this.statsListeners.add(callback);
    // Send immediate stats
    this.getStats().then(callback).catch(() => {});
    return () => {
      this.statsListeners.delete(callback);
    };
  }

  private hookTransportSubscription(type: TransportType, transport: MeshTransport): void {
    if (this.activeSubscriptions.has(type)) {
      return;
    }

    const unsub = transport.subscribe(async (packet) => {
      this.recordReceived(type);
      this.notifyStatsListeners();

      // Distribute to all unified subscribers
      for (const handler of this.subscribers) {
        try {
          await handler(packet, type);
        } catch (err) {
          console.error(`[MeshTransportManager] Subscriber error for packet from ${type}:`, err);
        }
      }
    });

    this.activeSubscriptions.set(type, unsub);
  }

  private recordSent(type: TransportType): void {
    const current = this.packetCounters.sent.get(type) || 0;
    this.packetCounters.sent.set(type, current + 1);
    this.packetCounters.lastActivity.set(type, Date.now());
  }

  private recordReceived(type: TransportType): void {
    const current = this.packetCounters.received.get(type) || 0;
    this.packetCounters.received.set(type, current + 1);
    this.packetCounters.lastActivity.set(type, Date.now());
  }

  private notifyStatsListeners(): void {
    if (this.statsListeners.size === 0) return;
    this.getStats().then((stats) => {
      this.statsListeners.forEach((cb) => {
        try {
          cb(stats);
        } catch (e) {
          console.error('[MeshTransportManager] Stats listener error:', e);
        }
      });
    }).catch(() => {});
  }
}

// Global singleton instance for application use
export const meshTransportManager = new MeshTransportManager();
