import {
  MeshMessage,
  MeshNode,
  UserProfile,
  JournalEntry,
  DaoProposal,
  SOSPacket,
  OfflineMapRegion,
  WalkSession,
  GeoPoint,
  MeshLeaderboardNode,
  BridgeStatus,
  BridgePeer,
} from '../types';
import type { RevealedArea, MapRevealState } from './map/mapRevealService';
import type { Achievement } from './game/achievementService';
import type { SeasonalChallenge } from './game/seasonalChallengeService';
import type { DailyStatPoint, PersonalRecords } from './game/personalStatsService';
import type { StepUpdate } from './utils/pedometerService';
import type { DeadReckoningState, DeadReckoningListener } from './utils/deadReckoning';
import type { PathfinderActiveState } from './scanner/pathfinderScanner';

/**
 * Interface for Cryptographically Authenticated & Encrypted Mesh Messaging
 */
export interface IMessageService {
  initMessageStorage(): Promise<void>;
  getLocalUserCrypto(): Promise<{ publicKeyHex: string; keyPair: CryptoKeyPair }>;
  getLocalUserDualCrypto?(): Promise<{
    identity: { publicKeyHex: string; keyPair: CryptoKeyPair };
    encryption: { publicKeyHex: string; keyPair: CryptoKeyPair };
  }>;
  getPeerPublicKey(peerCallsignOrId: string): string;
  getPeerEncryptionKey?(peerCallsignOrId: string): Promise<string>;
  encryptWithPublicKey(plaintext: string, recipientPublicKeyHex: string): Promise<string>;
  decryptWithKey(encryptedBase64: string, expectedKeyHex?: string): Promise<string>;
  sendDirectMessage(peerId: string, content: string): Promise<MeshMessage>;
  getConversation(peerId: string): Promise<MeshMessage[]>;
  getUnreadCount(): Promise<number>;
  markConversationAsRead(peerId: string): Promise<void>;
  saveIncomingMessage(message: MeshMessage): Promise<boolean>;
  subscribeToMessages(callback: () => void): () => void;
}

/**
 * Interface for Raspberry Pi Zero 2 W Hardware Gateway Bridge
 */
export interface IPiBridge {
  discoverBridge(customIp?: string): Promise<{ success: boolean; ip: string; status: BridgeStatus; needsPairing?: boolean }>;
  getBridgeStatus(): Promise<BridgeStatus>;
  getMeshPeersFromBridge(): Promise<BridgePeer[]>;
  syncBridgePeersToStore(): Promise<BridgePeer[]>;
  executeBridgeCommand(command: string, params?: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string }>;
  sendViaBridge(packet: { type: string; from: string; to?: string; payload: any }): Promise<{ success: boolean; txId?: string }>;
  getAsciiMapFromBridge(): Promise<string>;
  setCustomBridgeIp(ip: string): void;
  getCustomBridgeIp(): string;
  setBridgeAuthToken(token: string): void;
  getBridgeAuthToken(): string;
  getClientId(): string;
  setClientId(id: string): void;
  startPairing(customIp?: string, clientId?: string): Promise<{ success: boolean; sessionId?: string; devPin?: string; error?: string }>;
  confirmPairing(sessionId: string, pin: string, customIp?: string, clientId?: string): Promise<{ success: boolean; deviceId?: string; error?: string }>;
  revokeDevice(deviceId?: string): Promise<{ success: boolean; error?: string }>;
  setMockBridgeMode(enabled: boolean): void;
  isMockBridgeMode(): boolean;
  subscribeBridgeStatus(listener: (status: BridgeStatus) => void): () => void;
}

/**
 * Interface for Offline Map & Tile Storage Service
 */
export interface IOfflineMapService {
  getDownloadedRegions(): OfflineMapRegion[];
  saveRegion(region: OfflineMapRegion): OfflineMapRegion[];
  deleteRegion(regionId: string): OfflineMapRegion[];
  getStorageUsage(): { usedBytes: number; formatted: string; count: number };
  clearAllOfflineData(): void;
  isCityDownloaded(cityName: string): boolean;
}

/**
 * Interface for IndexedDB Vector / Raster Map Tile Cache
 */
export interface ITileCacheService {
  cacheTile(url: string, blob: Blob): Promise<void>;
  getTile(url: string): Promise<Blob | undefined>;
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;
}

/**
 * Interface for Pathfinder Real-time RF Scanner & Field Wardriving
 */
