import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  Radio,
  Send,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  X,
  AlertTriangle,
} from 'lucide-react';
import { NavTab } from '../types';

interface StartHereDashboardProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenPiBridge: () => void;
  onOpenChat: () => void;
  onOpenSos: () => void;
  isPiConnected?: boolean;
  peerCount?: number;
  messageCount?: number;
  isNightMode?: boolean;
}

export const StartHereDashboard: React.FC<StartHereDashboardProps> = ({
  onNavigateTab,
  onOpenPiBridge,
  onOpenChat,
  onOpenSos,
  isPiConnected = false,
  peerCount = 0,
  messageCount = 0,
  isNightMode = false,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('hoimu_starthere_dismissed');
      setIsDismissed(dismissed === 'true');
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('hoimu_starthere_dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  };

  if (isDismissed) return null;

  // Calculate 3 milestone steps
  const step1Done = true; // Profile / cryptographic key auto-created
  const step2Done = isPiConnected || peerCount > 0;
  const step3Done = messageCount > 0;

  const completedCount = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

  return (
    <div
      role="region"
      aria-label="Start Here Field Terminal Readiness Guide"
      className={`p-5 rounded-3xl border shadow-md relative overflow-hidden transition-all duration-200 mb-4 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Background ambient accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#588157]/10 blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/20 text-[#588157]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
              Start Here: Field Readiness Guide
            </h2>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Get your zero-cloud terminal operational in 3 quick steps
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-full text-[#637062] hover:text-[#203A2A] dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss Start Here guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 mb-4 relative z-10">
        <div className="flex justify-between text-xs font-mono font-semibold">
          <span className="text-[#637062] dark:text-[#A8BDA5]">Milestone Progress</span>
          <span className="text-[#588157] dark:text-[#E9C46A]">{progressPercent}% ({completedCount}/3 Complete)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#588157] to-[#E9C46A] transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3 Step Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 relative z-10">
        {/* Step 1 */}
        <div
          className={`p-3 rounded-2xl border flex flex-col justify-between text-xs transition-colors ${
            step1Done
              ? isNightMode
                ? 'bg-[#121A10] border-[#364E30]/80'
                : 'bg-white/80 border-[#87A878]/30'
              : 'border-dashed border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold text-[#637062]">Step 1</span>
            <CheckCircle2 className="w-4 h-4 text-[#588157]" />
          </div>
          <p className="font-bold text-[#203A2A] dark:text-[#F0F5EE] mb-1">
            Cryptographic Keys Initialized
          </p>
          <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
            Curve25519 identity key generated for packet signing.
          </p>
        </div>

        {/* Step 2 */}
        <div
          onClick={onOpenPiBridge}
          className={`p-3 rounded-2xl border flex flex-col justify-between text-xs transition-all cursor-pointer hover:scale-[1.02] ${
            step2Done
              ? isNightMode
                ? 'bg-[#121A10] border-[#364E30]/80'
                : 'bg-white/80 border-[#87A878]/30'
              : isNightMode
              ? 'bg-[#121A10]/50 border-[#E9C46A]/50'
              : 'bg-amber-50/80 border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold text-[#637062]">Step 2</span>
            {step2Done ? (
              <CheckCircle2 className="w-4 h-4 text-[#588157]" />
            ) : (
              <Cpu className="w-4 h-4 text-[#E76F51] animate-pulse" />
            )}
          </div>
          <p className="font-bold text-[#203A2A] dark:text-[#F0F5EE] mb-1">
            {step2Done ? 'Mesh Bridge Paired' : 'Pair Pi Radio Bridge'}
          </p>
          <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
            {step2Done
              ? 'Connected to field hardware node.'
              : 'Connect via PIN pairing to expand 868MHz LoRa reach.'}
          </p>
        </div>

        {/* Step 3 */}
        <div
          onClick={onOpenChat}
          className={`p-3 rounded-2xl border flex flex-col justify-between text-xs transition-all cursor-pointer hover:scale-[1.02] ${
            step3Done
              ? isNightMode
                ? 'bg-[#121A10] border-[#364E30]/80'
                : 'bg-white/80 border-[#87A878]/30'
              : isNightMode
              ? 'bg-[#121A10]/50 border-[#364E30]'
              : 'bg-white/60 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold text-[#637062]">Step 3</span>
            {step3Done ? (
              <CheckCircle2 className="w-4 h-4 text-[#588157]" />
            ) : (
              <Send className="w-4 h-4 text-[#588157]" />
            )}
          </div>
          <p className="font-bold text-[#203A2A] dark:text-[#F0F5EE] mb-1">
            Send Encrypted Message
          </p>
          <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
            {step3Done ? 'First mesh packet dispatched.' : 'Send a store & forward message or broadcast.'}
          </p>
        </div>
      </div>

      {/* Quick Links Bar */}
      <div className="pt-3 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs relative z-10">
        <span className="font-bold text-[#203A2A] dark:text-[#E9C46A]">Critical Action Quick-Launch:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSos}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E76F51] text-white font-bold hover:bg-[#D65D3F] transition-all cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Emergency SOS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('mesh')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 font-medium hover:bg-black/10 transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-[#588157]" />
            <span>Mesh Radar</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
