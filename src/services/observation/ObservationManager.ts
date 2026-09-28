import { SignalObservation } from '../../types';
import { ObservationProvider, ObservationProviderType } from './ObservationProvider';
import {
  LoRaObservationProvider,
  BLEObservationProvider,
  WiFiObservationProvider,
  MeshBridgeObservationProvider,
  ReplayObservationProvider,
} from './ObservationProviders';

export class ObservationManager {
  private static instance: ObservationManager | null = null;
  private providers: Map<ObservationProviderType, ObservationProvider> = new Map();
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private trailHistory: SignalObservation[] = [];
  private static MAX_TRAIL = 100;

  private constructor() {
    const lora = new LoRaObservationProvider();
    const ble = new BLEObservationProvider();
    const wifi = new WiFiObservationProvider();
    const bridge = new MeshBridgeObservationProvider();
    const replay = new ReplayObservationProvider();

    this.providers.set('lora', lora);
    this.providers.set('ble', ble);
    this.providers.set('wifi', wifi);
    this.providers.set('mesh_bridge', bridge);
    this.providers.set('replay', replay);

    // Multicast all provider events into universal observation bus
    this.providers.forEach((p) => {
      p.subscribe((obs) => {
        this.trailHistory.push(obs);
        if (this.trailHistory.length > ObservationManager.MAX_TRAIL) {
          this.trailHistory.shift();
        }
        this.listeners.forEach((fn) => {
          try {
            fn(obs);
          } catch (e) {
            console.error(e);
          }
        });
      });
    });
  }

  public static getInstance(): ObservationManager {
    if (!ObservationManager.instance) {
      ObservationManager.instance = new ObservationManager();
    }
    return ObservationManager.instance;
  }

  public getProvider<T extends ObservationProvider>(type: ObservationProviderType): T | undefined {
    return this.providers.get(type) as T | undefined;
  }

  public getTrailHistory(): SignalObservation[] {
    return [...this.trailHistory];
  }

  public getAllObservations(): SignalObservation[] {
    return this.getTrailHistory();
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const observationManager = ObservationManager.getInstance();
