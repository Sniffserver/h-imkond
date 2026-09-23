import { BridgeStatus, BridgePeer } from '../../types';
import { useMeshStore } from '../../store/meshStore';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';

/**
 * Service for communicating with the Raspberry Pi Zero 2 W Hardware Bridge.
 * The Pi runs as a WiFi Direct Group Owner / AP or USB OTG Ethernet Gadget
 * hosting an authenticated REST API (v1.0.0) for LoRa (SX1262), BLE long-range, and solar monitoring.
 */

const DEFAULT_BRIDGE_IP = '192.168.4.1:8080';
const STORAGE_KEY_IP = 'hoimu_pi_bridge_ip';
const STORAGE_KEY_MOCK = 'hoimu_pi_bridge_mock';
const STORAGE_KEY_TOKEN = 'hoimu_pi_bridge_token_sec';
const STORAGE_KEY_CLIENT_ID = 'hoimu_pi_bridge_client_id';

// Read Client ID (non-secret identifier) from environment or storage
const ENV_CLIENT_ID = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_PI_BRIDGE_CLIENT_ID || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_PI_BRIDGE_CLIENT_ID || '';
  }
  return '';
})();

let currentClientId = typeof window !== 'undefined'
  ? (localStorage.getItem(STORAGE_KEY_CLIENT_ID) || ENV_CLIENT_ID || 'HOIMU-CLIENT-APP')
  : (ENV_CLIENT_ID || 'HOIMU-CLIENT-APP');

// Encrypted device-bound credential storage for Pi bridge bearer token
let currentAuthToken = typeof window !== 'undefined'
  ? getSecureLocalStorage<string>(STORAGE_KEY_TOKEN, '')
  : '';

// Rate limiting state for pairing attempts (Anti-Brute Force)
const MAX_PAIRING_ATTEMPTS = 5;
const PAIRING_COOLDOWN_MS = 30000;
let failedPairingAttempts = 0;
let lastPairingAttemptTime = 0;

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

export function getClientId(): string {
  return currentClientId;
}

export function setClientId(id: string): void {
  currentClientId = id.trim();
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, currentClientId);
  }
}

/**
 * Initiates 2-step pairing with the Pi hardware bridge (/api/v1/pair/start)
 */
