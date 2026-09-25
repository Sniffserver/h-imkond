import { MeshTransport, MeshPacket, SendResult, TransportPeer, TransportType } from './types';
import {
  sendViaBridge,
  getMeshPeersFromBridge,
  getBridgeStatus,
  getCachedBridgeStatus,
  isMockBridgeMode,
  subscribeBridgeStream,
  BridgeStreamEvent,
} from '../../comms/piBridge';
import { DEFAULT_RADIO_PROFILE } from '../../../mesh/radioProfile';

interface PendingTxRecord {
  packetId: string;
  sentAt: number;
}

/**
 * LoRaBridgeTransport
 * Physical Long-Range (868MHz SX1262) transport connecting to Raspberry Pi Zero 2 W Hardware Bridge.
 * 
 * Production Event-Driven Architecture:
 * - Listens to real asynchronous stream from Pi (PACKET_RX, PEER_UPDATE, ACK_RX, RADIO_STATUS)
 * - Eliminates artificial 12s polling interval for packet ingress
 * - Uses real measured physical round-trip times (RTT) without synthetic floors (Math.max(120, ...))
 */
export class LoRaBridgeTransport implements MeshTransport {
  public readonly id = 'lora-bridge-transport';
  public readonly name = 'LoRa 868MHz Physical Bridge (Pi Zero 2 W)';
  public readonly type: TransportType = 'lora_bridge';
  public readonly isPhysical = true;

  private isRunning = false;
  private streamUnsub: (() => void) | null = null;
  private subscribers = new Set<(packet: MeshPacket) => Promise<void> | void>();
  private discoveredPeers = new Map<string, TransportPeer>();

  // Tracks in-flight transmissions for genuine physical RTT measurement upon ACK reception
  private pendingTxTracker = new Map<string, PendingTxRecord>();

  public async isAvailable(): Promise<boolean> {
    try {
      if (isMockBridgeMode()) return true;
      const status = await getBridgeStatus();
      return status.connected;
    } catch {
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Initial peer discovery
    await this.refreshPeers();

    // 2. Real-time event-driven packet stream from Raspberry Pi
    // Replaces blind 12-second polling with instant stream dispatch
    this.streamUnsub = subscribeBridgeStream((event: BridgeStreamEvent) => {
      this.handleBridgeStreamEvent(event);
    });
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.streamUnsub) {
      this.streamUnsub();
      this.streamUnsub = null;
    }
    this.pendingTxTracker.clear();
  }

  private handleBridgeStreamEvent(event: BridgeStreamEvent): void {
    if (!this.isRunning) return;

    switch (event.type) {
      case 'PACKET_RX':
        // Real-time packet ingress from LoRa radio
        if (event.payload?.packet) {
          this.handleIncomingLoRaPacket(
            event.payload.packet,
            event.payload.snr ?? 9.5,
            event.payload.rssi ?? -85
          );
        }
        break;

      case 'PEER_UPDATE':
        // Discrete peer presence announcement
        if (event.payload?.peer) {
          const bp = event.payload.peer;
          this.discoveredPeers.set(bp.id, {
            id: bp.id,
            callsign: bp.callsign || bp.id,
            transport: this.type,
            rssi: bp.rssi || -85,
            lastSeen: bp.lastHeard || Date.now(),
            deviceInfo: `LoRa Node (${bp.role || 'relay'})`,
            isOnline: true,
            hopDistance: bp.hops || 1,
          });
        }
        break;

      case 'ACK_RX':
        // Genuine physical ACK received: calculate true end-to-end RTT
        if (event.payload?.packetId) {
          const pending = this.pendingTxTracker.get(event.payload.packetId);
          if (pending) {
            const measuredRtt = Date.now() - pending.sentAt;
            this.pendingTxTracker.delete(event.payload.packetId);
            console.info(
              `[LoRaBridgeTransport] ACK received for packet ${event.payload.packetId}, ` +
              `measured RTT: ${measuredRtt}ms (genuine physical timing)`
            );
          }
        }
        break;

      case 'RADIO_STATUS':
        // Physical LoRa status updates (noise floor, duty cycle, etc.)
        break;
    }
  }

