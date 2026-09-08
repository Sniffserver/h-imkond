export type ProgressTrackCategory = 'preparedness' | 'connection' | 'contribution';

export interface TrackChangeReason {
  id: string;
  track: ProgressTrackCategory;
  title: string;
  explanation: string;
  deltaPercent: number;
  timestamp: number;
  actionLabel?: string;
  actionTarget?: string; // e.g. 'map', 'mesh', 'exchange'
}

export interface ProgressTrackData {
  preparednessLevel: number; // 0 - 100
  connectionLevel: number;   // 0 - 100
  contributionLevel: number; // 0 - 100
  history: TrackChangeReason[];
  isPublicSharingOptIn: boolean; // default false
  lastUpdated: number;
}

const STORAGE_KEY = 'hoimu_private_progress_tracks_v1';

const DEFAULT_STATE: ProgressTrackData = {
  preparednessLevel: 65,
  connectionLevel: 48,
  contributionLevel: 72,
  isPublicSharingOptIn: false,
  lastUpdated: Date.now(),
  history: [
    {
      id: 'init_1',
      track: 'preparedness',
      title: 'Offline Map Downloaded',
      explanation: 'Downloaded Tartu regional vector map tiles. Navigation is now fully functional off-grid.',
      deltaPercent: 15,
      timestamp: Date.now() - 3600000 * 24 * 2,
      actionLabel: 'View Offline Map',
      actionTarget: 'map',
    },
    {
      id: 'init_2',
      track: 'connection',
      title: 'Trusted Local Peer Linked',
      explanation: 'Established an encrypted direct radio key exchange with nearby peer.',
      deltaPercent: 12,
      timestamp: Date.now() - 3600000 * 24 * 4,
      actionLabel: 'View Mesh Contacts',
      actionTarget: 'mesh',
    },
    {
      id: 'init_3',
      track: 'contribution',
      title: 'Solar Tool Shared',
      explanation: 'Listed a portable solar charger in the local mutual aid catalog for neighbor use.',
      deltaPercent: 20,
      timestamp: Date.now() - 3600000 * 24 * 6,
      actionLabel: 'View Resource List',
      actionTarget: 'exchange',
    },
  ],
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
          // Ensure history array exists
          history: parsed.history || DEFAULT_STATE.history,
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
