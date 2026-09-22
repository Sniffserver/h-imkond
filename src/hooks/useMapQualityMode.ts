import { useState, useEffect, useCallback } from 'react';
import { QualityMode } from '../features/map/qualityManager';

const STORAGE_KEY = 'hoimu_map_quality_mode';

/**
 * Hook to read and update the user's map quality preference.
 * Synchronizes across components via standard CustomEvent and persists in localStorage.
 */
export function useMapQualityMode(): [QualityMode, (mode: QualityMode) => void] {
  const [mode, setModeState] = useState<QualityMode>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = localStorage.getItem(STORAGE_KEY) as QualityMode | null;
    if (saved === 'power-saver' || saved === 'balanced' || saved === 'detail') {
      return saved;
    }
    return 'balanced';
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = e.newValue as QualityMode;
        if (val === 'power-saver' || val === 'balanced' || val === 'detail') {
          setModeState(val);
        }
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: QualityMode }>;
      if (customEvent.detail?.mode) {
        setModeState(customEvent.detail.mode);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('quality-mode-changed', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('quality-mode-changed', handleCustomEvent);
    };
  }, []);

  const setMode = useCallback((newMode: QualityMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
      window.dispatchEvent(
        new CustomEvent('quality-mode-changed', { detail: { mode: newMode, reason: 'user' } })
      );
    } catch {
      // Ignore localStorage errors in private mode
    }
  }, []);

  return [mode, setMode];
}
