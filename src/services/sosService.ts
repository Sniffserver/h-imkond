import { SOSPacket } from '../types';
import { INITIAL_USER } from '../data/initialData';

const SOS_STORAGE_KEY = 'hoimu_sos_history';
const SOS_SYNC_CHANNEL = 'hoimu_sos_emergency_channel';

let sosHistory: SOSPacket[] = [];
let activeAlerts: SOSPacket[] = [];
const listeners: Set<(alerts: SOSPacket[]) => void> = new Set();
let sosChannel: BroadcastChannel | null = null;
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
 * Handle incoming emergency SOS packet from mesh / broadcast channel
 */
function handleIncomingSosPacket(packet: SOSPacket) {
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

  // Store-and-forward relay if TTL > 1
  if (normalizedPacket.ttl > 1) {
    const relayedPacket: SOSPacket = {
      ...normalizedPacket,
      ttl: normalizedPacket.ttl - 1,
    };
    broadcastPacketToChannel(relayedPacket);
  }

  notifyListeners();
}

function broadcastPacketToChannel(packet: SOSPacket) {
  if (sosChannel) {
    try {
      sosChannel.postMessage(packet);
    } catch {
      // Channel error fallback
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hoimu_sos_broadcast_packet', JSON.stringify({ ...packet, _nonce: Math.random() }));
    } catch {
      // Storage error fallback
    }
  }
}

/**
 * Initialize SOS emergency service listeners and BroadcastChannel
 */
export function initSosService(): void {
  if (isInitialized) return;

  loadFromLocalStorage();

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
 * Broadcast an emergency SOS packet across the mesh.
 * - TTL: 10
 * - Priority: MAX
 * - Bypasses normal sync throttling
 */
export async function broadcastSOS(reason?: string, customLat?: number, customLng?: number): Promise<SOSPacket> {
  initSosService();

  const user = INITIAL_USER;
  const lat = customLat ?? 47.6062; // Default Cascadia / Seattle regional lat
  const lng = customLng ?? -122.3321; // Default Cascadia / Seattle regional lng
  const timestamp = Date.now();
  const packetId = `sos_${user.callsign}_${timestamp}`;

  const packet: SOSPacket = {
    type: 'SOS',
    from: user.callsign,
    lat,
    lng,
    timestamp,
    ttl: 10, // High relay TTL for emergency flood routing
    reason: reason || 'EMERGENCY BEACON ACTIVATED — IMMEDIATE ASSISTANCE REQUIRED',
    id: packetId,
    acknowledged: false,
  };

  // Add to local history
  sosHistory.unshift(packet);
  saveToLocalStorage();

  // Immediate mesh flood broadcast (bypasses queue throttling)
  broadcastPacketToChannel(packet);

  notifyListeners();
  return packet;
}

/**
 * Acknowledge an active SOS alert, marking it as dismissed
 */
export function acknowledgeSos(idOrFrom: string): void {
  initSosService();

  let updated = false;

  sosHistory = sosHistory.map((packet) => {
    if (packet.id === idOrFrom || packet.from.toLowerCase() === idOrFrom.toLowerCase()) {
      if (!packet.acknowledged) {
        updated = true;
        const acked = { ...packet, acknowledged: true };
        // Broadcast acknowledgement to other mesh nodes
        broadcastPacketToChannel(acked);
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
  // Immediate invocation with current active alerts
  callback(getActiveSosAlerts());
  return () => {
    listeners.delete(callback);
  };
}
