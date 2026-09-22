import { useEffect, useRef } from 'react';
import { MeshNode } from '../types';
import { highTrustProximityManager } from '../services/mesh/highTrustProximityService';

export interface UseHighTrustProximityNotifierProps {
  peers: MeshNode[];
  addToast?: (title: string, description?: string, type?: 'success' | 'warning' | 'info') => void;
  enabled?: boolean;
}

export function useHighTrustProximityNotifier({
  peers,
  addToast,
  enabled = true,
}: UseHighTrustProximityNotifierProps) {
  const prevPeersRssiRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled || !peers || peers.length === 0) return;

    const currentMap = new Map<string, number>();
    const newlyEnteredPeers: MeshNode[] = [];

    for (const peer of peers) {
      currentMap.set(peer.id, peer.lastRssi);
      const prevRssi = prevPeersRssiRef.current.get(peer.id);

      // Check if peer is newly discovered or transitioned from weak/out-of-range (< -70) to immediate (> -70)
      if (prevRssi === undefined || (prevRssi <= -70 && peer.lastRssi > -70)) {
        newlyEnteredPeers.push(peer);
      }
    }

    prevPeersRssiRef.current = currentMap;

    if (newlyEnteredPeers.length > 0) {
      highTrustProximityManager.checkAndNotify(newlyEnteredPeers, addToast);
    }
  }, [peers, addToast, enabled]);
}
