import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { seasonalChallengeService, SeasonalChallenge } from '../services/game/seasonalChallengeService';
import { mapRevealService } from '../services/map/mapRevealService';
import { Sparkles, Trophy, Award, Leaf, Sun, Snowflake, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

interface SeasonalProgressDisplayProps {
  user: UserProfile;
  isNightMode?: boolean;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  onOpenDetails?: () => void;
}

export const SeasonalProgressDisplay: React.FC<SeasonalProgressDisplayProps> = ({
  user,
  isNightMode = false,
  onUpdateUser,
  onAddToast,
  onOpenDetails,
}) => {
  const [activeChallenge, setActiveChallenge] = useState<SeasonalChallenge | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isCelebrated, setIsCelebrated] = useState<boolean>(false);

  const loadActiveProgress = () => {
    const revealedCount = mapRevealService.getRevealedAreas().length;
    const currentSeason = seasonalChallengeService.getCurrentSeason();

    // Sync progress
    seasonalChallengeService.syncProgressWithAppState(currentSeason, user, revealedCount);

    const challenges = seasonalChallengeService.getChallenges(user, revealedCount);
    const active = challenges.find((c) => c.season === currentSeason) || challenges[0];

    setActiveChallenge(active);
    const currProgress = seasonalChallengeService.getProgress(active.id);
    setProgress(currProgress);
  };

  useEffect(() => {
    loadActiveProgress();
  }, [user]);

  if (!activeChallenge) return null;

  const target = activeChallenge.targetValue;
  const isCompleted = progress >= target || seasonalChallengeService.isBadgeUnlocked(activeChallenge.id);
  const percentage = Math.min(100, Math.round((progress / target) * 100));

  const getSeasonAesthetics = (season: 'spring' | 'summer' | 'autumn' | 'winter') => {
    switch (season) {
      case 'spring':
        return {
          icon: <Leaf className="w-5 h-5 text-emerald-500" />,
          gradient: 'from-emerald-500/15 via-teal-500/10 to-transparent',
          barGradient: 'from-emerald-500 to-teal-400',
          badgeRing: 'border-emerald-500/40 bg-emerald-500/10',
          badgeGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
          textColor: 'text-emerald-700 dark:text-emerald-400',
          borderColor: 'border-emerald-500/30',
        };
      case 'summer':
        return {
          icon: <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" />,
          gradient: 'from-amber-500/15 via-orange-500/10 to-transparent',
          barGradient: 'from-amber-500 to-orange-400',
          badgeRing: 'border-amber-500/40 bg-amber-500/10',
          badgeGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
          textColor: 'text-amber-700 dark:text-amber-400',
          borderColor: 'border-amber-500/30',
        };
      case 'autumn':
        return {
          icon: <Leaf className="w-5 h-5 text-orange-500" />,
          gradient: 'from-orange-500/15 via-amber-600/10 to-transparent',
          barGradient: 'from-orange-500 via-amber-500 to-yellow-400',
          badgeRing: 'border-orange-500/40 bg-orange-500/10',
          badgeGlow: 'shadow-[0_0_20px_rgba(249,115,22,0.25)]',
          textColor: 'text-orange-700 dark:text-orange-400',
          borderColor: 'border-orange-500/30',
        };
      case 'winter':
        return {
          icon: <Snowflake className="w-5 h-5 text-sky-500" />,
          gradient: 'from-sky-500/15 via-indigo-500/10 to-transparent',
          barGradient: 'from-sky-500 to-indigo-400',
          badgeRing: 'border-sky-500/40 bg-sky-500/10',
          badgeGlow: 'shadow-[0_0_20px_rgba(14,165,233,0.25)]',
          textColor: 'text-sky-700 dark:text-sky-400',
          borderColor: 'border-sky-500/30',
        };
    }
  };

  const style = getSeasonAesthetics(activeChallenge.season);

  const handleSimulateIncrement = () => {
    if (progress < target) {
      const next = progress + 1;
      seasonalChallengeService.saveProgress(activeChallenge.id, next);
      setProgress(next);
      if (next >= target) {
        seasonalChallengeService.unlockBadge(activeChallenge.id);
        seasonalChallengeService.playSeasonalChime();
        setIsCelebrated(true);
        if (onAddToast) {
          onAddToast(
            '🎉 Hooajaline märk saavutatud!',
            `Sa avasid: ${activeChallenge.rewardBadge} ${activeChallenge.rewardBadgeIcon}!`,
            'success'
          );
        }
      }
    }
  };

  return (
    <div
      id="seasonal-progress-display"
      className={`relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 shadow-sm ${
        isNightMode
          ? 'bg-[#1C281B] border-[#364E30] text-[#EBF3E8]'
          : 'bg-[#FCFAF7] border-[#87A878]/35 text-[#1F3323]'
      }`}
    >
      {/* Dynamic Seasonal Gradient Backdrop */}
      <div
        className={`absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br ${style.gradient} blur-3xl pointer-events-none opacity-80`}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left Side: Challenge Info & Animated Progress Bar */}
        <div className="flex-1 space-y-3 w-full">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[#87A878]/25 shadow-xs">
              {style.icon}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#588157]/15 text-[#588157] dark:text-[#A8BDA5]">
                {activeChallenge.seasonName} • {activeChallenge.months}
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Aktiivne väljakutse
              </span>
            </div>
          </div>

          <div>
            <h3 className="font-display font-extrabold text-base md:text-lg tracking-tight">
              {activeChallenge.title}
            </h3>
            <p className="text-xs text-[#588157] dark:text-[#9FB79C] leading-relaxed line-clamp-2 mt-0.5">
              {activeChallenge.description}
            </p>
          </div>

          {/* Progress Metrics & Goal Label */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#588157] dark:text-[#B2C7B0] flex items-center gap-1.5">
                <span>{activeChallenge.goalLabel}:</span>
                <span className="font-mono text-[#E76F51] text-sm">
                  {progress} / {target}
                </span>
              </span>
              <span className="font-mono text-xs font-extrabold text-[#E76F51]">
                {percentage}%
              </span>
            </div>

            {/* Animated Progress Bar */}
            <div className="relative w-full h-3.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-[#87A878]/25">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${style.barGradient} relative shadow-xs`}
              >
                {/* Shimmer light effect inside progress */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2 h-full"
                />
              </motion.div>
            </div>
          </div>

          {/* Hint / Fast action */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#637062] dark:text-[#9EB19C]">
              {isCompleted
                ? '🏆 Väljakutse edukalt sooritatud! Märk on sinu profiilis.'
                : `Vaja veel ${Math.max(0, target - progress)} ühikut eesmärgi saavutamiseni.`}
            </span>

            {!isCompleted && (
              <button
                type="button"
                onClick={handleSimulateIncrement}
                className="text-[11px] font-bold text-[#588157] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                Edenda (+1)
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Upcoming Reward Badge Display */}
        <div className="w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-[#87A878]/25 min-w-[140px] text-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#588157] dark:text-[#A8BDA5]">
            Tulevane preemia
          </span>

          {/* Badge Visual with Ring & Glow */}
          <motion.div
            whileHover={{ scale: 1.08 }}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-dashed transition-all ${
              style.badgeRing
            } ${isCompleted ? style.badgeGlow + ' border-solid' : 'grayscale opacity-75'}`}
          >
            <span>{activeChallenge.rewardBadgeIcon}</span>

            {isCompleted && (
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            )}
          </motion.div>

          <div className="space-y-0.5">
            <h4 className="font-display font-black text-xs">
              {activeChallenge.rewardBadge}
            </h4>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block ${
                isCompleted
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isCompleted ? 'Avatud' : 'Ootel'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
