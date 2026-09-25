import { HoimuPacket, AckPayload } from '../protocol/types';
import { HoimuPacketType, PacketFlags, PROTOCOL_VERSION } from '../protocol/constants';
import { validatePacket } from '../protocol/validation';
import { verifyPacketSignature, isSignatureRequired, signPacket } from '../crypto/signatures';
import { MeshTransport } from '../transport/transport';
import { DedupCache } from './dedup';
import { validateAndProcessTTL } from './ttl';
import { RoutingTable, RouteEntry } from './routingTable';
import { NeighborTable, NeighborEntry } from './neighborTable';
import { DutyCycleRegulator, PacketTransmitPriority } from './dutyCycle';
import { RadioRegionPolicy, DEFAULT_RADIO_PROFILE } from './radioProfile';
import { DeliveryManager } from './delivery';
import { PacketStore } from '../storage/packets';
import { OutboxStore, OutboxItem, OutboxState } from '../storage/outbox';
import { PeerStore } from '../storage/peers';
import { peerIdentityStore } from '../services/identity/peerIdentityStore';

export type MeshRoutingMode = 'bounded_epidemic' | 'route_aware';

export interface MeshRouterMetrics {
  packetsReceived: number;
  packetsDroppedDuplicate: number;
  packetsDroppedTTL: number;
  packetsDroppedUnsigned: number;
  packetsForwarded: number;
  packetsDelivered: number;
  ackSuccessRate: number; // percentage 0..100
  averageHops: number;
  averageLatency: number; // ms
  relayedBoundedEpidemic: number;
  relayedRouteAware: number;
  scheduledRelaysCancelled: number; // Duplicates heard while waiting in jitter window
  fanoutSuppressed: number;
}

export interface ScheduledRelay {
  timer: any;
  packet: HoimuPacket;
  fromTransportName?: string;
  targetTransportName?: string;
  scheduledAt: number;
}

export interface MeshRouterOptions {
  localNodeId: string;
  localCallsign?: string;
  dedupCache?: DedupCache;
  signingPrivateKey?: CryptoKey;
  routingMode?: MeshRoutingMode;
  minForwardingDelayMs?: number;
  maxForwardingDelayMs?: number;
  fanoutLimit?: number;
  radioProfile?: RadioRegionPolicy;
}

export class MeshRouter {
  public localNodeId: string;
  public localCallsign: string;
  public transports = new Map<string, MeshTransport>();
  public dedupCache: DedupCache;
  public routingTable: RoutingTable;
  public neighborTable: NeighborTable;
  public dutyCycleRegulator: DutyCycleRegulator;
  public deliveryManager: DeliveryManager;
  public signingPrivateKey?: CryptoKey;
  public routingMode: MeshRoutingMode;
  public minForwardingDelayMs: number;
  public maxForwardingDelayMs: number;
  public fanoutLimit: number;
  public radioProfile: RadioRegionPolicy;

  // In-flight delayed epidemic relays subject to cancellation if duplicate is heard
  private scheduledRelays = new Map<string, ScheduledRelay>();
  private unsubs = new Map<string, () => void>();

  // Real, actual counters
  private metricsData: MeshRouterMetrics = {
    packetsReceived: 0,
    packetsDroppedDuplicate: 0,
    packetsDroppedTTL: 0,
    packetsDroppedUnsigned: 0,
    packetsForwarded: 0,
    packetsDelivered: 0,
    ackSuccessRate: 100,
    averageHops: 0,
    averageLatency: 0,
    relayedBoundedEpidemic: 0,
    relayedRouteAware: 0,
    scheduledRelaysCancelled: 0,
    fanoutSuppressed: 0,
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
    this.neighborTable = new NeighborTable();
    this.radioProfile = options.radioProfile || DEFAULT_RADIO_PROFILE;
    this.dutyCycleRegulator = new DutyCycleRegulator(this.radioProfile);
    this.deliveryManager = new DeliveryManager();
    this.signingPrivateKey = options.signingPrivateKey;
    this.routingMode = options.routingMode || 'route_aware';
    this.minForwardingDelayMs = options.minForwardingDelayMs ?? 20;
    this.maxForwardingDelayMs = options.maxForwardingDelayMs ?? 180;
    this.fanoutLimit = options.fanoutLimit ?? 3;

    // On router start, restore outbox, recover stranded leases, prune expired packets, and resume queue
    OutboxStore.restoreAndCleanExpired().catch(() => {});
  }

