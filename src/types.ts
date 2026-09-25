export type ResourceCategory = 
  | 'Energy' 
  | 'Tools' 
  | 'Skills' 
  | 'Food' 
  | 'Care & Housing' 
  | 'Bio-Remedy'
  | 'Electronics';

export type ReputationTier = 'Steward' | 'Verified Peer' | 'Neighbor' | 'New Kin';

export type SentimentType = 'positive' | 'neutral' | 'growth';

export type TransactionStatus = 'pending' | 'active' | 'completed';

export type ConnectionState = 'direct' | 'relayed' | 'store_forward';

export type PrimarySection = 'now' | 'explore' | 'connect' | 'exchange' | 'more';

export type Screen = 
  | 'home'
  | 'map'
  | 'messages'
  | 'resources'
  | 'journal'
  | 'profile'
  | 'settings'
  | 'diagnostics';

export type NavTab = 
  | 'today'
  | 'home' 
  | 'nearby' 
  | 'messages' 
  | 'sos' 
  | 'more' 
  | 'connect' 
  | 'help' 
  | 'mesh' 
  | 'map' 
  | 'pathfinder' 
  | 'exchange' 
  | 'journal' 
  | 'profile';

export type AppLanguage = 'ET' | 'EN';

export type TopologyFilter = 'all' | 'direct' | 'relayed' | 'store_forward';

export interface SymbiosisWeeklyPoint {
  weekLabel: string;
  dateRange: string;
  score: number;
  delta: number;
  reflectionCount: number;
  highlight: string;
}

// =========================================================================
// CANONICAL GEOGRAPHIC DOMAIN MODEL (HÕIMU Explore — One Coordinate System)
// =========================================================================

export interface GeoPoint {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  timestamp?: number;
  altitude?: number;
  accuracy?: number;
}

export interface GeoFix extends GeoPoint {
  accuracyMeters: number;
  timestamp: number;
  altitudeMeters?: number;
  speedMps?: number;
  headingDeg?: number;
}

export type LocationState =
  | {
      status: 'live';
      position: GeoPoint;
      accuracyMeters: number;
      timestamp: number;
    }
  | {
      status: 'stale';
      position: GeoPoint;
      accuracyMeters: number;
      timestamp: number;
    }
  | {
      status: 'unavailable';
    };

export type GeoLineString = {
  coordinates: [number, number][]; // [lng, lat] GeoJSON format
};

export type DataSource =
  | 'osm'
  | 'tallinn'
  | 'paasteamet'
  | 'ppa'
  | 'hoimu'
  | 'sensor'
  | 'derived'
  | 'community'
  | 'fixture';

export interface DataDiscrepancy {
  sourceA: string;
  sourceB: string;
  field: string;
  valueA: string;
  valueB: string;
  warningNote?: string;
}

export interface GeoEntity {
  id: string;
  source: DataSource;
  sourceId?: string;
  updatedAt: number;
}

export interface StreetSegment {
  id: string;
  streetId: string;
  start: GeoPoint;
  end: GeoPoint;
  lengthMeters: number;
  discoveryState: 'unexplored' | 'discovered';
  discoveredAt?: number;
}

export interface Street {
  id: string;
  name: string;
  geometry: GeoLineString;
  highwayClass: string;
  walkable: boolean;
  bicycle: boolean;
  access?: string;
  lengthMeters?: number;
  discoveredMeters?: number;
  exploredPercent?: number;
  segments?: StreetSegment[];
  district?: string;
}

export type PoiCategory =
  | 'safety'
  | 'tools'
  | 'food'
  | 'water'
  | 'medical'
  | 'shelter'
  | 'repair'
  | 'permaculture'
  | 'energy'
  | 'community'
  | 'library'
  | 'cafe'
  | 'hardware'
  | 'reuse'
  | 'transit'
  | 'historic'
  | (string & {});

export type PlaceMainCategory =
  | 'safety'
  | 'tools'
  | 'stores'
  | 'finds'
  | 'water'
  | 'nature'
  | 'energy'
  | 'community';

