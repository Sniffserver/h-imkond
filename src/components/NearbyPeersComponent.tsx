import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { MeshNode, ConnectionState, ReputationTier } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { ReputationPill, getReputationTier } from './ReputationPill';
import { PeerTrustBadge } from './PeerTrustBadge';
import { PeerTrustScoreIndicator } from './PeerTrustScoreIndicator';
import { PeerSignalPulseSVG, SignalStrengthMeterSVG } from './PeerSignalPulseSVG';
import { MeshEmptyState } from './EmptyStates/MeshEmptyState';
import { EmptyState } from './EmptyState';
import {
  Radio,
  MessageSquare,
  Compass,
  Filter,
  ArrowUpDown,
  Layers,
  Award,
  Zap,
  Check,
  Sparkles,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useMeshStore, selectPeersArray } from '../store/meshStore';
import { simulatePeerSyncPulse } from '../services/mesh/meshSync';

interface NearbyPeersComponentProps {
  peers?: MeshNode[];
  onSelectPeer: (peer: MeshNode) => void;
  onOpenReputation: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode) => void;
  onOpenDirectMessage?: (peer: MeshNode) => void;
  isNightMode?: boolean;
  isScanning?: boolean;
  onRefreshScan?: () => void;
  onDiscoverPeer?: () => void;
}

export type ConnectionFilterType = 'all' | 'direct' | 'relayed' | 'store_forward';
export type ReputationFilterType = 'all' | ReputationTier;
export type SortOptionType = 'rssi' | 'reliability' | 'last_seen' | 'trust' | 'exchanges' | 'hops';

// Helper to convert relative lastSeen strings into numeric minutes for precise sorting
const parseLastSeenMinutes = (lastSeen: string | undefined): number => {
  if (!lastSeen) return 999999;
  const lower = lastSeen.toLowerCase().trim();
  if (lower.includes('just now') || lower.includes('now') || lower.includes('hetk') || lower.includes('praegu')) return 0;
  const match = lower.match(/^(\d+)\s*(s|sec|m|min|h|hr|d|day)?/i);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = (match[2] || 'm').toLowerCase();
    if (unit.startsWith('s')) return val / 60;
    if (unit.startsWith('m')) return val;
    if (unit.startsWith('h')) return val * 60;
    if (unit.startsWith('d')) return val * 1440;
    return val;
  }
  return 999999;
};

