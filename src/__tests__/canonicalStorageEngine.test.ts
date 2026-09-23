import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from '../storage/canonicalStorage';
import { SecureSecretsStore } from '../storage/identity/secureSecretsStore';
import { IdentityStore } from '../storage/identity/identityStore';
import { PreferencesStore } from '../storage/preferences/preferencesStore';
import { DiagnosticsStore } from '../storage/diagnostics/diagnosticsStore';
import { AppStateStore } from '../storage/appState/appStateStore';

describe('Phase 4 — Canonical Storage Engine Domain Architecture', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Storage.resetMeshAndState();
  });

  it('exposes the required domain structure hierarchy', () => {
    expect(Storage.identity).toBeDefined();
    expect(Storage.secureSecrets).toBeDefined();
    expect(Storage.mesh).toBeDefined();
    expect(Storage.mesh.inbox).toBeDefined();
    expect(Storage.mesh.outbox).toBeDefined();
    expect(Storage.mesh.peers).toBeDefined();
    expect(Storage.mesh.packets).toBeDefined();
    expect(Storage.mesh.events).toBeDefined();
    expect(Storage.appState).toBeDefined();
    expect(Storage.map).toBeDefined();
    expect(Storage.map.packs).toBeDefined();
    expect(Storage.map.cache).toBeDefined();
    expect(Storage.diagnostics).toBeDefined();
    expect(Storage.preferences).toBeDefined();
  });

  it('enforces Rule: localStorage = preferences only (no secrets/identities)', async () => {
    // 1. Save identity and cryptographic secrets
    await IdentityStore.saveLocalIdentity({
      nodeId: 'NODE_TEST_77',
      callsign: 'TALLINN-ALPHA',
      signingPublicKeyHex: 'aabbcc112233',
      dhPublicKeyHex: 'ddeeff445566',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await SecureSecretsStore.saveSecret({
      keyId: 'master_identity_seed',
      type: 'seed',
      secretHex: '0123456789abcdef0123456789abcdef',
    });

    // 2. Verify nothing was placed in localStorage
    expect(localStorage.getItem('NODE_TEST_77')).toBeNull();
    expect(localStorage.getItem('master_identity_seed')).toBeNull();
    expect(localStorage.getItem('hoimu_identity_master_seed')).toBeNull();
    expect(localStorage.getItem('hoimu_identity_seed_v1')).toBeNull();
    expect(localStorage.length).toBe(0);

    // 3. Verify retrieval from canonical stores
    const identity = await IdentityStore.getLocalIdentity();
    expect(identity?.nodeId).toBe('NODE_TEST_77');
    expect(identity?.callsign).toBe('TALLINN-ALPHA');

    const secret = await SecureSecretsStore.getSecret('master_identity_seed');
    expect(secret?.secretHex).toBe('0123456789abcdef0123456789abcdef');
  });

  it('purges and migrates legacy secrets found in localStorage to SecureSecretsStore', async () => {
    // Simulate legacy secret left in localStorage
    localStorage.setItem('hoimu_identity_master_seed', 'legacy_seed_hex_999');
    expect(localStorage.getItem('hoimu_identity_master_seed')).toBe('legacy_seed_hex_999');

    // Run migration
    await Storage.initialize();

    // Verify localStorage was scrubbed clean of the seed
    expect(localStorage.getItem('hoimu_identity_master_seed')).toBeNull();

    // Verify migrated into secure storage
    const secret = await SecureSecretsStore.getSecret('master_identity_seed');
    expect(secret?.secretHex).toBe('legacy_seed_hex_999');
  });

  it('persists app domain state in AppStateStore without touching localStorage', async () => {
    const domainData = {
      resources: [{ id: 'res1', name: 'Field Battery Pack', quantity: 3 }],
      alerts: [{ id: 'alt1', level: 'warning', text: 'Storm approaching' }],
    };

    await AppStateStore.saveDomainData('tactical_resources', domainData);

    // Ensure localStorage remains empty
    expect(localStorage.getItem('tactical_resources')).toBeNull();

    // Retrieve from store
    const retrieved = await AppStateStore.getDomainData('tactical_resources');
    expect(retrieved).toEqual(domainData);
  });

  it('records mesh events and retrieves recent entries in order', async () => {
    await Storage.mesh.events.recordEvent({
      type: 'peer_discovered',
      nodeId: 'PEER_01',
      details: { callsign: 'TARTU-01', snr: 9.5 },
    });

    await Storage.mesh.events.recordEvent({
      type: 'route_updated',
      nodeId: 'PEER_01',
      details: { hops: 1, metric: 12 },
    });

    const events = await Storage.mesh.events.getRecentEvents(10);
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('route_updated');
    expect(events[1].type).toBe('peer_discovered');
  });

  it('manages diagnostics and rolling 1-hour airtime window with priority accounting', async () => {
    const now = Date.now();

    // Telemetry packet (Priority 1)
    await DiagnosticsStore.recordTransmission({
      durationMs: 150,
      packetId: 'pkt_telemetry',
      priority: 1,
      frequencyMhz: 868.1,
      timestamp: now - 10000,
    });

    // Emergency packet (Priority 3)
    await DiagnosticsStore.recordTransmission({
      durationMs: 400,
      packetId: 'pkt_sos',
      priority: 3,
      frequencyMhz: 868.1,
      timestamp: now - 5000,
    });

    const windowStats = await DiagnosticsStore.getRollingHourAirtime(3600000);
    expect(windowStats.totalAirtimeMs).toBe(550);
    expect(windowStats.recordCount).toBe(2);
    expect(windowStats.recordsByPriority[1]).toBe(150);
    expect(windowStats.recordsByPriority[3]).toBe(400);
    expect(windowStats.dutyCyclePercent).toBeGreaterThan(0);
  });

  it('allows PreferencesStore as the sole domain using localStorage for preferences', () => {
    PreferencesStore.setPreference('isHighContrast', true);
    PreferencesStore.setPreference('themeMode', 'tactical');

    expect(localStorage.getItem('hoimu_pref_high_contrast')).toBe('true');
    expect(localStorage.getItem('hoimu_pref_theme_mode')).toBe('tactical');

    const prefs = PreferencesStore.getPreferences();
    expect(prefs.isHighContrast).toBe(true);
    expect(prefs.themeMode).toBe('tactical');
  });
});
