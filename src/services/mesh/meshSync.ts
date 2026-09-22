import { MeshMessage } from '../../types';
import { INITIAL_USER } from '../../data/initialData';
import { saveIncomingMessage } from '../comms/messageService';
import { useMeshStore } from '../../store/meshStore';

export interface MeshSyncPayload {
  senderId: string;
  senderCallsign: string;
  timestamp: number;
  messages: MeshMessage[]; // max 5 packets per sync (store-and-forward friendly)
  crdtData?: {
    version: number;
    resourceCount?: number;
  };
}

const SYNC_CHANNEL_NAME = 'hoimu_mesh_sync_channel';
const MAX_PACKETS_PER_SYNC = 5;

// Store seen message IDs to prevent relay loops
const seenMessageIds = new Set<string>();

// Outbox of messages awaiting sync/relay
let outboxQueue: MeshMessage[] = [];

let isInitialized = false;
let syncChannel: BroadcastChannel | null = null;
let periodicSyncIntervalMs = 8000;
let periodicSyncTimerId: any = null;

function restartPeriodicSyncTimer() {
  if (typeof window === 'undefined') return;
  if (periodicSyncTimerId) {
    clearInterval(periodicSyncTimerId);
    periodicSyncTimerId = null;
  }
  periodicSyncTimerId = window.setInterval(() => {
    if (outboxQueue.length > 0) {
      triggerMeshSync();
    }
  }, periodicSyncIntervalMs);
}

/**
 * Dynamically adjust the background mesh sync interval (e.g. throttled for low battery <15%)
 */
export function setMeshSyncInterval(intervalMs: number): void {
  periodicSyncIntervalMs = Math.max(1000, intervalMs);
  if (isInitialized) {
    restartPeriodicSyncTimer();
  }
}

export function getMeshSyncInterval(): number {
  return periodicSyncIntervalMs;
}

const syncListeners: Set<(stats: { lastSyncAt: number; queueLength: number }) => void> = new Set();
let lastSyncTimestamp = Date.now();

function notifySyncListeners() {
  syncListeners.forEach((cb) => {
    try {
      cb({ lastSyncAt: lastSyncTimestamp, queueLength: outboxQueue.length });
    } catch (e) {
      console.error('[MeshSync] Listener error:', e);
    }
  });
}

/**
 * Handle incoming mesh sync payload from other browser tabs or simulated radio nodes
 */
async function handleIncomingSyncPayload(payload: MeshSyncPayload) {
  if (!payload || !payload.messages) return;

  const myCallsign = INITIAL_USER.callsign.toLowerCase();

  // Don't process our own broadcast
  if (payload.senderId === INITIAL_USER.id) return;

  lastSyncTimestamp = Date.now();

  // Trigger ripple animation across UI mesh nodes indicating successful data propagation
  try {
    useMeshStore.getState().triggerSyncPulse({
      peerId: payload.senderId,
      callsign: payload.senderCallsign,
      timestamp: payload.timestamp || Date.now(),
      packetCount: payload.messages?.length || 1,
      isBackgroundSync: true,
    });
  } catch (err) {
    console.warn('[MeshSync] Error triggering sync pulse on mesh nodes:', err);
  }

  for (const message of payload.messages) {
    if (!message || !message.id) continue;

    // Check if we've already processed this packet
    if (seenMessageIds.has(message.id)) {
      continue;
    }
    seenMessageIds.add(message.id);

    const targetCallsign = (message.to || message.recipientCallsign || '').toLowerCase();

    if (targetCallsign === myCallsign) {
      // Packet has arrived at destination! Decrypt and save locally
      await saveIncomingMessage(message);
    } else {
      // Store-and-forward relay: Decrement TTL if hops remain
      if (message.ttl > 1) {
        const relayedMessage: MeshMessage = {
          ...message,
          ttl: message.ttl - 1,
          hopCount: (message.hopCount || 1) + 1,
          status: 'pending',
        };

        // Queue for relay in next sync cycle
        queueMessageForSync(relayedMessage);

        // Also save to local storage for store-and-forward persistence
        await saveIncomingMessage(relayedMessage);
      }
    }
  }

  notifySyncListeners();
}

