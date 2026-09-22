import { useState, useCallback } from 'react';
import { MeshNode } from '../../types';
import { useMeshStore, selectPeersArray } from '../../store/meshStore';
import { DISCOVERABLE_PEERS } from '../../data/initialData';
import { highTrustProximityManager } from '../../services/mesh/highTrustProximityService';

export function useMeshRadar(
  addToast?: (title: string, description?: string, type?: 'success' | 'warning' | 'info') => void
) {
  const peers = useMeshStore(selectPeersArray);
  const setStorePeers = useMeshStore((state) => state.setPeers);
  const [isScanning, setIsScanning] = useState(false);

  const setPeers = useCallback(
    (updater: MeshNode[] | ((prev: MeshNode[]) => MeshNode[])) => {
      if (typeof updater === 'function') {
        const next = updater(useMeshStore.getState().getPeersArray());
        setStorePeers(next);
      } else {
        setStorePeers(updater);
      }
    },
    [setStorePeers]
  );

  const discoverNewPeer = useCallback(() => {
    const undiscovered = DISCOVERABLE_PEERS.filter(
      (candidate) => !peers.some((p) => p.id === candidate.id)
    );

    if (undiscovered.length > 0) {
      const nextPeer = undiscovered[0];
      setPeers((prev) => [nextPeer, ...prev]);
      
      // Proximity & Trust evaluation
      const triggered = highTrustProximityManager.checkAndNotify(nextPeer, addToast);

      if (triggered.length === 0 && addToast) {
        addToast(
          `📡 New Mesh Peer Discovered: ${nextPeer.callsign}`,
          `Signal lock established via ${nextPeer.radioType || 'BLE'} (${nextPeer.lastRssi} dBm, ${
            nextPeer.hopDistance === 1 ? '1 hop direct' : `${nextPeer.hopDistance} hops`
          }).`,
          'success'
        );
      }
    } else {
      const prefixes = ['Fern', 'Birch', 'Lichen', 'Rowan', 'Brook', 'Cedar', 'Hawk'];
      const suffixes = ['Spire', 'Spring', 'Glade', 'Ridge', 'Haven', 'Forge', 'Echo'];
      const skillsPool = [
        'LiFePO4 Welding',
        'Solar Inverters',
        'Ham Radio',
        'Herbal Tinctures',
        'Permaculture',
        'Micro-hydro',
      ];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const randomCallsign = `${randomPrefix}-${randomSuffix}`;
      const randomId = `peer_dyn_${Date.now()}`;
      const randomRssi = Math.floor(Math.random() * 35) - 82;
      const isDirect = randomRssi > -65;
      const radioType: 'BLE' | 'Wi-Fi Direct' = Math.random() > 0.5 ? 'BLE' : 'Wi-Fi Direct';

      const generatedPeer: MeshNode = {
        id: randomId,
        callsign: randomCallsign,
        bio: 'Decentralized energy micro-grid and regional resilient food web enthusiast.',
        skills: [skillsPool[Math.floor(Math.random() * skillsPool.length)], 'Emergency Comms'],
        lastRssi: randomRssi,
        hopDistance: isDirect ? 1 : 2,
        lastSeen: 'Just now',
        trustScore: Math.floor(Math.random() * 25) + 70,
        completedExchanges: Math.floor(Math.random() * 20) + 5,
        relayReliability: 97.2,
        isDirect,
        connectionState: isDirect ? 'direct' : 'relayed',
        avatarSeed: `avatar-${randomId}`,
        recentInteractions: [4, 8, 15, 22],
        angle: Math.floor(Math.random() * 360),
        distanceRatio: isDirect ? 0.35 : 0.65,
        radioType,
        linkQualityPercent: Math.max(
          30,
          Math.min(98, Math.round(100 - (Math.abs(randomRssi) - 40) * 1.3))
        ),
        channelOrFrequency: radioType === 'BLE' ? 'BLE Adv Ch 37' : 'Wi-Fi P2P Ch 6',
      };

      setPeers((prev) => [generatedPeer, ...prev]);

      // Proximity & Trust evaluation
      const triggered = highTrustProximityManager.checkAndNotify(generatedPeer, addToast);

      if (triggered.length === 0 && addToast) {
        addToast(
          `📡 New Mesh Peer Discovered: ${generatedPeer.callsign}`,
          `Discovered via RF scan (${radioType}, ${generatedPeer.lastRssi} dBm).`,
          'success'
        );
      }
    }
  }, [peers, setPeers, addToast]);

  const refreshScan = useCallback(() => {
    setIsScanning(true);
    if (addToast) {
      addToast(
        'Scanning 2.4GHz BLE & Wi-Fi Direct Beacons...',
        'Discovering direct links and multi-hop mesh neighbors.',
        'info'
      );
    }

    setTimeout(() => {
      setIsScanning(false);
      localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());

      setPeers((prev) =>
        prev.map((p) => ({
          ...p,
          lastRssi: Math.max(-92, Math.min(-42, p.lastRssi + Math.floor(Math.random() * 5) - 2)),
          lastSeen: 'Just now',
        }))
      );

      if (addToast) {
        addToast(
          'Scan Completed',
          'RF spectrum scan complete. Active peers verified in local mesh range.',
          'success'
        );
      }
    }, 1200);
  }, [setPeers, addToast]);

  return {
    peers,
    setPeers,
    isScanning,
    discoverNewPeer,
    refreshScan,
  };
}
