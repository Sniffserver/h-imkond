/**
 * IdentityService Dispatcher & Factory
 * 
 * Routes cryptographic identity and secure storage operations based on the host environment:
 * - Web: WebCrypto API + Non-Extractable CryptoKey (extractable: false) + IndexedDB
 * - Android: Android Keystore + TEE/StrongBox + Native Secure Storage via Capacitor
 */

import { Capacitor } from '@capacitor/core';
import {
  IIdentityService,
  PlatformTarget,
  StorageProviderType,
  LocalIdentityRecord,
} from './types';
import { WebIdentityService } from './webIdentityService';
import { AndroidIdentityService } from './androidIdentityService';
import { getPlatformInfo } from '../runtime/platform';

class IdentityServiceFacade implements IIdentityService {
  private activeInstance: IIdentityService | null = null;

  private resolveInstance(): IIdentityService {
    if (this.activeInstance) return this.activeInstance;

    const platformInfo = getPlatformInfo();
    const isCapacitorNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

    if (platformInfo.isAndroid || isCapacitorNative) {
      this.activeInstance = new AndroidIdentityService();
    } else {
      this.activeInstance = new WebIdentityService();
    }

    return this.activeInstance;
  }

  public get platform(): PlatformTarget {
    return this.resolveInstance().platform;
  }

  public get providerType(): StorageProviderType {
    return this.resolveInstance().providerType;
  }

  public get isHardwareBacked(): boolean {
    return this.resolveInstance().isHardwareBacked;
  }

  public async initialize(): Promise<void> {
    return await this.resolveInstance().initialize();
  }

  public async getLocalIdentity(): Promise<LocalIdentityRecord> {
    return await this.resolveInstance().getLocalIdentity();
  }

  public async getDeviceKey(): Promise<CryptoKey> {
    return await this.resolveInstance().getDeviceKey();
  }

  public async getIdentityKeyPair(): Promise<CryptoKeyPair> {
    return await this.resolveInstance().getIdentityKeyPair();
  }

  public async getEncryptionKeyPair(): Promise<CryptoKeyPair> {
    return await this.resolveInstance().getEncryptionKeyPair();
  }

  public async getIdentityPublicKey(): Promise<string> {
    return await this.resolveInstance().getIdentityPublicKey();
  }

  public async getEncryptionPublicKey(): Promise<string> {
    return await this.resolveInstance().getEncryptionPublicKey();
  }

  public async signWithIdentity(data: Uint8Array): Promise<string> {
    return await this.resolveInstance().signWithIdentity(data);
  }

  public async verifyWithIdentity(data: Uint8Array, signatureHex: string, publicKeyHex?: string): Promise<boolean> {
    return await this.resolveInstance().verifyWithIdentity(data, signatureHex, publicKeyHex);
  }

  public async encryptData(plaintext: string): Promise<string> {
    return await this.resolveInstance().encryptData(plaintext);
  }

  public async decryptData(envelopeJsonOrRaw: string): Promise<string> {
    return await this.resolveInstance().decryptData(envelopeJsonOrRaw);
  }

  public async setSecureItem(key: string, value: string): Promise<void> {
    return await this.resolveInstance().setSecureItem(key, value);
  }

  public async getSecureItem(key: string): Promise<string | null> {
    return await this.resolveInstance().getSecureItem(key);
  }

  public async removeSecureItem(key: string): Promise<void> {
    return await this.resolveInstance().removeSecureItem(key);
  }

  public async clearSecureStorage(): Promise<void> {
    return await this.resolveInstance().clearSecureStorage();
  }

  /**
   * For testing or explicit platform override
   */
  public setProvider(instance: IIdentityService | null): void {
    this.activeInstance = instance;
  }
}

export const identityService: IIdentityService = new IdentityServiceFacade();

export function getIdentityService(): IIdentityService {
  return identityService;
}

// Convenient top-level functions for device-bound secure storage
export async function setSecureItem(key: string, value: string): Promise<void> {
  return await identityService.setSecureItem(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  return await identityService.getSecureItem(key);
}

export async function removeSecureItem(key: string): Promise<void> {
  return await identityService.removeSecureItem(key);
}

export async function clearSecureStorage(): Promise<void> {
  return await identityService.clearSecureStorage();
}
