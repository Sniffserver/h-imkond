import React, { useState, useMemo } from 'react';
import {
  Sun,
  Zap,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Clock,
  ArrowRight,
  Sliders,
  ShieldCheck,
  Radio,
  Cpu,
  RefreshCw,
  Moon,
  Sparkles,
  ChevronRight,
  Gauge,
  Activity,
  Maximize2,
} from 'lucide-react';
import { BatteryManagerStatus } from '../types';
import {
  SolarDeviceProfile,
  SolarAutonomyEstimate,
  calculateSolarAutonomy,
  getDefaultSolarDevices,
} from '../utils/solarAutonomyCalculator';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface SolarDeviceTimeToEmptyWidgetProps {
  batteryStatus?: BatteryManagerStatus;
  isNightMode?: boolean;
  onToggleSolarAware?: () => void;
  variant?: 'dashboard' | 'full';
  onExpand?: () => void;
  className?: string;
}

export const SolarDeviceTimeToEmptyWidget: React.FC<SolarDeviceTimeToEmptyWidgetProps> = ({
  batteryStatus,
  isNightMode = false,
  onToggleSolarAware,
  variant = 'dashboard',
  onExpand,
  className = '',
}) => {
  // Initialize device roster
  const defaultDevices = useMemo(
    () => getDefaultSolarDevices(batteryStatus),
    [batteryStatus]
  );

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('field-terminal');
  
  // Custom slider adjustments (overrides)
  const [customHarvestW, setCustomHarvestW] = useState<number | null>(null);
  const [customConsumptionW, setCustomConsumptionW] = useState<number | null>(null);
  const [nightSimulationActive, setNightSimulationActive] = useState<boolean>(false);

  const selectedDevice = useMemo(() => {
    return defaultDevices.find((d) => d.id === selectedDeviceId) || defaultDevices[0];
  }, [defaultDevices, selectedDeviceId]);

  // Determine effective inputs considering simulation and user adjustments
  const effectiveHarvestW = useMemo(() => {
    if (nightSimulationActive) return 0;
    if (customHarvestW !== null) return customHarvestW;
    return selectedDevice.currentHarvestW;
  }, [nightSimulationActive, customHarvestW, selectedDevice.currentHarvestW]);

  const effectiveConsumptionW = useMemo(() => {
    if (customConsumptionW !== null) return customConsumptionW;
    return selectedDevice.isEcoModeActive
      ? selectedDevice.ecoConsumptionW
      : selectedDevice.baseConsumptionW;
  }, [customConsumptionW, selectedDevice]);

  // Calculate current autonomy projection
  const estimate: SolarAutonomyEstimate = useMemo(() => {
    return calculateSolarAutonomy(selectedDevice, effectiveHarvestW, effectiveConsumptionW);
  }, [selectedDevice, effectiveHarvestW, effectiveConsumptionW]);

  // Charging status: true when solar intake is higher than current consumption
  const isCharging = effectiveHarvestW > effectiveConsumptionW;

  // Color logic based on autonomy status
  const getStatusColor = (status: SolarAutonomyEstimate['autonomyStatus']) => {
    switch (status) {
      case 'surplus':
        return {
          accent: '#2A9D8F',
          bg: isNightMode ? 'bg-[#112926]' : 'bg-[#EBF7F5]',
          border: 'border-[#2A9D8F]/40',
          text: isNightMode ? 'text-[#5CD2C3]' : 'text-[#165B53]',
        };
      case 'optimal':
        return {
          accent: '#588157',
          bg: isNightMode ? 'bg-[#182B18]' : 'bg-[#EFF5EC]',
          border: 'border-[#588157]/40',
          text: isNightMode ? 'text-[#87D07B]' : 'text-[#2D5A27]',
        };
      case 'stable':
        return {
          accent: '#E9C46A',
          bg: isNightMode ? 'bg-[#2E2410]' : 'bg-[#FDF6E2]',
          border: 'border-[#E9C46A]/40',
          text: isNightMode ? 'text-[#F3D78A]' : 'text-[#8C6207]',
        };
      case 'warning':
        return {
          accent: '#F4A261',
          bg: isNightMode ? 'bg-[#331D12]' : 'bg-[#FEF3EC]',
          border: 'border-[#F4A261]/40',
          text: isNightMode ? 'text-[#F8B788]' : 'text-[#B25310]',
        };
      case 'critical':
      default:
        return {
          accent: '#E76F51',
          bg: isNightMode ? 'bg-[#33130F]' : 'bg-[#FDF1EE]',
          border: 'border-[#E76F51]/40',
          text: isNightMode ? 'text-[#F7937A]' : 'text-[#A83218]',
        };
    }
  };

  const statusColors = getStatusColor(estimate.autonomyStatus);

  const resetAdjustments = () => {
    soundFeedback.playClick();
    setCustomHarvestW(null);
    setCustomConsumptionW(null);
    setNightSimulationActive(false);
  };

  // SVG Radial Gauge rendering
  const renderRadialAutonomyGauge = (radius: number, strokeWidth: number) => {
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    
    // Percentage to display: if surplus, 100%; else clamp hours (e.g. 24h = 100%)
    const pct = estimate.isSurplus
      ? 100
      : Math.min(100, Math.max(5, ((estimate.timeToEmptyHours || 0) / 24) * 100));
      
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    return (
      <svg
        height={radius * 2}
        width={radius * 2}
        className="shrink-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          stroke={isNightMode ? '#2A3B26' : '#E0E7DC'}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={statusColors.accent}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
    );
  };

  /* ========================================================================= */
  /* VARIANT 1: DASHBOARD COMPACT WIDGET (Glanceable card in Tools Modal)      */
  /* ========================================================================= */
  if (variant === 'dashboard') {
    const dashboardBgClass = isCharging
      ? isNightMode
        ? 'animate-solar-charge-pulse-dark'
        : 'animate-solar-charge-pulse-light'
      : isNightMode
      ? 'bg-[#141E12] border-[#2A3B26]'
      : 'bg-white/90 border-[#87A878]/30';

    return (
      <div
        id="solar-time-to-empty-dashboard-widget"
        className={`p-4 rounded-3xl border transition-all ${dashboardBgClass} ${
          isNightMode ? 'text-[#FAF6EE]' : 'text-[#203A2A]'
        } shadow-sm ${className}`}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 flex items-center justify-center text-[#E9C46A]">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold font-display uppercase tracking-wider text-[#588157] dark:text-[#A8BDA5]">
                  Solar Autonomy
                </span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.2 rounded-full border ${statusColors.bg} ${statusColors.border} ${statusColors.text}`}
                >
                  {estimate.isSurplus ? 'SURPLUS' : estimate.autonomyStatus.toUpperCase()}
                </span>
                {isCharging && (
                  <span
                    id="solar-charging-indicator-badge"
                    className="text-[9px] font-mono px-2 py-0.2 rounded-full font-bold flex items-center gap-1 bg-[#2A9D8F]/15 text-[#165B53] dark:text-[#5CD2C3] border border-[#2A9D8F]/35"
                    title={`Solar intake (${effectiveHarvestW.toFixed(1)}W) exceeds consumption (${effectiveConsumptionW.toFixed(1)}W) — Battery actively charging`}
                  >
                    <BatteryCharging className="w-2.5 h-2.5 text-[#2A9D8F] animate-pulse" />
                    <span>CHARGING</span>
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold truncate">Time-to-Empty Estimator</h3>
            </div>
          </div>

          {onExpand && (
            <button
              type="button"
              id="expand-solar-autonomy-btn"
              onClick={() => {
                soundFeedback.playClick();
                onExpand();
              }}
              className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                isNightMode
                  ? 'border-[#2A3B26] hover:bg-[#2A3B26] text-[#A8BDA5]'
                  : 'border-[#87A878]/30 hover:bg-[#87A878]/15 text-[#588157]'
              }`}
              title="Open Full Solar Device Autonomy Simulator"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Full Simulator</span>
            </button>
          )}
        </div>

        {/* Device Quick Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {defaultDevices.map((dev) => (
            <button
              key={dev.id}
              id={`solar-device-chip-${dev.id}`}
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                setSelectedDeviceId(dev.id);
                setCustomHarvestW(null);
                setCustomConsumptionW(null);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                selectedDeviceId === dev.id
                  ? isNightMode
                    ? 'bg-[#2A3B26] text-[#E9C46A] border-[#E9C46A]/50'
                    : 'bg-[#203A2A] text-white border-[#203A2A]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:bg-[#22331E]'
                  : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/20 hover:bg-[#87A878]/15'
              }`}
            >
              {dev.name.split(' (')[0]}
            </button>
          ))}
        </div>

        {/* Primary Readout Box */}
        <div
          className={`p-3 rounded-2xl border mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
            isCharging
              ? isNightMode
                ? 'bg-[#112924]/60 border-[#2A9D8F]/35 shadow-xs'
                : 'bg-[#EBF7F5]/85 border-[#2A9D8F]/35 shadow-xs'
              : isNightMode
              ? 'bg-[#182315] border-[#2A3B26]'
              : 'bg-[#FAF6EE] border-[#87A878]/30'
          }`}
        >
          {/* Left: Main Time to Empty Readout */}
          <div className="flex items-center gap-3">
            {renderRadialAutonomyGauge(24, 3)}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#2A9D8F]" />
                Estimated Time to Empty
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className="text-2xl font-bold font-display tracking-tight"
                  style={{ color: statusColors.accent }}
                >
                  {estimate.timeToEmptyFormatted}
                </span>
                {estimate.isSurplus && (
                  <span className="text-[11px] font-mono font-medium text-[#2A9D8F]">
                    ({estimate.timeToFullFormatted})
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                {estimate.depletionTimeFormatted
                  ? `Depletion projection: ${estimate.depletionTimeFormatted}`
                  : `Self-sustaining while solar harvest ≥ ${estimate.currentConsumptionW.toFixed(1)}W`}
              </p>
            </div>
          </div>

          {/* Right: Real-time Power Flux Summary */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5 font-mono text-[11px]">
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Solar Input</span>
              <span className="font-bold text-[#E9C46A] flex items-center sm:justify-end gap-0.5">
                <Sun className="w-3 h-3" />
                +{estimate.currentHarvestW.toFixed(1)}W
              </span>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Load Rate</span>
              <span className="font-bold text-[#E76F51] flex items-center sm:justify-end gap-0.5">
                <Zap className="w-3 h-3" />
                -{estimate.currentConsumptionW.toFixed(1)}W
              </span>
            </div>

            <div className="text-left sm:text-right pl-2 border-l border-black/10 dark:border-white/10">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Night Run</span>
              <span className="font-bold text-[#588157] dark:text-[#87D07B] block">
                {estimate.nightAutonomyFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Micro Telemetry Bar */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
          <span>
            Battery: <strong className="text-current">{estimate.batteryPercent}%</strong> (
            {estimate.remainingEnergyWh} / {estimate.batteryCapacityWh} Wh)
          </span>
          <span className="truncate max-w-[220px]">
            Net: <strong style={{ color: statusColors.accent }}>
              {estimate.netPowerW <= 0
                ? `+${Math.abs(estimate.netPowerW).toFixed(1)}W (Charging)`
                : `-${estimate.netPowerW.toFixed(1)}W (Draining)`}
            </strong>
          </span>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* VARIANT 2: FULL DETAILED INTERACTIVE CALCULATOR (Dedicated Tool View)     */
  /* ========================================================================= */
  const fullChargingPulseClass = isCharging
    ? isNightMode
      ? 'animate-solar-charge-pulse-dark'
      : 'animate-solar-charge-pulse-light'
    : isNightMode
    ? 'bg-[#141E12] border-[#2A3B26]'
    : 'bg-white/95 border-[#87A878]/30 shadow-xs';

  return (
    <div
      id="solar-time-to-empty-full-widget"
      className={`space-y-4 max-w-4xl mx-auto ${className}`}
    >
      {/* Top Banner / Device Selector */}
      <div
        className={`p-4 sm:p-5 rounded-3xl border transition-all ${fullChargingPulseClass}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 flex items-center justify-center text-[#E9C46A]">
                <Sun className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold font-display">
                Solar Device Autonomy & Time-to-Empty
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Live battery discharge simulations across active off-grid nodes under shifting sunlight conditions.
              </p>
              {isCharging && (
                <span
                  id="solar-charging-full-badge"
                  className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-[#2A9D8F]/15 text-[#165B53] dark:text-[#5CD2C3] border border-[#2A9D8F]/35"
                >
                  <BatteryCharging className="w-3 h-3 text-[#2A9D8F] animate-pulse" />
                  <span>Battery Charging (+{(effectiveHarvestW - effectiveConsumptionW).toFixed(1)}W Net Solar Intake)</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Simulation Reset */}
          {(customHarvestW !== null || customConsumptionW !== null || nightSimulationActive) && (
            <button
              type="button"
              id="reset-solar-adjustments-btn"
              onClick={resetAdjustments}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                isNightMode
                  ? 'border-[#2A3B26] text-[#A8BDA5] hover:bg-[#2A3B26]'
                  : 'border-[#87A878]/30 text-[#637062] hover:bg-[#87A878]/15'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Custom Sliders</span>
            </button>
          )}
        </div>

        {/* Device Picker Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {defaultDevices.map((dev) => {
            const isSelected = selectedDeviceId === dev.id;
            return (
              <button
                key={dev.id}
                id={`solar-device-card-${dev.id}`}
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setSelectedDeviceId(dev.id);
                  setCustomHarvestW(null);
                  setCustomConsumptionW(null);
                  setNightSimulationActive(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? isNightMode
                      ? 'bg-[#20301B] border-[#E9C46A] shadow-sm ring-1 ring-[#E9C46A]/40'
                      : 'bg-[#EFF5EC] border-[#588157] shadow-sm ring-1 ring-[#588157]/30'
                    : isNightMode
                    ? 'bg-[#182315] border-[#2A3B26] hover:bg-[#22331E]'
                    : 'bg-[#FAF6EE] border-[#87A878]/20 hover:bg-[#87A878]/15'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] mb-1">
                  <span className="uppercase">{dev.category}</span>
                  <span className="font-bold text-[#588157] dark:text-[#87D07B]">
                    {dev.currentBatteryPercent}%
                  </span>
                </div>
                <h4 className="text-xs font-bold font-display truncate">{dev.name.split(' (')[0]}</h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate mt-0.5 font-mono">
                  {dev.batteryCapacityWh} Wh • {dev.solarPanelPeakW}W panel
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Autonomy Dashboard & Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Hero Autonomy Readout */}
        <div
          className={`md:col-span-7 p-5 rounded-3xl border flex flex-col justify-between transition-all ${fullChargingPulseClass}`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#637062] dark:text-[#A8BDA5]">
                Active Node: <strong className="text-current">{selectedDevice.name}</strong>
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${statusColors.bg} ${statusColors.border} ${statusColors.text}`}
              >
                {estimate.statusLabel}
              </span>
            </div>

            {/* Time-To-Empty Hero Value */}
            <div className="flex items-center gap-4 my-2">
              {renderRadialAutonomyGauge(38, 4.5)}
              <div>
                <span className="text-xs font-mono text-[#637062] dark:text-[#A8BDA5] block">
                  Calculated Time-to-Empty
                </span>
                <div
                  className="text-3xl sm:text-4xl font-bold font-display tracking-tight"
                  style={{ color: statusColors.accent }}
                >
                  {estimate.timeToEmptyFormatted}
                </div>
                <p className="text-xs font-mono text-[#637062] dark:text-[#A8BDA5] mt-0.5">
                  {estimate.depletionTimeFormatted
                    ? `Projected battery runout: ${estimate.depletionTimeFormatted}`
                    : `Sustaining load: ${estimate.timeToFullFormatted}`}
                </p>
              </div>
            </div>

            {/* Explanatory Recommendation Box */}
            <div
              className={`p-3 rounded-2xl border text-xs leading-relaxed mt-4 ${statusColors.bg} ${statusColors.border} ${statusColors.text}`}
            >
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
                <p>{estimate.statusRecommendation}</p>
              </div>
            </div>
          </div>

          {/* Metric Trio: Remaining Wh, Net Flux, Night Autonomy */}
          <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-black/5 dark:border-white/5 font-mono text-center">
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Battery Energy</span>
              <span className="text-sm font-bold block mt-0.5">
                {estimate.remainingEnergyWh} <span className="text-[10px] font-normal">/ {estimate.batteryCapacityWh} Wh</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Net Power Flux</span>
              <span
                className="text-sm font-bold block mt-0.5"
                style={{ color: statusColors.accent }}
              >
                {estimate.netPowerW <= 0
                  ? `+${Math.abs(estimate.netPowerW).toFixed(1)}W`
                  : `-${estimate.netPowerW.toFixed(1)}W`}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Night Autonomy (0W)</span>
              <span className="text-sm font-bold text-[#588157] dark:text-[#87D07B] block mt-0.5">
                {estimate.nightAutonomyFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Interactive Controls & Sliders */}
        <div
          className={`md:col-span-5 p-5 rounded-3xl border flex flex-col justify-between ${
            isNightMode
              ? 'bg-[#141E12] border-[#2A3B26]'
              : 'bg-white/95 border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#2A9D8F]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider">
                  Power Simulation Controls
                </h3>
              </div>

              {/* Night Mode Stress Test Button */}
              <button
                type="button"
                id="toggle-night-sim-btn"
                onClick={() => {
                  soundFeedback.playClick();
                  setNightSimulationActive((prev) => !prev);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  nightSimulationActive
                    ? 'bg-[#E76F51] text-white border-[#E76F51]'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:bg-[#22331E]'
                    : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/20 hover:bg-[#87A878]/15'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Night Simulation (0W)</span>
              </button>
            </div>

            {/* Slider 1: Current Consumption Load Rate (W) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#E76F51]" />
                  Consumption Rate:
                </span>
                <span className="font-bold text-[#E76F51]">{effectiveConsumptionW.toFixed(2)} W</span>
              </div>
              <input
                id="slider-consumption-rate"
                type="range"
                min="0.2"
                max="10.0"
                step="0.1"
                value={effectiveConsumptionW}
                onChange={(e) => setCustomConsumptionW(parseFloat(e.target.value))}
                className="w-full accent-[#E76F51] cursor-pointer"
              />
              <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => setCustomConsumptionW(selectedDevice.ecoConsumptionW)}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[#588157]"
                >
                  Eco ({selectedDevice.ecoConsumptionW}W)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomConsumptionW(selectedDevice.baseConsumptionW)}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[#E9C46A]"
                >
                  Base ({selectedDevice.baseConsumptionW}W)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomConsumptionW(selectedDevice.highLoadConsumptionW)}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[#E76F51]"
                >
                  Sync ({selectedDevice.highLoadConsumptionW}W)
                </button>
              </div>
            </div>

            {/* Slider 2: Current Solar Harvest Input (W) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1">
                  <Sun className="w-3 h-3 text-[#E9C46A]" />
                  Solar Generation:
                </span>
                <span className="font-bold text-[#E9C46A]">{effectiveHarvestW.toFixed(2)} W</span>
              </div>
              <input
                id="slider-solar-harvest"
                type="range"
                min="0"
                max={Math.max(30, selectedDevice.solarPanelPeakW)}
                step="0.5"
                value={effectiveHarvestW}
                disabled={nightSimulationActive}
                onChange={(e) => setCustomHarvestW(parseFloat(e.target.value))}
                className="w-full accent-[#E9C46A] cursor-pointer disabled:opacity-40"
              />
              <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setNightSimulationActive(false);
                    setCustomHarvestW(0);
                  }}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-500"
                >
                  Dark (0W)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNightSimulationActive(false);
                    setCustomHarvestW(selectedDevice.solarPanelPeakW * 0.25);
                  }}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[#87A878]"
                >
                  Overcast
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNightSimulationActive(false);
                    setCustomHarvestW(selectedDevice.solarPanelPeakW * 0.85);
                  }}
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[#E9C46A]"
                >
                  Peak Sun
                </button>
              </div>
            </div>
          </div>

          {/* Quick Hardware Details & Solar Aware Action */}
          <div className="pt-4 mt-4 border-t border-black/5 dark:border-white/5 space-y-2">
            <div className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
              Hardware: <span className="text-current font-semibold">{selectedDevice.hardware}</span>
            </div>

            {onToggleSolarAware && (
              <button
                type="button"
                id="toggle-solar-aware-from-widget-btn"
                onClick={() => {
                  soundFeedback.playClick();
                  onToggleSolarAware();
                }}
                className={`w-full py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  batteryStatus?.isSolarAwareActive
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] hover:bg-[#238276]'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:bg-[#22331E]'
                    : 'bg-[#FAF6EE] text-[#588157] border-[#87A878]/30 hover:bg-[#87A878]/15'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>
                  {batteryStatus?.isSolarAwareActive
                    ? 'Solar-Aware Mode: ACTIVE (Tap to Standby)'
                    : 'Engage Solar-Aware Throttling (Reduce Load)'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
