/**
 * Canonical Trust Store (HÕIMU Core)
 * Single source of truth for peer trust levels, blacklisting, and explicit verification.
 */

export type TrustLevel = 'unverified' | 'verified' | 'trusted' | 'blocked';

export interface TrustRecord {
  peerId: string;
  signingPublicKey: string;
  level: TrustLevel;
  updatedAt: number;
  note?: string;
}

const STORAGE_KEY = 'hoimu_canonical_trust_records';

export class CanonicalTrustStore {
  private static instance: CanonicalTrustStore | null = null;
  private records: Map<string, TrustRecord> = new Map();

  private constructor() {
    this.load();
  }

  public static getInstance(): CanonicalTrustStore {
    if (!CanonicalTrustStore.instance) {
      CanonicalTrustStore.instance = new CanonicalTrustStore();
    }
    return CanonicalTrustStore.instance;
  }

  private load(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const list: TrustRecord[] = JSON.parse(saved);
          list.forEach((r) => this.records.set(r.peerId, r));
        } catch {
          // Ignored
        }
      }
    }
  }

  private save(): void {
    if (typeof localStorage !== 'undefined') {
      const list = Array.from(this.records.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  }

  public getTrustLevel(peerId: string): TrustLevel {
    return this.records.get(peerId)?.level || 'unverified';
  }

  public setTrustLevel(peerId: string, signingPublicKey: string, level: TrustLevel, note?: string): void {
    const record: TrustRecord = {
      peerId,
      signingPublicKey,
      level,
      updatedAt: Date.now(),
      note,
    };
    this.records.set(peerId, record);
    this.save();
  }

  public isBlocked(peerId: string): boolean {
    return this.getTrustLevel(peerId) === 'blocked';
  }

  public isTrustedOrVerified(peerId: string): boolean {
    const lvl = this.getTrustLevel(peerId);
    return lvl === 'trusted' || lvl === 'verified';
  }
}

export const canonicalTrustStore = CanonicalTrustStore.getInstance();
