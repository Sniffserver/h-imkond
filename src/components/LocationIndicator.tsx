import React, { useState } from 'react';
import { Crosshair, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { LocationState } from '../types';

export interface LocationIndicatorProps {
  locationState: LocationState;
  onShareLocation?: () => void;
  onRecenter?: () => void;
  isNightMode?: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

export const LocationIndicator: React.FC<LocationIndicatorProps> = ({
  locationState,
  onShareLocation,
  onRecenter,
  isNightMode = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const isLive = locationState.status === 'live' || locationState.status === 'stale';
  const accuracy = isLive ? locationState.accuracyMeters : 0;
  const isHighAccuracy = isLive && accuracy <= 20;
  const visualRadiusPx = isLive ? Math.min(80, Math.max(24, Math.round(accuracy * 1.5))) : 0;
  const confidencePercent = isLive ? Math.max(10, Math.min(99, Math.round(100 - accuracy * 1.2))) : 0;

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
      {/* Visual Pulsing Dot and Confidence Ring if live */}
      <div className="relative flex items-center justify-center">
        {isLive && (
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
          </svg>
        )}

        {/* Core Status Button */}
        <button
          type="button"
          onClick={handleToggleDetails}
          className={`relative z-10 px-3 py-2 rounded-2xl min-h-[44px] flex items-center gap-2 cursor-pointer transition-transform active:scale-95 shadow-md border ${
            locationState.status === 'live'
              ? 'bg-[#2A9D8F] text-white hover:bg-[#238276] border-[#238276]'
              : locationState.status === 'stale'
              ? 'bg-[#E9C46A] text-[#203A2A] hover:bg-[#d8b356] border-[#d8b356]'
              : isNightMode
              ? 'bg-[#141F12]/90 text-[#A8BDA5] hover:bg-[#182315] border-[#2A3B26]'
              : 'bg-white/95 text-[#588157] hover:bg-[#FAF6EE] border-[#87A878]/40'
          }`}
          aria-label={
            isLive
              ? `GPS Live: Accurate within ${accuracy} meters. Tap for details.`
              : 'GPS unavailable. Map centered on Tallinn.'
          }
          aria-expanded={showDetails}
        >
          <div className="relative flex items-center justify-center">
            {isLive && <span className="absolute -inset-1 rounded-full animate-ping opacity-75 bg-current" />}
            {isLive ? <Crosshair className="w-4 h-4 relative z-10" /> : <AlertCircle className="w-4 h-4 relative z-10 text-amber-500" />}
          </div>
          <span className="text-xs font-mono font-bold">
            {locationState.status === 'live' ? `±${accuracy}m` : locationState.status === 'stale' ? `Stale (±${accuracy}m)` : 'GPS Off'}
          </span>
        </button>
      </div>

      {/* Detail Popover */}
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
              <h4 className="font-display font-bold text-xs">GPS Fix Status</h4>
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
            {isLive ? (
              <>
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="text-[#588157] dark:text-[#A8BDA5]">Status:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    {locationState.status === 'live' ? '● GPS LIVE' : '○ GPS STALE'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="text-[#588157] dark:text-[#A8BDA5]">Accuracy Radius:</span>
                  <span className="font-mono font-bold">±{accuracy} meters</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="text-[#588157] dark:text-[#A8BDA5]">Confidence Level:</span>
                  <span className="font-mono font-bold text-[#2A9D8F]">{confidencePercent}%</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="text-[#588157] dark:text-[#A8BDA5]">Last Fix:</span>
                  <span className="font-mono">{formatRelativeTime(locationState.timestamp)}</span>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-bold">○ GPS unavailable</p>
                <p className="text-[10px] opacity-90">Map centered on Tallinn default view. No live GNSS fix acquired. Street exploration disabled without real GPS.</p>
              </div>
            )}

            {onRecenter && (
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  onRecenter();
                }}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-[#2A9D8F] text-white font-bold flex items-center justify-center gap-1.5 hover:bg-[#238276] transition-colors cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Recenter Map</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
