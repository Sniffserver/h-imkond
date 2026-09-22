import React, { useEffect, useState } from 'react';
import {
  backgroundSyncAdjuster,
  SyncAdjusterState,
  STANDARD_BEACON_INTERVAL_MS,
  LOW_BATTERY_BEACON_INTERVAL_MS,
  LOW_BATTERY_THRESHOLD_PERCENT,
} from '../services/mesh/backgroundSyncAdjuster';
import { Battery, BatteryWarning, BatteryCharging, Zap, Gauge, Sliders, ShieldCheck, RotateCcw } from 'lucide-react';

interface BackgroundSyncAdjusterCardProps {
  isNightMode?: boolean;
  className?: string;
  compact?: boolean;
}

export const BackgroundSyncAdjusterCard: React.FC<BackgroundSyncAdjusterCardProps> = ({
  isNightMode = false,
  className = '',
  compact = false,
}) => {
  const [state, setState] = useState<SyncAdjusterState>(() => backgroundSyncAdjuster.getState());
  const [sliderValue, setSliderValue] = useState<number>(state.currentIntervalMs / 1000);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const unsubscribe = backgroundSyncAdjuster.subscribe((newState) => {
      setState(newState);
      setSliderValue(Math.round(newState.currentIntervalMs / 1000));
    });
    return unsubscribe;
  }, []);

  const handleToggleSimulation = () => {
    if (state.isSimulated) {
      backgroundSyncAdjuster.simulateLowBattery(false);
    } else {
      backgroundSyncAdjuster.simulateLowBattery(true, 12);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = parseInt(e.target.value, 10);
    setSliderValue(seconds);
    backgroundSyncAdjuster.setManualInterval(seconds * 1000);
  };

  const handleResetAuto = () => {
    backgroundSyncAdjuster.resetToAuto();
  };

  // Compact layout (for embedding in status strips)
  if (compact) {
    return (
      <div
        id="background-sync-adjuster-compact"
        className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border font-mono ${
          state.isLowBattery
            ? isNightMode
              ? 'bg-[#2E1810] border-[#E76F51]/50 text-[#F4A261]'
              : 'bg-[#FFF3E8] border-[#E76F51]/40 text-[#A63C1E]'
            : isNightMode
            ? 'bg-[#18231B] border-[#588157]/40 text-[#87A878]'
            : 'bg-[#F2F7F2] border-[#87A878]/40 text-[#386641]'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          {state.isCharging ? (
            <BatteryCharging className="w-4 h-4 text-[#2A9D8F]" />
          ) : state.isLowBattery ? (
            <BatteryWarning className="w-4 h-4 text-[#E76F51] animate-pulse" />
          ) : (
            <Battery className="w-4 h-4 text-[#2A9D8F]" />
          )}
          <span>
            {state.isLowBattery ? (
              <strong className="font-semibold">Low Battery ({state.batteryPercent}%)</strong>
            ) : (
              <span>Battery: {state.batteryPercent}%</span>
            )}
          </span>
          <span className="text-[10px] opacity-75">
            • Beacon Sync: {state.currentIntervalMs / 1000}s ({state.frequencyHz} Hz)
          </span>
        </div>

        <button
          id="toggle-low-battery-sim-btn"
          type="button"
          onClick={handleToggleSimulation}
          className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
            state.isSimulated
              ? 'bg-[#E76F51] text-white border-[#E76F51]'
              : isNightMode
              ? 'bg-[#243026] text-[#A8BDA5] border-[#384639] hover:bg-[#314234]'
              : 'bg-white text-[#4A5D4E] border-[#C2D1BF] hover:bg-[#EAF2E8]'
          }`}
        >
          {state.isSimulated ? 'Simulating <15%' : 'Simulate <15%'}
        </button>
      </div>
    );
  }

  // Full detailed card layout
  return (
    <div
      id="background-sync-adjuster-card"
      className={`rounded-xl border p-4 transition-all ${
        isNightMode ? 'bg-[#1E2520] border-[#323E34]' : 'bg-[#FDFBF7] border-[#E2DDD3]'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              state.isLowBattery
                ? 'bg-[#E76F51]/20 text-[#E76F51]'
                : isNightMode
                ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]'
                : 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
            }`}
          >
            {state.isCharging ? (
              <BatteryCharging className="w-5 h-5" />
            ) : state.isLowBattery ? (
              <BatteryWarning className="w-5 h-5 animate-pulse" />
            ) : (
              <Gauge className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4
              className={`text-sm font-semibold flex items-center gap-1.5 ${
                isNightMode ? 'text-[#EDE8DF]' : 'text-[#2C352E]'
              }`}
            >
              Background Sync Interval Adjuster
              {state.isLowBattery && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#E76F51] text-white">
                  &lt;15% ECO THROTTLE
                </span>
              )}
            </h4>
            <p className={`text-xs ${isNightMode ? 'text-[#87A878]' : 'text-[#637062]'}`}>
              Adaptive beacon scanning & mesh sync cadence regulated by battery level
            </p>
          </div>
        </div>

        {/* Quick Simulation Button */}
        <button
          id="btn-simulate-low-battery"
          type="button"
          onClick={handleToggleSimulation}
          className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors cursor-pointer shrink-0 ${
            state.isSimulated
              ? 'bg-[#E76F51] text-white border-[#E76F51]'
              : isNightMode
              ? 'bg-[#263328] text-[#87A878] border-[#38483B] hover:bg-[#324435]'
              : 'bg-white text-[#4A5D4E] border-[#CCD9CA] hover:bg-[#EAF0E9]'
          }`}
          title="Toggle <15% battery simulation to verify automatic radio scan throttling"
        >
          {state.isSimulated ? 'Exit <15% Sim' : 'Simulate <15% Battery'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {/* Battery Level */}
        <div
          id="sync-metric-battery"
          className={`p-2.5 rounded-lg border font-mono ${
            state.isLowBattery
              ? isNightMode
                ? 'bg-[#2D1A15] border-[#E76F51]/40 text-[#F4A261]'
                : 'bg-[#FFF2EB] border-[#E76F51]/40 text-[#9C3214]'
              : isNightMode
              ? 'bg-[#151D17] border-[#2A382C] text-[#EDE8DF]'
              : 'bg-white border-[#E5E0D8] text-[#2C352E]'
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider text-[#87A878] flex items-center gap-1">
            <Battery className="w-3 h-3" /> Level
          </div>
          <div className="text-base font-bold mt-0.5 flex items-baseline gap-1">
            {state.batteryPercent}%
            {state.isCharging && <span className="text-[10px] text-[#2A9D8F]">CHG</span>}
          </div>
          <div className="text-[9px] text-[#87A878] mt-0.5">
            {state.isLowBattery ? 'Low battery (<15%)' : 'Nominal reserve'}
          </div>
        </div>

        {/* Sync Interval */}
        <div
          id="sync-metric-interval"
          className={`p-2.5 rounded-lg border font-mono ${
            isNightMode ? 'bg-[#151D17] border-[#2A382C]' : 'bg-white border-[#E5E0D8]'
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider text-[#87A878] flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#E9C46A]" /> Sync Interval
          </div>
          <div className="text-base font-bold mt-0.5 text-[#E9C46A]">
            {state.currentIntervalMs / 1000}s
          </div>
          <div className="text-[9px] text-[#87A878] mt-0.5">
            {state.isLowBattery ? 'Eco throttled' : 'Full responsiveness'}
          </div>
        </div>

        {/* Frequency */}
        <div
          id="sync-metric-frequency"
          className={`p-2.5 rounded-lg border font-mono ${
            isNightMode ? 'bg-[#151D17] border-[#2A382C]' : 'bg-white border-[#E5E0D8]'
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider text-[#87A878] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-[#2A9D8F]" /> Radio Cadence
          </div>
          <div className="text-base font-bold mt-0.5 text-[#2A9D8F]">
            {state.frequencyHz} Hz
          </div>
          <div className="text-[9px] text-[#87A878] mt-0.5">
            {state.currentIntervalMs <= STANDARD_BEACON_INTERVAL_MS ? '1 burst / 8s' : `1 burst / ${state.currentIntervalMs / 1000}s`}
          </div>
        </div>

        {/* Power Reduction */}
        <div
          id="sync-metric-reduction"
          className={`p-2.5 rounded-lg border font-mono ${
            isNightMode ? 'bg-[#151D17] border-[#2A382C]' : 'bg-white border-[#E5E0D8]'
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider text-[#87A878] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#588157]" /> Radio Savings
          </div>
          <div className="text-base font-bold mt-0.5 text-[#588157]">
            {state.reductionPercentage > 0 ? `-${state.reductionPercentage}%` : 'Standard'}
          </div>
          <div className="text-[9px] text-[#87A878] mt-0.5">
            {state.reductionPercentage > 0 ? 'Energy preserved' : 'Max peer discovery'}
          </div>
        </div>
      </div>

      {/* Low Battery Notice Banner */}
      {state.isLowBattery && (
        <div
          id="sync-low-battery-banner"
          className={`mb-3 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
            isNightMode
              ? 'bg-[#2C1914] border-[#E76F51]/40 text-[#F4A261]'
              : 'bg-[#FFF4EC] border-[#E76F51]/30 text-[#A63C1E]'
          }`}
        >
          <BatteryWarning className="w-4 h-4 shrink-0 text-[#E76F51]" />
          <span>
            <strong>Low battery protection active:</strong> Beacon scanning frequency reduced from{' '}
            {STANDARD_BEACON_INTERVAL_MS / 1000}s to {LOW_BATTERY_BEACON_INTERVAL_MS / 1000}s because
            battery level is under {LOW_BATTERY_THRESHOLD_PERCENT}%.
          </span>
        </div>
      )}

      {/* Expandable Manual Custom Interval Controls */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs">
          <button
            id="toggle-adjuster-advanced"
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 font-mono transition-colors hover:underline cursor-pointer ${
              isNightMode ? 'text-[#87A878]' : 'text-[#588157]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {showAdvanced ? 'Hide Manual Controls' : 'Manual Cadence Controls'}
          </button>

          {state.mode === 'manual_override' && (
            <button
              id="reset-auto-cadence-btn"
              type="button"
              onClick={handleResetAuto}
              className="text-xs flex items-center gap-1 text-[#2A9D8F] hover:underline cursor-pointer font-mono"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Auto Battery Mode
            </button>
          )}
        </div>

        {showAdvanced && (
          <div
            id="sync-adjuster-slider-panel"
            className={`mt-3 p-3 rounded-lg border ${
              isNightMode ? 'bg-[#151D17] border-[#2A382C]' : 'bg-[#F4F2EC] border-[#DFD9CD]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className={isNightMode ? 'text-[#EDE8DF]' : 'text-[#2C352E]'}>
                Manual Beacon Interval:
              </span>
              <span className="font-bold text-[#2A9D8F]">{sliderValue} seconds</span>
            </div>

            <input
              id="sync-interval-range-slider"
              type="range"
              min="4"
              max="120"
              step="2"
              value={sliderValue}
              onChange={handleSliderChange}
              className="w-full accent-[#2A9D8F] cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-mono text-[#87A878] mt-1">
              <span>4s (Fast)</span>
              <span>8s (Normal)</span>
              <span>45s (Eco &lt;15%)</span>
              <span>120s (Ultra Eco)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
