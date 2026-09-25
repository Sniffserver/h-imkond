import React, { useState, useEffect } from 'react';
import { Wifi, Radio, MapPin, Map as MapIcon, Battery, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { meshMetricsService, MeshMetrics } from '../services/mesh/meshMetricsService';

export interface SystemStatusStripProps {
  gpsAccuracyMeters?: number;
  batteryPercent?: number;
  mapVersion?: string;
  mapPackOutdated?: boolean;
  loraActive?: boolean;
  isOnline?: boolean;
  onWarningClick?: () => void;
}

export const SystemStatusStrip: React.FC<SystemStatusStripProps> = ({
  gpsAccuracyMeters = 7,
  batteryPercent = 82,
  mapVersion = '2026.09',
  mapPackOutdated = false,
  loraActive = true,
  isOnline = true,
  onWarningClick,
}) => {
  const [metrics, setMetrics] = useState<MeshMetrics>(() => meshMetricsService.getMetrics());

  useEffect(() => {
    return meshMetricsService.subscribe((m) => {
      setMetrics(m);
    });
  }, []);

  return (
    <div className="w-full bg-[#121A13] border-b border-[#243326] text-xs font-mono text-[#DCE6DA] px-3 py-1.5 flex flex-col gap-1 select-none shadow-sm">
      {/* Primary Status Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Live Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-bold tracking-wider text-emerald-400">
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* GPS Accuracy */}
        <div className="flex items-center gap-1 shrink-0 text-[#A8B8A6]">
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          <span>GPS ±{gpsAccuracyMeters}m</span>
        </div>

        {/* LoRa Radio Status */}
        <div className="flex items-center gap-1 shrink-0 text-[#A8B8A6]">
          <Radio className={`w-3.5 h-3.5 ${loraActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span>LORA</span>
          {loraActive ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <span className="text-zinc-500">OFF</span>
          )}
        </div>

        {/* Map Pack Release Version */}
        <div className="flex items-center gap-1 shrink-0 text-[#A8B8A6]">
          <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>MAP {mapVersion}</span>
        </div>

        {/* Battery Indicator */}
        <div className="flex items-center gap-1 shrink-0">
          <Battery className={`w-3.5 h-3.5 ${batteryPercent <= 20 ? 'text-amber-500' : 'text-emerald-400'}`} />
          <span className={batteryPercent <= 20 ? 'text-amber-400 font-bold' : 'text-[#DCE6DA]'}>
            BAT {batteryPercent}%
          </span>
        </div>
      </div>

      {/* Non-modal subtle warning banner (if any warning condition active) */}
      {mapPackOutdated && (
        <div
          onClick={onWarningClick}
          className="bg-amber-950/80 border border-amber-600/50 rounded px-2 py-0.5 text-[11px] text-amber-300 flex items-center justify-between cursor-pointer hover:bg-amber-900/80 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold tracking-wide">⚠ MAP PACK OUTDATED</span>
            <span className="text-amber-400/80 text-[10px] hidden sm:inline">
              — Uus Tallinna vektorbaas saadaval. Vajuta uuendamiseks.
            </span>
          </div>
          <span className="text-[10px] underline text-amber-200">Uuenda</span>
        </div>
      )}
    </div>
  );
};
