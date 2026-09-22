import React from 'react';
import { useMapQualityMode } from '../hooks/useMapQualityMode';
import { QualityMode } from '../features/map/qualityManager';
import { Zap, Sparkles, Eye, BatteryCharging } from 'lucide-react';

export interface MapQualitySelectorProps {
  isNightMode?: boolean;
  className?: string;
  variant?: 'select' | 'buttons' | 'compact';
  onQualityChange?: (mode: QualityMode) => void;
}

export function MapQualitySelector({
  isNightMode = false,
  className = '',
  variant = 'select',
  onQualityChange,
}: MapQualitySelectorProps) {
  const [mode, setMode] = useMapQualityMode();

  const handleModeChange = (newMode: QualityMode) => {
    setMode(newMode);
    if (onQualityChange) {
      onQualityChange(newMode);
    }
  };

  if (variant === 'buttons') {
    return (
      <div
        id="map-quality-selector-buttons"
        role="group"
        aria-label="Map Rendering Quality"
        className={`inline-flex items-center p-1 rounded-2xl border text-xs font-medium transition-all ${
          isNightMode
            ? 'bg-[#141F12] border-[#2A3B26]'
            : 'bg-[#F4EFE6] border-[#87A878]/30'
        } ${className}`}
      >
        <button
          id="btn-quality-power-saver"
          type="button"
          onClick={() => handleModeChange('power-saver')}
          aria-pressed={mode === 'power-saver'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
            mode === 'power-saver'
              ? 'bg-[#2D6A4F] text-white shadow-sm font-semibold'
              : isNightMode
              ? 'text-[#A0B89C] hover:text-[#F0F5EE]'
              : 'text-[#4A5D4E] hover:text-[#1A2E1A]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Save battery</span>
        </button>

        <button
          id="btn-quality-balanced"
          type="button"
          onClick={() => handleModeChange('balanced')}
          aria-pressed={mode === 'balanced'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
            mode === 'balanced'
              ? 'bg-[#2D6A4F] text-white shadow-sm font-semibold'
              : isNightMode
              ? 'text-[#A0B89C] hover:text-[#F0F5EE]'
              : 'text-[#4A5D4E] hover:text-[#1A2E1A]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Recommended</span>
        </button>

        <button
          id="btn-quality-detail"
          type="button"
          onClick={() => handleModeChange('detail')}
          aria-pressed={mode === 'detail'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
            mode === 'detail'
              ? 'bg-[#2D6A4F] text-white shadow-sm font-semibold'
              : isNightMode
              ? 'text-[#A0B89C] hover:text-[#F0F5EE]'
              : 'text-[#4A5D4E] hover:text-[#1A2E1A]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>More detail</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <label htmlFor="map-quality-mode-select" className="sr-only">
        Map Quality Mode
      </label>
      <div className="relative w-full">
        <select
          id="map-quality-mode-select"
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as QualityMode)}
          className={`appearance-none w-full pl-8 pr-8 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE] focus:border-[#40916C]'
              : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#1A2E1A] focus:border-[#2D6A4F]'
          }`}
        >
          <option value="power-saver">Save battery</option>
          <option value="balanced">Recommended</option>
          <option value="detail">More detail</option>
        </select>

        {/* Dynamic Leading Icon */}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#2D6A4F]">
          {mode === 'power-saver' && <Zap className="w-3.5 h-3.5 text-[#E76F51]" />}
          {mode === 'balanced' && <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F]" />}
          {mode === 'detail' && <Eye className="w-3.5 h-3.5 text-[#3A86FF]" />}
        </div>

        {/* Trailing chevron indicator */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default MapQualitySelector;
