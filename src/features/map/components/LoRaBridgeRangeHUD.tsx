import React, { useState, useEffect } from 'react';
import { Radio, Cpu, Zap, Signal, Settings2, Eye, EyeOff, ShieldCheck, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { BridgeStatus } from '../../../types';
import { subscribeBridgeStatus } from '../../../services/comms/piBridge';
import { soundFeedback } from '../../../services/utils/soundFeedback';

export type PropagationEnv = 'urban' | 'suburban' | 'open_bioregion';

export interface LoRaParameters {
  environment: PropagationEnv;
  txPowerDbm: number; // 14 to 22
  spreadingFactor: number; // 7, 9, 11, 12
  antennaGainDbi: number; // 2.1 or 5.8
  mastHeightMeters: number; // 2 to 10
  showOverlay: boolean;
}

export const DEFAULT_LORA_CONFIG: LoRaParameters = {
  environment: 'suburban',
  txPowerDbm: 22,
  spreadingFactor: 11,
  antennaGainDbi: 3.0,
  mastHeightMeters: 4,
  showOverlay: true,
};

/**
 * Calculates effective transmission distance of an SX1262 LoRa bridge in kilometers
 * taking into account environment path-loss, RF output power, spreading factor, and antenna mast.
 */
export function estimateLoRaRangeKm(config: LoRaParameters): number {
  // Base distance by environment
  let baseKm = 3.5;
  if (config.environment === 'urban') baseKm = 1.8;
  if (config.environment === 'open_bioregion') baseKm = 7.5;

  // TX power factor (normalized around +22 dBm)
  const powerFactor = Math.pow(10, (config.txPowerDbm - 22) / 30);

  // Spreading factor link margin bonus (SF12 has ~10dB more link budget than SF7)
  const sfFactor = 1 + (config.spreadingFactor - 10) * 0.12;

  // Mast height factor
  const mastFactor = 1 + (config.mastHeightMeters - 3) * 0.04;

  const totalKm = baseKm * powerFactor * sfFactor * mastFactor;
  return Math.max(0.5, Math.min(15.0, Number(totalKm.toFixed(2))));
}

interface LoRaBridgeRangeHUDProps {
  config: LoRaParameters;
  onChangeConfig: (newConfig: LoRaParameters) => void;
  isNightMode?: boolean;
  coveredResourcesCount?: number;
  coveredPeersCount?: number;
}

export const LoRaBridgeRangeHUD: React.FC<LoRaBridgeRangeHUDProps> = ({
  config,
  onChangeConfig,
  isNightMode = false,
  coveredResourcesCount = 0,
  coveredPeersCount = 0,
}) => {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeBridgeStatus((s) => {
      setBridgeStatus(s);
    });
    return () => unsub();
  }, []);

  const estimatedKm = estimateLoRaRangeKm(config);
  const estimatedMiles = (estimatedKm * 0.621371).toFixed(2);
  const coverageAreaSqKm = (Math.PI * Math.pow(estimatedKm, 2)).toFixed(1);

  const isConnected = bridgeStatus?.connected === true;

  const handleToggleOverlay = () => {
    soundFeedback.playClick();
    onChangeConfig({
      ...config,
      showOverlay: !config.showOverlay,
    });
  };

  const handleSetEnvironment = (env: PropagationEnv) => {
    soundFeedback.playClick();
    onChangeConfig({
      ...config,
      environment: env,
    });
  };

  return (
    <div
      className={`rounded-2xl border shadow-lg backdrop-blur-md transition-all z-20 pointer-events-auto ${
        isNightMode
          ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Compact Header Strip */}
      <div className="p-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-left cursor-pointer hover:opacity-85 transition-opacity"
            title="Click to expand LoRa transmission parameters"
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center border shadow-xs ${
              isConnected
                ? 'bg-[#33ff00]/15 text-[#33ff00] border-[#33ff00]/30'
                : 'bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] border-[#E9C46A]/40'
            }`}>
              <Radio className="w-4 h-4 animate-pulse" />
            </div>

            <div>
              <div className="text-[11px] font-bold font-mono flex items-center gap-1.5 leading-tight">
                <span>LoRa Bridge Range</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#588157]/20 text-[#588157] dark:text-[#33ff00]">
                  {estimatedKm} km
                </span>
              </div>
              <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">
                SX1262 868.1MHz • {config.environment.replace('_', ' ')}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Toggle Overlay Visibility */}
          <button
            type="button"
            onClick={handleToggleOverlay}
            className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              config.showOverlay
                ? 'bg-[#588157] text-white border-[#588157]'
                : isNightMode
                ? 'bg-[#1A2617] border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-white border-[#87A878]/30 text-[#637062]'
            }`}
            title={config.showOverlay ? 'Hide LoRa circular range overlay' : 'Show LoRa circular range overlay'}
          >
            {config.showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="text-[10px] hidden sm:inline">{config.showOverlay ? 'Circle ON' : 'Hidden'}</span>
          </button>

          {/* Expand/Collapse Accordion Arrow */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Control & Telemetry Panel */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#87A878]/20 space-y-3 text-xs animate-in fade-in duration-150">
          {/* Hardware & Power Badge */}
          <div className={`p-2 rounded-xl border flex items-center justify-between text-[10px] font-mono ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'
          }`}>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#33ff00]" />
              <span className="font-bold">Raspberry Pi Zero 2 W</span>
              <span className="opacity-70">({bridgeStatus?.ipAddress || '192.168.4.1'})</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#E9C46A] flex items-center gap-0.5">
                <Zap className="w-3 h-3" />
                {bridgeStatus?.solarWatts || 12.4}W
              </span>
              <span className="text-[#33ff00]">
                {bridgeStatus?.piBatteryPercent || 87}% Batt
              </span>
            </div>
          </div>

          {/* Range & Coverage Readout */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Radius (LoRa 868)</div>
              <div className="font-bold text-sm text-[#588157] dark:text-[#33ff00]">
                {estimatedKm} km <span className="text-[10px] font-normal opacity-70">({estimatedMiles} mi)</span>
              </div>
            </div>

            <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Coverage Area</div>
              <div className="font-bold text-sm text-[#E9C46A]">
                ~{coverageAreaSqKm} km²
              </div>
            </div>
          </div>

          {/* Covered Community Resources & Peers in Reach */}
          <div className="flex items-center justify-between px-1 text-[11px]">
            <span className="text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Signal className="w-3 h-3 text-[#33ff00]" />
              <span>In Broadcast Reach:</span>
            </span>
            <span className="font-bold font-mono text-[#203A2A] dark:text-[#FAF6EE]">
              {coveredResourcesCount} Resources • {coveredPeersCount} Peers
            </span>
          </div>

          {/* Environment Propagation Selector */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold text-[#637062] dark:text-[#A8BDA5]">
              Propagation Environment:
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'urban', label: 'Urban', km: '~1.8 km' },
                { id: 'suburban', label: 'Suburban', km: '~3.5 km' },
                { id: 'open_bioregion', label: 'Open LoS', km: '~7.5 km' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSetEnvironment(item.id as PropagationEnv)}
                  className={`py-1.5 px-2 rounded-xl border text-[10px] font-bold text-center transition-all cursor-pointer ${
                    config.environment === item.id
                      ? 'bg-[#588157] text-white border-[#588157] shadow-xs'
                      : isNightMode
                      ? 'bg-[#1A2617] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                      : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
                  }`}
                >
                  <div>{item.label}</div>
                  <div className="text-[9px] opacity-80 font-mono font-normal">{item.km}</div>
                </button>
              ))}
            </div>
          </div>

          {/* RF Fine-Tuning: TX Power & Spreading Factor */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#87A878]/15 text-[10px] font-mono">
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">TX Power: </span>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  const nextPower = config.txPowerDbm === 22 ? 14 : 22;
                  onChangeConfig({ ...config, txPowerDbm: nextPower });
                }}
                className="font-bold underline text-[#588157] dark:text-[#33ff00] cursor-pointer"
              >
                +{config.txPowerDbm} dBm
              </button>
            </div>

            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Modulation: </span>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  const nextSf = config.spreadingFactor === 12 ? 9 : config.spreadingFactor === 11 ? 12 : 11;
                  onChangeConfig({ ...config, spreadingFactor: nextSf });
                }}
                className="font-bold underline text-[#E9C46A] cursor-pointer"
              >
                SF{config.spreadingFactor} (BW 125kHz)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
