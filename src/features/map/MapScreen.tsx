import React, { useState, useEffect, useMemo, Suspense } from 'react';
import {
  MeshNode,
  ResourceItem,
  UserProfile,
  BatteryManagerStatus,
  GeoPoint,
  LocationState,
  MapPlace,
} from '../../types';
import { MapController } from './mapController';
import { MapEngineState } from './mapState';
import { MapQualityMode } from './mapCapabilities';
import { streetDiscoveryService } from './streets/streetDiscoveryService';
import {
  Zap,
  X,
  Search,
  Pin,
  Check,
  Loader2,
  Compass,
  EyeOff,
  Building2,
  Satellite,
  Target,
} from 'lucide-react';
import { soundFeedback } from '../../services/utils/soundFeedback';
import { unifiedTileCache } from './UnifiedTileCache';

import { MapSkeleton } from './MapSkeleton';
import { LocationIndicator } from '../../components/LocationIndicator';
import { MapLayerControls, ActiveLayerStates } from './components/MapLayerControls';
import { MapGestures } from './components/MapGestures';
import { MapQualityManager } from './qualityManager';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { StreetExplorerSheet } from './streets/StreetExplorerSheet';
import { NearbyPlacesSheet } from './places/NearbyPlacesSheet';
import { PlaceDetailCard } from './places/PlaceDetailCard';
import { mapRepository } from './data/repository';
import { UnknownNearbySheet } from './discovery/UnknownNearbySheet';
import { NeighborhoodIntelligenceSheet } from './discovery/NeighborhoodIntelligenceSheet';
import { FieldQuestSheet } from './discovery/FieldQuestSheet';
import { LocationProviderSelector } from './components/LocationProviderSelector';
import { useLocation } from '../../services/location/LocationContext';
import { transformDomainToMapViewModel } from './viewmodel/MapViewModel';
import { routingRepository } from '../../services/routing/routingRepository';
import { RouteResult } from '../../services/routing/routingEngine';
import { FieldWalkRoute } from './streets/streetWalkGenerator';
import { fieldQuestService } from './discovery/fieldQuestService';

import { ExploreMap } from './explore/ExploreMap';

// Lazy-loaded Legacy Map View Tab as deprecated fallback
const MapViewTab = lazyWithRetry(() =>
  import('./MapViewTab').then((m) => ({ default: m.MapViewTab }))
);

