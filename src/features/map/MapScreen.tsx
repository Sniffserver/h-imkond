import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  MeshNode,
  ResourceItem,
  UserProfile,
  BatteryManagerStatus,
} from '../../types';
import { MapController } from './mapController';
import { MapEngineState } from './mapState';
import { MapQualityMode, MapRenderer } from './mapCapabilities';
import {
  Zap,
  BatteryCharging,
  Gauge,
  Activity,
  X,
  Info,
  Layers,
  Cpu,
  Eye,
  Sparkles,
  MapPin,
  Radio,
  Pin,
  Check,
  Loader2,
  HardDriveDownload,
} from 'lucide-react';
import { soundFeedback } from '../../services/utils/soundFeedback';
import { unifiedTileCache } from './UnifiedTileCache';
import { D3CommunityResourceMap } from './components/D3CommunityResourceMap';
import { D3MeshTopologyMap } from './components/D3MeshTopologyMap';
import { D3MeshSignalCoverageMap } from './components/D3MeshSignalCoverageMap';
import {
  LoRaBridgeRangeHUD,
  LoRaParameters,
  DEFAULT_LORA_CONFIG,
  estimateLoRaRangeKm,
} from './components/LoRaBridgeRangeHUD';

import { MapSkeleton } from './MapSkeleton';
import { LocationIndicator } from '../../components/LocationIndicator';
import { SmartZoomBadge } from './components/SmartZoomLayerController';
import { MapLayerControls, ActiveLayerStates } from './components/MapLayerControls';
import { MapGestures } from './components/MapGestures';
import { MapPerformanceOverlay } from '../../components/MapPerformanceOverlay';
import { PerformanceDashboard } from '../../components/PerformanceDashboard';
import { MapQualitySelector } from '../../components/MapQualitySelector';
import { MapQualityManager } from './qualityManager';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

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
  const [mapDisplayMode, setMapDisplayMode] = useState<'d3_resources' | 'mesh_topology' | 'coverage_placement' | 'vector'>('d3_resources');
  const [activeLayers, setActiveLayers] = useState<ActiveLayerStates>({
    peers: true,
    resources: true,
    heatmap: true,
    terrain: true,
  });
  const [vectorLoraConfig, setVectorLoraConfig] = useState<LoRaParameters>(DEFAULT_LORA_CONFIG);
  const vectorLoraKm = useMemo(() => estimateLoRaRangeKm(vectorLoraConfig), [vectorLoraConfig]);
  const vectorCoveredResources = useMemo(
    () => resources.filter((r) => (r.distanceKm || 0) <= vectorLoraKm).length,
    [resources, vectorLoraKm]
  );
  const vectorCoveredPeers = useMemo(
    () => peers.filter((p) => ((p as any).distanceKm || 1.2) <= vectorLoraKm).length,
    [peers, vectorLoraKm]
  );

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

      {/* Top Map Display Mode Switcher (D3 Community Resource Map vs Mesh Topology vs Bioregional Vector Map) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1 bg-white/95 dark:bg-[#141F12]/95 p-1 rounded-2xl border border-[#87A878]/40 dark:border-[#2A3B26] shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setMapDisplayMode('d3_resources');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            mapDisplayMode === 'd3_resources'
              ? 'bg-[#588157] text-white shadow-xs'
              : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
          <span>Resource Map</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono">
            {resources.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setMapDisplayMode('mesh_topology');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            mapDisplayMode === 'mesh_topology'
              ? 'bg-[#588157] text-white shadow-xs'
              : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#33ff00]" />
          <span>Mesh Topology</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono">
            {peers.length + 1}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setMapDisplayMode('coverage_placement');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            mapDisplayMode === 'coverage_placement'
              ? 'bg-[#588157] text-white shadow-xs'
              : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-[#2A9D8F] dark:text-[#33ff00]" />
          <span>Signal Coverage &amp; Placement</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setMapDisplayMode('vector');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            mapDisplayMode === 'vector'
              ? 'bg-[#588157] text-white shadow-xs'
              : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Vector Carto</span>
        </button>

        {/* Manual Trigger Button: Pin & Cache Current Viewport Locally */}
        <div className="h-4 w-px bg-current/20 mx-0.5 hidden md:block" />
        <button
          id="btn-pin-cache-viewport"
          type="button"
          onClick={handlePinAndCacheViewport}
          disabled={isPinningViewport}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            isPinningViewport
              ? 'bg-[#2A9D8F] text-white animate-pulse'
              : 'bg-[#FAF6EE] dark:bg-[#1C2C19] text-[#203A2A] dark:text-[#F0F5EE] hover:bg-[#EAE4D6] dark:hover:bg-[#253A22] border border-[#87A878]/40 dark:border-[#364E30]'
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
          <span className="hidden sm:inline">
            {isPinningViewport
              ? 'Caching...'
              : pinnedCount !== null
              ? 'Pinned'
              : 'Pin & Cache'}
          </span>
        </button>
      </div>

      {mapDisplayMode === 'd3_resources' ? (
        <div className="relative w-full h-full pt-14">
          <D3CommunityResourceMap
            resources={resources}
            peers={peers}
            user={user}
            onViewResourceDetails={onViewResourceDetails}
            onSelectPeer={onSelectPeer}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onOpenReputation={onOpenReputation}
            isNightMode={isNightMode}
            onAddToast={onAddToast}
          />
        </div>
      ) : mapDisplayMode === 'mesh_topology' ? (
        <div className="relative w-full h-full pt-14">
          <D3MeshTopologyMap
            peers={peers}
            user={user}
            onSelectPeer={onSelectPeer}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onOpenReputation={onOpenReputation}
            isNightMode={isNightMode}
            onAddToast={onAddToast}
          />
        </div>
      ) : mapDisplayMode === 'coverage_placement' ? (
        <div className="relative w-full h-full pt-14">
          <D3MeshSignalCoverageMap
            peers={peers}
            user={user}
            onSelectPeer={onSelectPeer}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onOpenReputation={onOpenReputation}
            isNightMode={isNightMode}
            onAddToast={onAddToast}
          />
        </div>
      ) : (
        <>
          {/* Real-time Floating Performance Overlay and Quality Bar */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
            <MapPerformanceOverlay
              isNightMode={isNightMode}
              onTogglePerformanceDetails={() => setShowMetricsPanel(!showMetricsPanel)}
            />

            {/* User-Visible Performance Mode: MapQualitySelector */}
            <MapQualitySelector
              isNightMode={isNightMode}
              onQualityChange={(mode) => {
                const mappedMode: MapQualityMode = mode === 'power-saver' ? 'power_saver' : mode;
                controller.setQualityMode(mappedMode);
                qualityManager.setQualityMode(mode, true);
              }}
            />
          </div>

          {/* Metrics Inspector Panel / Real-Time Performance Dashboard */}
          {showMetricsPanel && (
            <div
              role="region"
              aria-label="Map Engine Performance Metrics"
              className="absolute top-14 right-3 z-30 max-w-lg w-[calc(100vw-24px)] pointer-events-auto"
            >
              <PerformanceDashboard
                isOpen={showMetricsPanel}
                onClose={() => setShowMetricsPanel(false)}
                isNightMode={isNightMode}
                isDevMode={true}
              />
            </div>
          )}

          {/* Floating Smart Zoom Badge (Top Left) */}
          <div className="absolute top-3 left-3 z-20 pointer-events-auto">
            <SmartZoomBadge
              zoomLevel={currentZoom}
              qualityMode={engineState.qualityMode}
              isNightMode={isNightMode}
            />
          </div>

          {/* Floating LoRa Bridge Range Overlay HUD in Vector Mode */}
          <div className="absolute top-16 left-3 z-20 max-w-xs pointer-events-auto">
            <LoRaBridgeRangeHUD
              config={vectorLoraConfig}
              onChangeConfig={setVectorLoraConfig}
              isNightMode={isNightMode}
              coveredResourcesCount={vectorCoveredResources}
              coveredPeersCount={vectorCoveredPeers}
            />
          </div>

          {/* Main Map View Canvas with Gesture Handling & Edge Gradient for Infinite Feel */}
          <div className="relative w-full h-full overflow-hidden transition-all duration-300 ease-out">
            {/* Gradient overlay at map edges for infinite feel */}
            <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_40px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" />

            <MapGestures
              centerCoordinate={{ lat: (user as any).location?.lat || 59.437, lng: (user as any).location?.lng || 24.7535 }}
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
                  activeLayers={activeLayers}
                  onToggleLayer={handleToggleLayer}
                  onZoomChange={setCurrentZoom}
                />
              </Suspense>
            </MapGestures>
          </div>

          {/* Floating One-Tap Layer Controls (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-20 pointer-events-auto max-w-[calc(100%-80px)] overflow-x-auto">
            <MapLayerControls
              layers={activeLayers}
              onToggleLayer={handleToggleLayer}
              counts={{ peers: peers.length, resources: resources.length }}
              isNightMode={isNightMode}
            />
          </div>

          {/* "You Are Here" with Confidence Location Indicator (Bottom Right) */}
          <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
            <LocationIndicator
              accuracy={14}
              isHighAccuracy={true}
              lastUpdated={new Date()}
              latitude={(user as any).location?.lat || 59.437}
              longitude={(user as any).location?.lng || 24.7535}
              onRecenter={() => {
                if (onAddToast) {
                  onAddToast(
                    'Centered on GPS Fix',
                    'Map viewpoint centered on your live coordinates',
                    'info'
                  );
                }
              }}
              onShareLocation={() => {
                if (onAddToast) {
                  onAddToast(
                    'Location Shared',
                    'Your current GPS location with ±14m accuracy was broadcasted to trusted mesh contacts.',
                    'info'
                  );
                }
              }}
              isNightMode={isNightMode}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default MapScreen;
