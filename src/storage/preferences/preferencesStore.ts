/**
 * Storage Domain: preferences
 * 
 * SOLE STORAGE DOMAIN PERMITTED TO USE localStorage.
 * 
 * Manages user interface and tactile operational preferences:
 * - themeMode ('day' | 'night' | 'tactical' | 'crisis')
 * - isNightMode (boolean)
 * - isHighContrast (boolean)
 * - isGloveMode (boolean)
 * - isDirectSun (boolean)
 * - fieldDisplayMode ('compact' | 'standard' | 'expanded')
 * - soundFeedbackEnabled (boolean)
 * - mapQualityMode ('standard' | 'vector' | 'satellite' | 'hybrid')
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * No cryptographic material, identities, mesh packets, or routing states
 * may ever be stored here or in localStorage.
 */

export interface UserPreferences {
  themeMode: 'day' | 'night' | 'tactical' | 'crisis';
  isNightMode: boolean;
  isHighContrast: boolean;
  isGloveMode: boolean;
  isDirectSun: boolean;
  fieldDisplayMode: 'compact' | 'standard' | 'expanded';
  soundFeedbackEnabled: boolean;
  mapQualityMode?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  themeMode: 'tactical',
  isNightMode: true,
  isHighContrast: false,
  isGloveMode: false,
  isDirectSun: false,
  fieldDisplayMode: 'standard',
  soundFeedbackEnabled: true,
  mapQualityMode: 'vector',
};

const PREF_PREFIX = 'hoimu_pref_';

const PREF_KEY_MAP: Record<keyof UserPreferences, string> = {
  themeMode: `${PREF_PREFIX}theme_mode`,
  isNightMode: `${PREF_PREFIX}night_mode`,
  isHighContrast: `${PREF_PREFIX}high_contrast`,
  isGloveMode: `${PREF_PREFIX}glove_mode`,
  isDirectSun: `${PREF_PREFIX}direct_sun`,
  fieldDisplayMode: `${PREF_PREFIX}field_display_mode`,
  soundFeedbackEnabled: `${PREF_PREFIX}sound_feedback`,
  mapQualityMode: `${PREF_PREFIX}map_quality`,
};

export class PreferencesStore {
  /**
   * Retrieves all user preferences from localStorage.
   */
  public static getPreferences(): UserPreferences {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_PREFERENCES };
    }

    try {
      const themeMode = (localStorage.getItem(PREF_KEY_MAP.themeMode) as any) || DEFAULT_PREFERENCES.themeMode;
      const isNightMode = localStorage.getItem(PREF_KEY_MAP.isNightMode) !== null
        ? localStorage.getItem(PREF_KEY_MAP.isNightMode) === 'true'
        : DEFAULT_PREFERENCES.isNightMode;
      const isHighContrast = localStorage.getItem(PREF_KEY_MAP.isHighContrast) === 'true';
      const isGloveMode = localStorage.getItem(PREF_KEY_MAP.isGloveMode) === 'true';
      const isDirectSun = localStorage.getItem(PREF_KEY_MAP.isDirectSun) === 'true';
      const fieldDisplayMode = (localStorage.getItem(PREF_KEY_MAP.fieldDisplayMode) as any) || DEFAULT_PREFERENCES.fieldDisplayMode;
      const soundFeedbackEnabled = localStorage.getItem(PREF_KEY_MAP.soundFeedbackEnabled) !== 'false';
      const mapQualityMode = localStorage.getItem(PREF_KEY_MAP.mapQualityMode) || DEFAULT_PREFERENCES.mapQualityMode;

      return {
        themeMode,
        isNightMode,
        isHighContrast,
        isGloveMode,
        isDirectSun,
        fieldDisplayMode,
        soundFeedbackEnabled,
        mapQualityMode,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /**
   * Updates a specific preference key in localStorage.
   */
  public static setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const storageKey = PREF_KEY_MAP[key];
      if (storageKey) {
        localStorage.setItem(storageKey, String(value));
      }
    } catch (e) {
      console.warn('[PreferencesStore] Failed to write preference:', e);
    }
  }

  /**
   * Clears preference storage.
   */
  public static resetToDefaults(): void {
    if (typeof localStorage === 'undefined') return;

    for (const key of Object.values(PREF_KEY_MAP)) {
      localStorage.removeItem(key);
    }
  }
}
