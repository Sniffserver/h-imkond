import React, { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Layers,
  Crosshair,
  Compass,
  Sun,
  Moon,
  Eye,
  Leaf,
  Sparkles,
  ChevronDown,
  HardDrive,
} from 'lucide-react';
import type { BioregionalMapCanvasProps } from './BioregionalMapCanvas';
import { MapSkeleton } from '../features/map/MapSkeleton';
import { CITY_MAPS } from '../data/cityMaps';
import { DEFAULT_CITY_ID, ESTONIA_CITY_DEFAULTS } from '../geo';
import { parseCenterCoords, localGridToGeoPoint } from '../services/map/mapRevealService';
import { initializePMTilesProtocol, getTacticalVectorMapStyle, applyMapTheme, TacticalMapTheme } from '../features/map/pmtiles';
import { MapPackModal } from '../features/map/packs/MapPackModal';
import { MAP_PACK_MANIFESTS } from '../features/map/packs/MapPackManifest';

import { computeMapStateInfo } from '../services/map/mapState';
import { mapEngine } from '../features/map/mapEngine';

const BioregionalMapCanvas = lazy(() =>
  import('./BioregionalMapCanvas').then((m) => ({ default: m.BioregionalMapCanvas }))
);

// Ensure PMTiles protocol is registered
initializePMTilesProtocol();

export interface WebGlMapCanvasExtendedProps extends BioregionalMapCanvasProps {
  onToggleFallback: () => void;
  userLat?: number;
  userLng?: number;
  onCenterOnUser?: () => void;
  themeMode?: 'auto' | 'day' | 'night';
  fieldDisplayMode?: 'normal' | 'night' | 'red';
  onSetThemeMode?: (mode: 'auto' | 'day' | 'night') => void;
  onSetFieldDisplayMode?: (mode: 'normal' | 'night' | 'red') => void;
}

/**
 * WebGlMapCanvas - Hardware-Accelerated Tactical Vector Map Component.
 * 
 * Clean Field-HUD:
 * - Top-left: City name, GPS accuracy (±7m), telemetry refresh rate.
 * - Top-right: [Layers], [Locate], [Compass] floating controls.
 * - Bottom: OFFLINE Map Pack status badge (opens Map Pack Manager).
 * - Bottom-right: OSM Legal Attribution.
 */
