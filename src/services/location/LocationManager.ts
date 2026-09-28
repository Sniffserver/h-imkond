import { GeoFix, LocationProvider } from '../../types';
import { BrowserGeolocationProvider } from './BrowserGeolocationProvider';
import { AndroidLocationProvider } from './AndroidLocationProvider';
import { GNSSSerialProvider } from './GNSSSerialProvider';
import { MeshLocationProvider } from './MeshLocationProvider';
import { ReplayLocationProvider } from './ReplayLocationProvider';
import { LocationProviderType, LocationProviderInfo } from './LocationProvider';

const STORAGE_KEY_PROVIDER = 'hoimu_location_provider_type';

export class LocationManager {
  private static instance: LocationManager | null = null;
  private providers: Map<LocationProviderType, LocationProvider> = new Map();
  private activeProviderType: LocationProviderType = 'browser';
  private activeProvider: LocationProvider;
  private listeners: Set<(fix: GeoFix) => void> = new Set();
  private lastFix: GeoFix | null = null;
  private unsubscribeActive: (() => void) | null = null;

  private constructor() {
    // Register all providers
    const browser = new BrowserGeolocationProvider();
    const android = new AndroidLocationProvider();
    const gnssSerial = new GNSSSerialProvider();
    const meshLoc = new MeshLocationProvider();
    const replay = new ReplayLocationProvider();

    this.providers.set('browser', browser);
    this.providers.set('android', android);
    this.providers.set('gnss_serial', gnssSerial);
    this.providers.set('mesh_triangulation', meshLoc);
    this.providers.set('replay', replay);

    // Initial preference
    let savedType: LocationProviderType = 'browser';
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PROVIDER) as LocationProviderType;
        if (saved && this.providers.has(saved)) {
          savedType = saved;
        }
      } catch {
        // Ignored
      }
    }

    this.activeProviderType = savedType;
    this.activeProvider = this.providers.get(savedType) || browser;
    this.bindActiveProvider();
  }

  public static getInstance(): LocationManager {
    if (!LocationManager.instance) {
      LocationManager.instance = new LocationManager();
    }
    return LocationManager.instance;
  }

  public getAvailableProviders(): LocationProviderInfo[] {
    return [
      {
        id: 'browser',
        name: 'Browser Geolocation',
        description: 'Standard HTML5 Geolocation API (GPS / WiFi)',
        sourceType: 'os',
        available: true,
      },
      {
        id: 'android',
        name: 'Android Fused Location',
        description: 'Capacitor Android native GPS provider',
        sourceType: 'os',
        available: true,
      },
      {
        id: 'gnss_serial',
        name: 'GNSS Serial / USB GPS',
        description: 'Direct NMEA 0183 / UART receiver (Raspberry Pi & Field Dongles)',
        sourceType: 'hardware',
        available: true,
      },
      {
        id: 'mesh_triangulation',
        name: 'Mesh RF Trilateration',
        description: 'Off-grid position estimation from LoRa/BLE mesh anchors',
        sourceType: 'mesh',
        available: true,
      },
      {
        id: 'replay',
        name: 'Field Track Replay',
        description: 'Simulate walking/biking track in Tallinn for testing',
        sourceType: 'simulation',
        available: true,
      },
    ];
  }

  public getActiveProviderType(): LocationProviderType {
    return this.activeProviderType;
  }

  public getActiveProvider(): LocationProvider {
    return this.activeProvider;
  }

  public async setProvider(type: LocationProviderType): Promise<void> {
    const nextProvider = this.providers.get(type);
    if (!nextProvider || type === this.activeProviderType) return;

    // Stop current
    if (this.unsubscribeActive) {
      this.unsubscribeActive();
      this.unsubscribeActive = null;
    }
    await this.activeProvider.stop();

    // Switch
    this.activeProviderType = type;
    this.activeProvider = nextProvider;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PROVIDER, type);
      } catch {
        // Ignored
      }
    }

    this.bindActiveProvider();
    await this.activeProvider.start();
  }

  private bindActiveProvider(): void {
    this.unsubscribeActive = this.activeProvider.subscribe((fix) => {
      this.lastFix = fix;
      this.listeners.forEach((fn) => {
        try {
          fn(fix);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  public async start(): Promise<void> {
    await this.activeProvider.start();
  }

  public async stop(): Promise<void> {
    await this.activeProvider.stop();
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
    return this.lastFix || this.activeProvider.getLastFix();
  }

  public getState(): { isLive: boolean; activeFix: GeoFix | null; activeProvider: LocationProviderType } {
    const fix = this.getLastFix();
    return {
      isLive: !!fix,
      activeFix: fix,
      activeProvider: this.activeProviderType,
    };
  }
}

export const locationManager = LocationManager.getInstance();
