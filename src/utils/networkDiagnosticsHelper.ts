import {
  MeshNode,
  MeshPacketLog,
  MeshChannelTelemetry,
  NodeTracerouteHop,
  NodeDiagnosticDetail,
  MeshFrameType,
  BatteryManagerStatus,
} from '../types';

export const INITIAL_CHANNEL_TELEMETRY: MeshChannelTelemetry[] = [
  {
    channelId: 'ble_adv_37',
    name: 'BLE Ch 37 (Adv Primary)',
    frequencyMhz: 2402,
    protocol: 'BLE 5.0 Coded PHY',
    utilizationPercent: 18.4,
    noiseFloorDbm: -102,
    txDutyCyclePercent: 0.42,
    activePacketsCount: 142,
  },
  {
    channelId: 'ble_adv_38',
    name: 'BLE Ch 38 (Discovery)',
    frequencyMhz: 2426,
    protocol: 'BLE 5.0 Coded PHY',
    utilizationPercent: 22.1,
    noiseFloorDbm: -104,
    txDutyCyclePercent: 0.51,
    activePacketsCount: 189,
  },
  {
    channelId: 'ble_adv_39',
    name: 'BLE Ch 39 (Sync & Bloom)',
    frequencyMhz: 2480,
    protocol: 'BLE 5.0 Coded PHY',
    utilizationPercent: 14.8,
    noiseFloorDbm: -106,
    txDutyCyclePercent: 0.35,
    activePacketsCount: 96,
  },
  {
    channelId: 'wifi_p2p_ch6',
    name: 'Wi-Fi Direct P2P (High-BW)',
    frequencyMhz: 2437,
    protocol: 'Wi-Fi Direct P2P',
    utilizationPercent: 31.5,
    noiseFloorDbm: -98,
    txDutyCyclePercent: 0.12,
    activePacketsCount: 38,
  },
  {
    channelId: 'lora_eu868_ch0',
    name: 'LoRa 868.1 MHz (LongFast SF11)',
    frequencyMhz: 868.1,
    protocol: 'LoRa LongFast 868MHz',
    utilizationPercent: 8.2,
    noiseFloorDbm: -118,
    txDutyCyclePercent: 0.88,
    activePacketsCount: 24,
    isThrottled: false,
  },
];

