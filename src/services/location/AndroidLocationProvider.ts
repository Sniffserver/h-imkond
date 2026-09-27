import { GeoFix, LocationProvider } from '../../types';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export class AndroidLocationProvider implements LocationProvider {
  public readonly id = 'android';
  public readonly name = 'Android Fused Location Provider (Capacitor)';
  private watchCallbackId: string | null = null;
  private listeners: Set<(fix: GeoFix) => void> = new Set();
  private lastFix: GeoFix | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    if (this.watchCallbackId !== null) return;
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            this.status = 'error';
            return;
          }
        }
      }

      this.status = 'running';
      this.watchCallbackId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
        (position, err) => {
          if (err || !position) {
            console.warn('[AndroidLocationProvider] Position watch error:', err);
            return;
          }
          const fix: GeoFix = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            timestamp: position.timestamp || Date.now(),
            altitudeMeters: position.coords.altitude || undefined,
            speedMps: position.coords.speed || undefined,
            headingDeg: position.coords.heading || undefined,
          };
          this.lastFix = fix;
          this.listeners.forEach((fn) => {
            try {
              fn(fix);
            } catch (e) {
              console.error(e);
            }
          });
        }
      );
    } catch (e) {
      console.error('[AndroidLocationProvider] Start failure:', e);
      this.status = 'error';
    }
  }

  public async stop(): Promise<void> {
    if (this.watchCallbackId) {
      try {
        await Geolocation.clearWatch({ id: this.watchCallbackId });
      } catch {
        // Ignored
      }
      this.watchCallbackId = null;
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
