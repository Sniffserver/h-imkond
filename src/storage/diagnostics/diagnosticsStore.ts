/**
 * Storage Domain: diagnostics
 * 
 * Persists RF airtime records, rolling 1-hour duty cycle tracking,
 * packet loss stats, and link health telemetry.
 * 
 * RULE: Backed by IndexedDB. NEVER stored in localStorage.
 */

import { storageDB } from '../db';
import { STORES } from '../migrations';

export interface AirtimeRecord {
  id: string;
  timestamp: number;
  durationMs: number;
  packetId: string;
  priority: number;
  frequencyMhz?: number;
}

const memoryAirtimeRecords: AirtimeRecord[] = [];

export class DiagnosticsStore {
  /**
   * Log an airtime transmission record.
   */
  public static async recordTransmission(record: Omit<AirtimeRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<AirtimeRecord> {
    const item: AirtimeRecord = {
      id: record.id || `air_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: record.timestamp || Date.now(),
      durationMs: record.durationMs,
      packetId: record.packetId,
      priority: record.priority,
      frequencyMhz: record.frequencyMhz,
    };

    memoryAirtimeRecords.push(item);
    if (memoryAirtimeRecords.length > 2000) {
      memoryAirtimeRecords.shift();
    }

    try {
      const db = await storageDB.getDB();
      const tx = db.transaction(STORES.DIAGNOSTICS, 'readwrite');
      tx.objectStore(STORES.DIAGNOSTICS).put({
        ...item,
        type: 'airtime',
      });
    } catch {
      // Memory fallback active
    }

    return item;
  }

  /**
   * Calculates rolling 1-hour airtime usage in milliseconds and percentage.
   */
  public static async getRollingHourAirtime(windowMs = 3600000): Promise<{
    totalAirtimeMs: number;
    dutyCyclePercent: number;
    recordCount: number;
    recordsByPriority: Record<number, number>;
  }> {
    const cutoff = Date.now() - windowMs;
    let records: AirtimeRecord[] = [];

    try {
      const db = await storageDB.getDB();
      records = await new Promise<AirtimeRecord[]>((resolve) => {
        const tx = db.transaction(STORES.DIAGNOSTICS, 'readonly');
        const req = tx.objectStore(STORES.DIAGNOSTICS).getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as (AirtimeRecord & { type?: string })[];
          resolve(all.filter((r) => r.type === 'airtime' && r.timestamp >= cutoff));
        };
        req.onerror = () => resolve(memoryAirtimeRecords.filter((r) => r.timestamp >= cutoff));
      });
    } catch {
      records = memoryAirtimeRecords.filter((r) => r.timestamp >= cutoff);
    }

    let totalAirtimeMs = 0;
    const recordsByPriority: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (const rec of records) {
      totalAirtimeMs += rec.durationMs;
      const p = rec.priority || 0;
      recordsByPriority[p] = (recordsByPriority[p] || 0) + rec.durationMs;
    }

    const dutyCyclePercent = Math.min(100, (totalAirtimeMs / windowMs) * 100);

    return {
      totalAirtimeMs,
      dutyCyclePercent: Number(dutyCyclePercent.toFixed(3)),
      recordCount: records.length,
      recordsByPriority,
    };
  }

  /**
   * Clears old diagnostics records beyond retention limit (e.g. 24 hours).
   */
  public static async pruneOldRecords(maxAgeMs = 86400000): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    for (let i = memoryAirtimeRecords.length - 1; i >= 0; i--) {
      if (memoryAirtimeRecords[i].timestamp < cutoff) {
        memoryAirtimeRecords.splice(i, 1);
      }
    }
  }
}
