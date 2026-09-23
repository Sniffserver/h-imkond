/**
 * Typed capability state representing hardware & subsystem availability
 */
export type CapabilityState =
  | { status: 'available' }
  | { status: 'permission_denied'; permission: string }
  | { status: 'unsupported'; reason: string }
  | { status: 'unavailable'; reason: string };

export type PlatformType = 'web' | 'android' | 'test';

export interface PlatformInfo {
  platform: PlatformType;
  isNative: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  isTest: boolean;
  userAgent: string;
}

export interface PermissionReport {
  location: CapabilityState;
  bluetooth: CapabilityState;
  notifications: CapabilityState;
  camera: CapabilityState;
}

export interface NetworkCapability {
  onlineStatus: 'online' | 'offline';
  bridgeStatus: 'reachable' | 'unreachable' | 'pairing_required';
  bridgeUrl?: string;
  lastPingMs?: number;
}

export interface StorageCapability {
  secureStorageAvailable: boolean;
  storageType: 'capacitor_secure' | 'encrypted_localStorage' | 'memory' | 'android_keystore' | 'webcrypto_indexeddb';
  isHardwareBacked?: boolean;
  quotaBytes?: number;
  usageBytes?: number;
}

export interface SystemCapabilityReport {
  timestamp: number;
  platform: PlatformInfo;
  permissions: PermissionReport;
  network: NetworkCapability;
  storage: StorageCapability;
}

export interface EncryptedBackupHeader {
  version: string;
  timestamp: number;
  callsign: string;
  checksum: string;
}

export interface EncryptedBackupArchive {
  header: EncryptedBackupHeader;
  encryptedPayload: string;
}

export interface FactoryResetSummary {
  timestamp: number;
  localErased: string[];
  remoteRetained: string[];
}
