import { BridgeStatus, BridgePeer } from '../types';
import { useMeshStore } from '../store/meshStore';

/**
 * Service for communicating with the Raspberry Pi Zero 2 W Hardware Bridge.
 * The Pi runs as a WiFi Direct Group Owner / AP or USB OTG Ethernet Gadget
 * hosting a REST API for LoRa (SX1262), BLE long-range, and solar monitoring.
 */

const DEFAULT_BRIDGE_IP = '192.168.4.1:5000';
const STORAGE_KEY_IP = 'hoimu_pi_bridge_ip';
const STORAGE_KEY_MOCK = 'hoimu_pi_bridge_mock';

// Check for MOCK_BRIDGE=true in environment
const isEnvMock = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_MOCK_BRIDGE === 'true' || import.meta.env.MOCK_BRIDGE === 'true') {
      return true;
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_MOCK_BRIDGE === 'true' || process.env.MOCK_BRIDGE === 'true') {
      return true;
    }
  }
  return false;
})();

let currentBridgeIp = typeof window !== 'undefined'
  ? (localStorage.getItem(STORAGE_KEY_IP) || DEFAULT_BRIDGE_IP)
  : DEFAULT_BRIDGE_IP;

let useMockBridge = typeof window !== 'undefined'
  ? (localStorage.getItem(STORAGE_KEY_MOCK) !== 'false' || isEnvMock)
  : true;

let lastSyncTimestamp: number | null = null;
let lastSyncPeerCount = 0;

let cachedStatus: BridgeStatus = {
  connected: useMockBridge,
  ipAddress: currentBridgeIp,
  piBatteryPercent: 87,
  solarVoltage: 14.2,
  solarWatts: 12.4,
  radioModules: ['ble', 'lora_868', 'wifi_direct'],
  uptimeSeconds: 18450,
  relayedPacketsCount: 421,
};

type StatusListener = (status: BridgeStatus) => void;
const listeners = new Set<StatusListener>();

export function subscribeBridgeStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(cachedStatus);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(cachedStatus);
    } catch (e) {
      console.error('[PiBridge] Listener error', e);
    }
  });
}

let mockUptimeTimer: ReturnType<typeof setInterval> | null = null;

function startMockUptimeCounter() {
  if (mockUptimeTimer) return;
  mockUptimeTimer = setInterval(() => {
    cachedStatus.uptimeSeconds += 1;
    if (Math.random() < 0.25) {
      cachedStatus.relayedPacketsCount += 1;
      notifyListeners();
    }
  }, 1000);
}

export function setCustomBridgeIp(ip: string): void {
  currentBridgeIp = ip.trim();
  cachedStatus.ipAddress = currentBridgeIp;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_IP, currentBridgeIp);
  }
  notifyListeners();
}

export function getCustomBridgeIp(): string {
  return currentBridgeIp;
}

export function setMockBridgeMode(enabled: boolean): void {
  useMockBridge = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_MOCK, String(enabled));
  }
  cachedStatus.connected = enabled;
  if (enabled) {
    startMockUptimeCounter();
  }
  notifyListeners();
}

export function isMockBridgeMode(): boolean {
  return useMockBridge;
}

export function getLastSyncInfo(): { timestamp: number | null; peerCount: number } {
  return {
    timestamp: lastSyncTimestamp,
    peerCount: lastSyncPeerCount,
  };
}

/**
 * discoverBridge(): Scan for Pi at http://192.168.4.1:5000 or custom IP or via mDNS (_hoimu-bridge._tcp.local).
 * Return connection status within 5 seconds timeout.
 */
export async function discoverBridge(customIp?: string): Promise<{
  success: boolean;
  ip: string;
  status: BridgeStatus;
}> {
  if (customIp) {
    setCustomBridgeIp(customIp);
  }

  const targetIp = currentBridgeIp;

  if (useMockBridge || isEnvMock) {
    startMockUptimeCounter();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate mDNS probe delay
    cachedStatus = {
      ...cachedStatus,
      connected: true,
      ipAddress: targetIp,
      piBatteryPercent: 87,
      solarVoltage: 14.2,
      solarWatts: 12.4,
    };
    notifyListeners();

    // Sync mock mesh peers to meshStore
    await syncBridgePeersToStore();

    return {
      success: true,
      ip: targetIp,
      status: cachedStatus,
    };
  }

  // Live HTTP Probe with 5 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const endpoints = [
    `http://${targetIp}/health`,
    `http://${targetIp}/api/status`,
    `http://hoimu-pi.local:5000/health`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.ok) {
        clearTimeout(timeoutId);
        const data = await response.json();
        cachedStatus = {
          connected: true,
          ipAddress: targetIp,
          piBatteryPercent: data.piBatteryPercent ?? 87,
          solarVoltage: data.solarVoltage ?? 14.2,
          solarWatts: data.solarWatts ?? 12.4,
          radioModules: data.radioModules ?? ['ble', 'lora_868', 'wifi_direct'],
          uptimeSeconds: data.uptimeSeconds ?? 18450,
          relayedPacketsCount: data.relayedPacketsCount ?? 421,
        };
        notifyListeners();
        await syncBridgePeersToStore();
        return { success: true, ip: targetIp, status: cachedStatus };
      }
    } catch (err) {
      // Ignore individual endpoint errors and try next
    }
  }

  clearTimeout(timeoutId);

  // Probe failed & timeout hit (Graceful fallback to native phone radio)
  cachedStatus.connected = false;
  notifyListeners();
  return {
    success: false,
    ip: targetIp,
    status: cachedStatus,
  };
}

/**
 * getBridgeStatus(): GET /health → { piBatteryPercent, solarVoltage, solarWatts, radioModules, uptimeSeconds, relayedPacketsCount }
 */
