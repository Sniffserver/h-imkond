import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { personalStatsService, PersonalRecords, DailyStatPoint } from '../services/game/personalStatsService';
import { pedometerService } from '../services/utils/pedometerService';
import { mapRevealService } from '../services/map/mapRevealService';
import {
  Trophy,
  Flame,
  Compass,
  Footprints,
  Calendar,
  TrendingUp,
  BarChart3,
  Sparkles,
  Heart,
  ChevronRight,
  Info,
} from 'lucide-react';

interface PersonalRecordsStatsProps {
  isNightMode?: boolean;
}

export const PersonalRecordsStats: React.FC<PersonalRecordsStatsProps> = ({
  isNightMode = false,
}) => {
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month');
  const [records, setRecords] = useState<PersonalRecords>(personalStatsService.getRecords());
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; steps: number; distanceKm: number } | null>(null);

  const chartData = personalStatsService.getDataForRange(range);

  useEffect(() => {
    // Listen to pedometer updates to keep records fresh
    const unsubscribe = pedometerService.addListener((update) => {
      personalStatsService.logStepsToday(1, mapRevealService.getRevealedAreas().length);
      setRecords(personalStatsService.getRecords());
    });

    return () => unsubscribe();
  }, []);

  const maxSteps = Math.max(...chartData.points.map((p) => p.steps), 1000);

  return (
    <div
      id="personal-records-stats"
      className={`rounded-3xl border p-5 space-y-6 transition-all duration-300 shadow-sm ${
        isNightMode
          ? 'bg-[#1D2B1C] border-[#364E30] text-[#EAF2E8]'
          : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header with self-reflection philosophy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#87A878]/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-[#588157]/15 text-[#588157] dark:text-[#A8BDA5]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h3 className="font-display font-extrabold text-lg tracking-tight">
              Isiklikud rekordid ja statistika
            </h3>
          </div>
          <p className="text-xs text-[#588157] dark:text-[#A2BA9F] flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-[#E76F51]" />
            <span>Sinu enda edusammud aja jooksul — mitte võrdluses teistega, vaid endaga.</span>
          </p>
        </div>

        {/* Range Selector Tabs */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[#87A878]/20 self-start sm:self-auto">
          {(['week', 'month', 'year'] as const).map((r) => {
            const isSelected = range === r;
            const labels = { week: 'Nädala', month: 'Kuu (30p)', year: 'Aasta' };
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#588157] text-white shadow-xs'
                    : 'text-[#637062] dark:text-[#9FB59C] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Personal Records Cards (Responsive 2x2 or 4x1 grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Record 1: Best Steps Day */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#87A878]/25 space-y-2">
          <div className="flex items-center justify-between text-[#E76F51]">
            <span className="p-1.5 rounded-lg bg-[#E76F51]/10">
              <Trophy className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#637062] dark:text-[#A0B49E]">
              {records.bestStepsDay.formattedDate}
            </span>
          </div>
          <div>
            <div className="font-display font-black text-xl text-[#203A2A] dark:text-white">
              {records.bestStepsDay.steps.toLocaleString('et-EE')}
            </div>
            <div className="text-xs font-bold text-[#588157] dark:text-[#A8BEA5]">
              Parim sammude päev
            </div>
          </div>
        </div>

        {/* Record 2: Longest Streak */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#87A878]/25 space-y-2">
          <div className="flex items-center justify-between text-[#F4A261]">
            <span className="p-1.5 rounded-lg bg-[#F4A261]/10">
              <Flame className="w-4 h-4 text-orange-500" />
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#588157] dark:text-[#A0B49E]">
              Praegu: {records.currentStreakDays}p
            </span>
          </div>
          <div>
            <div className="font-display font-black text-xl text-[#203A2A] dark:text-white">
              {records.longestStreakDays} päeva
            </div>
            <div className="text-xs font-bold text-[#588157] dark:text-[#A8BEA5]">
              Pikim seeria järjest
            </div>
          </div>
        </div>

        {/* Record 3: Most Discovered Areas */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#87A878]/25 space-y-2">
          <div className="flex items-center justify-between text-[#2A9D8F]">
            <span className="p-1.5 rounded-lg bg-[#2A9D8F]/10">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#637062] dark:text-[#A0B49E]">
              Kokku {records.totalAreasDiscovered} ala
            </span>
          </div>
          <div>
            <div className="font-display font-black text-xl text-[#203A2A] dark:text-white">
              {records.mostDiscoveredAreasDay.count} piirkonda
            </div>
            <div className="text-xs font-bold text-[#588157] dark:text-[#A8BEA5]">
              Enim avastatud alasid päevas
            </div>
          </div>
        </div>

        {/* Record 4: Total Walked */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#87A878]/25 space-y-2">
          <div className="flex items-center justify-between text-[#588157]">
            <span className="p-1.5 rounded-lg bg-[#588157]/10">
              <Footprints className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#637062] dark:text-[#A0B49E]">
              ≈ {Math.round(records.totalSteps / 1000)}k sammu
            </span>
          </div>
          <div>
            <div className="font-display font-black text-xl text-[#203A2A] dark:text-white">
              {records.totalDistanceKm} km
            </div>
            <div className="text-xs font-bold text-[#588157] dark:text-[#A8BEA5]">
              Kokku kõnnitud
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section: Visual Bar Graph */}
      <div className="space-y-3 bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-[#87A878]/20">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#588157]" />
            <span>Sammude ja liikumise trend ({range === 'week' ? 'Viimased 7 päeva' : range === 'month' ? 'Viimased 30 päeva' : 'Aasta lõikes'})</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-[#637062] dark:text-[#A2BA9F]">
              Kokku: <strong className="text-[#203A2A] dark:text-white">{chartData.summary.totalSteps.toLocaleString('et-EE')}</strong> sammu ({chartData.summary.totalKm} km)
            </span>
            <span className="text-[#637062] dark:text-[#A2BA9F]">
              Keskmine: <strong className="text-[#203A2A] dark:text-white">{chartData.summary.avgSteps.toLocaleString('et-EE')}</strong> / p
            </span>
          </div>
        </div>

        {/* Hovered bar tooltip indicator */}
        <div className="h-6 flex items-center justify-end text-[11px] text-[#588157] font-semibold">
          {hoveredPoint ? (
            <span className="animate-in fade-in duration-200">
              📅 {hoveredPoint.label}: <strong>{hoveredPoint.steps.toLocaleString('et-EE')} sammu</strong> ({hoveredPoint.distanceKm} km)
            </span>
          ) : (
            <span className="text-[10px] text-[#87A878] italic">Liigu tulpade peale detailide nägemiseks</span>
          )}
        </div>

        {/* SVG/HTML Bar Chart */}
        <div className="h-44 w-full flex items-end gap-1 sm:gap-2 pt-4 pb-2 px-1 border-b border-[#87A878]/20">
          {chartData.points.map((pt, index) => {
            const heightPct = Math.max(8, Math.round((pt.steps / maxSteps) * 100));
            const isStandout = pt.steps >= 10000;
            const isHovered = hoveredPoint?.label === pt.label;

            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              >
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                    isStandout
                      ? 'bg-gradient-to-t from-[#E76F51] to-[#F4A261] shadow-xs'
                      : isHovered
                      ? 'bg-[#588157]'
                      : 'bg-[#87A878]/60 dark:bg-[#588157]/60 hover:bg-[#588157]'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between items-center text-[10px] font-mono text-[#637062] dark:text-[#A0B49E] px-1 pt-1">
          {range === 'week' && chartData.points.map((p, idx) => (
            <span key={idx} className="text-center">{p.label}</span>
          ))}
          {range === 'month' && (
            <>
              <span>30 päeva tagasi</span>
              <span>15 päeva tagasi</span>
              <span>Täna</span>
            </>
          )}
          {range === 'year' && chartData.points.map((p, idx) => (
            <span key={idx} className="text-center">{p.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
