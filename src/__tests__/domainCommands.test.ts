import { describe, it, expect, vi } from 'vitest';
import { createDomainCommands } from '../core/commands/domainCommands';
import { canonicalPeerRegistry } from '../core/identity/peer';
import { canonicalTrustStore } from '../core/identity/trust';
import { peerIdentityStore } from '../services/identity/peerIdentityStore';
import { MeshPacket, ResourceItem } from '../types';

describe('Domain Commands Architecture (Requirement 8)', () => {
  it('dispatches resource commands correctly', async () => {
    const onQuickAdd = vi.fn((data) => ({ id: 'res-custom-1', ...data }));
    const onRequest = vi.fn();
    const onEndorseTx = vi.fn();
    const onSaveReflect = vi.fn();

    const mockResources: ResourceItem[] = [
      {
        id: 'res-123',
        title: 'Solar Inverter',
        description: '500W pure sine wave inverter',
        category: 'Energy' as const,
        ownerId: 'PEER-1',
        ownerCallsign: 'P-1',
        distanceKm: 0.8,
        createdAt: Date.now(),
        isActive: true,
        availabilityText: 'Ready',
        avatarSeed: 'seed-1',
      },
    ];

    const commands = createDomainCommands({
      onQuickAddResource: onQuickAdd,
      onRequestExchange: onRequest,
      onEndorseTransaction: onEndorseTx,
      onSaveReflection: onSaveReflect,
      getResources: () => mockResources,
      onSendMessage: vi.fn(),
      onAddCalendarEvent: vi.fn(),
      onToggleRsvp: vi.fn(),
      onCreateProposal: vi.fn(),
      onVoteProposal: vi.fn(),
    });

    // 1. resource.create
    const created = await commands.resource.create({ title: 'Seed Drill' });
    expect(onQuickAdd).toHaveBeenCalled();
    expect(created.title).toBe('Seed Drill');

    // 2. resource.request
    await commands.resource.request('res-123', 'Need for weekend planting');
    expect(onRequest).toHaveBeenCalledWith(mockResources[0], 'Need for weekend planting');

    // 3. resource.complete
    await commands.resource.complete('res-123', 'tx-456');
    expect(onEndorseTx).toHaveBeenCalledWith('tx-456', expect.any(String));

    // 4. resource.reflect
    await commands.resource.reflect('res-123', 'Great solar generation', 'uplifting');
    expect(onSaveReflect).toHaveBeenCalledWith(mockResources[0], 'Great solar generation', 'uplifting');
  });

  it('dispatches peer commands correctly', async () => {
    const onSendMessage = vi.fn();
    const onBlockPeer = vi.fn();
    const onUnblockPeer = vi.fn();
    const onEndorsePeer = vi.fn();

    const commands = createDomainCommands({
      onQuickAddResource: vi.fn(),
      onSendMessage,
      onBlockPeer,
      onUnblockPeer,
      onEndorsePeer,
      onAddCalendarEvent: vi.fn(),
      onToggleRsvp: vi.fn(),
      onCreateProposal: vi.fn(),
      onVoteProposal: vi.fn(),
    });

    // 1. peer.message
    await commands.peer.message('PEER-TARTU-01', 'Tere sõber!');
    expect(onSendMessage).toHaveBeenCalledWith('PEER-TARTU-01', 'Tere sõber!');

    // 2. peer.block & unblock
    await commands.peer.block('SPAM-NODE');
    expect(onBlockPeer).toHaveBeenCalledWith('SPAM-NODE');

    await commands.peer.unblock('SPAM-NODE');
    expect(onUnblockPeer).toHaveBeenCalledWith('SPAM-NODE');

    // 3. peer.endorse
    await commands.peer.endorse('PEER-TARTU-01', 'Radio Repeater Hosting', 'High reliability uplink');
    expect(onEndorsePeer).toHaveBeenCalledWith('PEER-TARTU-01', 'Radio Repeater Hosting', 'High reliability uplink');
  });

  it('dispatches exchange, event, and governance commands correctly', async () => {
    const onEndorseTx = vi.fn();
    const onAddEvent = vi.fn((evt) => ({ id: 'evt-custom-9', ...evt }));
    const onToggleRsvp = vi.fn();
    const onCreateProposal = vi.fn((p) => ({ id: 'prop-custom-8', ...p }));
    const onVote = vi.fn();

    const commands = createDomainCommands({
      onQuickAddResource: vi.fn(),
      onSendMessage: vi.fn(),
      onEndorseTransaction: onEndorseTx,
      onAddCalendarEvent: onAddEvent,
      onToggleRsvp,
      onCreateProposal,
      onVoteProposal: onVote,
    });

    // 1. exchange.propose, accept, complete
    const tx = await commands.exchange.propose({ resourceTitle: 'Wheat Seeds', providerCallsign: 'Pärnu-02' });
    expect(tx.id).toBeDefined();
    expect(tx.resourceTitle).toBe('Wheat Seeds');

    await commands.exchange.accept(tx.id);
    expect(onEndorseTx).toHaveBeenCalledWith(tx.id, expect.stringContaining('Accepted'));

    await commands.exchange.complete(tx.id, 'Smooth handover');
    expect(onEndorseTx).toHaveBeenCalledWith(tx.id, 'Smooth handover');

    // 2. event.create and join
    const evt = await commands.event.create({ title: 'Solstice Circle' });
    expect(onAddEvent).toHaveBeenCalled();
    expect(evt.title).toBe('Solstice Circle');

    await commands.event.join(evt.id);
    expect(onToggleRsvp).toHaveBeenCalledWith(evt.id);

    // 3. governance.propose and vote
    const prop = await commands.governance.propose({ title: 'Expand LoRa repeater at Emajõgi' });
    expect(onCreateProposal).toHaveBeenCalled();
    expect(prop.title).toBe('Expand LoRa repeater at Emajõgi');

    await commands.governance.vote(prop.id, 'yes');
    expect(onVote).toHaveBeenCalledWith(prop.id, 'yes');

    await commands.governance.vote(prop.id, 'no');
    expect(onVote).toHaveBeenCalledWith(prop.id, 'no');
  });
});

