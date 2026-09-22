import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, MeshNode, MeshLeaderboardNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { CommunityProgress } from './CommunityProgress';
import {
  meshContributionService,
  ContributionTimeRange,
  ContributionSortMetric,
} from '../services/mesh/meshContributionService';
import {
  Radio,
  Award,
  Trophy,
  ShieldCheck,
  Zap,
  TrendingUp,
  Send,
  Activity,
  CheckCircle2,
  Sparkles,
  Layers,
  Signal,
  Cpu,
  Sun,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCw,
  Search,
  MessageSquare,
  Sprout,
  ShieldAlert,
  HelpCircle,
  BarChart3,
  Clock,
  ArrowUpRight,
  Wifi,
} from 'lucide-react';

interface MeshContributionLeaderboardProps {
  user: UserProfile;
  peers?: MeshNode[];
  isNightMode?: boolean;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const MeshContributionLeaderboard: React.FC<MeshContributionLeaderboardProps> = ({
  user,
  peers = [],
  isNightMode = false,
  onUpdateProfile,
  onAddToast,
}) => {
  const [timeRange, setTimeRange] = useState<ContributionTimeRange>('all');
  const [sortMetric, setSortMetric] = useState<ContributionSortMetric>('packets');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [isRelaying, setIsRelaying] = useState(false);
  const [lastRelayedDetails, setLastRelayedDetails] = useState<{
    callsign: string;
    packets: number;
    points: number;
    type: string;
  } | null>(null);
  const [showTierExplainer, setShowTierExplainer] = useState(false);

  // Force re-render on service updates
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = meshContributionService.subscribe(() => {
      setTick((t) => t + 1);
    });
    return () => unsubscribe();
  }, []);

  const leaderboardData = meshContributionService.getLeaderboard(
    user,
    peers,
    timeRange,
    sortMetric
  );

  const filteredLeaderboard = leaderboardData.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.callsign.toLowerCase().includes(query) ||
      item.primaryMedium.toLowerCase().includes(query) ||
      item.tierTitle.toLowerCase().includes(query)
    );
  });

  const currentUserNode = leaderboardData.find((n) => n.isCurrentUser);
  const totalCommunityPackets = leaderboardData.reduce((acc, curr) => acc + curr.relayedPackets, 0);
  const userRank = currentUserNode?.rank || 3;

  // Opt-in privacy state for public leaderboard participation
  const [isPublicOptIn, setIsPublicOptIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_public_mesh_leaderboard_optin');
    return saved === 'true'; // Default is FALSE!
  });

  const handleToggleOptIn = (optIn: boolean) => {
    setIsPublicOptIn(optIn);
    localStorage.setItem('hoimu_public_mesh_leaderboard_optin', String(optIn));
    if (onAddToast) {
      onAddToast(
        optIn ? 'Public Registry Enabled' : 'Private Mode Active',
        optIn
          ? 'Your node relay stats are now visible to local mesh peers.'
          : 'Your relay stats remain private to your local device.',
        'info'
      );
    }
  };

  // Handle packet relay simulation
  const handleSimulateRelay = (packetCount: number = 3, packetType: string = 'CRDT State Sync') => {
    if (isRelaying) return;

    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([40, 60, 40]);
    }

    setIsRelaying(true);

    const randomPeer = peers.length > 0 ? peers[Math.floor(Math.random() * peers.length)].callsign : 'Fern-Weaver';

    setTimeout(() => {
      const result = meshContributionService.simulateRelayPacket(packetCount, packetType, randomPeer);

      if (onUpdateProfile) {
        onUpdateProfile({
          symbiosisScore: (user.symbiosisScore || 142) + result.symbiosisPointsEarned,
          relayedPackets: result.newTotal,
          relayReliability: result.newReliability,
        });
      }

      setLastRelayedDetails({
        callsign: randomPeer,
        packets: packetCount,
        points: result.symbiosisPointsEarned,
        type: packetType,
      });

      if (onAddToast) {
        onAddToast(
          `Relayed ${packetCount} Mesh Packets!`,
          `Successfully routed ${packetType} for ${randomPeer}. +${result.symbiosisPointsEarned} Symbiosis Points earned!`,
          'success'
        );
      }

      setIsRelaying(false);
    }, 600);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#E9C46A] to-[#F4A261] text-[#203A2A] shadow-md font-extrabold text-xs shrink-0 ring-2 ring-[#E9C46A]/50">
          <Trophy className="w-4 h-4" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#A8BDA5] to-[#D3E2D0] text-[#203A2A] shadow-xs font-extrabold text-xs shrink-0 ring-2 ring-[#87A878]/40">
          <Award className="w-4 h-4 text-[#203A2A]" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#E76F51]/80 to-[#F4A261] text-white shadow-xs font-extrabold text-xs shrink-0 ring-2 ring-[#E76F51]/40">
          <Award className="w-4 h-4 text-white" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 text-[#637062] dark:text-[#A8BDA5] font-mono font-bold text-xs shrink-0 border border-[#87A878]/20">
        #{rank}
      </div>
    );
  };

  const getPacketTypeIcon = (typeName: string) => {
    switch (typeName) {
      case 'CRDT State Sync':
        return <Layers className="w-3.5 h-3.5 text-[#588157]" />;
      case 'Encrypted Peer DM':
        return <MessageSquare className="w-3.5 h-3.5 text-[#2A9D8F]" />;
      case 'Mutual Aid Bloom':
        return <Sprout className="w-3.5 h-3.5 text-[#E9C46A]" />;
      case 'SOS / Crisis Relay':
        return <ShieldAlert className="w-3.5 h-3.5 text-[#E76F51]" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#87A878]" />;
    }
  };

  return (
    <div
      id="mesh-contribution-leaderboard"
      className={`rounded-3xl border p-5 sm:p-6 space-y-6 shadow-sm transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#87A878]/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-[#588157] text-[#E9C46A] shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-lg sm:text-xl tracking-tight">
                  Neighborhood Mesh Health & Collective Impact
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#588157]/20 text-[#588157] dark:text-[#E9C46A] border border-[#588157]/30">
                  Collective Progress
                </span>
              </div>
              <p className="text-xs text-[#588157] dark:text-[#A8BDA5] mt-0.5">
                Voluntary local collaboration, preparedness milestones, and community impact without status pressure.
              </p>
            </div>
          </div>
        </div>

        {/* Opt-in Privacy Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-2xl border border-[#87A878]/20 text-xs">
          <span className="text-[#588157] dark:text-[#A8BDA5] font-semibold">Public Ranking:</span>
          <button
            type="button"
            onClick={() => handleToggleOptIn(!isPublicOptIn)}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              isPublicOptIn
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'bg-black/10 dark:bg-white/10 text-[#637062] dark:text-[#A8BDA5]'
            }`}
          >
            {isPublicOptIn ? 'Opted In' : 'Private Mode'}
          </button>
        </div>
      </div>

      {/* COMMUNITY PROGRESS OVER COMPETITION */}
      <CommunityProgress
        title="Your neighborhood prepared 42 offline maps this month"
        impact="That could help 42 households stay oriented and communicate off-grid during an outage"
        isNightMode={isNightMode}
        action={
          <button
            type="button"
            onClick={() => {
              if (onAddToast) {
                onAddToast('Neighborhood Readiness Score: 84%', '348 packets forwarded, 42 offline maps cached, 18 energy points active.', 'info');
              }
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            Explore local readiness
          </button>
        }
      />

      {/* TIER EXPLAINER ACCORDION */}
      <AnimatePresence>
        {showTierExplainer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`p-4 rounded-2xl border text-xs space-y-3 ${
                isNightMode
                  ? 'bg-[#121A10] border-[#2A3B26] text-[#D3E2D0]'
                  : 'bg-white border-[#87A878]/30 text-[#203A2A]'
              }`}
            >
              <div className="flex items-center gap-2 font-display font-bold text-sm text-[#588157] dark:text-[#E9C46A]">
                <Sparkles className="w-4 h-4" />
                <span>How High-Reliability Node Rewards Work</span>
              </div>
              <p className="leading-relaxed text-[#637062] dark:text-[#A8BDA5]">
                In the HÕIMU solarpunk mesh network, nodes that maintain high uptime, valid cryptographic signatures, and dependable packet forwarding receive community recognition and reciprocal benefits:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-[#E9C46A]/15 border border-[#E9C46A]/30">
                  <div className="font-bold text-[#B8860B] dark:text-[#E9C46A] flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Master Sentinel (&gt;99%)</span>
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#D3E2D0] mt-1">
                    1.5x Symbiosis Multiplier, highest priority in crisis alerts and community tool reserves.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#588157]/15 border border-[#588157]/30">
                  <div className="font-bold text-[#344E2C] dark:text-[#87A878] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Solar Backbone (&gt;98%)</span>
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#D3E2D0] mt-1">
                    1.25x Symbiosis Multiplier, recognized off-grid anchor in bioregional mapping.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#2A9D8F]/15 border border-[#2A9D8F]/30">
                  <div className="font-bold text-[#165B53] dark:text-[#2A9D8F] flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Guardian Conduit (&gt;95%)</span>
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#D3E2D0] mt-1">
                    Standard reciprocal credit for store-and-forward DTN packet relay.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top 4 Performance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Total Relayed Packets */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25 shadow-2xs'
          }`}
        >
          <span className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase tracking-wider block">
            Mesh Volume
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-display font-black text-[#588157] dark:text-[#E9C46A]">
              {totalCommunityPackets.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">pkts</span>
          </div>
          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block mt-0.5">
            Across {leaderboardData.length} peer nodes
          </span>
        </div>

        {/* Metric 2: Your Node Ranking */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25 shadow-2xs'
          }`}
        >
          <span className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase tracking-wider block">
            Your Node Rank
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-display font-black text-[#2A9D8F]">
              #{userRank}
            </span>
            <span className="text-[10px] font-bold text-[#588157] dark:text-[#87A878]">
              Top {(Math.round((userRank / leaderboardData.length) * 100))}%
            </span>
          </div>
          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block mt-0.5">
            {currentUserNode?.relayedPackets} packets relayed
          </span>
        </div>

        {/* Metric 3: Reliability Score */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25 shadow-2xs'
          }`}
        >
          <span className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase tracking-wider block">
            Your Reliability
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-display font-black text-[#E9C46A] dark:text-[#E9C46A]">
              {currentUserNode?.relayReliability}%
            </span>
            <span className="text-[10px] font-bold text-[#588157]">High</span>
          </div>
          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block mt-0.5">
            PDR: {currentUserNode?.packetDeliveryRatio}%
          </span>
        </div>

        {/* Metric 4: Symbiosis Generated */}
        <div
          className={`p-3.5 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25 shadow-2xs'
          }`}
        >
          <span className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase tracking-wider block">
            Relay Reward Pts
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-display font-black text-[#E76F51]">
              +{currentUserNode?.symbiosisRewardPoints}
            </span>
            <span className="text-[10px] font-mono text-[#637062]">pts</span>
          </div>
          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block mt-0.5">
            Added to Symbiosis Score
          </span>
        </div>
      </div>

      {/* Interactive Packet Relay Simulation Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30]'
            : 'bg-gradient-to-r from-[#EBF7F5] to-[#F0F5EE] border-[#2A9D8F]/30 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center shrink-0">
            <Send className={`w-5 h-5 ${isRelaying ? 'animate-bounce text-[#E9C46A]' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm">
                Active Relay Duty Simulation
              </span>
              <span className="w-2 h-2 rounded-full bg-[#588157] animate-pulse" />
            </div>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Simulate forwarding encrypted CRDT states and crisis bundles for nearby community peers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            id="simulate-single-relay-btn"
            disabled={isRelaying}
            onClick={() => handleSimulateRelay(1, 'CRDT State Sync')}
            className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-[#121A10] hover:bg-[#FAF6EE] text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Relay 1 single CRDT state packet"
          >
            {isRelaying ? 'Relaying...' : 'Relay 1 Pkt (+1 pt)'}
          </button>

          <button
            type="button"
            id="simulate-bundle-relay-btn"
            disabled={isRelaying}
            onClick={() => handleSimulateRelay(3, 'Mutual Aid Bloom')}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#588157] hover:bg-[#466745] text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            title="Relay 3-packet mutual aid bundle across the mesh"
          >
            <Zap className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>{isRelaying ? 'Broadcasting...' : 'Relay Bundle (+3 pts)'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Time Range, Sorting & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Time Range Tabs */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-[#87A878]/20 self-start">
          {(['all', 'epoch', 'today'] as const).map((r) => {
            const isSelected = timeRange === r;
            const labels = { all: 'All-Time', epoch: 'This Epoch (7d)', today: 'Today (24h)' };
            return (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#588157] text-white shadow-xs'
                    : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>

        {/* Search and Sort Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#637062] dark:text-[#A8BDA5] hidden sm:inline">Sort:</span>
            <select
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as ContributionSortMetric)}
              className={`px-2.5 py-1.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#87A878] ${
                isNightMode
                  ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/40'
              }`}
            >
              <option value="packets">Most Relayed Packets</option>
              <option value="reliability">Highest Reliability %</option>
              <option value="symbiosis">Symbiosis Rewards Earned</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#637062]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search callsign..."
              className={`w-full pl-8 pr-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#87A878] ${
                isNightMode
                  ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/40'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Leaderboard Entries List */}
      {!isPublicOptIn ? (
        <div className="p-6 rounded-2xl border border-dashed border-[#87A878]/40 text-center space-y-3 bg-black/5 dark:bg-white/5">
          <div className="w-10 h-10 rounded-full bg-[#588157]/15 text-[#588157] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
              Private Mode Active (Default)
            </h4>
            <p className="text-xs text-[#588157] dark:text-[#A8BDA5] max-w-md mx-auto">
              Public node ranking is disabled by default to prevent status competition and protect node privacy. Your device operates locally and securely.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleOptIn(true)}
            className="px-4 py-2 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>Opt in to Public Mesh Registry</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLeaderboard.map((node) => {
            const isExpanded = expandedNodeId === node.id;
          const maxPackets = Math.max(...leaderboardData.map((d) => d.relayedPackets), 1);
          const packetPct = Math.max(8, Math.round((node.relayedPackets / maxPackets) * 100));

          return (
            <div
              key={node.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                node.isCurrentUser
                  ? isNightMode
                    ? 'bg-[#182315] border-[#588157] ring-1 ring-[#588157]/40 shadow-sm'
                    : 'bg-white border-[#588157] ring-2 ring-[#588157]/25 shadow-sm'
                  : isNightMode
                  ? 'bg-[#182315]/80 border-[#2A3B26] hover:border-[#364E30]'
                  : 'bg-white/80 border-[#87A878]/25 hover:border-[#87A878]/50 shadow-2xs'
              }`}
            >
              {/* Row Header */}
              <div
                onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
              >
                {/* Left: Rank, Avatar, Callsign & Badges */}
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(node.rank || 1)}

                  <div className="relative shrink-0">
                    <SolarpunkAvatarCanvas seed={node.avatarSeed} size={40} />
                    {node.solarPowered && (
                      <span
                        className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#E9C46A] text-[#203A2A] border border-white dark:border-[#182315]"
                        title="100% Solar Powered Mesh Node"
                      >
                        <Sun className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] truncate">
                        {node.callsign}
                      </span>

                      {node.isCurrentUser && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#588157] text-white shadow-2xs">
                          You (Local Node)
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${node.tierBadgeColor}`}
                      >
                        {node.tierTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
                      <span>{node.primaryMedium}</span>
                      <span>•</span>
                      <span className="text-[#588157] font-semibold">Uptime {node.uptimePercentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Right: Key Stats & Expand Toggle */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-current/10">
                  {/* Reliability % */}
                  <div className="text-right">
                    <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                      Reliability
                    </span>
                    <span className="text-xs font-mono font-bold text-[#2A9D8F]">
                      {node.relayReliability}%
                    </span>
                  </div>

                  {/* Relayed Packets Count with Bar */}
                  <div className="text-right w-24 sm:w-28">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-sm font-mono font-extrabold text-[#203A2A] dark:text-[#F0F5EE]">
                        {node.relayedPackets}
                      </span>
                      <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">pkts</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                      <div
                        style={{ width: `${packetPct}%` }}
                        className={`h-full rounded-full ${
                          node.rank === 1
                            ? 'bg-gradient-to-r from-[#E9C46A] to-[#F4A261]'
                            : node.isCurrentUser
                            ? 'bg-gradient-to-r from-[#588157] to-[#2A9D8F]'
                            : 'bg-[#87A878]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Symbiosis Points Earned */}
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                      Reward
                    </span>
                    <span className="text-xs font-mono font-bold text-[#E76F51]">
                      +{node.symbiosisRewardPoints} pts
                    </span>
                  </div>

                  {/* Expand Chevron */}
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* EXPANDABLE DETAILS DRAWER */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`p-4 border-t text-xs space-y-4 ${
                        isNightMode
                          ? 'bg-[#121A10] border-[#2A3B26]'
                          : 'bg-[#FAF6EE]/80 border-[#87A878]/20'
                      }`}
                    >
                      {/* Sub-grid of detailed telemetry metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-[#87A878]/20">
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                            Packet Delivery Ratio
                          </span>
                          <span className="text-xs font-mono font-bold text-[#588157]">
                            {node.packetDeliveryRatio}% PDR
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-[#87A878]/20">
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                            Active Airtime
                          </span>
                          <span className="text-xs font-mono font-bold text-[#2A9D8F]">
                            {node.airtimeMinutes} minutes
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-[#87A878]/20">
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                            Power Source
                          </span>
                          <span className="text-xs font-mono font-bold text-[#E9C46A] flex items-center gap-1">
                            {node.solarPowered ? <Sun className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                            <span>{node.solarPowered ? '100% Solar Off-Grid' : 'Grid / Battery'}</span>
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-[#87A878]/20">
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">
                            Bioregional Multiplier
                          </span>
                          <span className="text-xs font-mono font-bold text-[#E76F51]">
                            {node.relayReliability >= 98 ? '1.5x Reciprocity' : '1.0x Reciprocity'}
                          </span>
                        </div>
                      </div>

                      {/* Packet categories distribution */}
                      <div className="space-y-2">
                        <span className="font-display font-bold text-xs flex items-center gap-1.5 text-[#588157] dark:text-[#E9C46A]">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Relayed Packet Categories Breakdown</span>
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {node.recentPacketTypes.map((pkt, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-xl bg-white/80 dark:bg-white/5 border border-[#87A878]/20 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                {getPacketTypeIcon(pkt.type)}
                                <span className="font-medium text-[11px]">{pkt.type}</span>
                              </div>
                              <span className="font-mono font-bold text-[11px] text-[#203A2A] dark:text-[#F0F5EE]">
                                {pkt.count} pkts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 7-Day Relay Activity Sparkline */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                          <span>7-Day Mesh Relay Velocity</span>
                          <span>{node.weeklyRelayHistory.reduce((a, b) => a + b, 0)} pkts / week</span>
                        </div>
                        <div className="flex items-end gap-1.5 h-10 pt-2">
                          {node.weeklyRelayHistory.map((val, idx) => {
                            const maxW = Math.max(...node.weeklyRelayHistory, 1);
                            const h = Math.max(15, Math.round((val / maxW) * 100));
                            return (
                              <div
                                key={idx}
                                className="flex-1 h-full flex flex-col items-center justify-end group"
                              >
                                <div
                                  style={{ height: `${h}%` }}
                                  className={`w-full rounded-t-md transition-all ${
                                    idx === node.weeklyRelayHistory.length - 1
                                      ? 'bg-[#588157]'
                                      : 'bg-[#87A878]/40 group-hover:bg-[#87A878]/70'
                                  }`}
                                  title={`Day ${idx + 1}: ${val} packets relayed`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