export async function startPairing(customIp?: string, clientId?: string): Promise<{
  success: boolean;
  sessionId?: string;
  devPin?: string;
  error?: string;
}> {
  if (customIp) setCustomBridgeIp(customIp);
  if (clientId) setClientId(clientId);

  const now = Date.now();
  if (failedPairingAttempts >= MAX_PAIRING_ATTEMPTS) {
    const timeRemaining = Math.ceil((PAIRING_COOLDOWN_MS - (now - lastPairingAttemptTime)) / 1000);
    if (timeRemaining > 0) {
      return {
        success: false,
        error: `Too many failed pairing attempts. Please wait ${timeRemaining}s before trying again.`,
      };
    } else {
      failedPairingAttempts = 0;
    }
  }

  if (useMockBridge || isEnvMock) {
    return {
      success: true,
      sessionId: 'pair-mock-session-123',
      devPin: '840192'
    };
  }

  try {
    const res = await fetch(`http://${currentBridgeIp}/api/v1/pair/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: currentClientId,
        device_name: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 30) : 'Web App'
      })
    });

    const data = await res.json();
    if (res.ok) {
      return {
        success: true,
        sessionId: data.session_id,
        devPin: data.dev_pin
      };
    }
    return { success: false, error: data.message || 'Pairing start failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error reaching Pi bridge' };
  }
}

export interface ScopedCapabilityToken {
  token_type: 'hoimu_capability_token';
  v: number;
  deviceId: string;
  clientId: string;
  keyId: string;
  scope: string[];
  issuedAt: number;
  expiresAt: number;
}

/**
 * Confirms PIN and retrieves per-device Scoped Capability credential (/api/v1/pair/confirm)
 */
export async function confirmPairing(
  sessionId: string,
  pin: string,
  customIp?: string,
  clientId?: string,
  scopes?: string[]
): Promise<{
  success: boolean;
  deviceId?: string;
  authToken?: string;
  scopes?: string[];
  capabilityToken?: ScopedCapabilityToken;
  error?: string;
}> {
  if (customIp) setCustomBridgeIp(customIp);
  if (clientId) setClientId(clientId);

  const now = Date.now();
  if (failedPairingAttempts >= MAX_PAIRING_ATTEMPTS) {
    const timeRemaining = Math.ceil((PAIRING_COOLDOWN_MS - (now - lastPairingAttemptTime)) / 1000);
    if (timeRemaining > 0) {
      return {
        success: false,
        error: `Pairing rate-limited. Cooldown active for ${timeRemaining}s.`,
      };
    } else {
      failedPairingAttempts = 0;
    }
  }

  if (useMockBridge || isEnvMock) {
    const mockToken = 'hoimu_cap_eyJ0b2tlbl90eXBlIjoiaG9pbXVfY2FwYWJpbGl0eV90b2tlbiJ9.mock';
    setBridgeAuthToken(mockToken);
    cachedStatus.connected = true;
    failedPairingAttempts = 0;
    notifyListeners();
    return {
      success: true,
      deviceId: 'dev-mock-01',
      authToken: mockToken,
      scopes: scopes || ['mesh.read', 'mesh.send', 'telemetry.read']
    };
  }

  try {
    const res = await fetch(`http://${currentBridgeIp}/api/v1/pair/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        pin,
        client_id: currentClientId,
        scopes: scopes || ['mesh.read', 'mesh.send', 'telemetry.read']
      })
    });

    const data = await res.json();
    if (res.ok && data.auth_token) {
      setBridgeAuthToken(data.auth_token);
      cachedStatus.connected = true;
      failedPairingAttempts = 0;
      notifyListeners();
      await syncBridgePeersToStore();
      return {
        success: true,
        deviceId: data.device_id,
        authToken: data.auth_token,
        scopes: data.scope,
        capabilityToken: data.capability_token
      };
    }
    
    // Increment failure counter for rate limiting
    failedPairingAttempts += 1;
    lastPairingAttemptTime = Date.now();

    return { success: false, error: data.message || 'Invalid PIN' };
  } catch (err: any) {
    failedPairingAttempts += 1;
    lastPairingAttemptTime = Date.now();
    return { success: false, error: err.message || 'Network error confirming PIN' };
  }
}

/**
 * Revokes current or specific device credential (/api/v1/devices/revoke)
 */
