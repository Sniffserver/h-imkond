import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  HeartHandshake,
  Lock,
  Globe2,
  CheckCircle2,
  ArrowRight,
  Info,
  X,
  Sparkles,
  HelpCircle,
  Clock,
  RotateCcw,
  Compass,
  Radio,
  Package,
  KeyRound,
  FileText,
  Sliders,
  Check,
} from 'lucide-react';
import {
  progressTracksService,
  ProgressTrackData,
  ProgressTrackCategory,
  TRACK_DEFINITIONS,
  TrackChangeReason,
} from '../services/game/progressTracksService';

export interface ProgressTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightMode?: boolean;
  onNavigateTab?: (target: string) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const ProgressTracksModal: React.FC<ProgressTracksModalProps> = ({
  isOpen,
  onClose,
  isNightMode = false,
  onNavigateTab,
  onAddToast,
}) => {
  const [tracksState, setTracksState] = useState<ProgressTrackData>(progressTracksService.getState());
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<ProgressTrackCategory | 'all'>('all');
  const [activeExplainer, setActiveExplainer] = useState<ProgressTrackCategory | null>(null);
  const [showSimulateAction, setShowSimulateAction] = useState(false);

  useEffect(() => {
    const unsubscribe = progressTracksService.subscribe((updated) => {
      setTracksState(updated);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleToggleOptIn = () => {
    const nextOptIn = !tracksState.isPublicSharingOptIn;
    progressTracksService.setPublicOptIn(nextOptIn);
    if (onAddToast) {
      onAddToast(
        nextOptIn ? 'Community Goal Contribution Enabled' : 'Private Mode Maintained',
        nextOptIn
          ? 'Your local milestones now anonymously contribute to neighborhood resilience counters.'
          : 'Your progress tracks remain completely private to this device.',
        'info'
      );
    }
  };

  const handleSimulateEvent = (
    track: ProgressTrackCategory,
    delta: number,
    title: string,
    explanation: string,
    actionLabel: string,
    actionTarget: string
  ) => {
    progressTracksService.recordProgress(track, delta, title, explanation, actionLabel, actionTarget);
    if (onAddToast) {
      onAddToast(
        `${TRACK_DEFINITIONS[track].name} Updated (+${delta}%)`,
        explanation,
        'success'
      );
    }
  };

  const filteredHistory = tracksState.history.filter((entry) => {
    if (selectedTrackFilter === 'all') return true;
    return entry.track === selectedTrackFilter;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-tracks-title"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        {/* Header */}
        <div
          className={`p-5 sm:p-6 border-b flex items-center justify-between gap-4 shrink-0 ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#588157]/15 text-[#588157] dark:text-[#A8BDA5]">
                <Shield className="w-5 h-5 text-[#2A9D8F]" />
              </span>
              <h2 id="progress-tracks-title" className="font-display font-extrabold text-lg sm:text-xl tracking-tight">
                Three Private Progress Tracks
              </h2>
            </div>
            <p className="text-xs text-[#588157] dark:text-[#A8BDA5]">
              Meaningful off-grid progress without turning your experience into a competitive points race.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-[#637062] hover:text-[#203A2A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Privacy Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isNightMode
                ? 'bg-[#1E2C1C] border-[#364E30]'
                : 'bg-white/80 border-[#87A878]/30 shadow-2xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F] shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block text-xs">
                  {tracksState.isPublicSharingOptIn
                    ? 'Anonymous Community Contribution: Active'
                    : '100% Private Local Storage (Default)'}
                </span>
                <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed mt-0.5">
                  {tracksState.isPublicSharingOptIn
                    ? 'Your device contributes anonymous aggregate counters to neighborhood resilience goals. No personal stats or names are ever broadcast.'
                    : 'Your progress tracks are stored purely on your device. No cloud servers, no leaderboards, and no peer comparison.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleOptIn}
              className={`px-3.5 py-1.5 rounded-xl border font-bold text-xs shrink-0 cursor-pointer transition-all ${
                tracksState.isPublicSharingOptIn
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                  : isNightMode
                  ? 'bg-[#121A10] border-[#364E30] text-[#A8BDA5] hover:border-[#87A878]'
                  : 'bg-white border-[#87A878]/40 text-[#203A2A] hover:bg-[#FAF6EE]'
              }`}
            >
              {tracksState.isPublicSharingOptIn ? 'Opt-Out (Go Private)' : 'Opt-In to Community Goals'}
            </button>
          </div>

          {/* 3 Core Progress Tracks Cards */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm tracking-tight flex items-center justify-between">
              <span>Your Personal Tracks</span>
              <span className="text-[11px] font-mono text-[#588157]">Private State</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Track 1: Preparedness */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  isNightMode ? 'bg-[#1E2C1C] border-[#364E30]' : 'bg-white border-[#87A878]/25 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F]">
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-xs">Preparedness</div>
                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Emergency Readiness</div>
                      </div>
                    </div>
                    <span className="font-display font-black text-base text-[#2A9D8F]">
                      {tracksState.preparednessLevel}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                    How ready you are for offline/emergency use (maps, guides, backup power).
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#2A9D8F] rounded-full transition-all duration-500"
                      style={{ width: `${tracksState.preparednessLevel}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveExplainer(activeExplainer === 'preparedness' ? null : 'preparedness')}
                    className="w-full text-center text-[10px] font-bold text-[#2A9D8F] hover:underline cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>{activeExplainer === 'preparedness' ? 'Hide Details' : 'Why did this change?'}</span>
                  </button>
                </div>
              </div>

              {/* Track 2: Connection */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  isNightMode ? 'bg-[#1E2C1C] border-[#364E30]' : 'bg-white border-[#87A878]/25 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-[#588157]/15 text-[#588157]">
                        <Users className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-xs">Connection</div>
                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Local Peer Trust</div>
                      </div>
                    </div>
                    <span className="font-display font-black text-base text-[#588157]">
                      {tracksState.connectionLevel}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                    How well you're connected to trusted local people via direct radio hops.
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#588157] rounded-full transition-all duration-500"
                      style={{ width: `${tracksState.connectionLevel}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveExplainer(activeExplainer === 'connection' ? null : 'connection')}
                    className="w-full text-center text-[10px] font-bold text-[#588157] hover:underline cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>{activeExplainer === 'connection' ? 'Hide Details' : 'Why did this change?'}</span>
                  </button>
                </div>
              </div>

              {/* Track 3: Contribution */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  isNightMode ? 'bg-[#1E2C1C] border-[#364E30]' : 'bg-white border-[#87A878]/25 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-[#E76F51]/15 text-[#E76F51]">
                        <HeartHandshake className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-xs">Contribution</div>
                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Voluntary Mutual Aid</div>
                      </div>
                    </div>
                    <span className="font-display font-black text-base text-[#E76F51]">
                      {tracksState.contributionLevel}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                    How you help the community by your voluntary choice (tools, power, skills).
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#E76F51] rounded-full transition-all duration-500"
                      style={{ width: `${tracksState.contributionLevel}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveExplainer(activeExplainer === 'contribution' ? null : 'contribution')}
                    className="w-full text-center text-[10px] font-bold text-[#E76F51] hover:underline cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>{activeExplainer === 'contribution' ? 'Hide Details' : 'Why did this change?'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Explainer Callout (Why did this change?) */}
          {activeExplainer && (
            <div
              className={`p-4 rounded-2xl border space-y-3 animate-in fade-in duration-150 ${
                isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-white border-[#87A878]/30 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between border-b border-current/10 pb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#588157]" />
                  <span className="font-bold text-xs">
                    About {TRACK_DEFINITIONS[activeExplainer].name}: {TRACK_DEFINITIONS[activeExplainer].tagline}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExplainer(null)}
                  className="text-[#637062] hover:text-[#203A2A] dark:hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                {TRACK_DEFINITIONS[activeExplainer].description}
              </p>

              <div>
                <span className="font-bold text-[10px] uppercase tracking-wider block text-[#588157] mb-1">
                  Actions that positively influence this track:
                </span>
                <ul className="space-y-1 text-[11px]">
                  {TRACK_DEFINITIONS[activeExplainer].examples.map((ex, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* History / "Why did this change?" Audit Log */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm tracking-tight flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#588157]" />
                <span>Track Audit & History Log</span>
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[#87A878]/20">
                {(['all', 'preparedness', 'connection', 'contribution'] as const).map((filter) => {
                  const isSelected = selectedTrackFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSelectedTrackFilter(filter)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg capitalize cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#588157] text-white shadow-2xs'
                          : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {filteredHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#637062] border border-dashed rounded-2xl">
                  No logged changes for this track yet.
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const def = TRACK_DEFINITIONS[item.track];
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isNightMode
                          ? 'bg-[#1E2C1C] border-[#2A3B26]'
                          : 'bg-white border-[#87A878]/20 shadow-2xs'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold capitalize"
                            style={{ backgroundColor: `${def.color}20`, color: def.color }}
                          >
                            {item.track}
                          </span>
                          <span className="font-bold text-xs">{item.title}</span>
                          <span className="font-mono text-[10px] font-bold text-[#2A9D8F]">
                            +{item.deltaPercent}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                          {item.explanation}
                        </p>
                        <span className="text-[9px] text-[#637062]/80 dark:text-[#A8BDA5]/80 font-mono block">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {item.actionLabel && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateTab && item.actionTarget) {
                              onNavigateTab(item.actionTarget);
                              onClose();
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 ${
                            isNightMode
                              ? 'bg-[#121A10] border-[#364E30] text-[#E9C46A] hover:border-[#E9C46A]'
                              : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A] hover:bg-[#F0F5EE]'
                          }`}
                        >
                          <span>{item.actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Simulation & Test Suite (Expandable) */}
          <div className="border-t border-current/10 pt-4">
            <button
              type="button"
              onClick={() => setShowSimulateAction(!showSimulateAction)}
              className="text-xs font-bold text-[#588157] dark:text-[#A8BDA5] hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showSimulateAction ? 'Hide Practice Action Triggers' : 'Try Real-World Simulation Triggers'}</span>
            </button>

            {showSimulateAction && (
              <div className="mt-3 p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-current/10 space-y-2">
                <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                  Test how voluntary real-world activities reflect in your 3 tracks:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSimulateEvent(
                        'preparedness',
                        8,
                        'Regional Off-Grid Terrain Cached',
                        'Added offline emergency topography layer for Tartu forest corridor.',
                        'View Map',
                        'map'
                      )
                    }
                    className="p-2 rounded-xl border text-left bg-white dark:bg-[#182315] hover:border-[#2A9D8F] cursor-pointer"
                  >
                    <div className="font-bold text-[11px] text-[#2A9D8F]">+8% Preparedness</div>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Download Map Chunk</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSimulateEvent(
                        'connection',
                        10,
                        'Radio Key Signed with Neighbor',
                        'Completed bilateral ECDSA key handshake with node "Birch-Watcher".',
                        'View Peers',
                        'mesh'
                      )
                    }
                    className="p-2 rounded-xl border text-left bg-white dark:bg-[#182315] hover:border-[#588157] cursor-pointer"
                  >
                    <div className="font-bold text-[11px] text-[#588157]">+10% Connection</div>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Trust Peer Key</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSimulateEvent(
                        'contribution',
                        12,
                        'Mutual Aid Seed Stock Listed',
                        'Offered heirloom cold-hardy squash seeds for neighborhood swap.',
                        'View Exchange',
                        'exchange'
                      )
                    }
                    className="p-2 rounded-xl border text-left bg-white dark:bg-[#182315] hover:border-[#E76F51] cursor-pointer"
                  >
                    <div className="font-bold text-[11px] text-[#E76F51]">+12% Contribution</div>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">List Resource</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 shrink-0 ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-[#637062] dark:text-[#A8BDA5]">
            <Check className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Zero streak penalties • No leaderboard pressure</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#588157] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#476a46] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
