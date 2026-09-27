import React, { useState, useEffect } from 'react';
import { NeighborhoodIntelligence } from '../../../types';
import { neighborhoodIntelligenceService } from './neighborhoodIntelligenceService';
import {
  Building2,
  X,
  Radio,
  Navigation2,
  MapPin,
  Clock,
  ShieldCheck,
  TrendingUp,
  Award,
} from 'lucide-react';

interface NeighborhoodIntelligenceSheetProps {
  onClose: () => void;
  onSelectDistrict?: (districtName: string) => void;
}

function formatLastVisit(timestamp?: number): string {
  if (!timestamp) return 'Not yet visited';
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${Math.max(1, diffMins)} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

export const NeighborhoodIntelligenceSheet: React.FC<NeighborhoodIntelligenceSheetProps> = ({
  onClose,
  onSelectDistrict,
}) => {
  const [districts, setDistricts] = useState<NeighborhoodIntelligence[]>(() =>
    neighborhoodIntelligenceService.getNeighborhoods()
  );

  useEffect(() => {
    setDistricts(neighborhoodIntelligenceService.getNeighborhoods());
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-stone-900 border-t border-stone-700/60 rounded-t-2xl shadow-2xl p-4 sm:p-6 max-h-[85vh] flex flex-col max-w-2xl mx-auto text-amber-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100">
              Tallinn Neighborhood Intelligence
            </h2>
            <p className="text-xs text-stone-400">
              Empirical exploration telemetry derived directly from physical trace observations
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition"
          aria-label="Close sheet"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* District Intelligence Cards */}
      <div className="flex-1 overflow-y-auto space-y-3.5 mt-4 pr-1">
        {districts.map((district) => (
          <div
            key={district.district}
            className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80 hover:border-stone-700 transition space-y-3"
          >
            {/* Header & Confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-stone-100">{district.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                    district.confidence === 'high'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      : district.confidence === 'medium'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                      : 'bg-stone-900 text-stone-400 border border-stone-800'
                  }`}
                >
                  {district.confidence} confidence
                </span>
              </div>
              <div className="flex items-center text-xs text-stone-400 space-x-1 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatLastVisit(district.lastVisitedAt)}</span>
              </div>
            </div>

            {/* Strict Empirical Metrics Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800/60">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                  <Navigation2 className="w-3 h-3 text-amber-400" />
                  Streets
                </div>
                <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                  {district.streetsExploredPercent}%
                </div>
                <div className="text-[10px] text-stone-400">
                  {district.streetsExploredCount} / {district.streetsTotal}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800/60">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Places
                </div>
                <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                  {district.placesDiscoveredPercent}%
                </div>
                <div className="text-[10px] text-stone-400">
                  {district.placesDiscoveredCount} / {district.placesTotal}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800/60">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-3 h-3 text-sky-400" />
                  Mesh Packets
                </div>
                <div className="text-sm font-mono font-bold text-sky-300 mt-0.5">
                  {district.meshObservationsCount}
                </div>
                <div className="text-[10px] text-stone-400">Observed</div>
              </div>

              <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800/60">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  RF Coverage
                </div>
                <div className="text-sm font-mono font-bold text-indigo-300 mt-0.5">
                  {district.signalCoverageKm} km
                </div>
                <div className="text-[10px] text-stone-400">Track radius</div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div>
              <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, district.streetsExploredPercent)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
