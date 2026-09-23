import { MeshMessage } from '../../types';
import { INITIAL_USER } from '../../data/initialData';
import { saveIncomingMessage } from '../comms/messageService';
import { useMeshStore } from '../../store/meshStore';
import { meshTransportManager } from './transport';
import { seenPacketCache, SeenPacketCache } from './routing/SeenPacketCache';
import { createMeshPacket, isPacketExpired } from './routing/packetProtocol';
import { MeshPacket } from './transport/types';
import { meshDb, PersistentOutboxRecord } from './db/meshDatabase';
import { crdtEventLogEngine, CRDTEvent } from './crdt/signedEventLog';

export interface MeshSyncPayload {
  senderId: string;
  senderCallsign: string;
  timestamp: number;
  messages: MeshMessage[]; // max 5 packets per sync (store-and-forward friendly)
  crdtEvents?: CRDTEvent[]; // Genuine signed CRDT event log delta
  vectorClock?: Record<string, number>; // Version vector snapshot
  crdtData?: {
    version: number;
    resourceCount?: number;
  };
}

export type DeliveryStatus = 'queued' | 'transmitted' | 'relayed' | 'delivered';

export interface QueuedDeliveryItem {
  message: MeshMessage;
  queuedAt: number;
  status: DeliveryStatus;
  transmittedAt?: number;
}

const MAX_PACKETS_PER_SYNC = 5;

// In-memory working cache for pending outbox items (synced with IndexedDB)
let outboxQueue: QueuedDeliveryItem[] = [];
// History of processed deliveries for delivery tracking
let deliveryHistory: Map<string, QueuedDeliveryItem> = new Map();

let isInitialized = false;
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
 * Handle incoming mesh sync payload from other radio nodes or browser tabs (Routing & CRDT State).
 * 
 * Routing semantics:
 * - Checks SeenPacketCache (bounded LRU with expiration) to drop duplicates and loops.
 * - Ingests signed CRDT events into CRDT Event Log engine.
 * - Delivery state (outbox) is completely decoupled from seen packet routing cache.
 */
export async function handleIncomingSyncPayload(payload: MeshSyncPayload, fromTransport?: string) {
  if (!payload) return;

  const myCallsign = INITIAL_USER.callsign.toLowerCase();

  // Don't process our own broadcast
  if (payload.senderId === INITIAL_USER.id) return;

  lastSyncTimestamp = Date.now();

  // 1. Ingest Signed CRDT Events (if present in payload)
  if (payload.crdtEvents && payload.crdtEvents.length > 0) {
    try {
      crdtEventLogEngine.ingestEvents(payload.crdtEvents, true);
    } catch (crdtErr) {
      console.warn('[MeshSync] Error ingesting CRDT events:', crdtErr);
    }
  }

  // Trigger ripple animation across UI mesh nodes indicating successful data propagation
  try {
    useMeshStore.getState().triggerSyncPulse({
      peerId: payload.senderId,
      callsign: payload.senderCallsign,
      timestamp: payload.timestamp || Date.now(),
      packetCount: (payload.messages?.length || 0) + (payload.crdtEvents?.length || 0) || 1,
      isBackgroundSync: true,
    });
  } catch (err) {
    console.warn('[MeshSync] Error triggering sync pulse on mesh nodes:', err);
  }

  if (!payload.messages) return;

  for (const message of payload.messages) {
    if (!message || !message.id) continue;

    // 2. Check Routing State: Has this node already processed/relayed this packet?
    if (seenPacketCache.has(message.id)) {
      continue; // Duplicate / loop prevention: discard silently
    }

    // 3. Ingest packet into Routing State (mark as processed in bounded cache with TTL)
    const packetTtlMs = Math.max(60000, (message.ttl || 3) * 60000);
    seenPacketCache.add(message.id, packetTtlMs, undefined, {
      originId: message.from,
    });

    // Also persist seen packet record
    meshDb.saveSeenPacket({
      packetId: message.id,
      firstSeen: Date.now(),
      expires: Date.now() + packetTtlMs,
      originId: message.from,
    }).catch(() => {});

    const targetCallsign = (message.to || message.recipientCallsign || '').toLowerCase();
    const isBroadcast = targetCallsign === '*' || targetCallsign === 'broadcast';
    const isForMe = targetCallsign === myCallsign;

    if (isForMe || isBroadcast) {
      // Packet has arrived at destination! Decrypt and save locally
      await saveIncomingMessage(message);
    }

    // 4. Store-and-forward relay if packet is not strictly unicast to me and TTL > 1
    if (!isForMe && message.ttl > 1) {
      const relayedMessage: MeshMessage = {
        ...message,
        ttl: message.ttl - 1,
        hopCount: (message.hopCount || 1) + 1,
        status: 'pending',
      };

      // Queue for transmission in next sync burst (Delivery State)
      enqueueMessage(relayedMessage, 'relayed');

      // Persist for offline store-and-forward reliability
      await saveIncomingMessage(relayedMessage);
    }
  }

  notifySyncListeners();
}

