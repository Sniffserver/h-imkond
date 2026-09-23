/**
 * HÕIMU Unified Runtime Layer Root
 * 
 * Formal Architecture Tree:
 * 
 *                    HÕIMU
 *                       │
 *              ┌────────┴────────┐
 *              │                 │
 *           UI Layer        Runtime Layer (HoimuRuntime)
 *                                │
 *                    ┌───────────┼───────────┐
 *                    │           │           │
 *                 Identity    Storage      Capability
 *                    │           │           │
 *               ┌────┴────┐      │       ┌───┴────┐
 *               │         │      │       │        │
 *            Ed25519   X25519  IndexedDB  BLE    GPS
 *                                │         WiFi   Camera
 *                                │         LoRa
 *                                │
 *                         Mesh Protocol
 *                                │
 *                    ┌───────────┴───────────┐
 *                    │                       │
 *                 Routing                  Sync
 *                    │                       │
 *                 Packet                  Events
 *                    │                       │
 *                 Transport                CRDT
 *                    │
 *       ┌────────────┼─────────────┐
 *       │            │             │
 *      BLE         Wi-Fi         Pi Bridge
 *                                   │
 *                                SX1262
 */

import { meshDb } from '../mesh/db/meshDatabase';
import { crdtEventLogEngine, CRDTEventLogEngine } from '../mesh/crdt/signedEventLog';
import { MeshTransportManager } from '../mesh/transport/MeshTransportManager';
import { PacketLifecyclePipeline, defaultSeenCache } from '../mesh/pipeline/packetLifecycle';
import { SeenPacketCache } from '../mesh/routing/SeenPacketCache';
import { deriveEd25519KeyPairFromSeed, DerivationResult } from '../crypto/meshCrypto';
import { INITIAL_USER } from '../../data/initialData';

export interface RuntimeIdentityModule {
  nodeId: string;
  callsign: string;
  ed25519PublicKeyHex: string;
  x25519PublicKeyHex: string;
  keyPair?: DerivationResult;
  isHardwareBacked: boolean;
}

export interface RuntimeCapabilitiesModule {
  hasBle: boolean;
  hasWifi: boolean;
  hasLoraGateway: boolean;
  hasGps: boolean;
  hasCamera: boolean;
  hasEink: boolean;
}

export interface RuntimeStorageModule {
  db: typeof meshDb;
  isReady: boolean;
}

export interface RuntimeMeshProtocolModule {
  transportManager: MeshTransportManager;
  crdtEngine: CRDTEventLogEngine;
  seenCache: SeenPacketCache;
  pipeline: PacketLifecyclePipeline;
}

export class HoimuRuntime {
  public identity: RuntimeIdentityModule;
  public capabilities: RuntimeCapabilitiesModule;
  public storage: RuntimeStorageModule;
  public mesh: RuntimeMeshProtocolModule;
  private isInitialized = false;

  constructor(nodeId = INITIAL_USER.id, callsign = INITIAL_USER.callsign) {
    // 1. Identity Subsystem (Ed25519 & X25519)
    this.identity = {
      nodeId,
      callsign,
      ed25519PublicKeyHex: '',
      x25519PublicKeyHex: '',
      isHardwareBacked: false,
    };

    // 2. Capabilities Subsystem (BLE, WiFi, LoRa, GPS, Camera)
    this.capabilities = {
      hasBle: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
      hasWifi: typeof navigator !== 'undefined' && 'onLine' in navigator,
      hasLoraGateway: false,
      hasGps: typeof navigator !== 'undefined' && 'geolocation' in navigator,
      hasCamera: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
      hasEink: false,
    };

    // 3. Storage Subsystem (IndexedDB)
    this.storage = {
      db: meshDb,
      isReady: false,
    };

    // 4. Mesh Protocol Subsystem (Transport, Routing, Lifecycle Pipeline, CRDT Sync)
    const transportManager = new MeshTransportManager({ localNodeId: nodeId });
    const seenCache = defaultSeenCache;
    const pipeline = new PacketLifecyclePipeline(nodeId, transportManager, undefined, seenCache);

    this.mesh = {
      transportManager,
      crdtEngine: crdtEventLogEngine,
      seenCache,
      pipeline,
    };
  }

  /**
   * Initializes all runtime subsystems deterministically
   */
  public async init(seed = 'hoimu_default_identity_seed'): Promise<void> {
    if (this.isInitialized) return;

    // 1. Derive Identity Keys
    const keyPair = await deriveEd25519KeyPairFromSeed(seed);
    this.identity.keyPair = keyPair;
    this.identity.ed25519PublicKeyHex = keyPair.publicKeyHex;
    this.identity.x25519PublicKeyHex = keyPair.x25519PublicKeyHex;

    // 2. Initialize Storage & CRDT
    await this.storage.db.getPendingOutboxItems();
    await this.mesh.crdtEngine.init();
    this.storage.isReady = true;

    // 3. Initialize Transports
    await this.mesh.transportManager.initialize();

    // 4. Connect Pipeline with Derived Keys
    this.mesh.pipeline = new PacketLifecyclePipeline(
      this.identity.nodeId,
      this.mesh.transportManager,
      this.identity.keyPair,
      this.mesh.seenCache
    );

    this.isInitialized = true;
    console.log(`[HoimuRuntime] Initialized with Node: ${this.identity.callsign} (${this.identity.nodeId})`);
  }

  public getStatus() {
    return {
      initialized: this.isInitialized,
      nodeId: this.identity.nodeId,
      callsign: this.identity.callsign,
      ed25519PubKey: this.identity.ed25519PublicKeyHex,
      storageReady: this.storage.isReady,
      capabilities: this.capabilities,
      activeTransports: this.mesh.transportManager.getActiveTransports(),
    };
  }
}

// Global runtime singleton
export const hoimuRuntime = new HoimuRuntime();
