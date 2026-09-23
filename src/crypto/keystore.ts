import { HoimuIdentity } from './identity';
import { loadOrCreateLocalIdentity } from './identity';
import { SecureSecretsStore } from '../storage/identity/secureSecretsStore';

const IDENTITY_STORAGE_KEY = 'hoimu_identity_master_seed';

export class KeyStore {
  private static cachedIdentity: HoimuIdentity | null = null;

  public static async getOrCreateIdentity(defaultCallsign = 'EST-NODE'): Promise<HoimuIdentity> {
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    this.cachedIdentity = await loadOrCreateLocalIdentity(defaultCallsign);
    return this.cachedIdentity;
  }

  public static setCachedIdentity(identity: HoimuIdentity): void {
    this.cachedIdentity = identity;
  }

  public static async clear(): Promise<void> {
    this.cachedIdentity = null;
    await SecureSecretsStore.deleteSecret('master_identity_seed');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(IDENTITY_STORAGE_KEY);
    }
  }
}
