import React, { useMemo } from 'react';
import { Ruler } from 'lucide-react';

interface DynamicScaleRulerProps {
  scale: number;
  isNightMode?: boolean;
  isRulerMode?: boolean;
  onToggleRulerMode?: () => void;
  className?: string;
}

const SCALE_DISTANCES_METERS = [
  5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000
];

export const DynamicScaleRuler: React.FC<DynamicScaleRulerProps> = ({
  scale,
  isNightMode = false,
  isRulerMode = false,
  onToggleRulerMode,
  className = '',
}) => {
  const rulerData = useMemo(() => {
    // 1 world coordinate unit = 10 meters in the bioregional simulation
    const safeScale = Math.max(0.1, scale);
    const metersPerPixel = 10 / safeScale;
    const targetPixelWidth = 85;
    const rawMeters = targetPixelWidth * metersPerPixel;

    // Pick closest human-readable distance step
    let bestMeters = SCALE_DISTANCES_METERS[0];
    let minDiff = Infinity;
    for (const dist of SCALE_DISTANCES_METERS) {
      const diff = Math.abs(dist - rawMeters);
      if (diff < minDiff) {
        minDiff = diff;
        bestMeters = dist;
      }
    }

    // Exact pixel width for this distance step
    const pixelWidth = Math.max(42, Math.min(130, Math.round((bestMeters / 10) * safeScale)));
    const midMeters = bestMeters / 2;

    const formatDist = (m: number) => {
      if (m >= 1000) {
        const km = m / 1000;
        return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
      }
      return `${Math.round(m)} m`;
    };

    return {
      pixelWidth,
      totalMeters: bestMeters,
      totalLabel: formatDist(bestMeters),
      midLabel: formatDist(midMeters),
      metersPerPixel: metersPerPixel.toFixed(1),
    };
  }, [scale]);

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border backdrop-blur-md shadow-md select-none transition-all ${
        isNightMode
          ? 'bg-[#182315]/90 border-[#364E30] text-[#F0F5EE]'
          : 'bg-white/92 border-[#87A878]/40 text-[#203A2A]'
      } ${className}`}
      title={`Kaardi mõõtkava: 1px ≈ ${rulerData.metersPerPixel}m • Suum: ${(scale * 100).toFixed(0)}%`}
    >
      {/* Graphical Scale Bar */}
      <div className="flex flex-col items-start gap-0.5">
        {/* Distance Numbers */}
        <div
          className="flex justify-between items-center text-[9px] font-mono leading-none font-semibold text-[#637062] dark:text-[#A8BDA5]"
          style={{ width: `${rulerData.pixelWidth}px` }}
        >
          <span>0</span>
          <span>{rulerData.totalLabel}</span>
        </div>

        {/* Dual-Segment Stepped Bar */}
        <div
          className="relative h-2 rounded-xs border border-[#203A2A]/40 dark:border-white/30 flex overflow-hidden shadow-xs"
          style={{ width: `${rulerData.pixelWidth}px` }}
        >
          {/* Left Segment */}
          <div className="w-1/2 h-full bg-[#2A9D8F]" />
          {/* Right Segment */}
          <div className="w-1/2 h-full bg-[#588157]" />

          {/* Center Dividing Tick */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white dark:bg-[#182315]" />
        </div>
      </div>

      {/* Scale Magnification & Optional Measuring Tape Toggle */}
      <div className="flex items-center gap-1 pl-1 border-l border-[#87A878]/30">
        <span className="text-[10px] font-mono font-bold text-[#2A9D8F] px-1 py-0.5 rounded bg-[#2A9D8F]/10">
          {scale.toFixed(1)}×
        </span>

        {onToggleRulerMode && (
          <button
            type="button"
            onClick={onToggleRulerMode}
            title={isRulerMode ? "Mõõdulint aktiivne (Klõpsa kaardil 2 punkti vahel)" : "Lülita sisse mõõdulint (Mõõda vahemaid sõlmede vahel)"}
            className={`p-1 rounded-lg border transition-all cursor-pointer ${
              isRulerMode
                ? 'bg-[#E76F51] border-[#E76F51] text-white shadow-xs animate-pulse'
                : 'bg-transparent border-transparent text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
