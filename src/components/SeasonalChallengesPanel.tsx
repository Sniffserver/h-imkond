import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { seasonalChallengeService, SeasonalChallenge } from '../services/game/seasonalChallengeService';
import { mapRevealService } from '../services/map/mapRevealService';
import { Calendar, Award, Sparkles, CheckCircle2, ChevronRight, HelpCircle, RefreshCw, Sun, CloudRain, Snowflake, Leaf, Check } from 'lucide-react';

interface SeasonalChallengesPanelProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  isNightMode?: boolean;
}

export const SeasonalChallengesPanel: React.FC<SeasonalChallengesPanelProps> = ({
  user,
  onUpdateUser,
  onAddToast,
  isNightMode = false,
}) => {
  // Use current real month as initial season
  const realSeason = seasonalChallengeService.getCurrentSeason();
  const [selectedSeason, setSelectedSeason] = useState<'spring' | 'summer' | 'autumn' | 'winter'>(realSeason);
  const [challenges, setChallenges] = useState<SeasonalChallenge[]>([]);
  const [winterChecklist, setWinterChecklist] = useState<{ id: string; label: string; completed: boolean }[]>([]);
  const [showCelebrationBadge, setShowCelebrationBadge] = useState<string | null>(null);

  // Load challenges and checklist
  const loadState = () => {
    const revealedAreasCount = mapRevealService.getRevealedAreas().length;
    
    // Sync each challenge progress based on state
    seasonalChallengeService.syncProgressWithAppState('spring', user, revealedAreasCount);
    seasonalChallengeService.syncProgressWithAppState('autumn', user, revealedAreasCount);
    seasonalChallengeService.syncProgressWithAppState('winter', user, revealedAreasCount);

    const list = seasonalChallengeService.getChallenges(user, revealedAreasCount);
    setChallenges(list);
    setWinterChecklist(seasonalChallengeService.getWinterChecklist());
  };

  useEffect(() => {
    loadState();
  }, [user]);

  // Handle Winter Checklist Item Click
  const handleToggleWinterChecklist = (id: string) => {
    const updated = winterChecklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setWinterChecklist(updated);
    seasonalChallengeService.saveWinterChecklist(updated);

    // Calculate next progress
    const nextProgress = updated.filter((item) => item.completed).length;
    checkChallengeCompletion('winter', nextProgress, 3);
  };

  // Check and trigger completion sound & celebration
  const checkChallengeCompletion = (challengeId: string, current: number, target: number) => {
    if (current >= target && !seasonalChallengeService.isBadgeUnlocked(challengeId)) {
      seasonalChallengeService.unlockBadge(challengeId);
      seasonalChallengeService.playSeasonalChime();
      
      const ch = challenges.find((c) => c.id === challengeId);
      if (ch && onAddToast) {
        onAddToast(
          `🎉 Hooajaline Väljakutse Läbitud!`,
          `Saavutasid märgi: ${ch.rewardBadge} ${ch.rewardBadgeIcon}!`,
          'success'
        );
      }
      setShowCelebrationBadge(challengeId);
      loadState();
    } else {
      loadState();
    }
  };

  // Simulation actions for other challenges to make them interactive
  const handleSimulateSpringPark = () => {
    const current = seasonalChallengeService.getProgress('spring');
    if (current < 3) {
      const next = current + 1;
      seasonalChallengeService.saveProgress('spring', next);
      checkChallengeCompletion('spring', next, 3);
    }
  };

  const handleSimulateSummerDay = () => {
    const current = seasonalChallengeService.getProgress('summer');
    if (current < 5) {
      const next = current + 1;
      seasonalChallengeService.saveProgress('summer', next);
      checkChallengeCompletion('summer', next, 5);
    }
  };

  const handleResetChallengeProgress = () => {
    seasonalChallengeService.resetAllProgress();
    if (onAddToast) {
      onAddToast('Taastatud', 'Hooajaliste väljakutsete edusammud on nullitud.', 'info');
    }
    loadState();
  };

  const activeChallenge = challenges.find((c) => c.season === selectedSeason);

  // Season decorations
  const getSeasonTheme = (season: 'spring' | 'summer' | 'autumn' | 'winter') => {
    switch (season) {
      case 'spring':
        return {
          icon: <Leaf className="w-5 h-5 text-emerald-500" />,
          color: 'from-emerald-500/10 to-teal-500/10',
          borderColor: 'border-emerald-500/30',
          accentColor: 'text-emerald-600',
          badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        };
      case 'summer':
        return {
          icon: <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" />,
          color: 'from-amber-500/10 to-orange-500/10',
          borderColor: 'border-amber-500/30',
          accentColor: 'text-amber-600',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/30',
        };
      case 'autumn':
        return {
          icon: <Leaf className="w-5 h-5 text-orange-600" />,
          color: 'from-orange-500/10 to-red-500/10',
          borderColor: 'border-orange-500/30',
          accentColor: 'text-orange-600',
          badgeBg: 'bg-orange-50 dark:bg-orange-950/30',
        };
      case 'winter':
        return {
          icon: <Snowflake className="w-5 h-5 text-sky-500" />,
          color: 'from-sky-500/10 to-indigo-500/10',
          borderColor: 'border-sky-500/30',
          accentColor: 'text-sky-600',
          badgeBg: 'bg-sky-50 dark:bg-sky-950/30',
        };
    }
  };

  const theme = activeChallenge ? getSeasonTheme(activeChallenge.season) : getSeasonTheme('autumn');
  const progressValue = activeChallenge ? seasonalChallengeService.getProgress(activeChallenge.id) : 0;
  const targetValue = activeChallenge ? activeChallenge.targetValue : 1;
  const isUnlocked = activeChallenge ? (seasonalChallengeService.isBadgeUnlocked(activeChallenge.id) || progressValue >= targetValue) : false;
  const progressPercent = Math.min(100, (progressValue / targetValue) * 100);

  return (
    <div
      className={`p-5 rounded-3xl border shadow-xs space-y-5 transition-all duration-300 relative overflow-hidden ${
        isNightMode
          ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Background decoration */}
      <div className={`absolute -right-24 -top-24 w-48 h-48 rounded-full bg-gradient-to-br ${theme.color} blur-3xl opacity-60 pointer-events-none`} />

      {/* Header Block */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#87A878]/20 pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/20">
              {theme.icon}
            </span>
            <h3 className="font-display font-black text-base tracking-tight">
              Hooajalised Solarpunk Väljakutsed
            </h3>
          </div>
          <p className="text-xs text-[#588157]">
            Ühised hooajalised tegevused, mis tugevdavad sidet looduse ja naabritega.
          </p>
        </div>

        {/* Season Selector Tabs */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[#87A878]/15">
          {(['spring', 'summer', 'autumn', 'winter'] as const).map((season) => {
            const isSelected = selectedSeason === season;
            const isCurrent = realSeason === season;
            return (
              <button
                key={season}
                type="button"
                onClick={() => setSelectedSeason(season)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? isNightMode
                      ? 'bg-[#2D452B] text-white shadow-xs'
                      : 'bg-[#588157] text-white shadow-xs'
                    : 'text-[#637062] hover:bg-black/10 dark:hover:bg-white/5'
                }`}
              >
                <span>{season === 'spring' ? 'Kevad' : season === 'summer' ? 'Suvi' : season === 'autumn' ? 'Sügis' : 'Talv'}</span>
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#E76F51]" title="Praegune aastaaeg" />}
              </button>
            );
          })}
        </div>
      </div>

      {activeChallenge && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Main info card */}
          <div className="md:col-span-8 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#E76F51] bg-[#E76F51]/10 px-2.5 py-0.5 rounded-full border border-[#E76F51]/20">
                  {activeChallenge.months}
                </span>
                {realSeason === selectedSeason && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Aktiivne Hooaeg
                  </span>
                )}
              </div>
              <h4 className="font-display font-extrabold text-lg text-[#203A2A] dark:text-[#E2EAE1]">
                {activeChallenge.title}
              </h4>
              <p className="text-xs text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
                {activeChallenge.description}
              </p>
            </div>

            {/* Interactive Section for Challenges */}
            {selectedSeason === 'spring' && !isUnlocked && (
              <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-left">
                  <h5 className="text-xs font-bold text-[#203A2A] dark:text-[#E2EAE1]">Kevadise looduse uurimine</h5>
                  <p className="text-[10px] text-[#588157]">Sammude kogumisel kaardil avastad automaatselt uusi parke ja rohealasid.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateSpringPark}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Uuri haljasala (+1)
                </button>
              </div>
            )}

            {selectedSeason === 'summer' && !isUnlocked && (
              <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-left">
                  <h5 className="text-xs font-bold text-[#203A2A] dark:text-[#E2EAE1]">Suvise matkapäeva simulatsioon</h5>
                  <p className="text-[10px] text-[#588157]">Matka päikselistel radadel ja lae oma Solarpunk süsteemi.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateSummerDay}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sun className="w-3.5 h-3.5 animate-spin-slow" />
                  Kõnni 10,000 sammu (+1 päev)
                </button>
              </div>
            )}

            {selectedSeason === 'autumn' && !isUnlocked && (
              <div className="p-3.5 bg-orange-500/5 rounded-2xl border border-orange-500/20 space-y-1 animate-in slide-in-from-bottom-2 duration-300">
                <h5 className="text-xs font-bold text-[#203A2A] dark:text-[#E2EAE1] flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-orange-500" />
                  Kuidas edeneda?
                </h5>
                <p className="text-[11px] text-[#588157] leading-relaxed">
                  See väljakutse loeb reaalajas Sinu pakutavaid ressursse. Lisa üleval olevasse tabelisse **"Pakutavad ressursid ja oskused"** uusi sügisesi aiasaadusi, taimeteesid või hoidiseid (nt "Koduõunad", "Sügisene astelpaju siirup", "Münditee" jne). Praegu on sul lisatud **{user.offeredResources?.length || 0}** ressurssi.
                </p>
              </div>
            )}

            {selectedSeason === 'winter' && (
              <div className="p-4 bg-sky-500/5 rounded-2xl border border-sky-500/20 space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                <h5 className="text-xs font-bold text-[#203A2A] dark:text-[#E2EAE1] flex items-center gap-1.5">
                  <Snowflake className="w-4 h-4 text-sky-500 animate-pulse" />
                  Kriisivalmiduse kontroll-leht
                </h5>
                <div className="space-y-2">
                  {winterChecklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleWinterChecklist(item.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        item.completed
                          ? 'bg-[#588157]/10 border-[#588157]/40 text-[#203A2A] dark:text-[#F0F5EE]'
                          : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-sky-500/30'
                      }`}
                    >
                      <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          item.completed
                            ? 'bg-[#588157] border-[#588157] text-white'
                            : 'border-[#87A878]/40 bg-white dark:bg-black/20'
                        }`}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Bar & Numerical stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#588157]">{activeChallenge.goalLabel}</span>
                <span className="font-mono text-[#E76F51]">
                  {progressValue} / {targetValue}
                </span>
              </div>
              <div className="w-full h-3 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-[#87A878]/15">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isUnlocked
                      ? 'bg-gradient-to-r from-emerald-500 via-yellow-500 to-amber-500'
                      : 'bg-gradient-to-r from-[#D6A23B] to-[#E9C46A]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Badge Visual and reward preview */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/20 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#588157]">Sinu preemia</span>
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md transition-all duration-500 ${
                  isUnlocked
                    ? 'bg-gradient-to-tr from-[#D6A23B]/20 to-[#E9C46A]/20 border-2 border-dashed border-[#D6A23B] scale-110'
                    : 'bg-black/5 dark:bg-white/5 border border-dashed border-[#637062]/20 filter grayscale opacity-45'
                }`}
              >
                {activeChallenge.rewardBadgeIcon}
              </div>
              {isUnlocked && (
                <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-1 border border-white dark:border-[#1E2C1C]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h5 className="font-display font-black text-xs">
                {activeChallenge.rewardBadge}
              </h5>
              <p className="text-[9px] text-[#637062] dark:text-[#A8BDA5] leading-tight max-w-[130px] mx-auto">
                {isUnlocked
                  ? 'Tehtud! Solarpunk märk on lisatud Sinu profiili kogusse.'
                  : 'Saavuta väljakutse eesmärk, et see märk lukust lahti teha.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Embedded inline completion card if unlocked */}
      {showCelebrationBadge && (
        <div className="p-4 rounded-2xl border-2 border-[#D6A23B] bg-gradient-to-r from-[#FAF6EE] to-[#FFF0D4] dark:from-[#182315] dark:to-[#22311D] flex flex-col sm:flex-row items-center gap-4 animate-in zoom-in-95 duration-500 relative">
          <button
            type="button"
            onClick={() => setShowCelebrationBadge(null)}
            className="absolute top-2 right-2 text-xs font-bold text-[#588157] hover:text-[#203A2A] cursor-pointer"
          >
            Sule
          </button>
          <div className="w-16 h-16 rounded-full bg-yellow-400/20 border border-yellow-500 flex items-center justify-center text-4xl shrink-0 animate-bounce">
            {challenges.find((c) => c.id === showCelebrationBadge)?.rewardBadgeIcon}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h4 className="font-display font-bold text-xs text-[#D6A23B]">🎉 VÄLJAKUTSE SOORITATUD!</h4>
            <p className="text-[11px] text-[#203A2A] dark:text-[#FAF6EE] font-semibold leading-normal">
              Suurepärane! Saavutasid uue märgise: <strong>{challenges.find((c) => c.id === showCelebrationBadge)?.rewardBadge}</strong>. Sinuga on tõeline Solarpunk jõud!
            </p>
          </div>
        </div>
      )}

      {/* Debug and Simulation tools footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#87A878]/15 text-[10px]">
        <span className="text-[#637062]">
          HÕIMU Sandbox Testing Mode
        </span>
        <button
          type="button"
          onClick={handleResetChallengeProgress}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 font-bold transition-all cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Nulli väljakutsed (test)
        </button>
      </div>
    </div>
  );
};