export const INITIAL_PACKET_LOGS: MeshPacketLog[] = [
  {
    id: 'pkt-101',
    timestamp: Date.now() - 1200,
    frameType: 'BEACON_ADV',
    sourceCallsign: 'Fern-Weaver',
    sourceNodeId: '!9f42e12a',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 1,
    maxHops: 3,
    rssi: -48,
    snr: 9.2,
    payloadBytes: 42,
    payloadSummary: 'BLE Beacon: 4 resources offered (BloomFilter: 0x8a2f...)',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"type":"BEACON","bloom":"0x8a2f91","nodes":4,"ver":"2.4"}',
  },
  {
    id: 'pkt-102',
    timestamp: Date.now() - 3400,
    frameType: 'DIRECT_MSG',
    sourceCallsign: 'Sol-Spark',
    sourceNodeId: '!8b11c402',
    destCallsign: 'Kestrel-7',
    destNodeId: '!usr_kestrel_7',
    hopCount: 1,
    maxHops: 4,
    rssi: -58,
    snr: 7.8,
    payloadBytes: 128,
    payloadSummary: 'ChaCha20-Poly1305 Encrypted DM frame (Ciphertext: a8f4...91)',
    crcValid: true,
    encrypted: true,
    rawPayloadJson: '{"alg":"ChaCha20-Poly1305","nonce":"9b0f12","tag":"88aa"}',
  },
  {
    id: 'pkt-103',
    timestamp: Date.now() - 6200,
    frameType: 'STORE_FORWARD_BUNDLE',
    sourceCallsign: 'Spore-Walker',
    sourceNodeId: '!1a44e990',
    destCallsign: 'River-Oak',
    destNodeId: '!7c992144',
    hopCount: 3,
    maxHops: 5,
    rssi: -86,
    snr: 2.1,
    payloadBytes: 256,
    payloadSummary: 'Epidemic DTN Bundle #4812 (Custody Ack requested, TTL: 48h)',
    crcValid: true,
    encrypted: true,
    rawPayloadJson: '{"bundleId":"bnd-4812","ttl_hours":48,"custody_relay":"River-Oak"}',
  },
  {
    id: 'pkt-104',
    timestamp: Date.now() - 8900,
    frameType: 'CRDT_SYNC',
    sourceCallsign: 'River-Oak',
    sourceNodeId: '!7c992144',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 2,
    maxHops: 3,
    rssi: -74,
    snr: 5.4,
    payloadBytes: 194,
    payloadSummary: 'DAO Proposal & Journal Vector Clock Exchange (Clock: [4, 12, 9])',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"crdt_delta":"proposal_vote","vector_clock":[4,12,9],"quorum":200}',
  },
  {
    id: 'pkt-105',
    timestamp: Date.now() - 11400,
    frameType: 'ROUTE_REP',
    sourceCallsign: 'Clay-Root',
    sourceNodeId: '!3d55ab19',
    destCallsign: 'Kestrel-7',
    destNodeId: '!usr_kestrel_7',
    hopCount: 2,
    maxHops: 4,
    rssi: -79,
    snr: 4.1,
    payloadBytes: 64,
    payloadSummary: 'Route Reply: Path via [River-Oak -> Clay-Root] Metric: 124',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"path":["!usr_kestrel_7","!7c992144","!3d55ab19"],"cost":124}',
  },
  {
    id: 'pkt-106',
    timestamp: Date.now() - 14800,
    frameType: 'TELEMETRY',
    sourceCallsign: 'Fern-Weaver',
    sourceNodeId: '!9f42e12a',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 1,
    maxHops: 2,
    rssi: -48,
    snr: 9.6,
    payloadBytes: 36,
    payloadSummary: 'Telemetry Beat: Solar 14.2W, Bat 94%, Queue 2 bundles, Airtime 0.4%',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"solar_w":14.2,"batt_pct":94,"queue":2,"airtime_pct":0.4}',
  },
  {
    id: 'pkt-107',
    timestamp: Date.now() - 32000,
    frameType: 'CRDT_SYNC',
    sourceCallsign: 'Pine-Tower',
    sourceNodeId: '!6e2210af',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 1,
    maxHops: 3,
    rssi: -62,
    snr: 7.9,
    payloadBytes: 412,
    payloadSummary: 'Skills & Tool Exchange delta sync (Clock: [6, 14, 11])',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"crdt_delta":"skills_tools","vector_clock":[6,14,11],"items":5}',
  },
  {
    id: 'pkt-108',
    timestamp: Date.now() - 78000,
    frameType: 'CRDT_SYNC',
    sourceCallsign: 'Clay-Root',
    sourceNodeId: '!3d55ab19',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 2,
    maxHops: 4,
    rssi: -71,
    snr: 6.1,
    payloadBytes: 628,
    payloadSummary: 'Care & Housing availability vector sync (Clock: [8, 14, 12])',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"crdt_delta":"care_housing","vector_clock":[8,14,12],"items":3}',
  },
  {
    id: 'pkt-109',
    timestamp: Date.now() - 145000,
    frameType: 'CRDT_SYNC',
    sourceCallsign: 'Spruce-Relay',
    sourceNodeId: '!4a88bc31',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 1,
    maxHops: 3,
    rssi: -58,
    snr: 8.8,
    payloadBytes: 1180,
    payloadSummary: 'Bioregional seed-bank & emergency energy inventory sync',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"crdt_delta":"seed_energy_catalog","vector_clock":[9,15,14],"items":12}',
  },
  {
    id: 'pkt-110',
    timestamp: Date.now() - 310000,
    frameType: 'CRDT_SYNC',
    sourceCallsign: 'Fern-Weaver',
    sourceNodeId: '!9f42e12a',
    destCallsign: 'BROADCAST',
    destNodeId: '!ffffffff',
    hopCount: 1,
    maxHops: 3,
    rssi: -50,
    snr: 9.4,
    payloadBytes: 348,
    payloadSummary: 'Electronics & radio frequency topology catalog sync',
    crcValid: true,
    encrypted: false,
    rawPayloadJson: '{"crdt_delta":"electronics_rf","vector_clock":[10,16,14],"items":4}',
  },
];