export type PlaceSubCategory =
  // Safety
  | 'police'
  | 'fire_station'
  | 'medical'
  | 'hospital'
  | 'pharmacy'
  | 'shelter'
  | 'emergency_services'
  // Tools
  | 'hardware'
  | 'diy'
  | 'tools'
  | 'power_tools'
  | 'tool_hire'
  | 'computer_hardware'
  | 'electronics'
  | 'electrical'
  | 'plumbing'
  | 'bicycle_shop'
  | 'auto_parts'
  // Stores
  | 'supermarket'
  | 'convenience'
  | 'general_store'
  | 'shopping_centre'
  | 'market'
  | 'department_store'
  | 'specialty'
  | 'fuel'
  // Finds
  | 'second_hand'
  | 'reuse'
  | 'give_box'
  | 'public_bookcase'
  | 'tool_library'
  | 'flea_market'
  | 'marketplace'
  | 'repair_cafe'
  | 'makerspace'
  | 'charity_shop'
  // Water
  | 'spring'
  | 'tap'
  | 'hydrant'
  | 'well'
  // Nature
  | 'park'
  | 'forest'
  | 'green_area'
  | 'garden'
  // Energy & Community
  | 'solar_hub'
  | 'charging'
  | 'library'
  | 'community_center'
  | (string & {});

export interface MapPlace {
  id: string;
  name: string;
  location: GeoPoint;
  mainCategory: PlaceMainCategory;
  subCategory: PlaceSubCategory;
  source: DataSource;
  sourceName?: string;
  sourceId?: string;
  secondarySource?: DataSource;
  secondarySourceName?: string;
  hasMismatch?: boolean;
  mismatchDetails?: string;
  discrepancies?: DataDiscrepancy[];
  provenanceStatus:
    | 'official'
    | 'osm'
    | 'community'
    | 'observed'
    | 'derived'
    | 'conflict'
    | 'unknown';
  observedByNodes?: number;
  lastConfirmed?: string;
  snapshotDate?: string;
  updatedDaysAgo?: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  description?: string;
  distanceMeters?: number;
  tags?: Record<string, string>;
}

export interface Poi {
  id: string;
  name: string;
  location: GeoPoint;
  category: PoiCategory;
  source: DataSource;
  sourceId?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  address?: string;
  tags?: Record<string, string>;
  description?: string;
}

export interface MapTransform {
  scale: number;        // Zoom level (0.5 to 5.0)
  rotation: number;     // Radians (0 to 2*PI)
  offsetX: number;      // Pan offset X in screen pixels
  offsetY: number;      // Pan offset Y in screen pixels
}

export interface VectorStreet {
  name: string;
  points: [number, number][];
  width: number;
  type: 'primary' | 'secondary' | 'trail';
}

export interface VectorZone {
  name: string;
  type: 'water' | 'park' | 'urban';
  points: [number, number][];
}

export interface VectorLandmark {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'hub' | 'historic' | 'eco' | 'water' | 'station';
}

export type SurvivalPoiCategory = 'Tools' | 'Bikes' | 'Medical' | 'Food' | 'Station' | (string & {});

export interface SurvivalPoi {
  id: string;
  name: string;
  category: SurvivalPoiCategory;
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
  location?: GeoPoint;
  description?: string;
}

export interface CityMapData {
  id: string;
  cityName: string;
  country: string;
  bioregionName: string;
  centerCoordsText: string;
  centerCoords?: [number, number];
  description: string;
  version?: string;
  routingSnapshotVersion?: string;
  attribution?: string;
  streets: VectorStreet[];
  zones: VectorZone[];
  landmarks: VectorLandmark[];
  districts: { name: string; x: number; y: number }[];
  survivalPois?: SurvivalPoi[];
}

export interface MapPin {
  id: string;
  type: 'node' | 'resource';
  title: string;
  callsign: string;
  category?: ResourceCategory;
  x: number; // Simulated grid coordinate (-100 to 100)
  y: number; // Simulated grid coordinate (-100 to 100)
  distanceKm: number;
  reputationTier?: ReputationTier;
  rssi?: number;
  hopDistance?: number;
  connectionState?: ConnectionState;
  isActive?: boolean;
}

