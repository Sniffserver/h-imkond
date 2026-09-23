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

export type MeshPacketType = 
  | 'MESSAGE'
  | 'CRDT_SYNC'
  | 'PEER_ANNOUNCE'
  | 'SOS'
  | 'PING'
  | 'PONG';

export interface MeshPacket<T = any> {
  // === Canonical Mesh Routing Protocol Headers ===
  packetId?: string;          // Unique packet identifier for deduplication
  originId?: string;          // Originator node identity / callsign
  destinationId?: string;     // Target node ID / callsign, or "broadcast" / "*"
  ttl: number;                // Remaining Time-To-Live hop budget
  sequence?: number;          // Monotonically increasing sequence number from origin
  createdAt?: number;         // Epoch timestamp (ms) when packet was generated
  expiresAt?: number;         // Epoch timestamp (ms) when packet becomes invalid / dropped
  routeId?: string;           // Path trace hash or route identifier
  hopCount: number;           // Number of network hops traversed
  payload: T;                 // Typed packet payload (CRDT, message, SOS, beacon, etc.)
  signature?: string;         // Cryptographic Ed25519 signature over headers + payload

  // === Compatibility Aliases & Transport Metadata ===
  id?: string;                // Alias for packetId
  type?: MeshPacketType;      // Packet type indicator
  senderId?: string;          // Alias / immediate hop sender ID
  senderCallsign?: string;    // Alias / immediate hop sender callsign
  targetId?: string;          // Alias for destinationId
  targetCallsign?: string;    // Alias for destinationId
  timestamp?: number;         // Alias for createdAt
  transportMeta?: {
    originTransport?: TransportType;
    rssi?: number;
    snr?: number;
    frequencyMhz?: number;
  };
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
