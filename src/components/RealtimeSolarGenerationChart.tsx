import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { BatteryManagerStatus } from '../types';
import {
  Sun,
  Zap,
  Activity,
  BatteryCharging,
  TrendingUp,
  Sliders,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  Power,
  Flame,
  Gauge,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface SolarTelemetryPoint {
  timeLabel: string;
  timestamp: number;
  solarWatts: number;
  solarVoltage: number;
  consumptionWatts: number;
  netPowerWatts: number;
  batteryPercent: number;
  radioLoadWatts: number;
  mcuLoadWatts: number;
  panelIrradiance: number; // W/m^2
  cumulativeHarvestWh: number;
  cumulativeConsumptionWh: number;
}

interface RealtimeSolarGenerationChartProps {
  batteryStatus: BatteryManagerStatus;
  isNightMode?: boolean;
  onToggleSolarAware?: () => void;
  className?: string;
  embedded?: boolean;
}

/**
 * Generates initial historical solar harvesting vs power consumption data.
 */
function generateHistoricalSolarData(
  currentSolarW = 14.5,
  currentBatteryPct = 85,
  isSolarAware = false
): SolarTelemetryPoint[] {
  const points: SolarTelemetryPoint[] = [];
  const now = Date.now();
  let cumHarvest = 0;
  let cumConsumption = 0;

  // 24 intervals representing recent telemetry points (e.g. past 12 hours)
  const intervals = 24;
  for (let i = intervals; i >= 0; i--) {
    const ts = now - i * (30 * 60 * 1000); // every 30 minutes
    const d = new Date(ts);
    const hour = d.getHours();
    const min = d.getMinutes();
    const timeLabel = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

    // Solar daylight model with slight realistic cloud noise
    let solarWatts = 0;
    let solarVoltage = 0;
    let irradiance = 0;

    if (hour >= 6 && hour <= 20) {
      const peakHour = 13.5;
      const distFromPeak = Math.abs(hour + min / 60 - peakHour);
      const intensity = Math.max(0, Math.cos((distFromPeak / 7.5) * (Math.PI / 2)));
      const cloudFactor = 0.85 + Math.sin(i * 1.7) * 0.12;
      solarWatts = Number((intensity * (currentSolarW > 0 ? currentSolarW * 1.3 : 18.5) * cloudFactor).toFixed(2));
      solarVoltage = Number((12.0 + intensity * 6.8 + Math.sin(i) * 0.4).toFixed(1));
      irradiance = Math.round(intensity * 850 * cloudFactor);
    } else {
      solarVoltage = 0.8; // Dark panel ambient VOC
    }

    // Power consumption model: Base MCU + radio bursts
    const mcuLoad = isSolarAware ? 0.35 : 0.65;
    const radioBursts = (hour % 3 === 0 || i % 4 === 0) ? (isSolarAware ? 1.4 : 3.2) : 0.8;
    const consumptionWatts = Number((mcuLoad + radioBursts + Math.sin(i * 0.8) * 0.15).toFixed(2));
    const netPowerWatts = Number((solarWatts - consumptionWatts).toFixed(2));

    // Energy integration (Wh per 30 min step = Watts * 0.5h)
    cumHarvest += solarWatts * 0.5;
    cumConsumption += consumptionWatts * 0.5;

    // Battery trajectory
    const simulatedBattery = Math.min(
      100,
      Math.max(20, Math.round(currentBatteryPct - (i / intervals) * 6 + (netPowerWatts > 0 ? 3 : -3)))
    );

    points.push({
      timeLabel,
      timestamp: ts,
      solarWatts: i === 0 ? currentSolarW : solarWatts,
      solarVoltage,
      consumptionWatts,
      netPowerWatts: i === 0 ? Number((currentSolarW - consumptionWatts).toFixed(2)) : netPowerWatts,
      batteryPercent: i === 0 ? currentBatteryPct : simulatedBattery,
      radioLoadWatts: Number(radioBursts.toFixed(2)),
      mcuLoadWatts: mcuLoad,
      panelIrradiance: irradiance,
      cumulativeHarvestWh: Number(cumHarvest.toFixed(1)),
      cumulativeConsumptionWh: Number(cumConsumption.toFixed(1)),
    });
  }

  return points;
}

export const RealtimeSolarGenerationChart: React.FC<RealtimeSolarGenerationChartProps> = ({
  batteryStatus,
  isNightMode = false,
  onToggleSolarAware,
  className = '',
  embedded = false,
}) => {
  const [viewMode, setViewMode] = useState<'harvest_vs_consumption' | 'net_differential' | 'energy_accumulation'>(
    'harvest_vs_consumption'
  );
  const [timeframe, setTimeframe] = useState<'12h' | '6h' | 'live_stream'>('12h');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [telemetryData, setTelemetryData] = useState<SolarTelemetryPoint[]>(() =>
    generateHistoricalSolarData(
      batteryStatus.solarHarvestRateW || 15.2,
      batteryStatus.batteryLevelPercent || 85,
      batteryStatus.isSolarAwareActive
    )
  );

  // Live real-time streaming simulation: appends live solar generation and consumption telemetry
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const d = new Date(now);
      const timeLabel = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

      setTelemetryData((prev) => {
        const last = prev[prev.length - 1];
        const baseSolar = batteryStatus.solarHarvestRateW || 15.0;
        // Natural solar irradiance jitter (cloud drift)
        const jitter = (Math.random() - 0.48) * 0.9;
        const liveSolarW = Math.max(0, Number((baseSolar + jitter).toFixed(2)));
        const liveVoltage = Number((14.2 + (Math.random() - 0.5) * 0.3).toFixed(1));

        // Periodic radio burst simulation (BLE beaconing or LoRa relay)
        const isTxBurst = Math.random() > 0.7;
        const liveRadioLoad = isTxBurst ? (batteryStatus.isSolarAwareActive ? 1.8 : 3.6) : 0.85;
        const liveMcuLoad = batteryStatus.isSolarAwareActive ? 0.35 : 0.65;
        const liveConsumption = Number((liveRadioLoad + liveMcuLoad + (Math.random() - 0.5) * 0.1).toFixed(2));
        const liveNet = Number((liveSolarW - liveConsumption).toFixed(2));

        const newCumHarvest = Number(((last?.cumulativeHarvestWh || 120) + (liveSolarW * (4 / 3600))).toFixed(2));
        const newCumConsump = Number(((last?.cumulativeConsumptionWh || 45) + (liveConsumption * (4 / 3600))).toFixed(2));

        const newPoint: SolarTelemetryPoint = {
          timeLabel,
          timestamp: now,
          solarWatts: liveSolarW,
          solarVoltage: liveVoltage,
          consumptionWatts: liveConsumption,
          netPowerWatts: liveNet,
          batteryPercent: batteryStatus.batteryLevelPercent,
          radioLoadWatts: Number(liveRadioLoad.toFixed(2)),
          mcuLoadWatts: liveMcuLoad,
          panelIrradiance: Math.round(liveSolarW * 52),
          cumulativeHarvestWh: newCumHarvest,
          cumulativeConsumptionWh: newCumConsump,
        };

        const maxPoints = timeframe === 'live_stream' ? 20 : 30;
        return [...prev.slice(-maxPoints + 1), newPoint];
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveStreaming, timeframe, batteryStatus.solarHarvestRateW, batteryStatus.batteryLevelPercent, batteryStatus.isSolarAwareActive]);

  // Derived Key Metrics
  const currentPoint: SolarTelemetryPoint = telemetryData[telemetryData.length - 1] || {
    timeLabel: '12:00',
    timestamp: Date.now(),
    solarWatts: batteryStatus.solarHarvestRateW || 15.0,
    solarVoltage: 14.4,
    consumptionWatts: 2.1,
    netPowerWatts: (batteryStatus.solarHarvestRateW || 15.0) - 2.1,
    batteryPercent: batteryStatus.batteryLevelPercent,
    radioLoadWatts: 0.85,
    mcuLoadWatts: 0.45,
    panelIrradiance: 750,
    cumulativeHarvestWh: 142.5,
    cumulativeConsumptionWh: 48.2,
  };

  const peakSolarW = useMemo(() => {
    return Math.max(...telemetryData.map((d) => d.solarWatts), 0);
  }, [telemetryData]);

  const avgConsumptionW = useMemo(() => {
    if (telemetryData.length === 0) return 0;
    const sum = telemetryData.reduce((acc, d) => acc + d.consumptionWatts, 0);
    return Number((sum / telemetryData.length).toFixed(2));
  }, [telemetryData]);

  const energySurplusRatio = useMemo(() => {
    if (currentPoint.consumptionWatts <= 0) return 100;
    return Math.round((currentPoint.solarWatts / currentPoint.consumptionWatts) * 100);
  }, [currentPoint]);

  // Solarpunk color tokens
  const solarGold = '#E9C46A';
  const consumptionCoral = '#E76F51';
  const surplusTeal = '#2A9D8F';
  const harvestGreen = '#588157';
  const radioPurple = '#9B5DE5';

  return (
    <div
      id="solar-diagnostics-power-chart-card"
      className={`rounded-3xl border transition-all duration-200 ${
        embedded
          ? 'p-3 sm:p-4 bg-transparent border-0'
          : isNightMode
          ? 'p-4 sm:p-6 bg-[#182315] border-[#364E30]'
          : 'p-4 sm:p-6 bg-[#FAF6EE] border-[#87A878]/35 shadow-xs'
      } ${className}`}
    >
      {/* Top Header & Status Summary */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-[#E9C46A] shadow-inner shrink-0">
            <Sun className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-[#203A2A] dark:text-[#F0F5EE] tracking-tight">
                Päikeseenergia tootlikkuse &amp; tarbimise graafik (Recharts)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E9C46A]/20 text-[#D4A373] dark:text-[#E9C46A] border border-[#E9C46A]/40">
                MPPT Live Telemetry
              </span>
            </div>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
              Reaalajas fotovolt-tootlikkus (Watts) vs võrguraadio ja MCU energiatarbimine
            </p>
          </div>
        </div>

        {/* Live Simulation Controls & Solar Aware Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleSolarAware && (
            <button
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                onToggleSolarAware();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                batteryStatus.isSolarAwareActive
                  ? 'bg-[#E9C46A] text-[#203A2A] shadow-xs'
                  : isNightMode
                  ? 'bg-[#121A10] border border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                  : 'bg-white border border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
              }`}
              title="Aktiveeri päikeseteadlik säästurežiim võrguliikluse kohandamiseks"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{batteryStatus.isSolarAwareActive ? 'Solar-Aware ON' : 'Solar-Aware OFF'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setIsLiveStreaming(!isLiveStreaming);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
              isLiveStreaming
                ? 'bg-[#2A9D8F]/15 border-[#2A9D8F]/40 text-[#2A9D8F]'
                : isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-white border-[#87A878]/30 text-[#637062]'
            }`}
            title="Peata või jätka reaalajas telemeetria andmevoogu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-spin text-[#2A9D8F]' : ''}`} />
            <span className="hidden sm:inline">{isLiveStreaming ? 'Live Voog' : 'Peatatud'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
        {/* Current Generation */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#E9C46A]/20 text-[#D4A373] dark:text-[#E9C46A] shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#637062] dark:text-[#87A878] font-bold">
              Hetke tootlikkus
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#203A2A] dark:text-[#F0F5EE]">
              {currentPoint.solarWatts.toFixed(1)} W
            </div>
            <div className="text-[10px] text-[#588157] font-mono">
              {currentPoint.solarVoltage.toFixed(1)}V · {currentPoint.panelIrradiance} W/m²
            </div>
          </div>
        </div>

        {/* Current Power Consumption */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#E76F51]/20 text-[#E76F51] shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#637062] dark:text-[#87A878] font-bold">
              Kogutarbimine
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#E76F51]">
              {currentPoint.consumptionWatts.toFixed(1)} W
            </div>
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
              Raadio: {currentPoint.radioLoadWatts}W · Keskm: {avgConsumptionW}W
            </div>
          </div>
        </div>

        {/* Net Energy Balance */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              currentPoint.netPowerWatts >= 0
                ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]'
                : 'bg-[#E76F51]/20 text-[#E76F51]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#637062] dark:text-[#87A878] font-bold">
              Neto võimsusbilanss
            </div>
            <div
              className={`text-base sm:text-lg font-mono font-bold ${
                currentPoint.netPowerWatts >= 0 ? 'text-[#2A9D8F]' : 'text-[#E76F51]'
              }`}
            >
              {currentPoint.netPowerWatts > 0 ? `+${currentPoint.netPowerWatts.toFixed(1)}` : currentPoint.netPowerWatts.toFixed(1)} W
            </div>
            <div className="text-[10px] text-[#2A9D8F] font-mono">
              {currentPoint.netPowerWatts >= 0 ? 'Aku laeb (Surplus)' : 'Akutoitel (Drain)'}
            </div>
          </div>
        </div>

        {/* Energy Autonomy Index */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#2A3B26] flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#588157]/20 text-[#588157] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#637062] dark:text-[#87A878] font-bold">
              Isemajandavus (Wh)
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#588157]">
              {energySurplusRatio}%
            </div>
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
              Saagis: {currentPoint.cumulativeHarvestWh} Wh
            </div>
          </div>
        </div>
      </div>

      {/* Chart View Modes Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div
          className={`p-1 rounded-2xl border flex items-center gap-1 text-xs font-medium ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setViewMode('harvest_vs_consumption');
            }}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              viewMode === 'harvest_vs_consumption'
                ? 'bg-[#203A2A] text-white dark:bg-[#588157] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Tootlikkus vs Tarbimine (W)
          </button>

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setViewMode('net_differential');
            }}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              viewMode === 'net_differential'
                ? 'bg-[#203A2A] text-white dark:bg-[#588157] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Neto diferentsiaal (+/- W)
          </button>

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setViewMode('energy_accumulation');
            }}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              viewMode === 'energy_accumulation'
                ? 'bg-[#203A2A] text-white dark:bg-[#588157] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Kogunenud energia (Wh)
          </button>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E9C46A] border border-[#E9C46A]/60" />
            <span className="text-[#203A2A] dark:text-[#F0F5EE]">Päikeseenergia (W)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E76F51] border border-[#E76F51]/60" />
            <span className="text-[#203A2A] dark:text-[#F0F5EE]">Tarbimine (W)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2A9D8F] border border-[#2A9D8F]/60" />
            <span className="text-[#203A2A] dark:text-[#F0F5EE]">Neto (+/-)</span>
          </div>
        </div>
      </div>

      {/* Primary Recharts Visualization Canvas */}
      <div className="w-full h-64 sm:h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'harvest_vs_consumption' ? (
            <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="solarHarvestGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={solarGold} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={solarGold} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={consumptionCoral} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={consumptionCoral} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isNightMode ? '#2A3D25' : '#87A878'}
                strokeOpacity={isNightMode ? 0.25 : 0.2}
              />
              <XAxis
                dataKey="timeLabel"
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                dy={5}
              />
              <YAxis
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                unit="W"
                domain={[0, Math.ceil(Math.max(peakSolarW * 1.15, 10))]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as SolarTelemetryPoint;
                    return (
                      <div className="p-3 bg-[#121A10] text-[#F0F5EE] border border-[#2A3B26] rounded-2xl shadow-xl font-mono text-xs space-y-1 z-50">
                        <div className="font-bold text-sm text-[#E9C46A] flex items-center justify-between gap-3">
                          <span>{data.timeLabel}</span>
                          <span className="text-[10px] text-[#A8BDA5] font-normal">{data.solarVoltage}V MPPT</span>
                        </div>
                        <div className="text-[#E9C46A]">
                          Päikeseenergia saagis: <span className="font-bold">{data.solarWatts.toFixed(2)} W</span>
                        </div>
                        <div className="text-[#E76F51]">
                          Hetketarbimine: <span className="font-bold">{data.consumptionWatts.toFixed(2)} W</span>
                        </div>
                        <div className="text-[#A8BDA5] text-[10px]">
                          (Raadio: {data.radioLoadWatts}W · MCU: {data.mcuLoadWatts}W)
                        </div>
                        <div className="border-t border-white/10 pt-1 text-[#2A9D8F]">
                          Neto bilanss: <span className="font-bold">{data.netPowerWatts > 0 ? `+${data.netPowerWatts.toFixed(2)}` : data.netPowerWatts.toFixed(2)} W</span>
                        </div>
                        <div className="text-[10px] text-[#588157]">
                          Akutase: {data.batteryPercent}% · Kiirgus: {data.panelIrradiance} W/m²
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="solarWatts"
                name="Päikeseenergia (W)"
                stroke={solarGold}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#solarHarvestGradient)"
              />
              <Area
                type="monotone"
                dataKey="consumptionWatts"
                name="Tarbimine (W)"
                stroke={consumptionCoral}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#consumptionGradient)"
              />
              <Line
                type="monotone"
                dataKey="netPowerWatts"
                name="Neto (+/- W)"
                stroke={surplusTeal}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          ) : viewMode === 'net_differential' ? (
            <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="netSurplusGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={surplusTeal} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={surplusTeal} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isNightMode ? '#2A3D25' : '#87A878'}
                strokeOpacity={isNightMode ? 0.25 : 0.2}
              />
              <XAxis
                dataKey="timeLabel"
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                unit="W"
              />
              <ReferenceLine y={0} stroke={isNightMode ? '#E76F51' : '#D08C5D'} strokeDasharray="3 3" strokeWidth={1.5} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as SolarTelemetryPoint;
                    return (
                      <div className="p-3 bg-[#121A10] text-[#F0F5EE] border border-[#2A3B26] rounded-2xl shadow-xl font-mono text-xs space-y-1">
                        <div className="font-bold text-sm text-[#2A9D8F]">{data.timeLabel}</div>
                        <div>Neto võimsus: <span className="font-bold">{data.netPowerWatts > 0 ? `+${data.netPowerWatts}` : data.netPowerWatts} W</span></div>
                        <div className="text-[10px] text-[#A8BDA5]">{data.netPowerWatts > 0 ? 'Võrk toodab rohkem kui tarbib' : 'Aku katab energiapuudujäägi'}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="netPowerWatts"
                stroke={surplusTeal}
                strokeWidth={2.5}
                fill="url(#netSurplusGradient)"
              />
            </AreaChart>
          ) : (
            <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cumHarvestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={harvestGreen} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={harvestGreen} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isNightMode ? '#2A3D25' : '#87A878'}
                strokeOpacity={isNightMode ? 0.25 : 0.2}
              />
              <XAxis
                dataKey="timeLabel"
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke={isNightMode ? '#87A878' : '#637062'}
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                unit="Wh"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as SolarTelemetryPoint;
                    return (
                      <div className="p-3 bg-[#121A10] text-[#F0F5EE] border border-[#2A3B26] rounded-2xl shadow-xl font-mono text-xs space-y-1">
                        <div className="font-bold text-sm text-[#588157]">{data.timeLabel}</div>
                        <div className="text-[#588157]">Saagise kogumaht: <span className="font-bold">{data.cumulativeHarvestWh} Wh</span></div>
                        <div className="text-[#E76F51]">Tarbimise kogumaht: <span className="font-bold">{data.cumulativeConsumptionWh} Wh</span></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeHarvestWh"
                name="Kogunenud saagis (Wh)"
                stroke={harvestGreen}
                strokeWidth={2.5}
                fill="url(#cumHarvestGrad)"
              />
              <Line
                type="monotone"
                dataKey="cumulativeConsumptionWh"
                name="Kogunenud tarbimine (Wh)"
                stroke={consumptionCoral}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Environmental Insight */}
      <div className="mt-3 pt-2.5 border-t border-current/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#588157]" />
          <span>LiFePO4 MPPT Laadimiskontroller: Režiim CC/CV automaatne tasakaalustus</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Tippvõimsus: <strong className="text-[#E9C46A]">{peakSolarW} W</strong></span>
          <span>·</span>
          <span>Võrgu koormusindeks: <strong className="text-[#2A9D8F]">{batteryStatus.isSolarAwareActive ? 'Eco Mesh (15m)' : 'Standard (5m)'}</strong></span>
        </div>
      </div>
    </div>
  );
};
