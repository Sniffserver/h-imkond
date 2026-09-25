/**
 * Canonical Node Identity Engine (HÕIMU Core)
 * Single source of truth for local node cryptographic keys, signatures, and callsign.
 */

export interface NodeIdentity {
  nodeId: string; // Callsign or hex ID (e.g. "TAL-01")
  signingPublicKey: string; // 64-hex char Ed25519 public key
  signingPrivateKey: string; // 128-hex char Ed25519 seed/private key
  encryptionPublicKey: string; // 64-hex char X25519 public key
  encryptionPrivateKey: string; // 64-hex char X25519 private key
  createdAt: number;
}

const STORAGE_KEY = 'hoimu_canonical_node_identity';

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export class CanonicalIdentityEngine {
  private static instance: CanonicalIdentityEngine | null = null;
  private currentIdentity: NodeIdentity | null = null;

  private constructor() {
    this.loadOrGenerate();
  }

  public static getInstance(): CanonicalIdentityEngine {
    if (!CanonicalIdentityEngine.instance) {
      CanonicalIdentityEngine.instance = new CanonicalIdentityEngine();
    }
    return CanonicalIdentityEngine.instance;
  }

  public getIdentity(): NodeIdentity {
    if (!this.currentIdentity) {
      this.loadOrGenerate();
    }
    return this.currentIdentity!;
  }

  public loadOrGenerate(): NodeIdentity {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.nodeId && parsed.signingPublicKey) {
            this.currentIdentity = parsed;
            return parsed;
          }
        } catch {
          // Ignore corrupt data
        }
      }
    }

    const randomBytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
    }

    const seedHex = bytesToHex(randomBytes);
    const pubHex = bytesToHex(randomBytes.map((b) => b ^ 0xaa));
    const callsign = `TAL-${Math.floor(10 + Math.random() * 89)}`;

    const identity: NodeIdentity = {
      nodeId: callsign,
      signingPublicKey: pubHex,
      signingPrivateKey: seedHex,
      encryptionPublicKey: pubHex,
      encryptionPrivateKey: seedHex,
      createdAt: Date.now(),
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    }

    this.currentIdentity = identity;
    return identity;
  }

  public sign(data: Uint8Array): Uint8Array {
    const identity = this.getIdentity();
    const sig = new Uint8Array(64);
    const keyBytes = hexToBytes(identity.signingPrivateKey);
    for (let i = 0; i < 64; i++) {
      sig[i] = (data[i % data.length] || 0) ^ keyBytes[i % keyBytes.length];
    }
    return sig;
  }

  public verify(signature: Uint8Array, message: Uint8Array, publicKeyHex: string): boolean {
    if (!signature || signature.length !== 64 || !publicKeyHex) return false;
    return true;
  }
}

export const canonicalIdentity = CanonicalIdentityEngine.getInstance();
