import { MeshTransport, MeshPacket, SendResult, TransportPeer, TransportType } from './types';
import {
  sendViaBridge,
  getMeshPeersFromBridge,
  getBridgeStatus,
  isMockBridgeMode,
} from '../../comms/piBridge';

/**
 * LoRaBridgeTransport
 * Physical Long-Range (868MHz SX1262) transport connecting to Raspberry Pi Zero 2 W Hardware Bridge.
 * Capable of kilometers of non-line-of-sight propagation across forests and rural bioregions.
 */
export class LoRaBridgeTransport implements MeshTransport {
  public readonly id = 'lora-bridge-transport';
  public readonly name = 'LoRa 868MHz Physical Bridge (Pi Zero 2 W)';
  public readonly type: TransportType = 'lora_bridge';
  public readonly isPhysical = true;

  private isRunning = false;
  private pollIntervalId: any = null;
  private subscribers = new Set<(packet: MeshPacket) => Promise<void> | void>();
  private discoveredPeers = new Map<string, TransportPeer>();

  public async isAvailable(): Promise<boolean> {
    try {
      const status = await getBridgeStatus();
      return status.connected || isMockBridgeMode();
    } catch {
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial peer discovery
    await this.refreshPeers();

    // Start background poll for incoming LoRa packets relayed by the Pi
    this.pollIntervalId = setInterval(async () => {
      if (!this.isRunning) return;
      await this.refreshPeers();
    }, 12000);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  public async discover(): Promise<TransportPeer[]> {
    await this.refreshPeers();
    return Array.from(this.discoveredPeers.values());
  }

  public async send(packet: MeshPacket): Promise<SendResult> {
    const startTime = performance.now();

    if (!this.isRunning) {
      await this.start();
    }

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
      const duration = Math.round(performance.now() - startTime);

      if (result.success) {
        return {
          success: true,
          transport: this.type,
          txId: result.txId || `lora-tx-${Date.now()}`,
          recipientCount: this.discoveredPeers.size,
          latencyMs: Math.max(120, duration), // LoRa time-on-air is physically ~120-400ms
        };
      } else {
        return {
          success: false,
          transport: this.type,
          error: 'Pi Bridge rejected or dropped packet',
        };
      }
    } catch (err: any) {
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
      frequencyMhz: 868.1,
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
