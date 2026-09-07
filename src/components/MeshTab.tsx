import React, { useState } from 'react';
import { MeshNode, BatteryManagerStatus } from '../types';
import { OfflineRadarCanvas } from './OfflineRadarCanvas';
import { NearbyPeersComponent } from './NearbyPeersComponent';
import { MeshStatusCard } from './MeshStatusCard';
import { BatteryHistoryChart } from './BatteryHistoryChart';
import { SymbiosisScoreBadge } from './SymbiosisScoreBadge';
import { DirectMessageModal } from './DirectMessageModal';
import { PeerTrustRadarChartD3 } from './PeerTrustRadarChartD3';
import { RelayReliabilityTrendD3 } from './RelayReliabilityTrendD3';
import { MeshRssiGraphD3 } from './MeshRssiGraphD3';
import { Compass, MessageSquare, ShieldCheck, Radio, Activity } from 'lucide-react';
import { useMeshStore, selectPeersArray } from '../store/meshStore';

interface MeshTabProps {
  peers?: MeshNode[];
  batteryStatus: BatteryManagerStatus;
  userSymbiosisScore: number;
  userCallsign?: string;
  onToggleSolarAware: () => void;
  onSelectPeer: (peer: MeshNode) => void;
  onOpenReputation: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode | null) => void;
  onRefreshScan: () => void;
  onOpenDiagnostics?: () => void;
  onDiscoverPeer?: () => void;
  isScanning?: boolean;
  isNightMode?: boolean;
}

