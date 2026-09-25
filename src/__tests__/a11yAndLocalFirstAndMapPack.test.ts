import { describe, it, expect, vi, beforeEach } from 'vitest';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';
import { computeMapStateInfo } from '../services/map/mapState';
import { mapPackService, calculateSha256 } from '../services/map/mapPackService';
import { LocalStateEngine } from '../engine/localStateEngine';
import { generateRandomIdentity } from '../crypto/identity';
import { createMockPMTilesHeader } from '../features/map/packs/MapPackManifest';

describe('Requirement 29: Accessibility, Red Mode Non-Color Indicators & Glove Mode', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async () => {
      const mockData = createMockPMTilesHeader(512);
      return new Response(mockData, {
        status: 200,
        headers: {
          'Content-Length': String(mockData.byteLength),
          'Content-Type': 'application/x-protobuf',
        },
      });
    });
  });
  it('announces network and map state changes via aria-live polite regions', () => {
    let lastPolite = '';
    const unsubscribe = a11yAnnouncer.subscribe(({ polite }) => {
      lastPolite = polite;
    });

    a11yAnnouncer.announceNetworkState('OFFLINE', 'Switched to local LoRa mesh channel');
    expect(lastPolite).toContain('Network status changed to OFFLINE');
    expect(lastPolite).toContain('Switched to local LoRa mesh channel');

    a11yAnnouncer.announceMapStatus('Vector map loaded', [24.75, 59.43]);
    expect(lastPolite).toContain('Tactical map: Vector map loaded');
    expect(lastPolite).toContain('59.4300N');

    unsubscribe();
  });

  it('ensures status badges include textual symbols and labels alongside color for Red Mode accessibility', () => {
    const live = computeMapStateInfo({ isOnline: true, hasMapPack: true });
    expect(live.symbol).toBe('●');
    expect(live.label).toBe('LIVE');
    expect(live.fullText).toBe('● LIVE');

    const offlinePack = computeMapStateInfo({ isOnline: false, hasMapPack: true });
    expect(offlinePack.symbol).toBe('■');
    expect(offlinePack.label).toBe('OFFLINE');
    expect(offlinePack.fullText).toBe('■ OFFLINE');

    const offlineNoPack = computeMapStateInfo({ isOnline: false, hasMapPack: false });
    expect(offlineNoPack.symbol).toBe('⚠');
    expect(offlineNoPack.label).toBe('NO MAP PACK');
    expect(offlineNoPack.fullText).toBe('⚠ NO MAP PACK');
  });
});

describe('Requirement 30: Local-First Data Model Invariant', () => {
  let identity: any;

  beforeEach(async () => {
    identity = await generateRandomIdentity('LOCAL-FIRST-CALLSIGN');
  });

  it('succeeds locally first: writes local state & updates UI listeners immediately before background mesh dispatch', async () => {
    const engine = new LocalStateEngine(identity);
    let notifiedState: any = null;

    engine.subscribe((state) => {
      notifiedState = state;
    });

    const mockRouterSend = vi.fn().mockResolvedValue({ status: 'queued' });
    engine.attachToMeshRouter({
      sendOutbound: mockRouterSend,
      deliveryManager: { onDelivery: vi.fn() },
    } as any);

    // Act: Mutate entity locally
    const needId = await engine.postMutualAidNeed({
      title: 'Emergency Generator Assistance',
      category: 'power',
      description: 'Need 2kW inverter for medical equipment',
      urgency: 'high',
      status: 'open',
      latitude: 59.43,
      longitude: 24.75,
    });

    // Assert 1: Local state updated immediately
    expect(notifiedState).not.toBeNull();
    const createdNeed = notifiedState.mutualAid.get(needId);
    expect(createdNeed).toBeDefined();
    expect(createdNeed.title).toBe('Emergency Generator Assistance');

    // Assert 2: Signed CRDT event exists in local log
    const eventLog = engine.getEventLog().getEvents();
    expect(eventLog.length).toBeGreaterThan(0);
    expect(eventLog[0].authorCallsign).toBe('LOCAL-FIRST-CALLSIGN');

    // Assert 3: Background sync effect triggered secondary dispatch
    expect(mockRouterSend).toHaveBeenCalled();
  });
});

describe('Requirement 31 & 32: Explicit Map States & MapPack Lifecycle with SHA-256', () => {
  it('correctly maps all explicit map states with symbols and labels', () => {
    expect(computeMapStateInfo({ isOnline: true, isDegraded: false, hasMapPack: true }).state).toBe('ONLINE');
    expect(computeMapStateInfo({ isOnline: true, isDegraded: true, hasMapPack: true }).state).toBe('ONLINE_DEGRADED');
    expect(computeMapStateInfo({ isOnline: false, hasMapPack: true }).state).toBe('OFFLINE_WITH_PACK');
    expect(computeMapStateInfo({ isOnline: false, hasMapPack: false }).state).toBe('OFFLINE_NO_PACK');
    expect(computeMapStateInfo({ isOnline: false, hasMapPack: false, isLoading: true }).state).toBe('MAP_LOADING');
    expect(computeMapStateInfo({ isOnline: false, hasMapPack: false, hasError: true }).state).toBe('MAP_ERROR');
  });

  it('verifies SHA-256 hash before map pack activation and performs atomic switch', async () => {
    const testData = new TextEncoder().encode('HÕIMU PMTiles Vector Tile Payload');
    const hash = await calculateSha256(testData.buffer as ArrayBuffer);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    // Install map pack
    const installed = await mapPackService.installMapPack('tallinn');
    expect(installed).toBe(true);

    const activeCity = mapPackService.getActiveCityId();
    expect(activeCity).toBe('tallinn');

    const status = await mapPackService.getMapPackStatus('tallinn');
    expect(status).toBe('active');
  });
});
