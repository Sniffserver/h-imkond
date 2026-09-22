import React, { useState } from 'react';
import { Crosshair, Info, CheckCircle2, AlertCircle, X, Radio, Navigation, ShieldCheck } from 'lucide-react';

export interface LocationIndicatorProps {
  accuracy: number; // meters (e.g. 5, 15, 60)
  isHighAccuracy: boolean;
  lastUpdated: Date;
  latitude?: number;
  longitude?: number;
  heading?: number; // degrees 0-360
  source?: 'GNSS/GPS' | 'Mesh Trilateration' | 'Low-Power Fused' | 'Manual Fix';
  onShareLocation?: () => void;
  onRecenter?: () => void;
  isNightMode?: boolean;
}

function formatRelativeTime(date: Date): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

export const LocationIndicator: React.FC<LocationIndicatorProps> = ({
  accuracy,
  isHighAccuracy,
  lastUpdated,
  latitude = 59.437,
  longitude = 24.7535,
  heading,
  source = 'GNSS/GPS',
  onShareLocation,
  onRecenter,
  isNightMode = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Optical radius for confidence ring (clamp for visual usability: 24px min, 96px max)
  const visualRadiusPx = Math.min(80, Math.max(24, Math.round(accuracy * 1.5)));
  const confidencePercent = Math.max(10, Math.min(99, Math.round(100 - accuracy * 1.2)));

  const handleToggleDetails = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    setShowDetails(!showDetails);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative inline-flex items-center"
      data-testid="location-indicator"
    >
      {/* Visual Pulsing Dot and Confidence Ring */}
      <div className="relative flex items-center justify-center">
        {/* Animated Confidence SVG Ring */}
        <svg
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 overflow-visible"
          width={visualRadiusPx * 2}
          height={visualRadiusPx * 2}
          aria-hidden="true"
        >
          <circle
            cx="50%"
            cy="50%"
            r={visualRadiusPx - 4}
            fill={isHighAccuracy ? 'rgba(42, 157, 143, 0.12)' : 'rgba(233, 196, 106, 0.15)'}
            stroke={isHighAccuracy ? 'rgba(42, 157, 143, 0.4)' : 'rgba(233, 196, 106, 0.5)'}
            strokeWidth="1.5"
            strokeDasharray={isHighAccuracy ? 'none' : '3 3'}
            className="animate-pulse"
          />
          {heading !== undefined && (
            <line
              x1="50%"
              y1="50%"
              x2={`${50 + 40 * Math.sin((heading * Math.PI) / 180)}%`}
              y2={`${50 - 40 * Math.cos((heading * Math.PI) / 180)}%`}
              stroke={isHighAccuracy ? '#2A9D8F' : '#E9C46A'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Pulsing Core Center Dot */}
        <button
          type="button"
          onClick={handleToggleDetails}
          className={`relative z-10 p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md ${
            isHighAccuracy
              ? 'bg-[#2A9D8F] text-white hover:bg-[#238276]'
              : 'bg-[#E9C46A] text-[#203A2A] hover:bg-[#d8b356]'
          }`}
          aria-label={`Location indicator: Accurate within ${accuracy} meters. Tap for GPS details.`}
          aria-expanded={showDetails}
        >
          <span className="sr-only">
            Your location is accurate within {accuracy} meters. Updated {formatRelativeTime(lastUpdated)}.
          </span>
          <div className="relative">
            <span className="absolute -inset-1 rounded-full animate-ping opacity-75 bg-current" />
            <Crosshair className="w-4 h-4 relative z-10" />
          </div>
        </button>
      </div>

      {/* Detail Popover / Modal on Tap */}
      {showDetails && (
        <div
          role="dialog"
          aria-label="Location Accuracy & Confidence Details"
          className={`absolute bottom-12 left-0 sm:left-auto sm:right-0 z-50 w-72 p-4 rounded-2xl border shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            isNightMode
              ? 'bg-[#182315]/95 border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
              <h4 className="font-display font-bold text-xs">You Are Here</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close location details"
            >
              <X className="w-3.5 h-3.5 text-[#588157]" />
            </button>
          </div>

          <div className="space-y-2 text-[11px]">
            {/* Accuracy & Confidence */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[#588157] dark:text-[#A8BDA5]">Accuracy Radius:</span>
              <span className="font-mono font-bold">±{accuracy} meters</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[#588157] dark:text-[#A8BDA5]">Confidence Level:</span>
              <span className="font-mono font-bold text-[#2A9D8F]">{confidencePercent}%</span>
            </div>

            {/* Source and Status */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[#588157] dark:text-[#A8BDA5]">Position Source:</span>
              <span className="font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3 text-[#2A9D8F]" />
                {source}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[#588157] dark:text-[#A8BDA5]">Last Fix:</span>
              <span className="font-mono">{formatRelativeTime(lastUpdated)}</span>
            </div>

            {/* Coordinates */}
            <div className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] pt-1">
              Lat: {latitude.toFixed(5)}°, Lng: {longitude.toFixed(5)}°
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {onRecenter && (
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(10); } catch {}
                  }
                  onRecenter();
                  setShowDetails(false);
                }}
                className="w-full py-2 px-3 min-h-[44px] bg-[#2A9D8F] hover:bg-[#238276] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Center Map On Me</span>
              </button>
            )}

            {onShareLocation && (
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(15); } catch {}
                  }
                  onShareLocation();
                  setShowDetails(false);
                }}
                className="w-full py-2 px-3 min-h-[44px] bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Share Location Over Mesh</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