export const MeshTab: React.FC<MeshTabProps> = ({
  peers: propPeers,
  batteryStatus,
  userSymbiosisScore,
  userCallsign = 'My Station (Local)',
  onToggleSolarAware,
  onSelectPeer,
  onOpenReputation,
  onOpenChatWithPeer,
  onRefreshScan,
  onOpenDiagnostics,
  onDiscoverPeer,
  isScanning,
  isNightMode = false,
}) => {
  const storePeers = useMeshStore(selectPeersArray);
  const peers = propPeers && propPeers.length > 0 ? propPeers : storePeers;
  const lastSyncTimestamp = useMeshStore((state) => state.lastSyncTimestamp);
  const setLastSyncTimestamp = useMeshStore((state) => state.setLastSyncTimestamp);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activeDirectMessagePeer, setActiveDirectMessagePeer] = useState<MeshNode | null>(null);

  const handleSelectPeer = (peer: MeshNode) => {
    setActivePeerId(peer.id);
    onSelectPeer(peer);
  };

  const prevScanningRef = React.useRef(isScanning);
  React.useEffect(() => {
    if (prevScanningRef.current && !isScanning) {
      setLastSyncTimestamp(Date.now());
    }
    prevScanningRef.current = isScanning;
  }, [isScanning, setLastSyncTimestamp]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            className={`font-display font-bold text-2xl ${
              isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
            }`}
          >
            Offline Mesh Radar & Telemetry
          </h2>
          <p
            className={`text-xs ${
              isNightMode ? 'text-[#87A878]' : 'text-[#588157]'
            }`}
          >
            Decentralized RF spatial map powered by BLE beacon signal strength (RSSI) and hop propagation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <SymbiosisScoreBadge score={userSymbiosisScore} />

          {onOpenDiagnostics && (
            <button
              id="open-diagnostics-btn"
              type="button"
              onClick={onOpenDiagnostics}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-2xl border shadow-sm transition-all active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] hover:bg-[#2A3B26] text-[#2A9D8F] border-[#364E30]'
                  : 'bg-white hover:bg-[#FAF6EE] text-[#2A9D8F] border-[#87A878]/40'
              }`}
              title="Ava detailne võrgudiagnostika vaade (RF spekter, paketipüüdja, traceroute)"
            >
              <Activity className="w-4 h-4 text-[#2A9D8F]" />
              <span className="hidden sm:inline">Võrgudiagnostika</span>
              <span className="sm:hidden">Diagnostika</span>
            </button>
          )}

          <button
            id="open-broadcast-chat-btn"
            type="button"
            onClick={() => onOpenChatWithPeer(null)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A] border border-[#364E30]'
                : 'bg-[#203A2A] hover:bg-[#16271c] text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-[#E9C46A]" />
            <span>Broadcast Radio</span>
          </button>
        </div>
      </div>

      {/* Mesh Status Card */}
      <MeshStatusCard
        peerCount={peers.length}
        peers={peers}
        batteryStatus={batteryStatus}
        onToggleSolarAware={onToggleSolarAware}
        onRefreshScan={onRefreshScan}
        onOpenDiagnostics={onOpenDiagnostics}
        onOpenMessages={() => {
          if (peers.length > 0) {
            setActiveDirectMessagePeer(peers[0]);
          }
        }}
        isScanning={isScanning}
      />

      {/* Radar & Peers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Radar Canvas Container */}
        <div
          className={`lg:col-span-6 rounded-3xl border p-4 sm:p-6 shadow-xs flex flex-col items-center transition-colors duration-200 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30]'
              : 'bg-[#F0F5EE] border-[#87A878]/35'
          }`}
        >
          <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-current/10">
            <span
              className={`font-display font-bold text-sm flex items-center gap-1.5 ${
                isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
              }`}
            >
              <Compass className="w-4 h-4 text-[#588157]" />
              Polar RF Spatial Radar
            </span>
            <span
              className={`text-[11px] font-mono ${
                isNightMode ? 'text-[#87A878]' : 'text-[#637062]'
              }`}
            >
              Sweep: {batteryStatus.isSolarAwareActive ? '0.5 Hz (Solar Throttle)' : '2.0 Hz'}
            </span>
          </div>

          <OfflineRadarCanvas
            peers={peers}
            onSelectPeer={handleSelectPeer}
            selectedPeerId={activePeerId}
            isSolarAware={batteryStatus.isSolarAwareActive}
            isNightMode={isNightMode}
          />
        </div>

        {/* Reachable Peers List & Integrity Footnote */}
        <div className="lg:col-span-6 space-y-4">
          <NearbyPeersComponent
            peers={peers}
            onSelectPeer={handleSelectPeer}
            onOpenReputation={onOpenReputation}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onOpenDirectMessage={(peer) => setActiveDirectMessagePeer(peer)}
            isNightMode={isNightMode}
            isScanning={isScanning}
            onRefreshScan={onRefreshScan}
            onDiscoverPeer={onDiscoverPeer}
          />

          {/* Zero-Cloud Architecture Note */}
          <div
            className={`rounded-3xl border p-4 text-xs space-y-1.5 transition-colors duration-200 ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5]'
                : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#637062]'
            }`}
          >
            <div
              className={`font-display font-bold flex items-center gap-1.5 ${
                isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
              Zero-Cloud Cryptographic Integrity
            </div>
            <p className="leading-relaxed">
              HÕIMU functions fully offline through short-range radio beacons (BLE and Wi-Fi Direct). No external servers, telemetry aggregators, or blockchains. Exchange history and trust metrics are stored locally on-device.
            </p>
          </div>

          {/* Last Sync Indicator */}
          <div className="flex items-center justify-center pt-2">
            <span className={`text-[10px] uppercase tracking-wider font-mono flex items-center gap-1.5 ${isNightMode ? 'text-[#A8BDA5]/60' : 'text-[#588157]/60'}`}>
              <Activity className={`w-3 h-3 ${isScanning ? 'animate-pulse text-[#E9C46A]' : ''}`} />
              {isScanning ? 'Syncing with mesh...' : `Last successful sync: ${lastSyncTimestamp ? new Date(lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}`}
            </span>
          </div>
        </div>
      </div>

      {/* D3.js Real-time RSSI Signal Strength Graph Topology */}
      <MeshRssiGraphD3
        peers={peers}
        userCallsign={userCallsign}
        selectedPeerId={activePeerId}
        onSelectPeer={handleSelectPeer}
        onOpenChatWithPeer={(peer) => setActiveDirectMessagePeer(peer)}
        onOpenReputation={onOpenReputation}
        isNightMode={isNightMode}
        isSolarAware={batteryStatus.isSolarAwareActive}
      />

      {/* D3.js Peer Trust Profile Radar Chart */}
      <PeerTrustRadarChartD3
        peer={peers.find((p) => p.id === activePeerId) || (peers.length > 0 ? peers[0] : null)}
        allPeers={peers}
        onSelectPeer={handleSelectPeer}
        onOpenReputation={onOpenReputation}
        onOpenChat={onOpenChatWithPeer}
        isNightMode={isNightMode}
      />

      {/* D3.js 24-Hour Relay Reliability Trend & Bottleneck Monitor */}
      <RelayReliabilityTrendD3
        peers={peers}
        isNightMode={isNightMode}
      />

      {/* 24-Hour Battery & Energy Consumption Recharts Visualization */}
      <BatteryHistoryChart
        batteryStatus={batteryStatus}
        isNightMode={isNightMode}
        onToggleSolarAware={onToggleSolarAware}
      />

      {/* Encrypted Direct Message Modal */}
      {activeDirectMessagePeer && (
        <DirectMessageModal
          peer={activeDirectMessagePeer}
          isOpen={!!activeDirectMessagePeer}
          onClose={() => setActiveDirectMessagePeer(null)}
          isNightMode={isNightMode}
        />
      )}
    </div>
  );
};
