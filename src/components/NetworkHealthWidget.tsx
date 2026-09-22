import React, { useState } from 'react';
import { MeshNode } from '../types';
import { calculateMeshHealthScore, MeshHealthMetrics } from '../utils/meshHealthCalculator';
import {
  Activity,
  Radio,
  Users,
  Wifi,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Info,
  Zap,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface NetworkHealthWidgetProps {
  peers: MeshNode[];
  isNightMode?: boolean;
  className?: string;
  onOpenDiagnostics?: () => void;
}

export const NetworkHealthWidget: React.FC<NetworkHealthWidgetProps> = ({
  peers,
  isNightMode = false,
  className = '',
  onOpenDiagnostics,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const health: MeshHealthMetrics = calculateMeshHealthScore(peers);

  // Signal color coding
  const getRssiColor = (rssi: number) => {
    if (rssi >= -60) return isNightMode ? 'text-[#34D399]' : 'text-[#10B981]';
    if (rssi >= -75) return isNightMode ? 'text-[#38BDF8]' : 'text-[#2A9D8F]';
    if (rssi >= -85) return isNightMode ? 'text-[#FBBF24]' : 'text-[#D97706]';
    return isNightMode ? 'text-[#F87171]' : 'text-[#E76F51]';
  };

  const getRssiBg = (rssi: number) => {
    if (rssi >= -60) return 'bg-[#10B981]/15 text-[#065F46] dark:text-[#34D399] border-[#10B981]/30';
    if (rssi >= -75) return 'bg-[#2A9D8F]/15 text-[#165B53] dark:text-[#38BDF8] border-[#2A9D8F]/30';
    if (rssi >= -85) return 'bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24] border-[#F59E0B]/30';
    return 'bg-[#E76F51]/15 text-[#991B1B] dark:text-[#F87171] border-[#E76F51]/30';
  };

  return (
    <div
      id="network-health-widget"
      role="region"
      aria-label="Network Health & Node Density Summary"
      className={`relative z-20 transition-all duration-200 rounded-2xl border shadow-md backdrop-blur-md ${
        isNightMode
          ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white/95 border-[#87A878]/35 text-[#203A2A]'
      } ${className}`}
    >
      {/* Compact Header / Summary Bar */}
      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Health Score Pill */}
          <div
            id="mesh-health-score-badge"
            className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs border ${
              health.overallScore >= 75
                ? isNightMode
                  ? 'bg-[#2A9D8F]/25 text-[#38BDF8] border-[#2A9D8F]/40'
                  : 'bg-[#87A878]/25 text-[#203A2A] border-[#87A878]/50'
                : health.overallScore >= 50
                ? isNightMode
                  ? 'bg-[#E9C46A]/20 text-[#FBBF24] border-[#E9C46A]/40'
                  : 'bg-[#E9C46A]/30 text-[#B45309] border-[#E9C46A]/50'
                : isNightMode
                ? 'bg-[#E76F51]/20 text-[#F87171] border-[#E76F51]/40'
                : 'bg-[#E76F51]/20 text-[#991B1B] border-[#E76F51]/40'
            }`}
            title={`Overall Mesh Health: ${health.overallScore}%`}
          >
            <span className="text-[13px] leading-none">{health.overallScore}</span>
            <span className="text-[8px] font-normal opacity-75 leading-none">%</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-xs">Network Health</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${health.statusBadgeColor}`}
              >
                {health.statusLabel.replace(' Mesh Health', '')}
              </span>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-3 text-[11px] font-mono mt-0.5">
              {/* Average RSSI */}
              <div
                id="avg-rssi-display"
                className="flex items-center gap-1"
                title={`Average Mesh Signal Strength: ${health.avgRssiDbm} dBm`}
              >
                <Radio className={`w-3 h-3 ${getRssiColor(health.avgRssiDbm)}`} />
                <span>Avg RSSI:</span>
                <strong className={`font-bold ${getRssiColor(health.avgRssiDbm)}`}>
                  {health.totalPeersCount > 0 ? `${health.avgRssiDbm} dBm` : 'N/A'}
                </strong>
              </div>

              <span className="opacity-30">•</span>

              {/* Node Density */}
              <div
                id="node-density-display"
                className="flex items-center gap-1"
                title={`Node Density: ${health.nodeDensityLabel}`}
              >
                <Users className="w-3 h-3 text-[#588157] dark:text-[#87A878]" />
                <span>Density:</span>
                <strong className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                  {health.totalPeersCount} {health.totalPeersCount === 1 ? 'node' : 'nodes'}
                </strong>
                {health.immediateBleNodesCount > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#588157]/15 text-[#588157] dark:text-[#87A878] font-sans">
                    {health.immediateBleNodesCount} imm.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expand / Minimize Toggle */}
        <div className="flex items-center gap-1">
          <button
            id="toggle-network-health-details"
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setIsExpanded(!isExpanded);
            }}
            aria-expanded={isExpanded}
            aria-controls="network-health-breakdown"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isNightMode
                ? 'hover:bg-[#2A3B26] text-[#A8BDA5]'
                : 'hover:bg-[#FAF6EE] text-[#637062]'
            }`}
            title={isExpanded ? 'Hide Health Breakdown' : 'Show Health Breakdown'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Health & Node Density Breakdown Drawer */}
      {isExpanded && (
        <div
          id="network-health-breakdown"
          className={`px-3.5 pb-3.5 pt-1 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 ${
            isNightMode ? 'border-[#2A3B26]' : 'border-[#87A878]/20'
          }`}
        >
          {/* Sub-Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            {/* 1. RSSI Score Card */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/30'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                <span>Avg Signal</span>
                <Wifi className="w-3 h-3 text-[#2A9D8F]" />
              </div>
              <div className="mt-1">
                <div className={`font-mono font-bold text-sm ${getRssiColor(health.avgRssiDbm)}`}>
                  {health.totalPeersCount > 0 ? `${health.avgRssiDbm} dBm` : '0 dBm'}
                </div>
                <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate">
                  {health.rssiStatusLabel}
                </div>
              </div>
            </div>

            {/* 2. Node Density Breakdown Card */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/30'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                <span>Cluster Density</span>
                <Users className="w-3 h-3 text-[#588157]" />
              </div>
              <div className="mt-1">
                <div className="font-mono font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                  {health.nodeDensityScore}%
                </div>
                <div className="text-[10px] text-[#588157] dark:text-[#87A878] truncate">
                  {health.nodeDensityLabel}
                </div>
              </div>
            </div>

            {/* 3. Latency / RTT Card */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/30'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                <span>Avg Latency</span>
                <Activity className="w-3 h-3 text-[#E9C46A]" />
              </div>
              <div className="mt-1">
                <div className="font-mono font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                  {health.totalPeersCount > 0 ? `${health.avgLatencyMs} ms` : 'N/A'}
                </div>
                <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate">
                  {health.latencyStatusLabel}
                </div>
              </div>
            </div>

            {/* 4. Relay Availability Card */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/30'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                <span>Active Relays</span>
                <Radio className="w-3 h-3 text-[#E76F51]" />
              </div>
              <div className="mt-1">
                <div className="font-mono font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                  {health.activeRelayCount}
                </div>
                <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate">
                  {health.relayStatusLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Node Distribution Breakdown Bar */}
          <div
            className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
              isNightMode ? 'bg-[#182315]/80 border-[#364E30]' : 'bg-white/80 border-[#87A878]/25'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#637062] dark:text-[#A8BDA5]">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#E9C46A]" />
                Topology Distribution
              </span>
              <span className="font-mono text-[10px]">
                {health.totalPeersCount} Active Radio Nodes
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
              <div className="p-1.5 rounded-lg bg-[#588157]/10 text-[#203A2A] dark:text-[#F0F5EE] border border-[#588157]/20">
                <div className="font-bold text-xs text-[#588157] dark:text-[#87A878]">
                  {health.nodesPerHopBreakdown.immediate}
                </div>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Immediate (&gt;-70)</div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#2A9D8F]/10 text-[#203A2A] dark:text-[#F0F5EE] border border-[#2A9D8F]/20">
                <div className="font-bold text-xs text-[#2A9D8F] dark:text-[#38BDF8]">
                  {health.nodesPerHopBreakdown.direct}
                </div>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Direct 1-Hop</div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#E9C46A]/10 text-[#203A2A] dark:text-[#F0F5EE] border border-[#E9C46A]/20">
                <div className="font-bold text-xs text-[#B45309] dark:text-[#FBBF24]">
                  {health.nodesPerHopBreakdown.relayed}
                </div>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Multi-Hop</div>
              </div>
              <div className="p-1.5 rounded-lg bg-[#E76F51]/10 text-[#203A2A] dark:text-[#F0F5EE] border border-[#E76F51]/20">
                <div className="font-bold text-xs text-[#991B1B] dark:text-[#F87171]">
                  {health.nodesPerHopBreakdown.fringe}
                </div>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Fringe (&le;-85)</div>
              </div>
            </div>
          </div>

          {/* Dynamic Mesh Recommendation Banner */}
          <div
            className={`p-2.5 rounded-xl border flex items-start gap-2 text-[11px] leading-relaxed ${
              isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/30'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-[#203A2A] dark:text-[#F0F5EE]">Mesh Advisor: </span>
              <span className="text-[#637062] dark:text-[#A8BDA5]">{health.recommendation}</span>
            </div>
          </div>

          {/* Open Detailed Diagnostics Button */}
          {onOpenDiagnostics && (
            <button
              id="btn-open-diagnostics-from-widget"
              type="button"
              onClick={onOpenDiagnostics}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isNightMode
                  ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#38BDF8]'
                  : 'bg-[#FAF6EE] hover:bg-[#EAE4D6] text-[#203A2A] border border-[#87A878]/30'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Open Detailed RF Spectrum & Diagnostics</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
