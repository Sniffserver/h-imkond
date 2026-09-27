import { SignalObservation } from '../../types';

export interface ObservationProvider {
  id: string;
  name: string;
  medium: 'lora' | 'ble' | 'wifi' | 'mesh_bridge' | 'replay';
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (obs: SignalObservation) => void): () => void;
  getLastObservation(): SignalObservation | null;
  getStatus(): 'idle' | 'running' | 'error';
}

export type ObservationProviderType = 'lora' | 'ble' | 'wifi' | 'mesh_bridge' | 'replay';