/**
 * Generates synthetic diagnostic details for peers based on their link parameters
 */
export function calculatePeerDiagnosticDetails(peers: MeshNode[]): Record<string, NodeDiagnosticDetail> {
  const details: Record<string, NodeDiagnosticDetail> = {};

  peers.forEach((peer, idx) => {
    // Base calculations on RSSI and hop distance
    const rssi = peer.lastRssi || -70;
    // LQI: -40 dBm -> ~245, -95 dBm -> ~60
    const lqi = Math.max(40, Math.min(255, Math.round(255 - (Math.abs(rssi) - 40) * 3.6)));
    
    // Packet Delivery Ratio (PDR)
    const pdrPercent = peer.isDirect 
      ? Math.max(94.0, Math.min(99.8, 100 - (Math.abs(rssi) - 40) * 0.12))
      : Math.max(82.0, Math.min(95.0, 96 - peer.hopDistance * 4.5));

    // Latency RTT (ms)
    const baseRtt = peer.hopDistance === 1 ? 18 : peer.hopDistance === 2 ? 65 : 190;
    const rttMs = Math.round(baseRtt + (Math.abs(rssi) - 50) * 0.8 + (idx % 3) * 4);
    const jitterMs = Math.round(peer.hopDistance === 1 ? 2.8 : peer.hopDistance * 7.5);

    // Packets Tx/Rx
    const baseCount = (peer.completedExchanges + 12) * 18;
    const txPackets = baseCount + (idx + 1) * 37;
    const rxPackets = Math.round(txPackets * (pdrPercent / 100));
    const droppedPackets = txPackets - rxPackets;

    // SNR in dB
    const snrDb = Number(((Math.abs(rssi) < 60 ? 10 : 3) + (100 - Math.abs(rssi)) * 0.15).toFixed(1));

    // Simulated MAC / Node ID
    const macPrefix = '9F:42:C8';
    const macSuffix = `${(idx * 17 + 10).toString(16).toUpperCase().padStart(2, '0')}:${(idx * 23 + 44).toString(16).toUpperCase().padStart(2, '0')}:${(idx * 31 + 88).toString(16).toUpperCase().padStart(2, '0')}`;

    details[peer.id] = {
      peerId: peer.id,
      lqi,
      pdrPercent: Number(pdrPercent.toFixed(1)),
      rttMs,
      jitterMs,
      txPackets,
      rxPackets,
      droppedPackets,
      snrDb,
      batteryVolts: Number((3.7 + (peer.trustScore / 100) * 0.45).toFixed(2)),
      airtimeSecs: Number(((txPackets * 0.012) + (idx * 0.8)).toFixed(1)),
      bufferQueueCount: peer.hopDistance > 1 ? (idx % 4) + 1 : 0,
      macAddress: `${macPrefix}:${macSuffix}`,
    };
  });

  return details;
}

/**
 * Calculates a multi-hop traceroute path for a given target peer
 */
