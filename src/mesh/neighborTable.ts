/**
 * HÕIMU Direct Neighbor Table & Link Quality Assessor
 * Grounded in physical RF link assessment: RSSI, SNR, ETX, and link freshness.
 */

export interface LinkQuality {
  rssiDbm: number;
  snrDb: number;
  lqScore: number; // 0..100 quality score calculated from RSSI and SNR
  packetLossRate: number; // 0..1
  etx: number; // Expected Transmission Count = 1 / (1 - packetLossRate)
}

export interface NeighborEntry {
  nodeId: string;
  callsign?: string;
  viaTransport: string;
  linkQuality: LinkQuality;
  batteryPercent?: number; // 0..100 if advertised
  lastSeenAt: number;
  packetsReceived: number;
  compositeScore: number; // 0..100 composite routing viability score
}

export class NeighborTable {
  private neighbors = new Map<string, NeighborEntry>();

  public updateNeighbor(
    nodeId: string,
    viaTransport: string,
    rssiDbm: number = -80,
    snrDb: number = 10,
    callsign?: string,
    batteryPercent?: number
  ): NeighborEntry {
    const existing = this.neighbors.get(nodeId);
    const packetsReceived = (existing?.packetsReceived || 0) + 1;

    // Normalize LQ score (RSSI -30 to -120 dBm, SNR -20 to +15 dB)
    const normalizedRssi = Math.max(0, Math.min(100, (rssiDbm + 120) * (100 / 90)));
    const normalizedSnr = Math.max(0, Math.min(100, (snrDb + 20) * (100 / 35)));
    const lqScore = Math.round(normalizedRssi * 0.6 + normalizedSnr * 0.4);

    const packetLossRate = existing ? Math.max(0, existing.linkQuality.packetLossRate - 0.05) : 0;
    const etx = Math.round((1 / Math.max(0.1, 1 - packetLossRate)) * 100) / 100;

    // Freshness factor: 1.0 if seen within 60s, decreases after
    const freshnessFactor = 1.0;
    const batteryFactor = batteryPercent !== undefined ? Math.max(0.4, batteryPercent / 100) : 1.0;
    const compositeScore = Math.min(
      100,
      Math.max(1, Math.round((lqScore / etx) * freshnessFactor * batteryFactor))
    );

    const entry: NeighborEntry = {
      nodeId,
      callsign: callsign || existing?.callsign || nodeId,
      viaTransport,
      batteryPercent: batteryPercent ?? existing?.batteryPercent,
      linkQuality: {
        rssiDbm,
        snrDb,
        lqScore,
        packetLossRate,
        etx,
      },
      lastSeenAt: Date.now(),
      packetsReceived,
      compositeScore,
    };

    this.neighbors.set(nodeId, entry);
    return entry;
  }

  public recordPacketLoss(nodeId: string): void {
    const existing = this.neighbors.get(nodeId);
    if (!existing) return;
    const newLoss = Math.min(1.0, existing.linkQuality.packetLossRate + 0.15);
    const etx = Math.round((1 / Math.max(0.05, 1 - newLoss)) * 100) / 100;
    existing.linkQuality.packetLossRate = newLoss;
    existing.linkQuality.etx = etx;
    existing.compositeScore = Math.max(1, Math.round(existing.linkQuality.lqScore / etx));
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

  public getBestNeighbor(candidateIds: string[]): NeighborEntry | undefined {
    const active = this.getActiveNeighbors();
    const matches = active.filter((n) => candidateIds.includes(n.nodeId));
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => b.compositeScore - a.compositeScore)[0];
  }
}
