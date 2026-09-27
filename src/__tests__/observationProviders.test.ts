import { describe, it, expect } from 'vitest';
import {
  observationManager,
  LoRaObservationProvider,
  BLEObservationProvider,
  WiFiObservationProvider,
  MeshBridgeObservationProvider,
  ReplayObservationProvider,
} from '../services/observation';
import { SignalObservation } from '../types';

describe('Observation Provider Abstraction & Universal Signal Trail', () => {
  it('allows registering and subscribing to individual signal observation providers', () => {
    const lora = new LoRaObservationProvider();
    expect(lora.medium).toBe('lora');

    let received: SignalObservation | null = null;
    const unsub = lora.subscribe((obs) => {
      received = obs;
    });

    const sample: SignalObservation = {
      id: 'obs_1',
      timestamp: Date.now(),
      position: { lat: 59.4420, lng: 24.7350 },
      peerId: 'peer_node_01',
      rssi: -72,
      snr: 9.0,
      medium: 'lora',
    };

    lora.emitObservation(sample);
    expect(received).toEqual(sample);
    expect(lora.getLastObservation()).toEqual(sample);

    unsub();
  });

  it('provides BLE, WiFi, and MeshBridge observation providers', () => {
    const ble = new BLEObservationProvider();
    const wifi = new WiFiObservationProvider();
    const bridge = new MeshBridgeObservationProvider();

    expect(ble.medium).toBe('ble');
    expect(wifi.medium).toBe('wifi');
    expect(bridge.medium).toBe('mesh_bridge');
  });

  it('replays signal observation trail with ReplayObservationProvider', async () => {
    const replay = new ReplayObservationProvider();
    let count = 0;
    const unsub = replay.subscribe(() => {
      count++;
    });

    await replay.start();
    await new Promise((r) => setTimeout(r, 60));
    await replay.stop();

    unsub();
    expect(replay.getStatus()).toBe('idle');
  });

  it('aggregates hardware observations into universal ObservationManager bus', () => {
    let busReceived: SignalObservation | null = null;
    const unsub = observationManager.subscribe((obs) => {
      busReceived = obs;
    });

    const lora = observationManager.getProvider<LoRaObservationProvider>('lora');
    expect(lora).toBeDefined();

    if (lora) {
      const sample: SignalObservation = {
        id: 'bus_sample',
        timestamp: Date.now(),
        position: { lat: 59.4370, lng: 24.7535 },
        peerId: 'node_kesklinn',
        rssi: -65,
        medium: 'lora',
      };
      lora.emitObservation(sample);
      expect(busReceived).toEqual(sample);
      expect(observationManager.getTrailHistory().length).toBeGreaterThan(0);
    }

    unsub();
  });
});