export function calculateTraceroutePath(
  targetPeer: MeshNode,
  allPeers: MeshNode[],
  userCallsign: string
): NodeTracerouteHop[] {
  const hops: NodeTracerouteHop[] = [];

  // Hop 0: Local User Node
  hops.push({
    hopIndex: 0,
    nodeId: '!local_kestrel',
    callsign: userCallsign || 'Kestrel-7 (Self)',
    rssi: 0,
    latencyMs: 0,
    radioMedium: 'Local System Loopback',
    linkQualityScore: 100,
  });

  if (targetPeer.hopDistance === 1) {
    // Direct Hop
    hops.push({
      hopIndex: 1,
      nodeId: `!${targetPeer.id.slice(0, 8)}`,
      callsign: targetPeer.callsign,
      rssi: targetPeer.lastRssi,
      latencyMs: Math.round(18 + Math.abs(targetPeer.lastRssi + 50) * 0.4),
      radioMedium: 'BLE 5.0 Coded PHY (Direct)',
      linkQualityScore: Math.round(Math.max(60, 100 - (Math.abs(targetPeer.lastRssi) - 40) * 0.9)),
    });
  } else if (targetPeer.hopDistance === 2) {
    // 2-Hop Relay via direct peer
    const directRelay = allPeers.find((p) => p.isDirect) || allPeers[0];
    hops.push({
      hopIndex: 1,
      nodeId: `!${directRelay.id.slice(0, 8)}`,
      callsign: `${directRelay.callsign} [Relay Node]`,
      rssi: directRelay.lastRssi,
      latencyMs: 24,
      radioMedium: 'BLE 5.0 Coded PHY',
      linkQualityScore: 95,
    });

    hops.push({
      hopIndex: 2,
      nodeId: `!${targetPeer.id.slice(0, 8)}`,
      callsign: targetPeer.callsign,
      rssi: targetPeer.lastRssi,
      latencyMs: Math.round(72 + Math.abs(targetPeer.lastRssi + 60) * 0.6),
      radioMedium: 'Wi-Fi Direct / BLE Relay',
      linkQualityScore: Math.round(Math.max(45, 88 - (Math.abs(targetPeer.lastRssi) - 50) * 0.8)),
    });
  } else {
    // 3+ Hops Store-and-Forward DTN
    const directRelay = allPeers.find((p) => p.isDirect) || allPeers[0];
    const secondaryRelay = allPeers.find((p) => p.hopDistance === 2) || allPeers[1] || directRelay;

    hops.push({
      hopIndex: 1,
      nodeId: `!${directRelay.id.slice(0, 8)}`,
      callsign: `${directRelay.callsign} [Primary Relay]`,
      rssi: directRelay.lastRssi,
      latencyMs: 22,
      radioMedium: 'BLE 5.0 Coded PHY',
      linkQualityScore: 94,
    });

    hops.push({
      hopIndex: 2,
      nodeId: `!${secondaryRelay.id.slice(0, 8)}`,
      callsign: `${secondaryRelay.callsign} [Transit Custody]`,
      rssi: -72,
      latencyMs: 84,
      radioMedium: 'LoRa 868MHz Mesh Link',
      linkQualityScore: 78,
    });

    hops.push({
      hopIndex: 3,
      nodeId: `!${targetPeer.id.slice(0, 8)}`,
      callsign: `${targetPeer.callsign} [Destination]`,
      rssi: targetPeer.lastRssi,
      latencyMs: 215,
      radioMedium: 'Store-and-Forward DTN Bundle',
      linkQualityScore: 62,
    });
  }

  return hops;
}

/**
 * Free Space Path Loss (FSPL) calculator for RF Link Budget Diagnostics
 * Formula: FSPL(dB) = 20*log10(d) + 20*log10(f) + 20*log10(4*pi / c)
 */
export function calculateLinkBudget(
  frequencyMhz: number,
  distanceMeters: number,
  txPowerDbm: number = 8,
  rxSensitivityDbm: number = -98
): {
  fsplDb: number;
  expectedRssiDbm: number;
  linkMarginDb: number;
  qualityAssessment: 'Excellent' | 'Good' | 'Marginal' | 'Unreliable';
} {
  const dKm = Math.max(0.005, distanceMeters / 1000);
  const fsplDb = Math.round(20 * Math.log10(dKm) + 20 * Math.log10(frequencyMhz) + 32.44);
  const expectedRssiDbm = txPowerDbm - fsplDb;
  const linkMarginDb = expectedRssiDbm - rxSensitivityDbm;

  let qualityAssessment: 'Excellent' | 'Good' | 'Marginal' | 'Unreliable' = 'Good';
  if (linkMarginDb >= 20) qualityAssessment = 'Excellent';
  else if (linkMarginDb >= 10) qualityAssessment = 'Good';
  else if (linkMarginDb >= 3) qualityAssessment = 'Marginal';
  else qualityAssessment = 'Unreliable';

  return {
    fsplDb,
    expectedRssiDbm,
    linkMarginDb,
    qualityAssessment,
  };
}