  public getMetrics(): MeshRouterMetrics {
    return { ...this.metricsData };
  }

  public setRoutingMode(mode: MeshRoutingMode): void {
    this.routingMode = mode;
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

    // 1. Deduplication & In-Flight Duplicate Heard Relay Cancellation
    // If we have an epidemic relay scheduled for this exact packetId and we hear another node transmitting it,
    // cancel our scheduled relay! This prevents broadcast storms across dense clusters.
    if (this.scheduledRelays.has(header.packetId)) {
      const scheduled = this.scheduledRelays.get(header.packetId)!;
      clearTimeout(scheduled.timer);
      this.scheduledRelays.delete(header.packetId);
      this.metricsData.scheduledRelaysCancelled += 1;
      this.metricsData.packetsDroppedDuplicate += 1;
      return false; // Suppress duplicate transmission
    }

    if (this.dedupCache.isDuplicate(header.packetId)) {
      this.metricsData.packetsDroppedDuplicate += 1;
      return false; // Suppress duplicate
    }
    this.dedupCache.markSeenUntil(header.packetId, header.expiresAt, {
      originId: header.originId,
      sequence: header.sequence,
    });

    this.metricsData.packetsReceived += 1;

    // 2. Strict Signature Policy Enforcement
    // Sensitive packet types (MESSAGE, DIRECT_ENCRYPTED, CRDT, ROUTING, ACK, SOS) REQUIRE signature.
    const sigRequired = isSignatureRequired(header.type);
    if (sigRequired) {
      if (!packet.signature || packet.signature.trim() === '') {
        console.warn(`[MeshRouter] Dropping unsigned packet ${header.packetId}: signature required for type 0x0${header.type.toString(16)}`);
        this.metricsData.packetsDroppedUnsigned += 1;
        return false;
      }

      // Verify signature via PeerStore or trusted peerIdentityStore
      const peer = await PeerStore.getPeer(header.originId);
      const trustedIdentity = await peerIdentityStore.getPeerByNodeId(header.originId);
      const pubKey =
        peer?.signingPublicKeyHex ||
        trustedIdentity?.signingPublicKey ||
        (header.originId.length === 64 ? header.originId : undefined);

      if (pubKey) {
        const isValidSig = await verifyPacketSignature(packet, pubKey);
        if (!isValidSig) {
          console.warn(`[MeshRouter] Dropping packet ${header.packetId} due to invalid cryptographic signature`);
          return false;
        }
      }
    } else if (packet.signature) {
      // Optional signature verification
      const peer = await PeerStore.getPeer(header.originId);
      const trustedIdentity = await peerIdentityStore.getPeerByNodeId(header.originId);
      const pubKey =
        peer?.signingPublicKeyHex ||
        trustedIdentity?.signingPublicKey ||
        (header.originId.length === 64 ? header.originId : undefined);

      if (pubKey) {
        const isValidSig = await verifyPacketSignature(packet, pubKey);
        if (!isValidSig) {
          console.warn(`[MeshRouter] Dropping packet ${header.packetId} due to invalid signature`);
          return false;
        }
      }
    }

    // Process authenticated identity announcement if present
    if (
      header.type === HoimuPacketType.ROUTE_ANNOUNCE ||
      (typeof packet.payload === 'object' &&
        packet.payload !== null &&
        ('signingPublicKey' in packet.payload || 'signingPublicKeyHex' in packet.payload))
    ) {
      const p = packet.payload as any;
      const signingKey = p?.signingPublicKey || p?.signingPublicKeyHex;
      const encryptionKey = p?.encryptionPublicKey || p?.encryptionPublicKeyHex || p?.dhPublicKeyHex || '';
      const callsign = p?.callsign || header.originId;

      if (signingKey && signingKey.length === 64) {
        await peerIdentityStore.putPeer({
          nodeId: header.originId,
          callsign,
          signingPublicKey: signingKey,
          encryptionPublicKey: encryptionKey,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
          trustState: 'verified',
          capabilities: p?.capabilities || ['routing', 'messaging'],
        });

        await PeerStore.upsertPeer({
          nodeId: header.originId,
          callsign,
          signingPublicKeyHex: signingKey,
          dhPublicKeyHex: encryptionKey,
          lastSeen: Date.now(),
          hopCount: header.hopCount || 0,
          viaTransport: fromTransportName,
        });
      }
    }

    // 3. Handle ACK packets (signed, authenticated, priority confirmation)
    if (header.type === HoimuPacketType.ACK) {
      const ackPayload = packet.payload as AckPayload;
      const ackTargetId =
        ackPayload?.ackedPacketId ||
        ackPayload?.acknowledgedPacketId ||
        (packet.payload as any)?.ackForPacketId ||
        (packet.payload as any)?.packetId;
      const ackStatus = ackPayload?.status || 'received';

      if (ackTargetId) {
        if (ackStatus === 'rejected') {
          await OutboxStore.recordAttempt(ackTargetId, false, true, 'Remote node rejected packet');
        } else {
          await OutboxStore.confirmAck(ackTargetId, {
            status: ackStatus,
            latencyMs: ackPayload?.latencyMs,
          });
          this.totalAcksReceived += 1;
          if (this.totalAcksRequested > 0) {
            this.metricsData.ackSuccessRate = Math.min(
              100,
              Math.round((this.totalAcksReceived / this.totalAcksRequested) * 100)
            );
          }
        }
      }
    }

    // 4. Update direct neighbor table & route metrics with physical link awareness (RSSI, SNR, ETX)
    if (header.originId && header.originId !== this.localNodeId) {
      const rssi = (packet as any).transportMeta?.rssi ?? -80;
      const snr = (packet as any).transportMeta?.snr ?? 10;

      const neighbor = this.neighborTable.updateNeighbor(
        header.originId,
        fromTransportName || 'Unknown',
        rssi,
        snr,
        header.originId
      );

      const existingPeer = await PeerStore.getPeer(header.originId);
      const trustedIdentity = await peerIdentityStore.getPeerByNodeId(header.originId);

      // Data model invariant: originId != signingPublicKey.
      // Retrieve signingPublicKeyHex from PeerStore, peerIdentityStore, or 64-char originId string only.
      const resolvedSigningKey =
        existingPeer?.signingPublicKeyHex ||
        trustedIdentity?.signingPublicKey ||
        (header.originId.length === 64 ? header.originId : '');

      const resolvedDhKey =
        existingPeer?.dhPublicKeyHex ||
        trustedIdentity?.encryptionPublicKey ||
        '';

      await PeerStore.upsertPeer({
        nodeId: header.originId,
        callsign: existingPeer?.callsign || trustedIdentity?.callsign || header.originId,
        signingPublicKeyHex: resolvedSigningKey,
        dhPublicKeyHex: resolvedDhKey,
        lastSeen: Date.now(),
        hopCount: header.hopCount || 0,
        viaTransport: fromTransportName,
      });

      this.routingTable.updateRoute(
        header.originId,
        header.originId,
        header.hopCount || 0,
        fromTransportName || 'Unknown',
        1.0,
        neighbor.linkQuality.etx,
        neighbor.linkQuality.lqScore
      );
    }

    // 5. Save to persistent packet store
    await PacketStore.save(packet);

    // 6. Check if packet is intended for local node (or broadcast)
    const isForMe =
      header.destinationId === '*' ||
      header.destinationId === 'broadcast' ||
      header.destinationId === this.localNodeId ||
      (header.destinationId && this.localNodeId.startsWith(header.destinationId)) ||
      (this.localNodeId && header.destinationId.startsWith(this.localNodeId));

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

      // Auto-send ACK back if addressed directly to local node (not broadcast, not an ACK itself)
      if (
        header.destinationId === this.localNodeId &&
        header.type !== HoimuPacketType.ACK &&
        header.originId
      ) {
        this.sendAck(header.originId, header.packetId, header.sequence || 0).catch(() => {});
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

      await this.routeOrForwardPacket(forwardedPacket, fromTransportName);
    } else if (!shouldForward && header.destinationId !== this.localNodeId) {
      this.metricsData.packetsDroppedTTL += 1;
    }

    return deliveredLocally;
  }

