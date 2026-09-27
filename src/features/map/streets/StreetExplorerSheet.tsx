import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Compass,
  Footprints,
  MapPin,
  CheckCircle2,
  Navigation,
  ArrowRight,
  ShieldAlert,
  Wrench,
  BookOpen,
  Sparkles,
  Droplets,
  Layers,
  ChevronRight,
  Route as RouteIcon,
  X,
  Store,
  Radio,
} from 'lucide-react';
import { Street, MapPlace, GeoPoint } from '../../../types';
import { streetDiscoveryService } from './streetDiscoveryService';
import { generateFieldWalkRoute, FieldWalkRoute } from './streetWalkGenerator';
import { searchPlaces } from '../places/placeSearch';
import { TALLINN_MAP_PLACES } from '../places/placeData';
import { PlaceDetailCard } from '../places/PlaceDetailCard';
import { calculateNearbyReport } from '../places/nearbyEngine';

interface StreetExplorerSheetProps {
  userLocation?: GeoPoint;
  isNightMode?: boolean;
  onSelectStreet?: (street: Street) => void;
  onSelectPlace?: (place: MapPlace) => void;
  onStartWalk?: (route: FieldWalkRoute) => void;
  onRouteHere?: (point: GeoPoint, title: string) => void;
  onOpenNearbySheet?: () => void;
}

const SEARCH_PLACEHOLDERS = [
  "Narva maantee",
  "riistapood",
  "politsei",
  "midagi huvitavat",
  "Vana-Kalamaja",
  "second hand"
];

