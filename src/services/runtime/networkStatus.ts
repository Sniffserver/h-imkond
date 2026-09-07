import { NetworkCapability } from './types';
import { getCustomBridgeIp, getBridgeAuthToken } from '../comms/piBridge';

type NetworkStatusListener = (status: NetworkCapability) => void;

const listeners = new Set<NetworkStatusListener>();

let currentNetworkStatus: NetworkCapability = {
  onlineStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  bridgeStatus: 'unreachable',
  bridgeUrl: getCustomBridgeIp(),
};

/**
 * Pings the configured Pi hardware bridge health endpoint
 */
export async function checkBridgeReachability(bridgeUrl: string = getCustomBridgeIp()): Promise<{
  status: NetworkCapability['bridgeStatus'];
  pingMs?: number;
}> {
  if (typeof window === 'undefined') {
    return { status: 'unreachable' };
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`http://${bridgeUrl}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const pingMs = Date.now() - startTime;
    if (res.ok) {
      const hasToken = Boolean(getBridgeAuthToken());
      return {
        status: hasToken ? 'reachable' : 'pairing_required',
        pingMs,
      };
    } else if (res.status === 401) {
      return { status: 'pairing_required', pingMs };
    }
  } catch {
    // Health probe failed
  }

  return { status: 'unreachable' };
}

/**
 * Gets current network status snapshot
 */
export async function getNetworkCapability(): Promise<NetworkCapability> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
  const bridgeUrl = getCustomBridgeIp();
  const bridgeRes = await checkBridgeReachability(bridgeUrl);

  currentNetworkStatus = {
    onlineStatus: isOnline ? 'online' : 'offline',
    bridgeStatus: bridgeRes.status,
    bridgeUrl,
    lastPingMs: bridgeRes.pingMs,
  };

  return currentNetworkStatus;
}

/**
 * Subscribes to real-time network and bridge reachability changes
 */
export function subscribeToNetworkStatus(listener: NetworkStatusListener): () => void {
  listeners.add(listener);
  listener(currentNetworkStatus);

  if (typeof window === 'undefined') {
    return () => listeners.delete(listener);
  }

  const handleOnline = async () => {
    const updated = await getNetworkCapability();
    listeners.forEach((fn) => fn(updated));
  };

  const handleOffline = async () => {
    const updated = await getNetworkCapability();
    listeners.forEach((fn) => fn(updated));
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic bridge check every 10 seconds
  const intervalId = setInterval(async () => {
    const updated = await getNetworkCapability();
    listeners.forEach((fn) => fn(updated));
  }, 10000);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
  };
}