export interface UserProfile {
  id: string;
  callsign: string;
  bio: string;
  skills: string[];
  offeredResources: string[];
  symbiosisScore: number;
  completedExchanges: number;
  meshVisible: boolean;
  isMeshVisible?: boolean;
  avatarSeed: string;
  bioregion?: string;
  deviceNodeId?: string;
  symbiosisHistory: { date: string; score: number }[];
  exploredStreets?: string[];
  streakDays?: number;
  lastWalkDate?: string;
  relayedPackets?: number;
  relayReliability?: number;
  forceLandscapeMap?: boolean;
}

export type PeerRadioType = 'BLE' | 'Wi-Fi Direct';

export interface MeshNode {
  id: string;
  callsign: string;
  bio: string;
  skills: string[];
  lastRssi: number; // dBm e.g. -48 dBm
  hopDistance: number; // 1 = direct, 2 = relayed, 3+ = store_forward
  lastSeen: string;
  trustScore: number; // 0 - 100
  reputationScore?: number;
  reputationTier?: string;
  endorsementsCount?: number;
  role?: string;
  cityId?: string;
  publicKey?: string;
  completedExchanges: number;
  relayReliability: number; // percentage e.g. 99.1
  isDirect: boolean;
  connectionState: ConnectionState;
  avatarSeed: string;
  recentInteractions: number[]; // e.g. [12, 18, 14, 22, 28, 35, 42]
  angle: number; // Polar radar angle in degrees
  distanceRatio: number; // 0 to 1 distance from center in radar
  radioType?: PeerRadioType;
  linkQualityPercent?: number; // 0-100%
  channelOrFrequency?: string; // e.g. 'BLE Ch 37' or 'Wi-Fi Direct Ch 6'
  relayedPackets?: number;
}

export interface MeshLeaderboardNode {
  id: string;
  callsign: string;
  bio?: string;
  avatarSeed: string;
  isCurrentUser: boolean;
  relayedPackets: number;
  relayReliability: number;
  packetDeliveryRatio: number;
  airtimeMinutes: number;
  primaryMedium: 'LoRa 868MHz' | 'BLE 5.0 Coded' | 'Wi-Fi Direct P2P';
  tierTitle: string;
  tierBadgeColor: string;
  symbiosisRewardPoints: number;
  recentPacketTypes: { type: string; count: number; iconName?: string }[];
  weeklyRelayHistory: number[];
  uptimePercentage: number;
  solarPowered: boolean;
  rank?: number;
}

export interface ResourceItem {
  id: string;
  ownerId: string;
  ownerCallsign: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type?: 'offer' | 'request';
  imageUrl?: string;
  location?: GeoPoint;
  coordinates?: { x: number; y: number; name?: string };
  distanceKm: number;
  createdAt: number;
  isActive: boolean;
  availabilityText: string;
  avatarSeed: string;
  ownerReputationTier?: ReputationTier;
  ownerCompletedExchanges?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizerCallsign: string;
  category: 'Workshop' | 'Workday' | 'Equipment Sharing' | 'Community Meal' | 'Assembly';
  attendeesCount: number;
  isUserAttending?: boolean;
  maxCapacity?: number;
}

export interface SkillExchangeItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  skillCategory?: string;
  providerCallsign: string;
  teacherCallsign?: string;
  type: 'offer' | 'request';
  experienceLevel?: string;
  locationNote?: string;
  availabilityText?: string;
  availability?: string;
  sessionFormat?: string;
  prerequisites?: string;
  desiredTrade?: string;
  sessionRequestsCount?: number;
  createdAt?: number;
  endorsementsCount: number;
  isVerified?: boolean;
  tags?: string[];
  endorsements?: Array<{
    id: string;
    endorserCallsign: string;
    rating: number;
    comment: string;
    timestamp: number;
    signatureHash: string;
    isTradeVerified: boolean;
    tags?: string[];
  }>;
}

export interface TrustEndorsement {
  id: string;
  transactionId?: string;
  endorserCallsign: string;
  recipientCallsign: string;
  signatureHash: string;
  timestamp: number;
  comment: string;
  reputationBonus: number;
  skillId?: string;
  skillTitle?: string;
  rating?: number;
  tags?: string[];
  isTradeVerified?: boolean;
}

