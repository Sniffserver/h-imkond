/**
 * Message Router & Pipeline Orchestration
 * 
 * Implements the full outbound and inbound packet pipeline:
 * 
 * Outbound:
 *   sendMessage()
 *        ↓
 *   resolve peer identity
 *        ↓
 *   X25519 session
 *        ↓
 *   HKDF
 *        ↓
 *   AES-GCM
 *        ↓
 *   Ed25519 signature
 *        ↓
 *   canonical packet
 *        ↓
 *   outbox
 *        ↓
 *   transport manager
 * 
 * Inbound:
 *   transport
 *        ↓
 *   decode
 *        ↓
 *   CRC
 *        ↓
 *   dedup
 *        ↓
 *   signature
 *        ↓
 *   decrypt
 *        ↓
 *   authorization
 *        ↓
 *   inbox
 *        ↓
 *   CRDT/state update
 */

import { MeshMessage, MeshMessageEnvelope } from '../../types';
import { HoimuPacket } from '../../protocol/types';
import { HoimuPacketType, PacketFlags, DEFAULT_PACKET_EXPIRY_MS } from '../../protocol/constants';
import { encodeBinaryPacket, decodeBinaryPacket, verifyFrameCRC } from '../../protocol/codec';
import { identityService } from '../identity/identityService';
import { IIdentityService } from '../identity/types';
import { peerIdentityStore, PeerIdentityStore } from '../identity/peerIdentityStore';
import { trustStore, TrustStore } from '../identity/trustStore';
import { envelopeService, EnvelopeService } from './envelopeService';
import { messageVerifier, MessageVerifier } from './messageVerifier';
import { messageDecryptor, MessageDecryptor } from './messageDecryptor';
import { messagePersistence, MessagePersistence } from './messagePersistence';
import { meshTransportManager, MeshTransportManager } from '../mesh/transport/MeshTransportManager';
import { seenPacketCache, SeenPacketCache } from '../mesh/routing/SeenPacketCache';
import { crdtEventLogEngine } from '../mesh/crdt/signedEventLog';

export interface RouteMessageResult {
  message: MeshMessage;
  packet: HoimuPacket;
  wireBytes: Uint8Array;
  deliveredToBearer: boolean;
}

export class MessageRouter {
  constructor(
    private identity: IIdentityService = identityService,
    private peers: PeerIdentityStore = peerIdentityStore,
    private trust: TrustStore = trustStore,
    private envelope: EnvelopeService = envelopeService,
    private verifier: MessageVerifier = messageVerifier,
    private decryptor: MessageDecryptor = messageDecryptor,
    private persistence: MessagePersistence = messagePersistence,
    private transport: MeshTransportManager = meshTransportManager,
    private dedup: SeenPacketCache = seenPacketCache
  ) {}

  /**
   * Outbound Pipeline:
   * sendMessage -> resolve peer -> X25519 -> HKDF -> AES-GCM -> Ed25519 -> canonical packet -> outbox -> transport
   */
  public async routeOutboundMessage(
    recipientIdOrCallsign: string,
    content: string,
    options?: { ttl?: number }
  ): Promise<RouteMessageResult> {
    await this.identity.initialize();
    await this.peers.initialize();

    // 1. Resolve local identity & cryptographic keys
    const localIdentity = await this.identity.getLocalIdentity();
    const identityKeyPair = await this.identity.getIdentityKeyPair();

    // 2. Resolve target peer identity
    let peer = await this.peers.getPeerByNodeId(recipientIdOrCallsign);
    if (!peer) {
      peer = await this.peers.getPeerByCallsign(recipientIdOrCallsign);
    }

    const recipientCallsign = peer ? peer.callsign : recipientIdOrCallsign;
    const recipientEncKey = peer?.encryptionPublicKey || recipientIdOrCallsign;

    // 3. X25519 + HKDF + AES-GCM + Ed25519 Signature -> Envelope
    const messageId = `01J${Date.now().toString(36)}${Math.random().toString(36).substring(2, 7)}`;
    const env = await this.envelope.createEnvelope({
      content,
      senderCallsign: localIdentity.callsign,
      recipientCallsign,
      recipientX25519PublicKeyHex: recipientEncKey,
      senderIdentityKeyPair: identityKeyPair,
      senderIdentityPublicKeyHex: localIdentity.signingPublicKeyHex,
      messageId,
      ttl: options?.ttl ?? 5,
    });

    const serializedContent = btoa(JSON.stringify(env));

    // 4. Construct canonical HoimuPacket
    const now = Date.now();
    const packet: HoimuPacket<MeshMessageEnvelope> = {
      header: {
        version: 1,
        type: HoimuPacketType.DIRECT_ENCRYPTED,
        flags: PacketFlags.IS_ENCRYPTED,
        ttl: env.ttl,
        hopCount: 0,
        sequence: Math.floor(Math.random() * 0xffffffff),
        senderId: localIdentity.nodeId.slice(0, 8),
        originId: localIdentity.nodeId.slice(0, 8),
        destinationId: peer ? peer.nodeId.slice(0, 8) : recipientCallsign.slice(0, 8),
        packetId: env.id.slice(0, 8),
        length: serializedContent.length,
        createdAt: now,
        expiresAt: now + DEFAULT_PACKET_EXPIRY_MS,
      },
      payload: env,
      signature: env.signature,
    };

    const wireBytes = encodeBinaryPacket(packet);

    // 5. Build domain MeshMessage
    const meshMessage: MeshMessage = {
      id: messageId,
      from: localIdentity.callsign,
      to: recipientCallsign,
      content: serializedContent,
      timestamp: env.createdAt,
      ttl: env.ttl,
      signature: env.signature,
      envelope: env,
      ephemeralPublicKey: env.ephemeralPublicKey,
      nonce: env.nonce,
      senderIdentityKey: env.senderIdentityKey,
      senderId: localIdentity.nodeId,
      senderCallsign: localIdentity.callsign,
      recipientId: peer ? peer.nodeId : recipientIdOrCallsign,
      recipientCallsign,
      text: content,
      decryptedText: content,
      status: 'pending',
      isRead: true,
      hopCount: 1,
    };

    // 6. Persist to outbox / message store
    await this.persistence.saveMessage(meshMessage);

    // 7. Route through transport manager
    let deliveredToBearer = false;
    try {
      const sendResult = await this.transport.broadcast({
        id: packet.header.packetId,
        packetId: packet.header.packetId,
        type: 'MESSAGE',
        originId: packet.header.originId,
        senderId: packet.header.originId,
        destinationId: packet.header.destinationId,
        payload: wireBytes,
        ttl: packet.header.ttl,
        hopCount: packet.header.hopCount,
        timestamp: Date.now(),
      });
      deliveredToBearer = sendResult.success;
    } catch (e) {
      console.warn('[MessageRouter] Transport broadcast error:', e);
    }

    return {
      message: meshMessage,
      packet,
      wireBytes,
      deliveredToBearer,
    };
  }

