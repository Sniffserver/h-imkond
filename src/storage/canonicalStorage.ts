/**
 * HÕIMU Canonical Storage Engine
 * 
 * Clean Domain Hierarchy:
 * Storage
 * ├── identity
 * ├── secureSecrets
 * ├── mesh
 * │   ├── inbox
 * │   ├── outbox
 * │   ├── peers
 * │   ├── packets
 * │   └── events
 * ├── appState
 * ├── map
 * │   ├── packs
 * │   └── cache
 * ├── diagnostics
 * └── preferences (SOLE domain allowed to touch localStorage)
 * 
 * Strict Storage Rules:
 * - localStorage = preferences only!
 * - NEVER identity, cryptographic secrets, mesh packets, or routing state in localStorage.
 */

import { IdentityStore } from './identity/identityStore';
import { SecureSecretsStore } from './identity/secureSecretsStore';
import { InboxStore } from './inbox';
import { OutboxStore } from './outbox';
import { PeerStore } from './peers';
import { PacketStore } from './packets';
import { MeshEventStore } from './mesh/events';
import { AppStateStore } from './appState/appStateStore';
import { MapPackStore, MapCacheStore } from './map/mapPacks';
import { DiagnosticsStore } from './diagnostics/diagnosticsStore';
import { PreferencesStore } from './preferences/preferencesStore';
import { storageDB } from './db';

export const Storage = {
  identity: IdentityStore,
  secureSecrets: SecureSecretsStore,
  mesh: {
    inbox: InboxStore,
    outbox: OutboxStore,
    peers: PeerStore,
    packets: PacketStore,
    events: MeshEventStore,
  },
  appState: AppStateStore,
  map: {
    packs: MapPackStore,
    cache: MapCacheStore,
  },
  diagnostics: DiagnosticsStore,
  preferences: PreferencesStore,

  // Direct database reference and lifecycle
  db: storageDB,

  /**
   * Initializes the canonical storage engine, runs migrations,
   * and automatically sanitizes localStorage to enforce domain boundaries.
   */
  async initialize(): Promise<void> {
    try {
      await storageDB.getDB();
    } catch {
      // In-memory mode active
    }

    // Enforce Rule: scrub legacy secrets from localStorage into secureSecrets
    await SecureSecretsStore.purgeAndMigrateLegacyLocalStorage();
  },

  /**
   * Performs a clean nuclear reset of mesh, identity, and application storage
   * without corrupting user interface preferences.
   */
  async resetMeshAndState(): Promise<void> {
    await IdentityStore.clear();
    await SecureSecretsStore.clear();
    await InboxStore.clearMemory?.();
    await PacketStore.clearMemory?.();
    await MeshEventStore.clear();
    await AppStateStore.clear();
    await MapCacheStore.clear();
  }
};

export default Storage;