export interface CrisisAlert {
  // === Canonical Crisis Alert Model (Requirement 4) ===
  id?: string;
  type: 'Medical' | 'Power Outage' | 'Search & Rescue' | 'Flood' | 'Fire' | 'General' | 'Other' | 'medical' | 'power' | string;
  severity: 'Critical' | 'Urgent' | 'Info' | 'High' | 'Moderate' | string;
  message: string;
  timestamp?: number;
  location?: { lat: number; lng: number; name?: string } | string;
  isResolved?: boolean;
  authorCallsign?: string;
  senderCallsign?: string;
  radioChannel?: string;

  // Compatibility getters/aliases
  alertType?: string;
  locationName?: string;
  resolved?: boolean;
}

export interface Transaction {
  id: string;
  resourceId: string;
  resourceTitle: string;
  requesterId: string;
  requesterCallsign: string;
  providerId: string;
  providerCallsign: string;
  status: TransactionStatus;
  createdAt: number;
  completedAt?: number;
  updatedAt?: number;
  reflection?: string;
  isEndorsed?: boolean;
  endorsementHash?: string;
}

export interface JournalEntry {
  id: string | number;
  partnerCallsign: string;
  resourceTitle?: string;
  reflection: string;
  sentiment: SentimentType;
  timestamp: number;
  scoreDelta: number;
}

export interface MeshMessageEnvelope {
  version: 1;
  id: string;
  sender: string;
  recipient: string;
  ephemeralPublicKey: string; // 32-byte X25519 ephemeral public key (hex)
  nonce: string; // 12-byte AES-GCM IV (hex)
  salt: string; // 16-byte HKDF salt (hex)
  ciphertext: string; // Base64 AES-256-GCM ciphertext + tag
  signature: string; // Ed25519 signature (hex)
  senderIdentityKey: string; // 32-byte Ed25519 sender identity key (hex)
  ttl: number;
  createdAt: number;
}

export interface MeshMessage {
  // === Canonical Mesh Message Model (Requirement 4) ===
  id: string;
  from: string;               // NodeId / Callsign (e.g. "TAL-01")
  to: string;                 // NodeId / Callsign or "*" for broadcast
  text?: string;              // Decrypted message text
  timestamp: number;          // Creation epoch timestamp (ms)
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'queued';
  ttl?: number;               // Remaining hop budget
  signature?: string;         // Ed25519 signature

  // E2EE Envelope
  envelope?: MeshMessageEnvelope;
  ephemeralPublicKey?: string;
  nonce?: string;
  senderIdentityKey?: string;

  // Compatibility getters/aliases
  content?: string;
  decryptedText?: string;
  senderId?: string;
  senderCallsign?: string;
  recipientId?: string;
  recipientCallsign?: string;
  rssi?: number;
  hopCount?: number;
  isCrisisAlert?: boolean;
  isRead?: boolean;
  isIncoming?: boolean;
}

export interface SOSPacket {
  type: 'SOS';
  from: string;
  lat?: number;
  lng?: number;
  locationUnavailable?: boolean;
  timestamp: number;
  ttl: number;
  reason?: string;
  id?: string;
  acknowledged?: boolean;
}

export interface BatteryManagerStatus {
  isSolarAwareActive: boolean;
  hasSolarPanels?: boolean;
  wifiDirectSyncEnabled: boolean;
  workManagerIntervalMinutes: number;
  bleBeaconOnly: boolean;
  radarRefreshRateHz: number;
  solarHarvestRateW: number;
  batteryLevelPercent: number;
}

export interface BatteryHistoryPoint {
  timestamp: number;
  timeLabel: string;
  hour: number;
  batteryLevel: number;
  solarHarvestW: number;
  consumptionW: number;
  netPowerW: number;
  activeProtocol: 'BLE' | 'Wi-Fi Direct' | 'Standby' | 'Solar Float';
  modeDescription: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning';
}

export interface CryptoIdentity {
  publicKey: string; // Ed25519 identity signing key
  privateKeyJwk?: string;
  algorithm: string;
  createdAt: number;
  encryptionPublicKey?: string; // X25519 E2EE key agreement public key
  encryptionAlgorithm?: string;
}

