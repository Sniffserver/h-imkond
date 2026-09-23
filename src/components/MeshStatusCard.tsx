import React, { useState, useEffect } from 'react';
import { BatteryManagerStatus, MeshNode } from '../types';
import { calculateMeshHealthScore } from '../utils/meshHealthCalculator';
import { Radio, Sun, Zap, BatteryCharging, RefreshCw, ShieldAlert, Cpu, Activity, Gauge, Signal, Clock, Network, Info, MessageSquare, Check, Wifi, Layers } from 'lucide-react';
import { getUnreadCount, subscribeToMessages } from '../services/comms/messageService';
import { useMeshStore } from '../store/meshStore';
import { simulatePeerSyncPulse } from '../services/mesh/meshSync';
import { BackgroundSyncAdjusterCard } from './BackgroundSyncAdjusterCard';
import { meshTransportManager, TransportManagerStats } from '../services/mesh/transport';

interface MeshStatusCardProps {
  peerCount: number;
  peers?: MeshNode[];
  batteryStatus: BatteryManagerStatus;
  onToggleSolarAware: () => void;
  onRefreshScan: () => void;
  onOpenDiagnostics?: () => void;
  onOpenMessages?: () => void;
  isScanning?: boolean;
}

export const MeshStatusCard: React.FC<MeshStatusCardProps> = ({
  peerCount,
  peers = [],
  batteryStatus,
  onToggleSolarAware,
  onRefreshScan,
  onOpenDiagnostics,
  onOpenMessages,
  isScanning = false,
}) => {
  const healthMetrics = calculateMeshHealthScore(peers);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [transportStats, setTransportStats] = useState<TransportManagerStats | null>(null);
  const lastSyncPulse = useMeshStore((state) => state.lastSyncPulse);
  const isSyncPulsing = Boolean(lastSyncPulse && Date.now() - lastSyncPulse.timestamp < 2600);

  useEffect(() => {
    let isMounted = true;
    const unsubStats = meshTransportManager.subscribeStats((stats) => {
      if (isMounted) setTransportStats(stats);
    });

    return () => {
      isMounted = false;
      unsubStats();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const updateUnread = async () => {
      try {
        const count = await getUnreadCount();
        if (isMounted) setUnreadCount(count);
      } catch {
        // Fallback
      }
    };

    updateUnread();
    const unsubscribe = subscribeToMessages(() => {
      updateUnread();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div
      id="mesh-status-card"
      className="bg-[#F0F5EE] rounded-3xl border border-[#87A878]/35 p-4 sm:p-5 shadow-xs space-y-5"
    >
      {/* Top Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#87A878]/25 flex items-center justify-center text-[#203A2A]">
            <Radio className="w-5 h-5 text-[#588157]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-[#203A2A]">
                {peerCount} Peers Reachable
              </span>
              <span className="text-[10px] font-mono text-[#588157] font-semibold px-2 py-0.5 bg-[#87A878]/20 rounded-full">
                Zero-Cloud
              </span>
            </div>
            <p className="text-xs text-[#637062] font-mono mt-0.5">
              Sync Cadence: {batteryStatus.isSolarAwareActive ? '15m (Solar Throttle)' : '5m (Standard)'}
            </p>
          </div>
        </div>

        {/* Scan & Diagnostics Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Active Data Propagation Sync Pulse Badge */}
          {isSyncPulsing && (
            <span
              id="mesh-sync-pulse-active-badge"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2A9D8F]/20 text-[#2A9D8F] border border-[#2A9D8F]/40 rounded-xl text-xs font-bold shadow-2xs animate-pulse"
              title="Data successfully propagated through mesh network from peer"
            >
              <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Data Propagated: {lastSyncPulse?.callsign || 'Peer'}</span>
            </span>
          )}

          {/* Sync Pulse Trigger Button */}
          <button
            type="button"
            onClick={() => simulatePeerSyncPulse()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A9D8F]/15 hover:bg-[#2A9D8F]/25 text-[#2A9D8F] border border-[#2A9D8F]/30 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Trigger a background sync pulse from a peer node to propagate data"
          >
            <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Sync Pulse</span>
          </button>

          {/* Message Notifications (Red dot when unread > 0) */}
          {unreadCount > 0 && (
            <button
              id="mesh-status-unread-badge"
              type="button"
              onClick={onOpenMessages}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 rounded-xl text-xs font-bold text-red-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title={`${unreadCount} unread encrypted direct messages`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              <MessageSquare className="w-3.5 h-3.5 text-red-600" />
              <span>{unreadCount} Unread {unreadCount === 1 ? 'Message' : 'Messages'}</span>
            </button>
          )}

          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A9D8F]/15 hover:bg-[#2A9D8F]/25 text-[#2A9D8F] border border-[#2A9D8F]/30 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Ava detailne võrgudiagnostika vaade"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Detailne diagnostika</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefreshScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-[#203A2A] border border-[#87A878]/30 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#588157] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Beaconing...' : 'Scan Beacons'}</span>
          </button>
        </div>
      </div>

      {/* MESH HEALTH SCORE SECTION */}
      <div className={`p-4 sm:p-5 rounded-2xl bg-white/90 border shadow-2xs space-y-4 ${healthMetrics.statusBorderColor}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#203A2A] text-[#E9C46A]">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-[#203A2A]">
                  Mesh Health Score
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${healthMetrics.statusBadgeColor}`}>
                  {healthMetrics.statusLabel}
                </span>
              </div>
              <p className="text-[11px] text-[#637062] font-mono">
                Aggregated metric combining signal strength, latency & active relay links
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-1 bg-[#FAF6EE] px-3 py-1.5 rounded-2xl border border-[#87A878]/20">
            <span className="font-display font-bold text-2xl text-[#203A2A]">
              {healthMetrics.overallScore}
            </span>
            <span className="text-xs font-mono font-bold text-[#588157]">/ 100</span>
          </div>
        </div>

        {/* 3 Core Metric Breakdown Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Signal Strength (RSSI) */}
          <div className="p-3 rounded-xl bg-[#FAF6EE]/80 border border-[#87A878]/20 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#203A2A] flex items-center gap-1">
                <Signal className="w-3.5 h-3.5 text-[#2A9D8F]" />
                Signal Strength (RSSI)
              </span>
              <span className="font-mono font-bold text-[#203A2A]">
                {healthMetrics.avgRssiDbm} dBm
              </span>
            </div>
            <div className="w-full bg-[#87A878]/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#2A9D8F] h-full rounded-full transition-all duration-300"
                style={{ width: `${healthMetrics.rssiScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#637062]">
              <span>Score: {healthMetrics.rssiScore}%</span>
              <span className="text-[#2A9D8F] font-semibold">{healthMetrics.rssiStatusLabel}</span>
            </div>
          </div>

          {/* 2. Peer Latency */}
          <div className="p-3 rounded-xl bg-[#FAF6EE]/80 border border-[#87A878]/20 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#203A2A] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#E76F51]" />
                Peer Latency (RTT)
              </span>
              <span className="font-mono font-bold text-[#203A2A]">
                {healthMetrics.avgLatencyMs} ms
              </span>
            </div>
            <div className="w-full bg-[#87A878]/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#E76F51] h-full rounded-full transition-all duration-300"
                style={{ width: `${healthMetrics.latencyScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#637062]">
              <span>Score: {healthMetrics.latencyScore}%</span>
              <span className="text-[#E76F51] font-semibold">{healthMetrics.latencyStatusLabel}</span>
            </div>
          </div>

          {/* 3. Active Relay Nodes */}
          <div className="p-3 rounded-xl bg-[#FAF6EE]/80 border border-[#87A878]/20 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#203A2A] flex items-center gap-1">
                <Network className="w-3.5 h-3.5 text-[#E9C46A]" />
                Active Relays
              </span>
              <span className="font-mono font-bold text-[#203A2A]">
                {healthMetrics.activeRelayCount} / {healthMetrics.totalPeersCount} Nodes
              </span>
            </div>
            <div className="w-full bg-[#87A878]/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#E9C46A] h-full rounded-full transition-all duration-300"
                style={{ width: `${healthMetrics.relayScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#637062]">
              <span>Score: {healthMetrics.relayScore}%</span>
              <span className="text-[#B58A2B] font-semibold truncate">{healthMetrics.relayStatusLabel}</span>
            </div>
          </div>
        </div>

        {/* Recommendation Tip */}
        <div className="flex items-center gap-2 text-xs text-[#588157] font-mono pt-1">
          <Info className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
          <span>{healthMetrics.recommendation}</span>
        </div>
      </div>

      {/* Grid of Key Telemetry Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Mode */}
        <div className="p-3 bg-white/80 rounded-2xl border border-[#87A878]/20 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#637062] flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-[#2A9D8F]" />
            Radio Mode
          </span>
          <span className="font-semibold text-[#203A2A] mt-1 text-xs truncate">
            {batteryStatus.isSolarAwareActive ? 'BLE Beacons Only' : 'BLE + Wi-Fi Direct'}
          </span>
        </div>

        {/* Solar Harvest */}
        <div className="p-3 bg-white/80 rounded-2xl border border-[#87A878]/20 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#637062] flex items-center gap-1">
            <Sun className={`w-3.5 h-3.5 ${batteryStatus.isSolarAwareActive || (batteryStatus.solarHarvestRateW > 0) ? 'text-[#F4A261] animate-spin-slow' : 'text-[#87A878]'}`} />
            Solar Harvest
          </span>
          <span className={`font-mono font-bold mt-1 ${batteryStatus.solarHarvestRateW > 0 ? 'text-[#E76F51]' : 'text-[#637062]'}`}>
            {batteryStatus.solarHarvestRateW > 0 ? `~${batteryStatus.solarHarvestRateW}W Active` : '0W (Paneelid väljas)'}
          </span>
        </div>

        {/* Battery Level */}
        <div className="p-3 bg-white/80 rounded-2xl border border-[#87A878]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#637062] flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-[#588157]" />
              Reserve Power
            </span>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('battery-history-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[9px] font-mono font-bold text-[#2A9D8F] hover:underline cursor-pointer"
              title="Vaata 24h tarbimisgraafikut"
            >
              24h graafik ↓
            </button>
          </div>
          <span className="font-mono font-bold text-[#203A2A] mt-1">
            {batteryStatus.batteryLevelPercent}% Reserve
          </span>
        </div>

        {/* Radar Refresh */}
        <div className="p-3 bg-white/80 rounded-2xl border border-[#87A878]/20 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#637062] flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#E9C46A]" />
            Radar Rate
          </span>
          <span className="font-mono font-semibold text-[#588157] mt-1">
            {batteryStatus.radarRefreshRateHz} Hz Sweep
          </span>
        </div>
      </div>

      {/* Physical & Multi-Bearer Mesh Transports Strip */}
      <div className="p-3 bg-[#FAF6EE]/80 rounded-2xl border border-[#87A878]/25 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#203A2A]">
            <Layers className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Füüsilised Transpordikihid (Mesh Bearers)</span>
          </div>
          <span className="text-[10px] font-mono text-[#588157] font-semibold bg-[#87A878]/15 px-2 py-0.5 rounded-md">
            {transportStats ? `${transportStats.bearers.filter((b) => b.isActive).length}/${transportStats.bearers.length} Aktiivset` : '5 Kihti'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* BLE */}
          <div className="p-2 bg-white/90 rounded-xl border border-[#87A878]/20 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-[#203A2A]">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-[#2A9D8F]" />
                BLE Mesh
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="BLE Raadio aktiivne" />
            </div>
            <div className="text-[10px] text-[#637062] font-mono mt-1 flex justify-between">
              <span>Android / ESP32</span>
              <span className="text-[#2A9D8F] font-bold">2.4 GHz</span>
            </div>
          </div>

          {/* Wi-Fi Aware / Direct */}
          <div className="p-2 bg-white/90 rounded-xl border border-[#87A878]/20 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-[#203A2A]">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-[#588157]" />
                Wi-Fi Direct
              </span>
              <span className={`w-2 h-2 rounded-full ${batteryStatus.isSolarAwareActive ? 'bg-amber-400' : 'bg-emerald-500'}`} title="Wi-Fi P2P" />
            </div>
            <div className="text-[10px] text-[#637062] font-mono mt-1 flex justify-between">
              <span>{batteryStatus.isSolarAwareActive ? 'Puhkeolekus' : 'P2P Kiire'}</span>
              <span className="text-[#588157] font-bold">5 GHz</span>
            </div>
          </div>

          {/* LoRa Bridge */}
          <div className="p-2 bg-white/90 rounded-xl border border-[#87A878]/20 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-[#203A2A]">
              <span className="flex items-center gap-1">
                <Signal className="w-3 h-3 text-[#E76F51]" />
                LoRa 868MHz
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Pi Zero 2 W SX1262 LoRa" />
            </div>
            <div className="text-[10px] text-[#637062] font-mono mt-1 flex justify-between">
              <span>Pi Zero Bridge</span>
              <span className="text-[#E76F51] font-bold">~15 km</span>
            </div>
          </div>

          {/* Multi-Tab Broadcast */}
          <div className="p-2 bg-white/90 rounded-xl border border-[#87A878]/20 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-[#203A2A]">
              <span className="flex items-center gap-1">
                <Network className="w-3 h-3 text-[#B58A2B]" />
                Dev Broadcast
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="BroadcastChannel / LocalStorage" />
            </div>
            <div className="text-[10px] text-[#637062] font-mono mt-1 flex justify-between">
              <span>Multi-Tab Sync</span>
              <span className="text-[#B58A2B] font-bold">Inter-Tab</span>
            </div>
          </div>
        </div>
      </div>

      {/* Solar-Aware Switch Row */}
      <div className="pt-2 border-t border-[#87A878]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FAF6EE]/60 p-3 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${batteryStatus.isSolarAwareActive ? 'bg-[#E9C46A]/30 text-[#8C6207]' : 'bg-[#87A878]/20 text-[#588157]'}`}>
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#203A2A]">
              Solar-Aware Mode: {batteryStatus.isSolarAwareActive ? 'Energy Saver (BLE Only)' : 'Full Mesh Mode'}
            </div>
            <p className="text-[11px] text-[#637062]">
              {batteryStatus.isSolarAwareActive
                ? 'Wi-Fi Direct paused • Background sync at 15m cadence • Radar slowed'
                : 'Full mesh active • High-frequency radio beaconing • 5m sync'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSolarAware}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            batteryStatus.isSolarAwareActive
              ? 'bg-[#E9C46A] text-[#243128] hover:bg-[#dfba5f] shadow-xs'
              : 'bg-[#203A2A] text-white hover:bg-[#16271c]'
          }`}
        >
          {batteryStatus.isSolarAwareActive ? 'Switch to Full Mode' : 'Enable Solar-Saver'}
        </button>
      </div>

      {/* Background Sync Interval Adjuster (<15% Battery Radio Protection) */}
      <BackgroundSyncAdjusterCard />

      {/* Prototype Disclaimer */}
      <div className="text-[11px] text-[#637062] font-mono flex items-center gap-1.5 px-1">
        <ShieldAlert className="w-3.5 h-3.5 text-[#87A878] shrink-0" />
        <span>Prototype simulation — no radio transmission or cloud synchronization.</span>
      </div>
    </div>
  );
};
