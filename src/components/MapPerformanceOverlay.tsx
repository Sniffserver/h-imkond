import React, { useState, useEffect } from 'react';
import { Settings, Activity, Gauge, Cpu, X, Database, Zap, Layers } from 'lucide-react';
import { MapEngine, MapMetrics } from '../features/map/mapEngine';

export interface MapPerformanceOverlayProps {
  mapEngine?: MapEngine;
  isNightMode?: boolean;
  onTogglePerformanceDetails?: () => void;
  className?: string;
}

export const MapPerformanceOverlay: React.FC<MapPerformanceOverlayProps> = ({
  mapEngine,
  isNightMode = false,
  onTogglePerformanceDetails,
  className = '',
}) => {
  const [metrics, setMetrics] = useState<MapMetrics>({
    fps: 60,
    frameTimeMs: 16.6,
    tileCacheHitRate: 0.94,
    tileCacheHitRatio: 0.94,
    visibleTileCount: 38,
    memoryUsageMB: 18.2,
    renderer: 'webgl',
    activeRenderer: 'webgl',
    qualityMode: 'balanced',
    totalObjectsRendered: 120,
  });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      if (mapEngine) {
        setMetrics(mapEngine.getMetrics());
      } else {
        // Fallback simulation for live dev preview
        const mem = (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
          : 16;
        setMetrics((prev) => ({
          ...prev,
          fps: Math.floor(56 + Math.random() * 5),
          memoryUsageMB: mem,
        }));
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [mapEngine]);

  const toggleDetails = () => {
    setShowDetails((prev) => !prev);
    if (onTogglePerformanceDetails) {
      onTogglePerformanceDetails();
    }
  };

  const isLowFps = metrics.fps < 30;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Real-time Compact Floating Pill Bar */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`Map Performance: ${metrics.fps} frames per second, Cache hit ${(metrics.tileCacheHitRate * 100).toFixed(0)}%, ${metrics.visibleTileCount} tiles`}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl text-[11px] font-mono border backdrop-blur-md shadow-lg transition-colors ${
          isNightMode
            ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-[#FAF6EE]/90 border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        {/* FPS Indicator */}
        <div className="flex items-center gap-1">
          <Activity className={`w-3.5 h-3.5 ${isLowFps ? 'text-[#E76F51] animate-pulse' : 'text-[#34C759]'}`} />
          <span className="opacity-60 text-[10px]">FPS:</span>
          <span
            className={`font-bold transition-colors ${
              isLowFps ? 'text-[#E76F51] font-extrabold' : 'text-[#2A9D8F]'
            }`}
          >
            {metrics.fps}
          </span>
        </div>

        <span className="opacity-30">|</span>

        {/* Tile Cache Hit Rate */}
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3 text-[#588157]" />
          <span className="opacity-60 text-[10px]">Cache:</span>
          <span className="font-bold">
            {(metrics.tileCacheHitRate * 100).toFixed(0)}%
          </span>
        </div>

        <span className="opacity-30">|</span>

        {/* Visible Tiles */}
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#E9C46A]" />
          <span className="opacity-60 text-[10px]">Tiles:</span>
          <span className="font-bold">{metrics.visibleTileCount}</span>
        </div>

        <span className="opacity-30">|</span>

        {/* Memory Usage */}
        <div className="hidden sm:flex items-center gap-1">
          <Cpu className="w-3 h-3 text-[#2A9D8F]" />
          <span className="opacity-60 text-[10px]">Mem:</span>
          <span className="font-bold">{metrics.memoryUsageMB}MB</span>
        </div>

        {/* Settings / Inspector Toggle Button */}
        <button
          type="button"
          onClick={toggleDetails}
          aria-label="Map performance diagnostics and inspector"
          aria-expanded={showDetails}
          className="p-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-transform active:scale-95"
        >
          <Settings className="w-3.5 h-3.5 text-[#588157] dark:text-[#A8BDA5]" />
        </button>
      </div>

      {/* Expanded Performance Inspector Panel */}
      {showDetails && (
        <div
          role="region"
          aria-label="Map Engine Diagnostic Details"
          className={`absolute top-full mt-2 right-0 z-50 w-72 p-4 rounded-2xl border shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 ${
            isNightMode
              ? 'bg-[#182315]/95 border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Gauge className="w-4 h-4 text-[#588157]" />
              <span>Map Performance Diagnostics</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="p-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close diagnostics panel"
            >
              <X className="w-3.5 h-3.5 text-[#588157]" />
            </button>
          </div>

          <div className="space-y-2 text-[11px] font-mono">
            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">Framerate:</span>
              <span className={`font-bold ${isLowFps ? 'text-[#E76F51]' : 'text-[#34C759]'}`}>
                {metrics.fps} FPS ({metrics.frameTimeMs.toFixed(1)} ms)
              </span>
            </div>

            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">Tile Cache Hit Ratio:</span>
              <span className="font-bold text-[#2A9D8F]">
                {(metrics.tileCacheHitRate * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">Visible Tiles on Screen:</span>
              <span className="font-bold">{metrics.visibleTileCount}</span>
            </div>

            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">JS Heap Memory:</span>
              <span className="font-bold">{metrics.memoryUsageMB} MB</span>
            </div>

            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">Renderer Pipeline:</span>
              <span className="font-bold uppercase text-[#E9C46A]">
                {metrics.renderer || metrics.activeRenderer}
              </span>
            </div>

            <div className="flex justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="opacity-70">Adaptive Quality Mode:</span>
              <span className="font-bold capitalize text-[#588157] dark:text-[#A8BDA5]">
                {metrics.qualityMode}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MapPerformanceOverlay;