export interface MapScreenProps {
  peers: MeshNode[];
  resources: ResourceItem[];
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  isNightMode?: boolean;
  themeMode?: 'auto' | 'day' | 'night';
  fieldDisplayMode?: 'normal' | 'night' | 'red';
  onSetThemeMode?: (mode: 'auto' | 'day' | 'night') => void;
  onSetFieldDisplayMode?: (mode: 'normal' | 'night' | 'red') => void;
  filterOnlyNew?: boolean;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onSelectPeer: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode) => void;
  onOpenReputation: (peer: MeshNode) => void;
  batteryStatus?: BatteryManagerStatus;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  peers,
  resources,
  user,
  onUpdateUser,
  onAddToast,
  isNightMode = false,
  themeMode = 'auto',
  fieldDisplayMode = 'normal',
  onSetThemeMode,
  onSetFieldDisplayMode,
  filterOnlyNew = false,
  onViewResourceDetails,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  batteryStatus,
}) => {
  const controller = useMemo(
    () =>
      new MapController(
        batteryStatus ? batteryStatus.batteryLevelPercent / 100 : undefined,
        batteryStatus ? batteryStatus.batteryLevelPercent >= 95 || batteryStatus.isSolarAwareActive : undefined
      ),
    [batteryStatus]
  );

  const [engineState, setEngineState] = useState<MapEngineState>(controller.getState());
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(13.5);
  const [isStreetExplorerOpen, setIsStreetExplorerOpen] = useState(false);
  const [isNearbyOpen, setIsNearbyOpen] = useState(false);
  const [isUnknownNearbyOpen, setIsUnknownNearbyOpen] = useState(false);
  const [isNeighborhoodsOpen, setIsNeighborhoodsOpen] = useState(false);
  const [isFieldQuestsOpen, setIsFieldQuestsOpen] = useState(false);
  const [isLocationProviderOpen, setIsLocationProviderOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [routingDestinationName, setRoutingDestinationName] = useState<string>('');
  const [isSecondaryMenuOpen, setIsSecondaryMenuOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // Canonical Single Map Architecture: Overlays on top of MapLibre vector canvas
  const [activeLayers, setActiveLayers] = useState<ActiveLayerStates>({
    peers: true,
    resources: true,
    places: true,
    meshLinks: false,
    signalTrail: false,
    safety: true,
    heatmap: true,
    terrain: true,
  });

  const qualityManager = useMemo(() => new MapQualityManager(), []);

  const location = useLocation();

  const locationState: LocationState = useMemo(() => {
    if (!location.currentFix) {
      return { status: 'unavailable' };
    }
    return {
      status: location.status === 'live' || location.status === 'acquired' ? 'live' : 'unavailable',
      position: { lat: location.currentFix.lat, lng: location.currentFix.lng },
      accuracyMeters: location.currentFix.accuracyMeters,
      timestamp: location.currentFix.timestamp,
    };
  }, [location.currentFix, location.status]);

  const userLocation: GeoPoint = useMemo(() => {
    if (locationState.status === 'live' || locationState.status === 'stale') {
      return locationState.position;
    }
    return { lat: 59.4370, lng: 24.7535 }; // Default Tallinn center view when GPS unavailable
  }, [locationState]);

  // MapViewModel: Domain state -> MapViewModel -> ExploreMap
  const mapViewModel = useMemo(() => {
    return transformDomainToMapViewModel({
      peers,
      resources,
      userLocation: { lat: userLocation.lat, lng: userLocation.lng },
      signalTrail: [],
      places: mapRepository.getAllPlaces(),
      streets: mapRepository.getAllStreets(),
    });
  }, [peers, resources, userLocation]);

  // Feed GPS fixes directly into physical field quest engine (automatic completion for POIs & campfire)
  useEffect(() => {
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      fieldQuestService.processLocationUpdate(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  // Real authoritative A* / bearing routing execution: never fake toast-only completion
  const handleRouteToPoint = (point: GeoPoint, title: string) => {
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      if (onAddToast) onAddToast('Routing Error', 'Invalid coordinates for destination.', 'warning');
      return;
    }

    const latDiff = Math.abs(point.lat - userLocation.lat);
    const lngDiff = Math.abs(point.lng - userLocation.lng);
    if (latDiff < 0.0003 && lngDiff < 0.0003) {
      if (onAddToast) onAddToast('Already at Destination', `You are already at ${title}.`, 'info');
      return;
    }

    setRoutingDestinationName(title);
    setSelectedPlace(null);
    setIsStreetExplorerOpen(false);
    setIsNearbyOpen(false);
    setIsUnknownNearbyOpen(false);

    const route = routingRepository.planRoute(userLocation, point, { profile: 'walking' });
    if (route.quality === 'unavailable' || route.path.length === 0) {
      const direct = routingRepository.planDirectBearing(userLocation, point);
      const fallbackRoute: RouteResult = {
        path: direct.path,
        totalDistanceMeters: direct.totalDistanceMeters,
        estimatedMinutes: direct.estimatedMinutes,
        steps: [
          {
            instruction: `Walk towards ${title} (off-grid direct bearing)`,
            streetName: 'Direct azimuth',
            distanceMeters: direct.totalDistanceMeters,
          },
        ],
        profileUsed: 'walking',
        quality: 'estimated',
      };
      setActiveRoute(fallbackRoute);
      if (onAddToast) {
        onAddToast('Off-Grid Bearing Set', `Navigating to ${title} via direct bearing (${(direct.totalDistanceMeters / 1000).toFixed(1)} km)`, 'info');
      }
    } else {
      setActiveRoute(route);
      if (onAddToast) {
        onAddToast('Route Active', `Walking route to ${title} (${(route.totalDistanceMeters / 1000).toFixed(1)} km, ~${route.estimatedMinutes} min)`, 'success');
      }
    }
  };

  const handleStartFieldWalk = (walkRoute: FieldWalkRoute) => {
    setRoutingDestinationName('Field Walk Loop');
    setIsStreetExplorerOpen(false);
    const routePath = (walkRoute.routePath && walkRoute.routePath.length > 0)
      ? walkRoute.routePath
      : walkRoute.stops.map((s) => [s.location.lng, s.location.lat] as [number, number]);

    const activeWalk: RouteResult = {
      path: routePath,
      totalDistanceMeters: Math.round(walkRoute.totalDistanceKm * 1000),
      estimatedMinutes: walkRoute.estimatedTimeMinutes,
      steps: walkRoute.stops.map((s) => ({
        instruction: s.actionInstruction,
        streetName: s.name,
        distanceMeters: 300,
      })),
      profileUsed: 'walking',
      quality: 'graph',
    };
    setActiveRoute(activeWalk);
    if (onAddToast) {
      onAddToast('Field Walk Active', `${walkRoute.totalDistanceKm} km exploration loop active on map`, 'success');
    }
  };

  useEffect(() => {
    const unsubNotif = qualityManager.onNotification((notif) => {
      if (onAddToast) {
        onAddToast(notif.title, notif.message, 'warning');
      }
    });
    const unsubChange = qualityManager.onQualityChange(({ mode }) => {
      const mappedMode: MapQualityMode = mode === 'power-saver' ? 'power_saver' : mode;
      controller.setQualityMode(mappedMode);
    });
    return () => {
      unsubNotif();
      unsubChange();
      qualityManager.destroy();
    };
  }, [qualityManager, controller, onAddToast]);

  const [isPinningViewport, setIsPinningViewport] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number | null>(null);

  const handlePinAndCacheViewport = async () => {
    try {
      setIsPinningViewport(true);
      soundFeedback.playClick();

      const center = {
        lat: engineState.centerLat ?? 59.437,
        lng: engineState.centerLng ?? 24.7535,
      };
      const zoom = engineState.zoom || 13;

      const result = await unifiedTileCache.pinAndCacheCurrentViewport({
        center,
        zoom,
        peers,
        resources,
      });

      setPinnedCount(result.cachedTilesCount);
      soundFeedback.playSuccess();
      if (onAddToast) {
        onAddToast(
          'Viewport Pinned & Cached Locally',
          `Saved ${result.cachedTilesCount} tactical map tiles to offline storage. Available without mesh gateway.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to pin and cache viewport:', err);
      if (onAddToast) {
        onAddToast(
          'Cache Notice',
          'Failed to store viewport tiles offline.',
          'warning'
        );
      }
    } finally {
      setTimeout(() => {
        setIsPinningViewport(false);
      }, 750);
    }
  };

  const handleToggleLayer = (layerKey: keyof ActiveLayerStates) => {
    setActiveLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      return next;
    });
    if (onAddToast) {
      onAddToast(
        `${layerKey.charAt(0).toUpperCase() + layerKey.slice(1)} Layer Toggled`,
        `Updated map overlay visibility`,
        'info'
      );
    }
  };

  useEffect(() => {
    const unsubscribe = controller.subscribe((next) => {
      setEngineState({ ...next });
    });
    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    if (batteryStatus) {
      controller.autoCheckBatterySaver(
        batteryStatus.batteryLevelPercent / 100,
        batteryStatus.batteryLevelPercent >= 95 || batteryStatus.isSolarAwareActive
      );
    }
  }, [batteryStatus, controller]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Auto-Downgrade Battery Saver Notice Banner */}
      {engineState.autoDowngradedNotice && (
        <div
          role="status"
          className="bg-amber-500/90 text-white text-xs px-4 py-2 flex items-center justify-between gap-2 shadow-sm z-30 shrink-0 backdrop-blur-xs"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" />
            <span>Map switched to battery saver mode. You can restore detail in Map settings.</span>
          </div>
          <button
            type="button"
            onClick={() => controller.clearAutoDowngradeNotice()}
            className="p-1 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
            aria-label="Dismiss map power notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP UNIFIED EXPLORE & SEARCH HUD */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-6 z-30 pointer-events-none flex flex-col items-center gap-2">
        <div className="w-full max-w-2xl pointer-events-auto flex items-center gap-2">
          {/* Quick Search & Explore Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsStreetExplorerOpen(!isStreetExplorerOpen);
              if (isNearbyOpen) setIsNearbyOpen(false);
              if (isUnknownNearbyOpen) setIsUnknownNearbyOpen(false);
              if (isNeighborhoodsOpen) setIsNeighborhoodsOpen(false);
              if (isFieldQuestsOpen) setIsFieldQuestsOpen(false);
            }}
            className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#141F12]/90 hover:bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 hover:bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium truncate">Search Tallinn…</span>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Explore
            </span>
          </button>

          {/* Calming Secondary HUD controls under progressive disclosure button */}
          <button
            type="button"
            onClick={() => {
              setIsNearbyOpen(!isNearbyOpen);
              if (isStreetExplorerOpen) setIsStreetExplorerOpen(false);
              if (isUnknownNearbyOpen) setIsUnknownNearbyOpen(false);
              if (isNeighborhoodsOpen) setIsNeighborhoodsOpen(false);
              if (isFieldQuestsOpen) setIsFieldQuestsOpen(false);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              isNearbyOpen
                ? 'bg-[#588157] text-white border-[#476a46]'
                : isNightMode
                ? 'bg-[#141F12]/90 text-[#F0F5EE] border-[#2A3B26]'
                : 'bg-white/95 text-[#203A2A] border-[#87A878]/40'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-500" />
            <span>Around you</span>
          </button>

          {/* Collapsible advanced settings/cog menu */}
          <button
            type="button"
            onClick={() => setIsSecondaryMenuOpen(!isSecondaryMenuOpen)}
            className={`p-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              isSecondaryMenuOpen
                ? 'bg-[#588157] text-white border-[#476a46]'
                : isNightMode
                ? 'bg-[#141F12]/90 text-[#F0F5EE] border-[#2A3B26]'
                : 'bg-white/95 text-[#203A2A] border-[#87A878]/40'
            }`}
            title="Advanced Tools"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {/* Collapsible secondary controls menu (Sub-disclosure surface) */}
        {isSecondaryMenuOpen && (
          <div className="w-full max-w-2xl pointer-events-auto mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white/95 dark:bg-[#141F12]/90 border border-stone-200 dark:border-[#2A3B26] rounded-3xl shadow-xl backdrop-blur-md text-xs font-semibold">
            {/* Districts Button */}
            <button
              type="button"
              onClick={() => {
                setIsNeighborhoodsOpen(true);
                setIsSecondaryMenuOpen(false);
              }}
              className="p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 hover:bg-[#87A878]/10 cursor-pointer border-[#87A878]/20 dark:border-[#334231] text-[#203A2A] dark:text-[#E5EBDD]"
            >
              <Building2 className="w-4 h-4 text-sky-500" />
              <span>Districts</span>
            </button>

            {/* Field Quests Button */}
            <button
              type="button"
              onClick={() => {
                setIsFieldQuestsOpen(true);
                setIsSecondaryMenuOpen(false);
              }}
              className="p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 hover:bg-[#87A878]/10 cursor-pointer border-[#87A878]/20 dark:border-[#334231] text-[#203A2A] dark:text-[#E5EBDD]"
            >
              <Target className="w-4 h-4 text-emerald-500" />
              <span>Field Quests</span>
            </button>

            {/* Location Mode & Sensor Backend */}
            <button
              type="button"
              onClick={() => {
                setIsLocationProviderOpen(true);
                setIsSecondaryMenuOpen(false);
              }}
              className="p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 hover:bg-[#87A878]/10 cursor-pointer border-[#87A878]/20 dark:border-[#334231] text-[#203A2A] dark:text-[#E5EBDD]"
            >
              <Satellite className="w-4 h-4 text-amber-500" />
              <span>Sensor Backend</span>
            </button>

            {/* Cache Control */}
            <button
              type="button"
              onClick={handlePinAndCacheViewport}
              disabled={isPinningViewport}
              className="p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 hover:bg-[#87A878]/10 cursor-pointer border-[#87A878]/20 dark:border-[#334231] text-[#203A2A] dark:text-[#E5EBDD]"
            >
              {isPinningViewport ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              ) : (
                <Pin className="w-4 h-4 text-[#2A9D8F]" />
              )}
              <span>{isPinningViewport ? 'Caching...' : 'Cache Area'}</span>
            </button>
          </div>
        )}

      {/* Default Calm State Bottom-Left Card (Around you) */}
      {!selectedPlace && !isStreetExplorerOpen && !isNearbyOpen && !isUnknownNearbyOpen && !isNeighborhoodsOpen && !isFieldQuestsOpen && (
        <div className="absolute bottom-24 left-4 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setIsNearbyOpen(true);
            }}
            className={`p-4 rounded-3xl border shadow-lg text-left backdrop-blur-md transition-all cursor-pointer flex flex-col gap-1 ${
              isNightMode
                ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              ● Around you
            </span>
            <span className="text-sm font-bold">
              {mapRepository.getAllPlaces().length} useful places · 2 unseen
            </span>
          </button>
        </div>
      )}

        {/* Dropped Down Street Explorer Sheet */}
        {isStreetExplorerOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <StreetExplorerSheet
              userLocation={userLocation}
              isNightMode={isNightMode}
              onSelectStreet={(st) => {
                if (st.geometry?.coordinates?.[0]) {
                  const pt = { lat: st.geometry.coordinates[0][1], lng: st.geometry.coordinates[0][0] };
                  handleRouteToPoint(pt, st.name);
                } else if (onAddToast) {
                  onAddToast(`Exploring ${st.name}`, `${st.district} • ${st.exploredPercent}% discovered`, 'info');
                }
                setIsStreetExplorerOpen(false);
              }}
              onSelectPlace={(pl) => {
                setSelectedPlace(pl);
                setIsStreetExplorerOpen(false);
              }}
              onStartWalk={(route) => {
                handleStartFieldWalk(route);
              }}
              onRouteHere={(point, title) => {
                handleRouteToPoint(point, title);
              }}
              onOpenNearbySheet={() => {
                setIsStreetExplorerOpen(false);
                setIsNearbyOpen(true);
              }}
            />
          </div>
        )}

        {/* Dedicated Nearby Discovery Sheet */}
        {isNearbyOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <NearbyPlacesSheet
              userLocation={userLocation}
              isNightMode={isNightMode}
              onSelectPlace={(pl) => {
                setSelectedPlace(pl);
                setIsNearbyOpen(false);
              }}
              onClose={() => setIsNearbyOpen(false)}
            />
          </div>
        )}

        {/* Unknown Nearby ("What have I not seen?") Sheet */}
        {isUnknownNearbyOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <UnknownNearbySheet
              userLocation={userLocation}
              onClose={() => setIsUnknownNearbyOpen(false)}
              onSelectStreet={(st) => {
                if (st.geometry?.coordinates?.[0]) {
                  const pt = { lat: st.geometry.coordinates[0][1], lng: st.geometry.coordinates[0][0] };
                  handleRouteToPoint(pt, st.name);
                } else if (onAddToast) {
                  onAddToast(`Exploring ${st.name}`, `${st.district} • Unwalked segment`, 'info');
                }
                setIsUnknownNearbyOpen(false);
              }}
              onSelectPlace={(pl) => {
                setSelectedPlace(pl);
                setIsUnknownNearbyOpen(false);
              }}
            />
          </div>
        )}

        {/* Neighborhood Intelligence Sheet */}
        {isNeighborhoodsOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <NeighborhoodIntelligenceSheet
              onClose={() => setIsNeighborhoodsOpen(false)}
            />
          </div>
        )}

        {/* Field Quests Sheet */}
        {isFieldQuestsOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <FieldQuestSheet
              onClose={() => setIsFieldQuestsOpen(false)}
              onAddToast={onAddToast}
            />
          </div>
        )}

        {/* Location Provider Selector Modal */}
        {isLocationProviderOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <LocationProviderSelector
              onClose={() => setIsLocationProviderOpen(false)}
              onAddToast={onAddToast}
            />
          </div>
        )}

        {/* Floating Selected Place Detail Card */}
        {selectedPlace && (
          <div className="w-full max-w-lg pointer-events-auto">
            <PlaceDetailCard
              place={selectedPlace}
              userLocation={userLocation}
              isNightMode={isNightMode}
              onClose={() => setSelectedPlace(null)}
              onRouteHere={(point, title) => {
                handleRouteToPoint(point, title);
              }}
              onShareMesh={(pl) => {
                if (onAddToast) onAddToast('Place Broadcasted', `Shared ${pl.name} via local mesh outbox`, 'success');
              }}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Overlays Layer Controls */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <MapLayerControls
          layers={activeLayers}
          onToggleLayer={handleToggleLayer}
          counts={{
            peers: peers.length,
            resources: resources.length,
            places: mapRepository.getAllPlaces().length,
            safety: mapRepository.getAllPlaces().filter((p) => p.mainCategory === 'safety').length,
          }}
          isNightMode={isNightMode}
        />
      </div>

      {/* Main Single Map View Canvas with Gesture Handling & Edge Gradient for Infinite Feel */}
      <div className="relative w-full h-full overflow-hidden transition-all duration-300 ease-out">
        <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_40px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" />

        <MapGestures
          centerCoordinate={{ lat: userLocation.lat, lng: userLocation.lng }}
          onAddMarker={(coord) => {
            if (onAddToast) {
              onAddToast(
                'Marker Added',
                `Saved survival marker at ${coord.lat.toFixed(4)}°, ${coord.lng.toFixed(4)}°`,
                'success'
              );
            }
          }}
          onShareLocation={(coord) => {
            if (onAddToast) {
              onAddToast(
                'Location Broadcasted',
                `Shared fix ${coord.lat.toFixed(4)}°, ${coord.lng.toFixed(4)}° via mesh radio`,
                'info'
              );
            }
          }}
          onNavigateHere={(coord) => {
            handleRouteToPoint(coord, `Coord (${coord.lat.toFixed(4)}°, ${coord.lng.toFixed(4)}°)`);
          }}
          isNightMode={isNightMode}
        >
          <Suspense fallback={<MapSkeleton isNightMode={isNightMode} />}>
            <ExploreMap
              initialCenter={mapViewModel.initialCenter}
              initialZoom={currentZoom}
              peers={mapViewModel.peers}
              resources={mapViewModel.resources}
              meshLinks={mapViewModel.meshLinks}
              signalTrail={mapViewModel.signalTrail}
              places={mapViewModel.places}
              streets={mapViewModel.streets}
              activeRoute={activeRoute}
              onActiveRouteChange={setActiveRoute}
              routingDestinationName={routingDestinationName}
              onRoutingDestinationNameChange={setRoutingDestinationName}
              layers={{
                places: activeLayers.places ?? true,
                peers: activeLayers.peers ?? true,
                resources: activeLayers.resources ?? true,
                meshLinks: activeLayers.meshLinks ?? false,
                signalTrail: activeLayers.signalTrail ?? false,
                discovery: activeLayers.heatmap ?? true,
                safety: activeLayers.safety ?? true,
              }}
              onSelectPlace={(pl) => {
                setSelectedPlace(pl);
              }}
              className="w-full h-full"
            />
          </Suspense>
        </MapGestures>
      </div>

      {/* Floating "You Are Here" Location Indicator (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
        <LocationIndicator
          locationState={locationState}
          onRecenter={() => {
            if (onAddToast) {
              onAddToast(
                'Centered on Map View',
                'Map viewpoint centered',
                'info'
              );
            }
          }}
          onShareLocation={() => {
            if (onAddToast) {
              onAddToast(
                'Location Shared',
                `Location broadcasted via mesh radio.`,
                'info'
              );
            }
          }}
          isNightMode={isNightMode}
        />
      </div>
    </div>
  );
};

export default MapScreen;
