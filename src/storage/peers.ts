import { storageDB } from './db';
import { STORES } from './migrations';
import { signEd25519, verifyEd25519 } from '../core/crypto/ed25519';
import { toHex, fromHex } from '../core/crypto/utils';

export interface StoredPeer {
  nodeId: string;
  callsign: string;
  signingPublicKeyHex: string;
  dhPublicKeyHex?: string;
  lastSeen: number;
  hopCount: number;
  snr?: number;
  rssi?: number;
  viaTransport?: string;
  keyVersion?: number;
}

export interface KeyRotationStatement {
  nodeId: string;
  oldPublicKeyHex: string;
  newPublicKeyHex: string;
  version: number;
  validFrom: number;
  validUntil: number;
  signatureByOldKey: string; // Ed25519 signature by old trusted key
  signatureByNewKey?: string; // Ed25519 signature by new key (proof of possession)
}

const memoryPeers = new Map<string, StoredPeer>();

export class PeerStore {
  /**
   * Encodes a key rotation statement deterministically into bytes for signature verification.
   */
  public static serializeRotationStatement(
    nodeId: string,
    oldKeyHex: string,
    newKeyHex: string,
    version: number,
    validFrom: number,
    validUntil: number
  ): Uint8Array {
    const raw = `HOIMU_KEY_ROTATION:v1:${nodeId}:${oldKeyHex}:${newKeyHex}:${version}:${validFrom}:${validUntil}`;
    return new TextEncoder().encode(raw);
  }

  /**
   * Helper to create and sign a cryptographic key rotation statement.
   */
  public static async createKeyRotationStatement(
    nodeId: string,
    oldPrivateKey: CryptoKey,
    oldPublicKeyHex: string,
    newPrivateKey: CryptoKey,
    newPublicKeyHex: string,
    version: number,
    validityDurationMs = 30 * 24 * 3600 * 1000 // 30 days
  ): Promise<KeyRotationStatement> {
    const now = Date.now();
    const validFrom = now - 5000;
    const validUntil = now + validityDurationMs;

    const dataToSign = this.serializeRotationStatement(
      nodeId,
      oldPublicKeyHex,
      newPublicKeyHex,
      version,
      validFrom,
      validUntil
    );

    const oldSigBytes = await signEd25519(dataToSign, oldPrivateKey);
    const newSigBytes = await signEd25519(dataToSign, newPrivateKey);

    return {
      nodeId,
      oldPublicKeyHex,
      newPublicKeyHex,
      version,
      validFrom,
      validUntil,
      signatureByOldKey: toHex(oldSigBytes),
      signatureByNewKey: toHex(newSigBytes),
    };
  }

  /**
   * Cryptographically verifies a key rotation statement.
   */
  public static async verifyRotationStatement(
    existingPeer: StoredPeer,
    statement?: KeyRotationStatement
  ): Promise<boolean> {
    if (!statement) return false;

    // 1. Identity & Key match
    if (statement.nodeId !== existingPeer.nodeId) return false;
    if (statement.oldPublicKeyHex !== existingPeer.signingPublicKeyHex) return false;

    // 2. Monotonic version increase
    const currVersion = existingPeer.keyVersion || 1;
    if (statement.version <= currVersion) return false;

    // 3. Validity window
    const now = Date.now();
    if (now < statement.validFrom || now > statement.validUntil) return false;

    // 4. Verify signature by old trusted key
    try {
      const data = this.serializeRotationStatement(
        statement.nodeId,
        statement.oldPublicKeyHex,
        statement.newPublicKeyHex,
        statement.version,
        statement.validFrom,
        statement.validUntil
      );

      const oldSig = fromHex(statement.signatureByOldKey);
      const isOldValid = await verifyEd25519(data, oldSig, statement.oldPublicKeyHex);
      if (!isOldValid) return false;

      // 5. Verify signature by new key if present
      if (statement.signatureByNewKey) {
        const newSig = fromHex(statement.signatureByNewKey);
        const isNewValid = await verifyEd25519(data, newSig, statement.newPublicKeyHex);
        if (!isNewValid) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upserts peer data with strict key rotation verification.
   * If a trusted public key already exists and the incoming key is different,
   * a valid KeyRotationStatement is required. Otherwise the key change is blocked.
   */
  public static async upsertPeer(
    peer: StoredPeer,
    rotationStatement?: KeyRotationStatement
  ): Promise<{ success: boolean; keyRotated: boolean; error?: string }> {
    const existing = await this.getPeer(peer.nodeId);

    let finalSigningKey = peer.signingPublicKeyHex;
    let finalKeyVersion = peer.keyVersion ?? existing?.keyVersion ?? 1;
    let keyRotated = false;

    if (existing && existing.signingPublicKeyHex) {
      if (peer.signingPublicKeyHex && peer.signingPublicKeyHex !== existing.signingPublicKeyHex) {
        // Attempting to change the public key!
        const isValidRotation = await this.verifyRotationStatement(existing, rotationStatement);
        if (isValidRotation && rotationStatement) {
          finalSigningKey = rotationStatement.newPublicKeyHex;
          finalKeyVersion = rotationStatement.version;
          keyRotated = true;
          console.info(
            `[PeerStore] Verified key rotation for peer ${peer.nodeId}: ` +
            `${existing.signingPublicKeyHex.slice(0, 8)}... -> ${finalSigningKey.slice(0, 8)}... (v${finalKeyVersion})`
          );
        } else {
          // REJECT unauthorized public key change!
          console.warn(
            `[PeerStore] Blocked unauthorized public key replacement for peer ${peer.nodeId}! ` +
            `Attempted ${peer.signingPublicKeyHex.slice(0, 8)}... without valid rotation proof. Retaining trusted key.`
          );
          finalSigningKey = existing.signingPublicKeyHex;
          finalKeyVersion = existing.keyVersion || 1;
        }
      }
    }

    const peerToSave: StoredPeer = {
      ...peer,
      signingPublicKeyHex: finalSigningKey,
      keyVersion: finalKeyVersion,
    };

    memoryPeers.set(peer.nodeId, peerToSave);

    try {
      await storageDB.writeDurably(STORES.PEERS, (store) => {
        return store.put(peerToSave);
      });
    } catch {
      // Memory fallback active
    }

    return {
      success: true,
      keyRotated,
    };
  }

  public static async getPeer(nodeId: string): Promise<StoredPeer | null> {
    if (memoryPeers.has(nodeId)) {
      return memoryPeers.get(nodeId) || null;
    }

    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.PEERS, 'readonly');
        const req = tx.objectStore(STORES.PEERS).get(nodeId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public static async getAllPeers(): Promise<StoredPeer[]> {
    try {
      const db = await storageDB.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.PEERS, 'readonly');
        const req = tx.objectStore(STORES.PEERS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(memoryPeers.values()));
      });
    } catch {
      return Array.from(memoryPeers.values());
    }
  }

  public static clearMemory(): void {
    memoryPeers.clear();
  }
}
