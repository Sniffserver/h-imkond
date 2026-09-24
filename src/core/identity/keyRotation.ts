/**
 * HÕIMU Key Rotation & Key Versioning Manager
 */

import { PeerIdentity, PeerKeyHistory } from './peerIdentity';
import { peerTrustStore } from './trustStore';

export class KeyRotationManager {
  public static rotatePeerKey(
    nodeId: string,
    newSigningPublicKeyHex: string,
    newEncryptionPublicKeyHex: string
  ): boolean {
    const peer = peerTrustStore.getPeer(nodeId);
    if (!peer) return false;

    const oldHistory: PeerKeyHistory = {
      keyVersion: peer.keyVersion || 1,
      signingPublicKeyHex: peer.signingPublicKeyHex,
      encryptionPublicKeyHex: peer.encryptionPublicKeyHex,
      validFrom: peer.firstSeenAt,
      validTo: Date.now(),
    };

    const updatedHistory = [...(peer.keyHistory || []), oldHistory];
    const newVersion = (peer.keyVersion || 1) + 1;

    peerTrustStore.registerPeer({
      ...peer,
      keyVersion: newVersion,
      signingPublicKeyHex: newSigningPublicKeyHex,
      encryptionPublicKeyHex: newEncryptionPublicKeyHex,
      trustState: 'rotated',
      keyHistory: updatedHistory,
      lastSeenAt: Date.now(),
    });

    return true;
  }
}