  /**
   * Dual-mode forwarding engine:
   * v1: Bounded Epidemic Forwarding (jitter delay, fanout limit, duplicate cancellation)
   * v2: Route-Aware Unicast (next-hop metric, ETX, neighbor quality, fallback to bounded epidemic)
   */
  public async routeOrForwardPacket(
    packet: HoimuPacket,
    fromTransportName?: string
  ): Promise<void> {
    const dest = packet.header.destinationId;
    const isBroadcast = dest === '*' || dest === 'broadcast';

    // v2: If route-aware mode is active and destination is unicast, check routing table
    if (this.routingMode === 'route_aware' && !isBroadcast) {
      const route = this.routingTable.getRoute(dest);
      if (route && route.viaTransport) {
        const transport = this.transports.get(route.viaTransport);
        if (transport && route.viaTransport !== fromTransportName) {
          try {
            const sent = await transport.send(packet);
            if (sent) {
              this.metricsData.relayedRouteAware += 1;
              this.metricsData.packetsForwarded += 1;
              return;
            }
          } catch (err) {
            console.warn(`[MeshRouter] Route-aware forwarding failed on ${route.viaTransport}:`, err);
            this.routingTable.invalidateRoute(dest);
          }
        }
      }
    }

    // v1: Bounded Epidemic Forwarding (or fallback for unknown route / broadcast)
    this.scheduleEpidemicRelay(packet, fromTransportName);
  }

