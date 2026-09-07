import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface MapSkeletonProps {
  isNightMode?: boolean;
}

export const MapSkeleton: React.FC<MapSkeletonProps> = ({ isNightMode = false }) => {
  return (
    <div
      role="status"
      aria-label="Loading offline map grid"
      className={`w-full h-80 sm:h-96 rounded-3xl border overflow-hidden relative flex flex-col items-center justify-center animate-pulse ${
        isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-[#EAE4D8] border-[#87A878]/30'
      }`}
    >
      {/* Grid line pattern background */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#588157_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="z-10 flex flex-col items-center gap-3 p-6 text-center">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/20 text-[#588157]'
          }`}
        >
          <MapPin className="w-6 h-6 animate-bounce" />
        </div>
        <div>
          <p className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
            Loading Vector Map & Offline Terrain Grid
          </p>
          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
            Initializing WebGL canvas & field POIs...
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 text-xs font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#588157]" />
          <span>Syncing offline tiles</span>
        </div>
      </div>
    </div>
  );
};
