/**
 * HÕIMU Explicit Map State & Display Badge System
 * 
 * Explicitly models map runtime & connectivity states:
 * - ONLINE: Connected to tile server or live mesh (● LIVE)
 * - ONLINE_DEGRADED: High latency or packet loss (◐ DEGRADED)
 * - OFFLINE_WITH_PACK: Offline using verified local PMTiles pack (■ OFFLINE)
 * - OFFLINE_NO_PACK: Offline without downloaded map pack (⚠ NO MAP PACK)
 * - MAP_LOADING: Initializing vector tile engine (◌ LOADING)
 * - MAP_ERROR: Engine crash or tile load failure (✖ ERROR)
 */

export type ExplicitMapState =
  | 'ONLINE'
  | 'ONLINE_DEGRADED'
  | 'OFFLINE_WITH_PACK'
  | 'OFFLINE_NO_PACK'
  | 'MAP_LOADING'
  | 'MAP_ERROR';

export interface MapStateDisplayInfo {
  state: ExplicitMapState;
  symbol: string;
  label: string;
  fullText: string;
  badgeClass: string;
}

export function computeMapStateInfo(params: {
  isOnline: boolean;
  isDegraded?: boolean;
  hasMapPack: boolean;
  isLoading?: boolean;
  hasError?: boolean;
}): MapStateDisplayInfo {
  if (params.hasError) {
    return {
      state: 'MAP_ERROR',
      symbol: '✖',
      label: 'ERROR',
      fullText: '✖ MAP ERROR',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40',
    };
  }

  if (params.isLoading) {
    return {
      state: 'MAP_LOADING',
      symbol: '◌',
      label: 'LOADING',
      fullText: '◌ MAP LOADING',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 animate-pulse',
    };
  }

  if (params.isOnline) {
    if (params.isDegraded) {
      return {
        state: 'ONLINE_DEGRADED',
        symbol: '◐',
        label: 'DEGRADED',
        fullText: '◐ LIVE (DEGRADED)',
        badgeClass: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40',
      };
    }
    return {
      state: 'ONLINE',
      symbol: '●',
      label: 'LIVE',
      fullText: '● LIVE',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40',
    };
  }

  // Offline
  if (params.hasMapPack) {
    return {
      state: 'OFFLINE_WITH_PACK',
      symbol: '■',
      label: 'OFFLINE',
      fullText: '■ OFFLINE',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40',
    };
  }

  return {
    state: 'OFFLINE_NO_PACK',
    symbol: '⚠',
    label: 'NO MAP PACK',
    fullText: '⚠ NO MAP PACK',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40',
  };
}
