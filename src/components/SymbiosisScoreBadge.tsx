import React, { useState, useEffect } from 'react';
import { Shield, Users, HeartHandshake, Lock, Sparkles, HelpCircle, ChevronRight } from 'lucide-react';
import {
  progressTracksService,
  ProgressTrackData,
} from '../services/game/progressTracksService';
import { ProgressTracksModal } from './ProgressTracksModal';

export interface SymbiosisScoreBadgeProps {
  score?: number;
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
  isNightMode?: boolean;
  onNavigateTab?: (target: string) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const SymbiosisScoreBadge: React.FC<SymbiosisScoreBadgeProps> = ({
  score,
  delta,
  size = 'md',
  isNightMode = false,
  onNavigateTab,
  onAddToast,
}) => {
  const [tracksState, setTracksState] = useState<ProgressTrackData>(progressTracksService.getState());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = progressTracksService.subscribe((updated) => {
      setTracksState(updated);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <button
        type="button"
        id="symbiosis-score-badge"
        onClick={() => setIsModalOpen(true)}
        title="View Three Private Progress Tracks: Preparedness, Connection, and Contribution"
        className={`group text-left rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98 ${
          isNightMode
            ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A] hover:bg-[#F0F5EE]'
        } ${
          size === 'sm'
            ? 'px-2.5 py-1.5'
            : size === 'lg'
            ? 'px-4 py-3'
            : 'px-3.5 py-2'
        }`}
      >
        {size === 'sm' ? (
          <div className="flex items-center gap-2">
            {/* 3 mini track indicators */}
            <div className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full bg-[#2A9D8F]"
                title={`Preparedness: ${tracksState.preparednessLevel}%`}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#588157]"
                title={`Connection: ${tracksState.connectionLevel}%`}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#E76F51]"
                title={`Contribution: ${tracksState.contributionLevel}%`}
              />
            </div>
            <div className="text-[10px] font-mono font-bold text-[#588157]">
              {tracksState.preparednessLevel}% • {tracksState.connectionLevel}% • {tracksState.contributionLevel}%
            </div>
          </div>
        ) : size === 'lg' ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 border-b border-current/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#2A9D8F]" />
                <span className="text-[11px] font-bold font-display uppercase tracking-wider">
                  Private Progress Tracks
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#588157] dark:text-[#A8BDA5] flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>{tracksState.isPublicSharingOptIn ? 'Opt-In Shared' : 'Private'}</span>
              </span>
            </div>

            {/* 3 Track Bars */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* 1. Preparedness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-[#2A9D8F]">Prepared</span>
                  <span className="font-mono font-bold">{tracksState.preparednessLevel}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#2A9D8F] rounded-full transition-all duration-300"
                    style={{ width: `${tracksState.preparednessLevel}%` }}
                  />
                </div>
              </div>

              {/* 2. Connection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-[#588157]">Connected</span>
                  <span className="font-mono font-bold">{tracksState.connectionLevel}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#588157] rounded-full transition-all duration-300"
                    style={{ width: `${tracksState.connectionLevel}%` }}
                  />
                </div>
              </div>

              {/* 3. Contribution */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-[#E76F51]">Contributed</span>
                  <span className="font-mono font-bold">{tracksState.contributionLevel}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#E76F51] rounded-full transition-all duration-300"
                    style={{ width: `${tracksState.contributionLevel}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5] pt-0.5">
              <span>Click to view "Why did this change?" audit</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        ) : (
          /* Default md layout */
          <div className="flex items-center gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#637062] dark:text-[#A8BDA5] font-semibold uppercase tracking-wider">
                <span>Progress Tracks</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 font-mono">
                  {tracksState.isPublicSharingOptIn ? 'Shared' : 'Private'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="text-[#2A9D8F]" title="Preparedness">
                  {tracksState.preparednessLevel}%
                </span>
                <span className="text-current/30">•</span>
                <span className="text-[#588157]" title="Connection">
                  {tracksState.connectionLevel}%
                </span>
                <span className="text-current/30">•</span>
                <span className="text-[#E76F51]" title="Contribution">
                  {tracksState.contributionLevel}%
                </span>
              </div>
            </div>

            <div className="w-px h-6 bg-current/10" />

            <div className="flex flex-col gap-1 w-12">
              <div className="w-full h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-[#2A9D8F]" style={{ width: `${tracksState.preparednessLevel}%` }} />
              </div>
              <div className="w-full h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-[#588157]" style={{ width: `${tracksState.connectionLevel}%` }} />
              </div>
              <div className="w-full h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-[#E76F51]" style={{ width: `${tracksState.contributionLevel}%` }} />
              </div>
            </div>
          </div>
        )}
      </button>

      {/* Interactive Detail Modal */}
      {isModalOpen && (
        <ProgressTracksModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isNightMode={isNightMode}
          onNavigateTab={onNavigateTab}
          onAddToast={onAddToast}
        />
      )}
    </>
  );
};
