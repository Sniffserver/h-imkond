/**
 * HÕIMU Mesh Transport Abstraction Layer
 * Defines unified interfaces for multi-bearer physical and simulated mesh transports:
 * - BroadcastChannel (Development / multi-tab)
 * - Loopback (Unit and integration tests)
 * - BLE (Android Bluetooth Low Energy)
 * - Wi-Fi Aware / Wi-Fi Direct (Android Local P2P)
 * - LoRa Bridge (Raspberry Pi Zero 2 W / SX1262 868MHz transceiver)
 */

export type TransportType = 
  | 'broadcast_channel'
  | 'loopback'
  | 'ble'
  | 'wifi_aware'
  | 'lora_bridge';

export type TransportPolicyMode = 'normal' | 'emergency' | 'test';

export type MeshPacketType = 
  | 'MESSAGE'
  | 'CRDT_SYNC'
  | 'PEER_ANNOUNCE'
  | 'SOS'
  | 'PING'
  | 'PONG';

export interface MeshPacketFlags {
  isEncrypted?: boolean;
  isPriority?: boolean;
  ackRequested?: boolean;
}

export interface MeshPacket<T = any> {
  // === Canonical Mesh Wire & Storage Packet Model (Requirement 3) ===
  id?: string;                 // Unique packet identifier for deduplication
  origin?: string;             // Originator node ID / callsign (e.g. "TAL-01")
  destination?: string;        // Target node ID / callsign, or "*" for broadcast
  sequence?: number;           // Monotonically increasing sequence number from origin
  createdAt?: number;          // Epoch timestamp (ms) when packet was generated
  expiresAt?: number;          // Epoch timestamp (ms) when packet becomes invalid / dropped
  ttl: number;                // Remaining Time-To-Live hop budget
  hop?: number;               // Number of network hops traversed
  type?: MeshPacketType;       // Typed packet category
  flags?: MeshPacketFlags;    // Bitmask packet flags
  payload: T;                 // Typed packet payload
  signature?: string;         // Cryptographic Ed25519 signature (hex)

  // Physical bearer metadata
  transportMeta?: {
    originTransport?: TransportType;
    rssi?: number;
    snr?: number;
    frequencyMhz?: number;
  };

  // Boundary compatibility getters/aliases
  packetId?: string;
  originId?: string;
  destinationId?: string;
  senderId?: string;
  senderCallsign?: string;
  targetId?: string;
  targetCallsign?: string;
  routeId?: string;
  hopCount?: number;
  timestamp?: number;
}

export interface SendResult {
  success: boolean;
  transport: TransportType;
  txId?: string;
  recipientCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface TransportPeer {
  id: string;
  callsign: string;
  transport: TransportType;
  rssi?: number;
  lastSeen: number;
  deviceInfo?: string;
  isOnline: boolean;
  hopDistance?: number;
}

export interface MeshTransport {
  readonly id: string;
  readonly name: string;
  readonly type: TransportType;
  readonly isPhysical: boolean;

  /**
   * Check whether this transport is supported and available in the current environment
   */
  isAvailable(): Promise<boolean> | boolean;

  /**
   * Initialize and start listening on this transport
   */
  start(): Promise<void>;

  /**
   * Stop listening and close any sockets / BLE scans / channels
   */
  stop(): Promise<void>;

  /**
   * Discover available peers currently reachable via this transport
   */
  discover(): Promise<TransportPeer[]>;

  /**
   * Send a mesh packet across this transport
   */
  send(packet: MeshPacket): Promise<SendResult>;

  /**
   * Subscribe to incoming packets received over this transport
   */
  subscribe(
    handler: (packet: MeshPacket) => Promise<void> | void
  ): () => void;
}
