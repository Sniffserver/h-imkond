import { HoimuPacket } from '../protocol/types';
import { validatePacket } from '../protocol/validation';
import { verifyPacketSignature } from '../crypto/signatures';
import { MeshTransport } from '../transport/transport';
import { DedupCache } from './dedup';
import { validateAndProcessTTL } from './ttl';
import { RoutingTable } from './routingTable';
import { DeliveryManager } from './delivery';
import { PacketStore } from '../storage/packets';
import { OutboxStore } from '../storage/outbox';
import { PeerStore } from '../storage/peers';

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

  constructor(options: MeshRouterOptions) {
    this.localNodeId = options.localNodeId;
    this.localCallsign = options.localCallsign || options.localNodeId;
    this.dedupCache = options.dedupCache || new DedupCache();
    this.routingTable = new RoutingTable();
    this.deliveryManager = new DeliveryManager();
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

    // 1. Deduplication check
    if (this.dedupCache.isDuplicate(header.packetId)) {
      return false; // Suppress duplicate
    }
    this.dedupCache.markSeen(header.packetId, header.expiresAt);

    // 2. Validate Signature if present
    if (packet.signature) {
      const isValidSig = await verifyPacketSignature(packet);
      if (!isValidSig) {
        console.warn(`[MeshRouter] Dropping packet ${header.packetId} due to invalid signature`);
        return false;
      }
    }

    // 3. Update peer directory & routing metrics
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

    // 4. Save to persistent packet store
    await PacketStore.save(packet);

    // 5. Check if packet is intended for local node (or broadcast)
    const isForMe =
      header.destinationId === '*' ||
      header.destinationId === 'broadcast' ||
      header.destinationId === this.localNodeId;

    let deliveredLocally = false;
    if (isForMe) {
      await this.deliveryManager.deliverToLocalApp(packet);
      deliveredLocally = true;
    }

    // 6. Forward / Relay if not exclusively for me or if broadcast with TTL > 1
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
    }

    return deliveredLocally;
  }

  public async relayPacket(packet: HoimuPacket, excludeTransportName?: string): Promise<void> {
    for (const [name, transport] of this.transports.entries()) {
      if (excludeTransportName && name === excludeTransportName) {
        continue;
      }
      try {
        await transport.send(packet);
      } catch (err) {
        console.error(`[MeshRouter] Failed to relay on transport ${name}:`, err);
      }
    }
  }

  public async sendOutbound(packet: HoimuPacket): Promise<boolean> {
    // 1. Mark as seen locally
    this.dedupCache.markSeen(packet.header.packetId, packet.header.expiresAt);

    // 2. Persist in outbox & packet store
    await PacketStore.save(packet);
    await OutboxStore.enqueue(packet);

    // 3. Broadcast across all active transports
    let anySuccess = false;
    for (const [_, transport] of this.transports.entries()) {
      try {
        const sent = await transport.send(packet);
        if (sent) anySuccess = true;
      } catch (err) {
        console.error(`[MeshRouter] Outbound send error on ${transport.name}:`, err);
      }
    }

    if (anySuccess) {
      await OutboxStore.updateStatus(packet.header.packetId, 'delivered');
    }

    return anySuccess;
  }
}
