import React from 'react';
import { Compass, RefreshCw, Radio, Layers, MapPin } from 'lucide-react';

interface MapSkeletonProps {
  isNightMode?: boolean;
}

export const MapSkeleton: React.FC<MapSkeletonProps> = ({ isNightMode = false }) => {
  return (
    <div
      role="region"
      aria-label="Loading Off-Grid Vector Map"
      className={`w-full h-full min-h-[440px] rounded-3xl border flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors ${
        isNightMode
          ? 'bg-[#141E12] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-[#F5F2EA] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      {/* Background Map-like Grid and Tile Skeleton Boxes */}
      <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 grid-rows-3 gap-2 p-3 opacity-20 pointer-events-none">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div
            key={idx}
            className={`rounded-2xl border ${
              isNightMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
            } animate-pulse`}
            style={{ animationDelay: `${(idx % 4) * 150}ms` }}
          >
            {/* Simulated road / contour lines inside tile */}
            <div className="w-full h-full relative overflow-hidden">
              <div
                className={`absolute top-1/2 left-0 right-0 h-0.5 ${
                  isNightMode ? 'bg-white/10' : 'bg-black/10'
                } -rotate-12 transform origin-center`}
              />
              <div
                className={`absolute top-0 bottom-0 left-1/3 w-0.5 ${
                  isNightMode ? 'bg-white/10' : 'bg-black/10'
                } rotate-6 transform origin-center`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Edge gradient for infinite feel */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/10 via-transparent to-black/10 dark:from-black/30 dark:to-black/30" />

      {/* Simulated Corner UI Skeletons */}
      <div className="absolute top-4 left-4 z-10 w-28 h-7 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
      <div className="absolute top-4 right-4 z-10 w-36 h-7 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
      <div className="absolute bottom-4 left-4 z-10 w-44 h-9 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
      <div className="absolute bottom-4 right-4 z-10 w-28 h-9 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />

      {/* Central Loading Badge */}
      <div className="relative z-20 flex flex-col items-center text-center space-y-3.5 max-w-sm mx-auto p-5 rounded-2xl backdrop-blur-md bg-white/70 dark:bg-[#182315]/85 border border-[#87A878]/30 shadow-xl">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-[#588157]/15 flex items-center justify-center text-[#588157] dark:text-[#E9C46A] shadow-xs animate-bounce duration-1000">
            <Compass className="w-7 h-7" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#2A9D8F] text-white shadow-xs">
            <Radio className="w-3 h-3 animate-spin" />
          </div>
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157]/20 text-[#588157] dark:text-[#E9C46A]">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>WARMING TILE CACHE</span>
          </div>
          <h3 className="font-display font-bold text-sm sm:text-base">
            Loading Off-Grid Vector Map...
          </h3>
          <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
            Streaming local topography, peers, and emergency shelters from browser cache.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#2A9D8F] animate-pulse rounded-full w-3/4" />
        </div>
      </div>
    </div>
  );
};

