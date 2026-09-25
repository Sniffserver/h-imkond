import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Share2,
  Clock,
  Phone,
  ShieldCheck,
  Building,
  Sparkles,
  Wrench,
  Store,
  Droplets,
  Trees,
  X,
  AlertTriangle,
  Radio,
  Bookmark,
  Check,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MapPlace, GeoPoint } from '../../../types';

interface PlaceDetailCardProps {
  place: MapPlace;
  userLocation?: GeoPoint;
  isNightMode?: boolean;
  onClose: () => void;
  onRouteHere?: (point: GeoPoint, title: string) => void;
  onShareMesh?: (place: MapPlace) => void;
  onSavePlace?: (place: MapPlace) => void;
}

export const PlaceDetailCard: React.FC<PlaceDetailCardProps> = ({
  place,
  userLocation,
  isNightMode = false,
  onClose,
  onRouteHere,
  onShareMesh,
  onSavePlace,
}) => {
  const [showMismatchDetails, setShowMismatchDetails] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'safety':
        return <ShieldCheck className="w-5 h-5 text-rose-500" />;
      case 'tools':
        return <Wrench className="w-5 h-5 text-amber-500" />;
      case 'stores':
        return <Store className="w-5 h-5 text-teal-500" />;
      case 'finds':
        return <Sparkles className="w-5 h-5 text-emerald-500" />;
      case 'water':
        return <Droplets className="w-5 h-5 text-cyan-500" />;
      case 'nature':
        return <Trees className="w-5 h-5 text-green-500" />;
      default:
        return <MapPin className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getProvenanceBadge = () => {
    if (place.hasMismatch || place.provenanceStatus === 'mismatch') {
      return {
        bg: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40',
        label: '⚠ Data Mismatch',
      };
    }
    if (place.source === 'ppa') {
      return {
        bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
        label: 'PPA Official Registry',
      };
    }
    if (place.source === 'paasteamet') {
      return {
        bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
        label: 'Päästeamet Official Shelter/Rescue',
      };
    }
    if (place.source === 'tallinn') {
      return {
        bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
        label: 'Tallinn Open Data',
      };
    }
    if (place.source === 'hoimu' || place.provenanceStatus === 'community') {
      return {
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        label: 'HÕIMU Mesh Observed',
      };
    }
    return {
      bg: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
      label: 'OpenStreetMap Snapshot',
    };
  };

  const prov = getProvenanceBadge();

  return (
    <div
      className={`p-5 rounded-3xl border shadow-xl space-y-4 text-left transition-all ${
        isNightMode
          ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-xs">
            {getCategoryIcon(place.mainCategory)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${prov.bg}`}>
                {prov.label}
              </span>
              {place.updatedDaysAgo !== undefined && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  Updated {place.updatedDaysAgo}d ago
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-display font-black tracking-tight mt-0.5">
              {place.name}
            </h2>
            {place.address && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{place.address}</span>
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* DATA MISMATCH BANNER (HÕIMU Mechanical Truth Principle) */}
      {(place.hasMismatch || (place.discrepancies && place.discrepancies.length > 0)) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-bold font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>⚠ Data mismatch between authoritative registry & OSM</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMismatchDetails(!showMismatchDetails)}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showMismatchDetails ? 'Hide' : 'Inspect'}</span>
              {showMismatchDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <p className="text-[11px] opacity-90 leading-relaxed">
            HÕIMU does not silently suppress conflicting records. Official state data and OpenStreetMap community tags disagree on location or parcel details.
          </p>

          {showMismatchDetails && place.discrepancies && (
            <div className="mt-2 space-y-2 pt-2 border-t border-amber-500/20">
              {place.discrepancies.map((disc, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-amber-500/10 space-y-1 font-mono text-[11px]">
                  <div className="font-bold text-amber-900 dark:text-amber-100 uppercase text-[10px] tracking-wider">
                    {disc.field}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[9px]">SOURCE A ({disc.sourceA}):</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{disc.valueA}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block text-[9px]">SOURCE B ({disc.sourceB}):</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{disc.valueB}</span>
                    </div>
                  </div>
                  {disc.warningNote && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 italic pt-1">
                      ℹ {disc.warningNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {place.description && (
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          {place.description}
        </p>
      )}

      {/* HÕIMU COMMUNITY OBSERVATION STATUS (Never converted to official) */}
      {(place.source === 'hoimu' || place.provenanceStatus === 'community') && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Community Mesh Observation</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
            <span>Observed by nodes:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{place.observedByNodes || 2} nodes</span>
          </div>
          {place.lastConfirmed && (
            <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
              <span>Last confirmed:</span>
              <span className="font-semibold">{place.lastConfirmed}</span>
            </div>
          )}
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 italic pt-1 border-t border-emerald-500/10">
            Observed community point — maintained by mesh peers, not an official municipal register.
          </div>
        </div>
      )}

      {/* Provenance Box (Authoritative Source & Snapshot Date) */}
      <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-dashed border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 uppercase tracking-wider">Primary Source</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{place.sourceName || place.source}</span>
        </div>
        {place.secondarySourceName && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 uppercase tracking-wider">Cross-Checked With</span>
            <span className="font-medium text-zinc-600 dark:text-zinc-300">{place.secondarySourceName}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 uppercase tracking-wider">Registry Status</span>
          <span className="font-bold uppercase text-zinc-700 dark:text-zinc-300">{place.provenanceStatus}</span>
        </div>
        {place.snapshotDate && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 uppercase tracking-wider">Offline Snapshot</span>
            <span className="text-zinc-500">{place.snapshotDate}</span>
          </div>
        )}
      </div>

      {/* Practical Details: Opening Hours & Phone */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {place.openingHours && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-black/20">
            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{place.openingHours}</span>
          </div>
        )}
        {place.phone && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-black/20">
            <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <a href={`tel:${place.phone}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate">
              {place.phone}
            </a>
          </div>
        )}
      </div>

      {/* Action Buttons: Route, Save, Share via Mesh */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            if (onRouteHere) {
              onRouteHere(place.location, place.name);
            }
          }}
          className="px-3 py-2.5 rounded-2xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
        >
          <Navigation className="w-4 h-4" />
          <span>Route</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSaved(!isSaved);
            if (onSavePlace) {
              onSavePlace(place);
            }
          }}
          className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
          }`}
        >
          {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onShareMesh) {
              onShareMesh(place);
            }
          }}
          className="px-3 py-2.5 rounded-2xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
};
