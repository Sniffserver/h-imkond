import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BatteryManagerStatus, BatteryHistoryPoint } from '../types';
import {
  getStoredOrGeneratedBatteryHistory,
  computeBatteryTelemetryAnalytics,
} from '../utils/batteryHistoryHelper';
import {
  BatteryCharging,
  BatteryMedium,
  Sun,
  Zap,
  TrendingUp,
  Clock,
  Activity,
  Wifi,
  Bluetooth,
  Sliders,
  Sparkles,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface BatteryHistoryChartProps {
  batteryStatus: BatteryManagerStatus;
  isNightMode?: boolean;
  onToggleSolarAware?: () => void;
}

export const BatteryHistoryChart: React.FC<BatteryHistoryChartProps> = ({
  batteryStatus,
  isNightMode = false,
  onToggleSolarAware,
}) => {
  const [viewMode, setViewMode] = useState<'battery_solar' | 'power_balance'>('battery_solar');
  const [selectedPoint, setSelectedPoint] = useState<BatteryHistoryPoint | null>(null);

  // Retrieve or generate 24h history calibrated to current battery level
  const historyData = useMemo(() => {
    return getStoredOrGeneratedBatteryHistory(
      batteryStatus.batteryLevelPercent,
      batteryStatus.isSolarAwareActive,
      batteryStatus.hasSolarPanels || batteryStatus.isSolarAwareActive
    );
  }, [batteryStatus.batteryLevelPercent, batteryStatus.isSolarAwareActive, batteryStatus.hasSolarPanels]);

  const analytics = useMemo(() => {
    return computeBatteryTelemetryAnalytics(historyData);
  }, [historyData]);

  // Color schemes conforming to Solarpunk palette
  const strokeBattery = isNightMode ? '#2A9D8F' : '#203A2A';
  const fillBattery = isNightMode ? '#2A9D8F' : '#588157';
  const strokeSolar = '#E9C46A';
  const strokeConsumption = '#E76F51';

  return (
    <div
      id="battery-history-section"
      className={`rounded-3xl border p-5 sm:p-6 space-y-5 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30]'
          : 'bg-[#F0F5EE] border-[#87A878]/35 shadow-xs'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-4 pb-3 border-b border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#588157]/20 text-[#588157]">
              <BatteryCharging className="w-5 h-5 text-[#2A9D8F]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                <span>Terminali akukasutuse ja tarbimise ajalugu (24h)</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
                  {batteryStatus.batteryLevelPercent}% Reserve
                </span>
              </h3>
              <p className="text-xs text-[#637062] dark:text-[#87A878] font-mono mt-0.5">
                Päikeseenergia laadimise ja võrguraadio (BLE / Wi-Fi Direct) tarbimismustrid viimase 24 tunni jooksul
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Solar-Aware Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs font-medium ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
          }`}>
            <button
              type="button"
              onClick={() => setViewMode('battery_solar')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'battery_solar'
                  ? 'bg-[#588157] text-white font-bold shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              Aku tase & päike
            </button>
            <button
              type="button"
              onClick={() => setViewMode('power_balance')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'power_balance'
                  ? 'bg-[#588157] text-white font-bold shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              Tarbimine & netovool
            </button>
          </div>

          {onToggleSolarAware && (
            <button
              type="button"
              onClick={onToggleSolarAware}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                batteryStatus.isSolarAwareActive
                  ? 'bg-[#E9C46A] text-[#243128] border-[#dfba5f] hover:bg-[#dfba5f]'
                  : 'bg-[#203A2A] text-white border-[#203A2A] hover:bg-[#16271c]'
              }`}
              title="Lülita päikesetundlikkuse energiasäästurežiimi"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>{batteryStatus.isSolarAwareActive ? 'Solar-Saver sees' : 'Lülita Solar-Saverisse'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Analytics Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Net Energy Balance */}
        <div className={`p-3.5 rounded-2xl border ${
          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/30'
        }`}>
          <div className="flex items-center justify-between text-xs text-[#637062] dark:text-[#87A878]">
            <span className="flex items-center gap-1.5 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-[#2A9D8F]" />
              24h Nettoenergia
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
              analytics.netBalanceWh >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
            }`}>
              {analytics.netBalanceWh >= 0 ? 'Iseseisev' : 'Defitsiit'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-display font-bold text-xl text-[#203A2A] dark:text-[#F0F5EE]">
              {analytics.netBalanceWh > 0 ? `+${analytics.netBalanceWh}` : analytics.netBalanceWh}
            </span>
            <span className="text-xs font-mono font-semibold text-[#588157]">Wh</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
            Päike: {analytics.totalSolarWh}Wh • Kulu: {analytics.totalConsumedWh}Wh
          </p>
        </div>

        {/* 2. Peak Solar Harvest */}
        <div className={`p-3.5 rounded-2xl border ${
          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/30'
        }`}>
          <div className="flex items-center justify-between text-xs text-[#637062] dark:text-[#87A878]">
            <span className="flex items-center gap-1.5 font-medium">
              <Sun className="w-3.5 h-3.5 text-[#E9C46A]" />
              Päikese tippvõimsus
            </span>
            <span className="text-[10px] font-mono text-[#E9C46A] font-bold">
              {analytics.peakSolarHour}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-display font-bold text-xl text-[#203A2A] dark:text-[#F0F5EE]">
              {analytics.peakSolarW}
            </span>
            <span className="text-xs font-mono font-semibold text-[#E76F51]">Watts</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
            Isevarustatus: {analytics.solarSelfSufficiencyPct}%
          </p>
        </div>

        {/* 3. Average Drain Rate */}
        <div className={`p-3.5 rounded-2xl border ${
          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/30'
        }`}>
          <div className="flex items-center justify-between text-xs text-[#637062] dark:text-[#87A878]">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-[#E76F51]" />
              Keskmine tarbimine
            </span>
            <span className="text-[10px] font-mono text-[#588157] font-semibold">
              {batteryStatus.isSolarAwareActive ? 'Eco-Rate' : 'Standard'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-display font-bold text-xl text-[#203A2A] dark:text-[#F0F5EE]">
              {analytics.avgHourlyDrainRate}
            </span>
            <span className="text-xs font-mono font-semibold text-[#637062] dark:text-[#A8BDA5]">W/h</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
            Vahemik: {analytics.minBattery}% - {analytics.maxBattery}% aku
          </p>
        </div>

        {/* 4. Estimated Autonomy */}
        <div className={`p-3.5 rounded-2xl border ${
          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/30'
        }`}>
          <div className="flex items-center justify-between text-xs text-[#637062] dark:text-[#87A878]">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#2A9D8F]" />
              Hinnanguline tööaeg
            </span>
            <span className="text-[10px] font-mono text-[#2A9D8F] font-bold">
              Ilma päikeseta
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-display font-bold text-xl text-[#203A2A] dark:text-[#F0F5EE]">
              ~{analytics.estimatedRemainingHours}
            </span>
            <span className="text-xs font-mono font-semibold text-[#588157]">tundi</span>
          </div>
          <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
            Hetke tarbimisega ({batteryStatus.isSolarAwareActive ? '1.8W ootel' : '4.2W võrgus'})
          </p>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-xs'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
              {viewMode === 'battery_solar'
                ? 'Akutaseme trajektoor ja päikeseenergia saagikus (24h)'
                : 'Raadiomoodulite võimsustarve ja netovoolu dünaamika'}
            </span>
            <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
              (1h intervall)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            {viewMode === 'battery_solar' ? (
              <>
                <span className="flex items-center gap-1.5 text-[#2A9D8F]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2A9D8F]" />
                  Aku tase (%)
                </span>
                <span className="flex items-center gap-1.5 text-[#E9C46A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#E9C46A]" />
                  Päikeselaadimine (W)
                </span>
                <span className="flex items-center gap-1.5 text-[#E76F51]">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#E76F51]" />
                  Kriitiline lävi (20%)
                </span>
                <span className="flex items-center gap-1.5 text-[#588157]">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#588157]" />
                  Külluslävi (80%)
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-[#E9C46A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#E9C46A]" />
                  Päikese saagikus (W)
                </span>
                <span className="flex items-center gap-1.5 text-[#E76F51]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#E76F51]" />
                  Raadiokulu (W)
                </span>
                <span className="flex items-center gap-1.5 text-[#637062]">
                  <span className="w-3 h-0.5 bg-[#637062]" />
                  0W Netotasakaal
                </span>
              </>
            )}
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'battery_solar' ? (
              <AreaChart
                data={historyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    setSelectedPoint(e.activePayload[0].payload as BatteryHistoryPoint);
                  }
                }}
              >
                <defs>
                  <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={fillBattery} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={fillBattery} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E9C46A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E9C46A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isNightMode ? '#2A3B26' : '#87A878'}
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="timeLabel"
                  stroke={isNightMode ? '#87A878' : '#637062'}
                  fontSize={10}
                  tickLine={false}
                  interval={3}
                />
                {/* Left Axis: Battery Percentage */}
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  stroke={isNightMode ? '#87A878' : '#637062'}
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                {/* Right Axis: Solar Watts */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 25]}
                  stroke="#E9C46A"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `${val}W`}
                />
                <Tooltip content={<CustomBatteryTooltip isNightMode={isNightMode} />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="batteryLevel"
                  name="Aku tase"
                  stroke={strokeBattery}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#batteryGrad)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="solarHarvestW"
                  name="Päikeseenergia"
                  stroke={strokeSolar}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#solarGrad)"
                />
              </AreaChart>
            ) : (
              <AreaChart
                data={historyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    setSelectedPoint(e.activePayload[0].payload as BatteryHistoryPoint);
                  }
                }}
              >
                <defs>
                  <linearGradient id="solarPowerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E9C46A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E9C46A" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="consumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E76F51" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#E76F51" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isNightMode ? '#2A3B26' : '#87A878'}
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="timeLabel"
                  stroke={isNightMode ? '#87A878' : '#637062'}
                  fontSize={10}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  domain={[-8, 25]}
                  stroke={isNightMode ? '#87A878' : '#637062'}
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `${val}W`}
                />
                <Tooltip content={<CustomBatteryTooltip isNightMode={isNightMode} />} />
                <Area
                  type="monotone"
                  dataKey="solarHarvestW"
                  name="Päikese saagikus (W)"
                  stroke="#E9C46A"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#solarPowerGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="consumptionW"
                  name="Raadiotarbimine (W)"
                  stroke="#E76F51"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#consumeGrad)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Selected Hour Details Strip if clicked */}
        {selectedPoint && (
          <div className={`mt-3 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
            isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#FAF6EE] border-[#87A878]/40'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                Valitud tund: {selectedPoint.timeLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157]/20 text-[#588157]">
                {selectedPoint.activeProtocol}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span>Aku: <strong className="text-[#2A9D8F]">{selectedPoint.batteryLevel}%</strong></span>
              <span>Päike: <strong className="text-[#E9C46A]">+{selectedPoint.solarHarvestW}W</strong></span>
              <span>Kulu: <strong className="text-[#E76F51]">-{selectedPoint.consumptionW}W</strong></span>
              <span>Neto: <strong className={selectedPoint.netPowerW >= 0 ? 'text-green-600' : 'text-amber-600'}>
                {selectedPoint.netPowerW > 0 ? `+${selectedPoint.netPowerW}` : selectedPoint.netPowerW}W
              </strong></span>
            </div>
            <p className="w-full text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono">
              Režiim: {selectedPoint.modeDescription}
            </p>
          </div>
        )}
      </div>

      {/* Energy Optimization Advice & Consumption Insights */}
      <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
        isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/30'
      }`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E9C46A]" />
          <h4 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
            Energia optimeerimise soovitused (Energy Optimization Guidance)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Tip 1: Solar Peak Sync */}
          <div className={`p-3 rounded-xl border space-y-1.5 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[#E9C46A]">
              <Sun className="w-3.5 h-3.5" />
              <span>Päikeseakna sünkroonimine</span>
            </div>
            <p className="text-[#637062] dark:text-[#A8BDA5] leading-relaxed text-[11px]">
              Ajasta mahukad CRDT vahetused ja Wi-Fi Direct failiedastused kella <strong>11:00 ja 15:00</strong> vahele, mil päikesesaak ületab 15W ning laadija katab kogu raadiokoormuse.
            </p>
          </div>

          {/* Tip 2: Protocol Power Budget */}
          <div className={`p-3 rounded-xl border space-y-1.5 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[#2A9D8F]">
              <Bluetooth className="w-3.5 h-3.5" />
              <span>BLE vs Wi-Fi Direct eelarve</span>
            </div>
            <p className="text-[#637062] dark:text-[#A8BDA5] leading-relaxed text-[11px]">
              BLE majakas kasutab vaid <strong>~1.8W</strong>, sobides pidevaks taustaraadioks. Wi-Fi Direct tarbib <strong>~6-8W</strong>, mistõttu hoia P2P seansid alla 60 sekundi kui akupank on alla 50%.
            </p>
          </div>

          {/* Tip 3: Solar-Aware Mode */}
          <div className={`p-3 rounded-xl border space-y-1.5 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[#588157]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Solar-Saver autonoomia</span>
            </div>
            <p className="text-[#637062] dark:text-[#A8BDA5] leading-relaxed text-[11px]">
              Öisel ajal või pilvise ilmaga pikendab Solar-Aware režiim terminali tööaega <strong>üle 2.3 korra</strong> (15h asemel ~38h), lülitudes automaatselt 15-minutilisele BLE majakatsüklile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip component for Recharts
interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isNightMode?: boolean;
}

const CustomBatteryTooltip: React.FC<TooltipProps> = ({
  active,
  payload,
  label,
  isNightMode = false,
}) => {
  if (!active || !payload || !payload.length) return null;

  const data: BatteryHistoryPoint = payload[0].payload;

  return (
    <div
      className={`p-3 rounded-xl border shadow-xl text-xs space-y-1 font-mono z-50 ${
        isNightMode
          ? 'bg-[#121A10]/95 border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#203A2A]/95 border-[#87A878]/40 text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1">
        <span className="font-bold">{label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#588157] text-white">
          {data.activeProtocol}
        </span>
      </div>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#87A878]">Aku tase:</span>
          <span className="font-bold text-[#2A9D8F]">{data.batteryLevel}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#87A878]">Päikese laadimine:</span>
          <span className="font-bold text-[#E9C46A]">+{data.solarHarvestW} W</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#87A878]">Võrgukulu:</span>
          <span className="font-bold text-[#E76F51]">-{data.consumptionW} W</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
          <span className="text-gray-300">Netovool:</span>
          <span className={`font-bold ${data.netPowerW >= 0 ? 'text-green-400' : 'text-amber-400'}`}>
            {data.netPowerW > 0 ? `+${data.netPowerW}` : data.netPowerW} W
          </span>
        </div>
      </div>
      <p className="text-[10px] text-gray-300 italic pt-1 border-t border-white/10">
        {data.modeDescription}
      </p>
    </div>
  );
};