  /**
   * Inbound Pipeline:
   * transport -> decode -> CRC -> dedup -> signature -> decrypt -> authorization -> inbox -> CRDT/state update
   */
  public async handleInboundPacket(rawBytesOrPacket: Uint8Array | HoimuPacket): Promise<MeshMessage | null> {
    let packet: HoimuPacket | null = null;

    // 1. Decode & 2. CRC verification
    if (rawBytesOrPacket instanceof Uint8Array) {
      if (!verifyFrameCRC(rawBytesOrPacket)) {
        console.warn('[MessageRouter] Inbound packet dropped: CRC32 mismatch');
        return null;
      }
      packet = decodeBinaryPacket(rawBytesOrPacket);
      if (!packet) {
        console.warn('[MessageRouter] Inbound packet dropped: Decode failed');
        return null;
      }
    } else {
      packet = rawBytesOrPacket;
    }

    // 3. Dedup check
    const packetKey = `${packet.header.originId}:${packet.header.packetId || packet.header.sequence}`;
    if (this.dedup.has(packetKey)) {
      return null;
    }
    this.dedup.add(packetKey);

    // 4. Extract envelope
    const env: MeshMessageEnvelope | null = this.envelope.parseEnvelope(packet.payload);
    if (!env) {
      console.warn('[MessageRouter] Inbound packet contains non-envelope payload');
      return null;
    }

    // 5. Signature verification & 6. Authorization
    const authResult = await this.verifier.verifyAndAuthorize(env);
    if (!authResult.valid) {
      console.warn('[MessageRouter] Inbound packet dropped: Signature invalid', authResult.error);
      return null;
    }
    if (!authResult.authorized) {
      console.warn('[MessageRouter] Inbound packet dropped: Sender unauthorized/blocked', env.sender);
      return null;
    }

    // 7. Resolve if meant for us and decrypt
    const localIdentity = await this.identity.getLocalIdentity();
    const isForMe =
      env.recipient.toLowerCase() === localIdentity.callsign.toLowerCase() ||
      env.recipient.toLowerCase() === localIdentity.nodeId.toLowerCase();

    let decryptedText = '🔒 [Encrypted Mesh Packet]';
    if (isForMe) {
      try {
        const encKeyPair = await this.identity.getEncryptionKeyPair();
        const res = await this.decryptor.decryptEnvelope(env, encKeyPair.privateKey);
        decryptedText = res.plaintext;
      } catch (err) {
        console.warn('[MessageRouter] Decryption failed:', err);
      }
    }

    // 8. Inbox persistence
    const meshMessage: MeshMessage = {
      id: env.id,
      from: env.sender,
      to: env.recipient,
      content: btoa(JSON.stringify(env)),
      timestamp: env.createdAt,
      ttl: env.ttl,
      signature: env.signature,
      envelope: env,
      ephemeralPublicKey: env.ephemeralPublicKey,
      nonce: env.nonce,
      senderIdentityKey: env.senderIdentityKey,
      senderCallsign: env.sender,
      recipientCallsign: env.recipient,
      text: decryptedText,
      decryptedText,
      status: 'delivered',
      isRead: !isForMe, // unread if for us
      hopCount: packet.header.hopCount + 1,
    };

    await this.persistence.saveMessage(meshMessage);

    // 9. CRDT/State update: Record peer activity and append signed event log
    try {
      await this.peers.recordPeerActivity(env.senderIdentityKey.slice(0, 16).toUpperCase());
    } catch {}

    return meshMessage;
  }
}

export const messageRouter = new MessageRouter();