/**
 * Initialize MeshTransportManager, persistent DB loading, and background mesh sync loop
 */
export function initMeshSync(): void {
  if (isInitialized) return;

  // Initialize persistent CRDT engine
  crdtEventLogEngine.init().catch((err) => {
    console.warn('[MeshSync] CRDT init warning:', err);
  });

  // Restore pending outbox queue from persistent IndexedDB store
  meshDb.getPendingOutboxItems().then((savedItems) => {
    if (savedItems && savedItems.length > 0) {
      savedItems.forEach((rec) => {
        if (!outboxQueue.some((q) => q.message.id === rec.id)) {
          outboxQueue.push({
            message: rec.message,
            queuedAt: rec.queuedAt,
            status: rec.status,
            transmittedAt: rec.transmittedAt,
          });
        }
      });
      notifySyncListeners();
    }
  }).catch((err) => {
    console.warn('[MeshSync] Outbox load warning:', err);
  });

  // Restore seen packets from persistent DB into cache
  meshDb.loadSeenPackets().then((entries) => {
    if (entries && entries.length > 0) {
      entries.forEach((e) => {
        if (Date.now() < e.expires) {
          seenPacketCache.add(e.packetId, undefined, e.expires, { originId: e.originId });
        }
      });
    }
  }).catch(() => {});

  // Start the underlying multi-bearer transport abstraction (BLE, LoRa, Wi-Fi Direct, BroadcastChannel)
  meshTransportManager.start().catch((err) => {
    console.warn('[MeshSync] Transport manager start warning:', err);
  });

  // Subscribe to packets arriving across ANY physical or simulated transport bearer
  meshTransportManager.subscribe(async (packet: MeshPacket, fromTransport) => {
    if (isPacketExpired(packet)) {
      return; // Discard expired packets
    }

    if (packet.type === 'CRDT_SYNC' || packet.type === 'MESSAGE') {
      const payload: MeshSyncPayload = packet.payload;
      await handleIncomingSyncPayload(payload, fromTransport);
    }
  });

  // Start opportunistic periodic sync interval
  restartPeriodicSyncTimer();

  isInitialized = true;
}

/**
 * Enqueue a message into the local outbox and persists it to IndexedDB without immediate transmission.
 * 
 * Manages LOCAL DELIVERY STATE (outbox).
 * Does NOT mark the packet as seen in the SeenPacketCache (routing state).
 */
