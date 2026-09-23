import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebIdentityService,
  AndroidIdentityService,
  identityService,
  getIdentityService,
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  clearSecureStorage,
} from '../services/identity';
import { getWebCryptoKey, encryptWithWebCrypto, decryptWithWebCrypto } from '../utils/webCrypto';

describe('IdentityService & Device-Bound Secure Storage Architecture', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearSecureStorage();
  });

  describe('Security Constraints: Zero Raw Key Leakage to Plaintext Storage', () => {
    it('never stores raw cryptographic keys or AES keys in localStorage', async () => {
      // Initialize web identity service and perform key operations
      const service = new WebIdentityService();
      await service.initialize();

      const deviceKey = await service.getDeviceKey();
      expect(deviceKey).toBeDefined();
      expect(deviceKey.type).toBe('secret');
      // Crucial: Key must be non-extractable to prevent XSS exfiltration
      expect(deviceKey.extractable).toBe(false);

      // Verify localStorage does NOT contain the legacy raw device key or plaintext AES key
      expect(localStorage.getItem('hoimu_webcrypto_device_raw_key')).toBeNull();
      expect(localStorage.getItem('hoimu_aes_key')).toBeNull();
    });

    it('proactively purges legacy insecure keys from localStorage during initialization', async () => {
      // Simulate existing legacy raw key in localStorage
      localStorage.setItem('hoimu_webcrypto_device_raw_key', 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567');
      localStorage.setItem('hoimu_aes_key', 'legacy_aes_raw_key');

      const service = new WebIdentityService();
      await service.initialize();

      expect(localStorage.getItem('hoimu_webcrypto_device_raw_key')).toBeNull();
      expect(localStorage.getItem('hoimu_aes_key')).toBeNull();
    });
  });

  describe('Web Implementation: WebCrypto Non-Extractable CryptoKey & Authenticated Envelope', () => {
    it('encrypts and decrypts sensitive data using non-extractable AES-GCM-256', async () => {
      const webService = new WebIdentityService();
      const secretPayload = JSON.stringify({ token: 'secret-token-999', mnemonic: 'forest river birch' });

      const encryptedEnvelopeJson = await webService.encryptData(secretPayload);
      expect(encryptedEnvelopeJson).toBeDefined();

      const parsed = JSON.parse(encryptedEnvelopeJson);
      expect(parsed.v).toBe(2);
      expect(parsed.alg).toBe('AES-GCM-256');
      expect(parsed.iv).toBeDefined();
      expect(parsed.ct).toBeDefined();
      expect(parsed.tagLength).toBe(128);
      expect(parsed.provider).toBe('webcrypto_indexeddb');

      const decrypted = await webService.decryptData(encryptedEnvelopeJson);
      expect(decrypted).toBe(secretPayload);
      expect(JSON.parse(decrypted)).toEqual({ token: 'secret-token-999', mnemonic: 'forest river birch' });
    });

    it('stores and retrieves items from secure storage without exposing plaintext', async () => {
      const webService = new WebIdentityService();
      await webService.setSecureItem('user_auth_token', 'jwt.secret.bearer.value');

      const retrieved = await webService.getSecureItem('user_auth_token');
      expect(retrieved).toBe('jwt.secret.bearer.value');

      // Removal
      await webService.removeSecureItem('user_auth_token');
      const afterRemoval = await webService.getSecureItem('user_auth_token');
      expect(afterRemoval).toBeNull();
    });

    it('signs and verifies payloads using non-extractable identity keypair', async () => {
      const webService = new WebIdentityService();
      const pubKey = await webService.getIdentityPublicKey();
      expect(typeof pubKey).toBe('string');
      expect(pubKey.length).toBeGreaterThan(16);

      const msg = new TextEncoder().encode('Mesh authentication heartbeat from node-7');
      const sig = await webService.signWithIdentity(msg);
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(32);

      const valid = await webService.verifyWithIdentity(msg, sig, pubKey);
      expect(valid).toBe(true);

      // Modified message fails verification
      const tamperedMsg = new TextEncoder().encode('Mesh authentication heartbeat from node-TAMPERED');
      const invalid = await webService.verifyWithIdentity(tamperedMsg, sig, pubKey);
      expect(invalid).toBe(false);
    });
  });

  describe('Android Implementation: Hardware Keystore & Secure Storage Provider', () => {
    it('configures provider metadata indicating Android Keystore and hardware-backed operation', async () => {
      const androidService = new AndroidIdentityService();
      await androidService.initialize();

      expect(androidService.platform).toBe('android');
      expect(androidService.providerType).toBe('android_keystore');
      expect(androidService.isHardwareBacked).toBe(true);

      const encrypted = await androidService.encryptData('mesh_gps_waypoint_data');
      const envelope = JSON.parse(encrypted);
      expect(envelope.provider).toBe('android_keystore');
      expect(envelope.hardwareBacked).toBe(true);

      const decrypted = await androidService.decryptData(encrypted);
      expect(decrypted).toBe('mesh_gps_waypoint_data');
    });
  });

  describe('Global Facade and webCrypto Integration', () => {
    it('routes setSecureItem and getSecureItem through global identityService', async () => {
      await setSecureItem('test_global_key', 'test_global_secret_value');
      const retrieved = await getSecureItem('test_global_key');
      expect(retrieved).toBe('test_global_secret_value');

      await removeSecureItem('test_global_key');
      expect(await getSecureItem('test_global_key')).toBeNull();
    });

    it('encryptWithWebCrypto uses non-extractable key managed by IdentityService', async () => {
      const rawText = 'Sensitive trust battery score data: 98.4';
      const webCryptoPayload = await encryptWithWebCrypto(rawText);
      expect(webCryptoPayload.startsWith('hoimu_webcrypto:')).toBe(true);

      const decrypted = await decryptWithWebCrypto(webCryptoPayload);
      expect(decrypted).toBe(rawText);

      // Verify no raw key is in localStorage
      expect(localStorage.getItem('hoimu_webcrypto_device_raw_key')).toBeNull();
    });
  });
});
