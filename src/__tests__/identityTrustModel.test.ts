import { describe, it, expect, beforeEach } from 'vitest';
import {
  peerIdentityStore,
  trustStore,
  keyRotationManager,
  PeerIdentity,
} from '../services/identity';
import { generateEd25519KeyPair, signBytes } from '../core/crypto';

describe('Phase 2 — Identity & Trust Model', () => {
  beforeEach(async () => {
    await peerIdentityStore.initialize();
  });

  it('stores and retrieves verified peer identities from PeerIdentityStore', async () => {
    const peer: PeerIdentity = {
      nodeId: 'NODE-ALICE-1234',
      callsign: 'Alice-Mesh',
      signingPublicKey: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      encryptionPublicKey: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'unknown',
      capabilities: ['mesh:v1', 'e2ee:v1'],
    };

    await peerIdentityStore.putPeer(peer);

    const retrievedByNodeId = await peerIdentityStore.getPeerByNodeId('NODE-ALICE-1234');
    expect(retrievedByNodeId).not.toBeNull();
    expect(retrievedByNodeId?.callsign).toBe('Alice-Mesh');

    const retrievedByCallsign = await peerIdentityStore.getPeerByCallsign('alice-mesh');
    expect(retrievedByCallsign?.nodeId).toBe('NODE-ALICE-1234');

    const retrievedByKey = await peerIdentityStore.getPeerBySigningKey('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899');
    expect(retrievedByKey?.nodeId).toBe('NODE-ALICE-1234');
  });

  it('evaluates trust states and authorization in TrustStore', async () => {
    const peer: PeerIdentity = {
      nodeId: 'NODE-BOB-9988',
      callsign: 'Bob-Relay',
      signingPublicKey: 'bbccddeeff0011223344556677889900bbccddeeff0011223344556677889900',
      encryptionPublicKey: '22334455667788990011aabbccddeeff22334455667788990011aabbccddeeff',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'unknown',
      capabilities: ['mesh:v1'],
    };

    await peerIdentityStore.putPeer(peer);

    // Default unknown peer is authorized for basic communication
    expect(await trustStore.isPeerAuthorized('NODE-BOB-9988')).toBe(true);
    expect(await trustStore.isPeerVerified('NODE-BOB-9988')).toBe(false);

    // Verify peer
    await trustStore.verifyPeer('NODE-BOB-9988');
    expect(await trustStore.isPeerVerified('NODE-BOB-9988')).toBe(true);
    expect(await trustStore.isPeerAuthorized('Bob-Relay')).toBe(true);

    // Block peer
    await trustStore.blockPeer('NODE-BOB-9988');
    expect(await trustStore.isPeerBlocked('NODE-BOB-9988')).toBe(true);
    expect(await trustStore.isPeerAuthorized('Bob-Relay')).toBe(false);

    // Expire peer
    await trustStore.expirePeer('NODE-BOB-9988');
    expect(await trustStore.isPeerAuthorized('NODE-BOB-9988')).toBe(false);
  });

  it('validates dual-signed key rotation proofs in KeyRotationManager', async () => {
    // Generate old keypair and new keypair
    const oldKey = await generateEd25519KeyPair(true);
    const newKey = await generateEd25519KeyPair(true);

    const oldPubHex = oldKey.publicKeyHex;
    const newPubHex = newKey.publicKeyHex;

    // Register initial peer with old key
    await peerIdentityStore.putPeer({
      nodeId: 'NODE-CHARLIE-44',
      callsign: 'Charlie',
      signingPublicKey: oldPubHex,
      encryptionPublicKey: '33445566778899001122aabbccddeeff33445566778899001122aabbccddeeff',
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'verified',
      capabilities: ['mesh:v1'],
    });

    const timestamp = Date.now();
    const payloadBytes = keyRotationManager.getRotationPayload({
      previousPublicKeyHex: oldPubHex,
      newPublicKeyHex: newPubHex,
      rotationEpoch: 2,
      timestamp,
    });

    // Dual-sign rotation payload
    const sigPrev = await signBytes(oldKey.privateKey, payloadBytes);
    const sigNew = await signBytes(newKey.privateKey, payloadBytes);

    const validProof = {
      previousPublicKeyHex: oldPubHex,
      newPublicKeyHex: newPubHex,
      rotationEpoch: 2,
      timestamp,
      signatureByPreviousKey: sigPrev,
      signatureByNewKey: sigNew,
    };

    const isVerified = await keyRotationManager.verifyRotationProof(validProof);
    expect(isVerified).toBe(true);

    // Apply rotation
    const applied = await keyRotationManager.applyPeerKeyRotation(
      validProof,
      '44556677889900112233aabbccddeeff44556677889900112233aabbccddeeff'
    );
    expect(applied).toBe(true);

    // Verify peer's signing key updated
    const updatedPeer = await peerIdentityStore.getPeerByNodeId('NODE-CHARLIE-44');
    expect(updatedPeer?.signingPublicKey).toBe(newPubHex.toLowerCase());
  });
});