export interface WishlistItem {
  id: string;
  keyword: string;
  category?: ResourceCategory | 'all';
  createdAt: number;
  isActive: boolean;
}

export type ProposalCategory = 'Infrastructure' | 'Ecological' | 'Resource Vault' | 'Emergency Protocol';
export type ProposalStatus = 'active' | 'passed' | 'rejected';

export interface DaoProposal {
  id: string;
  title: string;
  description: string;
  category: ProposalCategory;
  authorCallsign: string;
  votesYes: number;
  votesNo: number;
  votesAbstain: number;
  userVoted?: 'yes' | 'no' | 'abstain';
  status: ProposalStatus;
  endsAt: number;
  symbiosisReward: number;
  requiredQuorum: number;
  crdtHash?: string;
  executionProof?: string;
  executedAt?: number;
}

// Canonical Wire & Storage Packet Model (Requirement 3)
export type PacketId = string;
export type NodeId = string;
export type Broadcast = '*';

export interface PacketFlags {
  isEncrypted?: boolean;
  isPriority?: boolean;
  ackRequested?: boolean;
  isCompressed?: boolean;
}

export type PacketType =
  | 'MESSAGE'
  | 'CRDT_SYNC'
  | 'PEER_ANNOUNCE'
  | 'SOS'
  | 'PING'
  | 'PONG'
  | 'ACK'
  | 'ROUTING_UPDATE';

export interface MeshPacket<T = any> {
  id: PacketId;
  origin: NodeId;
  destination: NodeId | Broadcast;
  sequence: number;

  createdAt: number;
  expiresAt: number;

  ttl: number;
  hop: number;

  type: PacketType;
  flags: PacketFlags;

  payload: T;
  signature: Uint8Array | string;

  // Physical bearer / diagnostic metadata
  transportMeta?: {
    originTransport?: string;
    rssi?: number;
    snr?: number;
    frequencyMhz?: number;
  };

  // Boundary compatibility aliases
  packetId?: PacketId;
  originId?: NodeId;
  destinationId?: NodeId | Broadcast;
  senderId?: NodeId;
  senderCallsign?: string;
  targetId?: NodeId | Broadcast;
  targetCallsign?: string;
}

// Network Diagnostics Telemetry Types
export type MeshFrameType =
  | 'BEACON_ADV'
  | 'ROUTE_REQ'
  | 'ROUTE_REP'
  | 'ACK'
  | 'STORE_FORWARD_BUNDLE'
  | 'CRDT_SYNC'
  | 'DIRECT_MSG'
  | 'SOS_BROADCAST'
  | 'TELEMETRY';

export interface MeshPacketLog {
  id: string;
  timestamp: number;
  frameType: MeshFrameType;
  sourceCallsign: string;
  sourceNodeId: string;
  destCallsign: string;
  destNodeId: string;
  hopCount: number;
  maxHops: number;
  rssi: number;
  snr: number;
  payloadBytes: number;
  payloadSummary: string;
  crcValid: boolean;
  encrypted: boolean;
  rawPayloadJson?: string;
}

export interface MeshChannelTelemetry {
  channelId: string;
  name: string;
  frequencyMhz: number;
  protocol: 'BLE 5.0 Coded PHY' | 'Wi-Fi Direct P2P' | 'LoRa LongFast 868MHz';
  utilizationPercent: number;
  noiseFloorDbm: number;
  txDutyCyclePercent: number;
  activePacketsCount: number;
  isThrottled?: boolean;
}

export interface NodeTracerouteHop {
  hopIndex: number;
  nodeId: string;
  callsign: string;
  rssi: number;
  latencyMs: number;
  radioMedium: string;
  linkQualityScore: number;
}

export interface NodeDiagnosticDetail {
  peerId: string;
  lqi: number; // 0 - 255 Link Quality Indicator
  pdrPercent: number; // Packet Delivery Ratio %
  rttMs: number; // Round Trip Time
  jitterMs: number;
  txPackets: number;
  rxPackets: number;
  droppedPackets: number;
  snrDb: number;
  batteryVolts: number;
  airtimeSecs: number;
  bufferQueueCount: number;
  macAddress: string;
}