describe('One Packet Model & Canonical Identity Invariants', () => {
  it('validates canonical MeshPacket type conforms to schema', () => {
    const packet: MeshPacket<Uint8Array> = {
      id: 'pkt-018e6924-canonical',
      origin: 'TAL-01',
      destination: '*',
      sequence: 42,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
      ttl: 5,
      hop: 0,
      type: 'MESSAGE',
      flags: { isEncrypted: false, isPriority: true },
      payload: new Uint8Array([1, 2, 3]),
      signature: new Uint8Array(64),
    };

    expect(packet.id).toBe('pkt-018e6924-canonical');
    expect(packet.origin).toBe('TAL-01');
    expect(packet.destination).toBe('*');
    expect(packet.type).toBe('MESSAGE');
  });

  it('synchronizes peerIdentityStore writes to canonicalPeerRegistry & canonicalTrustStore', async () => {
    const testNodeId = 'CANONICAL-TEST-NODE';
    const testPubkey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    await peerIdentityStore.putPeer({
      nodeId: testNodeId,
      callsign: 'CANON-01',
      signingPublicKey: testPubkey,
      encryptionPublicKey: testPubkey,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      trustState: 'verified',
      capabilities: ['mesh:v1'],
    });

    const canonicalPeer = canonicalPeerRegistry.getPeer(testNodeId);
    expect(canonicalPeer).toBeDefined();
    expect(canonicalPeer?.id).toBe(testNodeId);
    expect(canonicalPeer?.signingPublicKey).toBe(testPubkey);
    expect(canonicalPeer?.trustLevel).toBe('verified');

    const trustLevel = canonicalTrustStore.getTrustLevel(testNodeId);
    expect(trustLevel).toBe('verified');
  });
});
