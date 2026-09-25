import React from 'react';
import { Users, Package, Radio, Mountain, ShieldCheck, MapPin, Activity, Sparkles, Navigation } from 'lucide-react';

export interface ActiveLayerStates {
  peers: boolean;
  resources: boolean;
  places?: boolean;
  meshLinks?: boolean;
  signalTrail?: boolean;
  safety?: boolean;
  heatmap: boolean;
  terrain: boolean;
}

export interface MapLayerCounts {
  peers?: number;
  resources?: number;
  places?: number;
  safety?: number;
}

export interface MapLayerControlsProps {
  layers: ActiveLayerStates;
  onToggleLayer: (layerKey: keyof ActiveLayerStates) => void;
  counts?: MapLayerCounts;
  isNightMode?: boolean;
  className?: string;
}

interface LayerToggleButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onToggle: () => void;
  count?: number;
  isNightMode?: boolean;
}

export const LayerToggleButton: React.FC<LayerToggleButtonProps> = ({
  icon,
  label,
  isActive,
  onToggle,
  count,
  isNightMode = false,
}) => {
  const handleClick = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isActive}
      aria-label={`${label} layer ${isActive ? 'visible' : 'hidden'}${
        count !== undefined ? ` (${count} items)` : ''
      }`}
      className={`group relative flex items-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-2xl text-xs font-semibold border transition-all duration-150 cursor-pointer shadow-sm active:scale-95 ${
        isActive
          ? isNightMode
            ? 'bg-[#2A3B26] border-[#87A878] text-[#F0F5EE] shadow-md'
            : 'bg-[#588157] border-[#476A46] text-[#FAF6EE] shadow-md'
          : isNightMode
          ? 'bg-[#182315]/80 border-[#2A3B26] text-[#A8BDA5] hover:bg-[#20301C]'
          : 'bg-[#FAF6EE]/90 border-[#87A878]/30 text-[#588157] hover:bg-[#F0F5EE]'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>

      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
            isActive
              ? 'bg-black/20 text-white'
              : 'bg-black/10 dark:bg-white/10 text-current'
          }`}
        >
          {count}
        </span>
      )}

      {/* Subtle visibility indicator */}
      <span className="sr-only">{isActive ? 'Layer visible' : 'Layer hidden'}</span>
    </button>
  );
};

export const MapLayerControls: React.FC<MapLayerControlsProps> = ({
  layers,
  onToggleLayer,
  counts = {},
  isNightMode = false,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Map Layer Filters"
      className={`flex flex-wrap items-center gap-2 p-1.5 rounded-3xl backdrop-blur-md border shadow-lg ${
        isNightMode
          ? 'bg-[#141F12]/85 border-[#2A3B26]'
          : 'bg-[#FAF6EE]/85 border-[#87A878]/30'
      } ${className}`}
    >
      <LayerToggleButton
        icon={<Users className="w-4 h-4 text-emerald-500" />}
        label="People"
        isActive={layers.peers}
        onToggle={() => onToggleLayer('peers')}
        count={counts.peers}
        isNightMode={isNightMode}
      />

      <LayerToggleButton
        icon={<Package className="w-4 h-4 text-amber-500" />}
        label="Resources"
        isActive={layers.resources}
        onToggle={() => onToggleLayer('resources')}
        count={counts.resources}
        isNightMode={isNightMode}
      />

      <LayerToggleButton
        icon={<MapPin className="w-4 h-4 text-cyan-500" />}
        label="Places"
        isActive={layers.places ?? true}
        onToggle={() => onToggleLayer('places')}
        count={counts.places}
        isNightMode={isNightMode}
      />

      <LayerToggleButton
        icon={<Activity className="w-4 h-4 text-emerald-400" />}
        label="Mesh Links"
        isActive={layers.meshLinks ?? false}
        onToggle={() => onToggleLayer('meshLinks')}
        isNightMode={isNightMode}
      />

      <LayerToggleButton
        icon={<Radio className="w-4 h-4 text-blue-400" />}
        label="Signal Trail"
        isActive={layers.signalTrail ?? false}
        onToggle={() => onToggleLayer('signalTrail')}
        isNightMode={isNightMode}
      />

      <LayerToggleButton
        icon={<ShieldCheck className="w-4 h-4 text-rose-500" />}
        label="Safety"
        isActive={layers.safety ?? true}
        onToggle={() => onToggleLayer('safety')}
        count={counts.safety}
        isNightMode={isNightMode}
      />
    </div>
  );
};
