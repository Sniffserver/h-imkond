import React, { useMemo } from 'react';
import {
  Flame,
  Sparkles,
  MapPin,
  Radio,
  Battery,
  ShieldCheck,
  ArrowRight,
  Compass,
  MessageSquare,
  PackagePlus,
  Shield,
  Zap,
} from 'lucide-react';
import { MeshNode, UserProfile, NavTab, BatteryManagerStatus } from '../types';
import { fieldcraftService } from '../services/fieldcraftService';

interface CampfireNodeHeroProps {
  user: UserProfile;
  peers: MeshNode[];
  batteryStatus?: BatteryManagerStatus;
  isNightMode?: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
}

export const CampfireNodeHero: React.FC<CampfireNodeHeroProps> = ({
  user,
  peers,
  batteryStatus,
  isNightMode = false,
  onNavigateTab,
  onOpenQuickAdd,
  onOpenChatWithPeer,
}) => {
  const activePeers = useMemo(() => {
    return peers.filter((p) => {
      const diff = Date.now() - new Date(p.lastSeen).getTime();
      return diff < 30 * 60 * 1000;
    });
  }, [peers]);

  const trustedPeers = useMemo(() => {
    return activePeers.filter((p) => p.hopDistance === 1 || p.isDirect || (p.trustScore && p.trustScore >= 50));
  }, [activePeers]);

  const batteryPercent = batteryStatus?.batteryLevelPercent ?? 82;

  const currentSpark = useMemo(() => {
    return fieldcraftService.getActiveFieldSpark({
      peerCount: activePeers.length,
      hasIdentityBackup: true,
      isMapReady: true,
      batteryPercent,
    });
  }, [activePeers.length, batteryPercent]);

  return (
    <div className="space-y-4">
      {/* Campfire Visual State Card */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 border text-center transition-all shadow-sm ${
          isNightMode
            ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {/* Campfire Core Visual Indicator */}
          <div className="relative flex items-center justify-center">
            {/* Ambient fire glow */}
            <div className="absolute w-20 h-20 rounded-full bg-amber-500/20 blur-xl animate-pulse pointer-events-none" />

            {/* Orbiting Sparks if peers are nearby */}
            {activePeers.length > 0 && (
              <div className="absolute -inset-6 flex items-center justify-between pointer-events-none animate-spin-slow">
                <span className="text-amber-400 text-sm animate-ping">✨</span>
                {activePeers.length > 1 && (
                  <span className="text-emerald-400 text-xs animate-pulse">✨</span>
                )}
              </div>
            )}

            {/* Core Campfire Icon */}
            <div
              className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                activePeers.length > 0
                  ? 'bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 text-white'
                  : 'bg-zinc-800 text-amber-500/80 border border-zinc-700'
              }`}
            >
              <Flame className="w-8 h-8 animate-bounce-subtle" />
            </div>
          </div>

          {/* Node Callsign & Descriptive State */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
              {user.callsign}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#637062] dark:text-[#A8BDA5]">
              {activePeers.length === 0 ? (
                <span>Your campfire is alone. No peers in local radio range.</span>
              ) : (
                <span>
                  {activePeers.length} {activePeers.length === 1 ? 'neighbor' : 'neighbors'} nearby
                  {trustedPeers.length > 0 && ` (${trustedPeers.length} verified direct)`}
                </span>
              )}
            </p>
          </div>

          {/* Core Reality Strip: What matters now */}
          <div className="w-full max-w-sm pt-2 flex items-center justify-around text-xs font-mono border-t border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1.5" title="Offline vector basemap">
              <span className="text-emerald-500 font-bold">🗺</span>
              <span>Tallinn ready</span>
            </div>
            <div className="flex items-center gap-1.5" title="Radio mesh interface">
              <span className="text-emerald-500 font-bold">📡</span>
              <span>LoRa 868</span>
            </div>
            <div className="flex items-center gap-1.5" title="Battery level">
              <Battery className="w-3.5 h-3.5 text-emerald-500" />
              <span>{batteryPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Field Spark: One Concrete Useful Action */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-amber-50/70 border-amber-200/80 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Field Spark
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-bold truncate">{currentSpark.title}</h3>
            <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] truncate">
              {currentSpark.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (currentSpark.actionTab) {
              onNavigateTab(currentSpark.actionTab as NavTab);
            }
          }}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white shrink-0 shadow-xs cursor-pointer transition-colors"
        >
          {currentSpark.actionLabel}
        </button>
      </div>

      {/* Simple 3-Action Field Links */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => onNavigateTab('map')}
          className={`p-3.5 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30'
          }`}
        >
          <Compass className="w-5 h-5 text-[#2A9D8F] mb-1.5" />
          <span className="text-xs font-bold">Map</span>
          <span className="text-[10px] text-zinc-500">Explore</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('messages')}
          className={`p-3.5 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30'
          }`}
        >
          <MessageSquare className="w-5 h-5 text-[#588157] mb-1.5" />
          <span className="text-xs font-bold">Connect</span>
          <span className="text-[10px] text-zinc-500">Encrypted</span>
        </button>

        <button
          type="button"
          onClick={onOpenQuickAdd}
          className={`p-3.5 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
            isNightMode
              ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
              : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30'
          }`}
        >
          <PackagePlus className="w-5 h-5 text-[#E9C46A] mb-1.5" />
          <span className="text-xs font-bold">Share</span>
          <span className="text-[10px] text-zinc-500">Resource</span>
        </button>
      </div>

      {/* Active Neighbors List if reachable */}
      {activePeers.length > 0 && (
        <div
          className={`p-4 rounded-2xl border space-y-2 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-zinc-500 uppercase">
              Nearby Sparks ({activePeers.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('messages')}
              className="text-xs font-bold text-[#588157] hover:underline"
            >
              All peers &rarr;
            </button>
          </div>

          <div className="space-y-1.5">
            {activePeers.slice(0, 3).map((peer) => (
              <div
                key={peer.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">✨</span>
                  <span className="font-bold">{peer.callsign}</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {peer.lastRssi ? `${peer.lastRssi} dBm` : 'Direct'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChatWithPeer?.(peer)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#2A9D8F]/15 text-[#2A9D8F] hover:bg-[#2A9D8F]/25"
                >
                  Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
