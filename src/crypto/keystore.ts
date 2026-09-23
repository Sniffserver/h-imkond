import { HoimuIdentity, createIdentityFromSeed } from './identity';

const IDENTITY_STORAGE_KEY = 'hoimu_identity_master_seed';

export class KeyStore {
  private static cachedIdentity: HoimuIdentity | null = null;

  public static async getOrCreateIdentity(defaultCallsign = 'EST-NODE'): Promise<HoimuIdentity> {
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    let seed: string | null = null;
    if (typeof localStorage !== 'undefined') {
      seed = localStorage.getItem(IDENTITY_STORAGE_KEY);
      if (!seed) {
        // Generate cryptographic random seed
        const randomBuf = new Uint8Array(32);
        crypto.getRandomValues(randomBuf);
        seed = Array.from(randomBuf).map((b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(IDENTITY_STORAGE_KEY, seed);
      }
    } else {
      seed = 'hoimu_test_env_seed_deterministic';
    }

    this.cachedIdentity = await createIdentityFromSeed(seed, defaultCallsign);
    return this.cachedIdentity;
  }

  public static setCachedIdentity(identity: HoimuIdentity): void {
    this.cachedIdentity = identity;
  }

  public static clear(): void {
    this.cachedIdentity = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(IDENTITY_STORAGE_KEY);
    }
  }
}
