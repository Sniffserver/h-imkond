import React, { useState, useEffect } from 'react';
import { BridgeStatus } from '../types';
import {
  discoverBridge,
  getBridgeStatus,
  getCustomBridgeIp,
  setCustomBridgeIp,
  isMockBridgeMode,
  setMockBridgeMode,
  subscribeBridgeStatus,
  getLastSyncInfo,
} from '../services/piBridge';
import {
  Cpu,
  Sun,
  BatteryCharging,
  RefreshCw,
  Activity,
  XCircle,
  Server,
  Zap,
  Radio,
  CheckCircle2,
} from 'lucide-react';

interface PiBridgePanelProps {
  isNightMode?: boolean;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const PiBridgePanel: React.FC<PiBridgePanelProps> = ({
  isNightMode = false,
  onAddToast,
}) => {
  const [ipInput, setIpInput] = useState<string>(getCustomBridgeIp());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [isMock, setIsMock] = useState<boolean>(isMockBridgeMode());
  const [lastSync, setLastSync] = useState<{ timestamp: number | null; peerCount: number }>(getLastSyncInfo());

  useEffect(() => {
    const unsubscribe = subscribeBridgeStatus((s) => {
      setStatus(s);
      setLastSync(getLastSyncInfo());
    });
    return () => unsubscribe();
  }, []);

  const handlePairWithPi = async () => {
    setIsScanning(true);
    const targetIp = ipInput.trim() || '192.168.4.1:5000';
    setCustomBridgeIp(targetIp);

    try {
      const res = await discoverBridge(targetIp);
      setStatus(res.status);
      setLastSync(getLastSyncInfo());

      if (res.success) {
        onAddToast?.('Connected to hoimu-pi', `Raspberry Pi bridge paired at ${res.ip}`, 'success');
      } else {
        onAddToast?.('Bridge Connection Failed', `Could not reach Pi bridge at ${targetIp}. Using phone native radio.`, 'warning');
      }
    } catch {
      onAddToast?.('Scan Error', 'Failed to discover Pi bridge', 'warning');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleMock = (enabled: boolean) => {
    setIsMock(enabled);
    setMockBridgeMode(enabled);
    if (enabled) {
      discoverBridge();
    }
    onAddToast?.(
      enabled ? 'Mock Bridge Enabled' : 'Live Hardware Mode',
      enabled ? 'Simulating Pi Zero 2 W solar telemetry & LoRa radio' : 'Directing requests to live Pi IP',
      'info'
    );
  };

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Never synced';
    const secondsAgo = Math.floor((Date.now() - ts) / 1000);
    if (secondsAgo < 5) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  return (
    <div
      id="pi-bridge-panel"
      className={`rounded-3xl border p-5 sm:p-6 shadow-xs space-y-4 transition-colors ${
        isNightMode
          ? 'bg-[#1e2c1c] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header & Connection Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#33ff00] dark:text-[#33ff00]" />
            <h3 className="font-display font-bold text-base sm:text-lg flex items-center gap-2">
              <span>Raspberry Pi Zero 2 W Hardware Bridge</span>
            </h3>
          </div>
          <p className="text-xs text-[#588157]">
            Off-grid hardware relay (LoRa 868MHz SX1262, Long-Range BLE 5.2, Solar Telemetry).
          </p>
        </div>

        {/* Connection Status Indicator */}
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#33ff00]/20 text-[#203A2A] dark:text-[#33ff00] border border-[#33ff00]/40 flex items-center gap-1.5 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#33ff00] animate-pulse" />
              Connected to hoimu-pi ({status.ipAddress})
            </span>
          ) : isScanning ? (
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/40 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Scanning...
            </span>
          ) : (
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-black/10 text-[#637062] dark:text-[#A8BDA5] border border-current/20 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-[#E76F51]" />
              Disconnected (Fallback to Phone Radio)
            </span>
          )}
        </div>
      </div>

      {/* Telemetry Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Solar Input */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-1 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-[#637062]">
            <span>SOLAR HARVEST</span>
            <Sun className="w-4 h-4 text-[#E9C46A]" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-[#2A9D8F]">
              {status?.solarWatts ?? 12.4}W
            </span>
            <span className="text-[10px] block text-[#588157] font-mono">
              {status?.solarVoltage ?? 14.2}V PV Input
            </span>
          </div>
        </div>

        {/* Battery Telemetry */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-1 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-[#637062]">
            <span>PI BATTERY</span>
            <BatteryCharging className="w-4 h-4 text-[#33ff00]" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-[#33ff00]">
              {status?.piBatteryPercent ?? 87}%
            </span>
            <span className="text-[10px] block text-[#588157]">LiFePO4 Solar Pack</span>
          </div>
        </div>

        {/* Relayed Packets */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-1 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-[#637062]">
            <span>RELAY COUNT</span>
            <Activity className="w-4 h-4 text-[#2A9D8F]" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-[#203A2A] dark:text-[#F0F5EE]">
              {status?.relayedPacketsCount ?? 421}
            </span>
            <span className="text-[10px] block text-[#588157]">Packets Repeated</span>
          </div>
        </div>

        {/* Uptime */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-1 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-[#637062]">
            <span>GATEWAY UPTIME</span>
            <Server className="w-4 h-4 text-[#E9C46A]" />
          </div>
          <div>
            <span className="text-lg font-bold font-mono text-[#203A2A] dark:text-[#F0F5EE]">
              {formatUptime(status?.uptimeSeconds ?? 18450)}
            </span>
            <span className="text-[10px] block text-[#588157]">Headless Daemon</span>
          </div>
        </div>
      </div>

      {/* Sync Status & Radio Modules Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-current/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#588157]">
            <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>
              Last Sync: <strong>{formatLastSync(lastSync.timestamp)}</strong> ({lastSync.peerCount} bridge peers)
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <span className="px-2 py-0.5 rounded bg-[#2A9D8F]/15 text-[#2A9D8F] font-mono text-[10px] font-bold border border-[#2A9D8F]/30">
              LoRa 868MHz
            </span>
            <span className="px-2 py-0.5 rounded bg-[#33ff00]/15 text-[#203A2A] dark:text-[#33ff00] font-mono text-[10px] font-bold border border-[#33ff00]/30">
              BLE 5.2 Coded
            </span>
          </div>
        </div>

        {/* MOCK_BRIDGE Dev Flag Toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#588157]">
          <span>MOCK_BRIDGE (Dev Mode)</span>
          <input
            type="checkbox"
            checked={isMock}
            onChange={(e) => handleToggleMock(e.target.checked)}
            className="w-4 h-4 accent-[#2A9D8F] cursor-pointer"
          />
        </label>
      </div>

      {/* Pair with Pi & Manual IP Input */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
        <div className="flex-1 w-full flex items-center gap-2">
          <span className="text-xs font-bold text-[#637062] shrink-0 font-mono">Bridge IP:</span>
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="192.168.4.1:5000"
            className={`flex-1 px-3.5 py-2 border rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#2A9D8F] ${
              isNightMode
                ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                : 'bg-white text-[#203A2A] border-[#87A878]/40'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={handlePairWithPi}
          disabled={isScanning}
          className="w-full sm:w-auto px-5 py-2 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#33ff00] ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Pair with Pi'}</span>
        </button>
      </div>
    </div>
  );
};
