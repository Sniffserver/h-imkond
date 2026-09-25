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

// Lazy-loaded Map View Tab with automatic retry for resilience
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
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);

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

  const [locationState, setLocationState] = useState<LocationState>({
    status: 'unavailable',
  });

  // Real Device GPS Watcher & Street Discovery Guard
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationState({ status: 'unavailable' });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
        };

        setLocationState({
          status: 'live',
          position: { lat: fix.lat, lng: fix.lng },
          accuracyMeters: fix.accuracyMeters,
          timestamp: fix.timestamp,
        });

        // Strict GPS validation guardrail: only discover if accuracy is <= 35m
        if (fix.accuracyMeters <= 35) {
          const discovered = streetDiscoveryService.processGPSFix({
            lat: fix.lat,
            lng: fix.lng,
            accuracyMeters: fix.accuracyMeters,
            timestamp: fix.timestamp,
          });
          if (discovered.length > 0 && onAddToast) {
            onAddToast(
              '🌟 New Street Discovered!',
              `Logged exploration segment on ${discovered[0].streetId.replace('_', ' ')}`,
              'success'
            );
          }
        }
      },
      (err) => {
        console.warn('GPS Fix unavailable:', err.message);
        setLocationState({ status: 'unavailable' });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onAddToast]);

  const userLocation: GeoPoint = useMemo(() => {
    if (locationState.status === 'live' || locationState.status === 'stale') {
      return locationState.position;
    }
    return { lat: 59.4370, lng: 24.7535 }; // Default Tallinn center view when GPS unavailable
  }, [locationState]);

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
            }}
            className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#141F12]/90 hover:bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 hover:bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium truncate">Search Tallinn streets, hardware, shelters &amp; finds...</span>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Explore
            </span>
          </button>

          {/* Dedicated Nearby Discovery Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsNearbyOpen(!isNearbyOpen);
              if (isStreetExplorerOpen) setIsStreetExplorerOpen(false);
            }}
            className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              isNearbyOpen
                ? 'bg-[#588157] text-white border-[#476a46]'
                : isNightMode
                ? 'bg-[#141F12]/90 text-[#F0F5EE] border-[#2A3B26] hover:bg-[#182315]'
                : 'bg-white/95 text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Nearby</span>
          </button>

          {/* Manual Pin & Cache Viewport Locally */}
          <button
            id="btn-pin-cache-viewport"
            type="button"
            onClick={handlePinAndCacheViewport}
            disabled={isPinningViewport}
            className={`p-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              isPinningViewport
                ? 'bg-[#2A9D8F] text-white animate-pulse'
                : isNightMode
                ? 'bg-[#141F12]/90 text-[#F0F5EE] border-[#2A3B26] hover:bg-[#182315]'
                : 'bg-white/95 text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
            title="Pin and Cache Current Viewport Locally (Ensures map tiles are available offline without mesh gateway)"
            aria-label="Pin and Cache Current Viewport Locally"
          >
            {isPinningViewport ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : pinnedCount !== null ? (
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
            ) : (
              <Pin className="w-3.5 h-3.5 text-[#2A9D8F]" />
            )}
          </button>
        </div>

        {/* Dropped Down Street Explorer Sheet */}
        {isStreetExplorerOpen && (
          <div className="w-full max-w-2xl pointer-events-auto">
            <StreetExplorerSheet
              userLocation={userLocation}
              isNightMode={isNightMode}
              onSelectStreet={(st) => {
                if (onAddToast) onAddToast(`Exploring ${st.name}`, `${st.district} • ${st.exploredPercent}% discovered`, 'info');
                setIsStreetExplorerOpen(false);
              }}
              onSelectPlace={(pl) => {
                setSelectedPlace(pl);
                setIsStreetExplorerOpen(false);
              }}
              onSelectPoi={(poi) => {
                if (onAddToast) onAddToast(poi.name, `${poi.category.toUpperCase()} • ${poi.address || 'Tallinn'}`, 'info');
                setIsStreetExplorerOpen(false);
              }}
              onStartWalk={(route) => {
                if (onAddToast) onAddToast('Field Walk Activated', `${route.totalDistanceKm} km exploration loop planned`, 'success');
              }}
              onRouteHere={(point, title) => {
                if (onAddToast) onAddToast(`Routing to ${title}`, `${point.lat.toFixed(4)}°, ${point.lng.toFixed(4)}°`, 'info');
                setIsStreetExplorerOpen(false);
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

        {/* Floating Selected Place Detail Card */}
        {selectedPlace && (
          <div className="w-full max-w-lg pointer-events-auto">
            <PlaceDetailCard
              place={selectedPlace}
              userLocation={userLocation}
              isNightMode={isNightMode}
              onClose={() => setSelectedPlace(null)}
              onRouteHere={(point, title) => {
                if (onAddToast) onAddToast(`Routing to ${title}`, `${point.lat.toFixed(4)}°, ${point.lng.toFixed(4)}°`, 'info');
                setSelectedPlace(null);
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
            if (onAddToast) {
              onAddToast(
                'Routing Point Set',
                `Calculated off-grid bearing to ${coord.lat.toFixed(4)}°, ${coord.lng.toFixed(4)}°`,
                'info'
              );
            }
          }}
          isNightMode={isNightMode}
        >
          <Suspense fallback={<MapSkeleton isNightMode={isNightMode} />}>
            <MapViewTab
              peers={peers}
              resources={resources}
              user={user}
              onUpdateUser={onUpdateUser}
              onAddToast={onAddToast}
              isNightMode={isNightMode}
              themeMode={themeMode}
              fieldDisplayMode={fieldDisplayMode}
              onSetThemeMode={onSetThemeMode}
              onSetFieldDisplayMode={onSetFieldDisplayMode}
              filterOnlyNew={filterOnlyNew}
              onViewResourceDetails={onViewResourceDetails}
              onSelectPeer={onSelectPeer}
              onOpenChatWithPeer={onOpenChatWithPeer}
              onOpenReputation={onOpenReputation}
              batteryStatus={batteryStatus}
              activeLayers={activeLayers as any}
              onToggleLayer={handleToggleLayer as any}
              onZoomChange={setCurrentZoom}
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
