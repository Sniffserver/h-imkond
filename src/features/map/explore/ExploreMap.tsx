/**
 * ExploreMap: Unified MapLibre GL Tactical Map Engine
 * 
 * Architecture:
 * - Tiled Static Data: Vector Basemap (`basemap.pmtiles`), Clustered POI Tiles (`poi.pmtiles` / `places-source`)
 * - Dynamic Data: GeoJSON overlays for Peers (`people`), Resources, Mesh Links, Signal Trail, Street Discovery, and A* Routes
 * - Native POI Clustering: Zoom <= 14 cluster badges (⦿ 87), Zoom > 14 unclustered places with click expansion
 * - Polyline Geometry Distance: Segment-nearest projection for street explorer & hunt
 * - Graph Routing: Real A* pathfinding rendered as MapLibre GeoJSON polyline
 */

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useExploreMapState } from './ExploreMapState';
import { initializeMapSources } from './ExploreMapSources';
import { setupAllOverlayLayers, applyCategoryFilterToPlaces, updateUserLocationData } from './ExploreMapLayers';
import { bindExploreMapInteractions } from './ExploreMapSelection';
import { flyToPoint, fitToGeoJsonBounds, resetMapNorth } from './ExploreMapGestures';
import { searchExploreMap, SearchMatch } from './ExploreMapSearch';
import { updatePlacesLayerData } from './overlays/PlacesLayer';
import { updateDiscoveryLayerData } from './overlays/DiscoveryLayer';
import { updateRouteLayerData } from './overlays/RouteLayer';
import { applyMapTheme, getTacticalVectorMapStyle, TacticalMapTheme } from '../pmtiles';
import { mapRepository } from '../data/repository';
import { MapPlace, Street, GeoPoint } from '../../../types';
import { planOfflineRoute } from '../../../utils/offlineRouter';
import { RAW_TALLINN_STREETS } from '../streets/streetData';
import { generateFieldWalkRoute } from '../streets/streetWalkGenerator';

export interface ExploreMapProps {
  initialCenter?: GeoPoint;
  initialZoom?: number;
  onSelectPlace?: (place: MapPlace) => void;
  className?: string;
}

