import React, { useEffect, useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC<{
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}> = ({ onAddToast }) => {
  const isOnline = useOnlineStatus();
  const onAddToastRef = useRef(onAddToast);
  onAddToastRef.current = onAddToast;
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    if (isOnline) {
      hasAlertedRef.current = false;
      return;
    }

    const checkSyncStatus = () => {
      const lastSyncStr = localStorage.getItem('hoimu_last_sync_timestamp');
      // If never synced before, initialize with current timestamp so we don't immediately alert
      if (!lastSyncStr) {
        localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());
        return;
      }

      const lastSyncMs = parseInt(lastSyncStr, 10) || 0;

      // If over 60 minutes since last sync
      if (Date.now() - lastSyncMs > 60 * 60 * 1000 && !hasAlertedRef.current) {
        hasAlertedRef.current = true;
        onAddToastRef.current?.(
          'Reconnection Recommended',
          'Device has not performed a sync operation in over 60 minutes. Reconnection recommended to refresh peer routing.',
          'warning'
        );
      }
    };

    checkSyncStatus();
    const checkInterval = setInterval(checkSyncStatus, 30000);

    return () => clearInterval(checkInterval);
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-[#E76F51] px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-lg shadow-[#E76F51]/30">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      OFFLINE MODE ENABLED
    </div>
  );
};
