import { GeoFix, LocationProvider } from '../../types';

export class BrowserGeolocationProvider implements LocationProvider {
  public readonly id = 'browser';
  public readonly name = 'Browser Geolocation (W3C HTML5)';
  private watchId: number | null = null;
  private listeners: Set<(fix: GeoFix) => void> = new Set();
  private lastFix: GeoFix | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    if (this.watchId !== null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.status = 'error';
      return;
    }

    this.status = 'running';
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
          altitudeMeters: pos.coords.altitude || undefined,
          speedMps: pos.coords.speed || undefined,
          headingDeg: pos.coords.heading || undefined,
        };
        this.lastFix = fix;
        this.listeners.forEach((fn) => {
          try {
            fn(fix);
          } catch (e) {
            console.error('[BrowserGeolocationProvider] Listener error:', e);
          }
        });
      },
      (err) => {
        console.warn('[BrowserGeolocationProvider] Position error:', err.message);
        this.status = 'error';
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  }

  public async stop(): Promise<void> {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
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
}
