import { GeoFix, LocationProvider } from '../../types';

export interface ReplayWaypoint {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  speedMps?: number;
  headingDeg?: number;
}

// Canonical Kalamaja / Telliskivi field test track
export const DEFAULT_TALLINN_REPLAY_TRACK: ReplayWaypoint[] = [
  { lat: 59.4420, lng: 24.7350, accuracyMeters: 4.2, speedMps: 1.3, headingDeg: 340 }, // Telliskivi tn
  { lat: 59.4435, lng: 24.7335, accuracyMeters: 3.8, speedMps: 1.4, headingDeg: 345 },
  { lat: 59.4450, lng: 24.7315, accuracyMeters: 4.1, speedMps: 1.2, headingDeg: 330 }, // Malmi tn
  { lat: 59.4465, lng: 24.7300, accuracyMeters: 5.0, speedMps: 1.1, headingDeg: 300 }, // Kopli tn
  { lat: 59.4480, lng: 24.7290, accuracyMeters: 4.5, speedMps: 1.3, headingDeg: 310 }, // Vabriku tn
  { lat: 59.4500, lng: 24.7320, accuracyMeters: 3.5, speedMps: 1.4, headingDeg: 45 },  // Valgevase tn
  { lat: 59.4515, lng: 24.7350, accuracyMeters: 4.0, speedMps: 1.3, headingDeg: 60 },  // Kungla tn
  { lat: 59.4530, lng: 24.7380, accuracyMeters: 3.2, speedMps: 1.2, headingDeg: 70 },  // Kalamaja kalmistupark
  { lat: 59.4540, lng: 24.7405, accuracyMeters: 3.0, speedMps: 1.4, headingDeg: 90 },  // Noblessner
];

export class ReplayLocationProvider implements LocationProvider {
  public readonly id = 'replay';
  public readonly name = 'Field Track Replay (Simulated Walk)';
  private listeners: Set<(fix: GeoFix) => void> = new Set();
  private lastFix: GeoFix | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';
  private track: ReplayWaypoint[] = DEFAULT_TALLINN_REPLAY_TRACK;
  private currentIndex: number = 0;
  private timer: any = null;
  private intervalMs: number = 1000;
  private loop: boolean = true;

  constructor(track?: ReplayWaypoint[]) {
    if (track && track.length > 0) {
      this.track = track;
    }
  }

  public setTrack(track: ReplayWaypoint[]): void {
    this.track = track;
    this.currentIndex = 0;
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.intervalMs = Math.max(100, Math.round(1000 / multiplier));
    if (this.status === 'running') {
      this.stop();
      this.start();
    }
  }

  public async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';

    const emitCurrent = () => {
      if (this.track.length === 0) return;
      const wp = this.track[this.currentIndex];
      const fix: GeoFix = {
        lat: wp.lat,
        lng: wp.lng,
        accuracyMeters: wp.accuracyMeters || 4.0,
        timestamp: Date.now(),
        speedMps: wp.speedMps || 1.3,
        headingDeg: wp.headingDeg,
      };

      this.lastFix = fix;
      this.listeners.forEach((fn) => {
        try {
          fn(fix);
        } catch (e) {
          console.error(e);
        }
      });
    };

    emitCurrent();

    this.timer = setInterval(() => {
      this.currentIndex++;
      if (this.currentIndex >= this.track.length) {
        if (this.loop) {
          this.currentIndex = 0;
        } else {
          this.stop();
          return;
        }
      }
      emitCurrent();
    }, this.intervalMs);
  }


  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'idle';
  }

  public subscribe(listener: (fix: GeoFix) => void): () => void {
    this.listeners.add(listener);
    if (this.lastFix) {
      try {
        listener(this.lastFix);
      } catch (e) {
        console.error(e);
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastFix(): GeoFix | null {
    return this.lastFix;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getTrackLength(): number {
    return this.track.length;
  }
}
