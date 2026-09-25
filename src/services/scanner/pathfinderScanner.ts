// HÕIMU Pathfinder Mode: Real-time Field Scanner, GPS Tracker & Wardriving Engine
// Handles live walk recording, step updates, RF signal detection, deduplication, and sound feedback

import { GeoPoint, WifiSpot, BluetoothSpot, LoraNode, WalkSession } from '../../types';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorBridge } from '../comms/capacitorBridge';
import {
  recordWifiSpot,
  recordBluetoothSpot,
  recordLoraNode,
  saveWalkSession,
  calculateTrackDistanceMeters,
  getLoadedPathfinderData,
} from '../../utils/pathfinderStorage';
import { backgroundSyncAdjuster } from '../mesh/backgroundSyncAdjuster';
import { ESTONIA_CITY_DEFAULTS } from '../../geo';

/**
 * Uute leidude tuvastamise funktsioonid (Novelty detection)
 * Võrdleb tuvastatud identifikaatorit mälus oleva Set-kogumiga
 */
export function isNewWifi(spot: { bssid: string }, knownBssids: Set<string>): boolean {
  return !knownBssids.has(spot.bssid.trim().toUpperCase());
}

export function isNewBluetooth(spot: { address: string }, knownMacs: Set<string>): boolean {
  return !knownMacs.has(spot.address.trim().toUpperCase());
}

export function isNewLora(node: { id: string }, knownLoraIds: Set<string>): boolean {
  return !knownLoraIds.has(node.id.trim());
}

export interface PathfinderActiveState {
  isRecording: boolean;
  isPaused: boolean;
  activeSession: WalkSession | null;
  currentLocation: GeoPoint | null;
  totalDistanceMeters: number;
  elapsedSeconds: number;
  durationSeconds?: number;
  newWifiCount: number;
  newBleCount: number;
  newLoraCount: number;
  knownRepeatsCount: number;
  knownBssidsCount: number;
  knownMacsCount: number;
  knownLoraIdsCount: number;
  recentDiscoveries: Array<{
    id: string;
    type: 'wifi' | 'ble' | 'lora';
    title: string;
    sub: string;
    rssi: number;
    isNew: boolean;
    timestamp: number;
  }>;
  isSimulatingWalk: boolean;
  soundEnabled: boolean;
  hasWebBluetooth: boolean;
  hasWebSerial: boolean;
  isWebBluetoothScanning: boolean;
}

type PathfinderListener = (state: PathfinderActiveState) => void;

class PathfinderScannerService {
  private listeners: Set<PathfinderListener> = new Set();
  private geoWatchId: number | null = null;
  private timerInterval: any = null;
  private simWalkInterval: any = null;
  private rfPulseInterval: any = null;
  private audioCtx: AudioContext | null = null;

  // In-memory sets of known hardware identifiers loaded at session start
  private knownBssids: Set<string> = new Set();
  private knownMacs: Set<string> = new Set();
  private knownLoraIds: Set<string> = new Set();

  private state: PathfinderActiveState = {
    isRecording: false,
    isPaused: false,
    activeSession: null,
    currentLocation: {
      lat: ESTONIA_CITY_DEFAULTS.tallinn.lat,
      lng: ESTONIA_CITY_DEFAULTS.tallinn.lng,
      timestamp: Date.now(),
    },
    totalDistanceMeters: 0,
    elapsedSeconds: 0,
    newWifiCount: 0,
    newBleCount: 0,
    newLoraCount: 0,
    knownRepeatsCount: 0,
    knownBssidsCount: 0,
    knownMacsCount: 0,
    knownLoraIdsCount: 0,
    recentDiscoveries: [],
    isSimulatingWalk: false,
    soundEnabled: true,
    hasWebBluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    hasWebSerial: typeof navigator !== 'undefined' && 'serial' in (navigator as any),
    isWebBluetoothScanning: false,
  };

  private capacitorWatchId: string | null = null;

