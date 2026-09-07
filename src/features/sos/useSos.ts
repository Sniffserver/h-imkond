import { useState, useCallback, useEffect } from 'react';
import { CrisisAlert } from '../../types';
import { INITIAL_CRISIS_ALERTS } from '../../data/communityData';
import { initSosService } from '../../services/utils/sosService';

export function useSos() {
  const [isCrisisMode, setIsCrisisMode] = useState(false);
  const [crisisAlerts, setCrisisAlerts] = useState<CrisisAlert[]>(() => {
    const saved = localStorage.getItem('hoimu_crisis_alerts');
    return saved ? JSON.parse(saved) : INITIAL_CRISIS_ALERTS;
  });

  useEffect(() => {
    initSosService();
  }, []);

  useEffect(() => {
    localStorage.setItem('hoimu_crisis_alerts', JSON.stringify(crisisAlerts));
  }, [crisisAlerts]);

  const broadcastAlert = useCallback((newAlert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => {
    const alertObj: CrisisAlert = {
      ...newAlert,
      id: `sos-${Date.now()}`,
      timestamp: Date.now(),
      resolved: false,
    };
    setCrisisAlerts((prev) => [alertObj, ...prev]);
    return alertObj;
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setCrisisAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
  }, []);

  return {
    isCrisisMode,
    setIsCrisisMode,
    crisisAlerts,
    setCrisisAlerts,
    broadcastAlert,
    resolveAlert,
  };
}
