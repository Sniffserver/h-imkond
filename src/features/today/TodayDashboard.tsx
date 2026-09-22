import React from 'react';
import {
  Compass,
  MessageSquare,
  ShieldAlert,
  Radio,
  Vote,
  Sparkles,
  ArrowRight,
  Wifi,
  HardDrive,
  HeartHandshake,
  CheckCircle2,
  Users,
  PackagePlus,
  BatteryCharging,
  SunMedium,
  Zap,
} from 'lucide-react';
import { MeshNode, ResourceItem, UserProfile, DaoProposal, NavTab, BatteryManagerStatus } from '../../types';
import { TechTooltip } from '../../components/TechTooltip';
import { EmptyState } from '../../components/EmptyState';

interface TodayDashboardProps {
  user: UserProfile;
  peers: MeshNode[];
  resources: ResourceItem[];
  daoProposals: DaoProposal[];
  batteryStatus?: BatteryManagerStatus;
  isNightMode?: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
  onOpenDaoModal?: () => void;
  onOpenManual?: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  user,
  peers,
  resources,
  daoProposals,
  batteryStatus,
  isNightMode = false,
  onNavigateTab,
  onOpenQuickAdd,
  onOpenChatWithPeer,
  onOpenDaoModal,
  onOpenManual,
}) => {
  const activePeers = peers.filter((p) => (Date.now() - new Date(p.lastSeen).getTime()) < 15 * 60 * 1000); // 15 mins
  const openProposals = daoProposals.filter((p) => p.status === 'active');
  const availableResources = resources.filter((r) => r.isActive);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Tere hommikust';
    if (hour < 18) return 'Tere päevast';
    return 'Tere õhtust';
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Daily Loop Greeting & System Status Banner */}
      <section
        aria-labelledby="today-greeting-title"
        className={`p-5 sm:p-6 rounded-3xl border transition-all shadow-xs ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
              <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse" />
              <span>
                <TechTooltip termKey="mesh">Nearby network active</TechTooltip>
              </span>
            </div>
            <h1
              id="today-greeting-title"
              className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[#203A2A] dark:text-[#F0F5EE]"
            >
              {getGreeting()}, {user.callsign}
            </h1>
            <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] max-w-lg">
              Here is your off-grid community summary for today. Your device is connected directly to nearby neighbors.
            </p>
          </div>

          {/* Quick Telemetry Glance */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-[#588157]/10 border border-[#588157]/25 text-[#588157] dark:text-[#87A878]"
              title="Community contribution score"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Score: {user.symbiosisScore}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Primary 4-Action Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('map')}
          className={`p-4 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex flex-col justify-between min-h-[105px] group ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center justify-between">
              <span>Explore Map</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              {availableResources.length} shared resources
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('messages')}
          className={`p-4 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex flex-col justify-between min-h-[105px] group ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#588157]/15 text-[#588157] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center justify-between">
              <span>Connect</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              {activePeers.length} neighbors nearby
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenQuickAdd}
          className={`p-4 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex flex-col justify-between min-h-[105px] group ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 text-[#D4A373] dark:text-[#E9C46A] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <PackagePlus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center justify-between">
              <span>Share Resource</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              Tools, power, water
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('sos')}
          className={`p-4 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex flex-col justify-between min-h-[105px] group ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#E76F51]/15 text-[#E76F51] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center justify-between">
              <span>Safety & SOS</span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              Emergency alerts
            </span>
          </div>
        </button>
      </div>

      {/* 3. Daily Loop Section A: Nearby Network Status */}
      <section
        aria-labelledby="nearby-network-title"
        className={`p-5 rounded-3xl border ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#2A9D8F]" />
            <h2 id="nearby-network-title" className="font-bold text-sm">
              <TechTooltip termKey="mesh">Nearby Network</TechTooltip>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/5 dark:bg-white/5 text-[#637062] dark:text-[#A8BDA5]">
              {peers.length} reachable
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('mesh')}
            className="text-xs font-bold text-[#588157] dark:text-[#87A878] hover:underline cursor-pointer"
          >
            View all &rarr;
          </button>
        </div>

        {peers.length === 0 ? (
          <EmptyState
            icon={<Radio />}
            title="Looking for nearby network"
            message="No nearby neighbors detected yet. Devices connect automatically over Bluetooth and local radio."
            primaryAction={{
              label: 'Explore on map',
              onClick: () => onNavigateTab('map'),
            }}
            secondaryAction={{
              label: 'Learn how it works',
              onClick: () => onOpenManual?.(),
            }}
            tertiaryAction={{
              label: 'Continue without nearby peers',
              onClick: () => onNavigateTab('more'),
            }}
            isNightMode={isNightMode}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {peers.slice(0, 3).map((peer) => (
              <div
                key={peer.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26]'
                    : 'bg-[#FAF6EE] border-[#87A878]/25'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#588157]/15 text-[#588157] flex items-center justify-center font-bold text-xs shrink-0">
                    {peer.callsign?.slice(0, 2).toUpperCase() || 'P'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-[#203A2A] dark:text-[#F0F5EE]">
                      {peer.callsign}
                    </p>
                    <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate">
                      <TechTooltip termKey="rssi">
                        Signal: {peer.lastRssi ? `${peer.lastRssi} dBm` : 'Nearby'}
                      </TechTooltip>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChatWithPeer?.(peer)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2A9D8F]/15 hover:bg-[#2A9D8F]/25 text-[#2A9D8F] cursor-pointer shrink-0 transition-colors"
                >
                  Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Daily Loop Section B: Community Decisions (DAO) & Actions */}
      <section
        aria-labelledby="community-decisions-title"
        className={`p-5 rounded-3xl border ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-[#E9C46A]" />
            <h2 id="community-decisions-title" className="font-bold text-sm">
              <TechTooltip termKey="dao">Community Decisions</TechTooltip>
            </h2>
            {openProposals.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {openProposals.length} awaiting vote
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenDaoModal?.()}
            className="text-xs font-bold text-[#588157] dark:text-[#87A878] hover:underline cursor-pointer"
          >
            Open voting &rarr;
          </button>
        </div>

        {openProposals.length === 0 ? (
          <EmptyState
            icon={<Vote />}
            title="All community decisions settled"
            message="There are currently no proposals awaiting your vote. Your neighborhood is in harmony."
            primaryAction={{
              label: 'Create a proposal',
              onClick: () => onOpenDaoModal?.(),
            }}
            secondaryAction={{
              label: 'View past decisions',
              onClick: () => onOpenDaoModal?.(),
            }}
            isNightMode={isNightMode}
          />
        ) : (
          <div className="space-y-2">
            {openProposals.slice(0, 2).map((proposal) => (
              <div
                key={proposal.id}
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26]'
                    : 'bg-[#FAF6EE] border-[#87A878]/25'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                      {proposal.category}
                    </span>
                    <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                      By {proposal.authorCallsign}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                    {proposal.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenDaoModal?.()}
                  className="px-3.5 py-1.5 min-h-[36px] bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl cursor-pointer self-start sm:self-center transition-colors shrink-0 shadow-xs"
                >
                  Cast Vote
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Helpful Contextual Tips for Daily Loop */}
      <section
        className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          isNightMode
            ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
            : 'bg-[#87A878]/10 border-[#87A878]/25 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-[#2A9D8F] shrink-0" />
          <span>
            Offline maps and mesh outbox are synchronized. You can use all core features without cell reception.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('more')}
          className="font-bold text-[#588157] dark:text-[#87A878] hover:underline shrink-0 cursor-pointer"
        >
          More tools &rarr;
        </button>
      </section>
    </div>
  );
};

export default TodayDashboard;
