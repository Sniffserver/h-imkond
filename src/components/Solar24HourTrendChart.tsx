import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  TrendingUp,
  Clock,
  ShieldCheck,
  Sparkles,
  Info,
  Calendar,
  CloudSun,
  CloudRain,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Flame,
  Activity,
} from 'lucide-react';
import { BatteryManagerStatus } from '../types';
import {
  SolarDeviceProfile,
  getDefaultSolarDevices,
} from '../utils/solarAutonomyCalculator';
import {
  generate24HourSolarTrend,
  HourlyEnergyTrendPoint,
  EnergyPlanningSummary,
  WeatherScenario,
} from '../utils/solar24HourTrendCalculator';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface Solar24HourTrendChartProps {
  batteryStatus?: BatteryManagerStatus;
  isNightMode?: boolean;
  className?: string;
  defaultDeviceId?: string;
  onSelectDevice?: (deviceId: string) => void;
  compact?: boolean;
}

export const Solar24HourTrendChart: React.FC<Solar24HourTrendChartProps> = ({
  batteryStatus,
  isNightMode = false,
  className = '',
  defaultDeviceId = 'field-terminal',
  onSelectDevice,
  compact = false,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(defaultDeviceId);
  const [weatherScenario, setWeatherScenario] = useState<WeatherScenario>('partly_cloudy');
  const [showSolarArea, setShowSolarArea] = useState(true);
  const [showBatteryLine, setShowBatteryLine] = useState(true);
  const [showNetBalance, setShowNetBalance] = useState(true);

  const defaultDevices = useMemo(() => getDefaultSolarDevices(batteryStatus), [batteryStatus]);
  const selectedDevice = useMemo(() => {
    return defaultDevices.find((d) => d.id === selectedDeviceId) || defaultDevices[0];
  }, [defaultDevices, selectedDeviceId]);

  // Compute 24-hour historical trend points and energy planning summary
  const { points, summary } = useMemo(() => {
    return generate24HourSolarTrend(selectedDevice, batteryStatus, weatherScenario);
  }, [selectedDevice, batteryStatus, weatherScenario]);

  // Colors conforming to Solarpunk palette
  const solarGold = '#E9C46A';
  const solarAmber = '#F4A261';
  const batteryTeal = '#2A9D8F';
  const forestGreen = '#588157';
  const gridColor = isNightMode ? '#2A3B26' : '#87A878';
  const textColor = isNightMode ? '#A8BDA5' : '#637062';
  const axisColor = isNightMode ? '#FAF6EE' : '#203A2A';

  // Find max solar watts for left axis domain
  const maxSolarWatts = useMemo(() => {
    const maxVal = Math.max(...points.map((p) => p.solarIntakeW));
    return Math.max(10, Math.ceil(maxVal * 1.25));
  }, [points]);

  const handleDeviceChange = (devId: string) => {
    soundFeedback.playClick();
    setSelectedDeviceId(devId);
    if (onSelectDevice) onSelectDevice(devId);
  };

  const handleScenarioChange = (scenario: WeatherScenario) => {
    soundFeedback.playClick();
    setWeatherScenario(scenario);
  };

  return (
    <div
      id="solar-24h-trend-visualization"
      className={`rounded-3xl border transition-all ${
        isNightMode
          ? 'bg-[#141E12] border-[#2A3B26] text-[#FAF6EE]'
          : 'bg-white/95 border-[#87A878]/35 text-[#203A2A]'
      } p-4 sm:p-5 shadow-xs ${className}`}
    >
      {/* Header & Planning Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#588157] dark:text-[#A8BDA5] flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-[#E9C46A]" />
              24-Hour Telemetry Trend
            </span>
            <span
              className="text-[9px] font-mono px-2.5 py-0.5 rounded-full font-bold text-white shadow-xs"
              style={{ backgroundColor: summary.statusBadgeColor }}
            >
              {summary.statusLabel}
            </span>
            <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
              Self-Sufficiency: <strong className="text-current font-bold">{summary.selfSufficiencyRatio}%</strong>
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold font-display">
            Solar Intake vs. Battery Charge Trend
          </h3>
          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
            24-hour diurnal insolation curve compared with battery state of charge (SoC) for proactive energy planning.
          </p>
        </div>

        {/* Weather Simulation Scenario Selector */}
        <div className="flex items-center gap-1 bg-[#FAF6EE] dark:bg-[#1C2C19] p-1 rounded-2xl border border-[#87A878]/25 self-start sm:self-auto">
          <button
            type="button"
            id="scenario-btn-clear"
            onClick={() => handleScenarioChange('clear')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              weatherScenario === 'clear'
                ? 'bg-[#203A2A] text-white dark:bg-[#E9C46A] dark:text-[#141E12] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Simulate peak clear sunlight conditions"
          >
            <Sun className="w-3 h-3 text-[#E9C46A]" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            id="scenario-btn-partly"
            onClick={() => handleScenarioChange('partly_cloudy')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              weatherScenario === 'partly_cloudy'
                ? 'bg-[#203A2A] text-white dark:bg-[#E9C46A] dark:text-[#141E12] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Simulate typical variable cloud cover"
          >
            <CloudSun className="w-3 h-3 text-[#2A9D8F]" />
            <span className="hidden sm:inline">Variable</span>
          </button>

          <button
            type="button"
            id="scenario-btn-overcast"
            onClick={() => handleScenarioChange('overcast')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              weatherScenario === 'overcast'
                ? 'bg-[#203A2A] text-white dark:bg-[#E9C46A] dark:text-[#141E12] shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Simulate overcast weather stress-test"
          >
            <CloudRain className="w-3 h-3 text-[#E76F51]" />
            <span className="hidden sm:inline">Overcast</span>
          </button>
        </div>
      </div>

      {/* Device Quick Selector Tabs */}
      {!compact && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {defaultDevices.map((dev) => (
            <button
              key={dev.id}
              id={`trend-device-chip-${dev.id}`}
              type="button"
              onClick={() => handleDeviceChange(dev.id)}
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
      )}

      {/* Main Recharts Visualization Canvas */}
      <div className="w-full h-[260px] sm:h-[300px] my-2 select-none relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              {/* Solar Intake Gradient (Gold to transparent) */}
              <linearGradient id="solarIntakeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={solarGold} stopOpacity={0.65} />
                <stop offset="60%" stopColor={solarAmber} stopOpacity={0.25} />
                <stop offset="98%" stopColor={solarAmber} stopOpacity={0.0} />
              </linearGradient>

              {/* Battery Charge Fill Gradient */}
              <linearGradient id="batteryLineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2A9D8F" />
                <stop offset="100%" stopColor="#588157" />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              strokeOpacity={0.25}
              vertical={false}
            />

            {/* X-Axis: 24-hour timeline */}
            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={{ stroke: gridColor, strokeOpacity: 0.3 }}
              tick={{ fill: textColor, fontSize: 10, fontFamily: 'monospace' }}
              interval={compact ? 5 : 2}
            />

            {/* Left Y-Axis: Solar Intake in Watts */}
            <YAxis
              yAxisId="solar"
              domain={[0, maxSolarWatts]}
              tickLine={false}
              axisLine={{ stroke: gridColor, strokeOpacity: 0.3 }}
              tick={{ fill: solarGold, fontSize: 10, fontFamily: 'monospace' }}
              unit="W"
              width={35}
            />

            {/* Right Y-Axis: Battery Charge Percentage (%) */}
            <YAxis
              yAxisId="battery"
              orientation="right"
              domain={[0, 100]}
              tickLine={false}
              axisLine={{ stroke: gridColor, strokeOpacity: 0.3 }}
              tick={{ fill: batteryTeal, fontSize: 10, fontFamily: 'monospace' }}
              unit="%"
              width={35}
            />

            {/* Critical Battery Discharge Reserve Floor (20%) */}
            <ReferenceLine
              yAxisId="battery"
              y={20}
              stroke="#E76F51"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: '20% Reserve Floor',
                position: 'insideBottomRight',
                fill: '#E76F51',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />

            {/* Solar Break-even Consumption threshold */}
            <ReferenceLine
              yAxisId="solar"
              y={selectedDevice.baseConsumptionW}
              stroke={isNightMode ? '#FAF6EE' : '#203A2A'}
              strokeDasharray="2 2"
              strokeOpacity={0.4}
              label={{
                value: `Break-even (${selectedDevice.baseConsumptionW.toFixed(1)}W)`,
                position: 'insideTopLeft',
                fill: textColor,
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as HourlyEnergyTrendPoint;
                const isSurplus = data.solarIntakeW >= data.consumptionW;

                return (
                  <div className="bg-[#203A2A]/95 text-white p-3 rounded-2xl shadow-xl border border-[#87A878]/40 text-xs space-y-1.5 backdrop-blur-md min-w-[210px] animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-mono">
                      <span className="font-bold flex items-center gap-1 text-[#E9C46A]">
                        <Clock className="w-3.5 h-3.5" />
                        {data.timeLabel}
                      </span>
                      <span className="text-[10px] uppercase text-[#A8BDA5]">
                        {data.weatherCondition}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px]">
                      {/* Solar Intake */}
                      <div className="flex items-center justify-between text-[#E9C46A]">
                        <span className="flex items-center gap-1 font-sans">
                          <Sun className="w-3 h-3" /> Solar Intake:
                        </span>
                        <strong>{data.solarIntakeW.toFixed(1)} W</strong>
                      </div>

                      {/* Battery Charge */}
                      <div className="flex items-center justify-between text-[#2A9D8F]">
                        <span className="flex items-center gap-1 font-sans">
                          <Battery className="w-3 h-3" /> Battery Charge:
                        </span>
                        <strong>{data.batteryPercent}% ({data.batteryEnergyWh} Wh)</strong>
                      </div>

                      {/* Net Flow */}
                      <div className="flex items-center justify-between text-white/90">
                        <span className="flex items-center gap-1 font-sans">
                          <Zap className="w-3 h-3 text-[#F4A261]" /> Net Power:
                        </span>
                        <strong className={isSurplus ? 'text-[#2A9D8F]' : 'text-[#E76F51]'}>
                          {isSurplus ? `+${data.netPowerW.toFixed(1)}W (Charging)` : `${data.netPowerW.toFixed(1)}W (Discharging)`}
                        </strong>
                      </div>
                    </div>

                    {/* Planning note */}
                    <div className="pt-1 border-t border-white/10 text-[10px] text-[#A8BDA5] leading-tight flex items-start gap-1 font-sans">
                      <Sparkles className="w-3 h-3 text-[#E9C46A] shrink-0 mt-0.5" />
                      <span>{data.energyPlanningNote}</span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Solar Intake Area (Gold fill on Left Axis) */}
            {showSolarArea && (
              <Area
                yAxisId="solar"
                type="monotone"
                dataKey="solarIntakeW"
                name="Solar Intake (W)"
                stroke={solarGold}
                strokeWidth={2.5}
                fill="url(#solarIntakeGradient)"
                activeDot={{ r: 5, fill: solarGold, stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            )}

            {/* Battery Charge Line (Teal stroke on Right Axis) */}
            {showBatteryLine && (
              <Line
                yAxisId="battery"
                type="monotone"
                dataKey="batteryPercent"
                name="Battery Charge (%)"
                stroke={batteryTeal}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: batteryTeal, stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Legend & Visibility Toggles */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 pb-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="toggle-solar-area-btn"
            onClick={() => {
              soundFeedback.playClick();
              setShowSolarArea(!showSolarArea);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-[11px] transition-all cursor-pointer border ${
              showSolarArea
                ? 'bg-[#E9C46A]/15 border-[#E9C46A]/40 text-[#B28210] dark:text-[#E9C46A] font-bold'
                : 'opacity-40 border-transparent hover:opacity-75'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#E9C46A]" />
            <span>Solar Intake (W)</span>
          </button>

          <button
            type="button"
            id="toggle-battery-line-btn"
            onClick={() => {
              soundFeedback.playClick();
              setShowBatteryLine(!showBatteryLine);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-[11px] transition-all cursor-pointer border ${
              showBatteryLine
                ? 'bg-[#2A9D8F]/15 border-[#2A9D8F]/40 text-[#165B53] dark:text-[#2A9D8F] font-bold'
                : 'opacity-40 border-transparent hover:opacity-75'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F]" />
            <span>Battery Charge (%)</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5] flex items-center gap-2">
          <span>Peak Window: <strong className="text-current font-bold">{summary.recommendedHighLoadWindow}</strong></span>
        </div>
      </div>

      {/* Energy Planning Matrix Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
        {/* Card 1: 24h Peak Solar */}
        <div
          id="planning-card-peak-solar"
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1 mb-1">
            <Sun className="w-3 h-3 text-[#E9C46A]" />
            Peak Solar Power
          </div>
          <div className="text-lg sm:text-xl font-bold font-display text-[#E9C46A] flex items-baseline gap-1">
            {summary.peakSolarW.toFixed(1)} <span className="text-xs font-mono font-normal">W</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 font-mono truncate">
            Observed at {summary.peakSolarHour}
          </p>
        </div>

        {/* Card 2: 24h Energy Balance (In vs Out) */}
        <div
          id="planning-card-energy-balance"
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-[#2A9D8F]" />
            24h Net Balance
          </div>
          <div className="text-lg sm:text-xl font-bold font-display flex items-baseline gap-1 text-[#2A9D8F]">
            {summary.netEnergyBalanceWh >= 0 ? `+${summary.netEnergyBalanceWh}` : summary.netEnergyBalanceWh}{' '}
            <span className="text-xs font-mono font-normal">Wh</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 font-mono truncate">
            {summary.totalHarvestedWh}Wh in • {summary.totalConsumedWh}Wh out
          </p>
        </div>

        {/* Card 3: Battery Depth of Discharge */}
        <div
          id="planning-card-battery-swing"
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1 mb-1">
            <Activity className="w-3 h-3 text-[#588157]" />
            Battery Diurnal Swing
          </div>
          <div className="text-lg sm:text-xl font-bold font-display text-[#588157] dark:text-[#87D07B] flex items-baseline gap-1">
            {summary.minBatteryPercent}% <span className="text-xs font-mono font-normal">→ {summary.maxBatteryPercent}%</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 font-mono truncate">
            {summary.depthOfDischargePercent}% Depth-of-Discharge
          </p>
        </div>

        {/* Card 4: Energy Self-Sufficiency */}
        <div
          id="planning-card-self-sufficiency"
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1 mb-1">
            <ShieldCheck className="w-3 h-3 text-[#2A9D8F]" />
            Autonomy Index
          </div>
          <div className="text-lg sm:text-xl font-bold font-display text-[#2A9D8F] flex items-baseline gap-1">
            {summary.selfSufficiencyRatio}% <span className="text-xs font-mono font-normal">Solar</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 font-mono truncate">
            {summary.selfSufficiencyRatio >= 100 ? 'Self-Sustaining Cycle' : 'Supplemental Power Needed'}
          </p>
        </div>
      </div>

      {/* Actionable Energy Planning Recommendations */}
      <div
        id="energy-planning-recommendations-box"
        className={`p-3.5 rounded-2xl border mt-3 space-y-1.5 ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26]'
            : 'bg-[#FAF6EE] border-[#87A878]/30'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold font-display text-[#203A2A] dark:text-[#FAF6EE]">
          <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
          <span>Bioregional Energy Planning Recommendations</span>
        </div>
        <ul className="space-y-1 pt-1">
          {summary.planningAdvice.map((item, idx) => (
            <li
              key={idx}
              className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed flex items-start gap-1.5"
            >
              <CheckCircle className="w-3 h-3 text-[#2A9D8F] shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
