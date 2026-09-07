// HÕIMU „Pathfinder Mode" – Kaasaskantavus, eetriardumine ja ellujääjate otsingud
// Modal & Control Center for Walk Tracking, Offline Wardriving, Deduping and Signal Surveying

import React, { useState, useEffect } from 'react';
import {
  Compass,
  Wifi,
  Bluetooth,
  Radio,
  Footprints,
  Play,
  Pause,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Clock,
  Navigation,
  MapPin,
  Layers,
  ChevronRight,
  Shield,
  Trash2,
  Plus,
  Activity,
  CheckCircle2,
  Flame,
  Search,
  Filter,
} from 'lucide-react';
import {
  WifiSpot,
  BluetoothSpot,
  LoraNode,
  WalkSession,
  GeoPoint,
  PathfinderFilter,
} from '../types';
import {
  pathfinderScanner,
  PathfinderActiveState,
} from '../services/scanner/pathfinderScanner';
import {
  initPathfinderDB,
  getLoadedPathfinderData,
  exportWalkSessionAsGPX,
  exportPathfinderAsGeoJSON,
  clearAllPathfinderData,
} from '../utils/pathfinderStorage';

interface PathfinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightMode?: boolean;
  onCenterMapOnLocation?: (lat: number, lon: number) => void;
  pathfinderFilter: PathfinderFilter;
  onUpdateFilter: (filter: PathfinderFilter) => void;
}

