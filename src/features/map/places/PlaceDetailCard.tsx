import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Share2,
  Clock,
  Phone,
  ShieldCheck,
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
  const [showMoreInfo, setShowMoreInfo] = useState(false);
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

  const sourceLabel = place.source === 'ppa'
    ? 'PPA'
    : place.source === 'paasteamet'
    ? 'Päästeamet'
    : place.source === 'tallinn'
    ? 'Tallinn Open Data'
    : place.source === 'hoimu'
    ? 'HÕIMU'
    : 'OSM';

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border shadow-xl space-y-3 text-left transition-all ${
        isNightMode
          ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-xs">
            {getCategoryIcon(place.mainCategory)}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-display font-black tracking-tight leading-tight">
              {place.name}
            </h2>
            <p className="text-xs text-zinc-500 capitalize">
              {place.mainCategory} {place.subCategory ? `· ${place.subCategory.replace('_', ' ')}` : ''}
            </p>
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

      {/* Primary Details: Address, Hours, Phone */}
      <div className="space-y-1.5 text-xs">
        {place.address && (
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{place.address}</span>
          </div>
        )}
        {place.openingHours && (
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{place.openingHours}</span>
          </div>
        )}
        {place.phone && (
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <a href={`tel:${place.phone}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate">
              {place.phone}
            </a>
          </div>
        )}
      </div>

      {/* Data Provenance & Freshness Breakdown (Axiomatic Trust Badge) */}
      <div className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          {place.provenanceStatus === 'official' ? (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
              <span className="p-1 rounded-md bg-rose-500/10 border border-rose-500/20">🚨</span>
              <span>Official State Register</span>
            </div>
          ) : place.provenanceStatus === 'observed' || place.source === 'hoimu' ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
              <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">✨</span>
              <span>HÕIMU Community Observation</span>
            </div>
          ) : place.provenanceStatus === 'fixture' || place.provenanceStatus === 'simulated' ? (
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
              <span className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20">🧪</span>
              <span>Simulated Fixture (Dev Mode)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
              <span className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20">🛠</span>
              <span>OpenStreetMap Community POI</span>
            </div>
          )}

          <span className="text-[10px] font-mono text-zinc-400">
            {place.updatedDaysAgo !== undefined
              ? `${place.updatedDaysAgo}d ago`
              : place.snapshotDate
              ? `Updated: ${place.snapshotDate}`
              : 'Verified'}
          </span>
        </div>

        {/* Multi-Source Provenance Tags */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {place.sources && place.sources.length > 0 ? (
            place.sources.map((s, idx) => {
              const providerName =
                s.provider === 'paasteamet'
                  ? 'Päästeamet'
                  : s.provider === 'ppa'
                  ? 'PPA'
                  : s.provider === 'tallinn'
                  ? 'Tallinn Open Data'
                  : s.provider === 'ads'
                  ? 'Maa-amet ADS'
                  : s.provider === 'hoimu'
                  ? 'HÕIMU Mesh'
                  : 'OpenStreetMap';

              return (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono"
                >
                  <span className="font-bold text-zinc-700 dark:text-zinc-200">{providerName}</span>
                  <span className="text-zinc-400">
                    {s.publishedAt ? '· official' : s.retrievedAt ? '· snapshot' : ''}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-200">
              {sourceLabel}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Route, Save, Share */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (onRouteHere) {
              onRouteHere(place.location, place.name);
            }
          }}
          className="px-3 py-2 rounded-2xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
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
          className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
          }`}
        >
          {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onShareMesh) {
              onShareMesh(place);
            }
          }}
          className="px-3 py-2 rounded-2xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
      </div>

      {/* Collapsible Technical / Inspector Details */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowMoreInfo(!showMoreInfo)}
          className="w-full flex items-center justify-between text-[11px] font-mono font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
        >
          <span>More information</span>
          {showMoreInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showMoreInfo && (
          <div className="mt-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-[11px] font-mono">
            {place.sourceId && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Source ID:</span>
                <span className="font-semibold">{place.sourceId}</span>
              </div>
            )}
            {place.secondarySourceName && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Cross-check:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{place.secondarySourceName}</span>
              </div>
            )}
            {place.snapshotDate && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Snapshot date:</span>
                <span>{place.snapshotDate}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-400">Provenance:</span>
              <span className="uppercase font-bold">{place.provenanceStatus}</span>
            </div>

            {/* Generalized Conflict Surface (Requirement #29: Don't choose silently) */}
            {(place.conflicts && place.conflicts.length > 0) ? (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>STATUS: ⚠ SOURCES DISAGREE</span>
                </div>
                {place.conflicts.map((c) => (
                  <div key={c.id} className="text-[10px] space-y-1 bg-white/60 dark:bg-black/30 p-2 rounded-lg border border-amber-500/20">
                    <div className="font-bold text-amber-800 dark:text-amber-300">{c.field}</div>
                    <div className="text-zinc-600 dark:text-zinc-400 italic text-[9px] mb-1">{c.summary}</div>
                    <div className="space-y-0.5 font-mono">
                      {c.claims.map((claim, cIdx) => (
                        <div key={cIdx} className="flex justify-between items-center text-[10px]">
                          <span className="font-bold uppercase text-zinc-700 dark:text-zinc-300">{claim.provider}:</span>
                          <span className="text-zinc-800 dark:text-zinc-200">{claim.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (place.hasMismatch || place.discrepancies) && (
              <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1 font-bold text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>STATUS: ⚠ SOURCES DISAGREE</span>
                </div>
                {place.discrepancies?.map((d, i) => (
                  <div key={i} className="text-[10px] space-y-0.5">
                    <span className="block font-bold">{d.field}:</span>
                    <span className="block opacity-80">A: {d.valueA}</span>
                    <span className="block opacity-80">B: {d.valueB}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            {place.tags && Object.keys(place.tags).length > 0 && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-400 block mb-1">Raw tags:</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(place.tags).map(([k, v]) => (
                    <span key={k} className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-[10px]">
                      {k}={v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
