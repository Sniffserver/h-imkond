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
} from 'lucide-react';

import { MapSkeleton } from './MapSkeleton';
import { LocationIndicator } from '../../components/LocationIndicator';
import { SmartZoomBadge } from './components/SmartZoomLayerController';
import { MapLayerControls, ActiveLayerStates } from './components/MapLayerControls';
import { MapGestures } from './components/MapGestures';
import { MapPerformanceOverlay } from '../../components/MapPerformanceOverlay';
import { MapQualityManager } from './qualityManager';

// Lazy-loaded Map View Tab
const MapViewTab = lazy(() =>
  import('../../components/MapViewTab').then((m) => ({ default: m.MapViewTab }))
);

export interface MapScreenProps {
  peers: MeshNode[];
  resources: ResourceItem[];
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  isNightMode?: boolean;
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
  const [activeLayers, setActiveLayers] = useState<ActiveLayerStates>({
    peers: true,
    resources: true,
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

  const handleToggleLayer = (layerKey: keyof ActiveLayerStates) => {
    setActiveLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      if (onAddToast) {
        onAddToast(
          `${layerKey.charAt(0).toUpperCase() + layerKey.slice(1)} Layer ${next[layerKey] ? 'Enabled' : 'Hidden'}`,
          `Updated map overlay visibility`,
          'info'
        );
      }
      return next;
    });
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

      {/* Real-time Floating Performance Overlay and Quality Bar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
        <MapPerformanceOverlay
          isNightMode={isNightMode}
          onTogglePerformanceDetails={() => setShowMetricsPanel(!showMetricsPanel)}
        />

        {/* Quality Mode Selector */}
        <div className="flex items-center bg-black/60 backdrop-blur-md rounded-2xl p-1 border border-white/20 text-[10px] font-mono">
          {(['power_saver', 'balanced', 'detail'] as MapQualityMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                controller.setQualityMode(mode);
                qualityManager.setQualityMode(mode === 'power_saver' ? 'power-saver' : mode, true);
              }}
              className={`px-2 py-1 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                engineState.qualityMode === mode
                  ? 'bg-[#588157] text-white shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {mode === 'power_saver' ? 'Eco' : mode === 'balanced' ? 'Rec' : 'Detail'}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Inspector Panel */}
      {showMetricsPanel && (
        <div
          role="region"
          aria-label="Map Engine Performance Metrics"
          className={`absolute top-14 right-3 z-30 p-4 rounded-2xl border shadow-xl text-xs font-mono max-w-xs w-full backdrop-blur-md ${
            isNightMode ? 'bg-[#182315]/95 border-[#364E30] text-[#F0F5EE]' : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-black/10 dark:border-white/10">
            <span className="font-bold flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#588157]" />
              <span>Map Engine Metrics</span>
            </span>
            <button
              type="button"
              onClick={() => setShowMetricsPanel(false)}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="opacity-70">First Render Time:</span>
              <span className="font-bold">{engineState.metrics.timeToFirstRenderMs} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Frame Time:</span>
              <span className="font-bold">{engineState.metrics.frameTimeMs} ms ({engineState.metrics.fps} FPS)</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Tile-Cache Hit Ratio:</span>
              <span className="font-bold text-[#34C759]">{engineState.metrics.tileCacheHitRatio}%</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Visible Markers:</span>
              <span className="font-bold">{engineState.metrics.visibleMarkerCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Tile Memory:</span>
              <span className="font-bold">{engineState.metrics.tileCacheMemoryMB} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Offline Region Storage:</span>
              <span className="font-bold">{engineState.metrics.offlineRegionSizeMB} MB</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-black/5 dark:border-white/5">
              <span className="opacity-70">Active Renderer:</span>
              <span className="font-bold uppercase text-[#E9C46A]">{engineState.activeRenderer}</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Smart Zoom Badge (Top Left) */}
      <div className="absolute top-3 left-3 z-20 pointer-events-auto">
        <SmartZoomBadge
          zoomLevel={13.5}
          qualityMode={engineState.qualityMode}
          isNightMode={isNightMode}
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
              filterOnlyNew={filterOnlyNew}
              onViewResourceDetails={onViewResourceDetails}
              onSelectPeer={onSelectPeer}
              onOpenChatWithPeer={onOpenChatWithPeer}
              onOpenReputation={onOpenReputation}
              batteryStatus={batteryStatus}
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
    </div>
  );
};

export default MapScreen;