  constructor() {
    // Try Capacitor Geolocation first for native mobile support, fallback to HTML5 Geolocation
    if (typeof window !== 'undefined') {
      Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 })
        .then((pos) => {
          this.state.currentLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp || Date.now(),
          };
          this.notify();
        })
        .catch(() => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                this.state.currentLocation = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  altitude: pos.coords.altitude || undefined,
                  accuracy: pos.coords.accuracy || undefined,
                  timestamp: pos.timestamp || Date.now(),
                };
                this.notify();
              },
              () => {},
              { enableHighAccuracy: true, timeout: 5000 }
            );
          }
        });
    }
  }

  public subscribe(listener: PathfinderListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  public getState(): PathfinderActiveState {
    return { ...this.state };
  }

  public toggleSound(enabled?: boolean) {
    this.state.soundEnabled = enabled !== undefined ? enabled : !this.state.soundEnabled;
    this.notify();
  }

  private playDiscoveryChime(isNew: boolean) {
    if (!this.state.soundEnabled || typeof window === 'undefined') return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (isNew) {
        // High sparkling bell chime for brand new discovery (C6 -> G6)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, now); // C6
        osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12); // G6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Subtle soft blip for known repeats
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Audio autoplay policy notice
    }
  }

  /**
   * Start a brand new Walk Session.
   * Iga kõnniseansi alguses laaditakse kõik varasemad seadmete identifikaatorid
   * (knownBssids, knownMacs, knownLoraIds) mällu Set-kogumitesse.
   */
  public startWalkSession(customTitle?: string): WalkSession {
    const sessionId = `walk_${Date.now()}`;
    const startLoc = this.state.currentLocation || {
      latitude: ESTONIA_CITY_DEFAULTS.tallinn.lat,
      longitude: ESTONIA_CITY_DEFAULTS.tallinn.lng,
      timestamp: Date.now(),
    };

    // 1. Laadi kõik varasemad seadmete identifikaatorid mällu
    const existingData = getLoadedPathfinderData();
    this.knownBssids = new Set(existingData.wifi.map((w) => w.bssid.trim().toUpperCase()));
    this.knownMacs = new Set(existingData.ble.map((b) => b.address.trim().toUpperCase()));
    this.knownLoraIds = new Set(existingData.lora.map((l) => l.id.trim()));

    const newSession: WalkSession = {
      id: sessionId,
      title: customTitle || `Kõnd ${new Date().toLocaleDateString('et-EE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      startedAt: Date.now(),
      endedAt: Date.now(),
      totalDistanceMeters: 0,
      track: [{ ...startLoc }],
      newWifiSpots: [],
      newBluetoothSpots: [],
      newLoraNodes: [],
    };

    this.state = {
      ...this.state,
      isRecording: true,
      isPaused: false,
      activeSession: newSession,
      totalDistanceMeters: 0,
      elapsedSeconds: 0,
      newWifiCount: 0,
      newBleCount: 0,
      newLoraCount: 0,
      knownRepeatsCount: 0,
      knownBssidsCount: this.knownBssids.size,
      knownMacsCount: this.knownMacs.size,
      knownLoraIdsCount: this.knownLoraIds.size,
      recentDiscoveries: [],
    };

    this.startWatchPosition();
    this.startTimer();
    this.startRfWardriveSweeper();
    this.notify();

    return newSession;
  }

  /**
   * Pause the active recording
   */
  public pauseWalkSession() {
    if (!this.state.isRecording) return;
    this.state.isPaused = true;
    this.stopTimer();
    this.notify();
  }

  /**
   * Resume the paused recording
   */
  public resumeWalkSession() {
    if (!this.state.isRecording || !this.state.isPaused) return;
    this.state.isPaused = false;
    this.startTimer();
    this.notify();
  }

  /**
   * Stop recording, compute totals, and permanently save to IndexedDB
   */
  public async stopAndSaveWalkSession(): Promise<WalkSession | null> {
    if (!this.state.activeSession) return null;

    this.stopWatchPosition();
    this.stopTimer();
    this.stopSimulatedWalk();
    this.stopRfWardriveSweeper();

    const finalizedSession: WalkSession = {
      ...this.state.activeSession,
      endedAt: Date.now(),
      totalDistanceMeters: calculateTrackDistanceMeters(this.state.activeSession.track),
    };

    await saveWalkSession(finalizedSession);

    this.state = {
      ...this.state,
      isRecording: false,
      isPaused: false,
      activeSession: finalizedSession,
    };
    this.notify();

    return finalizedSession;
  }

  private startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.state.isRecording && !this.state.isPaused) {
        this.state.elapsedSeconds += 1;
        this.notify();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async startWatchPosition() {
    if (typeof window === 'undefined') return;
    this.stopWatchPosition();

    try {
      this.capacitorWatchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (pos, err) => {
          if (err || !pos) return;
          if (!this.state.isRecording || this.state.isPaused) return;
          this.addGpsBreadcrumb({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude || undefined,
            accuracy: pos.coords.accuracy || undefined,
            timestamp: pos.timestamp || Date.now(),
          });
        }
      );
    } catch (e) {
      if (navigator.geolocation) {
        this.geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!this.state.isRecording || this.state.isPaused) return;
            this.addGpsBreadcrumb({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || undefined,
              accuracy: pos.coords.accuracy || undefined,
              timestamp: pos.timestamp || Date.now(),
            });
          },
          (err) => {
            console.warn('[Pathfinder] Geolocation watch notice:', err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 10000,
          }
        );
      }
    }
  }

  private stopWatchPosition() {
    if (this.capacitorWatchId !== null) {
      Geolocation.clearWatch({ id: this.capacitorWatchId }).catch(() => {});
      this.capacitorWatchId = null;
    }
    if (this.geoWatchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  /**
   * Add a GPS position to the active track and check distance
   */
  public addGpsBreadcrumb(point: GeoPoint) {
    this.state.currentLocation = point;

    if (this.state.activeSession && this.state.isRecording && !this.state.isPaused) {
      const track = [...this.state.activeSession.track];
      // Only append if moved at least 2 meters or 5 seconds passed
      const last = track[track.length - 1];
      if (last) {
        const dist = calculateTrackDistanceMeters([last, point]);
        if (dist > 1.5 || point.timestamp - last.timestamp > 7000) {
          track.push(point);
          const totalDist = calculateTrackDistanceMeters(track);
          this.state.activeSession.track = track;
          this.state.totalDistanceMeters = totalDist;
          this.state.activeSession.totalDistanceMeters = totalDist;
        }
      } else {
        track.push(point);
        this.state.activeSession.track = track;
      }
    }

    this.notify();
  }

  /**
   * Field Walk Simulator (for desktop/indoor testing and offline walk emulation)
   */
  public toggleSimulatedWalk(enable?: boolean) {
    const shouldSimulate = enable !== undefined ? enable : !this.state.isSimulatingWalk;
    this.state.isSimulatingWalk = shouldSimulate;

    if (shouldSimulate) {
      this.startSimulatedWalk();
    } else {
      this.stopSimulatedWalk();
    }
    this.notify();
  }

  public toggleWalkSimulation(enable?: boolean) {
    this.toggleSimulatedWalk(enable);
  }

  private startSimulatedWalk() {
    this.stopSimulatedWalk();
    let angle = Math.random() * Math.PI * 2;
    let speed = 0.00006; // approx 4.5 km/h step delta

    this.simWalkInterval = setInterval(() => {
      if (!this.state.isRecording || this.state.isPaused) return;

      const curr = this.state.currentLocation || {
        lat: ESTONIA_CITY_DEFAULTS.tallinn.lat,
        lng: ESTONIA_CITY_DEFAULTS.tallinn.lng,
        timestamp: Date.now(),
      };

      // Gentle random turn
      angle += (Math.random() - 0.5) * 0.4;
      const nextLat = curr.lat + Math.cos(angle) * speed;
      const nextLon = curr.lng + (Math.sin(angle) * speed) / Math.cos((curr.lat * Math.PI) / 180);

      const nextPoint: GeoPoint = {
        lat: nextLat,
        lng: nextLon,
      };

      this.addGpsBreadcrumb(nextPoint);
    }, 2500);
  }

  private stopSimulatedWalk() {
    if (this.simWalkInterval) {
      clearInterval(this.simWalkInterval);
      this.simWalkInterval = null;
    }
  }

  /**
   * Periodic wardriving sweeper that detects nearby ambient WiFi, Bluetooth, and LoRa signals.
   * SPETSIFIKATSIOON:
   * Iga 5 sekundi järel genereeri 0–3 uut WiFi-võrku, 0–2 Bluetooth-seadet, 0–1 LoRa-sõlm.
   * Kasuta juhuslikke nimesid ja MAC-e, asukohaks praegune GPS-positsioon + väike juhuslik nihe.
   */
  private startRfWardriveSweeper() {
    this.stopRfWardriveSweeper();
    // Dynamically adjust beacon wardrive sweeper interval based on battery state
    const isLowBattery = backgroundSyncAdjuster.getState().isLowBattery;
    const sweeperIntervalMs = isLowBattery ? 45000 : 5000;

    this.rfPulseInterval = setInterval(async () => {
      if (!this.state.isRecording || this.state.isPaused) return;

      const loc = this.state.currentLocation;
      if (!loc) return;

      if (CapacitorBridge.isNativeEnvironment()) {
        // Real WiFi Scanning (Android Native)
        try {
          const networks = await CapacitorBridge.scanWifiNetworks();
          for (const net of networks) {
            await this.processDiscoveredWifi(net, loc);
          }
        } catch (e) {
          console.error('[Pathfinder] Native Wi-Fi scan failed in sweeper:', e);
        }

        // Real BLE Scanning (Android Native)
        try {
          const bleDevices = await CapacitorBridge.discoverBleDevices();
          for (const dev of bleDevices) {
            await this.processDiscoveredBle(dev, loc);
          }
        } catch (e) {
          console.error('[Pathfinder] Native BLE scan failed in sweeper:', e);
        }
      } else {
        // Simulated scans for desktop fallback
        // 1. WiFi: 0–3 võrku
        const numWifi = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
        for (let i = 0; i < numWifi; i++) {
          await this.simulateNearbyWifi(loc);
        }

        // 2. Bluetooth: 0–2 seadet
        const numBle = Math.floor(Math.random() * 3); // 0, 1, or 2
        for (let i = 0; i < numBle; i++) {
          await this.simulateNearbyBle(loc);
        }
      }

      // 3. LoRa: 0–1 sõlme (Simulate LoRa node because SPI chip requires physical UART or SPI wrapper)
      const numLora = Math.floor(Math.random() * 2); // 0 or 1
      for (let i = 0; i < numLora; i++) {
        await this.simulateNearbyLora(loc);
      }
    }, sweeperIntervalMs); // Dynamically throttled when battery is < 15%
  }

  private async processDiscoveredWifi(net: any, loc: GeoPoint) {
    const activeSessionId = this.state.activeSession?.id;
    const bssid = net.bssid.trim().toUpperCase();
    const isNew = isNewWifi({ bssid }, this.knownBssids);

    const { spot } = await recordWifiSpot(
      {
        ssid: net.ssid || 'Unknown AP',
        bssid,
        rssi: net.rssi || -75,
        security: net.capabilities && net.capabilities.toLowerCase().includes('wpa') ? 'wpa2' : 'open',
        latitude: loc.latitude,
        longitude: loc.longitude,
        walkSessionId: activeSessionId || 'scan',
        channel: net.frequency ? Math.floor((net.frequency - 2407) / 5) : 6,
      },
      activeSessionId
    );

    if (isNew) {
      this.knownBssids.add(bssid);
      this.state.knownBssidsCount = this.knownBssids.size;

      if (this.state.activeSession) {
        this.state.activeSession.newWifiSpots.push(spot.id);
        this.state.newWifiCount = this.state.activeSession.newWifiSpots.length;
      }
    } else {
      this.state.knownRepeatsCount += 1;
    }

    this.addRecentDiscovery({
      id: spot.id,
      type: 'wifi',
      title: spot.ssid,
      sub: `PÄRIS BSSID: ${spot.bssid} • ${spot.security.toUpperCase()}`,
      rssi: spot.rssi,
      isNew,
      timestamp: Date.now(),
    });

    this.playDiscoveryChime(isNew);
    this.notify();
  }

  private async processDiscoveredBle(dev: any, loc: GeoPoint) {
    const activeSessionId = this.state.activeSession?.id;
    const address = dev.id.trim().toUpperCase();
    const isNew = isNewBluetooth({ address }, this.knownMacs);

    const { spot } = await recordBluetoothSpot(
      {
        deviceName: dev.name || 'Unknown BLE Device',
        address,
        rssi: dev.rssi || -80,
        deviceClass: dev.name && dev.name.toLowerCase().includes('sensor') ? 'sensor' : 'beacon',
        latitude: loc.latitude,
        longitude: loc.longitude,
        walkSessionId: activeSessionId || 'scan',
        txPower: -4,
        isMeshNode: dev.name && dev.name.toLowerCase().includes('hoimu'),
      },
      activeSessionId
    );

    if (isNew) {
      this.knownMacs.add(address);
      this.state.knownMacsCount = this.knownMacs.size;

      if (this.state.activeSession) {
        this.state.activeSession.newBluetoothSpots.push(spot.id);
        this.state.newBleCount = this.state.activeSession.newBluetoothSpots.length;
      }
    } else {
      this.state.knownRepeatsCount += 1;
    }

    this.addRecentDiscovery({
      id: spot.id,
      type: 'ble',
      title: spot.deviceName,
      sub: `PÄRIS MAC: ${spot.address}`,
      rssi: spot.rssi,
      isNew,
      timestamp: Date.now(),
    });

    this.playDiscoveryChime(isNew);
    this.notify();
  }

  private stopRfWardriveSweeper() {
    if (this.rfPulseInterval) {
      clearInterval(this.rfPulseInterval);
      this.rfPulseInterval = null;
    }
  }

  private async simulateNearbyWifi(loc: GeoPoint) {
    const activeSessionId = this.state.activeSession?.id;
    const wifiPool = [
      { ssid: 'HOIMU-Mesh-Node-Emajogi', prefix: 'B8:27:EB', sec: 'open' as const },
      { ssid: 'Karlova-Kogukond-SolarNet', prefix: '00:1A:79', sec: 'wpa2' as const },
      { ssid: 'Supilinn-Bunker-WLAN', prefix: '70:4F:57', sec: 'wpa3' as const },
      { ssid: 'Tartu-Kriisiabi-Hotspot', prefix: 'DC:A6:32', sec: 'open' as const },
      { ssid: 'Telia-4G-OffGrid-Backup', prefix: '44:94:FC', sec: 'wpa2' as const },
      { ssid: 'Emajoe-Veevaatlus-AP', prefix: 'B4:E6:2D', sec: 'wpa2' as const },
      { ssid: 'Raadi-Kasvuhoone-IoT', prefix: '18:FE:34', sec: 'open' as const },
      { ssid: 'Tammelinn-Solar-Microgrid', prefix: 'AC:84:C6', sec: 'wpa2' as const },
      { ssid: 'HOIMU-Relay-Kivilinna', prefix: 'E8:68:E7', sec: 'open' as const },
    ];

    const pick = wifiPool[Math.floor(Math.random() * wifiPool.length)];
    // Settle BSSID either as known repeat or brand new
    const isGeneratingRepeat = Math.random() > 0.5 && this.knownBssids.size > 0;
    let bssid: string;

    if (isGeneratingRepeat) {
      const knownArr = Array.from(this.knownBssids);
      bssid = knownArr[Math.floor(Math.random() * knownArr.length)];
    } else {
      const subMac = `${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`;
      bssid = `${pick.prefix}:${subMac}`;
    }

    const rssi = -Math.floor(45 + Math.random() * 45); // -45 to -90 dBm
    const offsetLat = (Math.random() - 0.5) * 0.0004;
    const offsetLon = (Math.random() - 0.5) * 0.0006;

    // Kontrolli uudsust: isNewWifi
    const isNew = isNewWifi({ bssid }, this.knownBssids);

    const { spot } = await recordWifiSpot(
      {
        ssid: pick.ssid,
        bssid,
        rssi,
        security: pick.sec,
        latitude: loc.latitude + offsetLat,
        longitude: loc.longitude + offsetLon,
        walkSessionId: activeSessionId || 'scan',
        channel: Math.floor(Math.random() * 11) + 1,
      },
      activeSessionId
    );

    if (isNew) {
      // Lisatakse mällu, et sama seansi sees ei loetaks seda uuesti uueks
      this.knownBssids.add(bssid.trim().toUpperCase());
      this.state.knownBssidsCount = this.knownBssids.size;

      if (this.state.activeSession) {
        this.state.activeSession.newWifiSpots.push(spot.id);
        this.state.newWifiCount = this.state.activeSession.newWifiSpots.length;
      }
    } else {
      this.state.knownRepeatsCount += 1;
    }

    this.addRecentDiscovery({
      id: spot.id,
      type: 'wifi',
      title: spot.ssid,
      sub: `BSSID: ${spot.bssid} • ${spot.security.toUpperCase()}`,
      rssi: spot.rssi,
      isNew,
      timestamp: Date.now(),
    });

    this.playDiscoveryChime(isNew);
    this.notify();
  }

  private async simulateNearbyBle(loc: GeoPoint) {
    const activeSessionId = this.state.activeSession?.id;
    const blePool = [
      { name: 'HOIMU-Survivor-Pebble-Tag', dclass: 'survivor_tag' },
      { name: 'Garmin-Solar-Watch-Sensor', dclass: 'sensor' },
      { name: 'Nordic-BLE-P2P-Mesh', dclass: 'beacon' },
      { name: 'Emajogi-Water-Level-Probe', dclass: 'sensor' },
      { name: 'SolarInverter-Victron-BLE', dclass: 'sensor' },
      { name: 'Android-Mesh-Kin-Direct', dclass: 'telefon' },
      { name: 'Ellujääja-Raadiomajakas-09', dclass: 'survivor_tag' },
    ];

    const pick = blePool[Math.floor(Math.random() * blePool.length)];
    const isGeneratingRepeat = Math.random() > 0.5 && this.knownMacs.size > 0;
    let mac: string;

    if (isGeneratingRepeat) {
      const knownArr = Array.from(this.knownMacs);
      mac = knownArr[Math.floor(Math.random() * knownArr.length)];
    } else {
      mac = `F4:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:9A`;
    }

    const rssi = -Math.floor(50 + Math.random() * 42);
    const offsetLat = (Math.random() - 0.5) * 0.0003;
    const offsetLon = (Math.random() - 0.5) * 0.0005;

    // Kontrolli uudsust: isNewBluetooth
    const isNew = isNewBluetooth({ address: mac }, this.knownMacs);

    const { spot } = await recordBluetoothSpot(
      {
        deviceName: pick.name,
        address: mac,
        rssi,
        deviceClass: pick.dclass,
        latitude: loc.latitude + offsetLat,
        longitude: loc.longitude + offsetLon,
        walkSessionId: activeSessionId || 'scan',
        txPower: -4,
        isMeshNode: pick.name.includes('HOIMU'),
      },
      activeSessionId
    );

    if (isNew) {
      this.knownMacs.add(mac.trim().toUpperCase());
      this.state.knownMacsCount = this.knownMacs.size;

      if (this.state.activeSession) {
        this.state.activeSession.newBluetoothSpots.push(spot.id);
        this.state.newBleCount = this.state.activeSession.newBluetoothSpots.length;
      }
    } else {
      this.state.knownRepeatsCount += 1;
    }

    this.addRecentDiscovery({
      id: spot.id,
      type: 'ble',
      title: spot.deviceName,
      sub: `MAC: ${spot.address} • ${spot.deviceClass || 'BLE'}`,
      rssi: spot.rssi,
      isNew,
      timestamp: Date.now(),
    });

    this.playDiscoveryChime(isNew);
    this.notify();
  }

  private async simulateNearbyLora(loc: GeoPoint) {
    const activeSessionId = this.state.activeSession?.id;
    const loraPool = [
      { id: 'lora_node_supilinn_04', callsign: 'SUPILINN-PUMP-868', freq: 868.1, rep: false },
      { id: 'lora_node_toome_05', callsign: 'TOOME-VAATETORN-REP', freq: 868.3, rep: true },
      { id: 'lora_node_raadi_06', callsign: 'RAADI-KASVUMAJAND', freq: 868.1, rep: false },
      { id: 'lora_node_emajogi_07', callsign: 'LODJAKODA-RELAY-07', freq: 868.5, rep: true },
      { id: 'lora_node_tamme_08', callsign: 'TAMME-VEEKOGU-NODE', freq: 868.3, rep: false },
    ];

    const pick = loraPool[Math.floor(Math.random() * loraPool.length)];
    const isGeneratingRepeat = Math.random() > 0.5 && this.knownLoraIds.size > 0;
    let nodeId: string;

    if (isGeneratingRepeat) {
      const knownArr = Array.from(this.knownLoraIds);
      nodeId = knownArr[Math.floor(Math.random() * knownArr.length)];
    } else {
      nodeId = pick.id;
    }

    const rssi = -Math.floor(60 + Math.random() * 35);
    const snr = parseFloat((Math.random() * 12 + 1).toFixed(1));

    const offsetLat = (Math.random() - 0.5) * 0.0005;
    const offsetLon = (Math.random() - 0.5) * 0.0008;

    // Kontrolli uudsust: isNewLora
    const isNew = isNewLora({ id: nodeId }, this.knownLoraIds);

    const { node } = await recordLoraNode(
      {
        id: nodeId,
        callsign: pick.callsign,
        rssi,
        snr,
        frequency: pick.freq,
        latitude: loc.latitude + offsetLat,
        longitude: loc.longitude + offsetLon,
        walkSessionId: activeSessionId || 'scan',
        isRepeater: pick.rep,
        batteryPercent: Math.floor(75 + Math.random() * 25),
      },
      activeSessionId
    );

    if (isNew) {
      this.knownLoraIds.add(nodeId.trim());
      this.state.knownLoraIdsCount = this.knownLoraIds.size;

      if (this.state.activeSession) {
        this.state.activeSession.newLoraNodes.push(node.id);
        this.state.newLoraCount = this.state.activeSession.newLoraNodes.length;
      }
    } else {
      this.state.knownRepeatsCount += 1;
    }

    this.addRecentDiscovery({
      id: node.id,
      type: 'lora',
      title: node.callsign,
      sub: `Freq: ${node.frequency}MHz • SNR: +${node.snr}dB`,
      rssi: node.rssi,
      isNew,
      timestamp: Date.now(),
    });

    this.playDiscoveryChime(isNew);
    this.notify();
  }

  /**
   * Scan for real Web Bluetooth devices if supported by browser
   */
  public async scanRealWebBluetoothDevice(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return false;
    }

    try {
      this.state.isWebBluetoothScanning = true;
      this.notify();

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service', 'device_information'],
      });

      if (device) {
        const loc = this.state.currentLocation || {
          latitude: ESTONIA_CITY_DEFAULTS.tallinn.lat,
          longitude: ESTONIA_CITY_DEFAULTS.tallinn.lng,
          timestamp: Date.now(),
        };

        const mac = device.id.slice(0, 17) || `BT:${Math.random().toString(16).substr(2, 6).toUpperCase()}`;
        const isNew = isNewBluetooth({ address: mac }, this.knownMacs);

        const { spot } = await recordBluetoothSpot(
          {
            deviceName: device.name || 'Web Bluetooth Seade',
            address: mac,
            rssi: -55,
            deviceClass: 'beacon',
            latitude: loc.latitude,
            longitude: loc.longitude,
            walkSessionId: this.state.activeSession?.id || 'web_bluetooth',
            isMeshNode: false,
          },
          this.state.activeSession?.id
        );

        if (isNew) {
          this.knownMacs.add(mac.trim().toUpperCase());
          if (this.state.activeSession) {
            this.state.activeSession.newBluetoothSpots.push(spot.id);
            this.state.newBleCount = this.state.activeSession.newBluetoothSpots.length;
          }
        }

        this.addRecentDiscovery({
          id: spot.id,
          type: 'ble',
          title: spot.deviceName,
          sub: `PÄRIS Web Bluetooth • MAC: ${spot.address}`,
          rssi: spot.rssi,
          isNew,
          timestamp: Date.now(),
        });

        this.playDiscoveryChime(isNew);
        this.notify();
        return true;
      }
    } catch (e) {
      console.warn('[Pathfinder] Web Bluetooth prompt cancelled or unsupported:', e);
    } finally {
      this.state.isWebBluetoothScanning = false;
      this.notify();
    }
    return false;
  }

  private addRecentDiscovery(discovery: PathfinderActiveState['recentDiscoveries'][0]) {
    this.state.recentDiscoveries = [discovery, ...this.state.recentDiscoveries.slice(0, 24)];
  }

  /**
   * Manual entry for survivor tag, beacon, or discovered WiFi hotspot
   */
  public async logManualDiscovery(
    type: 'wifi' | 'ble' | 'lora',
    data: any
  ): Promise<boolean> {
    const loc = this.state.currentLocation || {
      latitude: ESTONIA_CITY_DEFAULTS.tallinn.lat,
      longitude: ESTONIA_CITY_DEFAULTS.tallinn.lng,
      timestamp: Date.now(),
    };
    const activeSessionId = this.state.activeSession?.id;

    if (type === 'wifi') {
      const { spot, isNew } = await recordWifiSpot(
        {
          ssid: data.ssid || 'Käsitsi lisatud WiFi',
          bssid: data.bssid || `MAN:${Math.random().toString(16).substr(2, 6).toUpperCase()}`,
          rssi: data.rssi || -65,
          security: data.security || 'open',
          latitude: data.latitude || loc.latitude,
          longitude: data.longitude || loc.longitude,
          walkSessionId: activeSessionId || 'manual',
          notes: data.notes,
        },
        activeSessionId
      );

      if (isNew && this.state.activeSession) {
        this.state.activeSession.newWifiSpots.push(spot.id);
        this.state.newWifiCount = this.state.activeSession.newWifiSpots.length;
      }

      this.addRecentDiscovery({
        id: spot.id,
        type: 'wifi',
        title: spot.ssid,
        sub: `BSSID: ${spot.bssid}`,
        rssi: spot.rssi,
        isNew,
        timestamp: Date.now(),
      });
    } else if (type === 'ble') {
      const { spot, isNew } = await recordBluetoothSpot(
        {
          deviceName: data.deviceName || 'Käsitsi märgitud BLE Majakas',
          address: data.address || `TAG:${Math.random().toString(16).substr(2, 6).toUpperCase()}`,
          rssi: data.rssi || -60,
          deviceClass: data.deviceClass || 'survivor_tag',
          latitude: data.latitude || loc.latitude,
          longitude: data.longitude || loc.longitude,
          walkSessionId: activeSessionId || 'manual',
        },
        activeSessionId
      );

      if (isNew && this.state.activeSession) {
        this.state.activeSession.newBluetoothSpots.push(spot.id);
        this.state.newBleCount = this.state.activeSession.newBluetoothSpots.length;
      }

      this.addRecentDiscovery({
        id: spot.id,
        type: 'ble',
        title: spot.deviceName,
        sub: `MAC: ${spot.address}`,
        rssi: spot.rssi,
        isNew,
        timestamp: Date.now(),
      });
    } else if (type === 'lora') {
      const { node, isNew } = await recordLoraNode(
        {
          id: data.id || `lora_man_${Date.now()}`,
          callsign: data.callsign || 'MANUAL-LORA-NODE',
          rssi: data.rssi || -70,
          snr: data.snr || 8,
          frequency: data.frequency || 868.1,
          latitude: data.latitude || loc.latitude,
          longitude: data.longitude || loc.longitude,
          walkSessionId: activeSessionId || 'manual',
          isRepeater: data.isRepeater ?? true,
        },
        activeSessionId
      );

      if (isNew && this.state.activeSession) {
        this.state.activeSession.newLoraNodes.push(node.id);
        this.state.newLoraCount = this.state.activeSession.newLoraNodes.length;
      }

      this.addRecentDiscovery({
        id: node.id,
        type: 'lora',
        title: node.callsign,
        sub: `Freq: ${node.frequency}MHz`,
        rssi: node.rssi,
        isNew,
        timestamp: Date.now(),
      });
    }

    this.playDiscoveryChime(true);
    this.notify();
    return true;
  }
}

import { IPathfinderScanner } from '../types';

export const pathfinderScanner: IPathfinderScanner = new PathfinderScannerService();
