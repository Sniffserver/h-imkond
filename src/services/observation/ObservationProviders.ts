import { SignalObservation } from '../../types';
import { ObservationProvider } from './ObservationProvider';

export class LoRaObservationProvider implements ObservationProvider {
  public readonly id = 'lora';
  public readonly name = 'SX1262 LoRa 868MHz Radio';
  public readonly medium = 'lora' as const;
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private lastObs: SignalObservation | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    this.status = 'running';
  }

  public async stop(): Promise<void> {
    this.status = 'idle';
  }

  public emitObservation(obs: SignalObservation): void {
    this.lastObs = obs;
    this.listeners.forEach((fn) => {
      try {
        fn(obs);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    if (this.lastObs) {
      try {
        listener(this.lastObs);
      } catch (e) {
        console.error(e);
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastObservation(): SignalObservation | null {
    return this.lastObs;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }
}

export class BLEObservationProvider implements ObservationProvider {
  public readonly id = 'ble';
  public readonly name = 'Bluetooth Low Energy (BLE Mesh)';
  public readonly medium = 'ble' as const;
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private lastObs: SignalObservation | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    this.status = 'running';
  }

  public async stop(): Promise<void> {
    this.status = 'idle';
  }

  public emitObservation(obs: SignalObservation): void {
    this.lastObs = obs;
    this.listeners.forEach((fn) => fn(obs));
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    if (this.lastObs) listener(this.lastObs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastObservation(): SignalObservation | null {
    return this.lastObs;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }
}

export class WiFiObservationProvider implements ObservationProvider {
  public readonly id = 'wifi';
  public readonly name = 'Wi-Fi Direct / Local 802.11 Mesh';
  public readonly medium = 'wifi' as const;
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private lastObs: SignalObservation | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    this.status = 'running';
  }

  public async stop(): Promise<void> {
    this.status = 'idle';
  }

  public emitObservation(obs: SignalObservation): void {
    this.lastObs = obs;
    this.listeners.forEach((fn) => fn(obs));
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    if (this.lastObs) listener(this.lastObs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastObservation(): SignalObservation | null {
    return this.lastObs;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }
}

export class MeshBridgeObservationProvider implements ObservationProvider {
  public readonly id = 'mesh_bridge';
  public readonly name = 'Raspberry Pi / Bridge Mesh Gateway';
  public readonly medium = 'mesh_bridge' as const;
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private lastObs: SignalObservation | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';

  public async start(): Promise<void> {
    this.status = 'running';
  }

  public async stop(): Promise<void> {
    this.status = 'idle';
  }

  public emitObservation(obs: SignalObservation): void {
    this.lastObs = obs;
    this.listeners.forEach((fn) => fn(obs));
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    if (this.lastObs) listener(this.lastObs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastObservation(): SignalObservation | null {
    return this.lastObs;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }
}

export class ReplayObservationProvider implements ObservationProvider {
  public readonly id = 'replay';
  public readonly name = 'Signal Trail Track Replay';
  public readonly medium = 'replay' as const;
  private listeners: Set<(obs: SignalObservation) => void> = new Set();
  private lastObs: SignalObservation | null = null;
  private status: 'idle' | 'running' | 'error' = 'idle';
  private timer: any = null;

  public async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';

    const testTrail: SignalObservation[] = [
      { id: 'sig_1', timestamp: Date.now(), position: { lat: 59.4420, lng: 24.7350 }, peerId: 'peer_telliskivi', rssi: -68, snr: 9.5, medium: 'lora' },
      { id: 'sig_2', timestamp: Date.now(), position: { lat: 59.4435, lng: 24.7335 }, peerId: 'peer_vabriku', rssi: -74, snr: 8.0, medium: 'ble' },
      { id: 'sig_3', timestamp: Date.now(), position: { lat: 59.4450, lng: 24.7315 }, peerId: 'peer_malmi', rssi: -82, snr: 6.2, medium: 'lora' },
    ];

    let idx = 0;
    this.timer = setInterval(() => {
      const item = testTrail[idx % testTrail.length];
      this.lastObs = { ...item, timestamp: Date.now() };
      this.listeners.forEach((fn) => fn(this.lastObs!));
      idx++;
    }, 1500);
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'idle';
  }

  public subscribe(listener: (obs: SignalObservation) => void): () => void {
    this.listeners.add(listener);
    if (this.lastObs) listener(this.lastObs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastObservation(): SignalObservation | null {
    return this.lastObs;
  }

  public getStatus(): 'idle' | 'running' | 'error' {
    return this.status;
  }
}
