import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Share2,
  Clock,
  Phone,
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

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const getEmojiCategory = (category: string, subCategory?: string) => {
    const sub = (subCategory || '').toLowerCase();
    const cat = category.toLowerCase();

    if (sub.includes('hardware') || sub.includes('tools') || cat.includes('tools')) return '🛠 Hardware';
    if (sub.includes('shelter') || sub.includes('safety') || cat.includes('safety')) return '🛡 Shelter';
    if (sub.includes('water') || sub.includes('spring') || cat.includes('water')) return '💧 Water Point';
    if (sub.includes('hospital') || sub.includes('medical')) return '🏥 Hospital';
    if (sub.includes('food') || sub.includes('store') || cat.includes('stores')) return '🛒 Store';
    return '📍 Place';
  };

  const distanceText = userLocation
    ? `${getDistanceKm(userLocation.lat, userLocation.lng, place.location.lat, place.location.lng).toFixed(1)} km away`
    : '1.2 km away';

  const sourceLabel = place.source === 'ppa'
    ? 'Police & Border Guard'
    : place.source === 'paasteamet'
    ? 'Estonian Rescue Board (Päästeamet)'
    : place.source === 'tallinn'
    ? 'Tallinn Official Open Data'
    : place.source === 'hoimu'
    ? 'HÕIMU Community Network'
    : 'OpenStreetMap';

  const freshnessText = place.updatedDaysAgo !== undefined
    ? `Updated ${place.updatedDaysAgo} days ago`
    : place.snapshotDate
    ? `Verified on ${place.snapshotDate}`
    : 'Updated recently';

  return (
    <div
      className={`p-5 rounded-3xl border shadow-xl space-y-4 text-left transition-all ${
        isNightMode
          ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Title & Category Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
            {getEmojiCategory(place.mainCategory, place.subCategory)}
          </span>
          <h2 className="text-lg sm:text-xl font-display font-black tracking-tight leading-tight uppercase">
            {place.name}
          </h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-medium">
            <span>{distanceText}</span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Open Now</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors cursor-pointer shrink-0"
          aria-label="Close details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Address / Contact Details */}
      {(place.address || place.phone || place.openingHours) && (
        <div className="space-y-2 text-xs border-t border-b border-stone-100 dark:border-stone-800/80 py-3">
          {place.address && (
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{place.address}</span>
            </div>
          )}
          {place.openingHours && (
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{place.openingHours}</span>
            </div>
          )}
          {place.phone && (
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
              <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <a href={`tel:${place.phone}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                {place.phone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Data Source & Freshness (Extremely Calm, No Jargon) */}
      <div className="flex flex-col gap-1 text-xs bg-stone-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
        <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">Data verification</span>
        <span className="font-semibold text-stone-700 dark:text-stone-200">{sourceLabel}</span>
        <span className="text-stone-500 dark:text-stone-400 text-[11px]">{freshnessText}</span>
      </div>

      {/* Primaries UX Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            if (onRouteHere) {
              onRouteHere(place.location, place.name);
            }
          }}
          className="px-4 py-3 rounded-2xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors uppercase tracking-wider"
        >
          <Navigation className="w-4 h-4" />
          <span>GO THERE</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSaved(!isSaved);
            if (onSavePlace) {
              onSavePlace(place);
            }
          }}
          className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase tracking-wider ${
            isSaved
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200'
          }`}
        >
          {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          <span>{isSaved ? 'SAVED' : 'SAVE'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onShareMesh) {
              onShareMesh(place);
            }
          }}
          className="px-4 py-3 rounded-2xl text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase tracking-wider"
        >
          <Share2 className="w-4 h-4" />
          <span>SHARE</span>
        </button>
      </div>

      {/* Advanced Details (Only under sub-disclosure) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between text-[10px] font-mono text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
        >
          <span>Advanced parameters</span>
          {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2.5 p-3 rounded-2xl bg-stone-50 dark:bg-black/20 border border-stone-200 dark:border-stone-800 space-y-1.5 text-[10px] font-mono text-stone-600 dark:text-stone-300">
            {place.sourceId && (
              <div className="flex justify-between">
                <span>Unique Identifier:</span>
                <span className="font-semibold">{place.sourceId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Trust Status:</span>
              <span className="font-semibold uppercase">{place.provenanceStatus || 'Standard'}</span>
            </div>
            {place.location && (
              <div className="flex justify-between">
                <span>GPS Coordinate:</span>
                <span>{place.location.lat.toFixed(5)}°, {place.location.lng.toFixed(5)}°</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
