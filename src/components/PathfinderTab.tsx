import React, { useState, useEffect } from 'react';
import {
  Footprints,
  Radio,
  Wifi,
  Bluetooth,
  Play,
  Square,
  Pause,
  RotateCcw,
  Download,
  FileJson,
  MapPin,
  Sparkles,
  ShieldCheck,
  Compass,
  Database,
  ExternalLink,
  Volume2,
  VolumeX,
  Plus,
  RefreshCw,
  Search,
  Crosshair,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import {
  pathfinderScanner,
  PathfinderActiveState,
} from '../services/scanner/pathfinderScanner';
import {
  getLoadedPathfinderData,
  initPathfinderDB,
  exportWalkSessionAsGPX,
  exportPathfinderAsGeoJSON,
  exportPathfinderAsJSON,
  clearAllPathfinderData,
} from '../utils/pathfinderStorage';
import { WifiSpot, BluetoothSpot, LoraNode, WalkSession } from '../types';

interface PathfinderTabProps {
  isNightMode?: boolean;
  onNavigateToMapWithFilter?: (filterNewOnly: boolean) => void;
}

export const PathfinderTab: React.FC<PathfinderTabProps> = ({
  isNightMode = false,
  onNavigateToMapWithFilter,
}) => {
  const [scannerState, setScannerState] = useState<PathfinderActiveState>(
    pathfinderScanner.getState()
  );
  const [wifiSpots, setWifiSpots] = useState<WifiSpot[]>([]);
  const [bleSpots, setBleSpots] = useState<BluetoothSpot[]>([]);
  const [loraNodes, setLoraNodes] = useState<LoraNode[]>([]);
  const [walkHistory, setWalkHistory] = useState<WalkSession[]>([]);

  // Active filter within Pathfinder tab
  const [activeSignalTab, setActiveSignalTab] = useState<'all' | 'wifi' | 'ble' | 'lora'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyNewFilter, setOnlyNewFilter] = useState(false);

  // Completed Walk Summary State
  const [completedSummary, setCompletedSummary] = useState<{
    session: WalkSession;
    newWifi: number;
    newBle: number;
    newLora: number;
    distanceMeters: number;
    durationSecs: number;
  } | null>(null);

  // Manual Node Add Dialog State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'wifi' | 'ble' | 'lora'>('wifi');
  const [manualTitle, setManualTitle] = useState('');
  const [manualSub, setManualSub] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  const refreshData = async () => {
    const data = getLoadedPathfinderData();
    setWifiSpots(data.wifi);
    setBleSpots(data.ble);
    setLoraNodes(data.lora);
    setWalkHistory(data.walks);
  };

  useEffect(() => {
    initPathfinderDB().then((data) => {
      setWifiSpots(data.wifi);
      setBleSpots(data.ble);
      setLoraNodes(data.lora);
      setWalkHistory(data.walks);
    });

    const unsub = pathfinderScanner.subscribe((st) => {
      setScannerState(st);
      const data = getLoadedPathfinderData();
      setWifiSpots(data.wifi);
      setBleSpots(data.ble);
      setLoraNodes(data.lora);
      setWalkHistory(data.walks);
    });

    return unsub;
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartWalk = () => {
    setCompletedSummary(null);
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
    const active = scannerState.activeSession;
    if (active) {
      const summaryInfo = {
        session: { ...active },
        newWifi: scannerState.newWifiCount,
        newBle: scannerState.newBleCount,
        newLora: scannerState.newLoraCount,
        distanceMeters: scannerState.totalDistanceMeters,
        durationSecs: scannerState.durationSeconds,
      };
      setCompletedSummary(summaryInfo);
    }
    await pathfinderScanner.stopAndSaveWalkSession();
    await refreshData();
  };

  const handleExportJSON = (filterOnlyNew = false) => {
    const jsonStr = exportPathfinderAsJSON(walkHistory, wifiSpots, bleSpots, loraNodes, filterOnlyNew);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-wardrive-${filterOnlyNew ? 'new-discoveries' : 'all'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGPX = (session: WalkSession) => {
    const gpxStr = exportWalkSessionAsGPX(session);
    const blob = new Blob([gpxStr], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-walk-${session.id}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGeoJSON = () => {
    const geoStr = exportPathfinderAsGeoJSON(walkHistory, wifiSpots, bleSpots, loraNodes);
    const blob = new Blob([geoStr], { type: 'application/geo+json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-pathfinder-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewNewDiscoveriesOnMap = () => {
    if (onNavigateToMapWithFilter) {
      onNavigateToMapWithFilter(true);
    }
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

    setManualSuccessMsg('Uus raadiopunkt edukalt salvestatud IndexedDB andmebaasi!');
    setManualTitle('');
    setManualSub('');
    setManualNotes('');
    refreshData();
    setTimeout(() => {
      setManualSuccessMsg('');
      setIsManualModalOpen(false);
    }, 1800);
  };

  // Combine and filter discoveries
  const allFilteredSignals = [
    ...wifiSpots.map((w) => ({
      id: w.id,
      type: 'wifi' as const,
      title: w.ssid,
      sub: `BSSID: ${w.bssid} • Kanal ${w.channel || 'Auto'} • ${w.security?.toUpperCase()}`,
      rssi: w.rssi,
      isNew: scannerState.activeSession?.newWifiSpots.includes(w.id),
      timestamp: w.lastSeenAt,
    })),
    ...bleSpots.map((b) => ({
      id: b.id,
      type: 'ble' as const,
      title: b.deviceName,
      sub: `MAC: ${b.address} • ${b.deviceClass}`,
      rssi: b.rssi,
      isNew: scannerState.activeSession?.newBluetoothSpots.includes(b.id),
      timestamp: b.lastSeenAt,
    })),
    ...loraNodes.map((l) => ({
      id: l.id,
      type: 'lora' as const,
      title: l.callsign,
      sub: `Node ID: ${l.id} • ${l.frequency}MHz ${l.isRepeater ? '(Repiiter)' : ''}`,
      rssi: l.rssi,
      snr: l.snr,
      isNew: scannerState.activeSession?.newLoraNodes.includes(l.id),
      timestamp: l.lastHeardAt,
    })),
  ].filter((item) => {
    if (activeSignalTab !== 'all' && item.type !== activeSignalTab) return false;
    if (onlyNewFilter && !item.isNew) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E76F51]/15 text-[#E76F51] text-xs font-semibold border border-[#E76F51]/30 mb-1">
            <Footprints className="w-3.5 h-3.5" />
            Võrguotsing & Eetrirada • Pathfinder Mode
          </div>
          <h2
            className={`font-display font-bold text-2xl ${
              isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
            }`}
          >
            Wardriving, LoRa Otsing & Rajalogi
          </h2>
          <p className="text-xs text-[#588157]">
            Kaasaskantav RF-skanner tuvastab kõndimise ajal automaatselt ümbritsevad WiFi võrgud, Bluetooth majakad ja LoRa sõlmed ning talletab need võrguühenduseta IndexedDB-sse.
          </p>
        </div>

        {/* Global Export & Sound Toggle Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => pathfinderScanner.toggleSound()}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              scannerState.soundEnabled
                ? 'bg-[#E9C46A]/20 border-[#E9C46A] text-[#203A2A]'
                : isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#A8BDA5]'
                : 'bg-[#F0F5EE] border-[#87A878]/30 text-[#637062]'
            }`}
            title={scannerState.soundEnabled ? 'Helisignaalid sisse lülitatud' : 'Helisignaalid vaigistatud'}
          >
            {scannerState.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#588157]" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleExportJSON(false)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
            title="Ekspordi kõik salvestatud võrgud ja teekonnad JSON-failina"
          >
            <FileJson className="w-4 h-4 text-[#2A9D8F]" />
            <span>Ekspordi JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportGeoJSON}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
            title="Ekspordi GeoJSON kiht kaarditarkvarade jaoks"
          >
            <Download className="w-4 h-4 text-[#E76F51]" />
            <span>GeoJSON</span>
          </button>
        </div>
      </div>

      {/* Main Walk Controller Card */}
      <div
        className={`p-5 rounded-3xl border shadow-md relative overflow-hidden transition-all ${
          scannerState.isRecording
            ? 'bg-gradient-to-br from-[#203A2A] to-[#122218] border-[#E76F51] text-white'
            : isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        {/* Active Walk Pulsing Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                scannerState.isRecording
                  ? 'bg-[#E76F51] text-white shadow-lg animate-pulse'
                  : 'bg-[#588157]/20 text-[#588157]'
              }`}
            >
              <Footprints className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg">
                  {scannerState.isRecording
                    ? scannerState.activeSession?.title || 'Kõnniseanss käib'
                    : 'Pathfinder Režiim Ootel'}
                </h3>
                {scannerState.isRecording && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E76F51] text-white animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    LIVE REC
                  </span>
                )}
                {scannerState.isPaused && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E9C46A] text-[#203A2A]">
                    PAUSIL
                  </span>
                )}
              </div>
              <p className="text-xs opacity-75">
                {scannerState.isRecording
                  ? 'Kõik uued signaalid võrreldakse mälus olevatega ja lisatakse IndexedDB andmebaasi.'
                  : 'Vajuta „Alusta kõndi", et käivitada 5-sekundiline eetriskann ja GPS-teekonna salvestus.'}
              </p>
            </div>
          </div>

          {/* Big Walk Start / Pause / Stop Buttons */}
          <div className="flex items-center gap-2.5">
            {!scannerState.isRecording ? (
              <button
                type="button"
                id="btn-start-walk-large"
                onClick={handleStartWalk}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#E76F51] hover:bg-[#d45d3f] text-white font-display font-bold text-sm shadow-lg shadow-[#E76F51]/30 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Alusta kõndi</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePauseWalk}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#E9C46A] hover:bg-[#d8b359] text-[#203A2A] font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {scannerState.isPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Jätka</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Paus</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-stop-walk-large"
                  onClick={handleStopWalk}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#D62828] hover:bg-[#b52222] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Lõpeta ja Salvesta</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Real-time Counters Grid (Uued WiFi-d, BT-d, LoRa-d, Läbitud meetrid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Uued WiFi-d */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              scannerState.isRecording
                ? 'bg-white/10 border-white/15'
                : isNightMode
                ? 'bg-[#1A2617] border-[#2A3B26]'
                : 'bg-white border-[#87A878]/30 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold opacity-75 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-[#2A9D8F]" />
                Uued WiFi-d
              </span>
              <span className="w-2 h-2 rounded-full bg-[#2A9D8F]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono font-bold text-2xl text-[#2A9D8F]">
                {scannerState.isRecording ? scannerState.newWifiCount : wifiSpots.length}
              </span>
              <span className="text-[10px] opacity-60">
                {scannerState.isRecording ? `/ ${scannerState.knownBssidsCount} teada` : 'salvestatud'}
              </span>
            </div>
          </div>

          {/* 2. Uued Bluetooth seadmed */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              scannerState.isRecording
                ? 'bg-white/10 border-white/15'
                : isNightMode
                ? 'bg-[#1A2617] border-[#2A3B26]'
                : 'bg-white border-[#87A878]/30 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold opacity-75 flex items-center gap-1.5">
                <Bluetooth className="w-3.5 h-3.5 text-[#3A86FF]" />
                Uued BT-d
              </span>
              <span className="w-2 h-2 rounded-full bg-[#3A86FF]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono font-bold text-2xl text-[#3A86FF]">
                {scannerState.isRecording ? scannerState.newBleCount : bleSpots.length}
              </span>
              <span className="text-[10px] opacity-60">
                {scannerState.isRecording ? `/ ${scannerState.knownMacsCount} teada` : 'salvestatud'}
              </span>
            </div>
          </div>

          {/* 3. Uued LoRa sõlmed */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              scannerState.isRecording
                ? 'bg-white/10 border-white/15'
                : isNightMode
                ? 'bg-[#1A2617] border-[#2A3B26]'
                : 'bg-white border-[#87A878]/30 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold opacity-75 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#E76F51]" />
                Uued LoRa-d
              </span>
              <span className="w-2 h-2 rounded-full bg-[#E76F51]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono font-bold text-2xl text-[#E76F51]">
                {scannerState.isRecording ? scannerState.newLoraCount : loraNodes.length}
              </span>
              <span className="text-[10px] opacity-60">
                {scannerState.isRecording ? `/ ${scannerState.knownLoraIdsCount} teada` : 'salvestatud'}
              </span>
            </div>
          </div>

          {/* 4. Läbitud meetrid & Kestus */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              scannerState.isRecording
                ? 'bg-white/10 border-white/15'
                : isNightMode
                ? 'bg-[#1A2617] border-[#2A3B26]'
                : 'bg-white border-[#87A878]/30 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold opacity-75 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E9C46A]" />
                Läbitud teekond
              </span>
              <span className="font-mono text-[10px] text-[#E9C46A]">
                {formatDuration(scannerState.durationSeconds)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono font-bold text-2xl text-[#E9C46A]">
                {scannerState.totalDistanceMeters >= 1000
                  ? `${(scannerState.totalDistanceMeters / 1000).toFixed(2)} km`
                  : `${scannerState.totalDistanceMeters} m`}
              </span>
              <span className="text-[10px] opacity-60">
                {scannerState.activeSession?.track.length || 0} GPS punkti
              </span>
            </div>
          </div>
        </div>

        {/* GPS Live Status & Walk Simulation Control Strip */}
        <div className="mt-4 pt-4 border-t border-current/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#588157] animate-ping" />
            <span className="font-mono opacity-80">
              GPS: {scannerState.currentLocation?.lat.toFixed(5)}°,{' '}
              {scannerState.currentLocation?.lng.toFixed(5)}°
            </span>
            <span className="text-[10px] opacity-60">
              ({scannerState.isSimulatingWalk ? 'Simuleeritud rada' : 'Seadme GPS'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pathfinderScanner.toggleWalkSimulation()}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                scannerState.isSimulatingWalk
                  ? 'bg-[#E76F51]/20 border-[#E76F51] text-[#E76F51]'
                  : 'border-current/20 hover:bg-black/5'
              }`}
            >
              {scannerState.isSimulatingWalk ? '✓ Kõnnisimulatsioon Aktiivne' : 'Käivita Kõnnisimulatsioon'}
            </button>

            {scannerState.hasWebBluetooth && (
              <button
                type="button"
                onClick={() => pathfinderScanner.scanRealWebBluetoothDevice()}
                disabled={scannerState.isWebBluetoothScanning}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#3A86FF]/20 border border-[#3A86FF] text-[#3A86FF] hover:bg-[#3A86FF]/30 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Bluetooth className="w-3 h-3" />
                <span>{scannerState.isWebBluetoothScanning ? 'Otsib...' : 'Web BLE Otsing'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold border border-current/20 hover:bg-black/5 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Lisa Käsitsi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Walk Completed Summary Card (If finished) */}
      {completedSummary && (
        <div
          id="walk-completed-summary-card"
          className="p-5 rounded-3xl bg-[#2A9D8F]/15 border-2 border-[#2A9D8F] shadow-lg space-y-4 animate-in zoom-in-95 duration-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#2A9D8F] text-white flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-[#203A2A] dark:text-white">
                  Kõnd edukalt lõpetatud ja salvestatud!
                </h3>
                <p className="text-xs text-[#588157]">
                  Kõik uued raadiopunktid on lisatud IndexedDB (`hoimu_wardrive`) andmebaasi.
                </p>
              </div>
            </div>

            {/* Actions: View New on Map & Export JSON */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-view-new-on-map"
                onClick={handleViewNewDiscoveriesOnMap}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2A9D8F] hover:bg-[#238276] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Crosshair className="w-4 h-4" />
                <span>Vaata uusi leide kaardil</span>
              </button>

              <button
                type="button"
                id="btn-export-walk-json"
                onClick={() => handleExportJSON(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E9C46A] hover:bg-[#d8b359] text-[#203A2A] font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <FileJson className="w-4 h-4" />
                <span>Ekspordi uued (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportGPX(completedSummary.session)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-[#2A9D8F] text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>GPX</span>
              </button>
            </div>
          </div>

          {/* Quick Stat Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#2A9D8F]/30">
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A2617] border border-[#2A9D8F]/30">
              <span className="text-[10px] text-[#637062] block">Uued WiFi-d</span>
              <span className="font-mono font-bold text-lg text-[#2A9D8F]">
                +{completedSummary.newWifi} tk
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A2617] border border-[#2A9D8F]/30">
              <span className="text-[10px] text-[#637062] block">Uued Bluetooth-d</span>
              <span className="font-mono font-bold text-lg text-[#3A86FF]">
                +{completedSummary.newBle} tk
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A2617] border border-[#2A9D8F]/30">
              <span className="text-[10px] text-[#637062] block">Uued LoRa sõlmed</span>
              <span className="font-mono font-bold text-lg text-[#E76F51]">
                +{completedSummary.newLora} tk
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-[#1A2617] border border-[#2A9D8F]/30">
              <span className="text-[10px] text-[#637062] block">Läbitud vahemaa</span>
              <span className="font-mono font-bold text-lg text-[#E9C46A]">
                {completedSummary.distanceMeters} m ({formatDuration(completedSummary.durationSecs)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for Signals */}
      <div
        className={`p-4 rounded-3xl border shadow-xs space-y-3 transition-colors ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveSignalTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSignalTab === 'all'
                  ? 'bg-[#588157] text-white shadow-xs'
                  : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              Kõik ({allFilteredSignals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSignalTab('wifi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSignalTab === 'wifi'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>WiFi ({wifiSpots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSignalTab('ble')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSignalTab === 'ble'
                  ? 'bg-[#3A86FF] text-white shadow-xs'
                  : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>BLE ({bleSpots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSignalTab('lora')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSignalTab === 'lora'
                  ? 'bg-[#E76F51] text-white shadow-xs'
                  : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>LoRa ({loraNodes.length})</span>
            </button>
          </div>

          {/* Only New Toggle */}
          <button
            type="button"
            onClick={() => setOnlyNewFilter(!onlyNewFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              onlyNewFilter
                ? 'bg-[#E9C46A] border-[#E9C46A] text-[#203A2A]'
                : 'border-current/20 hover:bg-black/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ainult Uued Leiud</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Otsi võrgu nime, MAC-aadressi või LoRa ID järgi..."
            className={`w-full pl-10 pr-4 py-2 rounded-2xl text-xs border outline-none transition-colors ${
              isNightMode
                ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE] focus:border-[#87A878]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
            }`}
          />
        </div>
      </div>

      {/* Signals Discovery List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[#588157] uppercase tracking-wider">
            Tuvastatud Signaalid & Seadmed ({allFilteredSignals.length})
          </span>
          <span className="text-[11px] opacity-60">IndexedDB: hoimu_wardrive</span>
        </div>

        {allFilteredSignals.length === 0 ? (
          <div
            className={`p-8 text-center rounded-3xl border ${
              isNightMode ? 'bg-[#223120] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/30'
            }`}
          >
            <Radio className="w-10 h-10 mx-auto text-[#87A878] opacity-50 mb-2" />
            <p className="text-sm font-bold">Signaale ei leitud</p>
            <p className="text-xs opacity-75 mt-1">
              Alusta kõndi või eemalda otsingufiltrid, et näha skaneeritud raadioseadmeid.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allFilteredSignals.map((sig) => (
              <div
                key={sig.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  sig.isNew
                    ? 'border-[#E9C46A] bg-[#E9C46A]/10 shadow-xs'
                    : isNightMode
                    ? 'bg-[#1E2C1C] border-[#2A3B26]'
                    : 'bg-white border-[#87A878]/30 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      sig.type === 'wifi'
                        ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]'
                        : sig.type === 'ble'
                        ? 'bg-[#3A86FF]/20 text-[#3A86FF]'
                        : 'bg-[#E76F51]/20 text-[#E76F51]'
                    }`}
                  >
                    {sig.type === 'wifi' ? (
                      <Wifi className="w-4 h-4" />
                    ) : sig.type === 'ble' ? (
                      <Bluetooth className="w-4 h-4" />
                    ) : (
                      <Radio className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs truncate">{sig.title}</span>
                      {sig.isNew && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#E9C46A] text-[#203A2A] rounded-full animate-pulse">
                          UUS
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 truncate mt-0.5">{sig.sub}</p>
                    <span className="text-[10px] opacity-50 block mt-1">
                      Viimati nähtud: {new Date(sig.timestamp).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* RSSI Badge */}
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                      sig.rssi > -65
                        ? 'bg-[#588157]/20 text-[#588157]'
                        : sig.rssi > -80
                        ? 'bg-[#E9C46A]/20 text-[#d48b11]'
                        : 'bg-[#E76F51]/20 text-[#E76F51]'
                    }`}
                  >
                    {sig.rssi} dBm
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isNightMode ? 'bg-[#1A2617] border-[#2A3B26] text-[#F0F5EE]' : 'bg-[#FAF6EE] border-[#87A878] text-[#203A2A]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Lisa Raadiopunkt Käsitsi</h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                Sulge ✕
              </button>
            </div>

            {manualSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-[#588157]/20 border border-[#588157] text-[#588157] text-xs font-bold text-center">
                ✓ {manualSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="flex gap-2">
                  {(['wifi', 'ble', 'lora'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setManualType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border capitalize transition-colors ${
                        manualType === t
                          ? 'bg-[#203A2A] text-white border-[#203A2A]'
                          : 'border-current/20 hover:bg-black/5'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-semibold opacity-75 block mb-1">
                    {manualType === 'wifi' ? 'SSID Võrgunimi' : manualType === 'ble' ? 'Seadme Nimi' : 'LoRa Kutsung'}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder={manualType === 'wifi' ? 'nt. Emajoe-Solar-AP' : manualType === 'ble' ? 'nt. Survivor-Tag-04' : 'nt. TOOME-RELAY-01'}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none bg-white/80 dark:bg-black/30 border-current/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold opacity-75 block mb-1">
                    {manualType === 'wifi' ? 'BSSID (MAC aadress)' : manualType === 'ble' ? 'MAC Aadress' : 'Node ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={manualSub}
                    onChange={(e) => setManualSub(e.target.value)}
                    placeholder={manualType === 'lora' ? 'nt. lora_node_toome_09' : 'nt. DC:A6:32:88:1A:4C'}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none bg-white/80 dark:bg-black/30 border-current/20 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold opacity-75 block mb-1">Märkmed / Kirjeldus</label>
                  <textarea
                    rows={2}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Päikesetoitega ruuter, Toomemäe vaatetorn, jne..."
                    className="w-full px-3.5 py-2 rounded-xl border text-xs outline-none bg-white/80 dark:bg-black/30 border-current/20"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-current/20 text-xs font-bold"
                  >
                    Tühista
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#588157] text-white text-xs font-bold shadow-md hover:bg-[#466845]"
                  >
                    Salvesta Raadiopunkt
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
