import { MeshNode } from '../types';
import { calculatePeerDiagnosticDetails } from './networkDiagnosticsHelper';

export interface MeshHealthMetrics {
  overallScore: number;          // 0 - 100
  statusLabel: string;           // "Optimal", "Good", "Fair", "Degraded"
  statusBadgeColor: string;      // CSS tailwind classes for badge
  statusBorderColor: string;     // Border color for cards
  
  // Sub-metrics
  rssiScore: number;             // 0 - 100
  avgRssiDbm: number;            // e.g. -58 dBm
  rssiStatusLabel: string;       // e.g. "Strong (-58 dBm)"
  
  latencyScore: number;          // 0 - 100
  avgLatencyMs: number;          // e.g. 38 ms
  latencyStatusLabel: string;    // e.g. "Ultra Low (38 ms)"
  
  relayScore: number;            // 0 - 100
  activeRelayCount: number;      // e.g. 3
  directPeerCount: number;       // e.g. 2
  totalPeersCount: number;       // e.g. 5
  avgRelayReliability: number;   // e.g. 96.5%
  relayStatusLabel: string;      // e.g. "3 Active Relays (96.5%)"
  
  recommendation: string;        // Dynamic tip e.g. "Signal & Latency optimal..."
}

/**
 * Calculates the Mesh Health Score by aggregating signal strength (RSSI),
 * peer round-trip latency (RTT), and active relay node availability & reliability.
 */
