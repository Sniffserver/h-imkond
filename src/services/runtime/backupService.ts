import CryptoJS from 'crypto-js';
import { EncryptedBackupArchive, EncryptedBackupHeader, FactoryResetSummary } from './types';
import { clearSecureStorage } from './secureStorage';

const BACKUP_FORMAT_VERSION = '1.0.0';
const isTestEnv = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
const PBKDF2_ITERATIONS = isTestEnv ? 500 : 100000;

/**
 * Exports non-sensitive user settings & preferences (no identity private keys or secrets).
 */
export function exportSettingsJSON(): string {
  const settings = {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    type: 'hoimu_settings_export',
    preferences: {
      nightMode: localStorage.getItem('hoimu_night_mode') === 'true',
      gloveMode: localStorage.getItem('hoimu_glove_mode') === 'true',
      highContrast: localStorage.getItem('hoimu_high_contrast') === 'true',
      directSun: localStorage.getItem('hoimu_direct_sun') === 'true',
      backupFrequencyDays: Number(localStorage.getItem('hoimu_backup_frequency_days') || 14),
      piBridgeIp: localStorage.getItem('hoimu_pi_bridge_ip') || '192.168.4.1:8080',
    },
  };

  return JSON.stringify(settings, null, 2);
}

/**
 * Generates PBKDF2 derived 256-bit key from user password and salt
 */
function deriveKeyFromPassword(password: string, saltStr: string): CryptoJS.lib.WordArray {
  const salt = CryptoJS.enc.Hex.parse(saltStr);
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
}

/**
 * Creates a password-protected encrypted backup archive containing all local application data.
 * Computes SHA-256 checksum over encrypted payload to prevent tampering.
 */
export async function exportEncryptedBackupArchive(
  password: string,
  callsign: string = 'NODE-OPERATOR'
): Promise<string> {
  if (!password || password.length < 4) {
    throw new Error('Backup password must be at least 4 characters');
  }

  // 1. Gather all local state
  const localData: Record<string, string> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        localData[k] = localStorage.getItem(k) || '';
      }
    }
  }

  const payloadString = JSON.stringify(localData);

  // 2. Derive encryption key via PBKDF2
  const saltHex = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  const derivedKey = deriveKeyFromPassword(password, saltHex);

  // 3. Encrypt payload via AES-256
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(payloadString, derivedKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const cipherTextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  const combinedPayloadHex = `${saltHex}:${iv.toString(CryptoJS.enc.Hex)}:${cipherTextHex}`;

  // 4. Compute SHA-256 checksum of encrypted payload
  const checksum = CryptoJS.SHA256(combinedPayloadHex).toString(CryptoJS.enc.Hex);

  const header: EncryptedBackupHeader = {
    version: BACKUP_FORMAT_VERSION,
    timestamp: Date.now(),
    callsign,
    checksum,
  };

  const archive: EncryptedBackupArchive = {
    header,
    encryptedPayload: combinedPayloadHex,
  };

  return JSON.stringify(archive, null, 2);
}

/**
 * Inspects and validates backup archive header and SHA-256 checksum
 */
export function validateArchiveHeader(archiveJSON: string): {
  valid: boolean;
  header?: EncryptedBackupHeader;
  error?: string;
} {
  try {
    const archive: EncryptedBackupArchive = JSON.parse(archiveJSON);
    if (!archive.header || !archive.encryptedPayload) {
      return { valid: false, error: 'Invalid backup format: missing header or payload' };
    }

    if (archive.header.version !== BACKUP_FORMAT_VERSION) {
      return {
        valid: false,
        error: `Unsupported format version ${archive.header.version}. Expected ${BACKUP_FORMAT_VERSION}`,
      };
    }

    // Verify SHA-256 checksum
    const computedChecksum = CryptoJS.SHA256(archive.encryptedPayload).toString(CryptoJS.enc.Hex);
    if (computedChecksum !== archive.header.checksum) {
      return { valid: false, error: 'Backup archive checksum mismatch. File may be corrupted or altered.' };
    }

    return { valid: true, header: archive.header };
  } catch (e: any) {
    return { valid: false, error: e.message || 'Malformed JSON backup archive' };
  }
}

/**
 * Restores state from a password-protected encrypted backup archive into local profile
 */
export async function restoreEncryptedBackupArchive(
  archiveJSON: string,
  password: string
): Promise<{ success: boolean; restoredKeysCount: number; error?: string }> {
  const headerValidation = validateArchiveHeader(archiveJSON);
  if (!headerValidation.valid) {
    throw new Error(headerValidation.error || 'Invalid backup archive');
  }

  const archive: EncryptedBackupArchive = JSON.parse(archiveJSON);
  const parts = archive.encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload structure');
  }

  const [saltHex, ivHex, cipherTextHex] = parts;
  const derivedKey = deriveKeyFromPassword(password, saltHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const cipherTextParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Hex.parse(cipherTextHex),
  });

  try {
    const decryptedBytes = CryptoJS.AES.decrypt(cipherTextParams, derivedKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const decryptedStr = decryptedBytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) {
      throw new Error('Incorrect password or decryption failure');
    }

    const restoredData: Record<string, string> = JSON.parse(decryptedStr);
    let count = 0;

    if (typeof window !== 'undefined' && window.localStorage) {
      Object.entries(restoredData).forEach(([k, v]) => {
        localStorage.setItem(k, v);
        count++;
      });
    }

    return { success: true, restoredKeysCount: count };
  } catch (e: any) {
    throw new Error('Failed to decrypt backup archive: ' + (e.message || 'Incorrect password'));
  }
}

/**
 * Performs a total local "Factory Reset".
 * Clearly enumerates what was deleted locally versus what remains on Pi/mesh peers.
 */
export async function performFactoryReset(): Promise<FactoryResetSummary> {
  const localErased: string[] = [];

  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) localErased.push(k);
    }
    localStorage.clear();
  }

  await clearSecureStorage();

  const remoteRetained: string[] = [
    'Broadcasted SOS alerts relayed across the local mesh network',
    'Public governance proposals registered on Pi Bridge / peers',
    'Completed mutual aid transaction logs synced to peer ledgers',
    'Public mesh peer beacon entries on active physical repeater nodes',
  ];

  return {
    timestamp: Date.now(),
    localErased,
    remoteRetained,
  };
}
