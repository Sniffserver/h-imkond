import React, { useState, useEffect } from 'react';
import {
  Compass,
  MessageSquare,
  Cpu,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle2,
  Circle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { NavTab, UserProfile } from '../types';

interface StartHereDashboardProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenPiBridge: () => void;
  onOpenChat: () => void;
  onOpenSos?: () => void;
  onOpenManual?: () => void;
  user?: UserProfile;
  isPiConnected?: boolean;
  peerCount?: number;
  messageCount?: number;
  isNightMode?: boolean;
}

export const StartHereDashboard: React.FC<StartHereDashboardProps> = ({
  onNavigateTab,
  onOpenPiBridge,
  onOpenChat,
  onOpenManual,
  user,
  isPiConnected = false,
  peerCount = 0,
  messageCount = 0,
  isNightMode = false,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [checklist, setChecklist] = useState({
    chooseArea: false,
    exploreNearby: false,
    createIdentity: true,
    connectHub: isPiConnected,
  });

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('hoimu_starthere_dismissed');
      setIsDismissed(dismissed === 'true');

      const savedChecklist = localStorage.getItem('hoimu_checklist_state');
      if (savedChecklist) {
        setChecklist(JSON.parse(savedChecklist));
      }
    } catch {
      // Ignore storage errors
    }
  }, [isPiConnected]);

  const toggleChecklistItem = (key: keyof typeof checklist) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try {
      localStorage.setItem('hoimu_checklist_state', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('hoimu_starthere_dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  };

  if (isDismissed) return null;

  const callsign = user?.callsign || 'Gunnar';

  return (
    <div
      role="region"
      aria-label="Home Dashboard & Setup Milestones"
      className="space-y-3.5 mb-5 animate-fadeIn"
    >
      {/* CARD 1: State of App / Network & Main Actions */}
      <div
        className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-all duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
              Good day, {callsign}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-medium text-[#588157] dark:text-[#E9C46A]">
              <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
              <span>Your local network is ready</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-[#637062] hover:text-[#203A2A] dark:hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss Home Dashboard overview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mb-4">
          {peerCount > 0 ? `${peerCount} peers nearby` : 'Listening for nearby peers'} •{' '}
          {isPiConnected ? 'Home hub connected' : 'Standalone mode'} • Offline map available
        </p>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              toggleChecklistItem('exploreNearby');
              onNavigateTab('map');
            }}
            className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-[#588157] text-white hover:bg-[#466845] transition-all duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>Explore nearby</span>
          </button>

          <button
            type="button"
            onClick={onOpenChat}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-xs border transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isNightMode
                ? 'border-[#364E30] bg-[#121A10] text-[#F0F5EE] hover:bg-[#1A2517]'
                : 'border-[#87A878]/40 bg-white text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#588157]" />
            <span>Message a peer</span>
          </button>
        </div>
      </div>

      {/* CARD 2: Next Step / Milestone Setup Checklist */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border transition-colors ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E9C46A]" />
            <h3 className="font-display font-bold text-sm sm:text-base">Get started</h3>
          </div>
          {!isPiConnected && (
            <button
              type="button"
              onClick={onOpenPiBridge}
              className="text-xs font-bold text-[#588157] dark:text-[#E9C46A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Set up home hub</span>
            </button>
          )}
        </div>

        {/* Milestone Checklist */}
        <div className="space-y-2 text-xs">
          <button
            type="button"
            onClick={() => toggleChecklistItem('chooseArea')}
            className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              checklist.chooseArea
                ? 'bg-[#588157]/10 border-[#87A878]/30 text-[#203A2A] dark:text-[#F0F5EE]'
                : 'border-gray-200 dark:border-[#364E30] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              {checklist.chooseArea ? (
                <CheckCircle2 className="w-4 h-4 text-[#588157] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#637062] shrink-0" />
              )}
              <span className={checklist.chooseArea ? 'line-through opacity-75' : 'font-medium'}>
                Choose your local area
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#637062]" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleChecklistItem('exploreNearby');
              onNavigateTab('map');
            }}
            className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              checklist.exploreNearby
                ? 'bg-[#588157]/10 border-[#87A878]/30 text-[#203A2A] dark:text-[#F0F5EE]'
                : 'border-gray-200 dark:border-[#364E30] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              {checklist.exploreNearby ? (
                <CheckCircle2 className="w-4 h-4 text-[#588157] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#637062] shrink-0" />
              )}
              <span className={checklist.exploreNearby ? 'line-through opacity-75' : 'font-medium'}>
                Explore what is nearby
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#637062]" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleChecklistItem('createIdentity');
              onNavigateTab('profile');
            }}
            className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              checklist.createIdentity
                ? 'bg-[#588157]/10 border-[#87A878]/30 text-[#203A2A] dark:text-[#F0F5EE]'
                : 'border-gray-200 dark:border-[#364E30] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              {checklist.createIdentity ? (
                <CheckCircle2 className="w-4 h-4 text-[#588157] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#637062] shrink-0" />
              )}
              <span className={checklist.createIdentity ? 'line-through opacity-75' : 'font-medium'}>
                Create your local identity
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#637062]" />
          </button>

          <button
            type="button"
            onClick={onOpenPiBridge}
            className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              isPiConnected
                ? 'bg-[#588157]/10 border-[#87A878]/30 text-[#203A2A] dark:text-[#F0F5EE]'
                : 'border-gray-200 dark:border-[#364E30] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              {isPiConnected ? (
                <CheckCircle2 className="w-4 h-4 text-[#588157] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#637062] shrink-0" />
              )}
              <span className={isPiConnected ? 'line-through opacity-75' : 'font-medium'}>
                Optional: connect a home hub
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#637062]" />
          </button>
        </div>
      </div>

      {/* CARD 3: Your Week / Progress */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border flex items-center justify-between gap-3 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#588157]/15 text-[#588157] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm">Your week</h4>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Helpful actions: {messageCount + (isPiConnected ? 1 : 0) + 2} • Community contribution: rising
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('journal')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#2A3B26] border border-[#87A878]/30 dark:border-[#364E30] text-[#203A2A] dark:text-[#E9C46A] hover:bg-[#FAF6EE] transition-all cursor-pointer shrink-0"
        >
          View progress
        </button>
      </div>
    </div>
  );
};
