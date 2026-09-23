import { HoimuPacket } from '../protocol/types';
import { HoimuPacketType } from '../protocol/constants';
import { validatePacket } from '../protocol/validation';
import { verifyPacketSignature } from '../crypto/signatures';
import { MeshTransport } from '../transport/transport';
import { DedupCache } from './dedup';
import { validateAndProcessTTL } from './ttl';
import { RoutingTable } from './routingTable';
import { DeliveryManager } from './delivery';
import { PacketStore } from '../storage/packets';
import { OutboxStore, OutboxItem, OutboxState } from '../storage/outbox';
import { PeerStore } from '../storage/peers';

export interface MeshRouterMetrics {
  packetsReceived: number;
  packetsDroppedDuplicate: number;
  packetsDroppedTTL: number;
  packetsForwarded: number;
  packetsDelivered: number;
  ackSuccessRate: number; // percentage 0..100
  averageHops: number;
  averageLatency: number; // ms
}

export interface MeshRouterOptions {
  localNodeId: string;
  localCallsign?: string;
  dedupCache?: DedupCache;
}

export class MeshRouter {
  public localNodeId: string;
  public localCallsign: string;
  public transports = new Map<string, MeshTransport>();
  public dedupCache: DedupCache;
  public routingTable: RoutingTable;
  public deliveryManager: DeliveryManager;
  private unsubs = new Map<string, () => void>();

  // Real, actual counters
  private metricsData: MeshRouterMetrics = {
    packetsReceived: 0,
    packetsDroppedDuplicate: 0,
    packetsDroppedTTL: 0,
    packetsForwarded: 0,
    packetsDelivered: 0,
    ackSuccessRate: 100,
    averageHops: 0,
    averageLatency: 0,
  };

  private totalAcksRequested = 0;
  private totalAcksReceived = 0;
  private totalHopsSum = 0;
  private totalDeliveredCount = 0;
  private totalLatencySumMs = 0;
  private latencyCount = 0;

  constructor(options: MeshRouterOptions) {
    this.localNodeId = options.localNodeId;
    this.localCallsign = options.localCallsign || options.localNodeId;
    this.dedupCache = options.dedupCache || new DedupCache();
    this.routingTable = new RoutingTable();
    this.deliveryManager = new DeliveryManager();

    // On router start, restore outbox, prune expired packets, and resume queue
    OutboxStore.restoreAndCleanExpired().catch(() => {});
  }

  public getMetrics(): MeshRouterMetrics {
    return { ...this.metricsData };
  }

  public registerTransport(transport: MeshTransport): void {
    if (this.transports.has(transport.name)) {
      return;
    }
    this.transports.set(transport.name, transport);
    const unsub = transport.onPacket((packet, _rawBytes) => {
      this.handleIncomingPacket(packet, transport.name);
    });
    this.unsubs.set(transport.name, unsub);
  }

  public unregisterTransport(name: string): void {
    const unsub = this.unsubs.get(name);
    if (unsub) {
      unsub();
      this.unsubs.delete(name);
    }
    this.transports.delete(name);
  }

