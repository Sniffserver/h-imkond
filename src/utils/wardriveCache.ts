// HÕIMU Wardrive Cache: IndexedDB storage for offline Pathfinder Mode
// Manages large-volume WiFi, Bluetooth, LoRa spots, and Walk Sessions efficiently.

import { WifiSpot, BluetoothSpot, LoraNode, WalkSession } from '../types';

export const WARDRIVE_DB_NAME = 'hoimu_wardrive';
export const WARDRIVE_DB_VERSION = 1;

export const WARDRIVE_STORES = {
  WIFI: 'wifiSpots',
  BLE: 'bluetoothSpots',
  LORA: 'loraNodes',
  WALKS: 'walkSessions',
} as const;

export function openWardriveDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(WARDRIVE_DB_NAME, WARDRIVE_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(WARDRIVE_STORES.WIFI)) {
        db.createObjectStore(WARDRIVE_STORES.WIFI, { keyPath: 'bssid' });
      }
      if (!db.objectStoreNames.contains(WARDRIVE_STORES.BLE)) {
        db.createObjectStore(WARDRIVE_STORES.BLE, { keyPath: 'address' });
      }
      if (!db.objectStoreNames.contains(WARDRIVE_STORES.LORA)) {
        db.createObjectStore(WARDRIVE_STORES.LORA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WARDRIVE_STORES.WALKS)) {
        db.createObjectStore(WARDRIVE_STORES.WALKS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Put a WiFi spot into IndexedDB
 */
export async function dbPutWifiSpot(spot: WifiSpot): Promise<void> {
  try {
    const db = await openWardriveDB();
    const tx = db.transaction(WARDRIVE_STORES.WIFI, 'readwrite');
    tx.objectStore(WARDRIVE_STORES.WIFI).put(spot);
  } catch (e) {
    console.warn('[WardriveCache] dbPutWifiSpot error:', e);
  }
}

/**
 * Put a Bluetooth spot into IndexedDB
 */
export async function dbPutBluetoothSpot(spot: BluetoothSpot): Promise<void> {
  try {
    const db = await openWardriveDB();
    const tx = db.transaction(WARDRIVE_STORES.BLE, 'readwrite');
    tx.objectStore(WARDRIVE_STORES.BLE).put(spot);
  } catch (e) {
    console.warn('[WardriveCache] dbPutBluetoothSpot error:', e);
  }
}

/**
 * Put a LoRa node into IndexedDB
 */
export async function dbPutLoraNode(node: LoraNode): Promise<void> {
  try {
    const db = await openWardriveDB();
    const tx = db.transaction(WARDRIVE_STORES.LORA, 'readwrite');
    tx.objectStore(WARDRIVE_STORES.LORA).put(node);
  } catch (e) {
    console.warn('[WardriveCache] dbPutLoraNode error:', e);
  }
}

/**
 * Put a Walk Session into IndexedDB
 */
export async function dbPutWalkSession(session: WalkSession): Promise<void> {
  try {
    const db = await openWardriveDB();
    const tx = db.transaction(WARDRIVE_STORES.WALKS, 'readwrite');
    tx.objectStore(WARDRIVE_STORES.WALKS).put(session);
  } catch (e) {
    console.warn('[WardriveCache] dbPutWalkSession error:', e);
  }
}

/**
 * Load all stored records from IndexedDB
 */
export async function dbLoadAllWardriveData(): Promise<{
  wifi: WifiSpot[];
  ble: BluetoothSpot[];
  lora: LoraNode[];
  walks: WalkSession[];
}> {
  try {
    const db = await openWardriveDB();

    const fetchStore = <T>(storeName: string): Promise<T[]> => {
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    };

    const [wifi, ble, lora, walks] = await Promise.all([
      fetchStore<WifiSpot>(WARDRIVE_STORES.WIFI),
      fetchStore<BluetoothSpot>(WARDRIVE_STORES.BLE),
      fetchStore<LoraNode>(WARDRIVE_STORES.LORA),
      fetchStore<WalkSession>(WARDRIVE_STORES.WALKS),
    ]);

    return { wifi, ble, lora, walks };
  } catch (e) {
    console.warn('[WardriveCache] dbLoadAllWardriveData fallback:', e);
    return { wifi: [], ble: [], lora: [], walks: [] };
  }
}

/**
 * Export all Pathfinder and Wardrive discoveries as clean JSON
 */
export function exportWardriveAsJSON(
  sessions: WalkSession[],
  wifiSpots: WifiSpot[],
  bleSpots: BluetoothSpot[],
  loraNodes: LoraNode[],
  filterOnlyNew?: boolean
): string {
  const exportPayload = {
    app: 'HÕIMU Pathfinder Mode',
    version: '2.4.0',
    exportedAt: new Date().toISOString(),
    filterOnlyNew: Boolean(filterOnlyNew),
    summary: {
      totalWalks: sessions.length,
      totalWifiSpots: wifiSpots.length,
      totalBluetoothSpots: bleSpots.length,
      totalLoraNodes: loraNodes.length,
    },
    walkSessions: sessions,
    wifiSpots,
    bluetoothSpots: bleSpots,
    loraNodes,
  };

  return JSON.stringify(exportPayload, null, 2);
}
