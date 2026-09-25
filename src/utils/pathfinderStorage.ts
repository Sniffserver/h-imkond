// HÕIMU Pathfinder Mode: Offline Local Storage & Deduplication Engine
// Manages WiFi Spots, Bluetooth BLE Beacons, LoRa Nodes, and Walk Sessions in IndexedDB with LocalStorage Fallback

import { WifiSpot, BluetoothSpot, LoraNode, WalkSession, GeoPoint } from '../types';
import {
  openWardriveDB,
  WARDRIVE_STORES,
  exportWardriveAsJSON,
} from './wardriveCache';

export { exportWardriveAsJSON };

const DB_NAME = 'hoimu_wardrive';
const DB_VERSION = 1;

const STORES = {
  WIFI: 'wifiSpots',
  BLE: 'bluetoothSpots',
  LORA: 'loraNodes',
  WALKS: 'walkSessions',
} as const;

// Memory cache fallback for ultra-fast UI updates
let memWifi: Map<string, WifiSpot> = new Map();
let memBle: Map<string, BluetoothSpot> = new Map();
let memLora: Map<string, LoraNode> = new Map();
let memWalks: Map<string, WalkSession> = new Map();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.WIFI)) {
        db.createObjectStore(STORES.WIFI, { keyPath: 'bssid' });
      }
      if (!db.objectStoreNames.contains(STORES.BLE)) {
        db.createObjectStore(STORES.BLE, { keyPath: 'address' });
      }
      if (!db.objectStoreNames.contains(STORES.LORA)) {
        db.createObjectStore(STORES.LORA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.WALKS)) {
        db.createObjectStore(STORES.WALKS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initial realistic baseline data for Tartu / Estonian Bioregion
const INITIAL_BASELINE_WIFI: WifiSpot[] = [
  {
    id: 'wifi_supilinn_open_1',
    ssid: 'HOIMU-Supilinn-FreeMesh',
    bssid: 'DC:A6:32:88:1A:4C',
    rssi: -58,
    security: 'open',
    latitude: 58.3842,
    longitude: 26.7198,
    firstSeenAt: Date.now() - 86400000 * 3,
    lastSeenAt: Date.now() - 86400000 * 2,
    walkSessionId: 'seed_walk_01',
    channel: 6,
    notes: 'Supilinn kogukonnakeskuse päikeseenergial töötav pääsupunkt',
  },
  {
    id: 'wifi_emajogi_hub_2',
    ssid: 'Emajoe-Lodjakoda-Civic',
    bssid: 'B4:E6:2D:11:F5:88',
    rssi: -66,
    security: 'wpa2',
    latitude: 58.3885,
    longitude: 26.7132,
    firstSeenAt: Date.now() - 86400000 * 5,
    lastSeenAt: Date.now() - 86400000 * 2,
    walkSessionId: 'seed_walk_01',
    channel: 1,
    notes: 'Lodjakoja päikesepargi ruuter ja ilmajaam',
  },
  {
    id: 'wifi_toome_emerg_3',
    ssid: 'TARTU-KRIIIS-INFO-01',
    bssid: '00:1E:58:AA:BC:90',
    rssi: -72,
    security: 'open',
    latitude: 58.3789,
    longitude: 26.7165,
    firstSeenAt: Date.now() - 86400000 * 7,
    lastSeenAt: Date.now() - 86400000 * 4,
    walkSessionId: 'seed_walk_01',
    channel: 11,
    notes: 'Toomemäe vaatetorni hädaabivõrk',
  },
  {
    id: 'wifi_karlova_open_4',
    ssid: 'Karlova-Barrikaad-WLAN',
    bssid: '9C:35:EB:77:43:12',
    rssi: -79,
    security: 'wpa3',
    latitude: 58.3695,
    longitude: 26.7325,
    firstSeenAt: Date.now() - 86400000 * 6,
    lastSeenAt: Date.now() - 86400000 * 3,
    walkSessionId: 'seed_walk_01',
    channel: 36,
  },
];

const INITIAL_BASELINE_BLE: BluetoothSpot[] = [
  {
    id: 'ble_hydro_sensor_1',
    deviceName: 'Emajogi-Water-Sensor-B4',
    address: 'E4:5F:01:A9:33:67',
    rssi: -63,
    deviceClass: 'sensor',
    latitude: 58.3812,
    longitude: 26.7245,
    firstSeenAt: Date.now() - 86400000 * 4,
    lastSeenAt: Date.now() - 86400000 * 2,
    walkSessionId: 'seed_walk_01',
    txPower: -4,
  },
  {
    id: 'ble_hoimu_beacon_2',
    deviceName: 'HOIMU-Relay-Tag-Karlova',
    address: 'F0:B2:15:CC:EE:44',
    rssi: -54,
    deviceClass: 'beacon',
    latitude: 58.3725,
    longitude: 26.7290,
    firstSeenAt: Date.now() - 86400000 * 4,
    lastSeenAt: Date.now() - 86400000 * 2,
    walkSessionId: 'seed_walk_01',
    isMeshNode: true,
  },
  {
    id: 'ble_survivor_phone_3',
    deviceName: 'Galaxy-S22-Relay',
    address: '78:4F:43:92:80:1D',
    rssi: -81,
    deviceClass: 'telefon',
    latitude: 58.3768,
    longitude: 26.7215,
    firstSeenAt: Date.now() - 86400000 * 5,
    lastSeenAt: Date.now() - 86400000 * 3,
    walkSessionId: 'seed_walk_01',
  },
];

const INITIAL_BASELINE_LORA: LoraNode[] = [
  {
    id: 'lora_tartu_r1',
    callsign: 'TARTU-TWR-868',
    rssi: -68,
    snr: 8.5,
    frequency: 868.1,
    latitude: 58.3804,
    longitude: 26.7208,
    lastHeardAt: Date.now() - 86400000 * 1,
    firstSeenAt: Date.now() - 86400000 * 8,
    walkSessionId: 'seed_walk_01',
    isRepeater: true,
    batteryPercent: 94,
    hopLimit: 4,
  },
  {
    id: 'lora_annelinn_sol_2',
    callsign: 'SOLAR-ANNELINN-02',
    rssi: -76,
    snr: 6.2,
    frequency: 868.3,
    latitude: 58.3745,
    longitude: 26.7485,
    lastHeardAt: Date.now() - 86400000 * 2,
    firstSeenAt: Date.now() - 86400000 * 8,
    walkSessionId: 'seed_walk_01',
    isRepeater: false,
    batteryPercent: 88,
    hopLimit: 3,
  },
  {
    id: 'lora_supilinn_hub_3',
    callsign: 'HOIMU-SUPILINN-REPEATER',
    rssi: -59,
    snr: 10.4,
    frequency: 868.1,
    latitude: 58.3855,
    longitude: 26.7180,
    lastHeardAt: Date.now() - 86400000 * 1,
    firstSeenAt: Date.now() - 86400000 * 8,
    walkSessionId: 'seed_walk_01',
    isRepeater: true,
    batteryPercent: 99,
    hopLimit: 5,
  },
];

const INITIAL_BASELINE_WALK: WalkSession = {
  id: 'seed_walk_01',
  title: 'Supilinn – Emajõgi – Raadi Esmane Seire',
  startedAt: Date.now() - 86400000 * 2 - 3600000 * 2,
  endedAt: Date.now() - 86400000 * 2 - 3600000,
  totalDistanceMeters: 2450,
  newWifiSpots: ['wifi_supilinn_open_1', 'wifi_emajogi_hub_2'],
  newBluetoothSpots: ['ble_hydro_sensor_1', 'ble_hoimu_beacon_2'],
  newLoraNodes: ['lora_tartu_r1', 'lora_supilinn_hub_3'],
  track: [
    { lat: 58.3780, lng: 26.7290, timestamp: Date.now() - 86400000 * 2 - 7200000 },
    { lat: 58.3795, lng: 26.7260, timestamp: Date.now() - 86400000 * 2 - 6600000 },
    { lat: 58.3815, lng: 26.7225, timestamp: Date.now() - 86400000 * 2 - 6000000 },
    { lat: 58.3842, lng: 26.7198, timestamp: Date.now() - 86400000 * 2 - 5400000 },
    { lat: 58.3860, lng: 26.7170, timestamp: Date.now() - 86400000 * 2 - 4800000 },
    { lat: 58.3885, lng: 26.7132, timestamp: Date.now() - 86400000 * 2 - 4200000 },
  ],
  notes: 'Esmane eetriardumine Emajõe kallastel. Tuvastatud Supilinna avatud võrk ja LoRa relee.',
};

/**
 * Initialize Pathfinder DB and load into memory cache
 */
export async function initPathfinderDB(): Promise<{
  wifi: WifiSpot[];
  ble: BluetoothSpot[];
  lora: LoraNode[];
  walks: WalkSession[];
}> {
  // Check LocalStorage backup
  try {
    const lsWifi = localStorage.getItem('hoimu_pathfinder_wifi');
    const lsBle = localStorage.getItem('hoimu_pathfinder_ble');
    const lsLora = localStorage.getItem('hoimu_pathfinder_lora');
    const lsWalks = localStorage.getItem('hoimu_pathfinder_walks');

    if (lsWifi) {
      JSON.parse(lsWifi).forEach((w: WifiSpot) => memWifi.set(w.bssid.toUpperCase(), w));
    }
    if (lsBle) {
      JSON.parse(lsBle).forEach((b: BluetoothSpot) => memBle.set(b.address.toUpperCase(), b));
    }
    if (lsLora) {
      JSON.parse(lsLora).forEach((l: LoraNode) => memLora.set(l.id, l));
    }
    if (lsWalks) {
      JSON.parse(lsWalks).forEach((ws: WalkSession) => memWalks.set(ws.id, ws));
    }
  } catch (e) {
    console.warn('[Pathfinder] LocalStorage preload notice:', e);
  }

  // Seed baseline if completely empty
  if (memWifi.size === 0 && memBle.size === 0 && memLora.size === 0) {
    INITIAL_BASELINE_WIFI.forEach((w) => memWifi.set(w.bssid.toUpperCase(), w));
    INITIAL_BASELINE_BLE.forEach((b) => memBle.set(b.address.toUpperCase(), b));
    INITIAL_BASELINE_LORA.forEach((l) => memLora.set(l.id, l));
    memWalks.set(INITIAL_BASELINE_WALK.id, INITIAL_BASELINE_WALK);
    syncToLocalStorage();
  }

  try {
    const db = await openDB();
    const [idbWifi, idbBle, idbLora, idbWalks] = await Promise.all([
      getAllFromStore<WifiSpot>(db, STORES.WIFI),
      getAllFromStore<BluetoothSpot>(db, STORES.BLE),
      getAllFromStore<LoraNode>(db, STORES.LORA),
      getAllFromStore<WalkSession>(db, STORES.WALKS),
    ]);

    if (idbWifi.length > 0 || idbBle.length > 0 || idbLora.length > 0) {
      idbWifi.forEach((w) => memWifi.set(w.bssid.toUpperCase(), w));
      idbBle.forEach((b) => memBle.set(b.address.toUpperCase(), b));
      idbLora.forEach((l) => memLora.set(l.id, l));
      idbWalks.forEach((ws) => memWalks.set(ws.id, ws));
    } else {
      // Write memory/seed data into IndexedDB
      const tx = db.transaction([STORES.WIFI, STORES.BLE, STORES.LORA, STORES.WALKS], 'readwrite');
      const wStore = tx.objectStore(STORES.WIFI);
      const bStore = tx.objectStore(STORES.BLE);
      const lStore = tx.objectStore(STORES.LORA);
      const kStore = tx.objectStore(STORES.WALKS);

      memWifi.forEach((w) => wStore.put(w));
      memBle.forEach((b) => bStore.put(b));
      memLora.forEach((l) => lStore.put(l));
      memWalks.forEach((ws) => kStore.put(ws));
    }
  } catch (err) {
    console.warn('[Pathfinder] IndexedDB open error, using localStorage:', err);
  }

  return {
    wifi: Array.from(memWifi.values()),
    ble: Array.from(memBle.values()),
    lora: Array.from(memLora.values()),
    walks: Array.from(memWalks.values()),
  };
}

function syncToLocalStorage() {
  try {
    localStorage.setItem('hoimu_pathfinder_wifi', JSON.stringify(Array.from(memWifi.values())));
    localStorage.setItem('hoimu_pathfinder_ble', JSON.stringify(Array.from(memBle.values())));
    localStorage.setItem('hoimu_pathfinder_lora', JSON.stringify(Array.from(memLora.values())));
    localStorage.setItem('hoimu_pathfinder_walks', JSON.stringify(Array.from(memWalks.values())));
  } catch (e) {
    console.warn('[Pathfinder] LocalStorage sync warning:', e);
  }
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/**
 * Record a detected WiFi network.
 * Deduplication key: BSSID (MAC address).
 * If it already existed in DB: updates lastSeenAt, coordinates, and rssi, but marks isNew = false.
 * If brand new: creates record with firstSeenAt, marks isNew = true.
 */
export async function recordWifiSpot(
  spotData: Omit<WifiSpot, 'id' | 'firstSeenAt' | 'lastSeenAt'>,
  activeWalkSessionId?: string
): Promise<{ spot: WifiSpot; isNew: boolean }> {
  const normBssid = spotData.bssid.trim().toUpperCase();
  const existing = memWifi.get(normBssid);
  const now = Date.now();

  let finalSpot: WifiSpot;
  let isNew = false;

  if (existing) {
    finalSpot = {
      ...existing,
      ssid: spotData.ssid || existing.ssid,
      rssi: spotData.rssi,
      security: spotData.security || existing.security,
      latitude: spotData.latitude,
      longitude: spotData.longitude,
      lastSeenAt: now,
      channel: spotData.channel ?? existing.channel,
      notes: spotData.notes ?? existing.notes,
    };
    isNew = false;
  } else {
    isNew = true;
    finalSpot = {
      id: `wifi_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ssid: spotData.ssid || 'Varjatud Võrk',
      bssid: normBssid,
      rssi: spotData.rssi,
      security: spotData.security || 'open',
      latitude: spotData.latitude,
      longitude: spotData.longitude,
      firstSeenAt: now,
      lastSeenAt: now,
      walkSessionId: activeWalkSessionId || spotData.walkSessionId || 'general_scan',
      channel: spotData.channel,
      notes: spotData.notes,
    };
  }

  memWifi.set(normBssid, finalSpot);
  syncToLocalStorage();

  try {
    const db = await openDB();
    const tx = db.transaction(STORES.WIFI, 'readwrite');
    tx.objectStore(STORES.WIFI).put(finalSpot);
  } catch (e) {
    // Handled in memory & localStorage
  }

  return { spot: finalSpot, isNew };
}

/**
 * Record a detected Bluetooth BLE device.
 * Deduplication key: MAC Address.
 */
export async function recordBluetoothSpot(
  spotData: Omit<BluetoothSpot, 'id' | 'firstSeenAt' | 'lastSeenAt'>,
  activeWalkSessionId?: string
): Promise<{ spot: BluetoothSpot; isNew: boolean }> {
  const normAddress = spotData.address.trim().toUpperCase();
  const existing = memBle.get(normAddress);
  const now = Date.now();

  let finalSpot: BluetoothSpot;
  let isNew = false;

  if (existing) {
    finalSpot = {
      ...existing,
      deviceName: spotData.deviceName || existing.deviceName,
      rssi: spotData.rssi,
      deviceClass: spotData.deviceClass || existing.deviceClass,
      latitude: spotData.latitude,
      longitude: spotData.longitude,
      lastSeenAt: now,
      txPower: spotData.txPower ?? existing.txPower,
      isMeshNode: spotData.isMeshNode ?? existing.isMeshNode,
    };
    isNew = false;
  } else {
    isNew = true;
    finalSpot = {
      id: `ble_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      deviceName: spotData.deviceName || 'Nimetu BLE Seade',
      address: normAddress,
      rssi: spotData.rssi,
      deviceClass: spotData.deviceClass || 'beacon',
      latitude: spotData.latitude,
      longitude: spotData.longitude,
      firstSeenAt: now,
      lastSeenAt: now,
      walkSessionId: activeWalkSessionId || spotData.walkSessionId || 'general_scan',
      txPower: spotData.txPower,
      isMeshNode: spotData.isMeshNode,
    };
  }

  memBle.set(normAddress, finalSpot);
  syncToLocalStorage();

  try {
    const db = await openDB();
    const tx = db.transaction(STORES.BLE, 'readwrite');
    tx.objectStore(STORES.BLE).put(finalSpot);
  } catch (e) {
    // Handled in memory & localStorage
  }

  return { spot: finalSpot, isNew };
}

/**
 * Record a heard LoRa Node.
 * Deduplication key: Node ID / Callsign.
 */
export async function recordLoraNode(
  nodeData: Omit<LoraNode, 'lastHeardAt'> & { lastHeardAt?: number },
  activeWalkSessionId?: string
): Promise<{ node: LoraNode; isNew: boolean }> {
  const nodeId = nodeData.id.trim();
  const existing = memLora.get(nodeId);
  const now = Date.now();

  let finalNode: LoraNode;
  let isNew = false;

  if (existing) {
    finalNode = {
      ...existing,
      callsign: nodeData.callsign || existing.callsign,
      rssi: nodeData.rssi,
      snr: nodeData.snr,
      frequency: nodeData.frequency || existing.frequency,
      latitude: nodeData.latitude,
      longitude: nodeData.longitude,
      lastHeardAt: now,
      batteryPercent: nodeData.batteryPercent ?? existing.batteryPercent,
      isRepeater: nodeData.isRepeater ?? existing.isRepeater,
      hopLimit: nodeData.hopLimit ?? existing.hopLimit,
    };
    isNew = false;
  } else {
    isNew = true;
    finalNode = {
      id: nodeId,
      callsign: nodeData.callsign || `LORA-${nodeId.slice(-4).toUpperCase()}`,
      rssi: nodeData.rssi,
      snr: nodeData.snr,
      frequency: nodeData.frequency || 868.1,
      latitude: nodeData.latitude,
      longitude: nodeData.longitude,
      firstSeenAt: now,
      lastHeardAt: now,
      walkSessionId: activeWalkSessionId || nodeData.walkSessionId || 'general_scan',
      batteryPercent: nodeData.batteryPercent,
      isRepeater: nodeData.isRepeater,
      hopLimit: nodeData.hopLimit,
    };
  }

  memLora.set(nodeId, finalNode);
  syncToLocalStorage();

  try {
    const db = await openDB();
    const tx = db.transaction(STORES.LORA, 'readwrite');
    tx.objectStore(STORES.LORA).put(finalNode);
  } catch (e) {
    // Handled in memory & localStorage
  }

  return { node: finalNode, isNew };
}

/**
 * Save or update a WalkSession
 */
export async function saveWalkSession(session: WalkSession): Promise<void> {
  memWalks.set(session.id, session);
  syncToLocalStorage();

  try {
    const db = await openDB();
    const tx = db.transaction(STORES.WALKS, 'readwrite');
    tx.objectStore(STORES.WALKS).put(session);
  } catch (e) {
    // Handled in memory & localStorage
  }
}

/**
 * Get all data in memory
 */
export function getLoadedPathfinderData() {
  return {
    wifi: Array.from(memWifi.values()),
    ble: Array.from(memBle.values()),
    lora: Array.from(memLora.values()),
    walks: Array.from(memWalks.values()).sort((a, b) => b.startedAt - a.startedAt),
  };
}

/**
 * Calculate distance in meters along a GPS track using Haversine
 */
export function calculateTrackDistanceMeters(track: GeoPoint[]): number {
  if (track.length < 2) return 0;
  let totalDist = 0;
  for (let i = 1; i < track.length; i++) {
    totalDist += getHaversineDistanceMeters(
      track[i - 1].lat,
      track[i - 1].lng,
      track[i].lat,
      track[i].lng
    );
  }
  return Math.round(totalDist);
}

export function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Export a walk session as standard GPX 1.1 file
 */
export function exportWalkSessionAsGPX(session: WalkSession): string {
  const gpxPoints = session.track
    .map(
      (pt) =>
        `    <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">
      <time>${new Date(pt.timestamp || Date.now()).toISOString()}</time>
      ${pt.altitude ? `<ele>${pt.altitude.toFixed(1)}</ele>` : ''}
    </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="HOIMU Pathfinder Mode" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${session.title || `HOIMU Walk ${new Date(session.startedAt).toLocaleDateString()}`}</name>
    <time>${new Date(session.startedAt).toISOString()}</time>
    <desc>Salvestatud HÕIMU Pathfinder võrguotsingu režiimis (${session.totalDistanceMeters || 0}m, ${session.newWifiSpots.length} uut WiFi, ${session.newBluetoothSpots.length} uut BLE, ${session.newLoraNodes.length} uut LoRa)</desc>
  </metadata>
  <trk>
    <name>${session.title || 'Kõnnirada'}</name>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Export Pathfinder Data as GeoJSON FeatureCollection
 */
export function exportPathfinderAsGeoJSON(
  sessions: WalkSession[],
  wifiSpots: WifiSpot[],
  bleSpots: BluetoothSpot[],
  loraNodes: LoraNode[]
): string {
  const features: any[] = [];

  // 1. Walk Tracks
  sessions.forEach((s) => {
    if (s.track.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: s.track.map((pt) => [pt.longitude, pt.latitude]),
        },
        properties: {
          type: 'walk_track',
          sessionId: s.id,
          title: s.title,
          startedAt: new Date(s.startedAt).toISOString(),
          endedAt: new Date(s.endedAt).toISOString(),
          distanceMeters: s.totalDistanceMeters,
          newWifiCount: s.newWifiSpots.length,
          newBleCount: s.newBluetoothSpots.length,
          newLoraCount: s.newLoraNodes.length,
        },
      });
    }
  });

  // 2. WiFi Spots
  wifiSpots.forEach((w) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [w.longitude, w.latitude],
      },
      properties: {
        type: 'wifi_spot',
        id: w.id,
        ssid: w.ssid,
        bssid: w.bssid,
        rssi: w.rssi,
        security: w.security,
        channel: w.channel,
        firstSeenAt: new Date(w.firstSeenAt).toISOString(),
        lastSeenAt: new Date(w.lastSeenAt).toISOString(),
        walkSessionId: w.walkSessionId,
      },
    });
  });

  // 3. BLE Spots
  bleSpots.forEach((b) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [b.longitude, b.latitude],
      },
      properties: {
        type: 'bluetooth_spot',
        id: b.id,
        deviceName: b.deviceName,
        address: b.address,
        rssi: b.rssi,
        deviceClass: b.deviceClass,
        firstSeenAt: new Date(b.firstSeenAt).toISOString(),
        lastSeenAt: new Date(b.lastSeenAt).toISOString(),
        walkSessionId: b.walkSessionId,
      },
    });
  });

  // 4. LoRa Nodes
  loraNodes.forEach((l) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [l.longitude, l.latitude],
      },
      properties: {
        type: 'lora_node',
        id: l.id,
        callsign: l.callsign,
        rssi: l.rssi,
        snr: l.snr,
        frequency: l.frequency,
        isRepeater: l.isRepeater,
        firstSeenAt: l.firstSeenAt ? new Date(l.firstSeenAt).toISOString() : undefined,
        lastHeardAt: new Date(l.lastHeardAt).toISOString(),
      },
    });
  });

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    2
  );
}

/**
 * Export all Pathfinder and Wardrive discoveries as clean JSON
 */
export function exportPathfinderAsJSON(
  sessions: WalkSession[],
  wifiSpots: WifiSpot[],
  bleSpots: BluetoothSpot[],
  loraNodes: LoraNode[],
  filterOnlyNew?: boolean
): string {
  return exportWardriveAsJSON(sessions, wifiSpots, bleSpots, loraNodes, filterOnlyNew);
}

/**
 * Clear all Pathfinder data and reset to seed state
 */
export async function clearAllPathfinderData(): Promise<void> {
  memWifi.clear();
  memBle.clear();
  memLora.clear();
  memWalks.clear();

  try {
    localStorage.removeItem('hoimu_pathfinder_wifi');
    localStorage.removeItem('hoimu_pathfinder_ble');
    localStorage.removeItem('hoimu_pathfinder_lora');
    localStorage.removeItem('hoimu_pathfinder_walks');

    const db = await openDB();
    const tx = db.transaction([STORES.WIFI, STORES.BLE, STORES.LORA, STORES.WALKS], 'readwrite');
    tx.objectStore(STORES.WIFI).clear();
    tx.objectStore(STORES.BLE).clear();
    tx.objectStore(STORES.LORA).clear();
    tx.objectStore(STORES.WALKS).clear();
  } catch (e) {
    console.warn('[Pathfinder] Clear data notice:', e);
  }
}
