/**
 * Message Service
 * 
 * Orchestrating facade for HÕIMU messaging subsystem:
 * - Delegates envelope creation to EnvelopeService
 * - Delegates signature verification and authorization to MessageVerifier
 * - Delegates E2EE decryption to MessageDecryptor
 * - Delegates message storage to MessagePersistence
 * - Delegates wire framing and dispatch to MessageRouter
 */

import { IMessageService } from '../types';
import { MeshMessage } from '../../types';
import { INITIAL_PEERS } from '../../data/initialData';
import { identityService } from '../identity/identityService';
import { peerIdentityStore } from '../identity/peerIdentityStore';
import { trustStore } from '../identity/trustStore';
import { envelopeService } from './envelopeService';
import { messageVerifier } from './messageVerifier';
import { messageDecryptor } from './messageDecryptor';
import { messagePersistence } from './messagePersistence';
import { messageRouter } from './messageRouter';
import { deriveX25519KeyPairFromSeed } from '../crypto/meshCrypto';

export class MessageService implements IMessageService {
  public identity = identityService;
  public peers = peerIdentityStore;
  public trust = trustStore;
  public envelope = envelopeService;
  public verifier = messageVerifier;
  public decryptor = messageDecryptor;
  public persistence = messagePersistence;
  public router = messageRouter;

  constructor(
    identity = identityService,
    peers = peerIdentityStore,
    trust = trustStore,
    envelope = envelopeService,
    verifier = messageVerifier,
    decryptor = messageDecryptor,
    persistence = messagePersistence,
    router = messageRouter
  ) {
    this.identity = identity;
    this.peers = peers;
    this.trust = trust;
    this.envelope = envelope;
    this.verifier = verifier;
    this.decryptor = decryptor;
    this.persistence = persistence;
    this.router = router;

    // Bind methods to preserve `this` when destructured or exported as standalone functions
    this.initMessageStorage = this.initMessageStorage.bind(this);
    this.getLocalUserCrypto = this.getLocalUserCrypto.bind(this);
    this.getLocalUserDualCrypto = this.getLocalUserDualCrypto.bind(this);
    this.getPeerPublicKey = this.getPeerPublicKey.bind(this);
    this.getPeerEncryptionKey = this.getPeerEncryptionKey.bind(this);
    this.encryptWithPublicKey = this.encryptWithPublicKey.bind(this);
    this.decryptWithKey = this.decryptWithKey.bind(this);
    this.sendDirectMessage = this.sendDirectMessage.bind(this);
    this.getConversation = this.getConversation.bind(this);
    this.getUnreadCount = this.getUnreadCount.bind(this);
    this.markConversationAsRead = this.markConversationAsRead.bind(this);
    this.saveIncomingMessage = this.saveIncomingMessage.bind(this);
    this.subscribeToMessages = this.subscribeToMessages.bind(this);
  }

  public async initMessageStorage(): Promise<void> {
    await this.persistence.initStorage();
    await this.identity.initialize();
    await this.peers.initialize();
  }

  public async getLocalUserCrypto(): Promise<{ publicKeyHex: string; keyPair: CryptoKeyPair }> {
    await this.identity.initialize();
    const keyPair = await this.identity.getIdentityKeyPair();
    const publicKeyHex = await this.identity.getIdentityPublicKey();
    return { publicKeyHex, keyPair };
  }

  public async getLocalUserDualCrypto(): Promise<{
    identity: { publicKeyHex: string; keyPair: CryptoKeyPair };
    encryption: { publicKeyHex: string; keyPair: CryptoKeyPair };
  }> {
    await this.identity.initialize();
    const idPair = await this.identity.getIdentityKeyPair();
    const idHex = await this.identity.getIdentityPublicKey();
    const encPair = await this.identity.getEncryptionKeyPair();
    const encHex = await this.identity.getEncryptionPublicKey();
    return {
      identity: { publicKeyHex: idHex, keyPair: idPair },
      encryption: { publicKeyHex: encHex, keyPair: encPair },
    };
  }

