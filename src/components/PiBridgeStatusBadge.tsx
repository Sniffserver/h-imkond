import React, { useState, useEffect } from 'react';
import { BridgeStatus } from '../types';
import { subscribeBridgeStatus, discoverBridge } from '../services/comms/piBridge';
import { Cpu, RefreshCw, Radio } from 'lucide-react';

interface PiBridgeStatusBadgeProps {
  isNightMode?: boolean;
  onClick?: () => void;
}

export const PiBridgeStatusBadge: React.FC<PiBridgeStatusBadgeProps> = ({
  isNightMode = false,
  onClick,
}) => {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeBridgeStatus((s) => {
      setStatus(s);
    });
    return () => unsubscribe();
  }, []);

  // If no status or explicitly disconnected and not scanning, show subtle indicator or status
  const isConnected = status?.connected === true;

  const handleClick = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }

    // Default action: trigger quick discovery test
    if (!isScanning) {
      setIsScanning(true);
      await discoverBridge();
      setIsScanning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-2 py-1 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
        isConnected
          ? isNightMode
            ? 'bg-[#182315] text-[#33ff00] border-[#33ff00]/40 hover:bg-[#2A3B26]'
            : 'bg-[#33ff00]/15 text-[#203A2A] border-[#33ff00]/40 hover:bg-[#33ff00]/25'
          : isScanning
          ? 'bg-[#E9C46A]/20 text-[#E9C46A] border-[#E9C46A]/40'
          : isNightMode
          ? 'bg-[#121A10] text-[#A8BDA5]/60 border-[#2A3B26]/60 hover:text-[#A8BDA5]'
          : 'bg-white/60 text-[#637062]/70 border-[#87A878]/20 hover:text-[#203A2A]'
      }`}
      title={
        isConnected
          ? status?.isSimulated
            ? `Pi Zero 2 W Bridge Simulated • ${status?.solarWatts != null ? `${status.solarWatts}W Solar · SIM` : 'Solar N/A'} • ${status?.piBatteryPercent != null ? `${status.piBatteryPercent}% Battery · SIM` : 'Battery N/A'}`
            : `Pi Zero 2 W Bridge Active (${status?.ipAddress}) • ${status?.solarWatts != null ? `${status.solarWatts}W Solar` : 'No Solar Data'} • ${status?.piBatteryPercent != null ? `${status.piBatteryPercent}% Battery` : 'No Battery Data'}`
          : isScanning
          ? 'Scanning for Raspberry Pi Bridge...'
          : 'Raspberry Pi Bridge Disconnected. Click to scan.'
      }
    >
      <Cpu className={`w-3.5 h-3.5 ${isConnected ? 'text-[#33ff00]' : 'text-[#87A878]'}`} />

      {isConnected ? (
        <span className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status?.isSimulated ? 'bg-[#E9C46A]' : 'bg-[#33ff00]'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${status?.isSimulated ? 'bg-[#E9C46A]' : 'bg-[#33ff00]'}`} />
          </span>
          <span className="hidden sm:inline">{status?.isSimulated ? 'SIMULATED' : 'Pi Bridge'}</span>
          {status?.solarWatts != null && (
            <span className="text-[10px] opacity-80">
              ({status.solarWatts}W{status?.isSimulated ? ' · SIM' : ''})
            </span>
          )}
        </span>
      ) : isScanning ? (
        <span className="flex items-center gap-1 text-[#E9C46A]">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span className="hidden sm:inline">Scanning...</span>
        </span>
      ) : (
        <span className="hidden md:inline text-[10px]">No Pi Bridge</span>
      )}
    </button>
  );
};
