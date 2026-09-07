import React from 'react';
import { Layers, Activity, Package, Sparkles, Sliders } from 'lucide-react';
import { HeatmapMode } from '../utils/d3BioregionalHeatmap';

interface D3HeatmapLegendProps {
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  nodeCount: number;
  resourceCount: number;
  isNightMode?: boolean;
  onClose?: () => void;
  className?: string;
}

export const D3HeatmapLegend: React.FC<D3HeatmapLegendProps> = ({
  mode,
  onModeChange,
  opacity,
  onOpacityChange,
  nodeCount,
  resourceCount,
  isNightMode = false,
  onClose,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md shadow-lg p-3 text-xs transition-all select-none ${
        isNightMode
          ? 'bg-[#182315]/92 border-[#364E30] text-[#F0F5EE]'
          : 'bg-white/94 border-[#87A878]/40 text-[#203A2A]'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-current/10">
        <div className="flex items-center gap-1.5 font-bold">
          <Layers className="w-4 h-4 text-[#2A9D8F]" />
          <span>D3 Bioregional Heatmap</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold bg-[#2A9D8F]/15 text-[#2A9D8F]">
          KDE Contours
        </span>
      </div>

      {/* Mode Selector Chips */}
      <div className="flex items-center gap-1 mb-2.5">
        <button
          type="button"
          onClick={() => onModeChange('combined')}
          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
            mode === 'combined'
              ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
              : isNightMode
              ? 'bg-[#223120] text-[#A8BDA5] border-[#2A3B26]'
              : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
          }`}
          title="Kombineeritud tihedus: aktiivsed sõlmed + ressursside saadavus"
        >
          <Sparkles className="w-3 h-3" />
          <span>Kombineeritud</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('nodes')}
          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
            mode === 'nodes'
              ? 'bg-[#588157] text-white border-[#588157] shadow-xs'
              : isNightMode
              ? 'bg-[#223120] text-[#A8BDA5] border-[#2A3B26]'
              : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
          }`}
          title="Ainult aktiivsete võrgusõlmede tihedus"
        >
          <Activity className="w-3 h-3" />
          <span>Sõlmed ({nodeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('resources')}
          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
            mode === 'resources'
              ? 'bg-[#E9C46A] text-[#243128] border-[#E9C46A] shadow-xs'
              : isNightMode
              ? 'bg-[#223120] text-[#A8BDA5] border-[#2A3B26]'
              : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
          }`}
          title="Ainult ressursside saadavuse tihedus"
        >
          <Package className="w-3 h-3" />
          <span>Varud ({resourceCount})</span>
        </button>
      </div>

      {/* D3 Continuous Color Gradient Bar */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between items-center text-[9px] font-mono text-[#637062] dark:text-[#A8BDA5]">
          <span>Madal tihedus (Hõre)</span>
          <span>Rikkalik fookus</span>
        </div>
        <div
          className="h-2.5 rounded-full border border-black/10 dark:border-white/10 overflow-hidden shadow-2xs"
          style={{
            background:
              'linear-gradient(to right, rgba(42,157,143,0.15) 0%, rgba(42,157,143,0.5) 25%, rgba(88,129,87,0.7) 50%, rgba(233,196,106,0.85) 75%, rgba(244,162,97,0.95) 100%)',
          }}
        />
      </div>

      {/* Opacity Control & Intensity Indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-current/10 text-[10px] font-mono">
        <div className="flex items-center gap-1 text-[#588157] dark:text-[#A8BDA5]">
          <Sliders className="w-3 h-3" />
          <span>Läbipaistvus:</span>
        </div>
        <div className="flex items-center gap-1">
          {[0.35, 0.65, 0.85].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onOpacityChange(op)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                Math.abs(opacity - op) < 0.05
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#223120] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              {Math.round(op * 100)}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
