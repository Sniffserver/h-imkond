/**
 * HÕIMU Direct Neighbor Table & Link Quality Assessor
 */

export interface LinkQuality {
  rssiDbm: number;
  snrDb: number;
  lqScore: number; // 0..100 quality score calculated from RSSI and SNR
  packetLossRate: number; // 0..1
}

export interface NeighborEntry {
  nodeId: string;
  callsign?: string;
  viaTransport: string;
  linkQuality: LinkQuality;
  lastSeenAt: number;
  packetsReceived: number;
}

export class NeighborTable {
  private neighbors = new Map<string, NeighborEntry>();

  public updateNeighbor(
    nodeId: string,
    viaTransport: string,
    rssiDbm: number = -80,
    snrDb: number = 10,
    callsign?: string
  ): NeighborEntry {
    const existing = this.neighbors.get(nodeId);
    const packetsReceived = (existing?.packetsReceived || 0) + 1;

    // Normalize LQ score (RSSI -30 to -120 dBm, SNR -20 to +15 dB)
    const normalizedRssi = Math.max(0, Math.min(100, (rssiDbm + 120) * (100 / 90)));
    const normalizedSnr = Math.max(0, Math.min(100, (snrDb + 20) * (100 / 35)));
    const lqScore = Math.round(normalizedRssi * 0.6 + normalizedSnr * 0.4);

    const entry: NeighborEntry = {
      nodeId,
      callsign: callsign || existing?.callsign || nodeId,
      viaTransport,
      linkQuality: {
        rssiDbm,
        snrDb,
        lqScore,
        packetLossRate: existing ? Math.max(0, existing.linkQuality.packetLossRate - 0.05) : 0,
      },
      lastSeenAt: Date.now(),
      packetsReceived,
    };

    this.neighbors.set(nodeId, entry);
    return entry;
  }

  public getNeighbor(nodeId: string): NeighborEntry | undefined {
    return this.neighbors.get(nodeId);
  }

  public getActiveNeighbors(timeoutMs = 5 * 60 * 1000): NeighborEntry[] {
    const now = Date.now();
    return Array.from(this.neighbors.values()).filter(
      (n) => now - n.lastSeenAt <= timeoutMs
    );
  }
}