export const ExploreMap: React.FC<ExploreMapProps> = ({
  initialCenter = { lat: 59.4370, lng: 24.7535 },
  initialZoom = 13,
  onSelectPlace: externalOnSelectPlace,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);

  const {
    theme,
    setTheme,
    selectedPlace,
    setSelectedPlace,
    selectedStreet,
    setSelectedStreet,
    activeRoute,
    setActiveRoute,
    userLocation,
    filters,
    toggleFilter,
    setCategoryFilter,
    clearSelection,
  } = useExploreMapState();

  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);

  // Load initial dataset from repository
  useEffect(() => {
    const loadedPlaces = mapRepository.getAllPlaces();
    const loadedStreets = mapRepository.getAllStreets();
    setPlaces(loadedPlaces);
    setStreets(loadedStreets);
  }, []);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const styleSpec = getTacticalVectorMapStyle('/maps/tallinn.pmtiles', theme);
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleSpec,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: initialZoom,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        try {
          initializeMapSources(map, '/maps/tallinn.pmtiles');
          setupAllOverlayLayers(map, {
            userLocation,
            places: mapRepository.getAllPlaces(),
            streets: mapRepository.getAllStreets(),
          });
          bindExploreMapInteractions(map, mapRepository.getAllPlaces(), mapRepository.getAllStreets(), {
            onSelectPlace: (place) => {
              setSelectedPlace(place);
              if (externalOnSelectPlace) externalOnSelectPlace(place);
            },
            onSelectStreet: (street) => {
              setSelectedStreet(street);
            },
            onClearSelection: () => {
              clearSelection();
            },
          });
          setMapLoaded(true);
        } catch (e) {
          console.warn('[ExploreMap] Map overlay setup bypassed:', e);
        }
      });
    } catch (e) {
      console.warn('[ExploreMap] WebGL initialization bypassed (non-WebGL environment):', e);
      setMapLoaded(true);
    }

    return () => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      } catch {
        // Ignored
      }
    };
  }, []);

  // Update theme dynamically
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      applyMapTheme(mapInstanceRef.current, theme);
    }
  }, [theme, mapLoaded]);

  // Update POI category filter
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      applyCategoryFilterToPlaces(mapInstanceRef.current, filters.categoryFilter);
    }
  }, [filters.categoryFilter, mapLoaded]);

  // Update user location pin dynamically
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded && userLocation) {
      updateUserLocationData(mapInstanceRef.current, userLocation);
    }
  }, [userLocation, mapLoaded]);

  // Update active route line
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      updateRouteLayerData(mapInstanceRef.current, activeRoute);
      if (activeRoute && activeRoute.path.length >= 2) {
        fitToGeoJsonBounds(mapInstanceRef.current, activeRoute.path);
      }
    }
  }, [activeRoute, mapLoaded]);

  // Handle Search Input
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = searchExploreMap(searchQuery, userLocation, places, streets);
      setSearchResults(results.slice(0, 6));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, userLocation, places, streets]);

  // A* Routing Trigger to a Place
  const handleRouteToPlace = (place: MapPlace) => {
    const vectorStreets = RAW_TALLINN_STREETS.map((s) => ({
      name: s.name,
      type: (s.highwayClass === 'primary' ? 'primary' : s.highwayClass === 'footway' || s.highwayClass === 'pedestrian' || s.highwayClass === 'trail' ? 'trail' : 'secondary') as 'primary' | 'secondary' | 'trail',
      width: 2,
      points: s.coordinates as [number, number][],
    }));

    const offlineRoute = planOfflineRoute(
      vectorStreets,
      { x: userLocation.lng, y: userLocation.lat },
      { x: place.location.lng, y: place.location.lat },
      { profile: 'walking' }
    );

    setActiveRoute({
      path: offlineRoute.path,
      totalDistanceMeters: offlineRoute.totalDistanceMeters,
      estimatedMinutes: offlineRoute.estimatedWalkMinutes,
      steps: offlineRoute.steps.map((s) => ({
        instruction: s.instruction,
        streetName: s.streetName,
        distanceMeters: s.distanceMeters,
      })),
      profileUsed: offlineRoute.profileUsed || 'walking',
    });
  };

  // Generate Field Walk Street Hunt Loop over pedestrian routing graph
  const handleGenerateStreetHunt = () => {
    const walkRoute = generateFieldWalkRoute(userLocation);
    const routePath = (walkRoute.routePath && walkRoute.routePath.length > 0)
      ? walkRoute.routePath
      : walkRoute.stops.map((s) => [s.location.lng, s.location.lat] as [number, number]);

    setActiveRoute({
      path: routePath,
      totalDistanceMeters: Math.round(walkRoute.totalDistanceKm * 1000),
      estimatedMinutes: walkRoute.estimatedTimeMinutes,
      steps: walkRoute.stops.map((s) => ({
        instruction: s.actionInstruction,
        streetName: s.name,
        distanceMeters: 300,
      })),
      profileUsed: 'walking',
    });
  };

  return (
    <div className={`relative w-full h-full min-h-[500px] overflow-hidden flex flex-col font-sans ${className}`}>
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full bg-[#10170F]" />

      {/* Floating Top Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 max-w-lg mx-auto pointer-events-none">
        {/* Search Bar */}
        <div className="relative w-full pointer-events-auto bg-[#10170F]/90 backdrop-blur-md border border-[#8FA875]/30 rounded-2xl shadow-xl p-2 flex items-center gap-2">
          <span className="text-[#8FA875] text-lg pl-2">🔍</span>
          <input
            type="text"
            placeholder="Otsi tänavat, haiglat, varjumiskohta, apteeki..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#E5EBDD] placeholder-[#8FA875]/60 focus:outline-none font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-2 text-xs text-[#8FA875] hover:text-[#E5EBDD]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="w-full pointer-events-auto bg-[#10170F]/95 backdrop-blur-md border border-[#8FA875]/40 rounded-2xl shadow-2xl overflow-hidden divide-y divide-[#8FA875]/20 max-h-60 overflow-y-auto">
            {searchResults.map((m) => (
              <button
                key={`${m.type}_${m.id}`}
                onClick={() => {
                  setSearchQuery('');
                  if (mapInstanceRef.current) flyToPoint(mapInstanceRef.current, m.location, 16);
                  if (m.place) {
                    setSelectedPlace(m.place);
                    if (externalOnSelectPlace) externalOnSelectPlace(m.place);
                  } else if (m.street) {
                    setSelectedStreet(m.street);
                  }
                }}
                className="w-full p-3 text-left hover:bg-[#8FA875]/20 transition flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-[#E5EBDD]">{m.title}</div>
                  <div className="text-xs text-[#8FA875]">{m.subtitle}</div>
                </div>
                <div className="text-xs font-mono text-[#E9C46A]">{m.distanceMeters}m</div>
              </button>
            ))}
          </div>
        )}

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 pointer-events-auto no-scrollbar">
          {[
            { id: null, label: 'Kõik' },
            { id: 'safety', label: '🛡 Ohutus' },
            { id: 'water', label: '💧 Vesi' },
            { id: 'tools', label: '🛠 Tööriistad' },
            { id: 'stores', label: '🏪 Kauplused' },
            { id: 'energy', label: '⚡ Energia' },
          ].map((cat) => (
            <button
              key={cat.id || 'all'}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold whitespace-nowrap border transition ${
                filters.categoryFilter === cat.id
                  ? 'bg-[#8FA875] text-[#10170F] border-[#8FA875]'
                  : 'bg-[#10170F]/80 text-[#E5EBDD] border-[#8FA875]/30 hover:border-[#8FA875]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Right Control Palette */}
      <div className="absolute right-3 top-28 z-10 flex flex-col gap-2">
        {/* Recenter Location Button */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) flyToPoint(mapInstanceRef.current, userLocation, 15);
          }}
          title="Minu asukoht"
          className="w-10 h-10 rounded-xl bg-[#10170F]/90 backdrop-blur-md border border-[#8FA875]/40 text-[#E5EBDD] font-bold text-lg flex items-center justify-center shadow-lg hover:bg-[#8FA875]/20"
        >
          🎯
        </button>

        {/* Reset North Button */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) resetMapNorth(mapInstanceRef.current);
          }}
          title="Põhi üles"
          className="w-10 h-10 rounded-xl bg-[#10170F]/90 backdrop-blur-md border border-[#8FA875]/40 text-[#E5EBDD] font-mono font-bold text-xs flex items-center justify-center shadow-lg hover:bg-[#8FA875]/20"
        >
          N
        </button>

        {/* Generate Street Hunt Loop Button */}
        <button
          onClick={handleGenerateStreetHunt}
          title="Geno Tänavajahil silmus"
          className="w-10 h-10 rounded-xl bg-[#2A9D8F]/90 backdrop-blur-md border border-[#2A9D8F]/60 text-white font-bold text-lg flex items-center justify-center shadow-lg hover:scale-105 transition"
        >
          🗺
        </button>

        {/* Theme Palette Cycle Button */}
        <button
          onClick={() => {
            const themes: TacticalMapTheme[] = ['night', 'day', 'red', 'high_contrast', 'eco', 'crisis'];
            const nextIdx = (themes.indexOf(theme) + 1) % themes.length;
            setTheme(themes[nextIdx]);
          }}
          title={`Teema: ${theme.toUpperCase()}`}
          className="w-10 h-10 rounded-xl bg-[#10170F]/90 backdrop-blur-md border border-[#8FA875]/40 text-[#E9C46A] font-bold text-xs flex items-center justify-center shadow-lg hover:bg-[#8FA875]/20"
        >
          🎨
        </button>
      </div>

      {/* Active Route Instruction Bottom Sheet */}
      {activeRoute && (
        <div className="absolute bottom-4 left-3 right-3 z-20 max-w-lg mx-auto bg-[#10170F]/95 backdrop-blur-lg border border-[#E9C46A]/50 rounded-2xl shadow-2xl p-4 text-[#E5EBDD] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#8FA875]/20 pb-2">
            <div>
              <span className="text-xs font-mono font-bold text-[#E9C46A] uppercase tracking-wider">
                A* Jalgsi Navigatsioon
              </span>
              <h4 className="font-bold text-base text-white">
                {(activeRoute.totalDistanceMeters / 1000).toFixed(1)} km • ~{activeRoute.estimatedMinutes} min kõndi
              </h4>
            </div>
            <button
              onClick={() => setActiveRoute(null)}
              className="px-2.5 py-1 rounded-lg bg-[#E76F51]/20 border border-[#E76F51]/40 text-[#E76F51] text-xs font-mono font-bold hover:bg-[#E76F51]/30"
            >
              Lõpeta marsruut
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono pr-1 divide-y divide-[#8FA875]/10">
            {activeRoute.steps.map((step, idx) => (
              <div key={idx} className="pt-1.5 flex items-center justify-between">
                <span className="text-[#E5EBDD]">{step.instruction}</span>
                <span className="text-[#8FA875] whitespace-nowrap ml-2">{step.distanceMeters}m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Place Details Card */}
      {selectedPlace && !activeRoute && (
        <div className="absolute bottom-4 left-3 right-3 z-20 max-w-lg mx-auto bg-[#10170F]/95 backdrop-blur-lg border border-[#8FA875]/50 rounded-2xl shadow-2xl p-4 text-[#E5EBDD] flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#8FA875]/20 text-[#8FA875] border border-[#8FA875]/30">
                {selectedPlace.mainCategory.toUpperCase()} • {selectedPlace.sourceName}
              </span>
              <h3 className="font-bold text-lg text-white mt-1">{selectedPlace.name}</h3>
              {selectedPlace.address && <p className="text-xs text-[#8FA875]">{selectedPlace.address}</p>}
            </div>
            <button
              onClick={() => setSelectedPlace(null)}
              className="text-xs text-[#8FA875] hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          {selectedPlace.description && (
            <p className="text-xs text-[#E5EBDD]/80 leading-relaxed font-sans">{selectedPlace.description}</p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[#8FA875]/20 mt-1">
            <button
              onClick={() => handleRouteToPlace(selectedPlace)}
              className="flex-1 py-2 rounded-xl bg-[#8FA875] text-[#10170F] font-bold text-xs font-mono text-center hover:bg-[#8FA875]/90 shadow-md"
            >
              🚶 Marsruut Siia (A*)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