  public getPeerPublicKey(peerCallsignOrId: string): string {
    const clean = peerCallsignOrId.toLowerCase().trim();
    const foundPeer = INITIAL_PEERS.find(
      (p) => p.id.toLowerCase() === clean || p.callsign.toLowerCase() === clean
    );
    if (foundPeer?.publicKey) {
      return foundPeer.publicKey;
    }
    let hash = 0;
    for (let i = 0; i < peerCallsignOrId.length; i++) {
      hash = (hash << 5) - hash + peerCallsignOrId.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0').repeat(4).slice(0, 32);
    return `ed25519:${hex}`;
  }

  public async getPeerEncryptionKey(peerCallsignOrId: string): Promise<string> {
    const peer = await this.peers.getPeerByNodeId(peerCallsignOrId) ||
                 await this.peers.getPeerByCallsign(peerCallsignOrId);
    if (peer?.encryptionPublicKey) {
      return peer.encryptionPublicKey;
    }

    const clean = peerCallsignOrId.toLowerCase().trim();
    const foundDemo = INITIAL_PEERS.find(
      (p) => p.id.toLowerCase() === clean || p.callsign.toLowerCase() === clean
    );
    if (foundDemo?.publicKey && foundDemo.publicKey.startsWith('x25519:')) {
      return foundDemo.publicKey.replace('x25519:', '');
    }

    const derived = await deriveX25519KeyPairFromSeed(clean);
    return derived.publicKeyHex;
  }

  public async encryptWithPublicKey(plaintext: string, recipientPublicKeyHex: string): Promise<string> {
    await this.identity.initialize();
    const dual = await this.getLocalUserDualCrypto();
    const localId = await this.identity.getLocalIdentity();

    let targetX25519Key = recipientPublicKeyHex.replace(/^(ed25519:|x25519:|0x)/i, '');
    if (targetX25519Key.length !== 64) {
      const derived = await deriveX25519KeyPairFromSeed(recipientPublicKeyHex);
      targetX25519Key = derived.publicKeyHex;
    }

    const env = await this.envelope.createEnvelope({
      content: plaintext,
      senderCallsign: localId.callsign,
      recipientCallsign: 'Peer',
      recipientX25519PublicKeyHex: targetX25519Key,
      senderIdentityKeyPair: dual.identity.keyPair,
      senderIdentityPublicKeyHex: dual.identity.publicKeyHex,
    });

    return btoa(JSON.stringify(env));
  }

  public async decryptWithKey(encryptedBase64: string, expectedKeyHex?: string): Promise<string> {
    await this.identity.initialize();
    const encKeyPair = await this.identity.getEncryptionKeyPair();
    return await this.decryptor.decryptPayload(encryptedBase64, encKeyPair.privateKey, expectedKeyHex);
  }

  public async sendDirectMessage(peerId: string, content: string): Promise<MeshMessage> {
    const result = await this.router.routeOutboundMessage(peerId, content);
    return result.message;
  }

  public async getConversation(peerId: string): Promise<MeshMessage[]> {
    await this.initMessageStorage();
    const localId = await this.identity.getLocalIdentity();
    const myCallsign = localId.callsign.toLowerCase();

    const peer = await this.peers.getPeerByNodeId(peerId) || await this.peers.getPeerByCallsign(peerId);
    const peerCallsign = (peer ? peer.callsign : peerId).toLowerCase();

    const allMsgs = await this.persistence.getAllMessages();
    const conversation = allMsgs.filter((m) => {
      const from = (m.from || m.senderCallsign || '').toLowerCase();
      const to = (m.to || m.recipientCallsign || '').toLowerCase();

      return (
        (from === myCallsign && to === peerCallsign) ||
        (from === peerCallsign && to === myCallsign) ||
        (m.senderId === peerId && m.recipientId === localId.nodeId) ||
        (m.senderId === localId.nodeId && m.recipientId === peerId)
      );
    });

    // Ensure contents are decrypted
    const encKeyPair = await this.identity.getEncryptionKeyPair();
    const decryptedConversation = await Promise.all(
      conversation.map(async (msg) => {
        if (msg.decryptedText) {
          return msg;
        }

        let text = msg.text || '';
        if (!text && msg.content) {
          try {
            text = await this.decryptor.decryptPayload(msg.content, encKeyPair.privateKey);
          } catch {
            text = '🔒 [Encrypted Mesh Packet]';
          }
        }

        return {
          ...msg,
          decryptedText: text || '🔒 Encrypted message',
          text: text || msg.text || '🔒 Encrypted message',
        };
      })
    );

    return decryptedConversation.sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getUnreadCount(): Promise<number> {
    await this.initMessageStorage();
    const localId = await this.identity.getLocalIdentity();
    const myCallsign = localId.callsign.toLowerCase();

    const allMsgs = await this.persistence.getAllMessages();
    const unread = allMsgs.filter((m) => {
      const to = (m.to || m.recipientCallsign || '').toLowerCase();
      const isForMe = to === myCallsign || m.recipientId === localId.nodeId;
      return isForMe && m.isRead === false;
    });

    return unread.length;
  }

  public async markConversationAsRead(peerId: string): Promise<void> {
    await this.initMessageStorage();
    const localId = await this.identity.getLocalIdentity();
    const myCallsign = localId.callsign.toLowerCase();

    const peer = await this.peers.getPeerByNodeId(peerId) || await this.peers.getPeerByCallsign(peerId);
    const peerCallsign = (peer ? peer.callsign : peerId).toLowerCase();

    await this.persistence.markAsRead((m) => {
      const from = (m.from || m.senderCallsign || '').toLowerCase();
      const to = (m.to || m.recipientCallsign || '').toLowerCase();
      return (from === peerCallsign || m.senderId === peerId) && (to === myCallsign || m.recipientId === localId.nodeId);
    });
  }

  public async saveIncomingMessage(message: MeshMessage): Promise<boolean> {
    await this.initMessageStorage();
    const existing = await this.persistence.getMessageById(message.id);
    if (existing) return false;

    const localId = await this.identity.getLocalIdentity();
    const myCallsign = localId.callsign.toLowerCase();
    const isForMe = (message.to || message.recipientCallsign || '').toLowerCase() === myCallsign;

    let decryptedText = message.decryptedText || message.text;
    if (!decryptedText && isForMe && message.content) {
      try {
        const encKeyPair = await this.identity.getEncryptionKeyPair();
        decryptedText = await this.decryptor.decryptPayload(message.content, encKeyPair.privateKey);
      } catch {
        decryptedText = '🔒 [Encrypted Mesh Packet]';
      }
    }

    const enrichedMessage: MeshMessage = {
      ...message,
      decryptedText,
      text: decryptedText || message.text,
      isRead: !isForMe,
      status: 'delivered',
    };

    await this.persistence.saveMessage(enrichedMessage);
    return true;
  }

  public subscribeToMessages(callback: () => void): () => void {
    return this.persistence.subscribe(callback);
  }
}

export const messageService = new MessageService();

export const initMessageStorage = messageService.initMessageStorage;
export const getLocalUserCrypto = messageService.getLocalUserCrypto;
export const getLocalUserDualCrypto = messageService.getLocalUserDualCrypto;
export const getPeerPublicKey = messageService.getPeerPublicKey;
export const getPeerEncryptionKey = messageService.getPeerEncryptionKey;
export const encryptWithPublicKey = messageService.encryptWithPublicKey;
export const decryptWithKey = messageService.decryptWithKey;
export const sendDirectMessage = messageService.sendDirectMessage;
export const getConversation = messageService.getConversation;
export const getUnreadCount = messageService.getUnreadCount;
export const markConversationAsRead = messageService.markConversationAsRead;
export const saveIncomingMessage = messageService.saveIncomingMessage;
export const subscribeToMessages = messageService.subscribeToMessages;