  public async discover(): Promise<TransportPeer[]> {
    await this.refreshPeers();
    return Array.from(this.discoveredPeers.values());
  }

  public async send(packet: MeshPacket): Promise<SendResult> {
    const startTime = performance.now();

    if (!isMockBridgeMode() && !getCachedBridgeStatus().connected) {
      return {
        success: false,
        transport: this.type,
        error: 'Pi Bridge not connected',
      };
    }

    if (!this.isRunning) {
      await this.start();
    }

    // Register pending TX for RTT tracking
    this.pendingTxTracker.set(packet.id, {
      packetId: packet.id,
      sentAt: Date.now(),
    });

    try {
      const bridgePacket = {
        type: packet.type,
        from: packet.senderCallsign,
        to: packet.targetCallsign || 'broadcast',
        payload: {
          packetId: packet.id,
          type: packet.type,
          senderId: packet.senderId,
          timestamp: packet.timestamp,
          ttl: packet.ttl,
          hopCount: packet.hopCount,
          data: packet.payload,
          signature: packet.signature,
        },
      };

      const result = await sendViaBridge(bridgePacket);
      const rawDuration = Math.round(performance.now() - startTime);

      if (result.success) {
        // Real measured duration reported by radio driver, or elapsed wall time
        // Grounded: No artificial Math.max(120, duration) synthetic padding
        const measuredLatency = result.measuredDurationMs ?? rawDuration;

        return {
          success: true,
          transport: this.type,
          txId: result.txId || `lora-tx-${Date.now()}`,
          recipientCount: this.discoveredPeers.size,
          latencyMs: measuredLatency,
        };
      } else {
        this.pendingTxTracker.delete(packet.id);
        return {
          success: false,
          transport: this.type,
          error: 'Pi Bridge rejected or dropped packet',
        };
      }
    } catch (err: any) {
      this.pendingTxTracker.delete(packet.id);
      return {
        success: false,
        transport: this.type,
        error: err?.message || 'LoRa bridge transmit error',
      };
    }
  }

  public subscribe(handler: (packet: MeshPacket) => Promise<void> | void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Dispatches incoming packet received from Pi Bridge LoRa antenna (SX1262)
   */
  public handleIncomingLoRaPacket(packet: MeshPacket, snr = 9.5, rssi = -92): void {
    packet.transportMeta = {
      originTransport: this.type,
      rssi,
      snr,
      frequencyMhz: DEFAULT_RADIO_PROFILE.defaultChannel.frequencyMhz,
    };

    this.discoveredPeers.set(packet.senderId || packet.senderCallsign, {
      id: packet.senderId || `lora-${packet.senderCallsign}`,
      callsign: packet.senderCallsign,
      transport: this.type,
      rssi,
      lastSeen: Date.now(),
      deviceInfo: `LoRa SX1262 (SNR: ${snr.toFixed(1)} dB)`,
      isOnline: true,
      hopDistance: packet.hopCount || 1,
    });

    this.subscribers.forEach((handler) => {
      try {
        handler(packet);
      } catch (e) {
        console.error('[LoRaBridgeTransport] Handler error:', e);
      }
    });
  }

  private async refreshPeers(): Promise<void> {
    if (!isMockBridgeMode() && !getCachedBridgeStatus().connected) {
      return;
    }
    try {
      const bridgePeers = await getMeshPeersFromBridge();
      bridgePeers.forEach((bp) => {
        this.discoveredPeers.set(bp.id, {
          id: bp.id,
          callsign: bp.callsign || bp.id,
          transport: this.type,
          rssi: bp.rssi || -85,
          lastSeen: bp.lastHeard || Date.now(),
          deviceInfo: `LoRa Node (${bp.role || 'relay'})`,
          isOnline: true,
          hopDistance: bp.hops || 1,
        });
      });
    } catch (err) {
      console.warn('[LoRaBridgeTransport] Peer refresh warning:', err);
    }
  }
}
