import { describe, it, expect, beforeEach } from 'vitest';
import { parseFrameInfo } from '../protocol/framing';
import { encodeBinaryPacket, decodeBinaryPacket, calculateCRC32, verifyFrameCRC } from '../protocol/codec';
import { createHoimuPacket } from '../protocol/packet';
import { HoimuPacketType, PacketFlags } from '../protocol/constants';
import { canonicalIdentityProvider } from '../core/identity/identityProvider';
import { DeviceIdentityInspector } from '../core/identity/deviceIdentity';
import { peerTrustStore } from '../core/identity/trustStore';
import { KeyRotationManager } from '../core/identity/keyRotation';
import { pairingManager } from '../core/identity/pairing';
import { OutboxStore, OutboxItem } from '../storage/outbox';

describe('PHASE 1: Canonical Protocol & Wire Framing', () => {
  it('encodes and decodes canonical 39-byte header binary frames with CRC32 verification', () => {
    const packet = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      originId: 'TALLINN1',
      destinationId: 'TARTU001',
      flags: PacketFlags.NONE,
      payload: { text: 'Tactical field message' },
    });

    const rawBytes = encodeBinaryPacket(packet);
    expect(rawBytes.length).toBeGreaterThan(43);

    // Verify CRC32
    const crcValid = verifyFrameCRC(rawBytes);
    expect(crcValid).toBe(true);

    // Parse frame info
    const frameInfo = parseFrameInfo(rawBytes);
    expect(frameInfo).not.toBeNull();
    expect(frameInfo?.isValidHeader).toBe(true);
    expect(frameInfo?.originId).toBe('TALLINN1');
    expect(frameInfo?.destinationId).toBe('TARTU001');

    // Decode packet
    const decoded = decodeBinaryPacket(rawBytes);
    expect(decoded).not.toBeNull();
    expect(decoded?.payload).toEqual({ text: 'Tactical field message' });
  });
});

describe('PHASE 2 & 3: Identity, Hardware Capabilities & Standalone PeerTrustStore', () => {
  it('inspects hardware capabilities with explicit boolean status fields', async () => {
    const caps = await DeviceIdentityInspector.inspectHardwareCapabilities(true);
    expect(caps.hardwareBackedRequested).toBe(true);
    expect(typeof caps.hardwareBackedAvailable).toBe('boolean');
    expect(typeof caps.hardwareBackedVerified).toBe('boolean');
  });

  it('manages peer trust lifecycle transitions (UNKNOWN -> VERIFIED -> TRUSTED -> ROTATED -> REVOKED)', () => {
    const peerNodeId = 'PEER_NODE_999';

    peerTrustStore.registerPeer({
      nodeId: peerNodeId,
      callsign: 'NARVA-01',
      signingPublicKey: new Uint8Array(32),
      signingPublicKeyHex: '00'.repeat(32),
      encryptionPublicKey: new Uint8Array(32),
      encryptionPublicKeyHex: '00'.repeat(32),
      trustState: 'unknown',
      capabilities: {
        canRelay: true,
        isGateway: false,
        hasLoRaHardware: true,
        hasBLEHardware: true,
        supportedProtocolVersions: [1],
      },
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      keyVersion: 1,
    });

    expect(peerTrustStore.isPeerTrusted(peerNodeId)).toBe(false);

    // Transition to verified
    peerTrustStore.updateTrustState(peerNodeId, 'verified');
    expect(peerTrustStore.isPeerTrusted(peerNodeId)).toBe(true);

    // Key rotation
    KeyRotationManager.rotatePeerKey(peerNodeId, '11'.repeat(32), '22'.repeat(32));
    const rotated = peerTrustStore.getPeer(peerNodeId);
    expect(rotated?.keyVersion).toBe(2);
    expect(rotated?.signingPublicKeyHex).toBe('11'.repeat(32));

    // Revocation
    peerTrustStore.revokePeer(peerNodeId, 'Key compromised in field');
    const revoked = peerTrustStore.getPeer(peerNodeId);
    expect(revoked?.trustState).toBe('revoked');
    expect(revoked?.revokedReason).toBe('Key compromised in field');
    expect(peerTrustStore.isPeerTrusted(peerNodeId)).toBe(false);
  });

  it('completes pairing flow via QR/PIN and registers verified peer', () => {
    const session = pairingManager.createPairingSession(300);
    expect(session.sessionId).toBeDefined();
    expect(session.pinCode.length).toBe(6);

    const paired = pairingManager.confirmPairingSession(session.sessionId, session.pinCode, {
      nodeId: 'PAIR_NODE_123',
      callsign: 'PÄRNU-02',
      signingPublicKey: new Uint8Array(32),
      signingPublicKeyHex: 'aa'.repeat(32),
      encryptionPublicKey: new Uint8Array(32),
      encryptionPublicKeyHex: 'bb'.repeat(32),
      capabilities: {
        canRelay: true,
        isGateway: true,
        hasLoRaHardware: true,
        hasBLEHardware: true,
        supportedProtocolVersions: [1],
      },
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      keyVersion: 1,
    });

    expect(paired).toBe(true);
    expect(peerTrustStore.isPeerTrusted('PAIR_NODE_123')).toBe(true);
  });
});

describe('PHASE 5: Persistent Outbox & Reboot Resiliency', () => {
  it('persists outbox records across reboot/restart and purges expired packets', async () => {
    const activePacket = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      originId: 'TALLINN1',
      destinationId: 'TARTU001',
      flags: PacketFlags.NONE,
      payload: { text: 'Resilient outbound packet' },
    });

    const expiredPacket = createHoimuPacket({
      type: HoimuPacketType.MESSAGE,
      originId: 'TALLINN1',
      destinationId: 'TARTU001',
      flags: PacketFlags.NONE,
      payload: { text: 'Expired outbound packet' },
    });
    expiredPacket.header.expiresAt = Math.floor((Date.now() - 1000) / 1000);

    await OutboxStore.enqueue(activePacket);
    await OutboxStore.enqueue(expiredPacket);

    // Simulate reboot: clear memory cache, then run restoreAndCleanExpired
    OutboxStore.clearMemory();
    const restored = await OutboxStore.restoreAndCleanExpired();

    expect(restored.some((item) => item.id === activePacket.header.packetId)).toBe(true);
    expect(restored.some((item) => item.id === expiredPacket.header.packetId)).toBe(false);
  });
});
