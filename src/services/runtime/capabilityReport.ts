import { useState, useEffect } from 'react';
import { SystemCapabilityReport } from './types';
import { getPlatformInfo } from './platform';
import { getAllPermissionStatuses } from './permissions';
import { getNetworkCapability } from './networkStatus';
import { getStorageCapability } from './secureStorage';

/**
 * Generates an all-in-one system capability report across hardware, permissions, network, and storage.
 */
export async function getSystemCapabilityReport(): Promise<SystemCapabilityReport> {
  const platform = getPlatformInfo();
  const [permissions, network, storage] = await Promise.all([
    getAllPermissionStatuses(),
    getNetworkCapability(),
    getStorageCapability(),
  ]);

  return {
    timestamp: Date.now(),
    platform,
    permissions,
    network,
    storage,
  };
}

/**
 * React hook for consuming real-time hardware capability status
 */
export function useCapabilityReport(): {
  report: SystemCapabilityReport | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [report, setReport] = useState<SystemCapabilityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getSystemCapabilityReport();
      setReport(res);
    } catch (e) {
      console.error('[CapabilityReport] Error building report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { report, loading, refresh };
}