export async function getBridgeStatus(): Promise<BridgeStatus> {
  if (useMockBridge || isEnvMock) {
    startMockUptimeCounter();
    cachedStatus.connected = true;
    notifyListeners();
    return cachedStatus;
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`http://${currentBridgeIp}/health`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => fetch(`http://${currentBridgeIp}/api/status`, { method: 'GET' }));

    clearTimeout(tid);

    if (res && res.ok) {
      const data = await res.json();
      cachedStatus = {
        connected: true,
        ipAddress: currentBridgeIp,
        piBatteryPercent: data.piBatteryPercent ?? 87,
        solarVoltage: data.solarVoltage ?? 14.2,
        solarWatts: data.solarWatts ?? 12.4,
        radioModules: data.radioModules ?? ['ble', 'lora_868', 'wifi_direct'],
        uptimeSeconds: data.uptimeSeconds ?? 18450,
        relayedPacketsCount: data.relayedPacketsCount ?? 421,
      };
      notifyListeners();
      return cachedStatus;
    }
  } catch {
    cachedStatus.connected = false;
    notifyListeners();
  }

  return cachedStatus;
}

/**
 * getMeshPeersFromBridge(): GET /mesh/peers → Array<{id, rssi, protocol: 'ble'|'lora', lastHeard, hops}>
 */
export async function getMeshPeersFromBridge(): Promise<BridgePeer[]> {
  if (useMockBridge || isEnvMock || cachedStatus.connected) {
    const mockPeers: BridgePeer[] = [
      {
        id: 'TARTU-LORA-NODE-01',
        rssi: -68,
        protocol: 'lora',
        lastHeard: Date.now() - 4000,
        hops: 1,
        callsign: 'TARTU-LORA-01',
        role: 'Relay Node',
      },
      {
        id: 'EST-SOLAR-RELAY-04',
        rssi: -82,
        protocol: 'lora',
        lastHeard: Date.now() - 18000,
        hops: 2,
        callsign: 'SOLAR-RELAY-04',
        role: 'Solar Gateway',
      },
      {
        id: 'PEER-BLE-LONG-RANGE-09',
        rssi: -54,
        protocol: 'ble',
        lastHeard: Date.now() - 1500,
        hops: 1,
        callsign: 'BLE-NODE-09',
        role: 'Peer',
      },
      {
        id: 'KAARSILD-BRIDGE-RELAY',
        rssi: -71,
        protocol: 'lora',
        lastHeard: Date.now() - 9000,
        hops: 1,
        callsign: 'KAARSILD-LORA',
        role: 'Bridge Repeater',
      },
    ];

    lastSyncTimestamp = Date.now();
    lastSyncPeerCount = mockPeers.length;
    return mockPeers;
  }

  try {
    const res = await fetch(`http://${currentBridgeIp}/mesh/peers`).catch(() =>
      fetch(`http://${currentBridgeIp}/api/peers`)
    );
    if (res && res.ok) {
      const data: BridgePeer[] = await res.json();
      lastSyncTimestamp = Date.now();
      lastSyncPeerCount = data.length;
      return data;
    }
  } catch (err) {
    console.warn('[PiBridge] Failed to fetch mesh peers from Pi', err);
  }

  return [];
}

/**
 * Helper to fetch bridge peers and update the Zustand meshStore bridgePeers map
 */
export async function syncBridgePeersToStore(): Promise<BridgePeer[]> {
  const bridgePeers = await getMeshPeersFromBridge();
  useMeshStore.getState().setBridgePeers(bridgePeers);
  return bridgePeers;
}

/**
 * sendViaBridge(packet): POST /mesh/broadcast → forwards packet to Pi for LoRa/BLE transmission
 */
export async function sendViaBridge(packet: {
  type: string;
  from: string;
  to?: string;
  payload: any;
}): Promise<{ success: boolean; txId?: string }> {
  if (useMockBridge || isEnvMock) {
    cachedStatus.relayedPacketsCount += 1;
    notifyListeners();
    return { success: true, txId: `tx-pi-${Date.now()}` };
  }

  try {
    const res = await fetch(`http://${currentBridgeIp}/mesh/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
    }).catch(() =>
      fetch(`http://${currentBridgeIp}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      })
    );

    if (res && res.ok) {
      const data = await res.json();
      cachedStatus.relayedPacketsCount += 1;
      notifyListeners();
      return { success: true, txId: data.txId || `tx-${Date.now()}` };
    }
  } catch (err) {
    console.error('[PiBridge] Failed to transmit via Pi hardware', err);
  }

  return { success: false };
}

/**
 * getAsciiMapFromBridge(): GET /map/ascii → returns text/plain ASCII grid string from Pi's headless daemon
 */
export async function getAsciiMapFromBridge(): Promise<string> {
  if (useMockBridge || isEnvMock) {
    return `========================================
| @ USER-NODE        [Pi Zero 2 W]     |
| ♣ ♣ ♣ · · · · ~ ~ ~ ~ ~ ~ · · · · ♣ ♣|
| ♣ ♣ ☉ TARTU-01 · ~ ~ ~ ~ · · □ □ · ♣ |
| · · · · · · · · ~ ~ ~ · · □ □ □ □ ·  |
========================================`;
  }

  try {
    const res = await fetch(`http://${currentBridgeIp}/map/ascii`).catch(() =>
      fetch(`http://${currentBridgeIp}/api/ascii-map`)
    );
    if (res && res.ok) {
      const text = await res.text();
      return text;
    }
  } catch (err) {
    console.warn('[PiBridge] Could not fetch ASCII map from Pi', err);
  }

  return '';
}
