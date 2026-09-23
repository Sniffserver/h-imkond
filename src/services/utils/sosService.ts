import { SOSPacket } from '../../types';
import { INITIAL_USER } from '../../data/initialData';
import { meshTransportManager } from '../mesh/transport/MeshTransportManager';
import { executeBridgeCommand } from '../comms/piBridge';

const SOS_STORAGE_KEY = 'hoimu_sos_history';
const SOS_SYNC_CHANNEL = 'hoimu_sos_emergency_channel';

let sosHistory: SOSPacket[] = [];
let activeAlerts: SOSPacket[] = [];
const listeners: Set<(alerts: SOSPacket[]) => void> = new Set();
let sosChannel: BroadcastChannel | null = null;
let transportUnsub: (() => void) | null = null;
let isInitialized = false;

function notifyListeners() {
  const currentActive = getActiveSosAlerts();
  listeners.forEach((cb) => {
    try {
      cb(currentActive);
    } catch (err) {
      console.error('[SosService] Listener error:', err);
    }
  });
}

function saveToLocalStorage() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(sosHistory));
    } catch {
      // Storage quota fallback
    }
  }
}

function loadFromLocalStorage() {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SOS_STORAGE_KEY);
      if (raw) {
        sosHistory = JSON.parse(raw);
        activeAlerts = sosHistory.filter((packet) => !packet.acknowledged);
      }
    } catch {
      sosHistory = [];
      activeAlerts = [];
    }
  }
}

/**
 * Handle incoming emergency SOS packet from physical mesh transports (LoRa / BLE / WiFi) or BroadcastChannel
 */
export function handleIncomingSosPacket(packet: SOSPacket) {
  if (!packet || packet.type !== 'SOS' || !packet.from) return;

  const packetId = packet.id || `sos_${packet.from}_${packet.timestamp}`;
  const normalizedPacket: SOSPacket = {
    ...packet,
    id: packetId,
  };

  // Check if packet already exists
  const existingIdx = sosHistory.findIndex((p) => p.id === packetId || (p.from === packet.from && Math.abs(p.timestamp - packet.timestamp) < 2000));

  if (existingIdx >= 0) {
    if (packet.acknowledged && !sosHistory[existingIdx].acknowledged) {
      sosHistory[existingIdx].acknowledged = true;
      saveToLocalStorage();
      notifyListeners();
    }
    return;
  }

  // New incoming SOS packet!
  sosHistory.unshift(normalizedPacket);
  saveToLocalStorage();

  // Store-and-forward relay if TTL > 1 across multi-bearer RF mesh
  if (normalizedPacket.ttl > 1) {
    const relayedPacket: SOSPacket = {
      ...normalizedPacket,
      ttl: normalizedPacket.ttl - 1,
    };
    broadcastPacketToRadioAndChannel(relayedPacket);
  }

  notifyListeners();
}

/**
 * Broadcasts packet across physical RF transports (LoRa, BLE, WiFi Aware) and local sync channels
 */
async function broadcastPacketToRadioAndChannel(packet: SOSPacket) {
  // 1. BroadcastChannel (local cross-tab sync)
  if (sosChannel) {
    try {
      sosChannel.postMessage(packet);
    } catch {
      // Channel error fallback
    }
  }

  // 2. Storage fallback for local web session isolation
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hoimu_sos_broadcast_packet', JSON.stringify({ ...packet, _nonce: Math.random() }));
    } catch {
      // Storage error fallback
    }
  }

  // 3. Multi-bearer physical Mesh Transport (BLE Coded PHY, WiFi Aware, LoRa Bridge)
  try {
    await meshTransportManager.send({
      id: packet.id || `mesh_sos_${Date.now()}`,
      type: 'SOS',
      senderId: packet.from,
      senderCallsign: packet.from,
      targetId: 'broadcast',
      targetCallsign: '*',
      payload: packet,
      timestamp: packet.timestamp,
      ttl: packet.ttl,
      hopCount: 0,
    });
  } catch (e) {
    console.warn('[SosService] MeshTransportManager broadcast warning:', e);
  }

  // 4. Direct LoRa Radio Gateway flood via Pi Zero 2 W Bridge if reachable
  try {
    await executeBridgeCommand('broadcast', {
      type: 'sos',
      payload: packet,
    });
  } catch {
    // Pi Bridge offline / disconnected fallback
  }
}

/**
 * Attempt to retrieve device GPS coordinates
 */
