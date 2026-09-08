import { useState, useEffect, useCallback } from 'react';
import { ToastMessage } from '../types';

export interface UseAppThemeModesProps {
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
}

export function useAppThemeModes({ addToast }: UseAppThemeModesProps) {
  // Night Mode Field Theme State (with System Preference Auto-Detection)
  const [isNightMode, setIsNightMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_night_mode');
    if (saved !== null) return JSON.parse(saved);
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // ADHD Focus Mode State
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_focus_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Glove Mode State (Min 56×56dp touch targets, 72×72dp canvas tap points, +20% font scaling)
  const [isGloveMode, setIsGloveMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_glove_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // High Contrast Mode State (Thick borders, no transparency, prefers-contrast override)
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_high_contrast');
    return saved ? JSON.parse(saved) : false;
  });

  // Direct Sun Mode State (Forces pure white background and bold black text for direct sunlight glare)
  const [isDirectSun, setIsDirectSun] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_direct_sun');
    return saved ? JSON.parse(saved) : false;
  });

  // Listen to system color scheme changes if user hasn't explicitly overridden theme
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (localStorage.getItem('hoimu_night_mode') === null) {
          setIsNightMode(e.matches);
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
      }
    } catch {
      // Safely ignore environments without matchMedia support
    }
  }, []);

  // Sync Night Mode & Dark Class on document root
  useEffect(() => {
    localStorage.setItem('hoimu_night_mode', JSON.stringify(isNightMode));
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isNightMode);
    }
  }, [isNightMode]);

  // Sync Focus Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_focus_mode', JSON.stringify(isFocusMode));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('focus-mode', isFocusMode);
    }
  }, [isFocusMode]);

  // Sync Glove Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_glove_mode', JSON.stringify(isGloveMode));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('glove-mode', isGloveMode);
    }
  }, [isGloveMode]);

  // Sync High Contrast Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_high_contrast', JSON.stringify(isHighContrast));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('high-contrast', isHighContrast);
    }
  }, [isHighContrast]);

  // Sync Direct Sun Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_direct_sun', JSON.stringify(isDirectSun));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('direct-sun', isDirectSun);
    }
  }, [isDirectSun]);

  // Ambient Light Sensor detection for Direct Sun Mode auto-trigger
  useEffect(() => {
    if (typeof window !== 'undefined' && 'AmbientLightSensor' in window) {
      try {
        const SensorClass = (window as any).AmbientLightSensor;
        const sensor = new SensorClass();
        sensor.addEventListener('reading', () => {
          if (sensor.illuminance > 10000 && !isDirectSun) {
            setIsDirectSun(true);
            addToast(
              '☀️ Direct Sun Mode Auto-Enabled',
              `Ambient light sensor > 10,000 lux detected (${Math.round(sensor.illuminance)} lux). Pure white high contrast mode active.`,
              'info'
            );
          }
        });
        sensor.start();
        return () => sensor.stop();
      } catch {
        // Sensor API present but permissions/hardware unavail
      }
    }
  }, [isDirectSun, addToast]);

  const handleToggleNightMode = useCallback(() => {
    setIsNightMode((prev) => !prev);
  }, []);

  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      const next = !prev;
      addToast(
        next ? 'Fookusrežiim SISSE' : 'Fookusrežiim VÄLJA',
        next
          ? 'Liigsed animatsioonid peidetud, suurendatud kontrastsus ADHD/fookuse jaoks.'
          : 'Tavalised animatsioonid taastatud.',
        'info'
      );
      return next;
    });
  }, [addToast]);

  const handleToggleGloveMode = useCallback(() => {
    setIsGloveMode((prev) => {
      const next = !prev;
      addToast(
        next ? 'Glove Mode (Large Targets) ON' : 'Glove Mode OFF',
        next
          ? 'Min 56×56dp buttons, 72×72dp map points, +20% global text scaling active.'
          : 'Standard touch targets restored.',
        'info'
      );
      return next;
    });
  }, [addToast]);

  const handleToggleHighContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev;
      addToast(
        next ? 'High Contrast Mode ON' : 'High Contrast Mode OFF',
        next
          ? 'Thick 2px solid borders active, translucency & glassmorphism removed.'
          : 'Standard visual styling restored.',
        'info'
      );
      return next;
    });
  }, [addToast]);

  const handleToggleDirectSun = useCallback(() => {
    setIsDirectSun((prev) => {
      const next = !prev;
      addToast(
        next ? 'Direct Sun Mode ON' : 'Direct Sun Mode OFF',
        next
          ? 'Forced pure white background & bold high-density black typography for outdoor glare.'
          : 'Standard theme background restored.',
        'info'
      );
      return next;
    });
  }, [addToast]);

  return {
    isNightMode,
    setIsNightMode,
    isFocusMode,
    setIsFocusMode,
    isGloveMode,
    setIsGloveMode,
    isHighContrast,
    setIsHighContrast,
    isDirectSun,
    setIsDirectSun,
    handleToggleNightMode,
    handleToggleFocusMode,
    handleToggleGloveMode,
    handleToggleHighContrast,
    handleToggleDirectSun,
  };
}
