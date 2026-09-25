import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Street, Poi, MapPlace, GeoPoint } from '../../../types';
import { streetDiscoveryService } from './streetDiscoveryService';
import { generateFieldWalkRoute, FieldWalkRoute } from './streetWalkGenerator';
import { searchPlaces } from '../places/placeSearch';
import { TALLINN_MAP_PLACES } from '../places/placeData';
import { PlaceDetailCard } from '../places/PlaceDetailCard';

interface StreetExplorerSheetProps {
  userLocation?: GeoPoint;
  isNightMode?: boolean;
  onSelectStreet?: (street: Street) => void;
  onSelectPoi?: (poi: Poi) => void;
  onSelectPlace?: (place: MapPlace) => void;
  onStartWalk?: (route: FieldWalkRoute) => void;
  onRouteHere?: (point: GeoPoint, title: string) => void;
  onOpenNearbySheet?: () => void;
}

export const StreetExplorerSheet: React.FC<StreetExplorerSheetProps> = ({
  userLocation = { lat: 59.4370, lng: 24.7535 },
  isNightMode = false,
  onSelectStreet,
  onSelectPoi,
  onSelectPlace,
  onStartWalk,
  onRouteHere,
  onOpenNearbySheet,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [activeWalkRoute, setActiveWalkRoute] = useState<FieldWalkRoute | null>(null);
  const [isFieldRouteOpen, setIsFieldRouteOpen] = useState(false);

  const streets = useMemo(() => streetDiscoveryService.getStreets(), []);
  
  // Search filtered results with natural language normalization
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { streets: [], places: [] };

    const matchingStreets = streets.filter(
      (s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.district && s.district.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 5);

    const matchingPlaces = searchPlaces(q, userLocation, 10000, TALLINN_MAP_PLACES).slice(0, 6);

    return { streets: matchingStreets, places: matchingPlaces };
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
      {/* 1. TOP SEARCH BAR */}
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
          placeholder="Search Tallinn streets, hardware, shelters & POIs (e.g. 'riistapood', 'varjend')..."
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
        {onOpenNearbySheet && (
          <button
            type="button"
            onClick={onOpenNearbySheet}
            className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold font-mono shrink-0 cursor-pointer transition-colors"
          >
            Nearby
          </button>
        )}
      </div>

      {/* 2. AUTOCOMPLETE SEARCH RESULTS DROPDOWN */}
      {searchQuery && (
        <div
          className={`rounded-2xl border p-3 shadow-lg max-h-72 overflow-y-auto space-y-2 text-left ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/30 text-[#203A2A]'
          }`}
        >
          {searchResults.streets.length === 0 && searchResults.places.length === 0 && (
            <p className="text-xs text-zinc-500 p-2 text-center">No streets or places found for "{searchQuery}"</p>
          )}

          {searchResults.streets.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                Streets ({searchResults.streets.length})
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
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {st.exploredPercent || 0}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchResults.places.length > 0 && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                Places &amp; POIs ({searchResults.places.length})
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
        </div>
      )}

      {/* 3. SELECTED PLACE DETAIL CARD WITH PROVENANCE */}
      {selectedPlace && (
        <PlaceDetailCard
          place={selectedPlace}
          userLocation={userLocation}
          isNightMode={isNightMode}
          onClose={() => setSelectedPlace(null)}
          onRouteHere={onRouteHere}
        />
      )}

      {/* 4. SELECTED STREET DETAIL CARD */}
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
                {selectedStreet.exploredPercent || 0}% explored
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 tracking-wider">
              {renderProgressBar(selectedStreet.exploredPercent || 0)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                if (onSelectStreet) onSelectStreet(selectedStreet);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#476a46] cursor-pointer text-center"
            >
              Explore Street
            </button>
            <button
              type="button"
              onClick={() => {
                const pt = { lat: selectedStreet.geometry.coordinates[0][1], lng: selectedStreet.geometry.coordinates[0][0] };
                if (onRouteHere) onRouteHere(pt, selectedStreet.name);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer text-center"
            >
              Walk There
            </button>
            <button
              type="button"
              onClick={() => {
                const pt = { lat: selectedStreet.geometry.coordinates[0][1], lng: selectedStreet.geometry.coordinates[0][0] };
                if (onRouteHere) onRouteHere(pt, `Route along ${selectedStreet.name}`);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer text-center"
            >
              Route Along
            </button>
          </div>
        </div>
      )}

      {/* 5. TODAY'S FIELD ROUTE / STREET HUNT */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isNightMode
            ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-emerald-50/70 border-emerald-200/80 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Today's Field Route
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
            Street Hunt
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-3">
          3 streets nearby remain unexplored. Discover them to map real field connections.
        </p>

        <div className="space-y-1.5 text-xs mb-3">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/60 dark:bg-black/20">
            <span className="font-medium">🟩 1. Koidu tänav</span>
            <span className="text-[10px] font-mono text-zinc-500">Uus Maailm</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/60 dark:bg-black/20">
            <span className="font-medium">🟨 2. Vana-Kalamaja</span>
            <span className="text-[10px] font-mono text-zinc-500">Kalamaja</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/60 dark:bg-black/20">
            <span className="font-medium">🟨 3. Tööstuse tänav</span>
            <span className="text-[10px] font-mono text-zinc-500">Noblessner</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span>🛠 hardware</span>
            <span>•</span>
            <span>♻ reuse</span>
            <span>•</span>
            <span>💧 water</span>
          </div>
          <button
            type="button"
            onClick={handleBuildWalk}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white shadow-xs cursor-pointer transition-colors"
          >
            Build a Walk Loop
          </button>
        </div>

        {/* Expanded Active Walk Route Loop */}
        {isFieldRouteOpen && activeWalkRoute && (
          <div className="mt-3 pt-3 border-t border-emerald-300/60 dark:border-emerald-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Planned Loop: {activeWalkRoute.totalDistanceKm} km (~{activeWalkRoute.estimatedTimeMinutes} min)</span>
              <button
                type="button"
                onClick={() => setIsFieldRouteOpen(false)}
                className="text-zinc-500 hover:text-zinc-700 text-[10px]"
              >
                Hide
              </button>
            </div>

            <div className="space-y-1 text-xs">
              {activeWalkRoute.stops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/80 dark:bg-black/40">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{stop.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{stop.actionInstruction}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-xs space-y-1">
              <span className="font-mono font-bold uppercase text-[10px] text-emerald-700 dark:text-emerald-300">
                FIELDCRAFT OBJECTIVES
              </span>
              <div className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                ✓ {activeWalkRoute.fieldcraftRewards.streetsToDiscover} streets to discover • ✓ {activeWalkRoute.fieldcraftRewards.placesToFind} places to find • ✓ {activeWalkRoute.fieldcraftRewards.distanceKm} km loop
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