export function calculateMeshHealthScore(peers: MeshNode[]): MeshHealthMetrics {
  if (!peers || peers.length === 0) {
    return {
      overallScore: 0,
      statusLabel: 'Offline / Searching',
      statusBadgeColor: 'bg-[#637062]/20 text-[#637062] border-[#637062]/30',
      statusBorderColor: 'border-[#637062]/30',
      rssiScore: 0,
      avgRssiDbm: -100,
      rssiStatusLabel: 'No Active RF Links',
      latencyScore: 0,
      avgLatencyMs: 0,
      latencyStatusLabel: 'No Signal RTT',
      relayScore: 0,
      activeRelayCount: 0,
      directPeerCount: 0,
      totalPeersCount: 0,
      avgRelayReliability: 0,
      relayStatusLabel: '0 Relays Active',
      recommendation: 'Scan for nearby BLE beacons or LoRa mesh nodes to establish peer topology.',
    };
  }

  // 1. SIGNAL STRENGTH (RSSI) AGGREGATION
  const sumRssi = peers.reduce((acc, p) => acc + (p.lastRssi || -70), 0);
  const avgRssiDbm = Math.round(sumRssi / peers.length);

  // Map RSSI (-100 dBm to -30 dBm) into 0-100 score
  // -30 dBm or better = 100, -100 dBm or worse = 0
  const rssiScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (Math.abs(avgRssiDbm) - 30) * (100 / 70)))
  );

  let rssiStatusLabel = `${avgRssiDbm} dBm (Weak)`;
  if (avgRssiDbm >= -55) {
    rssiStatusLabel = `Excellent (${avgRssiDbm} dBm)`;
  } else if (avgRssiDbm >= -72) {
    rssiStatusLabel = `Good (${avgRssiDbm} dBm)`;
  } else if (avgRssiDbm >= -85) {
    rssiStatusLabel = `Fair (${avgRssiDbm} dBm)`;
  }

  // 2. PEER LATENCY AGGREGATION
  const diagnosticDetails = calculatePeerDiagnosticDetails(peers);
  const latencies = peers.map((p) => {
    if (diagnosticDetails[p.id]?.rttMs) {
      return diagnosticDetails[p.id].rttMs;
    }
    // Fallback based on hop distance and RSSI
    const baseRtt = p.hopDistance === 1 ? 18 : p.hopDistance === 2 ? 65 : 190;
    return Math.round(baseRtt + (Math.abs(p.lastRssi || -70) - 50) * 0.8);
  });

  const sumLatency = latencies.reduce((acc, lat) => acc + lat, 0);
  const avgLatencyMs = Math.round(sumLatency / peers.length);

  // Map Latency (15 ms to 200 ms) into 0-100 score
  // <= 15 ms = 100, >= 200 ms = 10
  const latencyScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (avgLatencyMs - 15) * (90 / 185)))
  );

  let latencyStatusLabel = `${avgLatencyMs} ms`;
  if (avgLatencyMs <= 25) {
    latencyStatusLabel = `Ultra Low (${avgLatencyMs} ms)`;
  } else if (avgLatencyMs <= 60) {
    latencyStatusLabel = `Low (${avgLatencyMs} ms)`;
  } else if (avgLatencyMs <= 120) {
    latencyStatusLabel = `Moderate (${avgLatencyMs} ms)`;
  } else {
    latencyStatusLabel = `High Latency (${avgLatencyMs} ms)`;
  }

  // 3. ACTIVE RELAY NODES AGGREGATION
  const relayPeers = peers.filter(
    (p) => !p.isDirect || p.connectionState === 'relayed' || p.hopDistance > 1
  );
  const directPeers = peers.filter((p) => p.isDirect && p.hopDistance === 1);
  const activeRelayCount = relayPeers.length;

  const sumRelayReliability = peers.reduce(
    (acc, p) => acc + (p.relayReliability || 95),
    0
  );
  const avgRelayReliability = Number(
    (sumRelayReliability / peers.length).toFixed(1)
  );

  // Relay score logic: multi-hop relay availability + high relay reliability
  const relayCountFactor = activeRelayCount > 0 ? Math.min(100, 50 + activeRelayCount * 25) : 45;
  const relayScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(relayCountFactor * 0.5 + avgRelayReliability * 0.5)
    )
  );

  let relayStatusLabel = `${activeRelayCount} Relay ${activeRelayCount === 1 ? 'Node' : 'Nodes'} (${avgRelayReliability}%)`;
  if (activeRelayCount === 0) {
    relayStatusLabel = `Direct Mesh Only (${directPeers.length} Direct)`;
  }

  // 4. WEIGHTED COMPOSITE MESH HEALTH SCORE
  // Weights: 35% Signal Strength (RSSI), 35% Peer Latency (RTT), 30% Active Relays
  const overallScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(rssiScore * 0.35 + latencyScore * 0.35 + relayScore * 0.30)
    )
  );

  // 5. STATUS BADGE & COLORING
  let statusLabel = 'Optimal Mesh Health';
  let statusBadgeColor = 'bg-[#10B981]/20 text-[#065F46] dark:text-[#34D399] border-[#10B981]/40';
  let statusBorderColor = 'border-[#10B981]/40';

  if (overallScore >= 90) {
    statusLabel = 'Optimal Mesh Health';
    statusBadgeColor = 'bg-[#2A9D8F]/20 text-[#2A9D8F] dark:text-[#38BDF8] border-[#2A9D8F]/40';
    statusBorderColor = 'border-[#2A9D8F]/40';
  } else if (overallScore >= 75) {
    statusLabel = 'Strong Mesh Health';
    statusBadgeColor = 'bg-[#87A878]/25 text-[#203A2A] dark:text-[#A8BDA5] border-[#87A878]/50';
    statusBorderColor = 'border-[#87A878]/40';
  } else if (overallScore >= 55) {
    statusLabel = 'Moderate Mesh Health';
    statusBadgeColor = 'bg-[#F4A261]/20 text-[#B45309] dark:text-[#FDBA74] border-[#F4A261]/40';
    statusBorderColor = 'border-[#F4A261]/40';
  } else {
    statusLabel = 'Degraded Mesh Health';
    statusBadgeColor = 'bg-[#E76F51]/20 text-[#991B1B] dark:text-[#FCA5A5] border-[#E76F51]/40';
    statusBorderColor = 'border-[#E76F51]/40';
  }

  // 6. ACTIONABLE RECOMMENDATION
  let recommendation = 'Mesh network link budget and relay propagation are optimal.';
  if (rssiScore < 60) {
    recommendation = `Average signal strength is low (${avgRssiDbm} dBm). Move closer to central nodes or deploy a LoRa repeater.`;
  } else if (latencyScore < 60) {
    recommendation = `High peer ping latency (${avgLatencyMs} ms). Multi-hop routing overhead detected.`;
  } else if (activeRelayCount === 0) {
    recommendation = `No active relay nodes in mesh. Enable store-and-forward relay mode on battery nodes to expand coverage.`;
  }

  return {
    overallScore,
    statusLabel,
    statusBadgeColor,
    statusBorderColor,
    rssiScore,
    avgRssiDbm,
    rssiStatusLabel,
    latencyScore,
    avgLatencyMs,
    latencyStatusLabel,
    relayScore,
    activeRelayCount,
    directPeerCount: directPeers.length,
    totalPeersCount: peers.length,
    avgRelayReliability,
    relayStatusLabel,
    recommendation,
  };
}