/**
 * Generates an exported markdown/JSON diagnostic report
 */
export function generateDiagnosticReport(
  peers: MeshNode[],
  batteryStatus: BatteryManagerStatus,
  userCallsign: string,
  channels: MeshChannelTelemetry[],
  logs: MeshPacketLog[]
): string {
  const dateStr = new Date().toISOString();
  const directCount = peers.filter((p) => p.isDirect).length;
  const relayedCount = peers.filter((p) => p.hopDistance === 2).length;
  const dtnCount = peers.filter((p) => p.hopDistance >= 3).length;

  const report = {
    reportTitle: 'HÕIMU Zero-Cloud Bioregional Mesh Network Diagnostics',
    generatedAt: dateStr,
    device: {
      callsign: userCallsign || 'Kestrel-7',
      nodeId: '!usr_kestrel_7',
      bioregion: 'Cascadia-44N',
      batteryReserve: `${batteryStatus.batteryLevelPercent}%`,
      solarHarvestActiveW: batteryStatus.solarHarvestRateW,
      solarAwareThrottled: batteryStatus.isSolarAwareActive,
      radarRefreshHz: batteryStatus.radarRefreshRateHz,
    },
    topology: {
      totalPeersReachable: peers.length,
      directHops: directCount,
      relayedHops: relayedCount,
      storeAndForwardHops: dtnCount,
      averageRssiDbm: Math.round(peers.reduce((acc, p) => acc + p.lastRssi, 0) / (peers.length || 1)),
    },
    rfChannels: channels.map((c) => ({
      channel: c.name,
      protocol: c.protocol,
      utilization: `${c.utilizationPercent}%`,
      noiseFloor: `${c.noiseFloorDbm} dBm`,
      dutyCycle: `${c.txDutyCyclePercent}%`,
    })),
    discoveredPeers: peers.map((p) => ({
      callsign: p.callsign,
      hopDistance: p.hopDistance,
      rssi: `${p.lastRssi} dBm`,
      trustScore: p.trustScore,
      relayReliability: `${p.relayReliability}%`,
      lastSeen: p.lastSeen,
      connectionMode: p.connectionState,
    })),
    recentWireFrameCount: logs.length,
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generates a clean, comprehensive CSV file of signal strength and latency data
 * for troubleshooting local mesh connectivity issues offline.
 */
export function generateDiagnosticCsvExport(
  peers: MeshNode[],
  batteryStatus: BatteryManagerStatus,
  userCallsign: string,
  channels: MeshChannelTelemetry[],
  logs: MeshPacketLog[]
): string {
  const dateStr = new Date().toISOString();
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];

  // Metadata Header Block
  rows.push('# HÕIMU BIOREGIONAL MESH NETWORK DIAGNOSTIC & RF TELEMETRY EXPORT');
  rows.push(`# Generated At: ${dateStr}`);
  rows.push(`# Device Callsign: ${userCallsign}`);
  rows.push(`# Battery Reserve: ${batteryStatus.batteryLevelPercent}% (Solar Aware Mode: ${batteryStatus.isSolarAwareActive ? 'Active' : 'Standby'})`);
  rows.push(`# Total Discovered Nodes: ${peers.length}`);
  rows.push('');

  // 1. SIGNAL STRENGTH & LATENCY BY PEER NODE
  rows.push('=== SECTION 1: MESH NODE SIGNAL STRENGTH & LATENCY TELEMETRY ===');
  const nodeHeaders = [
    'Node ID',
    'Callsign',
    'Connection State',
    'Direct Link',
    'Hop Distance',
    'RSSI (dBm)',
    'Est SNR (dB)',
    'Est Latency (ms)',
    'Est Jitter (ms)',
    'Packet Loss (%)',
    'Relay Reliability (%)',
    'Signal Quality (%)',
    'Link Budget Margin (dB)',
    'Radio Protocol',
    'Channel / Frequency',
    'Trust Score (%)',
    'Last Seen',
  ];
  rows.push(nodeHeaders.map(escapeCsv).join(','));

  peers.forEach((p) => {
    const details = calculatePeerDiagnosticDetails([p])[0];
    const estSnr = (Math.max(1, 10 - p.hopDistance * 2.2 + (p.lastRssi + 80) * 0.15)).toFixed(1);
    const estLatency = Math.round(24 + p.hopDistance * 28 + Math.abs(p.lastRssi + 60) * 0.4);
    const estJitter = (2.2 + p.hopDistance * 1.5).toFixed(1);
    const packetLoss = p.hopDistance === 1 ? '0.8%' : p.hopDistance === 2 ? '2.4%' : '6.5%';
    const signalQuality = Math.max(10, Math.min(100, Math.round(100 - (Math.abs(p.lastRssi) - 30) * 1.1)));
    const linkMargin = Math.round(p.lastRssi - -98);

    rows.push(
      [
        p.id,
        p.callsign,
        p.connectionState,
        p.isDirect ? 'TRUE' : 'FALSE',
        p.hopDistance,
        p.lastRssi,
        estSnr,
        estLatency,
        estJitter,
        packetLoss,
        `${p.relayReliability}%`,
        `${signalQuality}%`,
        linkMargin,
        p.radioType || 'BLE 5.0 Coded PHY',
        p.channelOrFrequency || 'BLE Adv Ch 37',
        p.trustScore,
        p.lastSeen,
      ]
        .map(escapeCsv)
        .join(',')
    );
  });
  rows.push('');

  // 2. RF SPECTRUM CHANNELS
  rows.push('=== SECTION 2: RF CHANNEL SPECTRUM UTILIZATION ===');
  const channelHeaders = [
    'Channel ID',
    'Channel Name',
    'Frequency (MHz)',
    'Protocol Standard',
    'Channel Utilization (%)',
    'Noise Floor (dBm)',
    'TX Duty Cycle (%)',
    'Active Frames Count',
  ];
  rows.push(channelHeaders.map(escapeCsv).join(','));

  channels.forEach((c) => {
    rows.push(
      [
        c.channelId,
        c.name,
        c.frequencyMhz,
        c.protocol,
        `${c.utilizationPercent}%`,
        `${c.noiseFloorDbm} dBm`,
        `${c.txDutyCyclePercent}%`,
        c.activePacketsCount,
      ]
        .map(escapeCsv)
        .join(',')
    );
  });
  rows.push('');

  // 3. WIRE LOG & PACKET TRANSMISSIONS
  rows.push('=== SECTION 3: RECENT WIRE TRANSMISSION PACKET LOGS ===');
  const logHeaders = [
    'Packet ID',
    'Timestamp (ISO)',
    'Frame Type',
    'Source Callsign',
    'Source Node ID',
    'Dest Callsign',
    'Dest Node ID',
    'Hop Count',
    'RSSI (dBm)',
    'SNR (dB)',
    'CRC Valid',
    'Encrypted',
    'Payload Bytes',
    'Payload Summary',
  ];
  rows.push(logHeaders.map(escapeCsv).join(','));

  logs.forEach((pkt) => {
    rows.push(
      [
        pkt.id,
        new Date(pkt.timestamp).toISOString(),
        pkt.frameType,
        pkt.sourceCallsign,
        pkt.sourceNodeId,
        pkt.destCallsign,
        pkt.destNodeId,
        pkt.hopCount,
        pkt.rssi,
        pkt.snr,
        pkt.crcValid ? 'VALID' : 'CORRUPT',
        pkt.encrypted ? 'AES-GCM-256' : 'PLAINTEXT',
        pkt.payloadBytes,
        pkt.payloadSummary,
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  return rows.join('\r\n');
}