export async function revokeDevice(deviceId?: string): Promise<{ success: boolean; error?: string }> {
  if (useMockBridge || isEnvMock) {
    setBridgeAuthToken('');
    cachedStatus.connected = false;
    notifyListeners();
    return { success: true };
  }

  try {
    const res = await authenticatedFetch('/api/v1/devices/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId })
    });
    const data = await res.json();
    if (res.ok) {
      setBridgeAuthToken('');
      cachedStatus.connected = false;
      notifyListeners();
      return { success: true };
    }
    return { success: false, error: data.message || 'Failed to revoke device' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

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

export function setBridgeAuthToken(token: string): void {
  currentAuthToken = token.trim();
  if (typeof window !== 'undefined') {
    setSecureLocalStorage(STORAGE_KEY_TOKEN, currentAuthToken);
  }
}

export function getBridgeAuthToken(): string {
  return currentAuthToken;
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
 * Centralized authenticated fetch helper with timeout and retry logic
 */
async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
  retries: number = 2,
  timeoutMs: number = 3500
): Promise<Response> {
  const url = path.startsWith('http') ? path : `http://${currentBridgeIp}${path}`;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Authorization') && currentAuthToken) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt === retries) {
        throw err;
      }
      // Exponential backoff delay: 200ms, 400ms...
      await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

/**
 * discoverBridge(): Scan for Pi at http://192.168.4.1:8080 or custom IP.
 */
export async function discoverBridge(customIp?: string): Promise<{
  success: boolean;
  ip: string;
  status: BridgeStatus;
  needsPairing?: boolean;
}> {
  if (customIp) {
    setCustomBridgeIp(customIp);
  }

  const targetIp = currentBridgeIp;

  if (useMockBridge || isEnvMock) {
    startMockUptimeCounter();
    await new Promise((resolve) => setTimeout(resolve, 300));
    cachedStatus = {
      ...cachedStatus,
      connected: true,
      ipAddress: targetIp,
      piBatteryPercent: 87,
      solarVoltage: 14.2,
      solarWatts: 12.4,
    };
    notifyListeners();
    await syncBridgePeersToStore();

    return {
      success: true,
      ip: targetIp,
      status: cachedStatus,
    };
  }

  // Probe public health first
  let isBridgeOnline = false;
  try {
    const healthRes = await fetch(`http://${targetIp}/api/v1/health`, { method: 'GET' });
    if (healthRes.ok) {
      isBridgeOnline = true;
    }
  } catch {
    // Health probe failed
  }

  if (isBridgeOnline) {
    // Attempt authenticated status call
    try {
      const statusRes = await authenticatedFetch('/api/v1/status', { method: 'GET' }, 1, 2500);
      if (statusRes.ok) {
        const data = await statusRes.json();
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
      } else if (statusRes.status === 401) {
        cachedStatus.connected = false;
        notifyListeners();
        return { success: false, needsPairing: true, ip: targetIp, status: cachedStatus };
      }
    } catch {
      // Continue below
    }
  }

  cachedStatus.connected = false;
  notifyListeners();
  return {
    success: false,
    ip: targetIp,
    status: cachedStatus,
  };
}

/**
 * getBridgeStatus(): GET /api/v1/status
 */
export async function getBridgeStatus(): Promise<BridgeStatus> {
  if (useMockBridge || isEnvMock) {
    startMockUptimeCounter();
    cachedStatus.connected = true;
    notifyListeners();
    return cachedStatus;
  }

  try {
    const res = await authenticatedFetch('/api/v1/status', { method: 'GET' });
    if (res.ok) {
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
 * getMeshPeersFromBridge(): GET /api/v1/peers
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
    const res = await authenticatedFetch('/api/v1/peers', { method: 'GET' });
    if (res.ok) {
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
 * syncBridgePeersToStore(): Helper to sync bridge peers into Zustand meshStore
 */
export async function syncBridgePeersToStore(): Promise<BridgePeer[]> {
  const bridgePeers = await getMeshPeersFromBridge();
  useMeshStore.getState().setBridgePeers(bridgePeers);
  return bridgePeers;
}

/**
 * executeBridgeCommand(command, params): POST /api/v1/command
 */
export async function executeBridgeCommand(
  command: string,
  params: Record<string, any> = {}
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (useMockBridge || isEnvMock) {
    if (command === 'broadcast') {
      cachedStatus.relayedPacketsCount += 1;
      notifyListeners();
      return { success: true, data: { txId: `tx-pi-${Date.now()}` } };
    }
    return { success: true, data: {} };
  }

  try {
    const res = await authenticatedFetch('/api/v1/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.message || `Command failed with status ${res.status}`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * sendViaBridge(packet): POST /api/v1/broadcast
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
    const res = await authenticatedFetch('/api/v1/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
    });

    if (res.ok) {
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
 * getAsciiMapFromBridge(): GET /api/v1/map/ascii
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
    const res = await authenticatedFetch('/api/v1/map/ascii', {
      method: 'GET',
      headers: { Accept: 'text/plain' },
    });
    if (res.ok) {
      const text = await res.text();
      return text;
    }
  } catch (err) {
    console.warn('[PiBridge] Could not fetch ASCII map from Pi', err);
  }

  return '';
}

import { IPiBridge } from '../types';

export const piBridgeService: IPiBridge = {
  discoverBridge,
  getBridgeStatus,
  getMeshPeersFromBridge,
  syncBridgePeersToStore,
  executeBridgeCommand,
  sendViaBridge,
  getAsciiMapFromBridge,
  setCustomBridgeIp,
  getCustomBridgeIp,
  setBridgeAuthToken,
  getBridgeAuthToken,
  getClientId,
  setClientId,
  startPairing,
  confirmPairing,
  revokeDevice,
  setMockBridgeMode,
  isMockBridgeMode,
  subscribeBridgeStatus,
};
