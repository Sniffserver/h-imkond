import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, JournalEntry, DaoProposal } from '../types';
import { achievementService, Achievement } from '../services/game/achievementService';
import { progressTracksService, ProgressTrackData } from '../services/game/progressTracksService';
import {
  Award,
  Sparkles,
  Lock,
  CheckCircle2,
  Volume2,
  Share2,
  X,
  Compass,
  Users,
  Radio,
  BookOpen,
  Landmark,
  Check,
  ShieldCheck,
  ChevronRight,
  Sun,
  Flame,
  Sprout,
  HelpCircle,
  Download,
  RotateCcw,
  Shield,
  Clock,
  ExternalLink,
} from 'lucide-react';

export interface AchievementsPanelProps {
  user: UserProfile;
  journal: JournalEntry[];
  proposals?: DaoProposal[];
  isNightMode?: boolean;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  className?: string;
}

type FilterTab = 'unlocked' | 'all' | 'in_progress';
type CategoryFilter = 'all' | 'exploration' | 'community' | 'mesh' | 'reflection' | 'governance';

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  user,
  journal,
  proposals = [],
  isNightMode = false,
  onAddToast,
  className = '',
}) => {
  // Pull achievements directly from achievementService
  const allAchievements = useMemo(() => {
    return achievementService.getAchievements(user, journal, proposals);
  }, [user, journal, proposals]);

  const unlockedBadges = useMemo(() => {
    return allAchievements.filter((a) => a.isUnlocked);
  }, [allAchievements]);

  const inProgressBadges = useMemo(() => {
    return allAchievements.filter((a) => !a.isUnlocked);
  }, [allAchievements]);

  // View & Filter States
  const [activeTab, setActiveTab] = useState<FilterTab>('unlocked');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedMilestone, setSelectedMilestone] = useState<Achievement | null>(null);
  const [isChimePlaying, setIsChimePlaying] = useState(false);
  const [copiedBadgeId, setCopiedBadgeId] = useState<string | null>(null);

  // Private Progress Tracks State
  const [tracksState, setTracksState] = useState<ProgressTrackData>(progressTracksService.getState());
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const unsubscribe = progressTracksService.subscribe((updated) => {
      setTracksState(updated);
    });
    return unsubscribe;
  }, []);

  // Filter list by selected tab & category
  const displayedBadges = useMemo(() => {
    let list = allAchievements;
    if (activeTab === 'unlocked') {
      list = unlockedBadges;
    } else if (activeTab === 'in_progress') {
      list = inProgressBadges;
    }

    if (categoryFilter !== 'all') {
      list = list.filter((b) => b.category === categoryFilter);
    }

    return list;
  }, [allAchievements, unlockedBadges, inProgressBadges, activeTab, categoryFilter]);

  // Overall milestone rank title calculation
  const milestoneRank = useMemo(() => {
    const count = unlockedBadges.length;
    if (count >= 7) return { title: 'Päikesepunk Legend', color: '#E9C46A', icon: '☀️' };
    if (count >= 5) return { title: 'Bioregionaalne Tugisammas', color: '#2A9D8F', icon: '🌳' };
    if (count >= 3) return { title: 'Rajaleidja Meister', color: '#588157', icon: '🧭' };
    if (count >= 1) return { title: 'Tärkav Hõimlane', color: '#87A878', icon: '🌱' };
    return { title: 'Algaja Rändur', color: '#637062', icon: '👣' };
  }, [unlockedBadges.length]);

  // Celebrate all milestones sound & toast
  const handleCelebrate = (badge?: Achievement) => {
    achievementService.playChime();
    setIsChimePlaying(true);
    setTimeout(() => setIsChimePlaying(false), 1200);

    if (onAddToast) {
      if (badge) {
        onAddToast(
          `🎉 Verstapost: ${badge.title}!`,
          `Märk tähistatud. ${badge.milestoneReward || 'Bioregiooni austus ja tunnustus!'}`,
          'success'
        );
      } else {
        onAddToast(
          `✨ Tähistame Hõimu Verstaposte!`,
          `Sul on avatud ${unlockedBadges.length} märki ${allAchievements.length}-st!`,
          'success'
        );
      }
    }
  };

  // Copy achievement proof / share text
  const handleShareBadge = (badge: Achievement) => {
    const shareText = `🏅 Saavutus Hõimu võrgus: "${badge.title}" (${badge.icon})\n${badge.description}\nVerstapost täidetud: ${badge.currentValue}/${badge.targetValue}\nBioregioon: ${user.bioregion || 'Cascadia'}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedBadgeId(badge.id);
      setTimeout(() => setCopiedBadgeId(null), 2500);
      if (onAddToast) {
        onAddToast('📋 Tõend Kopeeritud', `Saavutuse "${badge.title}" tekst kopeeriti lõikelauale!`, 'info');
      }
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'solar':
        return {
          border: 'border-[#E9C46A]',
          bg: isNightMode ? 'bg-[#E9C46A]/15' : 'bg-[#E9C46A]/20',
          text: '#D6A23B',
          ring: 'ring-2 ring-[#E9C46A]/50',
          label: 'Päikeseaste',
        };
      case 'gold':
        return {
          border: 'border-[#E9C46A]/60',
          bg: isNightMode ? 'bg-[#E9C46A]/10' : 'bg-[#E9C46A]/15',
          text: '#E9C46A',
          ring: 'ring-1 ring-[#E9C46A]/40',
          label: 'Kuldmärk',
        };
      case 'silver':
        return {
          border: 'border-[#2A9D8F]/60',
          bg: isNightMode ? 'bg-[#2A9D8F]/10' : 'bg-[#2A9D8F]/15',
          text: '#2A9D8F',
          ring: 'ring-1 ring-[#2A9D8F]/40',
          label: 'Hõbemärk',
        };
      case 'bronze':
      default:
        return {
          border: 'border-[#87A878]/60',
          bg: isNightMode ? 'bg-[#87A878]/10' : 'bg-[#87A878]/15',
          text: '#588157',
          ring: 'ring-1 ring-[#87A878]/40',
          label: 'Pronksmärk',
        };
    }
  };

  return (
    <div
      id="achievements-panel"
      className={`p-5 sm:p-6 rounded-3xl border shadow-xs space-y-5 transition-colors ${
        isNightMode
          ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      } ${className}`}
    >
      {/* Celebration Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#87A878]/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-[#D6A23B] shadow-xs">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
              Meaningful Private Progress
            </h3>
          </div>
          <p className="text-xs text-[#588157]">
            Private, outcome-based progress tracking. No streak loss, no vanity rank grinding, and fully exportable.
          </p>
        </div>

        {/* Export & History controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold cursor-pointer text-[#588157] dark:text-[#A8BDA5]"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Why did this change?</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const data = progressTracksService.exportDataJSON();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `hoimu-progress-backup-${Date.now()}.json`;
              a.click();
              if (onAddToast) onAddToast('Progress Exported', 'Downloaded private progress tracks backup JSON.', 'info');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#87A878]/30 hover:border-[#588157] text-xs font-semibold cursor-pointer text-[#588157]"
            title="Export private progress JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* THREE PRIVATE PROGRESS TRACKS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Track 1: Preparedness */}
        <div className={`p-4 rounded-2xl border space-y-3 ${isNightMode ? 'bg-[#182315] border-[#E76F51]/30' : 'bg-white border-[#E76F51]/25'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#E76F51]/15 text-[#E76F51]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm">Preparedness</h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Offline readiness & survival security</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-[#E76F51]">{tracksState.preparednessLevel}%</span>
          </div>
          <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#E76F51] rounded-full transition-all duration-500" style={{ width: `${tracksState.preparednessLevel}%` }} />
          </div>
          <p className="text-[11px] text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
            Ready for power outages, off-grid navigation, and emergency protocol coordination.
          </p>
        </div>

        {/* Track 2: Connection */}
        <div className={`p-4 rounded-2xl border space-y-3 ${isNightMode ? 'bg-[#182315] border-[#2A9D8F]/30' : 'bg-white border-[#2A9D8F]/25'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm">Connection</h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Trusted local people & radio links</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-[#2A9D8F]">{tracksState.connectionLevel}%</span>
          </div>
          <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#2A9D8F] rounded-full transition-all duration-500" style={{ width: `${tracksState.connectionLevel}%` }} />
          </div>
          <p className="text-[11px] text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
            Linked with trusted neighborhood peers, local mesh radios, and chain of trust signatures.
          </p>
        </div>

        {/* Track 3: Contribution */}
        <div className={`p-4 rounded-2xl border space-y-3 ${isNightMode ? 'bg-[#182315] border-[#588157]/30' : 'bg-white border-[#588157]/25'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#588157]/15 text-[#588157]">
                <Sprout className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm">Contribution</h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Voluntary community aid & sharing</p>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-[#588157]">{tracksState.contributionLevel}%</span>
          </div>
          <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#588157] rounded-full transition-all duration-500" style={{ width: `${tracksState.contributionLevel}%` }} />
          </div>
          <p className="text-[11px] text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
            Strengthening local resilience through mutual aid offers, skill sharing, and civic participation.
          </p>
        </div>
      </div>

      {/* Hero Milestone Metrics & Progress Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26]'
            : 'bg-white/90 border-[#87A878]/30 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Rank and Level */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FAF6EE] to-[#E9C46A]/30 dark:from-[#1E2C1C] dark:to-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-2xl shadow-xs shrink-0">
              {milestoneRank.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#637062] dark:text-[#A8BDA5] font-semibold">
                  Hõimu Tiitel
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E9C46A]/20 text-[#D6A23B] border border-[#E9C46A]/40">
                  <ShieldCheck className="w-3 h-3" />
                  Ametlik Staatus
                </span>
              </div>
              <h4 className="font-display font-black text-sm sm:text-base text-[#203A2A] dark:text-[#F0F5EE]">
                {milestoneRank.title}
              </h4>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-display font-black text-[#588157]">
                {unlockedBadges.length}{' '}
                <span className="text-xs font-medium text-[#637062] dark:text-[#A8BDA5]">
                  / {allAchievements.length}
                </span>
              </span>
              <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] block">
                Märki Avatud ({Math.round((unlockedBadges.length / allAchievements.length) * 100)}%)
              </span>
            </div>

            {/* Circular Progress Ring */}
            <div className="w-12 h-12 relative flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  stroke={isNightMode ? '#2A3B26' : '#FAF6EE'}
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  stroke="#588157"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={
                    2 * Math.PI * 18 * (1 - unlockedBadges.length / allAchievements.length)
                  }
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <Award className="w-4 h-4 text-[#E9C46A] absolute" />
            </div>
          </div>
        </div>

        {/* Global Milestone Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="w-full h-2 rounded-full bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#87A878] via-[#588157] to-[#E9C46A] rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(6, Math.round((unlockedBadges.length / allAchievements.length) * 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
            <span>Alguspunkt</span>
            <span>Järgmine verstapost: {allAchievements.find((a) => !a.isUnlocked)?.title || 'Kõik saavutatud!'}</span>
            <span>Täielik Pühendumus</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Category Selector */}
      <div className="space-y-2.5">
        {/* Main Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-[#87A878]/20">
            <button
              type="button"
              onClick={() => setActiveTab('unlocked')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'unlocked'
                  ? 'bg-[#203A2A] text-white shadow-xs dark:bg-[#588157]'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Avatud märgid</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
                {unlockedBadges.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#203A2A] text-white shadow-xs dark:bg-[#588157]'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Kõik saavutused</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
                {allAchievements.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('in_progress')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'in_progress'
                  ? 'bg-[#203A2A] text-white shadow-xs dark:bg-[#588157]'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Töös</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
                {inProgressBadges.length}
              </span>
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#588157] text-white border-[#588157]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              Kõik kategooriad
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('exploration')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                categoryFilter === 'exploration'
                  ? 'bg-[#E76F51] text-white border-[#E76F51]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Avastamine</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('community')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                categoryFilter === 'community'
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Kogukond</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('reflection')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                categoryFilter === 'reflection'
                  ? 'bg-[#87A878] text-white border-[#87A878]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Päevik</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('governance')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                categoryFilter === 'governance'
                  ? 'bg-[#D6A23B] text-white border-[#D6A23B]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Landmark className="w-3 h-3" />
              <span>DAO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State when no badges match filter */}
      {displayedBadges.length === 0 && (
        <div
          className={`p-8 rounded-2xl border text-center space-y-3 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/70 border-[#87A878]/25'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-[#87A878]/15 flex items-center justify-center text-2xl">
            🌱
          </div>
          <h4 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
            {activeTab === 'unlocked'
              ? 'Selles vaates pole veel avatud märke'
              : 'Saavutusi ei leitud valitud filtriga'}
          </h4>
          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] max-w-sm mx-auto">
            {activeTab === 'unlocked'
              ? 'Kõnni oma piirkonnas ringi, jaga kohalikke ressursse või kirjuta päevikusse, et avada oma esimesed märgid!'
              : 'Vali teine kategooria või vaheta vaadet, et näha kõiki võimalikke verstaposte.'}
          </p>
          {activeTab === 'unlocked' && (
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="px-4 py-2 bg-[#203A2A] dark:bg-[#588157] text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition-all"
            >
              Vaata kõiki verstaposte
            </button>
          )}
        </div>
      )}

      {/* Badges Grid */}
      {displayedBadges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {displayedBadges.map((badge) => {
            const tierStyle = getTierColor(badge.tier);

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedMilestone(badge)}
                className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between space-y-3 cursor-pointer group ${
                  badge.isUnlocked
                    ? isNightMode
                      ? 'bg-[#253821] border-[#E9C46A]/40 hover:border-[#E9C46A] shadow-xs'
                      : 'bg-white border-[#D6A23B]/35 hover:border-[#D6A23B] shadow-xs'
                    : isNightMode
                    ? 'bg-[#151D14]/60 border-white/5 opacity-70 hover:opacity-90'
                    : 'bg-black/5 border-black/5 opacity-65 hover:opacity-85'
                }`}
              >
                {/* Background glow for unlocked badges */}
                {badge.isUnlocked && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#E9C46A]/15 to-transparent pointer-events-none" />
                )}

                {/* Top Row: Icon + Title + Tier */}
                <div className="flex items-start gap-3">
                  {/* Badge Medallion */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl select-none shrink-0 transition-transform group-hover:scale-105 relative ${
                      badge.isUnlocked
                        ? `${tierStyle.bg} ${tierStyle.border} border-2 ${tierStyle.ring} shadow-md`
                        : 'bg-black/10 dark:bg-white/10 filter grayscale'
                    }`}
                  >
                    {badge.icon}
                    {badge.isUnlocked && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#588157] text-white border-2 border-white dark:border-[#253821] flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display font-bold text-sm leading-tight text-[#203A2A] dark:text-[#F0F5EE] truncate">
                        {badge.title}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${tierStyle.bg} ${tierStyle.border}`}
                        style={{ color: tierStyle.text }}
                      >
                        {tierStyle.label}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Progress + Celebrate Action */}
                <div className="space-y-2 pt-1 border-t border-[#87A878]/15">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        badge.isUnlocked
                          ? 'text-[#588157] dark:text-[#87A878]'
                          : 'text-[#637062] dark:text-[#A8BDA5]'
                      }`}
                    >
                      {badge.isUnlocked ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#588157]" />
                          <span>Verstapost Saavutatud!</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-[#637062]" />
                          <span>Pooleli</span>
                        </>
                      )}
                    </span>

                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                      {badge.currentValue} / {badge.targetValue}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        badge.isUnlocked
                          ? 'bg-gradient-to-r from-[#588157] to-[#E9C46A]'
                          : 'bg-[#637062]/50'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(badge.isUnlocked ? 100 : 4, badge.progressPercent))}%` }}
                    />
                  </div>

                  {/* Actions strip inside card */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[9px] font-mono text-[#588157] dark:text-[#87A878]">
                      {badge.milestoneReward || '+10 Sümbioosipunkti'}
                    </span>

                    {badge.isUnlocked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCelebrate(badge);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.8 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 text-[#D6A23B] border border-[#E9C46A]/40 transition-all cursor-pointer"
                        title="Tähista seda märki helinaga"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Tähista</span>
                      </button>
                    ) : (
                      <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] italic flex items-center gap-1">
                        <span>Vaata juhendit</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Milestone Detail Celebration Modal */}
      {selectedMilestone && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedMilestone(null)}
        >
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl relative space-y-5 ${
              isNightMode
                ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
                : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedMilestone(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#637062] dark:text-[#A8BDA5] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header & Medallion */}
            <div className="text-center space-y-3 pt-2">
              <div className="relative inline-block">
                <div
                  className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-xl ${
                    selectedMilestone.isUnlocked
                      ? 'bg-gradient-to-tr from-[#FAF6EE] via-[#E9C46A]/30 to-[#588157]/30 border-2 border-[#E9C46A] ring-4 ring-[#E9C46A]/30'
                      : 'bg-black/10 dark:bg-white/10 filter grayscale border-2 border-black/20'
                  }`}
                >
                  {selectedMilestone.icon}
                </div>
                {selectedMilestone.isUnlocked && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#E9C46A] text-[#203A2A] border-2 border-white dark:border-[#1E2C1C] flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div>
                <span
                  className="text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: selectedMilestone.isUnlocked ? 'rgba(233,196,106,0.15)' : 'rgba(0,0,0,0.05)',
                    color: selectedMilestone.isUnlocked ? '#D6A23B' : '#637062',
                    borderColor: selectedMilestone.isUnlocked ? 'rgba(233,196,106,0.4)' : 'transparent',
                  }}
                >
                  {selectedMilestone.isUnlocked ? '✓ Verstapost Saavutatud' : '🔒 Lukustatud Verstapost'}
                </span>
                <h3 className="font-display font-black text-xl text-[#203A2A] dark:text-[#F0F5EE] mt-1">
                  {selectedMilestone.title}
                </h3>
              </div>
            </div>

            {/* Milestone Description & Lore */}
            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs ${
                isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/30'
              }`}
            >
              <p className="font-medium text-[#203A2A] dark:text-[#F0F5EE] leading-relaxed">
                {selectedMilestone.description}
              </p>

              {selectedMilestone.hint && (
                <div className="pt-2 border-t border-[#87A878]/20 flex items-start gap-2 text-[11px] text-[#588157]">
                  <Compass className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>Kuidas täita:</strong> {selectedMilestone.hint}
                  </span>
                </div>
              )}

              {selectedMilestone.milestoneReward && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#D6A23B] pt-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Tunnustus: {selectedMilestone.milestoneReward}</span>
                </div>
              )}
            </div>

            {/* Progress Section */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-[#637062] dark:text-[#A8BDA5]">Verstaposti progress:</span>
                <span className={selectedMilestone.isUnlocked ? 'text-[#588157]' : 'text-[#E76F51]'}>
                  {selectedMilestone.currentValue} / {selectedMilestone.targetValue} ({Math.round(selectedMilestone.progressPercent)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    selectedMilestone.isUnlocked
                      ? 'bg-gradient-to-r from-[#588157] to-[#E9C46A]'
                      : 'bg-[#2A9D8F]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(selectedMilestone.isUnlocked ? 100 : 5, selectedMilestone.progressPercent))}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {selectedMilestone.isUnlocked && (
                <button
                  type="button"
                  onClick={() => handleCelebrate(selectedMilestone)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#203A2A] dark:bg-[#588157] text-white text-xs font-bold rounded-2xl shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Helista tähistuskella</span>
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleShareBadge(selectedMilestone)}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 border text-xs font-semibold rounded-2xl transition-all cursor-pointer ${
                  copiedBadgeId === selectedMilestone.id
                    ? 'bg-[#588157] text-white border-[#588157]'
                    : isNightMode
                    ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:border-[#87A878]'
                    : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
                }`}
              >
                {copiedBadgeId === selectedMilestone.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>Kopeeritud!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#588157]" />
                    <span>Jaga tõendit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHY DID THIS CHANGE? / EXPLANATION LOG MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 space-y-4 shadow-2xl relative ${
              isNightMode ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]' : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#588157] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#588157]/20 text-[#588157]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Why Did My Progress Change?</h3>
                <p className="text-xs text-[#588157]">Full audit log of outcomes that influenced your 3 private tracks.</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {tracksState.history.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#588157]">No recent progress updates recorded yet.</div>
              ) : (
                tracksState.history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#203A2A] dark:text-[#F0F5EE]">{item.title}</span>
                      <span className="font-mono text-[#588157]">+{item.deltaPercent}% {item.track}</span>
                    </div>
                    <p className="text-[#588157] dark:text-[#A8BDA5] leading-relaxed">{item.explanation}</p>
                    <div className="text-[10px] text-[#637062] pt-0.5">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#87A878]/20">
              <button
                type="button"
                onClick={() => {
                  progressTracksService.resetProgress();
                  if (onAddToast) onAddToast('Tracks Reset', 'Your private progress history was cleared.', 'info');
                  setShowHistoryModal(false);
                }}
                className="text-xs text-[#E76F51] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Private Progress</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-[#588157] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
