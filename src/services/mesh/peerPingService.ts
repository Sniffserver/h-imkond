import { MeshNode } from '../../types';
import { soundFeedback } from '../utils/soundFeedback';

export interface BleHeartbeatPingPacket {
  type: 'BLE_HEARTBEAT_PING' | 'BLE_HEARTBEAT_PONG';
  pingId: string;
  senderId: string;
  targetPeerId: string;
  timestamp: number;
  payloadSizeBytes: number; // e.g. 16 bytes ultra-low power packet
  sequenceNumber: number;
}

export interface PeerPingResult {
  success: boolean;
  pingId: string;
  peerId: string;
  latencyMs: number;
  rssiDbm: number;
  hopCount: number;
  packetSizeBytes: number;
  status: 'optimal' | 'good' | 'degraded' | 'timeout';
  statusMessage: string;
  timestamp: number;
  isDirectBle: boolean;
}

class PeerPingService {
  private pingSequence = 0;
  private pingHistory: Map<string, PeerPingResult[]> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('hoimu_ble_heartbeat_channel');
        this.broadcastChannel.onmessage = (event) => {
          // Listen for simulated peer heartbeat frames without triggering full sync
          const packet: BleHeartbeatPingPacket = event.data;
          if (packet && packet.type === 'BLE_HEARTBEAT_PING') {
            // Heartbeat received
          }
        };
      } catch {
        // Fallback for restricted iframes
      }
    }
  }

  /**
   * Sends a low-energy BLE 'heartbeat' packet (16 bytes) to test peer connectivity
   * and round-trip latency (RTT) without triggering a full database synchronization.
   */
  public async pingPeer(
    peer: MeshNode,
    senderId = 'local-node'
  ): Promise<PeerPingResult> {
    this.pingSequence++;
    const pingId = `ping_${Date.now()}_${this.pingSequence}`;
    const startTime = performance.now();
    const packetSizeBytes = 16; // 16-byte low power BLE heartbeat

    // Broadcast frame over local BLE simulation channel
    if (this.broadcastChannel) {
      try {
        const pingPacket: BleHeartbeatPingPacket = {
          type: 'BLE_HEARTBEAT_PING',
          pingId,
          senderId,
          targetPeerId: peer.id,
          timestamp: Date.now(),
          payloadSizeBytes: packetSizeBytes,
          sequenceNumber: this.pingSequence,
        };
        this.broadcastChannel.postMessage(pingPacket);
      } catch (err) {
        console.warn('BLE Ping broadcast notice:', err);
      }
    }

    // Realistic physical BLE latency modeling based on RSSI and hop count
    const rssi = peer.lastRssi || -70;
    const isDirect = peer.isDirect ?? (peer.hopDistance === 1);
    const hopCount = peer.hopDistance || 1;

    let baseDelay = 22; // Direct 0/1-hop BLE transmission base RTT in ms
    if (rssi > -60) {
      baseDelay = 18 + Math.random() * 8; // 18-26 ms
    } else if (rssi > -75) {
      baseDelay = 26 + Math.random() * 14; // 26-40 ms
    } else if (rssi > -88) {
      baseDelay = 42 + Math.random() * 25; // 42-67 ms
    } else {
      baseDelay = 70 + Math.random() * 35; // 70-105 ms
    }

    if (!isDirect || hopCount > 1) {
      baseDelay += (hopCount - 1) * 35 + Math.random() * 15;
    }

    // Simulate async radio roundtrip transmission
    await new Promise((resolve) => setTimeout(resolve, Math.max(15, baseDelay)));

    const roundTripTime = Math.round(performance.now() - startTime);

    let status: PeerPingResult['status'] = 'optimal';
    let statusMessage = 'Optimal low-latency link';

    if (roundTripTime <= 30) {
      status = 'optimal';
      statusMessage = 'Optimal low-energy BLE link';
    } else if (roundTripTime <= 65) {
      status = 'good';
      statusMessage = 'Good link latency';
    } else if (roundTripTime <= 120) {
      status = 'degraded';
      statusMessage = 'High multi-hop relay latency';
    } else {
      status = 'degraded';
      statusMessage = 'Fringe RF signal propagation';
    }

    const result: PeerPingResult = {
      success: true,
      pingId,
      peerId: peer.id,
      latencyMs: roundTripTime,
      rssiDbm: rssi,
      hopCount,
      packetSizeBytes,
      status,
      statusMessage,
      timestamp: Date.now(),
      isDirectBle: isDirect,
    };

    // Save to in-memory history
    const current = this.pingHistory.get(peer.id) || [];
    this.pingHistory.set(peer.id, [result, ...current.slice(0, 9)]);

    return result;
  }

  public getPingHistory(peerId: string): PeerPingResult[] {
    return this.pingHistory.get(peerId) || [];
  }

  public getLatestPing(peerId: string): PeerPingResult | null {
    const history = this.getPingHistory(peerId);
    return history.length > 0 ? history[0] : null;
  }
}

export const peerPingService = new PeerPingService();
