import { useState, useEffect, useCallback, useMemo } from 'react';
import { ToastMessage } from '../types';
import { calculateSolarTimes, SolarTimes } from '../services/utils/solarTime';

export type ThemeMode = 'auto' | 'day' | 'night';
export type FieldDisplayMode = 'normal' | 'night' | 'red';

export interface DisplayProfile {
  luminance: 'day' | 'night' | 'sun';
  vision: 'normal' | 'red' | 'highContrast';
  mapStyle: 'standard' | 'eco' | 'crisis';
  quality: 'powerSaver' | 'balanced' | 'detail';
}

export interface UseAppThemeModesProps {
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
  userLat?: number;
  userLng?: number;
}

export function useAppThemeModes({ addToast, userLat = 59.437, userLng = 24.7535 }: UseAppThemeModesProps) {
  // Theme Mode: 'auto' (solar calculation + GPS), 'day', or 'night'
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('hoimu_theme_mode');
    if (saved === 'day' || saved === 'night' || saved === 'auto') return saved;
    // Fallback: check legacy boolean
    const legacy = localStorage.getItem('hoimu_night_mode');
    if (legacy !== null) {
      return JSON.parse(legacy) ? 'night' : 'day';
    }
    return 'auto';
  });

  // Tactical Field Display Mode: 'normal', 'night', 'red' (low-light stealth)
  const [fieldDisplayMode, setFieldDisplayModeState] = useState<FieldDisplayMode>(() => {
    const saved = localStorage.getItem('hoimu_field_display_mode');
    if (saved === 'normal' || saved === 'night' || saved === 'red') return saved;
    return 'normal';
  });

  // Calculate current solar position and times
  const [solarTimes, setSolarTimes] = useState<SolarTimes>(() =>
    calculateSolarTimes(userLat, userLng, new Date())
  );

  // Periodically refresh solar position every 60 seconds
  useEffect(() => {
    const updateSolar = () => {
      setSolarTimes(calculateSolarTimes(userLat, userLng, new Date()));
    };
    updateSolar();
    const timer = setInterval(updateSolar, 60_000);
    return () => clearInterval(timer);
  }, [userLat, userLng]);

  // System Dark Mode Preference listener
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        setSystemPrefersDark(e.matches);
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
      }
    } catch {
      // Ignored in non-DOM tests
    }
  }, []);

  // Compute effective night mode boolean
  const isNightMode = useMemo(() => {
    if (fieldDisplayMode === 'red') return true;
    if (themeMode === 'night') return true;
    if (themeMode === 'day') return false;
    // 'auto' mode: check solar elevation, then system preference
    if (!solarTimes.isDaytime) return true;
    return false;
  }, [fieldDisplayMode, themeMode, solarTimes.isDaytime]);

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

  // Persist Theme Mode & Sync Document Root (<html data-theme="..." data-display="...">)
  useEffect(() => {
    localStorage.setItem('hoimu_theme_mode', themeMode);
    localStorage.setItem('hoimu_night_mode', JSON.stringify(isNightMode));
    localStorage.setItem('hoimu_field_display_mode', fieldDisplayMode);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Ensure data-display is always explicitly set to 'normal', 'night', or 'red'
      const activeDisplay = fieldDisplayMode === 'red' ? 'red' : isNightMode ? 'night' : 'normal';
      root.setAttribute('data-display', activeDisplay);

      // Set data-theme as source of truth for design tokens
      if (fieldDisplayMode === 'red') {
        root.setAttribute('data-theme', 'red');
      } else if (isHighContrast) {
        root.setAttribute('data-theme', 'high-contrast');
      } else if (isDirectSun) {
        root.setAttribute('data-theme', 'direct-sun');
      } else if (isNightMode) {
        root.setAttribute('data-theme', 'night');
      } else {
        root.setAttribute('data-theme', 'day');
      }
    }
  }, [themeMode, isNightMode, fieldDisplayMode, isHighContrast, isDirectSun]);

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
        // Sensor API present but hardware unavail
      }
    }
  }, [isDirectSun, addToast]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    const names: Record<ThemeMode, string> = {
      auto: 'AUTO (Päikese & GPS järgi)',
      day: 'PÄEV (Kõrge loetavus)',
      night: 'ÖÖ (Madala valgusega välimapp)',
    };
    addToast(`Teema: ${names[mode]}`, undefined, 'info');
  }, [addToast]);

  const setFieldDisplayMode = useCallback((mode: FieldDisplayMode) => {
    setFieldDisplayModeState(mode);
    if (mode === 'red') {
      addToast('🔴 Taktikaline Puna-Öö Režiim', 'Valguse distsipliin aktiivne (madala heledusega punane spekter).', 'info');
    }
  }, [addToast]);

  const handleToggleNightMode = useCallback(() => {
    setThemeModeState((prev) => {
      if (prev === 'auto') return 'night';
      if (prev === 'night') return 'day';
      return 'auto';
    });
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
          ? 'Min 56×56dp nupud, 72×72dp kaardipunktid, +20% tekstiskaala aktiivne.'
          : 'Standardsed puutealad taastatud.',
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
          ? 'Paksud 2px piirjooned ja läbipaistvuse eemaldamine aktiivne.'
          : 'Tavaline visuaalne stiil taastatud.',
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
          ? 'Kõrge peegeldusega valge taust ja must tekst otsese päikesevalguse jaoks.'
          : 'Tavaline teema taastatud.',
        'info'
      );
      return next;
    });
  }, [addToast]);

  // Compute unified DisplayProfile (Requirement 49)
  const displayProfile = useMemo<DisplayProfile>(() => {
    let luminance: 'day' | 'night' | 'sun' = 'day';
    if (isDirectSun) luminance = 'sun';
    else if (isNightMode) luminance = 'night';

    let vision: 'normal' | 'red' | 'highContrast' = 'normal';
    if (fieldDisplayMode === 'red') vision = 'red';
    else if (isHighContrast) vision = 'highContrast';

    let mapStyle: 'standard' | 'eco' | 'crisis' = 'standard';
    if (fieldDisplayMode === 'red') mapStyle = 'crisis';
    else if (isNightMode) mapStyle = 'eco';

    let quality: 'powerSaver' | 'balanced' | 'detail' = 'balanced';
    if (isGloveMode) quality = 'powerSaver';

    return {
      luminance,
      vision,
      mapStyle,
      quality,
    };
  }, [isDirectSun, isNightMode, fieldDisplayMode, isHighContrast, isGloveMode]);

  const setDisplayProfile = useCallback((profile: Partial<DisplayProfile>) => {
    if (profile.luminance === 'sun') {
      setIsDirectSun(true);
    } else if (profile.luminance === 'night') {
      setIsDirectSun(false);
      setThemeModeState('night');
    } else if (profile.luminance === 'day') {
      setIsDirectSun(false);
      setThemeModeState('day');
    }

    if (profile.vision === 'red') {
      setFieldDisplayModeState('red');
    } else if (profile.vision === 'highContrast') {
      setIsHighContrast(true);
      setFieldDisplayModeState('normal');
    } else if (profile.vision === 'normal') {
      setIsHighContrast(false);
      setFieldDisplayModeState('normal');
    }
  }, []);

  return {
    displayProfile,
    setDisplayProfile,
    themeMode,
    setThemeMode,
    fieldDisplayMode,
    setFieldDisplayMode,
    solarTimes,
    isNightMode,
    setIsNightMode: (val: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof val === 'function' ? val(isNightMode) : val;
      setThemeModeState(nextVal ? 'night' : 'day');
    },
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
