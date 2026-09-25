import React, { useState, useMemo } from 'react';
import {
  Compass,
  Wrench,
  Store,
  ShieldAlert,
  Sparkles,
  Droplets,
  Trees,
  Zap,
  ChevronRight,
  ArrowRight,
  MapPin,
  X,
  Filter,
} from 'lucide-react';
import { MapPlace, GeoPoint, PlaceMainCategory } from '../../../types';
import { calculateNearbyReport, NearbyCategorySummary } from './nearbyEngine';

interface NearbyPlacesSheetProps {
  userLocation?: GeoPoint;
  isNightMode?: boolean;
  onSelectPlace?: (place: MapPlace) => void;
  onFilterCategory?: (category: PlaceMainCategory | 'all') => void;
  onClose?: () => void;
}

export const NearbyPlacesSheet: React.FC<NearbyPlacesSheetProps> = ({
  userLocation = { lat: 59.4370, lng: 24.7535 },
  isNightMode = false,
  onSelectPlace,
  onFilterCategory,
  onClose,
}) => {
  const [selectedRadius, setSelectedRadius] = useState<number>(3000); // 3000m default
  const [selectedCategory, setSelectedCategory] = useState<PlaceMainCategory | 'all'>('all');

  const report = useMemo(() => {
    return calculateNearbyReport(userLocation, selectedRadius);
  }, [userLocation, selectedRadius]);

  const filteredPlaces = useMemo(() => {
    if (selectedCategory === 'all') {
      return report.allNearbyPlaces;
    }
    return report.allNearbyPlaces.filter((p) => p.mainCategory === selectedCategory);
  }, [report, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tools':
        return <Wrench className="w-4 h-4 text-amber-500" />;
      case 'stores':
        return <Store className="w-4 h-4 text-teal-500" />;
      case 'safety':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'finds':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-cyan-500" />;
      case 'nature':
        return <Trees className="w-4 h-4 text-green-500" />;
      case 'energy':
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <MapPin className="w-4 h-4 text-emerald-500" />;
    }
  };

  const handleCategoryClick = (category: PlaceMainCategory) => {
    const next = selectedCategory === category ? 'all' : category;
    setSelectedCategory(next);
    if (onFilterCategory) {
      onFilterCategory(next);
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border shadow-xl space-y-4 text-left transition-all ${
        isNightMode
          ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Header with Radius Toggles */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-display font-black uppercase tracking-tight">
              Nearby Places
            </h2>
            <p className="text-[11px] text-zinc-500">
              {report.totalPlacesCount} places within {selectedRadius >= 1000 ? `${(selectedRadius / 1000).toFixed(1)} km` : `${selectedRadius} m`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Radius Selector Pills */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-bold">
            {[500, 1500, 3000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRadius(r)}
                className={`px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                  selectedRadius === r
                    ? 'bg-[#588157] text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Summary Grid (1-Tap Fast Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {report.summaries.map((summary) => {
          const isSelected = selectedCategory === summary.category;
          return (
            <button
              key={summary.category}
              type="button"
              onClick={() => handleCategoryClick(summary.category)}
              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#588157] text-white border-[#476a46] shadow-sm'
                  : isNightMode
                  ? 'bg-[#141F12] hover:bg-[#20301C] border-[#2A3B26]'
                  : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200/80 text-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0">{getCategoryIcon(summary.category)}</div>
                <span className="text-xs font-bold truncate">{summary.label}</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                  isSelected
                    ? 'bg-black/20 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {summary.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Places List within Selected Filter */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pb-1">
          <span>{filteredPlaces.length} {selectedCategory === 'all' ? 'total places' : `${selectedCategory} places`}</span>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                if (onFilterCategory) onFilterCategory('all');
              }}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>

        {filteredPlaces.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => {
              if (onSelectPlace) onSelectPlace(place);
            }}
            className={`w-full p-2.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#141F12] hover:bg-[#20301C] border-[#2A3B26]'
                : 'bg-white hover:bg-zinc-50 border-zinc-200/80 text-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                {getCategoryIcon(place.mainCategory)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{place.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {place.address || place.description}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {place.distanceMeters && place.distanceMeters >= 1000
                  ? `${(place.distanceMeters / 1000).toFixed(1)} km`
                  : `${place.distanceMeters || 0} m`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