export interface IPathfinderScanner {
  getState(): PathfinderActiveState;
  subscribe(listener: (state: PathfinderActiveState) => void): () => void;
  startWalkSession(customTitle?: string): WalkSession;
  pauseWalkSession(): void;
  resumeWalkSession(): void;
  stopAndSaveWalkSession(): Promise<WalkSession | null>;
  toggleSimulatedWalk(enable?: boolean): void;
  toggleWalkSimulation(enable?: boolean): void;
  toggleSound(enabled?: boolean): void;
  logManualDiscovery(type: 'wifi' | 'ble' | 'lora', data: any): Promise<boolean>;
  scanRealWebBluetoothDevice(): Promise<boolean>;
}

/**
 * Interface for Mesh Radar Node Discovery
 */
export interface IMeshRadar {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getPeers(): MeshNode[];
}

/**
 * Interface for Emergency SOS & Mutual-Aid Distress Relaying
 */
export interface ISosService {
  initSosService(): void;
  triggerSosAlert(alert: {
    emergencyType: string;
    description: string;
    location?: { lat: number; lng: number; address?: string };
    requiredHelp?: string[];
  }): SOSPacket;
  cancelSosAlert(sosId: string): void;
  acknowledgeSosAlert(sosId: string, responderCallsign?: string): void;
  resolveSosAlert(sosId: string): void;
  getActiveSosAlerts(): SOSPacket[];
  getAllSosHistory(): SOSPacket[];
  subscribeToSos(callback: (alerts: SOSPacket[]) => void): () => void;
}

/**
 * Interface for Achievement Engine
 */
export interface IAchievementService {
  getUnlockedIds(): string[];
  saveUnlockedIds(ids: string[]): void;
  getAchievements(user: UserProfile, journal: JournalEntry[], proposals?: DaoProposal[]): Achievement[];
  checkNewUnlocks(user: UserProfile, journal: JournalEntry[], proposals?: DaoProposal[]): Achievement[];
  getCategoryCounts(user: UserProfile, journal: JournalEntry[], proposals?: DaoProposal[]): Record<string, { total: number; unlocked: number }>;
}

/**
 * Interface for Seasonal Solarpunk Challenge Tracking
 */
export interface ISeasonalChallengeService {
  getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter';
  getSeasonByMonth(monthIndex: number): 'spring' | 'summer' | 'autumn' | 'winter';
  getProgress(challengeId: string): number;
  saveProgress(challengeId: string, value: number): void;
  getChallengesForSeason(season: 'spring' | 'summer' | 'autumn' | 'winter', user: UserProfile, journal: JournalEntry[]): SeasonalChallenge[];
  getActiveSeasonChallenges(user: UserProfile, journal: JournalEntry[]): SeasonalChallenge[];
  getCompletedCount(season: 'spring' | 'summer' | 'autumn' | 'winter', user: UserProfile, journal: JournalEntry[]): number;
}

/**
 * Interface for Personal Exploration Statistics & Records
 */
export interface IPersonalStatsService {
  getStats(): PersonalRecords;
  getDailyHistory(): DailyStatPoint[];
  getWeeklyTrend(): DailyStatPoint[];
  recordWalkActivity(steps: number, distanceKm: number, areasCount: number): void;
  resetAllStats(): void;
}

/**
 * Interface for Pedometer Step Tracking
 */
export interface IPedometerService {
  startTracking(): Promise<void>;
  stopTracking(): void;
  resetSteps(): void;
  getSteps(): number;
  subscribe(listener: (update: StepUpdate) => void): () => void;
}

/**
 * Interface for Dead Reckoning Navigation
 */
export interface IDeadReckoningService {
  start(): Promise<boolean>;
  stop(): void;
  onGpsUpdate(lat: number, lng: number, accuracy: number): void;
  onManualStep(stepLengthMeters?: number): void;
  getState(): DeadReckoningState;
  subscribe(listener: DeadReckoningListener): () => void;
  resetDrift(lat: number, lng: number): void;
}

/**
 * Interface for Organic Web Audio & Synthesized Sound Feedback
 */
export interface ISoundFeedbackService {
  getMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMute(): boolean;
  playStep(): void;
  playNewWifi(): void;
  playNewBle(): void;
  playNewLora(): void;
  playRepeat(): void;
  playSave(): void;
  playSos(): void;
}
