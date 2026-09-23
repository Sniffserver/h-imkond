/**
 * Cryptographic Signed Event Log for HÕIMU State Engine
 * 
 * Provides tamper-evident, append-only event logging with Lamport logical clocks,
 * SHA-256 Merkle hash-chaining, and canonical RFC 8785 Ed25519 verification.
 */

import { SignedCRDTEvent, DomainEntityType } from './types';
import { canonicalizeToBytes } from '../protocol/canonical';
import { signBytes, verifySignature } from '../crypto/ed25519';

function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API is not available');
}

export async function computeEventHash(eventWithoutHash: Omit<SignedCRDTEvent, 'eventId' | 'signature'>): Promise<string> {
  const bytes = canonicalizeToBytes(eventWithoutHash);
  const subtle = getSubtle();
  const hashBuf = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class SignedEventLog {
  private events: SignedCRDTEvent[] = [];
  private vectorClock = new Map<string, number>();
  private localLamportClock = 0;
  private lastHash = '0000000000000000000000000000000000000000000000000000000000000000';

  public getEvents(): SignedCRDTEvent[] {
    return [...this.events];
  }

  public getVectorClock(): Record<string, number> {
    const clockRecord: Record<string, number> = {};
    for (const [nodeId, count] of this.vectorClock.entries()) {
      clockRecord[nodeId] = count;
    }
    return clockRecord;
  }

  public getLamportClock(): number {
    return this.localLamportClock;
  }

  /**
   * Creates, signs, and appends a local mutation event.
   */
  public async createSignedEvent<T = any>(options: {
    entityType: DomainEntityType;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    authorNodeId: string;
    authorCallsign: string;
    data: Partial<T>;
    signingPrivateKey: CryptoKey;
  }): Promise<SignedCRDTEvent<T>> {
    this.localLamportClock += 1;
    const currentLamport = this.localLamportClock;
    const wallClock = Date.now();

    const unsignedBody = {
      previousEventHash: this.lastHash,
      entityType: options.entityType,
      entityId: options.entityId,
      action: options.action,
      authorNodeId: options.authorNodeId,
      authorCallsign: options.authorCallsign,
      logicalClock: currentLamport,
      wallClock,
      data: options.data,
    };

    const eventId = await computeEventHash(unsignedBody);
    const signatureBytes = canonicalizeToBytes({ ...unsignedBody, eventId });
    const signature = await signBytes(options.signingPrivateKey, signatureBytes);

    const signedEvent: SignedCRDTEvent<T> = {
      eventId,
      ...unsignedBody,
      signature,
    };

    this.appendVerifiedEvent(signedEvent);
    return signedEvent;
  }

  /**
   * Verifies and integrates an incoming remote event.
   */
  public async verifyAndAppend(event: SignedCRDTEvent): Promise<boolean> {
    // 1. Check if already known
    if (this.events.some((e) => e.eventId === event.eventId)) {
      return false; // Duplicate
    }

    // 2. Validate cryptographic signature
    const envelopeToVerify = {
      previousEventHash: event.previousEventHash,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      authorNodeId: event.authorNodeId,
      authorCallsign: event.authorCallsign,
      logicalClock: event.logicalClock,
      wallClock: event.wallClock,
      data: event.data,
      eventId: event.eventId,
    };

    const canonicalBytes = canonicalizeToBytes(envelopeToVerify);
    const isValid = await verifySignature(event.authorNodeId, canonicalBytes, event.signature);
    if (!isValid) {
      console.warn(`[SignedEventLog] Rejected event ${event.eventId}: invalid signature from ${event.authorNodeId}`);
      return false;
    }

    this.appendVerifiedEvent(event);
    return true;
  }

  private appendVerifiedEvent(event: SignedCRDTEvent): void {
    this.events.push(event);
    this.lastHash = event.eventId;
    this.localLamportClock = Math.max(this.localLamportClock, event.logicalClock) + 1;

    const currentCount = this.vectorClock.get(event.authorNodeId) || 0;
    this.vectorClock.set(event.authorNodeId, Math.max(currentCount, event.logicalClock));
  }

  public getEventsAfter(clockMap: Record<string, number>): SignedCRDTEvent[] {
    return this.events.filter((e) => {
      const knownClock = clockMap[e.authorNodeId] || 0;
      return e.logicalClock > knownClock;
    });
  }

  public clear(): void {
    this.events = [];
    this.vectorClock.clear();
    this.localLamportClock = 0;
    this.lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