async function getDeviceCoordinates(customLat?: number, customLng?: number): Promise<{ lat?: number; lng?: number; locationUnavailable: boolean }> {
  if (customLat !== undefined && customLng !== undefined) {
    return { lat: customLat, lng: customLng, locationUnavailable: false };
  }

  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2000,
          maximumAge: 60000,
          enableHighAccuracy: true,
        });
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        locationUnavailable: false,
      };
    } catch {
      // GPS not available or denied
    }
  }

  return {
    locationUnavailable: true,
  };
}

/**
 * Initialize SOS emergency service listeners and physical transport subscribers
 */
export function initSosService(): void {
  if (isInitialized) return;

  loadFromLocalStorage();

  // Multi-bearer mesh listener for emergency packets
  if (!transportUnsub) {
    transportUnsub = meshTransportManager.subscribe((meshPacket) => {
      if (meshPacket.type === 'SOS' || (meshPacket.payload && meshPacket.payload.type === 'SOS')) {
        handleIncomingSosPacket(meshPacket.payload as SOSPacket);
      }
    });
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      sosChannel = new BroadcastChannel(SOS_SYNC_CHANNEL);
      sosChannel.onmessage = (event) => {
        handleIncomingSosPacket(event.data);
      };
    } catch (e) {
      console.warn('[SosService] BroadcastChannel init warning:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === 'hoimu_sos_broadcast_packet' && event.newValue) {
        try {
          const packet = JSON.parse(event.newValue) as SOSPacket;
          handleIncomingSosPacket(packet);
        } catch {
          // Parse error fallback
        }
      }
    });
  }

  isInitialized = true;
}

/**
 * Broadcast an emergency SOS packet across the mesh and physical radio layers.
 * - TTL: 10 (Emergency flood routing)
 * - Priority: CRITICAL / MAX
 * - Coordinates: Genuine GPS from device or marked locationUnavailable (no fake defaults)
 */
export async function broadcastSOS(reason?: string, customLat?: number, customLng?: number): Promise<SOSPacket> {
  initSosService();

  const user = INITIAL_USER;
  const coords = await getDeviceCoordinates(customLat, customLng);
  const timestamp = Date.now();
  const packetId = `sos_${user.callsign}_${timestamp}`;

  const packet: SOSPacket = {
    type: 'SOS',
    from: user.callsign,
    lat: coords.lat,
    lng: coords.lng,
    locationUnavailable: coords.locationUnavailable,
    timestamp,
    ttl: 10, // High relay TTL for emergency flood routing
    reason: reason || 'EMERGENCY BEACON ACTIVATED — IMMEDIATE ASSISTANCE REQUIRED',
    id: packetId,
    acknowledged: false,
  };

  // Add to local history
  sosHistory.unshift(packet);
  saveToLocalStorage();

  // Transmit over real RF physical bearers and gateway channels
  await broadcastPacketToRadioAndChannel(packet);

  notifyListeners();
  return packet;
}

/**
 * Acknowledge an active SOS alert, marking it as dismissed and propagating the ACK over RF
 */
export function acknowledgeSos(idOrFrom: string): void {
  initSosService();

  let updated = false;

  sosHistory = sosHistory.map((packet) => {
    if (packet.id === idOrFrom || packet.from.toLowerCase() === idOrFrom.toLowerCase()) {
      if (!packet.acknowledged) {
        updated = true;
        const acked = { ...packet, acknowledged: true };
        // Broadcast acknowledgement to other mesh nodes over RF & channel
        broadcastPacketToRadioAndChannel(acked);
        return acked;
      }
    }
    return packet;
  });

  if (updated) {
    saveToLocalStorage();
    notifyListeners();
  }
}

/**
 * Clear SOS history state for test isolation
 */
export function clearSosServiceForTesting(): void {
  sosHistory = [];
  activeAlerts = [];
  isInitialized = false;
  listeners.clear();
  if (transportUnsub) {
    transportUnsub();
    transportUnsub = null;
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SOS_STORAGE_KEY);
      localStorage.removeItem('hoimu_sos_broadcast_packet');
    } catch {}
  }
}

/**
 * Get active (unacknowledged) SOS alerts
 */
export function getActiveSosAlerts(): SOSPacket[] {
  initSosService();
  return sosHistory.filter((p) => !p.acknowledged);
}

/**
 * Get all SOS history records
 */
export function getAllSosHistory(): SOSPacket[] {
  initSosService();
  return sosHistory;
}

/**
 * Subscribe to active SOS alert updates
 */
export function subscribeToSos(callback: (alerts: SOSPacket[]) => void): () => void {
  initSosService();
  listeners.add(callback);
  callback(getActiveSosAlerts());
  return () => {
    listeners.delete(callback);
  };
}
