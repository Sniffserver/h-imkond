import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Trash2,
  Shield,
  Layers,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { MAP_PACK_MANIFESTS, MapPackManifest } from './MapPackManifest';
import { MapPackStatusService, MapPackStatusRecord } from './MapPackStatus';
import { MapPackInstaller } from './MapPackInstaller';

interface MapPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCityId?: string;
  isNightMode?: boolean;
}

export const MapPackModal: React.FC<MapPackModalProps> = ({
  isOpen,
  onClose,
  activeCityId = 'tallinn',
  isNightMode = false,
}) => {
  const [selectedPackId, setSelectedPackId] = useState<string>(activeCityId);
  const [statuses, setStatuses] = useState<Record<string, MapPackStatusRecord>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (activeCityId && MAP_PACK_MANIFESTS[activeCityId]) {
      setSelectedPackId(activeCityId);
    }
  }, [activeCityId]);

  useEffect(() => {
    const service = MapPackStatusService.getInstance();
    setStatuses(service.getAllStatuses());
    return service.subscribe(() => {
      setStatuses(service.getAllStatuses());
    });
  }, []);

  if (!isOpen) return null;

  const currentManifest: MapPackManifest = MAP_PACK_MANIFESTS[selectedPackId] || MAP_PACK_MANIFESTS.tallinn;
  const currentStatus: MapPackStatusRecord = statuses[selectedPackId] || {
    id: selectedPackId,
    version: currentManifest.version,
    routingSnapshotVersion: currentManifest.routingSnapshotVersion,
    state: 'available',
    progressPercent: 0,
    downloadedBytes: 0,
    totalBytes: currentManifest.sizeBytes,
    checksumVerified: false,
    storageType: 'cache_storage',
  };

  const handleInstall = async () => {
    setIsProcessing(true);
    await MapPackInstaller.install(selectedPackId);
    setIsProcessing(false);
  };

  const handleUninstall = async () => {
    setIsProcessing(true);
    await MapPackInstaller.uninstall(selectedPackId);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#364E30] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#87A878]/20 dark:border-[#364E30] flex items-center justify-between bg-white/50 dark:bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-[#588157]/15 dark:bg-[#8FA875]/15 text-[#588157] dark:text-[#E9C46A]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#203A2A] dark:text-[#E5EBDD]">
                HÕIMU Kaardipakid (PMTiles)
              </h2>
              <p className="text-xs text-[#637062] dark:text-[#95A18F]">
                100% Offline Vektorkaarid & ODbL OpenStreetMap Snapshot
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#637062] dark:text-[#95A18F] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* City Selector Pills */}
        <div className="px-6 py-3 border-b border-[#87A878]/15 dark:border-[#364E30] flex items-center gap-2 overflow-x-auto bg-black/5 dark:bg-white/5">
          {Object.values(MAP_PACK_MANIFESTS).map((pack) => {
            const isSelected = pack.id === selectedPackId;
            const packStatus = statuses[pack.id];
            const isInstalled = packStatus?.state === 'installed';

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPackId(pack.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#588157] text-white shadow-xs'
                    : 'bg-white dark:bg-[#1A2617] text-[#203A2A] dark:text-[#E5EBDD] border border-[#87A878]/20 hover:border-[#588157]'
                }`}
              >
                <span>{pack.name}</span>
                {isInstalled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
              </button>
            );
          })}
        </div>

        {/* Map Pack Details Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#87A878]/20 dark:border-[#364E30]">
            <div>
              <h3 className="font-display font-bold text-2xl text-[#203A2A] dark:text-[#E5EBDD]">
                {currentManifest.name}
              </h3>
              <p className="text-xs text-[#637062] dark:text-[#95A18F]">{currentManifest.region}</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
                currentStatus.state === 'installed'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              {currentStatus.state === 'installed' ? '● OFFLINE PAIGALDATUD' : '○ SAADAVAL'}
            </span>
          </div>

          {/* Feature Breakdown Checklist */}
          <div className="rounded-2xl bg-white dark:bg-[#172018] border border-[#87A878]/20 dark:border-[#334231] p-4 text-xs font-mono flex flex-col gap-2">
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Map data</span>
              <span className="font-bold text-[#203A2A] dark:text-[#E5EBDD]">{currentManifest.sizeFormatted}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Version</span>
              <span className="font-bold text-[#588157] dark:text-[#8FA875]">{currentManifest.version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Routing Graph</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Snapshot {currentManifest.routingSnapshotVersion} ✓</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Street labels (name:et)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Buildings & Heights</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[#637062] dark:text-[#95A18F]">Parks & Waterways</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#637062] dark:text-[#95A18F]">Offline Zero-Cloud</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
          </div>

          <p className="text-xs text-[#637062] dark:text-[#95A18F] leading-relaxed">
            {currentManifest.description}
          </p>

          {/* Attribution & Legal Notice */}
          <div className="text-[11px] text-[#637062] dark:text-[#95A18F] flex items-center justify-between border-t border-[#87A878]/20 dark:border-[#364E30] pt-2">
            <span>{currentManifest.attribution} ({currentManifest.license})</span>
            <span className="font-mono text-[10px]">SHA256: {currentManifest.sha256.slice(0, 10)}...</span>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="px-6 py-4 border-t border-[#87A878]/20 dark:border-[#364E30] bg-white/60 dark:bg-black/30 flex items-center justify-between gap-3">
          {currentStatus.state === 'installed' ? (
            <>
              <button
                type="button"
                onClick={handleUninstall}
                disabled={isProcessing}
                className="px-3.5 py-2.5 rounded-2xl border border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eemalda vahemälust</span>
              </button>

              <button
                type="button"
                onClick={handleInstall}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-2xl bg-[#588157] hover:bg-[#486d47] text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>UUENDA KAART ({currentManifest.version})</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              disabled={isProcessing}
              className="w-full py-3 rounded-2xl bg-[#588157] hover:bg-[#486d47] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
              <span>PAIGALDA KAARDIPAKK ({currentManifest.sizeFormatted})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