export const NearbyPeersComponent: React.FC<NearbyPeersComponentProps> = ({
  peers: propPeers,
  onSelectPeer,
  onOpenReputation,
  onOpenChatWithPeer,
  onOpenDirectMessage,
  isNightMode = false,
  isScanning = false,
  onRefreshScan,
  onDiscoverPeer,
}) => {
  const storePeersMap = useMeshStore((state) => state.peers);
  const storePeersArray = useMeshStore(selectPeersArray);
  const lastSyncPulse = useMeshStore((state) => state.lastSyncPulse);
  const recentSyncPulses = useMeshStore((state) => state.recentSyncPulses);
  const peers = propPeers && propPeers.length > 0 ? propPeers : storePeersArray;

  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilterType>('all');
  const [reputationFilter, setRepputationFilter] = useState<ReputationFilterType>('all');
  const [sortBy, setSortBy] = useState<SortOptionType>('rssi');

  const shouldReduceMotion = useReducedMotion();

  // Track known peer IDs using Map for O(1) lookups to avoid cascading re-renders
  const knownPeerIdsRef = useRef<Set<string>>(new Set(peers.map((p) => p.id)));
  const [newlyDiscoveredIds, setNewlyDiscoveredIds] = useState<Set<string>>(new Set());
  const [scanCycle, setScanCycle] = useState(0);
  const prevScanningRef = useRef<boolean>(!!isScanning);

  useEffect(() => {
    const newIds = new Set<string>();

    // O(1) lookup check across peers
    peers.forEach((p) => {
      if (!knownPeerIdsRef.current.has(p.id)) {
        newIds.add(p.id);
        knownPeerIdsRef.current.add(p.id);
      }
    });

    if (newIds.size > 0) {
      setNewlyDiscoveredIds((prev) => new Set([...prev, ...newIds]));

      // Clear "new" flash status after 10 seconds so it settles naturally
      const timer = setTimeout(() => {
        setNewlyDiscoveredIds((prev) => {
          const next = new Set(prev);
          for (const id of newIds) {
            next.delete(id);
          }
          return next;
        });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [storePeersMap, peers.length]);

  // Re-trigger the staggered wave only when scanning finishes (true -> false transition)
  useEffect(() => {
    if (prevScanningRef.current && !isScanning) {
      setScanCycle((c) => c + 1);
    }
    prevScanningRef.current = !!isScanning;
  }, [isScanning]);

  // Staggered Container & Item Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.075,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const peerItemVariants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 20,
      scale: shouldReduceMotion ? 1 : 0.96,
      filter: shouldReduceMotion ? 'none' : 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'spring' as const,
        stiffness: 380,
        damping: 26,
        mass: 0.75,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.94,
      y: -10,
      filter: shouldReduceMotion ? 'none' : 'blur(2px)',
      transition: {
        duration: 0.16,
        ease: 'easeOut' as const,
      },
    },
  };

  // Filter & Sort Peers
  const filteredAndSortedPeers = useMemo(() => {
    let result = [...peers];

    // Filter by Connection Type
    if (connectionFilter === 'direct') {
      result = result.filter((p) => p.isDirect || p.hopDistance === 1);
    } else if (connectionFilter === 'relayed') {
      result = result.filter((p) => p.connectionState === 'relayed' || p.hopDistance === 2);
    } else if (connectionFilter === 'store_forward') {
      result = result.filter((p) => p.connectionState === 'store_forward' || p.hopDistance >= 3);
    }

    // Filter by Reputation Tier
    if (reputationFilter !== 'all') {
      result = result.filter((p) => getReputationTier(p.completedExchanges) === reputationFilter);
    }

    // Sort peers
    result.sort((a, b) => {
      if (sortBy === 'rssi') {
        return b.lastRssi - a.lastRssi; // higher dBm first (e.g. -48 before -74)
      } else if (sortBy === 'reliability') {
        const relA = a.relayReliability ?? a.trustScore;
        const relB = b.relayReliability ?? b.trustScore;
        return relB - relA; // higher reliability score first (e.g. 99.1% before 94.2%)
      } else if (sortBy === 'last_seen') {
        return parseLastSeenMinutes(a.lastSeen) - parseLastSeenMinutes(b.lastSeen); // most recent first
      } else if (sortBy === 'trust') {
        return b.trustScore - a.trustScore;
      } else if (sortBy === 'exchanges') {
        return b.completedExchanges - a.completedExchanges;
      } else if (sortBy === 'hops') {
        return a.hopDistance - b.hopDistance;
      }
      return 0;
    });

    return result;
  }, [peers, connectionFilter, reputationFilter, sortBy]);

  // Counts for badge indicators
  const directCount = peers.filter((p) => p.isDirect || p.hopDistance === 1).length;
  const relayedCount = peers.filter((p) => p.connectionState === 'relayed' || p.hopDistance === 2).length;
  const storeForwardCount = peers.filter((p) => p.connectionState === 'store_forward' || p.hopDistance >= 3).length;

  const stewardCount = peers.filter((p) => getReputationTier(p.completedExchanges) === 'Steward').length;
  const verifiedCount = peers.filter((p) => getReputationTier(p.completedExchanges) === 'Verified Peer').length;
  const neighborCount = peers.filter((p) => getReputationTier(p.completedExchanges) === 'Neighbor').length;
  const newKinCount = peers.filter((p) => getReputationTier(p.completedExchanges) === 'New Kin').length;

  return (
    <div
      className={`rounded-3xl border shadow-xs p-4 sm:p-5 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header with Title, Active Count & Quick Discovery Action */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 pb-2 border-b border-current/10">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#588157]" />
          <h3 className="font-display font-bold text-sm sm:text-base">
            Reachable Nodes in Range
          </h3>
          <span
            className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full ${
              isNightMode
                ? 'bg-[#364E30] text-[#E9C46A]'
                : 'bg-[#87A878]/20 text-[#588157]'
            }`}
          >
            {filteredAndSortedPeers.length} of {peers.length} Nodes
          </span>
        </div>

        {/* Discovery & Scan Quick Actions */}
        <div className="flex items-center gap-1.5">
          <button
            id="trigger-mesh-sync-pulse-btn"
            type="button"
            onClick={() => simulatePeerSyncPulse()}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] hover:bg-[#2A3B26] text-[#2A9D8F] border-[#364E30]'
                : 'bg-white hover:bg-[#FAF6EE] text-[#2A9D8F] border-[#87A878]/30 shadow-2xs'
            }`}
            title="Trigger a background sync pulse from a peer node to demonstrate ripple data propagation"
          >
            <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Sync Pulse</span>
          </button>

          {onDiscoverPeer && (
            <button
              id="simulate-discover-peer-btn"
              type="button"
              onClick={onDiscoverPeer}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] hover:bg-[#2A3B26] text-[#2A9D8F] border-[#364E30]'
                  : 'bg-white hover:bg-[#FAF6EE] text-[#2A9D8F] border-[#87A878]/30 shadow-2xs'
              }`}
              title="Simulate detecting a new neighboring peer in the local RF spectrum"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Naaber</span>
            </button>
          )}

          {onRefreshScan && (
            <button
              id="refresh-scan-peers-btn"
              type="button"
              onClick={onRefreshScan}
              disabled={isScanning}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                isNightMode
                  ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A] border-[#364E30]'
                  : 'bg-white hover:bg-[#FAF6EE] text-[#203A2A] border-[#87A878]/30 shadow-2xs'
              }`}
              title="Skaneeri 2.4GHz BLE majakaid"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#588157] ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Otsib...' : 'Skaneeri'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Scan Status Bar */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono shadow-xs ${
                isNightMode
                  ? 'bg-[#182315] border-[#2A9D8F]/60 text-[#E9C46A]'
                  : 'bg-white border-[#2A9D8F]/40 text-[#2A9D8F]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F] animate-ping absolute" />
                  <span className="w-2 h-2 rounded-full bg-[#2A9D8F]" />
                </div>
                <span className="font-semibold">
                  Scanning RF spectrum for BLE advertisements & Wi-Fi Direct beacons...
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] shrink-0">
                PROBING CH 37-39
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Chips Section */}
      <div className="space-y-2.5 mb-4">
        {/* Row 1: Connection Type Filter Chips */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#588157] mb-1.5">
            <Radio className="w-3 h-3" />
            <span>Connection Type:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConnectionFilter('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                connectionFilter === 'all'
                  ? isNightMode
                    ? 'bg-[#E9C46A] text-[#1A2617] border-[#E9C46A]'
                    : 'bg-[#203A2A] text-white border-[#203A2A]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/50'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              All ({peers.length})
            </button>

            <button
              type="button"
              onClick={() => setConnectionFilter('direct')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                connectionFilter === 'direct'
                  ? 'bg-[#588157] text-white border-[#588157]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/50'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#87A878]" />
              Direct / 1-Hop ({directCount})
            </button>

            <button
              type="button"
              onClick={() => setConnectionFilter('relayed')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                connectionFilter === 'relayed'
                  ? 'bg-[#F4A261] text-[#243128] border-[#F4A261]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/50'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4A261]" />
              Relayed / 2-Hops ({relayedCount})
            </button>

            <button
              type="button"
              onClick={() => setConnectionFilter('store_forward')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                connectionFilter === 'store_forward'
                  ? 'bg-[#E76F51] text-white border-[#E76F51]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/50'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E76F51]" />
              Store & Forward ({storeForwardCount})
            </button>
          </div>
        </div>

        {/* Row 2: Reputation Tier Filter Chips & Sort Options */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#588157] mb-1.5">
            <div className="flex items-center gap-1.5">
              <Award className="w-3 h-3 text-[#E9C46A]" />
              <span>Reputation Tier:</span>
            </div>

            {/* Sort By Dropdown Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="mesh-peers-sort-select" className="sr-only">
                Sort Peers By
              </label>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#588157]" />
              <select
                id="mesh-peers-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                className={`text-[11px] font-mono font-medium rounded-xl px-2.5 py-1 border focus:outline-none transition-all cursor-pointer shadow-2xs ${
                  isNightMode
                    ? 'bg-[#182315] text-[#E9C46A] border-[#364E30] hover:border-[#E9C46A]/60'
                    : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:border-[#588157]'
                }`}
                title="Sorteeri naabersõlmi signaalitugevuse, töökindluse või viimati nägemise aja järgi"
              >
                <option value="rssi">Sort: Signal Strength (RSSI)</option>
                <option value="reliability">Sort: Reliability Score</option>
                <option value="last_seen">Sort: Last Seen</option>
                <option value="trust">Sort: Trust Score</option>
                <option value="exchanges">Sort: Exchanges</option>
                <option value="hops">Sort: Distance (Hops)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRepputationFilter('all')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                reputationFilter === 'all'
                  ? isNightMode
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                    : 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              All Tiers
            </button>

            <button
              type="button"
              onClick={() => setRepputationFilter('Steward')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                reputationFilter === 'Steward'
                  ? 'bg-[#E9C46A] text-[#243128] border-[#E9C46A]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#E9C46A] border-[#2A3B26]'
                  : 'bg-[#FDF8EB] text-[#8C6207] border-[#E9C46A]/40'
              }`}
            >
              🌳 Steward ({stewardCount})
            </button>

            <button
              type="button"
              onClick={() => setRepputationFilter('Verified Peer')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                reputationFilter === 'Verified Peer'
                  ? 'bg-[#588157] text-white border-[#588157]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#87A878] border-[#2A3B26]'
                  : 'bg-[#F2F6F0] text-[#344E2C] border-[#87A878]/30'
              }`}
            >
              🌿 Verified ({verifiedCount})
            </button>

            <button
              type="button"
              onClick={() => setRepputationFilter('Neighbor')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                reputationFilter === 'Neighbor'
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#2A9D8F] border-[#2A3B26]'
                  : 'bg-[#EBF7F5] text-[#165B53] border-[#2A9D8F]/30'
              }`}
            >
              🌱 Neighbor ({neighborCount})
            </button>

            <button
              type="button"
              onClick={() => setRepputationFilter('New Kin')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                reputationFilter === 'New Kin'
                  ? 'bg-[#E76F51] text-white border-[#E76F51]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#E76F51] border-[#2A3B26]'
                  : 'bg-[#FDF1EE] text-[#9A3822] border-[#E76F51]/30'
              }`}
            >
              🌾 New Kin ({newKinCount})
            </button>
          </div>
        </div>
      </div>

      {/* Peer Cards List */}
      {peers.length === 0 ? (
        <MeshEmptyState
          isScanning={isScanning}
          onRefreshScan={onRefreshScan}
          onDiscoverPeer={onDiscoverPeer}
          isNightMode={isNightMode}
        />
      ) : filteredAndSortedPeers.length === 0 ? (
        <EmptyState
          icon={<Radio />}
          title="No peers match current filters"
          message="Try adjusting your connection or reputation filters to see more nearby nodes."
          primaryAction={{
            label: 'Reset filters',
            onClick: () => {
              setConnectionFilter('all');
              setRepputationFilter('all');
            }
          }}
          isNightMode={isNightMode}
        />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2.5"
        >
          <AnimatePresence mode="popLayout">
            {filteredAndSortedPeers.map((peer) => {
              const tier = getReputationTier(peer.completedExchanges);
              const isNewlyDiscovered = newlyDiscoveredIds.has(peer.id);
              const isHighTrust = (peer.trustScore || 0) >= 80 || peer.completedExchanges >= 5 || tier === 'Steward' || tier === 'Verified Peer';
              const isHighTrustNewDiscovery = isNewlyDiscovered && isHighTrust;

              return (
                <motion.div
                  key={peer.id}
                  id={`peer-node-${peer.id}`}
                  variants={peerItemVariants}
                  layout="position"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.008 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.992 }}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-colors duration-150 group relative overflow-hidden ${
                    isHighTrustNewDiscovery
                      ? isNightMode
                        ? 'bg-[#1a2c1a] border-[#2A9D8F] ring-2 ring-[#2A9D8F]/70 shadow-lg shadow-[#2A9D8F]/25'
                        : 'bg-[#f4fbf9] border-[#2A9D8F] ring-2 ring-[#2A9D8F]/60 shadow-lg shadow-[#2A9D8F]/20'
                      : isNewlyDiscovered
                      ? isNightMode
                        ? 'bg-[#182315] border-[#2A9D8F] ring-1 ring-[#2A9D8F]/60 shadow-md shadow-[#2A9D8F]/15'
                        : 'bg-white border-[#2A9D8F] ring-1 ring-[#2A9D8F]/50 shadow-md shadow-[#2A9D8F]/15'
                      : isNightMode
                      ? 'bg-[#182315]/90 border-[#2A3B26] hover:border-[#87A878]/60 hover:bg-[#1E2D1A]'
                      : 'bg-white/80 border-[#87A878]/25 hover:border-[#87A878]/60 hover:bg-white'
                  }`}
                >
                  {/* Subtle Radar Ping Ripple Waves for New High-Trust Peer */}
                  {isHighTrustNewDiscovery && !shouldReduceMotion && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                      <motion.div
                        className="absolute -top-12 -bottom-12 -left-12 -right-12 rounded-full border border-[#2A9D8F]/40"
                        initial={{ scale: 0.2, opacity: 0.8 }}
                        animate={{ scale: [0.2, 1.25, 2.0], opacity: [0.8, 0.4, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <motion.div
                        className="absolute -top-12 -bottom-12 -left-12 -right-12 rounded-full border border-[#E9C46A]/35"
                        initial={{ scale: 0.2, opacity: 0.7 }}
                        animate={{ scale: [0.2, 1.25, 2.0], opacity: [0.7, 0.35, 0] }}
                        transition={{ duration: 2.4, delay: 0.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-[#2A9D8F] to-transparent animate-pulse opacity-70" />
                    </div>
                  )}

                  {/* Left: Avatar with SVG Signal Pulse + Callsign + Bio snippet */}
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 z-10 canvas-tap-target"
                    onClick={() => onSelectPeer(peer)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${peer.callsign}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelectPeer(peer);
                      else if (e.key === 'm' || e.key === 'M') {
                        e.stopPropagation();
                        onOpenDirectMessage && onOpenDirectMessage(peer);
                      }
                    }}
                  >
                    <div className="shrink-0 relative">
                      {/* Avatar Ping Ring for High Trust New Discovery */}
                      {isHighTrustNewDiscovery && !shouldReduceMotion && (
                        <span className="absolute -inset-1 rounded-full bg-[#2A9D8F]/30 animate-ping opacity-75 pointer-events-none" />
                      )}
                      <PeerSignalPulseSVG
                        rssi={peer.lastRssi}
                        connectionState={peer.connectionState}
                        isDirect={peer.isDirect}
                        size={44}
                        isNightMode={isNightMode}
                        peerId={peer.id}
                        peerCallsign={peer.callsign}
                        isSyncPulsing={Boolean(
                          (lastSyncPulse?.peerId === peer.id) ||
                          (lastSyncPulse?.callsign?.toLowerCase() === peer.callsign.toLowerCase()) ||
                          (recentSyncPulses[peer.id] && (Date.now() - recentSyncPulses[peer.id] < 2600)) ||
                          (recentSyncPulses[peer.callsign] && (Date.now() - recentSyncPulses[peer.callsign] < 2600))
                        )}
                      >
                        <SolarpunkAvatarCanvas seed={peer.avatarSeed} size={32} />
                      </PeerSignalPulseSVG>
                    </div>
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold text-xs transition-colors truncate ${
                            isNightMode
                              ? 'text-[#F0F5EE] group-hover:text-[#E9C46A]'
                              : 'text-[#203A2A] group-hover:text-[#588157]'
                          }`}
                        >
                          {peer.callsign}
                        </h3>

                        {Boolean(
                          (lastSyncPulse?.peerId === peer.id) ||
                          (lastSyncPulse?.callsign?.toLowerCase() === peer.callsign.toLowerCase()) ||
                          (recentSyncPulses[peer.id] && (Date.now() - recentSyncPulses[peer.id] < 2600)) ||
                          (recentSyncPulses[peer.callsign] && (Date.now() - recentSyncPulses[peer.callsign] < 2600))
                        ) && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-[#2A9D8F]/25 text-[#2A9D8F] border border-[#2A9D8F]/50 flex items-center gap-1 shadow-2xs shrink-0 animate-pulse"
                            title="Data successfully propagated through this node via peer sync pulse"
                          >
                            <Radio className="w-2.5 h-2.5 text-[#2A9D8F]" />
                            SYNC PULSE
                          </motion.span>
                        )}

                        {isHighTrustNewDiscovery ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-[#2A9D8F] text-white flex items-center gap-1 shadow-xs shrink-0"
                            title="Kõrge usaldusskooriga uus naabersõlm tuvastatud"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E9C46A] animate-ping" />
                            <Sparkles className="w-2.5 h-2.5 text-[#E9C46A]" />
                            HIGH TRUST PING
                          </motion.span>
                        ) : isNewlyDiscovered ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-[#2A9D8F] text-white flex items-center gap-0.5 shadow-xs shrink-0 animate-pulse"
                            title="Hiljuti avastatud naabersõlm"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            DISCOVERED
                          </motion.span>
                        ) : null}

                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            (peer.radioType || 'BLE') === 'Wi-Fi Direct'
                              ? 'bg-[#E9C46A]/25 text-[#E9C46A] border border-[#E9C46A]/40'
                              : 'bg-[#2A9D8F]/20 text-[#2A9D8F] border border-[#2A9D8F]/35'
                          }`}
                        >
                          {peer.radioType || 'BLE'}
                        </span>

                        {/* Visual Trust Score Indicator based on Exchanges & Endorsements */}
                        <PeerTrustScoreIndicator
                          completedExchanges={peer.completedExchanges}
                          endorsementsCount={peer.endorsementsCount}
                          peerId={peer.id}
                          callsign={peer.callsign}
                          isNightMode={isNightMode}
                          size="xs"
                          onClick={() => onOpenReputation(peer)}
                        />

                        {/* Peer-to-Peer Exchange Trust Badge */}
                        <PeerTrustBadge
                          completedExchanges={peer.completedExchanges}
                          peerId={peer.id}
                          isNightMode={isNightMode}
                          size="xs"
                          onClick={() => onOpenReputation(peer)}
                        />

                        {sortBy === 'reliability' && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 border ${
                              (peer.relayReliability ?? peer.trustScore) >= 95
                                ? 'bg-[#588157]/20 text-[#588157] border-[#588157]/40'
                                : 'bg-[#E9C46A]/20 text-[#D4A373] border-[#E9C46A]/40'
                            }`}
                            title={`Töökindluse skoor: ${peer.relayReliability || peer.trustScore}%`}
                          >
                            ⚡ {peer.relayReliability ? `${peer.relayReliability}%` : `${peer.trustScore}%`}
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-mono shrink-0 px-1 py-0.2 rounded ${
                            sortBy === 'last_seen'
                              ? isNightMode
                                ? 'bg-[#2A9D8F]/25 text-[#E9C46A] font-bold'
                                : 'bg-[#2A9D8F]/15 text-[#2A9D8F] font-bold'
                              : isNightMode
                              ? 'text-[#87A878]'
                              : 'text-[#637062]'
                          }`}
                        >
                          {peer.lastSeen}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] truncate max-w-[180px] sm:max-w-xs ${
                          isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'
                        }`}
                      >
                        {peer.bio}
                      </p>
                    </div>
                  </div>

                  {/* Right: Trust Score Indicator + Reputation Pill + Telemetry with SVG Signal Bars + Chat Action */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="hidden sm:block">
                      <PeerTrustScoreIndicator
                        completedExchanges={peer.completedExchanges}
                        endorsementsCount={peer.endorsementsCount}
                        peerId={peer.id}
                        callsign={peer.callsign}
                        isNightMode={isNightMode}
                        size="sm"
                        onClick={() => onOpenReputation(peer)}
                      />
                    </div>
                    <ReputationPill
                      completedExchanges={peer.completedExchanges}
                      onClick={() => onOpenReputation(peer)}
                      size="sm"
                    />

                    {/* Dynamic SVG Signal Strength Meter & Hops */}
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <SignalStrengthMeterSVG
                        rssi={peer.lastRssi}
                        connectionState={peer.connectionState}
                        isNightMode={isNightMode}
                      />
                      <div
                        className={`text-[9px] font-mono ${
                          isNightMode ? 'text-[#87A878]' : 'text-[#637062]'
                        }`}
                      >
                        {peer.hopDistance === 1 ? '1 hop (Direct)' : `${peer.hopDistance} hops`}
                      </div>
                    </div>

                    {/* Direct Message Action */}
                    <button
                      id={`peer-message-btn-${peer.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenDirectMessage) {
                          onOpenDirectMessage(peer);
                        } else {
                          onOpenChatWithPeer(peer);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                        isNightMode
                          ? 'bg-[#223120] hover:bg-[#364E30] text-[#E9C46A] border-[#364E30]'
                          : 'bg-[#FAF6EE] hover:bg-[#87A878]/25 text-[#203A2A] border-[#87A878]/35'
                      }`}
                      title={`Send encrypted direct message to ${peer.callsign}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#2A9D8F]" />
                      <span>Message</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