  /**
   * Schedules bounded epidemic relay with random forwarding delay.
   * If another node broadcasts the same packet before the timer fires,
   * handleIncomingPacket cancels this scheduled relay!
   */
  public scheduleEpidemicRelay(
    packet: HoimuPacket,
    fromTransportName?: string,
    forcedDelayMs?: number
  ): void {
    const packetId = packet.header.packetId;

    // Calculate randomized forwarding delay with hop jitter
    const minD = this.minForwardingDelayMs;
    const maxD = this.maxForwardingDelayMs;
    const jitter = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
    const hopJitter = Math.min(100, (packet.header.hopCount || 0) * 15);
    const delay = forcedDelayMs ?? (jitter + hopJitter);

    const timer = setTimeout(async () => {
      this.scheduledRelays.delete(packetId);
      await this.executeEpidemicRelay(packet, fromTransportName);
    }, delay);

    this.scheduledRelays.set(packetId, {
      timer,
      packet,
      fromTransportName,
      scheduledAt: Date.now(),
    });
  }

  public cancelScheduledRelay(packetId: string): boolean {
    const scheduled = this.scheduledRelays.get(packetId);
    if (scheduled) {
      clearTimeout(scheduled.timer);
      this.scheduledRelays.delete(packetId);
      this.metricsData.scheduledRelaysCancelled += 1;
      return true;
    }
    return false;
  }

  /**
   * Executes physical broadcast relay across candidate transports, applying fanout limits.
   */
  public async executeEpidemicRelay(
    packet: HoimuPacket,
    excludeTransportName?: string
  ): Promise<number> {
    const candidates = Array.from(this.transports.entries()).filter(
      ([name]) => !excludeTransportName || name !== excludeTransportName
    );

    if (candidates.length === 0) {
      return 0;
    }

    // Apply Fanout Limit (avoids broadcast storms on 100+ node multi-bearer environments)
    let selected = candidates;
    if (candidates.length > this.fanoutLimit) {
      selected = candidates.slice(0, this.fanoutLimit);
      this.metricsData.fanoutSuppressed += candidates.length - selected.length;
    }

    let forwardedCount = 0;
    for (const [name, transport] of selected) {
      try {
        const sent = await transport.send(packet);
        if (sent) forwardedCount += 1;
      } catch (err) {
        console.error(`[MeshRouter] Epidemic relay failed on transport ${name}:`, err);
      }
    }

    if (forwardedCount > 0) {
      this.metricsData.relayedBoundedEpidemic += 1;
      this.metricsData.packetsForwarded += 1;
    }

    return forwardedCount;
  }