// ==========================================
// HÕIMU „Pathfinder Mode" Data Models
// ==========================================

// WiFi-võrk
export interface WifiSpot {
  id: string;
  ssid: string;
  bssid: string;        // MAC-aadress (unikaalne võti)
  rssi: number;         // signaali tugevus dBm
  signalDbm?: number;   // alias for rssi in some visualizations
  security: 'open' | 'wpa' | 'wpa2' | 'wpa3';
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  firstSeenAt: number;
  lastSeenAt: number;
  walkSessionId: string;
  channel?: number;
  notes?: string;
}

// Bluetooth-seade
export interface BluetoothSpot {
  id: string;
  deviceName: string;
  address: string;      // MAC
  rssi: number;
  deviceClass?: string; // nt telefon, sülearvuti, sensor, beacon, survivor_tag
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  firstSeenAt: number;
  lastSeenAt: number;
  walkSessionId: string;
  txPower?: number;
  isMeshNode?: boolean;
}

// LoRa-sõlm
export interface LoraNode {
  id: string;
  callsign: string;
  rssi: number;
  snr: number;          // signaali-müra suhe
  frequency: number;    // MHz
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  lastHeardAt: number;
  firstSeenAt?: number;
  walkSessionId?: string;
  hopLimit?: number;
  batteryPercent?: number;
  isRepeater?: boolean;
}

// Kõnniseanss
export interface WalkSession {
  id: string;
  title?: string;
  startedAt: number;
  endedAt: number;
  track: GeoPoint[];    // GPS-jälg
  newWifiSpots: string[];   // spot ID-d, mis on sellel käigul uued
  newBluetoothSpots: string[];
  newLoraNodes: string[];
  totalDistanceMeters?: number;
  notes?: string;
}

export interface PathfinderFilter {
  showWifi: boolean;
  showBluetooth: boolean;
  showLora: boolean;
  showTracks: boolean;
  onlyNewDiscoveries: boolean;
  minRssi: number; // e.g. -95 dBm
}

export interface OfflineMapRegion {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  bioregionName: string;
  centerCoords: { x: number; y: number; lat?: number; lng?: number };
  radiusKm: number;
  worldRadius: number;
  downloadedAt: number;
  sizeBytes: number;
  sizeFormatted: string;
  nodeCount: number;
  resourceCount: number;
  streetSegmentCount: number;
  poiCount: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  cachedNodes: MeshNode[];
  cachedResources: ResourceItem[];
  cachedPoiNames: string[];
  signatureHash?: string;
  isActiveOffline?: boolean;
  isPinned?: boolean;
  tileCount?: number;
}

export type TelemetrySource = 'hardware' | 'measured' | 'estimated' | 'simulated';

export interface TelemetryValue<T> {
  value: T;
  source: TelemetrySource;
  timestamp: number;
  unit?: string;
}

export interface BridgeStatus {
  connected: boolean;
  isSimulated?: boolean;
  ipAddress?: string;
  piBatteryPercent?: number | null;
  solarVoltage?: number | null;
  solarWatts?: number | null;
  radioModules: Array<'ble' | 'lora_868' | 'wifi_direct'>;
  uptimeSeconds?: number | null;
  relayedPacketsCount?: number | null;
  telemetrySource?: TelemetrySource;
  batteryTelemetry?: TelemetryValue<number>;
  solarWattsTelemetry?: TelemetryValue<number>;
  solarVoltageTelemetry?: TelemetryValue<number>;
  uptimeTelemetry?: TelemetryValue<number>;
  latencyTelemetry?: TelemetryValue<number>;
}

export interface BridgePeer {
  id: string;
  rssi: number;
  protocol: 'ble' | 'lora';
  lastHeard: number;
  hops: number;
  callsign?: string;
  role?: string;
  snr?: number;
  latencyMs?: number;
  rssiTelemetry?: TelemetryValue<number>;
  snrTelemetry?: TelemetryValue<number>;
  stateTelemetry?: TelemetryValue<'active' | 'stale' | 'unreachable'>;
  latencyTelemetry?: TelemetryValue<number>;
}




