import React, { useState, useEffect } from 'react';
import { GeoPoint, Street, MapPlace, UnknownNearbySummary } from '../../../types';
import { unknownNearbyService } from './unknownNearbyService';
import {
  Compass,
  X,
  MapPin,
  EyeOff,
  Navigation,
  Sparkles,
  Layers,
  CheckCircle2,
  ChevronRight,
  Radio,
} from 'lucide-react';

interface UnknownNearbySheetProps {
  userLocation?: GeoPoint;
  onClose: () => void;
  onSelectStreet?: (street: Street) => void;
  onSelectPlace?: (place: MapPlace) => void;
}

export const UnknownNearbySheet: React.FC<UnknownNearbySheetProps> = ({
  userLocation,
  onClose,
  onSelectStreet,
  onSelectPlace,
}) => {
  const [summary, setSummary] = useState<UnknownNearbySummary>(() =>
    unknownNearbyService.getUnknownNearby(userLocation)
  );

  useEffect(() => {
    setSummary(unknownNearbyService.getUnknownNearby(userLocation));
  }, [userLocation]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-stone-900 border-t border-amber-900/40 rounded-t-2xl shadow-2xl p-4 sm:p-6 max-h-[85vh] flex flex-col max-w-2xl mx-auto text-amber-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100 flex items-center gap-2">
              What Have I Not Seen?
              <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-mono">
                {summary.primaryDistrict}
              </span>
            </h2>
            <p className="text-xs text-stone-400">
              Unexplored streets, unvisited places, and uncharted signals within 1.2 km
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

      {/* Exploration Loop Summary Metric Tiles */}
      <div className="grid grid-cols-4 gap-2 my-4">
        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-center">
          <div className="text-xl font-mono font-bold text-amber-400">
            {summary.unexploredStreetsCount}
          </div>
          <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
            Streets
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-center">
          <div className="text-xl font-mono font-bold text-emerald-400">
            {summary.unexploredPlacesCount}
          </div>
          <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
            Places
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-center">
          <div className="text-xl font-mono font-bold text-sky-400">
            {summary.unvisitedDistrictsCount}
          </div>
          <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
            Districts
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-center">
          <div className="text-xl font-mono font-bold text-indigo-400">
            {summary.unobservedMeshPathsCount}
          </div>
          <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
            Mesh Paths
          </div>
        </div>
      </div>

      <div className="text-xs text-stone-400 mb-2 px-1 flex items-center gap-1.5 font-medium">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Unexplored Nearby Candidates</span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Unexplored Streets Section */}
        <div>
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Unwalked Streets ({summary.nearestUnexploredStreets.length})</span>
          </div>
          <div className="space-y-1.5">
            {summary.nearestUnexploredStreets.map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  if (onSelectStreet) onSelectStreet(st);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/50 flex items-center justify-between transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{st.name}</div>
                    <div className="text-xs text-stone-400">
                      {st.district || 'Tallinn'} • {st.lengthMeters ? `${st.lengthMeters}m` : 'Street segment'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-amber-300/80 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                    Explore
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-300" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Unexplored Places Section */}
        <div>
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Unvisited Places & Resources ({summary.nearestUnexploredPlaces.length})</span>
          </div>
          <div className="space-y-1.5">
            {summary.nearestUnexploredPlaces.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  if (onSelectPlace) onSelectPlace(pl);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/50 flex items-center justify-between transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{pl.name}</div>
                    <div className="text-xs text-stone-400">
                      {pl.subCategory} • {pl.address || 'Tallinn'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-emerald-300/80 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                    {pl.mainCategory}
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
