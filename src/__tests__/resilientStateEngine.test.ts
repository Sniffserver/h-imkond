import { describe, it, expect } from 'vitest';
import { createIdentityFromSeed } from '../crypto/identity';
import { LocalStateEngine } from '../engine/localStateEngine';
import { SignedEventLog } from '../engine/signedEventLog';
import { reduceEngineState } from '../engine/deterministicMerge';

describe('HÕIMU Resilient Local State Engine & Signed CRDT Event Log', () => {
  it('creates cryptographically signed events and applies deterministic state transitions', async () => {
    const nodeAIdentity = await createIdentityFromSeed('node_a_master_seed', 'TALLINN-01');
    const nodeBIdentity = await createIdentityFromSeed('node_b_master_seed', 'TARTU-02');

    const engineA = new LocalStateEngine(nodeAIdentity);
    const engineB = new LocalStateEngine(nodeBIdentity);

    // 1. Node A creates a Mutual Aid need
    const needId = await engineA.postMutualAidNeed({
      category: 'medical',
      title: 'Field Trauma Kit Needed',
      description: 'Need sterile bandages and antiseptic near Sector 4',
      urgency: 'high',
      status: 'open',
      locationName: 'Sector 4 Base',
    });

    const stateA = engineA.getState();
    expect(stateA.mutualAid.has(needId)).toBe(true);
    expect(stateA.mutualAid.get(needId)?.title).toBe('Field Trauma Kit Needed');

    // 2. Node B creates an SOS Beacon
    const sosId = await engineB.broadcastSOS({
      emergencyType: 'rescue',
      severity: 'emergency',
      latitude: 59.437,
      longitude: 24.7536,
      description: 'Search party lost contact in forest grid B2',
    });

    const stateB = engineB.getState();
    expect(stateB.sosBeacons.has(sosId)).toBe(true);

    // 3. Replicate events between Node A and Node B (Simulating mesh anti-entropy sync)
    const eventsFromA = engineA.getEventLog().getEvents();
    const eventsFromB = engineB.getEventLog().getEvents();

    for (const evt of eventsFromA) {
      await engineB.getEventLog().verifyAndAppend(evt);
    }
    for (const evt of eventsFromB) {
      await engineA.getEventLog().verifyAndAppend(evt);
    }

    // 4. Verify identical converged state on both nodes
    const convergedA = reduceEngineState(engineA.getEventLog().getEvents());
    const convergedB = reduceEngineState(engineB.getEventLog().getEvents());

    expect(convergedA.mutualAid.get(needId)?.title).toBe('Field Trauma Kit Needed');
    expect(convergedB.mutualAid.get(needId)?.title).toBe('Field Trauma Kit Needed');
    expect(convergedA.sosBeacons.get(sosId)?.description).toBe('Search party lost contact in forest grid B2');
    expect(convergedB.sosBeacons.get(sosId)?.description).toBe('Search party lost contact in forest grid B2');
  });

  it('rejects tampered or forged signed events', async () => {
    const nodeIdentity = await createIdentityFromSeed('honest_node_seed', 'HONEST-01');
    const log = new SignedEventLog();

    const signedEvent = await log.createSignedEvent({
      entityType: 'resource',
      entityId: 'res_101',
      action: 'create',
      authorNodeId: nodeIdentity.signingPublicKeyHex,
      authorCallsign: nodeIdentity.callsign,
      data: { name: 'Solar Generator 500W', quantity: 2 },
      signingPrivateKey: nodeIdentity.signingKeyPair.privateKey,
    });

    // Tamper with data payload
    const tamperedEvent = {
      ...signedEvent,
      data: { name: 'Solar Generator 500W', quantity: 999 }, // Forged count
    };

    const targetLog = new SignedEventLog();
    const isAccepted = await targetLog.verifyAndAppend(tamperedEvent);

    expect(isAccepted).toBe(false);
    expect(targetLog.getEvents().length).toBe(0);
  });
});