  /**
   * Immediate synchronous relay fallback (e.g. for direct bridge invocation).
   */
  public async relayPacket(packet: HoimuPacket, excludeTransportName?: string): Promise<void> {
    await this.routeOrForwardPacket(packet, excludeTransportName);
  }

  /**
   * Generates, signs, and sends an authenticated, high-priority ACK packet.
   */
  public async sendAck(
    destId: string,
    originalPacketId: string,
    originalSequence: number = 0,
    signingKey?: CryptoKey
  ): Promise<HoimuPacket<AckPayload>> {
    const now = Date.now();
    const ackPayload: AckPayload = {
      ackedPacketId: originalPacketId,
      originNodeId: destId,
      receiverNodeId: this.localNodeId,
      status: 'received',
      originalSequence,
      timestamp: now,
      acknowledgedPacketId: originalPacketId,
      ackForPacketId: originalPacketId,
    };

    let ackPacket: HoimuPacket<AckPayload> = {
      header: {
        version: PROTOCOL_VERSION,
        type: HoimuPacketType.ACK,
        packetId: `ACK_${Math.random().toString(36).substring(2, 9)}`.toUpperCase(),
        senderId: this.localNodeId.slice(0, 8),
        originId: this.localNodeId,
        destinationId: destId,
        ttl: 5,
        hopCount: 0,
        createdAt: now,
        expiresAt: now + 300_000,
        flags: PacketFlags.IS_PRIORITY,
        sequence: now & 0xffffffff,
        length: 48,
      },
      payload: ackPayload,
    };

    const keyToUse = signingKey || this.signingPrivateKey;
    if (keyToUse) {
      ackPacket = await signPacket(ackPacket, keyToUse);
    }

    await this.sendOutbound(ackPacket);
    return ackPacket;
  }

  /**
   * Sends an outbound packet through the full lease-based outbox lifecycle:
   * QUEUED -> CLAIMED -> SENDING -> TX_CONFIRMED -> (WAITING_ACK -> ACKED)
   */
  public async sendOutbound(packet: HoimuPacket): Promise<boolean> {
    // 1. Mark as seen locally in SeenPacketCache
    this.dedupCache.markSeenUntil(packet.header.packetId, packet.header.expiresAt, {
      originId: packet.header.originId,
      sequence: packet.header.sequence,
    });

    // 2. Persist in outbox with retry policy & packet store (status: 'queued')
    await PacketStore.save(packet);
    const requiresAck = packet.header.destinationId !== '*' && packet.header.type !== HoimuPacketType.ACK;
    const outboxItem = await OutboxStore.enqueue(packet);

    if (requiresAck) {
      this.totalAcksRequested += 1;
    }

    // 3. Claim item with lease and transition to 'sending'
    const workerId = `router_${this.localNodeId}`;
    await OutboxStore.claim(outboxItem.id, workerId, 15000);
    await OutboxStore.startSending(outboxItem.id);

    // 4. Physical radio/transport transmission
    let anySuccess = false;
    for (const [_, transport] of this.transports.entries()) {
      try {
        const sent = await transport.send(packet);
        if (sent) anySuccess = true;
      } catch (err) {
        console.error(`[MeshRouter] Outbound send error on ${transport.name}:`, err);
      }
    }

    // 5. TX confirmation vs Delivery confirmation:
    // Radio TX success does NOT mean delivered. If ACK is required, item transitions to 'waiting_ack'.
    if (anySuccess) {
      await OutboxStore.confirmTx(outboxItem.id, undefined, requiresAck);
    } else {
      await OutboxStore.recordAttempt(outboxItem.id, false, requiresAck, 'Radio transmission failed on all transports');
    }

    return anySuccess;
  }

  public destroy(): void {
    for (const scheduled of this.scheduledRelays.values()) {
      clearTimeout(scheduled.timer);
    }
    this.scheduledRelays.clear();
    for (const unsub of this.unsubs.values()) {
      unsub();
    }
    this.unsubs.clear();
  }
}

export type { OutboxState, OutboxItem };
