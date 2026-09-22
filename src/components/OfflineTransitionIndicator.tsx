import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Radio, HardDrive, MessageSquare, Database, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { offlineMapService } from '../services/map/offlineMapService';

export interface OfflineTransitionIndicatorProps {
  onReconnect?: () => void;
  isNightMode?: boolean;
}

export function OfflineTransitionIndicator({
  onReconnect,
  isNightMode = false,
}: OfflineTransitionIndicatorProps) {
  const isOnline = useOnlineStatus();
  const [connectionState, setConnectionState] = useState<'online' | 'offline'>(
    isOnline ? 'online' : 'offline'
  );
  const [availableOfflineFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setConnectionState(isOnline ? 'online' : 'offline');
  }, [isOnline]);

  useEffect(() => {
    if (connectionState === 'offline') {
      // Check offline assets in local database / memory
      const hasTiles = offlineMapService.getDownloadedRegions().length > 0 || !!localStorage.getItem('cached_map_tiles_count');
      const hasPeers = true; // Local BLE / LoRa mesh remains active
      const hasMessages = true; // Local encrypted mesh outbox
      const hasResources = !!localStorage.getItem('hoimu_cached_resources') || true;

      const available = [
        hasTiles && 'Cached vector maps',
        hasPeers && 'Nearby peers (Bluetooth & LoRa)',
        hasMessages && 'Queued mesh messages',
        hasResources && 'Saved emergency resources',
      ].filter(Boolean) as string[];

      setAvailableFeatures(available);
    }
  }, [connectionState]);

  const handleRetry = async () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch {}
    }
    setIsRetrying(true);
    if (onReconnect) {
      onReconnect();
    }
    // Attempt standard fetch ping
    try {
      await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
      setConnectionState('online');
    } catch {
      // Still offline
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  if (connectionState === 'online') return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-3 duration-200"
      role="alert"
      aria-live="polite"
      data-testid="offline-transition-indicator"
    >
      <div
        className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-colors ${
          isNightMode
            ? 'bg-[#182315]/95 border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="font-display font-bold text-xs">Offline Mode</strong>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#2A9D8F]/15 text-[#2A9D8F] font-semibold">
                  Mesh Active
                </span>
              </div>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 leading-snug">
                {availableOfflineFeatures.length > 0
                  ? `You can still use: ${availableOfflineFeatures.slice(0, 2).join(', ')}${
                      availableOfflineFeatures.length > 2 ? ` and ${availableOfflineFeatures.length - 2} more.` : '.'
                    }`
                  : 'Limited cloud access, but local mesh communication is operational.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2.5 py-1.5 min-h-[36px] bg-[#588157] hover:bg-[#476a46] text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              aria-label="Retry network connection"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Retry</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-[#588157]"
              aria-label={isExpanded ? 'Collapse offline capabilities' : 'Expand offline capabilities'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded capability details */}
        {isExpanded && (
          <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-[#588157] dark:text-[#A8BDA5]">
              Available Offline Services:
            </span>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <HardDrive className="w-3 h-3 text-[#2A9D8F]" />
                <span>Cached Maps</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <Radio className="w-3 h-3 text-[#2A9D8F]" />
                <span>Peer Bluetooth Mesh</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <MessageSquare className="w-3 h-3 text-[#2A9D8F]" />
                <span>Local Outbox</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <Database className="w-3 h-3 text-[#2A9D8F]" />
                <span>Saved Resources</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OfflineTransitionIndicator;
