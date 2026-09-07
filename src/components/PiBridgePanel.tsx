import React, { useState, useEffect } from 'react';
import { BridgeStatus } from '../types';
import {
  discoverBridge,
  getCustomBridgeIp,
  setCustomBridgeIp,
  getClientId,
  setClientId,
  startPairing,
  confirmPairing,
  revokeDevice,
  getBridgeAuthToken,
  isMockBridgeMode,
  setMockBridgeMode,
  subscribeBridgeStatus,
  getLastSyncInfo,
} from '../services/comms/piBridge';
import {
  Cpu,
  Sun,
  BatteryCharging,
  RefreshCw,
  Activity,
  XCircle,
  Server,
  Radio,
  Key,
  ShieldCheck,
  ShieldAlert,
  Trash2,
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
  const [clientIdInput, setClientIdInput] = useState<string>(getClientId());
  const [pairingSessionId, setPairingSessionId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [isMock, setIsMock] = useState<boolean>(isMockBridgeMode());
  const [lastSync, setLastSync] = useState<{ timestamp: number | null; peerCount: number }>(getLastSyncInfo());
  const [hasToken, setHasToken] = useState<boolean>(Boolean(getBridgeAuthToken()));

  useEffect(() => {
    const unsubscribe = subscribeBridgeStatus((s) => {
      setStatus(s);
      setLastSync(getLastSyncInfo());
      setHasToken(Boolean(getBridgeAuthToken()));
    });
    return () => unsubscribe();
  }, []);

  const handleStartPairing = async () => {
    setIsScanning(true);
    const targetIp = ipInput.trim() || '192.168.4.1:8080';
    setCustomBridgeIp(targetIp);
    setClientId(clientIdInput.trim() || 'HOIMU-CLIENT-APP');

    try {
      const startRes = await startPairing(targetIp, clientIdInput);
      if (startRes.success && startRes.sessionId) {
        setPairingSessionId(startRes.sessionId);
        if (startRes.devPin) {
          setPinInput(startRes.devPin);
          onAddToast?.('Pairing Initiated', `Session active. Dev PIN: ${startRes.devPin}`, 'info');
        } else {
          onAddToast?.('Pairing Initiated', 'Check Pi terminal/systemd logs for 6-digit PIN', 'info');
        }
      } else {
        onAddToast?.('Pairing Failed', startRes.error || 'Could not initiate pairing session', 'warning');
      }
    } catch {
      onAddToast?.('Connection Error', 'Failed to reach Pi bridge pairing endpoint', 'warning');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmPairing = async () => {
    if (!pairingSessionId || !pinInput.trim()) {
      onAddToast?.('Missing PIN', 'Please enter 6-digit pairing PIN', 'warning');
      return;
    }
    setIsScanning(true);
    try {
      const confirmRes = await confirmPairing(pairingSessionId, pinInput.trim(), ipInput, clientIdInput);
      if (confirmRes.success) {
        setPairingSessionId(null);
        setPinInput('');
        setHasToken(true);
        onAddToast?.('Device Paired', `Scoped credential saved. Device ID: ${confirmRes.deviceId}`, 'success');
      } else {
        onAddToast?.('Pairing Failed', confirmRes.error || 'Invalid PIN', 'warning');
      }
    } catch {
      onAddToast?.('Pairing Error', 'Failed to confirm PIN', 'warning');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRevokeCredential = async () => {
    try {
      const res = await revokeDevice();
      if (res.success) {
        setHasToken(false);
        setPairingSessionId(null);
        onAddToast?.('Credential Revoked', 'Hardware token cleared from local storage and Pi whitelist', 'info');
      } else {
        onAddToast?.('Revocation Error', res.error || 'Could not revoke token', 'warning');
      }
    } catch {
      onAddToast?.('Revocation Error', 'Failed to reach Pi bridge', 'warning');
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
      enabled ? 'Simulating Pi Zero 2 W solar telemetry & LoRa radio' : 'Directing requests to live authenticated Pi IP',
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
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                v1.0.0
              </span>
            </h3>
          </div>
          <p className="text-xs text-[#588157]">
            Authenticated hardware relay (LoRa 868MHz SX1262, Long-Range BLE 5.2, Solar Telemetry).
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
              Pairing / Connecting...
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

      {/* Dynamic 2-Step Pairing / Credential Controls */}
      <div className="p-4 rounded-2xl border bg-black/5 dark:bg-white/5 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono font-bold">
          <span className="flex items-center gap-1.5 text-[#588157]">
            {hasToken ? <ShieldCheck className="w-4 h-4 text-[#33ff00]" /> : <ShieldAlert className="w-4 h-4 text-[#E9C46A]" />}
            <span>PAIRED AUTHENTICATION BOUNDARY</span>
          </span>
          <span className="text-[11px] text-[#637062]">
            Client ID: <strong className="text-[#203A2A] dark:text-[#F0F5EE]">{clientIdInput}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5 flex items-center gap-2">
            <span className="text-xs font-bold text-[#637062] shrink-0 font-mono">Gateway IP:</span>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="192.168.4.1:8080"
              className={`w-full px-3 py-1.5 border rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#2A9D8F] ${
                isNightMode
                  ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/40'
              }`}
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <span className="text-xs font-bold text-[#637062] shrink-0 font-mono flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-[#E9C46A]" /> Client ID:
            </span>
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="HOIMU-CLIENT-APP"
              className={`w-full px-3 py-1.5 border rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#2A9D8F] ${
                isNightMode
                  ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/40'
              }`}
            />
          </div>

          <div className="sm:col-span-3">
            {!pairingSessionId ? (
              <button
                type="button"
                onClick={handleStartPairing}
                disabled={isScanning}
                className="w-full px-4 py-1.5 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#33ff00] ${isScanning ? 'animate-spin' : ''}`} />
                <span>{hasToken ? 'Re-Pair Device' : 'Start Pairing'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmPairing}
                disabled={isScanning}
                className="w-full px-4 py-1.5 bg-[#2A9D8F] hover:bg-[#207a6f] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>Confirm PIN</span>
              </button>
            )}
          </div>
        </div>

        {/* Pairing Session Active Subpanel */}
        {pairingSessionId && (
          <div className="p-3 rounded-xl border border-[#E9C46A]/50 bg-[#E9C46A]/10 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#203A2A] dark:text-[#E9C46A] block">
                Pairing Session Active ({pairingSessionId})
              </span>
              <span className="text-[11px] text-[#588157]">Enter 6-digit PIN emitted by Pi terminal</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="6-digit PIN"
                maxLength={6}
                className="w-28 px-3 py-1 border rounded-lg text-xs font-mono font-bold text-center tracking-widest bg-white text-black"
              />
              <button
                type="button"
                onClick={handleConfirmPairing}
                className="px-3 py-1 bg-[#203A2A] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {/* Token Revocation Action if Paired */}
        {hasToken && !pairingSessionId && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-current/10">
            <span className="text-[11px] text-[#588157] font-mono">
              Status: <strong className="text-[#33ff00]">Paired & Credential Stored Securely</strong>
            </span>
            <button
              type="button"
              onClick={handleRevokeCredential}
              className="text-[11px] font-bold text-[#E76F51] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Revoke Device Credential
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