/**
 * Initialize BroadcastChannel and background mesh sync loop
 */
export function initMeshSync(): void {
  if (isInitialized) return;

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannel.onmessage = (event) => {
        handleIncomingSyncPayload(event.data);
      };
    } catch (e) {
      console.warn('[MeshSync] BroadcastChannel init warning:', e);
    }
  }

  // Cross-tab fallback via storage events for broader browser compatibility
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === 'hoimu_mesh_sync_packet' && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          handleIncomingSyncPayload(payload);
        } catch {
          // Ignore parse errors
        }
      }
    });
  }

  // Start opportunistic periodic sync interval (managed dynamically by backgroundSyncAdjuster)
  restartPeriodicSyncTimer();

  isInitialized = true;
}

/**
 * Queue a message for the next CRDT sync burst (max 5 packets per sync)
 */
export function queueMessageForSync(message: MeshMessage): void {
  // Prevent duplicate queuing of same message
  if (!outboxQueue.some((m) => m.id === message.id)) {
    outboxQueue.push(message);
    seenMessageIds.add(message.id);
  }

  notifySyncListeners();

  // Immediately broadcast if channel is ready
  triggerMeshSync();
}

/**
 * Trigger an immediate store-and-forward mesh synchronization round.
 * Takes at most 5 packets from the outbox.
 */
export function triggerMeshSync(): MeshSyncPayload | null {
  if (!isInitialized) {
    initMeshSync();
  }

  if (outboxQueue.length === 0) {
    return null;
  }

  // Max 5 packets per sync (store-and-forward friendly requirement)
  const batch = outboxQueue.splice(0, MAX_PACKETS_PER_SYNC);

  const payload: MeshSyncPayload = {
    senderId: INITIAL_USER.id,
    senderCallsign: INITIAL_USER.callsign,
    timestamp: Date.now(),
    messages: batch,
    crdtData: {
      version: 1,
      resourceCount: 0,
    },
  };

  lastSyncTimestamp = Date.now();

  // 1. BroadcastChannel transmission
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (err) {
      console.warn('[MeshSync] postMessage error:', err);
    }
  }

  // 2. LocalStorage backup broadcast
  try {
    localStorage.setItem(
      'hoimu_mesh_sync_packet',
      JSON.stringify({ ...payload, _nonce: Math.random() })
    );
  } catch {
    // Ignore storage quota limits
  }

  notifySyncListeners();
  return payload;
}

/**
 * Get current sync queue length
 */
export function getSyncQueueLength(): number {
  return outboxQueue.length;
}

/**
 * Subscribe to mesh sync events
 */
export function subscribeToMeshSync(
  callback: (stats: { lastSyncAt: number; queueLength: number }) => void
): () => void {
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
}

/**
 * Triggers a subtle background sync pulse from a peer node,
 * generating the ripple animation on mesh nodes in the UI to indicate successful data propagation.
 */
export function simulatePeerSyncPulse(peerId?: string, callsign?: string): void {
  try {
    const peers = useMeshStore.getState().getPeersArray();
    const targetPeer = peerId
      ? peers.find((p) => p.id === peerId)
      : callsign
      ? peers.find((p) => p.callsign.toLowerCase() === callsign.toLowerCase())
      : peers[Math.floor(Math.random() * Math.max(1, peers.length))];

    const selectedId = targetPeer?.id || peerId || 'peer-radio-pulse';
    const selectedCallsign = targetPeer?.callsign || callsign || 'LEMBITU-GATEWAY';

    useMeshStore.getState().triggerSyncPulse({
      peerId: selectedId,
      callsign: selectedCallsign,
      timestamp: Date.now(),
      packetCount: Math.floor(Math.random() * 3) + 1,
      isBackgroundSync: true,
    });
  } catch (err) {
    console.warn('[MeshSync] simulatePeerSyncPulse failed:', err);
  }
}