export const PathfinderModal: React.FC<PathfinderModalProps> = ({
  isOpen,
  onClose,
  isNightMode = false,
  onCenterMapOnLocation,
  pathfinderFilter,
  onUpdateFilter,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'signals' | 'history' | 'add'>('live');
  const [signalTypeFilter, setSignalTypeFilter] = useState<'all' | 'wifi' | 'ble' | 'lora'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Scanner state
  const [scannerState, setScannerState] = useState<PathfinderActiveState>(pathfinderScanner.getState());

  // Storage dataset
  const [wifiSpots, setWifiSpots] = useState<WifiSpot[]>([]);
  const [bleSpots, setBleSpots] = useState<BluetoothSpot[]>([]);
  const [loraNodes, setLoraNodes] = useState<LoraNode[]>([]);
  const [walkHistory, setWalkHistory] = useState<WalkSession[]>([]);

  // Manual entry form
  const [manualType, setManualType] = useState<'wifi' | 'ble' | 'lora'>('wifi');
  const [manualTitle, setManualTitle] = useState('');
  const [manualSub, setManualSub] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  // Subscribe to scanner
  useEffect(() => {
    const unsub = pathfinderScanner.subscribe((st) => {
      setScannerState(st);
      refreshData();
    });
    return unsub;
  }, []);

  const refreshData = async () => {
    const data = getLoadedPathfinderData();
    setWifiSpots(data.wifi);
    setBleSpots(data.ble);
    setLoraNodes(data.lora);
    setWalkHistory(data.walks);
  };

  useEffect(() => {
    if (isOpen) {
      initPathfinderDB().then((data) => {
        setWifiSpots(data.wifi);
        setBleSpots(data.ble);
        setLoraNodes(data.lora);
        setWalkHistory(data.walks);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartWalk = () => {
    pathfinderScanner.startWalkSession();
    refreshData();
  };

  const handlePauseWalk = () => {
    if (scannerState.isPaused) {
      pathfinderScanner.resumeWalkSession();
    } else {
      pathfinderScanner.pauseWalkSession();
    }
  };

  const handleStopWalk = async () => {
    await pathfinderScanner.stopAndSaveWalkSession();
    await refreshData();
  };

  const handleDownloadGPX = (session: WalkSession) => {
    const gpxText = exportWalkSessionAsGPX(session);
    const blob = new Blob([gpxText], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-walk-${session.id}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGeoJSON = () => {
    const geoText = exportPathfinderAsGeoJSON(walkHistory, wifiSpots, bleSpots, loraNodes);
    const blob = new Blob([geoText], { type: 'application/geo+json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-pathfinder-all-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle) return;

    if (manualType === 'wifi') {
      await pathfinderScanner.logManualDiscovery('wifi', {
        ssid: manualTitle,
        bssid: manualSub,
        notes: manualNotes,
      });
    } else if (manualType === 'ble') {
      await pathfinderScanner.logManualDiscovery('ble', {
        deviceName: manualTitle,
        address: manualSub,
        deviceClass: 'survivor_tag',
      });
    } else {
      await pathfinderScanner.logManualDiscovery('lora', {
        callsign: manualTitle,
        id: manualSub,
      });
    }

    setManualSuccessMsg('Uus raadiosõlm edukalt andmebaasi salvestatud!');
    setManualTitle('');
    setManualSub('');
    setManualNotes('');
    refreshData();
    setTimeout(() => setManualSuccessMsg(''), 3500);
  };

  // Filter signals list
  const activeWalkId = scannerState.activeSession?.id;

  const filteredWifi = wifiSpots.filter((w) => {
    if (pathfinderFilter.onlyNewDiscoveries && activeWalkId && w.walkSessionId !== activeWalkId) {
      return false;
    }
    if (searchQuery && !w.ssid.toLowerCase().includes(searchQuery.toLowerCase()) && !w.bssid.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredBle = bleSpots.filter((b) => {
    if (pathfinderFilter.onlyNewDiscoveries && activeWalkId && b.walkSessionId !== activeWalkId) {
      return false;
    }
    if (searchQuery && !b.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) && !b.address.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredLora = loraNodes.filter((l) => {
    if (pathfinderFilter.onlyNewDiscoveries && activeWalkId && l.walkSessionId !== activeWalkId) {
      return false;
    }
    if (searchQuery && !l.callsign.toLowerCase().includes(searchQuery.toLowerCase()) && !l.id.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isNightMode ? 'bg-[#141E12] border-[#2A3B26] text-[#F0F5EE]' : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-inherit flex flex-wrap items-center justify-between gap-3 bg-inherit">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E76F51] to-[#E9C46A] flex items-center justify-center text-white shadow-md">
              <Footprints className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-serif tracking-tight">
                  Pathfinder Mode
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E76F51]/20 text-[#E76F51] border border-[#E76F51]/30">
                  VÄLIOLEK & LEIU-RADAR
                </span>
              </div>
              <p className="text-xs text-[#588157] dark:text-[#A8BDA5]">
                Võrguühenduseta eetriardumine: WiFi võrgud, BLE majakad, LoRa kobarad ja GPS-rajad
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pathfinderScanner.toggleSound()}
              title={scannerState.soundEnabled ? 'Helisignaal sees' : 'Heli vaigistatud'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                scannerState.soundEnabled
                  ? 'bg-[#2A9D8F]/20 text-[#2A9D8F] border-[#2A9D8F]/40'
                  : 'bg-black/5 dark:bg-white/5 text-inherit border-transparent'
              }`}
            >
              {scannerState.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-current/20 hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs transition-all cursor-pointer"
            >
              Sulge
            </button>
          </div>
        </div>

        {/* ACTIVE SESSION STATUS BANNER */}
        <div
          className={`px-4 py-3 border-b border-inherit flex flex-wrap items-center justify-between gap-3 ${
            scannerState.isRecording
              ? scannerState.isPaused
                ? 'bg-[#E9C46A]/15 border-[#E9C46A]/30'
                : 'bg-[#2A9D8F]/15 border-[#2A9D8F]/30'
              : 'bg-black/5 dark:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                scannerState.isRecording
                  ? scannerState.isPaused
                    ? 'bg-[#E9C46A] animate-ping'
                    : 'bg-[#E76F51] animate-ping'
                  : 'bg-zinc-400'
              }`}
            />
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>
                  {scannerState.isRecording
                    ? scannerState.isPaused
                      ? 'Kõnniseanss PAUSIL'
                      : 'Kõnniseanss SALVESTAB REAALAJAS'
                    : 'Kõnniseanss ootel'}
                </span>
                {scannerState.isRecording && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDuration(scannerState.elapsedSeconds)}
                  </span>
                )}
              </div>
              <div className="text-[11px] opacity-80 flex items-center gap-3 font-mono">
                <span>Läbitud: <strong>{(scannerState.totalDistanceMeters / 1000).toFixed(2)} km</strong> ({scannerState.totalDistanceMeters} m)</span>
                <span>Trackpunkte: <strong>{scannerState.activeSession?.track.length || 0}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!scannerState.isRecording ? (
              <button
                type="button"
                onClick={handleStartWalk}
                className="px-4 py-1.5 rounded-xl bg-[#2A9D8F] hover:bg-[#2A9D8F]/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Alusta kõndi</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePauseWalk}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    scannerState.isPaused
                      ? 'bg-[#E9C46A] text-black border-[#E9C46A]'
                      : 'border-current/20 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {scannerState.isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{scannerState.isPaused ? 'Jätka' : 'Paus'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStopWalk}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E76F51] hover:bg-[#E76F51]/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Lõpeta & Salvesta</span>
                </button>
              </>
            )}

            {/* Simulated walk toggle for easy testing */}
            <button
              type="button"
              onClick={() => pathfinderScanner.toggleSimulatedWalk()}
              title="Kõnni simulaator: genereerib samm-sammult realistlikku GPS liikumist ja raadiosignaalide leide"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                scannerState.isSimulatingWalk
                  ? 'bg-[#E9C46A]/30 text-[#E9C46A] border-[#E9C46A]'
                  : 'border-current/20 hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulaator: {scannerState.isSimulatingWalk ? 'SEES' : 'VÄLJAS'}</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS & FILTER BAR */}
        <div className="px-4 py-2 border-b border-inherit flex flex-wrap items-center justify-between gap-2 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-[#203A2A] text-white dark:bg-[#FAF6EE] dark:text-[#203A2A] shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-inherit'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#E76F51]" />
              <span>Reaalajas Radar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('signals')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'signals'
                  ? 'bg-[#203A2A] text-white dark:bg-[#FAF6EE] dark:text-[#203A2A] shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-inherit'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Kõik Signaalid ({wifiSpots.length + bleSpots.length + loraNodes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-[#203A2A] text-white dark:bg-[#FAF6EE] dark:text-[#203A2A] shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-inherit'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Kõnniseansid ({walkHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'add'
                  ? 'bg-[#203A2A] text-white dark:bg-[#FAF6EE] dark:text-[#203A2A] shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-inherit'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Märgi leid</span>
            </button>
          </div>

          {/* DEDUPLICATION "AINULT UUED" TOGGLE */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateFilter({
                  ...pathfinderFilter,
                  onlyNewDiscoveries: !pathfinderFilter.onlyNewDiscoveries,
                })
              }
              title="Näita ainult uusi leide, mis eelmisel käigul puudusid (BSSID, MAC, LoRa ID unikaalsuse järgi)"
              className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                pathfinderFilter.onlyNewDiscoveries
                  ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] shadow-xs'
                  : 'border-current/20 hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ainult uued leiud: {pathfinderFilter.onlyNewDiscoveries ? 'SEES' : 'VÄLJAS'}</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: LIVE RADAR & NOVELTY MATRIX */}
          {activeTab === 'live' && (
            <div className="space-y-4 animate-fade-in">
              {/* NOVELTY STATS MATRIX */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#588157] dark:text-[#A8BDA5] mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5 text-[#2A9D8F]" /> WiFi võrgud
                    </span>
                    <span className="text-[10px] uppercase font-mono">BSSID</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#2A9D8F]">
                    {scannerState.newWifiCount}{' '}
                    <span className="text-xs font-sans font-normal opacity-70">uut / {wifiSpots.length} kokku</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#588157] dark:text-[#A8BDA5] mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <Bluetooth className="w-3.5 h-3.5 text-[#E76F51]" /> Bluetooth BLE
                    </span>
                    <span className="text-[10px] uppercase font-mono">MAC</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#E76F51]">
                    {scannerState.newBleCount}{' '}
                    <span className="text-xs font-sans font-normal opacity-70">uut / {bleSpots.length} kokku</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#588157] dark:text-[#A8BDA5] mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-[#E9C46A]" /> LoRa sõlmed
                    </span>
                    <span className="text-[10px] uppercase font-mono">868 MHz</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#E9C46A]">
                    {scannerState.newLoraCount}{' '}
                    <span className="text-xs font-sans font-normal opacity-70">uut / {loraNodes.length} kokku</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#588157] dark:text-[#A8BDA5] mb-1">
                    <span className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#588157]" /> Korduvad leidud
                    </span>
                    <span className="text-[10px] uppercase font-mono">DEDUP</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#588157]">
                    {scannerState.knownRepeatsCount}{' '}
                    <span className="text-xs font-sans font-normal opacity-70">tuntud seadet</span>
                  </div>
                </div>
              </div>

              {/* LIVE DISCOVERY STREAM */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#E76F51]" />
                    <span>Reaalajas leitud raadiosignaalid sellel käigul</span>
                  </h3>
                  <span className="text-xs text-[#588157] font-mono">
                    {scannerState.recentDiscoveries.length} signaali
                  </span>
                </div>

                {scannerState.recentDiscoveries.length === 0 ? (
                  <div className="p-6 text-center text-xs opacity-60 border border-dashed border-inherit rounded-xl">
                    <Navigation className="w-6 h-6 mx-auto mb-2 opacity-50 animate-bounce" />
                    Kõnniseansi ajal liigu ringi või lülita sisse simulaator. Kõik avastatud WiFi, BLE ja LoRa seadmed kuvatakse siia reaalajas.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {scannerState.recentDiscoveries.map((disc, idx) => (
                      <div
                        key={`${disc.id}_${idx}`}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          disc.isNew
                            ? 'bg-[#E9C46A]/15 border-[#E9C46A]/40'
                            : 'bg-black/[0.02] dark:bg-white/[0.02] border-inherit'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${
                              disc.type === 'wifi'
                                ? 'bg-[#2A9D8F]'
                                : disc.type === 'ble'
                                ? 'bg-[#E76F51]'
                                : 'bg-[#E9C46A]'
                            }`}
                          >
                            {disc.type === 'wifi' ? (
                              <Wifi className="w-3.5 h-3.5" />
                            ) : disc.type === 'ble' ? (
                              <Bluetooth className="w-3.5 h-3.5" />
                            ) : (
                              <Radio className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold truncate flex items-center gap-2">
                              <span>{disc.title}</span>
                              {disc.isNew && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#E76F51] text-white">
                                  UUS LEID
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] opacity-70 font-mono truncate">{disc.sub}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <div
                            className={`font-bold ${
                              disc.rssi >= -65
                                ? 'text-[#2A9D8F]'
                                : disc.rssi >= -80
                                ? 'text-[#E9C46A]'
                                : 'text-[#E76F51]'
                            }`}
                          >
                            {disc.rssi} dBm
                          </div>
                          <div className="text-[10px] opacity-60">
                            {new Date(disc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ALL DISCOVERED SIGNALS LIST */}
          {activeTab === 'signals' && (
            <div className="space-y-3 animate-fade-in">
              {/* Search and type filter */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSignalTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signalTypeFilter === 'all'
                        ? 'bg-[#203A2A] text-white dark:bg-[#FAF6EE] dark:text-[#203A2A]'
                        : 'border border-inherit'
                    }`}
                  >
                    Kõik ({wifiSpots.length + bleSpots.length + loraNodes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalTypeFilter('wifi')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signalTypeFilter === 'wifi'
                        ? 'bg-[#2A9D8F] text-white'
                        : 'border border-inherit'
                    }`}
                  >
                    WiFi ({wifiSpots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalTypeFilter('ble')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signalTypeFilter === 'ble'
                        ? 'bg-[#E76F51] text-white'
                        : 'border border-inherit'
                    }`}
                  >
                    BLE ({bleSpots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignalTypeFilter('lora')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      signalTypeFilter === 'lora'
                        ? 'bg-[#E9C46A] text-[#203A2A]'
                        : 'border border-inherit'
                    }`}
                  >
                    LoRa ({loraNodes.length})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 opacity-50" />
                  <input
                    type="text"
                    placeholder="Otsi nime või MAC järgi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-inherit bg-white dark:bg-[#182315] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Signals Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {/* WiFi Cards */}
                {(signalTypeFilter === 'all' || signalTypeFilter === 'wifi') &&
                  filteredWifi.map((w) => {
                    const isNewThisWalk = activeWalkId && w.walkSessionId === activeWalkId;
                    return (
                      <div
                        key={w.id}
                        className="p-3 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-[#2A9D8F] text-white flex items-center justify-center shrink-0">
                                <Wifi className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-xs truncate">{w.ssid}</span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                w.rssi >= -65 ? 'text-[#2A9D8F]' : w.rssi >= -80 ? 'text-[#E9C46A]' : 'text-[#E76F51]'
                              }`}
                            >
                              {w.rssi} dBm
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-[11px] font-mono opacity-80">
                            <div>BSSID: <strong className="text-inherit">{w.bssid}</strong></div>
                            <div className="flex items-center gap-2">
                              <span>Turve: {w.security.toUpperCase()}</span>
                              {w.channel && <span>Kanal: {w.channel}</span>}
                            </div>
                            {w.notes && <div className="text-[10px] italic text-[#588157] font-sans">{w.notes}</div>}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[10px] opacity-70">
                          <span>Esmalt nähtud: {new Date(w.firstSeenAt).toLocaleDateString()}</span>
                          {onCenterMapOnLocation && (
                            <button
                              type="button"
                              onClick={() => onCenterMapOnLocation(w.latitude, w.longitude)}
                              className="text-[#2A9D8F] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> Kaardil
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* BLE Cards */}
                {(signalTypeFilter === 'all' || signalTypeFilter === 'ble') &&
                  filteredBle.map((b) => {
                    return (
                      <div
                        key={b.id}
                        className="p-3 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-[#E76F51] text-white flex items-center justify-center shrink-0">
                                <Bluetooth className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-xs truncate">{b.deviceName}</span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                b.rssi >= -65 ? 'text-[#2A9D8F]' : b.rssi >= -80 ? 'text-[#E9C46A]' : 'text-[#E76F51]'
                              }`}
                            >
                              {b.rssi} dBm
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-[11px] font-mono opacity-80">
                            <div>MAC: <strong className="text-inherit">{b.address}</strong></div>
                            <div>Klass: {b.deviceClass || 'BLE Beacon'}</div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[10px] opacity-70">
                          <span>Viimati: {new Date(b.lastSeenAt).toLocaleDateString()}</span>
                          {onCenterMapOnLocation && (
                            <button
                              type="button"
                              onClick={() => onCenterMapOnLocation(b.latitude, b.longitude)}
                              className="text-[#E76F51] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> Kaardil
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* LoRa Cards */}
                {(signalTypeFilter === 'all' || signalTypeFilter === 'lora') &&
                  filteredLora.map((l) => {
                    return (
                      <div
                        key={l.id}
                        className="p-3 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-[#E9C46A] text-[#203A2A] flex items-center justify-center shrink-0 font-bold">
                                <Radio className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-xs truncate">{l.callsign}</span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                l.rssi >= -65 ? 'text-[#2A9D8F]' : l.rssi >= -80 ? 'text-[#E9C46A]' : 'text-[#E76F51]'
                              }`}
                            >
                              {l.rssi} dBm
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-[11px] font-mono opacity-80">
                            <div>Sagedus: {l.frequency} MHz • SNR: +{l.snr}dB</div>
                            <div>Relee: {l.isRepeater ? 'Aktiivne Mesh Repeater' : 'Lõppsõlm'}</div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-[10px] opacity-70">
                          <span>Heard: {new Date(l.lastHeardAt).toLocaleDateString()}</span>
                          {onCenterMapOnLocation && (
                            <button
                              type="button"
                              onClick={() => onCenterMapOnLocation(l.latitude, l.longitude)}
                              className="text-[#E9C46A] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> Kaardil
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: WALK SESSIONS HISTORY & EXPORT */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Salvestatud kõnniseansside arhiiv</h3>
                <button
                  type="button"
                  onClick={handleDownloadGeoJSON}
                  className="px-3 py-1 rounded-xl bg-[#2A9D8F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspordi GeoJSON</span>
                </button>
              </div>

              {walkHistory.length === 0 ? (
                <div className="p-8 text-center text-xs opacity-60 border border-dashed border-inherit rounded-2xl">
                  Salvestatud kõnniseansse veel pole. Alusta kõndi ja liigu ringi!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {walkHistory.map((session) => (
                    <div
                      key={session.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#182315] border border-inherit shadow-xs flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-xs">{session.title || 'Kõnniseanss'}</div>
                        <div className="text-[11px] opacity-70 font-mono mt-0.5">
                          {new Date(session.startedAt).toLocaleString('et-EE')} •{' '}
                          <strong>{((session.totalDistanceMeters || 0) / 1000).toFixed(2)} km</strong> •{' '}
                          {session.track.length} GPS punkti
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-[#2A9D8F]/15 text-[#2A9D8F] font-bold">
                            +{session.newWifiSpots.length} WiFi
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#E76F51]/15 text-[#E76F51] font-bold">
                            +{session.newBluetoothSpots.length} BLE
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#E9C46A]/20 text-[#E9C46A] font-bold">
                            +{session.newLoraNodes.length} LoRa
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadGPX(session)}
                          title="Laadi alla GPX 1.1 GPS fail"
                          className="px-2.5 py-1 rounded-xl border border-inherit text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>GPX</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MANUAL BEACON / NODE LOGGER */}
          {activeTab === 'add' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 animate-fade-in max-w-lg mx-auto">
              <div className="text-xs text-[#588157] dark:text-[#A8BDA5]">
                Märgi avastatud ellujääjate majakas, kogukonna pääsupunkt või LoRa relee praegusele GPS asukohale:
              </div>

              {manualSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{manualSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManualType('wifi')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    manualType === 'wifi' ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]' : 'border-inherit'
                  }`}
                >
                  WiFi Hotspot
                </button>
                <button
                  type="button"
                  onClick={() => setManualType('ble')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    manualType === 'ble' ? 'bg-[#E76F51] text-white border-[#E76F51]' : 'border-inherit'
                  }`}
                >
                  BLE Majakas
                </button>
                <button
                  type="button"
                  onClick={() => setManualType('lora')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    manualType === 'lora' ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A]' : 'border-inherit'
                  }`}
                >
                  LoRa Sõlm
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1">
                  {manualType === 'wifi' ? 'Võrgu SSID / Nimi' : manualType === 'ble' ? 'Seadme Nimi / Silt' : 'Kutsung (Callsign)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={manualType === 'wifi' ? 'nt Supilinn-Bunker-WLAN' : manualType === 'ble' ? 'nt HOIMU-Survivor-Beacon' : 'nt TARTU-RELAY-01'}
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-inherit bg-white dark:bg-[#182315] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1">
                  {manualType === 'wifi' ? 'BSSID (MAC-aadress)' : manualType === 'ble' ? 'MAC-aadress' : 'Sõlme ID'}
                </label>
                <input
                  type="text"
                  placeholder="nt DC:A6:32:88:1A:4C"
                  value={manualSub}
                  onChange={(e) => setManualSub(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-inherit bg-white dark:bg-[#182315] font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1">Märkmed / Kirjeldus</label>
                <textarea
                  rows={2}
                  placeholder="nt Toomemäe vaatetorni päikesepaneeliga majakas"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-inherit bg-white dark:bg-[#182315] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#203A2A] dark:bg-[#FAF6EE] text-white dark:text-[#203A2A] font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Salvesta võrguühenduseta andmebaasi
              </button>
            </form>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 sm:p-4 border-t border-inherit flex flex-wrap items-center justify-between gap-3 text-xs bg-inherit">
          <div className="flex items-center gap-2 font-mono text-[11px] opacity-75">
            <Shield className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Kõik andmed hoitakse kohalikus IndexedDB mälus. Täielik võrguvabadus.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Kas oled kindel, et soovid tühjendada kõik Pathfinder otsinguandmed?')) {
                  await clearAllPathfinderData();
                  await refreshData();
                }
              }}
              className="px-2.5 py-1 rounded-xl text-red-500 hover:bg-red-500/10 text-[11px] font-semibold transition-all cursor-pointer"
            >
              Lähtesta andmed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
