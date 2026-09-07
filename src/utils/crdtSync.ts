import { ResourceItem, MeshMessage, SurvivalPoi, DaoProposal } from '../types';

export interface CrdtEntry<T> {
  id: string;
  value: T;
  timestamp: number;
  peerId: string;
  deleted: boolean;
}

export type CrdtLog<T> = Record<string, CrdtEntry<T>>;

/**
 * HÕIMU Conflict-free Replicated Data Type (CRDT) Engine.
 * Implements a fully offline-compliant Last-Write-Wins Element Set (LWW-Element-Set)
 * that synchronizes resources, messages, and custom map landmarks (POIs) between
 * mesh nodes without centralized authority.
 */
export class CrdtSyncEngine {
  private peerId: string;

  constructor(peerId: string) {
    this.peerId = peerId;
  }

  /**
   * Merges two Last-Write-Wins (LWW) logs.
   * Keeps the entry with the higher timestamp. Ties are broken by lexicographical order of peer ID.
   */
  public mergeLogs<T>(localLog: CrdtLog<T>, remoteLog: CrdtLog<T>): CrdtLog<T> {
    const merged: CrdtLog<T> = { ...localLog };

    for (const key of Object.keys(remoteLog)) {
      const remoteEntry = remoteLog[key];
      const localEntry = localLog[key];

      if (!localEntry) {
        merged[key] = remoteEntry;
      } else {
        // Last-Write-Wins logic (with peer ID lexicographical tie-breaker)
        if (remoteEntry.timestamp > localEntry.timestamp) {
          merged[key] = remoteEntry;
        } else if (remoteEntry.timestamp === localEntry.timestamp) {
          if (remoteEntry.peerId > localEntry.peerId) {
            merged[key] = remoteEntry;
          }
        }
      }
    }

    return merged;
  }

  /**
   * Creates a new CRDT log entry for an insertion or update.
   */
  public createEntry<T>(id: string, value: T): CrdtEntry<T> {
    return {
      id,
      value,
      timestamp: Date.now(),
      peerId: this.peerId,
      deleted: false,
    };
  }

  /**
   * Creates a tombstone entry to signal deletion.
   */
  public createTombstone<T>(id: string, fallbackValue: T): CrdtEntry<T> {
    return {
      id,
      value: fallbackValue,
      timestamp: Date.now(),
      peerId: this.peerId,
      deleted: true,
    };
  }

  /**
   * Filters out deleted (tombstoned) entries and returns only active values.
   */
  public extractActiveValues<T>(log: CrdtLog<T>): T[] {
    return Object.values(log)
      .filter((entry) => !entry.deleted)
      .map((entry) => entry.value);
  }
}

// -------------------------------------------------------------
// Singleton local DB wrappers for fast UI persistent simulation
// -------------------------------------------------------------

export class HoimuLocalCrdtStore {
  private static STORAGE_PREFIX = 'hoimu_crdt_';

  public static getLog<T>(key: string): CrdtLog<T> {
    try {
      const raw = localStorage.getItem(this.STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static saveLog<T>(key: string, log: CrdtLog<T>): void {
    try {
      localStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(log));
    } catch (e) {
      console.warn('[CRDT Store] LocalStorage persistence error:', e);
    }
  }

  /**
   * Helper to fetch active list for the UI
   */
  public static getActiveValues<T>(key: string): T[] {
    const log = this.getLog<T>(key);
    return Object.values(log)
      .filter((entry) => !entry.deleted)
      .map((entry) => entry.value);
  }

  /**
   * Seeds default state if entirely empty
   */
  public static seedIfEmpty<T>(key: string, initialItems: T[], getId: (item: T) => string, peerId: string): void {
    const log = this.getLog<T>(key);
    if (Object.keys(log).length > 0) return;

    const seededLog: CrdtLog<T> = {};
    initialItems.forEach((item) => {
      const id = getId(item);
      seededLog[id] = {
        id,
        value: item,
        timestamp: Date.now() - 3600000, // 1 hour ago
        peerId,
        deleted: false,
      };
    });

    this.saveLog(key, seededLog);
  }
}
