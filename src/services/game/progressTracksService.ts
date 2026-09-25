export type ProgressTrackCategory = 'preparedness' | 'connection' | 'contribution';

export interface TrackChangeReason {
  id: string;
  track: ProgressTrackCategory;
  title: string;
  explanation: string;
  deltaPercent: number;
  timestamp: number;
  actionLabel?: string;
  actionTarget?: string; // e.g. 'map', 'mesh', 'exchange', 'journal'
}

export interface ProgressTrackInfo {
  category: ProgressTrackCategory;
  name: string;
  tagline: string;
  description: string;
  color: string;
  lightBg: string;
  darkBg: string;
  borderColor: string;
  iconName: string;
  examples: string[];
}

export const TRACK_DEFINITIONS: Record<ProgressTrackCategory, ProgressTrackInfo> = {
  preparedness: {
    category: 'preparedness',
    name: 'Preparedness',
    tagline: 'Ready for offline & emergency situations',
    description: 'Measures how resilient your device and household are for standalone, off-grid operation without reliance on central servers or utility infrastructure.',
    color: '#2A9D8F',
    lightBg: '#EBF7F5',
    darkBg: '#132824',
    borderColor: '#2A9D8F',
    iconName: 'Shield',
    examples: [
      'Downloaded offline vector map regions',
      'Encrypted local identity & keypair backups',
      'Field manual & offline survival guide cached',
      'Battery power management configured',
    ],
  },
  connection: {
    category: 'connection',
    name: 'Connection',
    tagline: 'Ties to trusted local people',
    description: 'Reflects the strength and diversity of your cryptographic peer-to-peer radio links with neighbors and local mutual aid partners.',
    color: '#588157',
    lightBg: '#F0F5EE',
    darkBg: '#1E2C1C',
    borderColor: '#87A878',
    iconName: 'Users',
    examples: [
      'Verified local peer public keys',
      'Direct LoRa/Bluetooth mesh hops active',
      'Bilateral trust endorsements exchanged',
      'Local emergency contacts registered',
    ],
  },
  contribution: {
    category: 'contribution',
    name: 'Contribution',
    tagline: 'Supporting the community by choice',
    description: 'Reflects voluntary mutual aid actions you choose to take to strengthen your bioregion—without quotas, deadlines, or penalties.',
    color: '#E76F51',
    lightBg: '#FDF1EE',
    darkBg: '#2C1B17',
    borderColor: '#E76F51',
    iconName: 'HeartHandshake',
    examples: [
      'Tools or energy listed in mutual aid library',
      'Packets forwarded across community mesh',
      'Bioregional skills and harvest offered',
      'Votes cast in community DAO council',
    ],
  },
};

export interface ProgressTrackData {
  preparednessLevel: number; // 0 - 100
  connectionLevel: number;   // 0 - 100
  contributionLevel: number; // 0 - 100
  history: TrackChangeReason[];
  isPublicSharingOptIn: boolean; // default false
  gamificationEnabled: boolean;  // default true, can opt out
  celebrationAlertsEnabled: boolean; // default true
  lastUpdated: number;
}

const STORAGE_KEY = 'hoimu_private_progress_tracks_v2';

const DEFAULT_STATE: ProgressTrackData = {
  preparednessLevel: 0,
  connectionLevel: 0,
  contributionLevel: 0,
  isPublicSharingOptIn: false,
  gamificationEnabled: false,
  celebrationAlertsEnabled: false,
  lastUpdated: Date.now(),
  history: [],
};

type Listener = (state: ProgressTrackData) => void;

class ProgressTracksService {
  private state: ProgressTrackData;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): ProgressTrackData {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          history: Array.isArray(parsed.history) ? parsed.history : DEFAULT_STATE.history,
          gamificationEnabled: parsed.gamificationEnabled !== undefined ? parsed.gamificationEnabled : true,
          celebrationAlertsEnabled: parsed.celebrationAlertsEnabled !== undefined ? parsed.celebrationAlertsEnabled : true,
        };
      }
    } catch (e) {
      console.warn('Failed to load progress tracks state:', e);
    }
    return DEFAULT_STATE;
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (e) {
      console.warn('Failed to save progress tracks state:', e);
    }
  }

  public getState(): ProgressTrackData {
    return { ...this.state };
  }

  public recordProgress(
    track: ProgressTrackCategory,
    delta: number,
    title: string,
    explanation: string,
    actionLabel?: string,
    actionTarget?: string
  ): TrackChangeReason {
    const entry: TrackChangeReason = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      track,
      title,
      explanation,
      deltaPercent: delta,
      timestamp: Date.now(),
      actionLabel,
      actionTarget,
    };

    if (track === 'preparedness') {
      this.state.preparednessLevel = Math.min(100, Math.max(0, this.state.preparednessLevel + delta));
    } else if (track === 'connection') {
      this.state.connectionLevel = Math.min(100, Math.max(0, this.state.connectionLevel + delta));
    } else if (track === 'contribution') {
      this.state.contributionLevel = Math.min(100, Math.max(0, this.state.contributionLevel + delta));
    }

    this.state.history.unshift(entry);
    this.state.lastUpdated = Date.now();
    this.saveState();

    return entry;
  }

  public setPublicOptIn(optIn: boolean): void {
    this.state.isPublicSharingOptIn = optIn;
    this.saveState();
  }

  public setGamificationEnabled(enabled: boolean): void {
    this.state.gamificationEnabled = enabled;
    this.saveState();
  }

  public setCelebrationAlertsEnabled(enabled: boolean): void {
    this.state.celebrationAlertsEnabled = enabled;
    this.saveState();
  }

  public resetProgress(): void {
    this.state = {
      ...DEFAULT_STATE,
      preparednessLevel: 0,
      connectionLevel: 0,
      contributionLevel: 0,
      history: [],
      lastUpdated: Date.now(),
    };
    this.saveState();
  }

  public exportDataJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }
}

export const progressTracksService = new ProgressTracksService();
