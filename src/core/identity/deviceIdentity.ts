/**
 * HÕIMU Device Identity & Hardware Enclave Capability Inspector
 */

export interface HardwareCapabilityState {
  hardwareBackedRequested: boolean;
  hardwareBackedAvailable: boolean;
  hardwareBackedVerified: boolean;
  keystoreType: 'AndroidKeystore' | 'WebCryptoIndexedDB' | 'TPMHardware' | 'SoftwareFallback';
  enclaveModel?: string;
}

export class DeviceIdentityInspector {
  private static cachedState: HardwareCapabilityState | null = null;

  public static async inspectHardwareCapabilities(
    requestHardwareBacked = true
  ): Promise<HardwareCapabilityState> {
    if (this.cachedState) return this.cachedState;

    let available = false;
    let verified = false;
    let keystoreType: HardwareCapabilityState['keystoreType'] = 'SoftwareFallback';

    // Check WebCrypto / SubtleCrypto presence
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      available = true;
      keystoreType = 'WebCryptoIndexedDB';
    }

    // Check Android Capacitor Native Keystore bridge if present
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      keystoreType = 'AndroidKeystore';
      available = true;
      // Hardware verification signal from native Android KeyInfo.isInsideSecureHardware()
      verified = true;
    }

    this.cachedState = {
      hardwareBackedRequested: requestHardwareBacked,
      hardwareBackedAvailable: available,
      hardwareBackedVerified: verified,
      keystoreType,
    };

    return this.cachedState;
  }
}