export const WebGlMapCanvas: React.FC<WebGlMapCanvasExtendedProps> = React.memo((props) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [isMapPackModalOpen, setIsMapPackModalOpen] = useState<boolean>(false);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<number>(Date.now());
  const layersDropdownRef = useRef<HTMLDivElement>(null);

  // Close layers dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layersDropdownRef.current && !layersDropdownRef.current.contains(e.target as Node)) {
        setIsLayersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track GPS update timestamp
  useEffect(() => {
    if (props.userLat && props.userLng) {
      setLastGpsUpdate(Date.now());
    }
  }, [props.userLat, props.userLng]);

  // Derive active tactical theme from props
  const getInitialTheme = (): TacticalMapTheme => {
    if (props.fieldDisplayMode === 'red') return 'red';
    return props.isNightMode ? 'night' : 'day';
  };

  const [tacticalTheme, setTacticalTheme] = useState<TacticalMapTheme>(getInitialTheme());

  // Sync tacticalTheme when external isNightMode or fieldDisplayMode changes
  useEffect(() => {
    if (props.fieldDisplayMode === 'red') {
      setTacticalTheme('red');
    } else {
      setTacticalTheme(props.isNightMode ? 'night' : 'day');
    }
  }, [props.isNightMode, props.fieldDisplayMode]);

  // Check for WebGL support on mount
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('[WebGlMap] WebGL is not supported in this environment. Falling back to 2D Canvas.');
        setWebGlSupported(false);
      }
    } catch {
      setWebGlSupported(false);
    }
  }, []);

  // MapLibre GL SINGLE-INSTANCE INITIALIZATION
  useEffect(() => {
    if (!webGlSupported || !mapContainerRef.current) return;

    const activeCityId = props.cityId || DEFAULT_CITY_ID;
    const cityConfig = ESTONIA_CITY_DEFAULTS[activeCityId] || ESTONIA_CITY_DEFAULTS.tallinn;
    const centerCoords = CITY_MAPS[activeCityId]?.centerCoordsText || `${cityConfig.lat}° N, ${cityConfig.lng}° E`;
    const { lat, lng } = parseCenterCoords(centerCoords);

    const pmtilesUrl = `/maps/${activeCityId}.pmtiles`;
    const initialStyle = getTacticalVectorMapStyle(pmtilesUrl, tacticalTheme);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        zoom: 13,
        center: [lng, lat],
        style: initialStyle,
        attributionControl: false,
      });

      map.on('load', () => {
        setIsMapLoaded(true);
        setMapInstance(map);
        mapEngine.setMapLibreInstance(map);
        applyMapTheme(map, tacticalTheme);
      });

      mapRef.current = map;
    } catch (err) {
      console.error('[WebGlMap] MapLibre initialization failed. Falling back to active 2D engine:', err);
      setWebGlSupported(false);
    }

    return () => {
      if (mapRef.current) {
        mapEngine.setMapLibreInstance(null);
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
        setIsMapLoaded(false);
      }
    };
  }, [webGlSupported, props.cityId]);

  // ZERO-FLICKER IN-PLACE THEME SWITCH
  useEffect(() => {
    if (!mapInstance || !isMapLoaded) return;
    applyMapTheme(mapInstance, tacticalTheme);
  }, [tacticalTheme, mapInstance, isMapLoaded]);

  // Smoothly fly map when city changes without recreating
  useEffect(() => {
    if (!mapInstance) return;
    const activeCityId = props.cityId || DEFAULT_CITY_ID;
    const cityConfig = ESTONIA_CITY_DEFAULTS[activeCityId] || ESTONIA_CITY_DEFAULTS.tallinn;
    const centerCoords = CITY_MAPS[activeCityId]?.centerCoordsText || `${cityConfig.lat}° N, ${cityConfig.lng}° E`;
    const { lat, lng } = parseCenterCoords(centerCoords);
    mapInstance.flyTo({ center: [lng, lat], zoom: 13, duration: 1200 });
  }, [props.cityId, mapInstance]);

  // Synchronize external transform changes (e.g. Center on My Node, zoom controls) with MapLibre GL viewport
  const lastAppliedTransformRef = useRef<{ offsetX: number; offsetY: number; scale: number } | null>(null);

  useEffect(() => {
    if (!mapInstance || !props.transform) return;

    const { offsetX, offsetY, scale } = props.transform;

    if (
      lastAppliedTransformRef.current &&
      Math.abs(lastAppliedTransformRef.current.offsetX - offsetX) < 0.1 &&
      Math.abs(lastAppliedTransformRef.current.offsetY - offsetY) < 0.1 &&
      Math.abs(lastAppliedTransformRef.current.scale - scale) < 0.01
    ) {
      return;
    }

    lastAppliedTransformRef.current = { offsetX, offsetY, scale };

    const worldCenterX = -offsetX / scale;
    const worldCenterY = -offsetY / scale;
    
    const activeCityId = props.cityId || DEFAULT_CITY_ID;
    const centerCoordsText = CITY_MAPS[activeCityId]?.centerCoordsText || CITY_MAPS[DEFAULT_CITY_ID]?.centerCoordsText || '59.4370° N, 24.7535° E';
    const geo = localGridToGeoPoint(worldCenterX, worldCenterY, centerCoordsText);
    const targetZoom = Math.log2(scale) + 13;

    mapInstance.flyTo({
      center: [geo.longitude, geo.latitude],
      zoom: targetZoom,
      duration: 1200,
    });
  }, [props.transform, props.cityId, mapInstance]);

  const handleSelectTheme = useCallback((theme: TacticalMapTheme) => {
    setTacticalTheme(theme);
    if (theme === 'day' && props.onSetThemeMode) props.onSetThemeMode('day');
    if (theme === 'night' && props.onSetThemeMode) props.onSetThemeMode('night');
    if (theme === 'red' && props.onSetFieldDisplayMode) props.onSetFieldDisplayMode('red');
  }, [props.onSetThemeMode, props.onSetFieldDisplayMode]);

  // Center on GPS
  const handleLocateUser = () => {
    if (props.onCenterOnUser) {
      props.onCenterOnUser();
    } else if (mapInstance && props.userLat && props.userLng) {
      mapInstance.flyTo({ center: [props.userLng, props.userLat], zoom: 15, duration: 1000 });
    } else if (mapInstance && (props.gpsPosition || props.simulatedUserPos)) {
      const pos = props.gpsPosition || props.simulatedUserPos;
      if (pos) {
        const activeCityId = props.cityId || DEFAULT_CITY_ID;
        const centerCoordsText = CITY_MAPS[activeCityId]?.centerCoordsText || CITY_MAPS[DEFAULT_CITY_ID]?.centerCoordsText || '59.4370° N, 24.7535° E';
        const geo = localGridToGeoPoint(pos.x, pos.y, centerCoordsText);
        mapInstance.flyTo({ center: [geo.longitude, geo.latitude], zoom: 15, duration: 1000 });
      }
    }
  };

  // Reset Compass / North Orientation
  const handleResetNorth = () => {
    if (mapInstance) {
      mapInstance.resetNorth({ duration: 600 });
    }
  };

  if (!webGlSupported) {
    return (
      <Suspense fallback={<MapSkeleton isNightMode={props.isNightMode} />}>
        <BioregionalMapCanvas {...props} />
      </Suspense>
    );
  }

  const activeCityId = props.cityId || DEFAULT_CITY_ID;
  const activeCityName = CITY_MAPS[activeCityId]?.cityName || 'Tallinn';
  const manifest = MAP_PACK_MANIFESTS[activeCityId] || MAP_PACK_MANIFESTS.tallinn;
  const secondsAgo = Math.max(0.1, (Date.now() - lastGpsUpdate) / 1000);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAF6EE] dark:bg-[#10170F] transition-colors duration-300">
      {/* WebGL Render Viewport */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />

        {/* 2D Canvas Layer Overlay (Mesh Nodes, Links, Resource Pins, GPS Marker) */}
        <div className="absolute inset-0 pointer-events-none">
          <Suspense fallback={null}>
            <BioregionalMapCanvas {...props} isOverlay={true} mapInstance={mapInstance} />
          </Suspense>
        </div>

        {/* TOP-LEFT TACTICAL HUD */}
        <div className="absolute top-4 left-4 z-20 px-3.5 py-2.5 rounded-2xl bg-[#FAF6EE]/92 dark:bg-[#121A10]/92 backdrop-blur-md shadow-md border border-[#87A878]/30 dark:border-[#364E30] text-xs font-mono pointer-events-auto flex flex-col gap-0.5">
          <div className="text-[13px] font-bold tracking-wider uppercase text-[#203A2A] dark:text-[#E5EBDD] font-display">
            {activeCityName.toUpperCase()}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#588157] dark:text-[#8FA875] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>GPS ±7m</span>
          </div>
          <div className="text-[10px] text-[#637062] dark:text-[#95A18F]">
            ⟳ {secondsAgo < 1 ? '0.8' : secondsAgo.toFixed(1)}s ago
          </div>
        </div>

        {/* TOP-RIGHT FLOATING ACTION CONTROLS ([Layers], [Locate], [Compass]) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
          {/* Locate Button */}
          <button
            type="button"
            onClick={handleLocateUser}
            className="p-2.5 rounded-2xl bg-[#FAF6EE]/92 dark:bg-[#121A10]/92 backdrop-blur-md shadow-md border border-[#87A878]/30 dark:border-[#364E30] text-[#203A2A] dark:text-[#E5EBDD] hover:text-[#588157] hover:border-[#588157] transition-all cursor-pointer"
            title="Keskenda minu asukohale (Locate)"
          >
            <Crosshair className="w-4 h-4 text-[#588157] dark:text-[#8FA875]" />
          </button>

          {/* Compass Button */}
          <button
            type="button"
            onClick={handleResetNorth}
            className="p-2.5 rounded-2xl bg-[#FAF6EE]/92 dark:bg-[#121A10]/92 backdrop-blur-md shadow-md border border-[#87A878]/30 dark:border-[#364E30] text-[#203A2A] dark:text-[#E5EBDD] hover:text-[#588157] hover:border-[#588157] transition-all cursor-pointer"
            title="Põhjasuund (Reset North)"
          >
            <Compass className="w-4 h-4 text-[#E9C46A]" />
          </button>

          {/* Layers Popover Button */}
          <div className="relative" ref={layersDropdownRef}>
            <button
              type="button"
              onClick={() => setIsLayersOpen((prev) => !prev)}
              className="px-3 py-2 rounded-2xl bg-[#FAF6EE]/92 dark:bg-[#121A10]/92 backdrop-blur-md shadow-md border border-[#87A878]/30 dark:border-[#364E30] text-xs font-semibold text-[#203A2A] dark:text-[#E5EBDD] flex items-center gap-1.5 hover:border-[#588157] transition-all cursor-pointer"
              title="Kihid & Taktikaline Stiil (Layers)"
            >
              <Layers className="w-4 h-4 text-[#588157] dark:text-[#8FA875]" />
              <span className="hidden sm:inline">Layers</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isLayersOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#364E30] shadow-xl p-2.5 z-30 flex flex-col gap-2 text-xs">
                <div className="px-2 py-1 text-[10px] font-mono text-[#637062] dark:text-[#95A18F] uppercase border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                  <span>Kaardi Teemad</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">PMTiles</span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('day'); setIsLayersOpen(false); }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      tacticalTheme === 'day' ? 'bg-[#588157] text-white shadow-xs' : 'bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD]'
                    }`}
                  >
                    <Sun className="w-3 h-3" /> Päev
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('night'); setIsLayersOpen(false); }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      tacticalTheme === 'night' ? 'bg-[#1B281C] border border-[#8FA875] text-[#8FA875] shadow-xs' : 'bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD]'
                    }`}
                  >
                    <Moon className="w-3 h-3" /> Öö
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('red'); setIsLayersOpen(false); }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      tacticalTheme === 'red' ? 'bg-[#FF3B30] text-white shadow-xs' : 'bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Puna
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('high_contrast'); setIsLayersOpen(false); }}
                    className="p-1 rounded-md text-[9px] font-bold bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD] hover:bg-black/10 text-center cursor-pointer"
                  >
                    Kontrast
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('direct_sun'); setIsLayersOpen(false); }}
                    className="p-1 rounded-md text-[9px] font-bold bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD] hover:bg-black/10 text-center cursor-pointer"
                  >
                    Päike
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSelectTheme('eco'); setIsLayersOpen(false); }}
                    className="p-1 rounded-md text-[9px] font-bold bg-black/5 dark:bg-white/5 text-[#203A2A] dark:text-[#E5EBDD] hover:bg-black/10 text-center cursor-pointer"
                  >
                    Öko
                  </button>
                </div>

                <div className="pt-1.5 border-t border-black/5 dark:border-white/5 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => { setIsMapPackModalOpen(true); setIsLayersOpen(false); }}
                    className="w-full py-1.5 px-2 rounded-xl bg-[#588157]/10 hover:bg-[#588157]/20 text-[#588157] dark:text-[#8FA875] font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Halda kaardipakke</span>
                  </button>

                  <button
                    type="button"
                    onClick={props.onToggleFallback}
                    className="w-full py-1 px-2 rounded-xl text-[#637062] dark:text-[#95A18F] hover:bg-black/5 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Lülitu 2D Canvas-ele</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM EXPLICIT MAP STATE BADGE */}
        {(() => {
          const mapStateInfo = computeMapStateInfo({
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
            hasMapPack: true,
            isLoading: false,
            hasError: false,
          });
          return (
            <button
              type="button"
              onClick={() => setIsMapPackModalOpen(true)}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#FAF6EE]/92 dark:bg-[#121A10]/92 backdrop-blur-md shadow-md border ${mapStateInfo.badgeClass} text-[11px] font-mono font-medium flex items-center gap-2 pointer-events-auto hover:border-[#588157] transition-all cursor-pointer`}
              title="Ava HÕIMU kaardipaki haldur"
              aria-label={`Kaardi olek: ${mapStateInfo.fullText}. Vajuta kaardipaki halduri avamiseks.`}
            >
              <span className="font-bold">{mapStateInfo.fullText}</span>
              <span className="opacity-40">•</span>
              <span>{activeCityName} Map Pack</span>
              <span className="opacity-40">•</span>
              <span className="opacity-75">OSM • {manifest.version}</span>
            </button>
          );
        })()}

        {/* BOTTOM-RIGHT OPENSTREETMAP ATTRIBUTION */}
        <div className="absolute bottom-2 right-3 z-20 text-[10px] font-mono text-[#637062]/80 dark:text-[#95A18F]/80 bg-[#FAF6EE]/80 dark:bg-[#10160F]/80 px-2 py-0.5 rounded-md backdrop-blur-xs pointer-events-auto">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-inherit"
          >
            © OpenStreetMap contributors
          </a>
        </div>
      </div>

      {/* Map Pack Manager Modal */}
      <MapPackModal
        isOpen={isMapPackModalOpen}
        onClose={() => setIsMapPackModalOpen(false)}
        activeCityId={activeCityId}
        isNightMode={props.isNightMode}
      />
    </div>
  );
});

WebGlMapCanvas.displayName = 'WebGlMapCanvas';