export const StreetExplorerSheet: React.FC<StreetExplorerSheetProps> = ({
  userLocation = { lat: 59.4370, lng: 24.7535 },
  isNightMode = false,
  onSelectStreet,
  onSelectPlace,
  onStartWalk,
  onRouteHere,
  onOpenNearbySheet,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'nearby' | 'popular' | 'unexplored' | 'places' | 'streets'>('nearby');
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [activeWalkRoute, setActiveWalkRoute] = useState<FieldWalkRoute | null>(null);
  const [isFieldRouteOpen, setIsFieldRouteOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const streets = useMemo(() => streetDiscoveryService.getStreets(), []);
  const nearbyReport = useMemo(() => calculateNearbyReport(userLocation, 3000), [userLocation]);

  // Distance-based Tallinn exploration stats
  const totalNetworkMeters = useMemo(() => streets.reduce((acc, s) => acc + (s.lengthMeters || 1000), 0), [streets]);
  const totalDiscoveredMeters = useMemo(() => streets.reduce((acc, s) => acc + (s.discoveredMeters || 0), 0), [streets]);
  const overallExploredPercent = totalNetworkMeters > 0 ? ((totalDiscoveredMeters / totalNetworkMeters) * 100).toFixed(1) : '0.0';
  const totalDiscoveredKm = (totalDiscoveredMeters / 1000).toFixed(1);
  const totalNetworkKm = (totalNetworkMeters / 1000).toFixed(1);

  // Search filtered results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { streets: [], places: [], hoimu: [] };

    const matchingStreets = streets.filter(
      (s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.district && s.district.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 4);

    const matchingPlaces = searchPlaces(q, userLocation, 10000, TALLINN_MAP_PLACES).slice(0, 6);
    const matchingHoimu = TALLINN_MAP_PLACES.filter(
      (p) => p.source === 'hoimu' && (p.name.toLowerCase().includes(q.toLowerCase()) || p.description?.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 3);

    return { streets: matchingStreets, places: matchingPlaces, hoimu: matchingHoimu };
  }, [searchQuery, streets, userLocation]);

  const handleBuildWalk = () => {
    const route = generateFieldWalkRoute(userLocation);
    setActiveWalkRoute(route);
    setIsFieldRouteOpen(true);
    if (onStartWalk) {
      onStartWalk(route);
    }
  };

  const renderProgressBar = (percent: number = 0) => {
    const totalBlocks = 16;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const filledStr = '█'.repeat(filledBlocks);
    const emptyStr = '░'.repeat(totalBlocks - filledBlocks);
    return `${filledStr}${emptyStr}`;
  };

  return (
    <div className="space-y-3">
      {/* 1. UNIVERSAL SEARCH BAR */}
      <div
        className={`relative flex items-center rounded-2xl border px-3.5 py-2.5 shadow-sm transition-colors ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mr-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`🔎 Search Tallinn (e.g. '${SEARCH_PLACEHOLDERS[placeholderIndex]}')...`}
          className="w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. AUTOCOMPLETE SEARCH RESULTS STREAM OR TABS */}
      {searchQuery ? (
        <div
          className={`rounded-2xl border p-3 shadow-lg max-h-72 overflow-y-auto space-y-3 text-left ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/30 text-[#203A2A]'
          }`}
        >
          {searchResults.streets.length === 0 && searchResults.places.length === 0 && searchResults.hoimu.length === 0 && (
            <p className="text-xs text-zinc-500 p-3 text-center">No results found for "{searchQuery}"</p>
          )}

          {searchResults.streets.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                STREETS ({searchResults.streets.length})
              </span>
              <div className="mt-1 space-y-1">
                {searchResults.streets.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedStreet(st);
                      setSelectedPlace(null);
                      setSearchQuery('');
                      if (onSelectStreet) onSelectStreet(st);
                    }}
                    className="w-full p-2 rounded-xl flex items-center justify-between text-left hover:bg-emerald-500/10 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold">{st.name}</div>
                      <div className="text-[10px] text-zinc-500">{st.district} • {((st.lengthMeters || 1000) / 1000).toFixed(1)} km</div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600">{st.exploredPercent || 0}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.places.length > 0 && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                PLACES ({searchResults.places.length})
              </span>
              <div className="mt-1 space-y-1">
                {searchResults.places.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(place);
                      setSelectedStreet(null);
                      if (onSelectPlace) onSelectPlace(place);
                      setSearchQuery('');
                    }}
                    className="w-full p-2 rounded-xl flex items-center justify-between text-left hover:bg-amber-500/10 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{place.name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {place.subCategory || place.mainCategory}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500">{place.address || place.description}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.hoimu.length > 0 && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-teal-600 dark:text-teal-400">
                HÕIMU ({searchResults.hoimu.length})
              </span>
              <div className="mt-1 space-y-1">
                {searchResults.hoimu.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(h);
                      setSelectedStreet(null);
                      if (onSelectPlace) onSelectPlace(h);
                      setSearchQuery('');
                    }}
                    className="w-full p-2 rounded-xl flex items-center justify-between text-left hover:bg-teal-500/10 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-teal-700 dark:text-teal-300">✨ {h.name}</div>
                      <div className="text-[10px] text-zinc-500">{h.description}</div>
                    </div>
                    <Radio className="w-3.5 h-3.5 text-teal-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CLEAN SIMPLIFIED TABS */
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-medium">
          {[
            { id: 'nearby', label: 'Nearby' },
            { id: 'popular', label: 'Popular' },
            { id: 'unexplored', label: 'Unexplored' },
            { id: 'places', label: 'Places' },
            { id: 'streets', label: 'Streets' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-[#588157] text-white font-bold shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] hover:bg-[#20301C]'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. SELECTED PLACE DETAIL CARD */}
      {selectedPlace && (
        <PlaceDetailCard
          place={selectedPlace}
          userLocation={userLocation}
          isNightMode={isNightMode}
          onClose={() => setSelectedPlace(null)}
          onRouteHere={onRouteHere}
        />
      )}

      {/* 4. EXEMPLARY STREET DETAIL CARD */}
      {selectedStreet && (
        <div
          className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-3 transition-all ${
            isNightMode
              ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                Tallinn Street Explorer
              </span>
              <h2 className="text-base sm:text-lg font-display font-black uppercase tracking-tight">
                {selectedStreet.name}
              </h2>
              <p className="text-xs text-zinc-500">{selectedStreet.district || 'Tallinn'}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStreet(null)}
              className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">{((selectedStreet.lengthMeters || 1000) / 1000).toFixed(1)} km mapped length</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {selectedStreet.exploredPercent || 0}% walked
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 tracking-wider">
              {renderProgressBar(selectedStreet.exploredPercent || 0)}
            </div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
              You've discovered: <span className="font-bold">{(((selectedStreet.discoveredMeters || 0) / 1000)).toFixed(1)} km</span>
            </div>
          </div>

          {/* Nearby Categories Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
              🛠 Hardware
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300">
              🏪 Stores
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              ♻ Finds
            </span>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
              📡 HÕIMU peers
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                if (onSelectStreet) onSelectStreet(selectedStreet);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#476a46] cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Walk this street</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const pt = { lat: selectedStreet.geometry.coordinates[0][1], lng: selectedStreet.geometry.coordinates[0][0] };
                if (onRouteHere) onRouteHere(pt, selectedStreet.name);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Route there</span>
            </button>
          </div>
        </div>
      )}

        {/* 5. EXPLORE THIS AREA & SURPRISE ME SIGNATURE CARD */}
        <div
          className={`p-4.5 rounded-2xl border transition-all space-y-3 ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-emerald-50/70 border-emerald-200/80 text-[#203A2A]'
          }`}
        >
          {/* Section Header */}
          <div className="flex items-center justify-between border-b pb-2 border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                EXPLORE
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-500">
              {totalDiscoveredKm} km / {totalNetworkKm} km ({overallExploredPercent}%)
            </span>
          </div>

          {/* Nearby Summary */}
          <div className="p-3 rounded-xl bg-white/80 dark:bg-black/30 border border-emerald-200/50 dark:border-emerald-900/30">
            <div className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">Nearby</div>
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <span>3 new streets</span>
              <span>•</span>
              <span>8 useful places</span>
            </div>
          </div>

          {/* Unexplored Streets Quick List */}
          <div>
            <div className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1.5">Unexplored</div>
            <div className="flex flex-wrap gap-1.5">
              {['Koidu tänav', 'Vana-Kalamaja', 'Tööstuse', 'Soo tänav'].map((stName) => {
                const match = streets.find((s) => s.name.toLowerCase().includes(stName.toLowerCase()));
                return (
                  <button
                    key={stName}
                    type="button"
                    onClick={() => {
                      if (match) {
                        setSelectedStreet(match);
                        if (onSelectStreet) onSelectStreet(match);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-medium bg-white/90 dark:bg-black/40 border border-zinc-200/80 dark:border-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                  >
                    📍 {stName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Find Something Quick Categories */}
          <div>
            <div className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1.5">Find something</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { label: '♻ Reuse', category: 'finds' },
                { label: '🛠 Tools', category: 'tools' },
                { label: '📚 Book', category: 'finds' },
                { label: '🌳 Nature', category: 'nature' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    const route = generateFieldWalkRoute(userLocation, item.category);
                    setActiveWalkRoute(route);
                    setIsFieldRouteOpen(true);
                    if (onStartWalk) onStartWalk(route);
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-black/40 border border-emerald-300/60 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 cursor-pointer text-center transition-all shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main "Surprise Me" Pedestrian Graph Route Generator Trigger */}
          <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
              Calculates loop over real pedestrian routing graph
            </span>
            <button
              type="button"
              onClick={handleBuildWalk}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#588157] hover:bg-[#476a46] text-white shadow-md cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Surprise me</span>
            </button>
          </div>

          {/* SURPRISE ME Active Loop Preview & Field Objectives Card */}
          {isFieldRouteOpen && activeWalkRoute && (
            <div className="mt-3 p-3.5 rounded-2xl bg-white dark:bg-black/50 border border-emerald-400/60 dark:border-emerald-800 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b pb-2 border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    SURPRISE ME
                  </span>
                  <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 font-mono">
                    {activeWalkRoute.estimatedTimeMinutes} min • {activeWalkRoute.totalDistanceKm} km
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFieldRouteOpen(false)}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Verified Walk Loop Highlights */}
              <div className="space-y-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>✓ {activeWalkRoute.unexploredStreetsCount} new streets</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>✓ {activeWalkRoute.suggestedPlaces.length} useful place</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>✓ {activeWalkRoute.neighborhoodsVisited.join(' / ') || '1 new neighborhood'}</span>
                </div>
              </div>

              {/* Requirement #24: Field Objectives (Knowledge is the Reward) */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold uppercase text-[10px] text-emerald-800 dark:text-emerald-300 tracking-wider">
                    FIELD OBJECTIVES
                  </span>
                  <span className="text-[10px] text-zinc-500 italic">The reward is knowledge</span>
                </div>
                <div className="space-y-1 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                  <div>□ Discover {activeWalkRoute.fieldObjectives.discoverStreetSegments} street segments</div>
                  <div>□ Visit {activeWalkRoute.fieldObjectives.visitPlacesCount} new useful place</div>
                  <div>□ Observe mesh signal & log radio landscape</div>
                  <div>□ Return to campfire</div>
                </div>
              </div>

              {/* Field Report Preview */}
              {activeWalkRoute.fieldReport && (
                <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs font-mono">
                  <span className="font-bold uppercase text-[10px] text-zinc-500">FIELD REPORT SUMMARY</span>
                  <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
                    ✓ {activeWalkRoute.fieldReport.streetsDiscoveredCount} streets discovered • ✓ {activeWalkRoute.fieldReport.placesConfirmedCount} place confirmed • ✓ {activeWalkRoute.fieldReport.distanceKm} km mapped • ✓ {activeWalkRoute.fieldReport.radioObservationsCount} radio observations
                  </div>
                </div>
              )}

              {/* Start Walk Button */}
              <button
                type="button"
                onClick={() => {
                  if (onStartWalk) onStartWalk(activeWalkRoute);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[#588157] hover:bg-[#476a46] text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <Footprints className="w-4 h-4" />
                <span>Start walk</span>
              </button>
            </div>
          )}
        </div>
    </div>
  );
};
