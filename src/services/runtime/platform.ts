import { Capacitor } from '@capacitor/core';
import { PlatformInfo, PlatformType } from './types';

/**
 * Detects the runtime platform (web, android, or test environment)
 */
export function getPlatformInfo(): PlatformInfo {
  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));

  let platform: PlatformType = 'web';
  let isNative = false;
  let isAndroid = false;

  if (isTest) {
    platform = 'test';
  } else if (typeof window !== 'undefined') {
    try {
      const capPlatform = Capacitor.getPlatform();
      isNative = Capacitor.isNativePlatform();

      if (capPlatform === 'android' || (isNative && /android/i.test(navigator.userAgent))) {
        platform = 'android';
        isAndroid = true;
      }
    } catch {
      // Fallback if Capacitor is missing or in mock context
      if (/android/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)) {
        platform = 'android';
        isAndroid = true;
      }
    }
  }

  return {
    platform,
    isNative,
    isAndroid,
    isWeb: platform === 'web',
    isTest,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS/Test',
  };
}
