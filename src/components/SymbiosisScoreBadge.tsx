import React from 'react';
import { Sprout, Sparkles, TrendingUp } from 'lucide-react';

interface SymbiosisScoreBadgeProps {
  score: number;
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SymbiosisScoreBadge: React.FC<SymbiosisScoreBadgeProps> = ({
  score,
  delta,
  size = 'md',
}) => {
  return (
    <div
      id="symbiosis-score-badge"
      className={`inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FAF6EE] to-[#F0F5EE] border border-[#87A878]/30 shadow-xs ${
        size === 'sm' ? 'px-2.5 py-1' : size === 'lg' ? 'px-4 py-2.5' : 'px-3 py-1.5'
      }`}
    >
      <div className="w-7 h-7 rounded-xl bg-[#87A878]/20 flex items-center justify-center text-[#2A9D8F]">
        <Sprout className="w-4 h-4 text-[#588157]" />
      </div>

      <div>
        <div className="text-[10px] text-[#657760] font-semibold uppercase tracking-wider">
          Bioregion Symbiosis
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display font-black text-[#2B3A28] text-base leading-none">
            {score}
          </span>
          <span className="text-[11px] font-medium text-[#588157]">Pts</span>

          {delta !== undefined && delta > 0 && (
            <span className="text-[10px] font-mono text-[#E76F51] font-bold bg-[#FDF1EE] px-1 rounded flex items-center">
              +{delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
