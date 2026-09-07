import { CapabilityState, PermissionReport } from './types';
import { getPlatformInfo } from './platform';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Checks location hardware & permission capability
 */
export async function checkLocationPermission(): Promise<CapabilityState> {
  const platform = getPlatformInfo();
  if (platform.isTest) {
    return { status: 'available' };
  }

  if (platform.isAndroid) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
        return { status: 'available' };
      }
      if (perm.location === 'denied' || perm.coarseLocation === 'denied') {
        return { status: 'permission_denied', permission: 'ACCESS_FINE_LOCATION' };
      }
    } catch {
      // Fall through to browser check
    }
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { status: 'unsupported', reason: 'Geolocation API unavailable in this browser context' };
  }

  if ('permissions' in navigator && navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (result.state === 'granted') {
        return { status: 'available' };
      } else if (result.state === 'denied') {
        return { status: 'permission_denied', permission: 'geolocation' };
      } else {
        return { status: 'unavailable', reason: 'Location permission prompt required' };
      }
    } catch {
      // Ignore query error, fall through
    }
  }

  return { status: 'available' };
}

/**
 * Requests location hardware permission
 */
export async function requestLocationPermission(): Promise<CapabilityState> {
  const platform = getPlatformInfo();
  if (platform.isTest) {
    return { status: 'available' };
  }

  if (platform.isAndroid) {
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
        return { status: 'available' };
      }
      return { status: 'permission_denied', permission: 'ACCESS_FINE_LOCATION' };
    } catch (e: any) {
      return { status: 'unavailable', reason: e.message || 'Location permission request failed' };
    }
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { status: 'unsupported', reason: 'Geolocation API not supported' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ status: 'available' }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ status: 'permission_denied', permission: 'geolocation' });
        } else {
          resolve({ status: 'unavailable', reason: err.message });
        }
      },
      { timeout: 5000 }
    );
  });
}

/**
 * Checks Bluetooth discovery & radio capability
 */
export async function checkBluetoothPermission(): Promise<CapabilityState> {
  const platform = getPlatformInfo();
  if (platform.isTest) {
    return { status: 'available' };
  }

  if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
    return { status: 'available' };
  }

  if (platform.isAndroid) {
    return { status: 'available' }; // Bluetooth LE supported natively on Android via Capacitor
  }

  return { status: 'unsupported', reason: 'WebBluetooth API not supported in current browser' };
}

/**
 * Checks push & local notification permission
 */
export async function checkNotificationPermission(): Promise<CapabilityState> {
  const platform = getPlatformInfo();
  if (platform.isTest) {
    return { status: 'available' };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { status: 'unsupported', reason: 'Notifications API not supported' };
  }

  if (Notification.permission === 'granted') {
    return { status: 'available' };
  } else if (Notification.permission === 'denied') {
    return { status: 'permission_denied', permission: 'notifications' };
  } else {
    return { status: 'unavailable', reason: 'Notification permission not yet requested' };
  }
}

/**
 * Requests notification permission
 */
export async function requestNotificationPermission(): Promise<CapabilityState> {
  const platform = getPlatformInfo();
  if (platform.isTest) {
    return { status: 'available' };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { status: 'unsupported', reason: 'Notifications API not supported' };
  }

  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      return { status: 'available' };
    } else {
      return { status: 'permission_denied', permission: 'notifications' };
    }
  } catch (e: any) {
    return { status: 'unavailable', reason: e.message || 'Notification request failed' };
  }
}

/**
 * Checks camera capability (e.g. for QR scanning)
 */
export async function checkCameraPermission(): Promise<CapabilityState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { status: 'unsupported', reason: 'Camera mediaDevices API unavailable' };
  }
  return { status: 'available' };
}

/**
 * Aggregates all system permission checks
 */
export async function getAllPermissionStatuses(): Promise<PermissionReport> {
  const [location, bluetooth, notifications, camera] = await Promise.all([
    checkLocationPermission(),
    checkBluetoothPermission(),
    checkNotificationPermission(),
    checkCameraPermission(),
  ]);

  return {
    location,
    bluetooth,
    notifications,
    camera,
  };
}
