import React, { useState, useEffect, useRef } from 'react';
import { OfflineMapRegion, MeshNode, ResourceItem, CityMapData } from '../types';
import { offlineMapService } from '../services/map/offlineMapService';
import { mapPackService, AVAILABLE_MAP_PACKS, MapPackMetadata } from '../services/map/mapPackService';
import {
  X,
  Download,
  HardDrive,
  MapPin,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Layers,
  Sparkles,
  RefreshCw,
  FolderDown,
  Info,
  UploadCloud,
  FileCheck,
  Zap,
} from 'lucide-react';

interface DownloadOfflineRegionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCity: CityMapData;
  cityId: string;
  cameraCenter: { x: number; y: number; lat?: number; lng?: number };
  allNodes: MeshNode[];
  allResources: ResourceItem[];
  userCallsign: string;
  isNightMode?: boolean;
  onSelectAndCenterRegion?: (region: OfflineMapRegion) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const DownloadOfflineRegionModal: React.FC<DownloadOfflineRegionModalProps> = ({
  isOpen,
  onClose,
  activeCity,
  cityId,
  cameraCenter,
  allNodes,
  allResources,
  userCallsign,
  isNightMode = false,
  onSelectAndCenterRegion,
  onAddToast,
}) => {
  const [activeTab, setActiveTab] = useState<'packs' | 'custom' | 'manage'>('packs');
  const [mapPacks, setMapPacks] = useState<MapPackMetadata[]>([]);
  const [installingCityId, setInstallingCityId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineMapRegion[]>([]);
  
  // Custom Sector Pack state
  const [radiusKm, setRadiusKm] = useState<number>(2.5);
  const [regionName, setRegionName] = useState<string>(
    `${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${radiusKm}km)`
  );
  const [isPackagingSector, setIsPackagingSector] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPacks = async () => {
    const packs = await mapPackService.getMapPackList();
    setMapPacks(packs);
    setDownloadedRegions(offlineMapService.getDownloadedRegions());
  };

  useEffect(() => {
    if (isOpen) {
      refreshPacks();
      setRegionName(`${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${radiusKm}km)`);
    }
  }, [isOpen, activeCity, radiusKm]);

  if (!isOpen) return null;

  const handleInstallMapPack = async (packCityId: string) => {
    const pack = AVAILABLE_MAP_PACKS[packCityId];
    if (!pack) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }

    setInstallingCityId(packCityId);
    setInstallProgress(5);

    try {
      await mapPackService.installMapPack(packCityId, (_received, _total, pct) => {
        setInstallProgress(Math.max(5, pct));
      });

      await refreshPacks();

      if (onAddToast) {
        onAddToast(
          `📦 ${pack.cityName} Kaardipakett paigaldatud!`,
          `${pack.fileName} (${pack.sizeFormatted}) on salvestatud. 100% võrguühenduseta vektorbaaskaart on aktiivne.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to install map pack:', err);
      if (onAddToast) {
        onAddToast('Viga paigaldamisel', 'Kaardipaketi salvestamine ebaõnnestus.', 'warning');
      }
    } finally {
      setInstallingCityId(null);
      setInstallProgress(0);
    }
  };

  const handleDeleteMapPack = async (packCityId: string, packName: string) => {
    await mapPackService.deleteMapPack(packCityId);
    await refreshPacks();
    if (onAddToast) {
      onAddToast('Pakett eemaldatud', `${packName} (.pmtiles) kustutati kohalikust seadmest.`, 'info');
    }
  };

  const handleImportLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setInstallingCityId(cityId);
      setInstallProgress(30);
      await mapPackService.importMapPackFile(cityId, file);
      setInstallProgress(100);
      await refreshPacks();

      if (onAddToast) {
        onAddToast(
          '📁 PMTiles Fail Imporditud',
          `Fail "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) seotud piirkonnaga ${activeCity.cityName}.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setInstallingCityId(null);
      setInstallProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateSectorPack = async () => {
    setIsPackagingSector(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const newRegion = offlineMapService.generateRegionPack({
      name: regionName,
      cityId,
      activeCity,
      center: cameraCenter,
      radiusKm,
      allNodes,
      allResources,
      userCallsign,
    });

    offlineMapService.saveRegion(newRegion);
    await refreshPacks();
    setIsPackagingSector(false);

    if (onAddToast) {
      onAddToast(
        `📍 Sektoripakett "${newRegion.name}" loodud`,
        `${newRegion.nodeCount} raadiosõlme ja ${newRegion.resourceCount} kriisiressursi metaandmed on salvestatud.`,
        'success'
      );
    }
    setActiveTab('manage');
  };

  const totalInstalledBytes = mapPacks
    .filter((p) => p.isInstalled)
    .reduce((acc, p) => acc + p.sizeBytes, 0);
  const totalFormatted = `${(totalInstalledBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden p-5 sm:p-6 transition-colors duration-200 max-h-[90vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="w-5 h-5 opacity-70 hover:opacity-100" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 pr-8">
          <div className="p-2.5 rounded-2xl bg-[#588157]/20 text-[#588157] dark:text-[#70E090]">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>Võrguühenduseta Kaardipaketid</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[#2A9D8F]/20 text-[#2A9D8F] dark:text-[#70E090] font-semibold">
                PMTiles Vector
              </span>
            </h2>
            <p className="text-xs opacity-75">
              1-faililised serverivabad vektorbaaskaardid. 100% OSM reeglitele vastav (0 paaniserveri koormust).
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-black/5 dark:bg-black/30 p-1 mb-5 border border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('packs')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'packs'
                ? isNightMode
                  ? 'bg-[#364E30] text-white shadow-sm'
                  : 'bg-white text-[#203A2A] shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <FolderDown className="w-4 h-4" />
            <span>Kaardipaketid (.pmtiles)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'custom'
                ? isNightMode
                  ? 'bg-[#364E30] text-white shadow-sm'
                  : 'bg-white text-[#203A2A] shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Taktikaline Sektor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'manage'
                ? isNightMode
                  ? 'bg-[#364E30] text-white shadow-sm'
                  : 'bg-white text-[#203A2A] shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Paigaldatud ({mapPacks.filter((p) => p.isInstalled).length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: PMTILES MAP PACKS */}
          {activeTab === 'packs' && (
            <div className="space-y-4">
              {/* Compliance Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-[#2A9D8F]/10 border border-[#2A9D8F]/30 text-xs flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#2A9D8F] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[#2A9D8F] dark:text-[#70E090]">
                    100% OpenStreetMap Foundation Poliitikale Vastav
                  </p>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    HÕIMU ei kraabi tuhandeid rasterfaile aadressilt <code>tile.openstreetmap.org</code>. Kaardid laaditakse ühe tervikliku <code>.pmtiles</code> arhiivina, mis tagab sujuva vektorsuumi (Z10-Z15+), eestikeelsed tänavanimed (<code>name:et</code>) ja 6 taktikalist teemat.
                  </p>
                </div>
              </div>

              {/* Map Packs Grid */}
              <div className="space-y-3">
                {mapPacks.map((pack) => {
                  const isCurrentCity = pack.cityId === cityId;
                  const isInstallingThis = installingCityId === pack.cityId;

                  return (
                    <div
                      key={pack.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        pack.isInstalled
                          ? 'bg-[#588157]/10 border-[#588157]/40'
                          : isCurrentCity
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-black/5 dark:bg-white/5 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{pack.cityName} Map Pack</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-black/10 dark:bg-white/10">
                              {pack.fileName}
                            </span>
                            {isCurrentCity && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-[#E76F51] text-white">
                                Aktiivne Piirkond
                              </span>
                            )}
                          </div>
                          <p className="text-xs opacity-80">{pack.description}</p>
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono opacity-70 pt-1">
                            <span>Maht: <strong>{pack.sizeFormatted}</strong></span>
                            <span>•</span>
                            <span>Suum: <strong>{pack.zoomLevels}</strong></span>
                            <span>•</span>
                            <span>Keeled: <strong>name:et, name</strong></span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          {pack.isInstalled ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#588157] dark:text-[#70E090] flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Paigaldatud
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteMapPack(pack.cityId, pack.cityName)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors cursor-pointer"
                                title="Kustuta kaardipakett seadmest"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isInstallingThis}
                              onClick={() => handleInstallMapPack(pack.cityId)}
                              className="px-3 py-1.5 rounded-xl bg-[#588157] hover:bg-[#466945] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                            >
                              {isInstallingThis ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>{installProgress}%</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Paigalda ({pack.sizeFormatted})</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar when installing */}
                      {isInstallingThis && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span>Salvestan IndexedDB mälupuhvrisse...</span>
                            <span>{installProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-[#588157] transition-all duration-200"
                              style={{ width: `${installProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Local File Import */}
              <div className="p-4 rounded-2xl border border-dashed border-black/20 dark:border-white/20 text-center space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pmtiles"
                  onChange={handleImportLocalFile}
                  className="hidden"
                />
                <UploadCloud className="w-6 h-6 mx-auto text-[#588157] dark:text-[#70E090]" />
                <p className="text-xs font-bold">Välitööde import (USB / SD-kaart ilma internetita)</p>
                <p className="text-[11px] opacity-75">
                  Lohista või vali kohalik <code>.pmtiles</code> arhiiv seadmest.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/15 text-xs font-bold transition-colors cursor-pointer"
                >
                  Vali .pmtiles fail
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM TACTICAL SECTOR */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  Lokaalne Sektoripakett (Mesh & Resources)
                </p>
                <p className="text-[11px] opacity-80">
                  Pakkib määratud raadiuses asuvad raadiosõlmed, koodnimed, kriisiressursid ja perimeetrid signeeritud offline-paketiks.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Paketi Nimetus</label>
                  <input
                    type="text"
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#588157]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Sektori Raadius</span>
                    <span className="font-mono text-[#588157]">{radiusKm} km</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1.0, 2.5, 5.0, 10.0].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRadiusKm(r);
                          setRegionName(`${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${r}km)`);
                        }}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          radiusKm === r
                            ? 'bg-[#588157] text-white'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'
                        }`}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPackagingSector}
                  onClick={handleCreateSectorPack}
                  className="w-full py-2.5 rounded-2xl bg-[#588157] hover:bg-[#466945] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isPackagingSector ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Allkirjastan sektoripaketti...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Salvesta Sektoripakett</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE INSTALLED */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-xs">
                <span>Võrguühenduseta mälumaht kokku:</span>
                <span className="font-bold font-mono text-[#588157] dark:text-[#70E090]">
                  {totalFormatted}
                </span>
              </div>

              {mapPacks.filter((p) => p.isInstalled).length === 0 && downloadedRegions.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-60">
                  <p>Ühtegi kaardipaketti pole veel paigaldatud.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mapPacks.filter((p) => p.isInstalled).map((pack) => (
                    <div
                      key={pack.id}
                      className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-[#588157]" />
                        <div>
                          <p className="font-bold">{pack.cityName} PMTiles Vector Pack</p>
                          <p className="text-[10px] opacity-70 font-mono">{pack.fileName} • {pack.sizeFormatted}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMapPack(pack.cityId, pack.cityName)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Kustuta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {downloadedRegions.map((region) => (
                    <div
                      key={region.id}
                      className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#2A9D8F]" />
                        <div>
                          <p className="font-bold">{region.name}</p>
                          <p className="text-[10px] opacity-70 font-mono">
                            {region.radiusKm} km • {region.nodeCount} sõlme • {region.resourceCount} ressurssi
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {onSelectAndCenterRegion && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAndCenterRegion(region);
                              onClose();
                            }}
                            className="px-2 py-1 rounded-lg bg-[#588157]/20 text-[#588157] text-[10px] font-bold cursor-pointer"
                          >
                            Ava Kaardil
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = offlineMapService.deleteRegion(region.id);
                            setDownloadedRegions(updated);
                          }}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex justify-between items-center text-[11px] opacity-70 font-mono">
          <span>HÕIMU Zero-Scraping Vector Standard</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/15 font-bold cursor-pointer"
          >
            Sulge
          </button>
        </div>
      </div>
    </div>
  );
};
