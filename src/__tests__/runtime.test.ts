import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPlatformInfo,
  checkLocationPermission,
  checkBluetoothPermission,
  checkNotificationPermission,
  checkCameraPermission,
  getAllPermissionStatuses,
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  clearSecureStorage,
  getStorageCapability,
  getNetworkCapability,
  checkBridgeReachability,
  getSystemCapabilityReport,
  exportSettingsJSON,
  exportEncryptedBackupArchive,
  validateArchiveHeader,
  restoreEncryptedBackupArchive,
  performFactoryReset,
} from '../services/runtime';

describe('Runtime Abstraction Layer', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearSecureStorage();
  });

  describe('Platform Detection', () => {
    it('detects test environment correctly', () => {
      const info = getPlatformInfo();
      expect(info.isTest).toBe(true);
      expect(info.platform).toBe('test');
      expect(info.isWeb).toBe(false);
    });
  });

  describe('Permissions Hardware Abstraction', () => {
    it('returns typed CapabilityState for permissions', async () => {
      const loc = await checkLocationPermission();
      expect(loc).toHaveProperty('status');

      const bt = await checkBluetoothPermission();
      expect(bt).toHaveProperty('status');

      const notif = await checkNotificationPermission();
      expect(notif).toHaveProperty('status');

      const cam = await checkCameraPermission();
      expect(cam).toHaveProperty('status');

      const all = await getAllPermissionStatuses();
      expect(all.location).toBeDefined();
      expect(all.bluetooth).toBeDefined();
      expect(all.notifications).toBeDefined();
      expect(all.camera).toBeDefined();
    });
  });

  describe('Secure Storage Abstraction', () => {
    it('encrypts, retrieves, and removes secure items', async () => {
      await setSecureItem('test_key', 'secret_value_123');
      const val = await getSecureItem('test_key');
      expect(val).toBe('secret_value_123');

      await removeSecureItem('test_key');
      const valAfter = await getSecureItem('test_key');
      expect(valAfter).toBeNull();
    });

    it('clears all secure storage items', async () => {
      await setSecureItem('k1', 'v1');
      await setSecureItem('k2', 'v2');
      await clearSecureStorage();

      expect(await getSecureItem('k1')).toBeNull();
      expect(await getSecureItem('k2')).toBeNull();
    });

    it('reports storage capability', async () => {
      const cap = await getStorageCapability();
      expect(cap.secureStorageAvailable).toBe(true);
      expect(cap.storageType).toBeDefined();
    });
  });

  describe('Network Capability & Bridge Reachability', () => {
    it('returns structured network capability state', async () => {
      const net = await getNetworkCapability();
      expect(net.onlineStatus).toBeDefined();
      expect(net.bridgeStatus).toBeDefined();
      expect(net.bridgeUrl).toBeDefined();
    });

    it('checks bridge reachability gracefully', async () => {
      const res = await checkBridgeReachability('192.168.4.1:8080');
      expect(res.status).toBeDefined();
    });
  });

  describe('Capability Report Engine', () => {
    it('generates an all-in-one system capability report', async () => {
      const report = await getSystemCapabilityReport();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.platform.platform).toBe('test');
      expect(report.permissions.location).toBeDefined();
      expect(report.network.onlineStatus).toBeDefined();
      expect(report.storage.secureStorageAvailable).toBe(true);
    });
  });

  describe('Backup, Export & Factory Reset Flow', () => {
    it('exports settings JSON without sensitive secrets', () => {
      localStorage.setItem('hoimu_night_mode', 'true');
      const settingsStr = exportSettingsJSON();
      const settings = JSON.parse(settingsStr);

      expect(settings.type).toBe('hoimu_settings_export');
      expect(settings.preferences.nightMode).toBe(true);
      expect(settingsStr).not.toContain('private');
      expect(settingsStr).not.toContain('secret');
    });

    it('exports and restores password-protected encrypted archives with checksum validation', async () => {
      localStorage.setItem('user_callsign', 'KALEV-FIELD-01');
      localStorage.setItem('hoimu_journal_1', 'Field patrol completed');

      const archiveJSON = await exportEncryptedBackupArchive('SuperSecretPass123', 'KALEV-FIELD-01');
      expect(archiveJSON).toContain('checksum');
      expect(archiveJSON).toContain('header');

      const headerValidation = validateArchiveHeader(archiveJSON);
      expect(headerValidation.valid).toBe(true);
      expect(headerValidation.header?.callsign).toBe('KALEV-FIELD-01');

      // Clear local storage to test restore
      localStorage.clear();
      expect(localStorage.getItem('user_callsign')).toBeNull();

      // Restore with correct password
      const restoreRes = await restoreEncryptedBackupArchive(archiveJSON, 'SuperSecretPass123');
      expect(restoreRes.success).toBe(true);
      expect(localStorage.getItem('user_callsign')).toBe('KALEV-FIELD-01');
      expect(localStorage.getItem('hoimu_journal_1')).toBe('Field patrol completed');
    });

    it('rejects corrupted archives or invalid password', async () => {
      const archiveJSON = await exportEncryptedBackupArchive('MyStrongPass', 'CALLSIGN-01');

      // Wrong password throws error
      await expect(restoreEncryptedBackupArchive(archiveJSON, 'WrongPass')).rejects.toThrow();

      // Corrupted checksum is detected
      const archiveObj = JSON.parse(archiveJSON);
      archiveObj.header.checksum = '0000000000000000000000000000000000000000000000000000000000000000';
      const corruptedJSON = JSON.stringify(archiveObj);

      const val = validateArchiveHeader(corruptedJSON);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('checksum mismatch');
    });

    it('performs factory reset and details erased vs retained items', async () => {
      localStorage.setItem('test_data', 'to_be_erased');
      const summary = await performFactoryReset();

      expect(summary.localErased).toContain('test_data');
      expect(summary.remoteRetained.length).toBeGreaterThan(0);
      expect(localStorage.getItem('test_data')).toBeNull();
    });
  });
});
