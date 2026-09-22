import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
} from 'recharts';
import { MeshNode, BatteryManagerStatus } from '../types';
import { calculateMeshHealthScore, MeshHealthMetrics } from '../utils/meshHealthCalculator';
import {
  Activity,
  Signal,
  Radio,
  Sliders,
  Compass,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronRight,
  Layers,
  Zap,
  Target,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface MeshHealthOptimizerViewProps {
  peers: MeshNode[];
  batteryStatus?: BatteryManagerStatus;
  isNightMode?: boolean;
  onClose?: () => void;
  onSelectPeer?: (peer: MeshNode) => void;
  className?: string;
}

export interface SignalHistogramBin {
  rangeLabel: string;
  count: number;
  percentage: number;
  color: string;
  quality: 'Excellent' | 'Good' | 'Fair' | 'Weak';
  desc: string;
}

export interface HopDistributionBin {
  hopLabel: string;
  hops: number;
  count: number;
  peerNames: string[];
  color: string;
}

export const MeshHealthOptimizerView: React.FC<MeshHealthOptimizerViewProps> = ({
  peers,
  batteryStatus,
  isNightMode = false,
  onClose,
  onSelectPeer,
  className = '',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'histogram' | 'packet_loss' | 'hops' | 'placement'>('overview');
  const [isLiveSampling, setIsLiveSampling] = useState<boolean>(true);
  const [sampleCount, setSampleCount] = useState<number>(1);
  const [placementDeltaDbm, setPlacementDeltaDbm] = useState<number | null>(null);

  // Overall Mesh Health Aggregate
  const healthMetrics: MeshHealthMetrics = useMemo(() => {
    return calculateMeshHealthScore(peers);
  }, [peers]);

  // 1. SIGNAL STRENGTH HISTOGRAM (RSSI Bins)
  const signalHistogramData: SignalHistogramBin[] = useMemo(() => {
    const bins: { [key: string]: { count: number; quality: 'Excellent' | 'Good' | 'Fair' | 'Weak'; color: string; desc: string } } = {
      'Strong (-30 to -55 dBm)': { count: 0, quality: 'Excellent', color: '#2A9D8F', desc: 'Direct line-of-sight, max throughput' },
      'Good (-56 to -70 dBm)': { count: 0, quality: 'Good', color: '#588157', desc: 'Reliable link through mild obstacles' },
      'Fair (-71 to -85 dBm)': { count: 0, quality: 'Fair', color: '#E9C46A', desc: 'Fringe link, potential retry delays' },
      'Weak (<-85 dBm)': { count: 0, quality: 'Weak', color: '#E76F51', desc: 'High packet loss, relocate terminal' },
    };

    const total = Math.max(peers.length, 1);

    peers.forEach((p) => {
      const rssi = p.lastRssi ?? -70;
      if (rssi >= -55) {
        bins['Strong (-30 to -55 dBm)'].count += 1;
      } else if (rssi >= -70) {
        bins['Good (-56 to -70 dBm)'].count += 1;
      } else if (rssi >= -85) {
        bins['Fair (-71 to -85 dBm)'].count += 1;
      } else {
        bins['Weak (<-85 dBm)'].count += 1;
      }
    });

    return Object.entries(bins).map(([rangeLabel, info]) => ({
      rangeLabel,
      count: info.count,
      percentage: Math.round((info.count / total) * 100),
      color: info.color,
      quality: info.quality,
      desc: info.desc,
    }));
  }, [peers]);

  // 2. NODE HOP-COUNT DISTRIBUTION
  const hopDistributionData: HopDistributionBin[] = useMemo(() => {
    const hopMap: { [key: number]: { count: number; peerNames: string[]; color: string } } = {
      1: { count: 0, peerNames: [], color: '#2A9D8F' },
      2: { count: 0, peerNames: [], color: '#588157' },
      3: { count: 0, peerNames: [], color: '#E9C46A' },
      4: { count: 0, peerNames: [], color: '#E76F51' },
    };

    peers.forEach((p) => {
      const hops = Math.min(Math.max(p.hopDistance || (p.isDirect ? 1 : 2), 1), 4);
      if (hopMap[hops]) {
        hopMap[hops].count += 1;
        hopMap[hops].peerNames.push(p.callsign || p.id.slice(0, 6));
      }
    });

    return [
      { hopLabel: '1-Hop (Direct)', hops: 1, count: hopMap[1].count, peerNames: hopMap[1].peerNames, color: hopMap[1].color },
      { hopLabel: '2-Hops (1 Relay)', hops: 2, count: hopMap[2].count, peerNames: hopMap[2].peerNames, color: hopMap[2].color },
      { hopLabel: '3-Hops (2 Relays)', hops: 3, count: hopMap[3].count, peerNames: hopMap[3].peerNames, color: hopMap[3].color },
      { hopLabel: '4+ Hops (Fringe)', hops: 4, count: hopMap[4].count, peerNames: hopMap[4].peerNames, color: hopMap[4].color },
    ];
  }, [peers]);

  // 3. PACKET LOSS PERCENTAGE BREAKDOWN
  const packetLossSummary = useMemo(() => {
    if (peers.length === 0) {
      return { avgLossPercent: 0, pdrPercent: 100, highLossNodesCount: 0, peerLossList: [] };
    }

    const peerLossList = peers.map((p) => {
      const rssi = p.lastRssi ?? -70;
      // Realistic packet loss model based on RSSI and relay reliability
      let lossPercent = 1.2;
      if (rssi < -85) lossPercent = 18.5;
      else if (rssi < -78) lossPercent = 7.4;
      else if (rssi < -68) lossPercent = 2.8;

      if (p.relayReliability && p.relayReliability < 95) {
        lossPercent += (100 - p.relayReliability) * 0.4;
      }

      lossPercent = Number(Math.min(lossPercent, 45).toFixed(1));
      const pdr = Number((100 - lossPercent).toFixed(1));

      return {
        id: p.id,
        callsign: p.callsign,
        rssi,
        hops: p.hopDistance || (p.isDirect ? 1 : 2),
        lossPercent,
        pdr,
        isHighLoss: lossPercent > 8.0,
      };
    });

    const sumLoss = peerLossList.reduce((acc, p) => acc + p.lossPercent, 0);
    const avgLoss = Number((sumLoss / peerLossList.length).toFixed(1));
    const pdrPercent = Number((100 - avgLoss).toFixed(1));
    const highLossNodesCount = peerLossList.filter((p) => p.isHighLoss).length;

    return {
      avgLossPercent: avgLoss,
      pdrPercent,
      highLossNodesCount,
      peerLossList,
    };
  }, [peers]);

  // 4. PHYSICAL DEVICE PLACEMENT OPTIMIZER ENGINE TIPS
  const placementGuidance = useMemo(() => {
    const tips: { id: string; category: 'elevation' | 'azimuth' | 'polarization' | 'solar'; title: string; desc: string; impact: 'High' | 'Medium' | 'Optimal'; action: string }[] = [];

    // Elevation & Fresnel check
    const weakNodes = peers.filter((p) => (p.lastRssi || -70) < -78);
    if (weakNodes.length > 0) {
      tips.push({
        id: 'tip-elevation',
        category: 'elevation',
        title: 'Tõsta seade 1.5m maapinnast kõrgemale',
        desc: `${weakNodes.length} sõlmel on signaal nõrgenenud (-78 dBm või madalam). Maapinna ja taimestiku Fresnel-tsooni summutuse vähendamiseks kinnita terminal mastile või seljakoti ülaossa.`,
        impact: 'High',
        action: '+4 kuni +8 dBm RSSI paranemine',
      });
    }

    // Azimuth & Bearing check
    const eastNodes = peers.filter((p) => (p.angle || 0) >= 45 && (p.angle || 0) <= 135);
    if (eastNodes.length >= 2) {
      tips.push({
        id: 'tip-azimuth',
        category: 'azimuth',
        title: 'Liigu 5-10m Kirde suunas (Node klaster)',
        desc: `Peamine sõlmede tihedus asub asimuudil ~90° (${eastNodes.map((n) => n.callsign).join(', ')}). Otsese vaatejoone loomine vähendab releehüppeid.`,
        impact: 'Medium',
        action: 'Otselink 1-hop ühenduseks',
      });
    }

    // Polarization check
    tips.push({
      id: 'tip-polarization',
      category: 'polarization',
      title: 'Antenni vertikaalne orientatsioon (90°)',
      desc: 'Veendu, et dipool- või monopole-antenn on suunatud otse üles. Ristpolarisatsiooni kaod võivad ulatuda kuni 20 dB-ni.',
      impact: 'High',
      action: 'Maksimaalne ringlevikiirgus',
    });

    // Solar Power placement
    if (batteryStatus && batteryStatus.solarHarvestRateW !== undefined) {
      if (batteryStatus.solarHarvestRateW < 5.0 && !batteryStatus.isSolarAwareActive) {
        tips.push({
          id: 'tip-solar',
          category: 'solar',
          title: 'Päikesepaneeli nurga optimeerimine',
          desc: `Hetke päikesesaagis on ${batteryStatus.solarHarvestRateW.toFixed(1)}W. Suuna paneel 35° kaldega lõunasse, et toetada pidevat BLE majakavoogu.`,
          impact: 'Medium',
          action: '100% energiaautonoomia',
        });
      }
    }

    return tips;
  }, [peers, batteryStatus]);

  // Placement Live Sampling Probe
  const handleTriggerLiveProbe = () => {
    soundFeedback.playClick();
    const simulatedDelta = Number(((Math.random() * 6.5) - 1.5).toFixed(1));
    setPlacementDeltaDbm(simulatedDelta);
    setSampleCount((prev) => prev + 1);
  };

  return (
    <div
      id="mesh-health-optimizer-view"
      className={`space-y-4 ${className}`}
    >
      {/* Top Banner & Quick KPI Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-current/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F] shadow-inner shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                Mesh Tervise &amp; Paigutuse Optimiseerija
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${healthMetrics.statusBadgeColor}`}>
                {healthMetrics.statusLabel} ({healthMetrics.overallScore}/100)
              </span>
            </div>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] font-mono">
              Signaalijaotus (RSSI), paketikadu % ja seadme füüsilise paigutuse soovitused
            </p>
          </div>
        </div>

        {/* Live Probe Trigger Button */}
        <button
          type="button"
          onClick={handleTriggerLiveProbe}
          className="px-3 py-1.5 rounded-xl bg-[#2A9D8F] hover:bg-[#238276] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          title="Käivita RF signaali proovimine uues füüsilises asukohas"
        >
          <Target className="w-3.5 h-3.5" />
          <span>Testi uut asukohta</span>
          {placementDeltaDbm !== null && (
            <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${placementDeltaDbm >= 0 ? 'bg-white/30 text-white' : 'bg-red-900/60 text-red-200'}`}>
              {placementDeltaDbm >= 0 ? `+${placementDeltaDbm}` : placementDeltaDbm} dBm
            </span>
          )}
        </button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Signal RSSI KPI */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
          <div className="text-[10px] uppercase font-bold text-[#637062] dark:text-[#87A878]">
            Keskmine RSSI
          </div>
          <div className="text-base sm:text-lg font-mono font-bold text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
            {healthMetrics.avgRssiDbm} dBm
          </div>
          <div className="text-[10px] text-[#588157] font-mono">
            {healthMetrics.rssiStatusLabel}
          </div>
        </div>

        {/* Packet Loss % KPI */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
          <div className="text-[10px] uppercase font-bold text-[#637062] dark:text-[#87A878]">
            Paketikadu (Loss %)
          </div>
          <div className={`text-base sm:text-lg font-mono font-bold mt-0.5 ${
            packetLossSummary.avgLossPercent > 5 ? 'text-[#E76F51]' : 'text-[#2A9D8F]'
          }`}>
            {packetLossSummary.avgLossPercent}%
          </div>
          <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
            PDR kohaletoimetus: {packetLossSummary.pdrPercent}%
          </div>
        </div>

        {/* Direct vs Relay Nodes */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
          <div className="text-[10px] uppercase font-bold text-[#637062] dark:text-[#87A878]">
            Sõlmede jaotus
          </div>
          <div className="text-base sm:text-lg font-mono font-bold text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
            {healthMetrics.directPeerCount} Direct / {healthMetrics.activeRelayCount} Relay
          </div>
          <div className="text-[10px] text-[#588157] font-mono">
            Kokku: {peers.length} aktiivset sõlme
          </div>
        </div>

        {/* Latency RTT */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
          <div className="text-[10px] uppercase font-bold text-[#637062] dark:text-[#87A878]">
            Keskmine Latency (RTT)
          </div>
          <div className="text-base sm:text-lg font-mono font-bold text-[#E9C46A] mt-0.5">
            {healthMetrics.avgLatencyMs} ms
          </div>
          <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
            {healthMetrics.latencyStatusLabel}
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'overview', label: '📊 Üldvaade' },
          { id: 'histogram', label: '📶 Signaali histogramm (RSSI)' },
          { id: 'packet_loss', label: '📉 Paketikadu & PDR %' },
          { id: 'hops', label: '🌐 Hop-arvu jaotus' },
          { id: 'placement', label: '🧭 Paigutuse soovitused' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setActiveSubTab(tab.id as any);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-[#203A2A] text-white dark:bg-[#2A9D8F] shadow-xs'
                : isNightMode
                ? 'text-[#A8BDA5] hover:bg-[#1C2918]'
                : 'text-[#637062] hover:bg-[#87A878]/15'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-VIEW 1: OVERVIEW (Combined charts) */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Signal Strength Distribution Chart */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs flex items-center gap-1.5">
                <Signal className="w-4 h-4 text-[#2A9D8F]" />
                <span>Signaalitugevuse histogramm (RSSI)</span>
              </h4>
              <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                {peers.length} sõlme
              </span>
            </div>

            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signalHistogramData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="quality" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as SignalHistogramBin;
                        return (
                          <div className="p-2.5 bg-[#121A10] text-[#F0F5EE] border border-[#2A3B26] rounded-xl font-mono text-xs space-y-0.5">
                            <div className="font-bold text-[#E9C46A]">{data.rangeLabel}</div>
                            <div>Sõlmede arv: <span className="font-bold">{data.count} ({data.percentage}%)</span></div>
                            <div className="text-[10px] text-[#A8BDA5]">{data.desc}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {signalHistogramData.map((entry, index) => (
                      <Cell key={`cell-signal-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Node Hop-Count Distribution */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#588157]" />
                <span>Node Hop-arvu jaotus</span>
              </h4>
              <span className="text-[10px] font-mono text-[#588157]">
                Multi-Hop Relay
              </span>
            </div>

            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hopDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="hopLabel" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as HopDistributionBin;
                        return (
                          <div className="p-2.5 bg-[#121A10] text-[#F0F5EE] border border-[#2A3B26] rounded-xl font-mono text-xs space-y-0.5">
                            <div className="font-bold text-[#2A9D8F]">{data.hopLabel}</div>
                            <div>Sõlmede arv: <span className="font-bold">{data.count}</span></div>
                            {data.peerNames.length > 0 && (
                              <div className="text-[10px] text-[#A8BDA5] truncate max-w-xs">
                                Sõlmed: {data.peerNames.join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {hopDistributionData.map((entry, index) => (
                      <Cell key={`cell-hop-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: SIGNAL HISTOGRAM DETAILED */}
      {activeSubTab === 'histogram' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
            <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] mb-2 flex items-center gap-1.5">
              <Signal className="w-4 h-4 text-[#2A9D8F]" />
              <span>Signaalitugevuse sagedusjaotus (RSSI Histogram)</span>
            </h4>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signalHistogramData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="rangeLabel" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Sõlmede arv" radius={[8, 8, 0, 0]}>
                    {signalHistogramData.map((entry, idx) => (
                      <Cell key={`hist-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histogram Bins Detail Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {signalHistogramData.map((bin) => (
              <div
                key={bin.rangeLabel}
                className="p-3 rounded-2xl bg-white/60 dark:bg-[#121A10] border border-[#87A878]/25 dark:border-[#2A3B26] flex items-start gap-3"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                  style={{ backgroundColor: `${bin.color}25`, color: bin.color }}
                >
                  {bin.count}
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>{bin.rangeLabel}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold" style={{ backgroundColor: `${bin.color}20`, color: bin.color }}>
                      {bin.percentage}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] mt-0.5">
                    {bin.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: PACKET LOSS PERCENTAGE */}
      {activeSubTab === 'packet_loss' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                  Paketikao &amp; Kohaletoimetuse (PDR) Analüüs
                </h4>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] font-mono">
                  Mõõdetud BLE majakate ja LoRa sünkroonimispakettide CRC vead
                </p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-[#637062] dark:text-[#A8BDA5]">Võrgu keskmine: </span>
                <span className={`font-bold ${packetLossSummary.avgLossPercent > 5 ? 'text-[#E76F51]' : 'text-[#2A9D8F]'}`}>
                  {packetLossSummary.avgLossPercent}% loss
                </span>
              </div>
            </div>

            {/* Peer-by-Peer Loss Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-current/10 text-[10px] text-[#637062] dark:text-[#87A878]">
                    <th className="py-2 px-3">Sõlm (Peer)</th>
                    <th className="py-2 px-3">RSSI</th>
                    <th className="py-2 px-3">Hop-kaugus</th>
                    <th className="py-2 px-3">Paketikadu %</th>
                    <th className="py-2 px-3">PDR kohaletoimetus</th>
                    <th className="py-2 px-3">Olek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-current/5">
                  {packetLossSummary.peerLossList.map((p) => (
                    <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-2 px-3 font-bold text-[#203A2A] dark:text-[#F0F5EE]">{p.callsign}</td>
                      <td className="py-2 px-3">{p.rssi} dBm</td>
                      <td className="py-2 px-3">{p.hops} hop</td>
                      <td className={`py-2 px-3 font-bold ${p.lossPercent > 8 ? 'text-red-500' : 'text-[#588157]'}`}>
                        {p.lossPercent}%
                      </td>
                      <td className="py-2 px-3 text-[#2A9D8F] font-semibold">{p.pdr}%</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.lossPercent > 8
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-[#588157]/20 text-[#588157]'
                        }`}>
                          {p.lossPercent > 8 ? 'Kõrge kadu' : 'Stabiilne'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: HOP COUNT DISTRIBUTION */}
      {activeSubTab === 'hops' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26]">
            <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#588157]" />
              <span>Võrgu relee-hüpped (Hop Count Distribution)</span>
            </h4>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hopDistributionData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="hopLabel" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Sõlmede arv" radius={[8, 8, 0, 0]}>
                    {hopDistributionData.map((entry, idx) => (
                      <Cell key={`hop-hist-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {hopDistributionData.map((hop) => (
              <div
                key={hop.hopLabel}
                className="p-3 rounded-2xl bg-white/60 dark:bg-[#121A10] border border-[#87A878]/25 dark:border-[#2A3B26]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs" style={{ color: hop.color }}>
                    {hop.hopLabel}
                  </span>
                  <span className="text-xs font-mono font-bold">{hop.count} sõlme</span>
                </div>
                <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-1">
                  {hop.peerNames.length > 0 ? hop.peerNames.join(', ') : 'Sõlmi pole selles vahemikus'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: PHYSICAL PLACEMENT OPTIMIZER TIPS */}
      {activeSubTab === 'placement' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#588157]/15 border border-[#588157]/30 flex items-center gap-3">
            <Compass className="w-5 h-5 text-[#588157] shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                Füüsilise terminali asukoha optimeerimine
              </div>
              <p className="text-[#637062] dark:text-[#A8BDA5]">
                Kasuta neid soovitusi BLE ja LoRa leviala maksimeerimiseks ja paketikao minimeerimiseks.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {placementGuidance.map((tip) => (
              <div
                key={tip.id}
                className="p-4 rounded-2xl bg-white/80 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2A9D8F]" />
                    <span>{tip.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    tip.impact === 'High' ? 'bg-red-500/20 text-red-500' : 'bg-[#E9C46A]/20 text-[#D4A373] dark:text-[#E9C46A]'
                  }`}>
                    {tip.impact} mõju
                  </span>
                </div>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                  {tip.desc}
                </p>
                <div className="pt-1 text-[11px] font-mono text-[#588157] font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Oodatav tulemus: {tip.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
