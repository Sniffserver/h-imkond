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

      {/* Floating Performance & Quality Bar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono p-1.5 rounded-2xl border border-white/20 shadow-md">
        <button
          type="button"
          onClick={() => setShowMetricsPanel(!showMetricsPanel)}
          className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-white/20 cursor-pointer transition-colors"
          title="Map Engine Performance & Diagnostics"
        >
          <Activity className="w-3 h-3 text-[#34C759]" />
          <span>{engineState.metrics.fps} FPS</span>
          <span className="opacity-60">|</span>
          <span className="uppercase">{engineState.activeRenderer}</span>
        </button>

        {/* Quality Mode Selector */}
        <div className="flex items-center bg-white/10 rounded-xl p-0.5">
          {(['power_saver', 'balanced', 'detail'] as MapQualityMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => controller.setQualityMode(mode)}
              className={`px-2 py-0.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                engineState.qualityMode === mode
                  ? 'bg-[#588157] text-white shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {mode === 'power_saver' ? 'Save' : mode === 'balanced' ? 'Rec' : 'Detail'}
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

      {/* Main Map View Canvas */}
      <Suspense
        fallback={
          <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center bg-[#FAF6EE] dark:bg-[#182315] text-[#588157] font-mono text-xs gap-3 p-6 rounded-3xl border border-[#87A878]/30">
            <Cpu className="w-8 h-8 animate-pulse text-[#588157]" />
            <span>Loading Map Engine & Vector Layers...</span>
          </div>
        }
      >
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
    </div>
  );
};

export default MapScreen;
