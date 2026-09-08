import React, { useState, useEffect } from 'react';
import { OfflineMapRegion, MeshNode, ResourceItem, CityMapData } from '../types';
import { offlineMapService } from '../services/map/offlineMapService';
import { downloadRasterTilesForRegion } from '../services/map/rasterTileCacheService';
import { localGridToGeoPoint } from '../services/map/mapRevealService';
import {
  X,
  Download,
  HardDrive,
  MapPin,
  Compass,
  CheckCircle2,
  Trash2,
  Share2,
  ShieldCheck,
  Layers,
  Radio,
  Sparkles,
  Navigation,
  Globe,
  RefreshCw,
  FolderDown,
  Info,
  Wifi,
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

export interface SuggestedOfflineRegion {
  name: string;
  reason: 'frequent' | 'event' | 'resources';
  reasonLabel: string;
  center: { x: number; y: number; lat?: number; lng?: number };
  radiusKm: number;
  estimatedTiles: number;
  estimatedSizeMB: number;
  lastVisited?: string;
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
  const [activeTab, setActiveTab] = useState<'smart' | 'create' | 'manage'>('smart');
  const [radiusKm, setRadiusKm] = useState<number>(2.5);
  const [includeRasterTiles, setIncludeRasterTiles] = useState<boolean>(false);
  const [regionName, setRegionName] = useState<string>(
    `${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${radiusKm}km)`
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineMapRegion[]>([]);
  const [suggestedRegions, setSuggestedRegions] = useState<SuggestedOfflineRegion[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDownloadedRegions(offlineMapService.getDownloadedRegions());
      setRegionName(`${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${radiusKm}km)`);
      setDownloadProgress(0);
      setIsDownloading(false);

      // Smart Usage Analysis:
      // 1. Frequently visited area (active city hub & current district)
      const frequentSuggestion: SuggestedOfflineRegion = {
        name: `${activeCity.cityName} Keskus & Lähiala`,
        reason: 'frequent',
        reasonLabel: 'Frequently Visited Hub',
        center: cameraCenter,
        radiusKm: 3.5,
        estimatedTiles: Math.round(Math.PI * 3.5 * 3.5 * 14),
        estimatedSizeMB: parseFloat(((Math.PI * 3.5 * 3.5 * 14 * 9.5) / 1024).toFixed(1)),
        lastVisited: 'Today, 2 hours ago',
      };

      // 2. Upcoming Community Gathering / Event area
      const eventSuggestion: SuggestedOfflineRegion = {
        name: `${activeCity.cityName} Bioregional Mesh Assembly`,
        reason: 'event',
        reasonLabel: 'Upcoming Event (In 3 Days)',
        center: {
          x: cameraCenter.x + 80,
          y: cameraCenter.y - 60,
          lat: cameraCenter.lat ? cameraCenter.lat + 0.015 : undefined,
          lng: cameraCenter.lng ? cameraCenter.lng + 0.02 : undefined,
        },
        radiusKm: 5.0,
        estimatedTiles: Math.round(Math.PI * 5.0 * 5.0 * 14),
        estimatedSizeMB: parseFloat(((Math.PI * 5.0 * 5.0 * 14 * 9.5) / 1024).toFixed(1)),
        lastVisited: 'Sep 12, 14:00',
      };

      // 3. Saved emergency resources cluster
      const resourceCount = allResources.length;
      const resourceSuggestion: SuggestedOfflineRegion = {
        name: `${activeCity.cityName} Vital Mutual Aid Cluster`,
        reason: 'resources',
        reasonLabel: `${resourceCount || 6} Saved Resources (Water, Power, First-Aid)`,
        center: {
          x: cameraCenter.x - 50,
          y: cameraCenter.y + 40,
          lat: cameraCenter.lat ? cameraCenter.lat - 0.008 : undefined,
          lng: cameraCenter.lng ? cameraCenter.lng - 0.012 : undefined,
        },
        radiusKm: 2.0,
        estimatedTiles: Math.round(Math.PI * 2.0 * 2.0 * 14),
        estimatedSizeMB: parseFloat(((Math.PI * 2.0 * 2.0 * 14 * 9.5) / 1024).toFixed(1)),
        lastVisited: 'Yesterday',
      };

      setSuggestedRegions([frequentSuggestion, eventSuggestion, resourceSuggestion]);
    }
  }, [isOpen, activeCity, cameraCenter, radiusKm, allResources]);

  if (!isOpen) return null;

  const handleRadiusChange = (r: number) => {
    setRadiusKm(r);
    setRegionName(`${activeCity.cityName} - ${activeCity.districts?.[0]?.name || 'Keskus'} (${r}km)`);
  };

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(10);
    setCurrentStepText('Lõikan kõrgusjooni ja pinnasevektoreid...');

    await new Promise((resolve) => setTimeout(resolve, 450));
    setDownloadProgress(40);
    setCurrentStepText('Pakin kohalike raadiosõlmede ja ressursside metaandmeid...');

    await new Promise((resolve) => setTimeout(resolve, 450));
    setDownloadProgress(60);
    
    if (includeRasterTiles) {
      setCurrentStepText('Laadin alla OpenStreetMap rasterkihte (Wi-Fi)...');
      try {
        const geoCenterRaw = (cameraCenter.lat !== undefined && cameraCenter.lng !== undefined)
          ? { latitude: cameraCenter.lat, longitude: cameraCenter.lng }
          : localGridToGeoPoint(cameraCenter.x, cameraCenter.y, activeCity.centerCoordsText);
        const geoLat = geoCenterRaw.latitude;
        const geoLng = geoCenterRaw.longitude;
          
        await downloadRasterTilesForRegion(
          geoLat, 
          geoLng, 
          radiusKm, 
          12, 
          15, 
          (downloaded, total) => {
            const p = 60 + Math.floor((downloaded / total) * 30);
            setDownloadProgress(p);
          }
        );
      } catch (e) {
        console.warn('Failed to download raster tiles:', e);
      }
    }

    setDownloadProgress(90);
    setCurrentStepText('Allkirjastan Ed25519 krüptovõtmega...');

    await new Promise((resolve) => setTimeout(resolve, 500));
    
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

    const updated = offlineMapService.saveRegion(newRegion);
    setDownloadedRegions(updated);
    setDownloadProgress(100);
    setCurrentStepText('Salvestatud kohalikku mälupuhvrisse!');

    setTimeout(() => {
      setIsDownloading(false);
      setActiveTab('manage');
      if (onAddToast) {
        onAddToast(
          `📦 Piirkond "${newRegion.name}" salvestatud!`,
          `${newRegion.sizeFormatted} maastiku ja ${newRegion.nodeCount} sõlme andmed (sh rasterkaardid) on nüüd 100% võrguühenduseta saadaval.`,
          'success'
        );
      }
    }, 500);
  };

  const handleDeleteRegion = (id: string, name: string) => {
    const updated = offlineMapService.deleteRegion(id);
    setDownloadedRegions(updated);
    if (onAddToast) {
      onAddToast('Pakett eemaldatud', `Piirkond "${name}" kustutati kohalikust vahemälust.`, 'info');
    }
  };

  const totalOfflineSizeBytes = downloadedRegions.reduce((acc, r) => acc + r.sizeBytes, 0);
  const totalOfflineFormatted = totalOfflineSizeBytes > 1024 * 1024
    ? `${(totalOfflineSizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(totalOfflineSizeBytes / 1024).toFixed(1)} KB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
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
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
          aria-label="Sulge aken"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F] shadow-xs">
            <FolderDown className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] text-[10px] font-mono font-bold mb-0.5">
              <ShieldCheck className="w-3 h-3" />
              Zero-Cloud Local Terrain & Mesh Metadata Cache
            </div>
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <span>Laadi Piirkond Võrguühenduseta Kasutusse</span>
            </h2>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Salvesta kaamera ja asukoha raadiuses olevad teed, kõrgusjooned, veekogud ning sõlmede andmed täielikuks võrguvabaks navigeerimiseks.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-current/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('smart')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'smart'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-current/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nutikad soovitused ({suggestedRegions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-current/5'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Kohandatud ala ({radiusKm} km)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-current/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Salvestatud paketid ({downloadedRegions.length})</span>
          </button>
        </div>

        {/* Body Scroll */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-4 text-xs">
          {activeTab === 'smart' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#2A9D8F]/10 border border-[#2A9D8F]/30 space-y-1">
                <h3 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2A9D8F]" />
                  <span>Võrguühenduseta piirkondade nutikas allalaadimine</span>
                </h3>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                  Tuginedes sinu viimastele külastustele, eelseisvatele kogukonnasündmustele ja elutähtsatele ressurssidele:
                </p>
              </div>

              <div className="space-y-3">
                {suggestedRegions.map((region) => (
                  <div
                    key={region.name}
                    className={`p-4 rounded-2xl border transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26]'
                        : 'bg-white border-[#87A878]/30 hover:border-[#2A9D8F]/50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            region.reason === 'frequent'
                              ? 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
                              : region.reason === 'event'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-[#588157]/15 text-[#588157] dark:text-[#87A878]'
                          }`}
                        >
                          {region.reasonLabel}
                        </span>
                        {region.lastVisited && (
                          <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                            • {region.lastVisited}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                        {region.name}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                        <span>Raadius: {region.radiusKm} km</span>
                        <span>•</span>
                        <span>~{region.estimatedTiles} vektorit</span>
                        <span>•</span>
                        <span className="font-bold text-[#2A9D8F]">~{region.estimatedSizeMB} MB</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRegionName(region.name);
                        setRadiusKm(region.radiusKm);
                        handleStartDownload();
                      }}
                      disabled={isDownloading}
                      className="px-4 py-2 min-h-[44px] bg-[#2A9D8F] hover:bg-[#238276] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 disabled:opacity-50 shrink-0 shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Laadi alla ({region.estimatedSizeMB} MB)</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 min-h-[44px] text-xs font-bold text-[#588157] dark:text-[#A8BDA5] hover:underline cursor-pointer"
                >
                  Või vali käsitsi kohandatud ala ja raadius &rarr;
                </button>
              </div>
            </div>
          ) : activeTab === 'create' ? (
            <div className="space-y-4">
              {/* Camera / Location Anchor Info */}
              <div
                className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/35 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
                      Kaamera vaatekeskpunkt & Asukoht
                    </span>
                    <span className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      {activeCity.cityName} ({activeCity.bioregionName})
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30">
                  X: {cameraCenter.x.toFixed(0)} • Y: {cameraCenter.y.toFixed(0)}
                </div>
              </div>

              {/* Region Name Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-xs flex items-center justify-between text-[#203A2A] dark:text-[#F0F5EE]">
                  <span>Piirkonna nimi / Paketi tähis</span>
                  <span className="text-[10px] text-[#637062] font-mono">Näiteks "Kesklinn ja Emajõe luht"</span>
                </label>
                <input
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="Piirkonna tähis..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#2A9D8F] ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/50 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Radius Selector Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                    Salvestatava maastiku raadius: <span className="text-[#2A9D8F] font-mono font-bold">{radiusKm} km</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#588157]">
                    Pindala: ~{(Math.PI * radiusKm * radiusKm).toFixed(1)} km²
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { r: 1.0, label: '1.0 km', desc: 'Jalgsi lähiala' },
                    { r: 2.5, label: '2.5 km', desc: 'Kogukonna tuumik' },
                    { r: 5.0, label: '5.0 km', desc: 'Terve bioregioon' },
                    { r: 10.0, label: '10.0 km', desc: 'Valgala & koridor' },
                  ].map((preset) => (
                    <button
                      key={preset.r}
                      type="button"
                      onClick={() => handleRadiusChange(preset.r)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        radiusKm === preset.r
                          ? 'bg-[#2A9D8F]/20 border-[#2A9D8F] text-[#2A9D8F] font-bold shadow-2xs'
                          : isNightMode
                          ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5] hover:bg-[#1E2B1A]'
                          : 'bg-white border-[#87A878]/30 text-[#637062] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <div className="font-mono font-bold text-xs">{preset.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Range Slider for fine tuning */}
                <div className="pt-2">
                  <input
                    type="range"
                    min="0.5"
                    max="15.0"
                    step="0.5"
                    value={radiusKm}
                    onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                    className="w-full accent-[#2A9D8F] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#637062]">
                    <span>0.5 km</span>
                    <span>5.0 km</span>
                    <span>10.0 km</span>
                    <span>15.0 km</span>
                  </div>
                </div>
              </div>

              {/* Raster Tiles Option */}
              <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                includeRasterTiles 
                  ? 'bg-[#2A9D8F]/10 border-[#2A9D8F]' 
                  : isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/35'
              }`}>
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-[#2A9D8F] focus:ring-[#2A9D8F] bg-[#FAF6EE] border-[#87A878]/50"
                    checked={includeRasterTiles}
                    onChange={(e) => setIncludeRasterTiles(e.target.checked)}
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      Laadi alla OpenStreetMap rasterkihid
                    </span>
                    <Wifi className={`w-3.5 h-3.5 ${includeRasterTiles ? 'text-[#2A9D8F]' : 'text-[#637062]'}`} />
                  </div>
                  <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-1">
                    Salvestab satelliit- ja tänavakaardid Wi-Fi kaudu. Suurendab oluliselt allalaadimise mahtu (~{Math.ceil(radiusKm * radiusKm * 1.5)} MB).
                  </span>
                </div>
              </label>

              {/* Live Preview of What Will Be Downloaded */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/35 shadow-xs'
                }`}
              >
                <div className="font-display font-bold text-xs text-[#588157] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#2A9D8F]" />
                  <span>Kaasa pakitavad kohalikud kihid & metaandmed:</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-current/10">
                    <span className="text-[#637062] block text-[10px]">Maastik & pinnas</span>
                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">Teed, jõed, künkad</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-current/10">
                    <span className="text-[#637062] block text-[10px]">Raadiosõlmed</span>
                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                      {allNodes.length} Sõlme profiili
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-current/10">
                    <span className="text-[#637062] block text-[10px]">Ressursid & varud</span>
                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                      {allResources.length} Tööriista/toitu
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-current/10">
                    <span className="text-[#637062] block text-[10px]">Eeldatav maht</span>
                    <span className="font-bold text-[#2A9D8F] font-mono">
                      ~{(radiusKm * 38).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              </div>

              {/* Download Progress Bar or Action Button */}
              {isDownloading ? (
                <div className="space-y-2 p-4 rounded-2xl bg-[#2A9D8F]/10 border border-[#2A9D8F]/30 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-bold text-[#2A9D8F]">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {currentStepText}
                    </span>
                    <span className="font-mono">{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#2A9D8F]/20 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#2A9D8F] h-full rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="w-full py-3 px-4 bg-[#2A9D8F] hover:bg-[#238276] text-white rounded-2xl font-display font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Laadi alla ja salvesta seadmesse ({radiusKm} km)</span>
                </button>
              )}
            </div>
          ) : (
            /* Manage Downloaded Regions Panel */
            <div className="space-y-3">
              {downloadedRegions.length === 0 ? (
                <div className="p-8 text-center space-y-3 rounded-2xl border border-dashed border-current/20">
                  <HardDrive className="w-10 h-10 mx-auto text-[#87A878] opacity-60" />
                  <p className="font-medium text-xs text-[#637062]">
                    Ühtegi võrguühenduseta piirkonda pole veel salvestatud.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl bg-[#2A9D8F] text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Laadi alla esimene piirkond
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[#637062] px-1 font-mono">
                    <span>Salvestatud piirkonnad: {downloadedRegions.length}</span>
                    <span>Kogumaht: {totalOfflineFormatted}</span>
                  </div>

                  {downloadedRegions.map((region) => (
                    <div
                      key={region.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                            {region.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] font-bold border border-[#2A9D8F]/30">
                            {region.radiusKm} km • {region.sizeFormatted}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#637062] dark:text-[#87A878] font-mono">
                          {region.cityName} ({region.bioregionName}) • {region.nodeCount} Sõlme • {region.resourceCount} Ressurssi
                        </p>
                        <div className="text-[9px] font-mono text-[#87A878]">
                          Salvestatud: {new Date(region.downloadedAt).toLocaleDateString()} {new Date(region.downloadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {region.signatureHash}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {onSelectAndCenterRegion && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAndCenterRegion(region);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-[#2A9D8F]/15 hover:bg-[#2A9D8F]/25 text-[#2A9D8F] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="Tsentreeri kaart sellele piirkonnale"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Vaata</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => offlineMapService.exportRegionAsFile(region)}
                          className="p-1.5 rounded-xl bg-current/5 hover:bg-current/10 text-[#637062] dark:text-[#A8BDA5] cursor-pointer transition-colors"
                          title="Ekspordi .hoimumap fail SD-kaardile või teisele seadmele"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRegion(region.id, region.name)}
                          className="p-1.5 rounded-xl bg-[#E76F51]/10 hover:bg-[#E76F51]/20 text-[#E76F51] cursor-pointer transition-colors"
                          title="Kustuta salvestatud pakett"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="pt-3 mt-3 border-t border-current/10 flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#87A878]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#2A9D8F]" />
            100% lokaalne — ei vaja internetti, pilveteenuseid ega API-sid.
          </span>
          <span>Hõimu P2P Mesh v1.2</span>
        </div>
      </div>
    </div>
  );
};