  public async handleIncomingPacket(packet: HoimuPacket, fromTransportName?: string): Promise<boolean> {
    const validation = validatePacket(packet);
    if (!validation.valid) {
      return false;
    }

    const { header } = packet;

    // 1. Deduplication check (SeenPacketCache)
    if (this.dedupCache.isDuplicate(header.packetId)) {
      this.metricsData.packetsDroppedDuplicate += 1;
      return false; // Suppress duplicate
    }
    this.dedupCache.markSeen(header.packetId, header.expiresAt);

    this.metricsData.packetsReceived += 1;

    // 2. Validate Signature if present
    if (packet.signature) {
      const isValidSig = await verifyPacketSignature(packet);
      if (!isValidSig) {
        console.warn(`[MeshRouter] Dropping packet ${header.packetId} due to invalid signature`);
        return false;
      }
    }

    // 3. Handle ACK packets
    if (header.type === HoimuPacketType.ACK) {
      const ackTargetId = (packet.payload as any)?.ackForPacketId || (packet.payload as any)?.packetId;
      if (ackTargetId) {
        await OutboxStore.updateStatus(ackTargetId, 'acknowledged');
        this.totalAcksReceived += 1;
        if (this.totalAcksRequested > 0) {
          this.metricsData.ackSuccessRate = Math.min(
            100,
            Math.round((this.totalAcksReceived / this.totalAcksRequested) * 100)
          );
        }
      }
    }

    // 4. Update peer directory & routing metrics
    if (header.originId && header.originId !== this.localNodeId) {
      await PeerStore.upsertPeer({
        nodeId: header.originId,
        callsign: header.originId,
        signingPublicKeyHex: header.originId,
        lastSeen: Date.now(),
        hopCount: header.hopCount || 0,
        viaTransport: fromTransportName,
      });

      this.routingTable.updateRoute(
        header.originId,
        header.originId,
        header.hopCount || 0,
        fromTransportName || 'Unknown'
      );
    }

    // 5. Save to persistent packet store
    await PacketStore.save(packet);

    // 6. Check if packet is intended for local node (or broadcast)
    const isForMe =
      header.destinationId === '*' ||
      header.destinationId === 'broadcast' ||
      header.destinationId === this.localNodeId;

    let deliveredLocally = false;
    if (isForMe) {
      await this.deliveryManager.deliverToLocalApp(packet);
      deliveredLocally = true;
      this.metricsData.packetsDelivered += 1;

      // Update average hops metric
      this.totalDeliveredCount += 1;
      this.totalHopsSum += header.hopCount || 0;
      this.metricsData.averageHops =
        Math.round((this.totalHopsSum / this.totalDeliveredCount) * 10) / 10;

      // If packet specifies createdAt, update average latency
      if (packet.header.createdAt) {
        const latency = Math.max(1, Date.now() - packet.header.createdAt);
        this.totalLatencySumMs += latency;
        this.latencyCount += 1;
        this.metricsData.averageLatency = Math.round(this.totalLatencySumMs / this.latencyCount);
      }

      // Auto-send ACK back if requested and addressed specifically to us
      if (
        header.destinationId === this.localNodeId &&
        header.type !== HoimuPacketType.ACK &&
        header.originId
      ) {
        this.sendAck(header.originId, header.packetId).catch(() => {});
      }
    }

    // 7. Route selection & Forward / Relay
    const { shouldForward, newTTL, newHopCount } = validateAndProcessTTL(packet);
    if (shouldForward && (header.destinationId !== this.localNodeId || header.destinationId === '*')) {
      const forwardedPacket: HoimuPacket = {
        ...packet,
        header: {
          ...packet.header,
          ttl: newTTL,
          hopCount: newHopCount,
        },
      };

      await this.relayPacket(forwardedPacket, fromTransportName);
    } else if (!shouldForward && header.destinationId !== this.localNodeId) {
      this.metricsData.packetsDroppedTTL += 1;
    }

    return deliveredLocally;
  }

  public async relayPacket(packet: HoimuPacket, excludeTransportName?: string): Promise<void> {
    let forwardedCount = 0;
    for (const [name, transport] of this.transports.entries()) {
      if (excludeTransportName && name === excludeTransportName) {
        continue;
      }
      try {
        const sent = await transport.send(packet);
        if (sent) forwardedCount += 1;
      } catch (err) {
        console.error(`[MeshRouter] Failed to relay on transport ${name}:`, err);
      }
    }
    if (forwardedCount > 0) {
      this.metricsData.packetsForwarded += 1;
    }
  }

  private async sendAck(destId: string, originalPacketId: string): Promise<void> {
    const now = Date.now();
    const ackPacket: HoimuPacket = {
      header: {
        version: 1,
        type: HoimuPacketType.ACK,
        packetId: `ACK_${Math.random().toString(36).substring(2, 9)}`.toUpperCase(),
        senderId: this.localNodeId,
        originId: this.localNodeId,
        destinationId: destId,
        ttl: 5,
        hopCount: 0,
        createdAt: now,
        expiresAt: now + 300_000,
        flags: 0,
        sequence: now & 0xffffffff,
        length: 32,
      },
      payload: { ackForPacketId: originalPacketId },
    };
    await this.sendOutbound(ackPacket);
  }

  public async sendOutbound(packet: HoimuPacket): Promise<boolean> {
    // 1. Mark as seen locally in SeenPacketCache
    this.dedupCache.markSeen(packet.header.packetId, packet.header.expiresAt);

    // 2. Persist in outbox with retry policy & packet store
    await PacketStore.save(packet);
    const outboxItem = await OutboxStore.enqueue(packet);

    if (packet.header.destinationId !== '*' && packet.header.type !== HoimuPacketType.ACK) {
      this.totalAcksRequested += 1;
    }

    // 3. Attempt initial transmission
    let anySuccess = false;
    for (const [_, transport] of this.transports.entries()) {
      try {
        const sent = await transport.send(packet);
        if (sent) anySuccess = true;
      } catch (err) {
        console.error(`[MeshRouter] Outbound send error on ${transport.name}:`, err);
      }
    }

    await OutboxStore.recordAttempt(outboxItem.id, anySuccess);

    return anySuccess;
  }
}