export function enqueueMessage(message: MeshMessage, status: DeliveryStatus = 'queued'): QueuedDeliveryItem {
  const existingIdx = outboxQueue.findIndex((item) => item.message.id === message.id);
  const deliveryItem: QueuedDeliveryItem = {
    message,
    queuedAt: Date.now(),
    status,
  };

  if (existingIdx >= 0) {
    outboxQueue[existingIdx] = deliveryItem;
  } else {
    outboxQueue.push(deliveryItem);
  }

  deliveryHistory.set(message.id, deliveryItem);

  // Persist to IndexedDB `hoimu_mesh_db.outbox`
  meshDb.saveOutboxItem({
    id: message.id,
    message,
    queuedAt: deliveryItem.queuedAt,
    status,
  }).catch((err) => {
    console.warn('[MeshSync] Failed to persist outbox record:', err);
  });

  notifySyncListeners();
  return deliveryItem;
}

/**
 * Queue a message for the next CRDT sync burst (max 5 packets per sync) and trigger immediate transmission.
 */
export function queueMessageForSync(message: MeshMessage): MeshSyncPayload | null {
  enqueueMessage(message, 'queued');
  return triggerMeshSync();
}

/**
 * Trigger an immediate store-and-forward mesh synchronization round.
 * Takes at most 5 packets from the outbox and attaches delta CRDT events.
 */
export function triggerMeshSync(): MeshSyncPayload | null {
  if (!isInitialized) {
    initMeshSync();
  }

  const deltaEvents = crdtEventLogEngine.getDeltaEvents(0, 10);
  if (outboxQueue.length === 0 && deltaEvents.length === 0) {
    return null;
  }

  // Max 5 packets per sync (store-and-forward friendly requirement)
  const batchItems = outboxQueue.splice(0, MAX_PACKETS_PER_SYNC);
  const now = Date.now();

  // Update delivery status in memory and IndexedDB
  batchItems.forEach((item) => {
    item.status = 'transmitted';
    item.transmittedAt = now;
    deliveryHistory.set(item.message.id, item);

    meshDb.saveOutboxItem({
      id: item.message.id,
      message: item.message,
      queuedAt: item.queuedAt,
      status: 'transmitted',
      transmittedAt: now,
    }).catch(() => {});
  });

  const batchMessages = batchItems.map((item) => item.message);

  const payload: MeshSyncPayload = {
    senderId: INITIAL_USER.id,
    senderCallsign: INITIAL_USER.callsign,
    timestamp: now,
    messages: batchMessages,
    crdtEvents: deltaEvents.length > 0 ? deltaEvents : undefined,
    vectorClock: crdtEventLogEngine.getVectorClock(),
    crdtData: {
      version: crdtEventLogEngine.getLamportClock() || 1,
      resourceCount: crdtEventLogEngine.getActiveEntities('resource').length,
    },
  };

  lastSyncTimestamp = now;

  // Wrap inside canonical MeshPacket with routing protocol headers
  const meshPacket = createMeshPacket<MeshSyncPayload>({
    originId: INITIAL_USER.id,
    senderCallsign: INITIAL_USER.callsign,
    destinationId: '*',
    type: 'CRDT_SYNC',
    ttl: 3,
    payload,
  });

  meshTransportManager.send(meshPacket).catch((err) => {
    console.warn('[MeshSync] Transport send error:', err);
  });

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
 * Get current outbox items with delivery state
 */
export function getOutboxQueue(): QueuedDeliveryItem[] {
  return [...outboxQueue];
}

/**
 * Get full delivery history map
 */
export function getDeliveryHistory(): Map<string, QueuedDeliveryItem> {
  return new Map(deliveryHistory);
}

/**
 * Access the routing SeenPacketCache
 */
export function getSeenPacketCache(): SeenPacketCache {
  return seenPacketCache;
}

/**
 * Clear mesh sync state for test isolation
 */
export function clearMeshSyncForTesting(): void {
  outboxQueue = [];
  deliveryHistory.clear();
  seenPacketCache.clear();
  meshDb.clearMemoryStorage();
  crdtEventLogEngine.clearForTesting();
  isInitialized = false;
  if (periodicSyncTimerId) {
    clearInterval(periodicSyncTimerId);
    periodicSyncTimerId = null;
  }
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
