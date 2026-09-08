import React from 'react';
import { Compass, HelpCircle, RefreshCw, Radio, Cpu, Sparkles } from 'lucide-react';

interface MeshEmptyStateProps {
  isScanning?: boolean;
  onRefreshScan?: () => void;
  onStartExploring?: () => void;
  onOpenHowDiscoveryWorks?: () => void;
  onOpenPiBridge?: () => void;
  onDiscoverPeer?: () => void;
  isNightMode?: boolean;
}

export const MeshEmptyState: React.FC<MeshEmptyStateProps> = ({
  isScanning = false,
  onRefreshScan,
  onStartExploring,
  onOpenHowDiscoveryWorks,
  onOpenPiBridge,
  onDiscoverPeer,
  isNightMode = false,
}) => {
  return (
    <div
      role="region"
      aria-label="Listening for nearby devices"
      className={`p-8 rounded-3xl border text-center flex flex-col items-center justify-center my-4 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      <div className="relative mb-4">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${
            isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
          }`}
        >
          <Radio className="w-8 h-8 animate-pulse text-[#588157] dark:text-[#E9C46A]" />
        </div>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#588157] opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#588157]" />
        </span>
      </div>

      <h3 className="font-display font-bold text-lg mb-1.5">
        No nearby people found yet
      </h3>

      <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] max-w-sm mb-6 leading-relaxed">
        HÕIMU is listening for nearby devices. This can take a moment, and it also works without the internet.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {onStartExploring ? (
          <button
            type="button"
            onClick={onStartExploring}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A]'
                : 'bg-[#588157] hover:bg-[#466845] text-white shadow-xs'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Start exploring</span>
          </button>
        ) : (
          onRefreshScan && (
            <button
              type="button"
              onClick={onRefreshScan}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A]'
                  : 'bg-[#588157] hover:bg-[#466845] text-white shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Refresh radar scan</span>
            </button>
          )
        )}

        {onOpenPiBridge && (
          <button
            type="button"
            onClick={onOpenPiBridge}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs border transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'border-[#364E30] bg-[#121A10] text-[#F0F5EE]'
                : 'border-[#87A878]/40 bg-white text-[#203A2A]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#E76F51]" />
            <span>Connect home hub</span>
          </button>
        )}

        {onOpenHowDiscoveryWorks && (
          <button
            type="button"
            onClick={onOpenHowDiscoveryWorks}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-medium text-xs border transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'border-[#364E30] bg-[#121A10] text-[#A8BDA5] hover:text-white'
                : 'border-[#87A878]/40 bg-white text-[#637062] hover:text-[#203A2A]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#588157]" />
            <span>How discovery works</span>
          </button>
        )}

        {onDiscoverPeer && (
          <button
            type="button"
            onClick={onDiscoverPeer}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs text-[#588157] hover:underline cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#E9C46A]" />
            <span>Simulate Peer Beacon</span>
          </button>
        )}
      </div>
    </div>
  );
};


