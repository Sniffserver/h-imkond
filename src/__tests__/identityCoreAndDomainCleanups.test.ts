import { describe, it, expect, beforeEach } from 'vitest';
import {
  canonicalIdentity,
  canonicalPeerRegistry,
  canonicalTrustStore,
  CanonicalPairingEngine,
  CanonicalRotationEngine,
} from '../core/identity';
import { MeshPacket } from '../services/mesh/transport/types';
import { CrisisAlert, MeshMessage } from '../types';

describe('Canonical Identity Core (Single Truth Source)', () => {
  it('generates or loads single canonical node identity', () => {
    const id = canonicalIdentity.getIdentity();
    expect(id.nodeId).toBeDefined();
    expect(id.signingPublicKey.length).toBe(64);
    expect(id.signingPrivateKey.length).toBe(64);
  });

  it('manages peer registry cleanly without duplicates', () => {
    const peer = canonicalPeerRegistry.upsertPeer({
      id: 'TARTU-01',
      signingPublicKey: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      trustLevel: 'verified',
    });

    expect(peer.id).toBe('TARTU-01');
    expect(peer.trustLevel).toBe('verified');
    expect(canonicalPeerRegistry.getPeer('TARTU-01')).toBeDefined();
  });

  it('enforces trust levels and blocklists in CanonicalTrustStore', () => {
    canonicalTrustStore.setTrustLevel('ROUGE-NODE', 'aabbcc', 'blocked', 'Spam detected');
    expect(canonicalTrustStore.isBlocked('ROUGE-NODE')).toBe(true);

    canonicalTrustStore.setTrustLevel('PARNU-03', 'ddeeff', 'trusted', 'Verified field unit');
    expect(canonicalTrustStore.isTrustedOrVerified('PARNU-03')).toBe(true);
  });

  it('executes OOB pairing with 6-digit PIN verification', () => {
    const payload = CanonicalPairingEngine.generatePairingPayload('PAIDE-01', '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    expect(payload.pinCode.length).toBe(6);

    const paired = CanonicalPairingEngine.verifyAndPair(payload, payload.pinCode);
    expect(paired).toBe(true);
    expect(canonicalTrustStore.getTrustLevel('PAIDE-01')).toBe('trusted');
  });

  it('generates cryptographic key rotation notices', () => {
    const notice = CanonicalRotationEngine.createRotationNotice('ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100');
    expect(notice.nodeId).toBeDefined();
    expect(notice.oldPublicKey.length).toBe(64);
    expect(notice.newPublicKey.length).toBe(64);
    expect(notice.signature.length).toBeGreaterThan(0);
  });
});

describe('Canonical Domain Models without Duplicate Aliases', () => {
  it('validates canonical MeshPacket structure', () => {
    const packet: MeshPacket = {
      id: 'pkt_1001',
      origin: 'TAL-01',
      destination: '*',
      sequence: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      ttl: 5,
      hop: 0,
      type: 'MESSAGE',
      payload: { text: 'Hello canonical packet' },
    };

    expect(packet.id).toBe('pkt_1001');
    expect(packet.origin).toBe('TAL-01');
    expect(packet.destination).toBe('*');
  });

  it('validates canonical CrisisAlert and MeshMessage models', () => {
    const alert: CrisisAlert = {
      id: 'alert_001',
      type: 'Power Outage',
      severity: 'Critical',
      message: 'Grid failure in Tallinn downtown',
      timestamp: Date.now(),
      location: { lat: 59.437, lng: 24.753, name: 'Kesklinn' },
      isResolved: false,
    };

    const message: MeshMessage = {
      id: 'msg_001',
      from: 'TAL-01',
      to: 'TARTU-02',
      text: 'Encrypted operational report',
      timestamp: Date.now(),
      status: 'sent',
    };

    expect(alert.type).toBe('Power Outage');
    expect((alert.location as any)?.lat).toBe(59.437);
    expect(message.from).toBe('TAL-01');
    expect(message.to).toBe('TARTU-02');
  });
});
