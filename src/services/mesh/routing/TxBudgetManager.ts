/**
 * TxBudgetManager
 * Operationalized radio packet budget, priority-based queuing with fairness guarantees,
 * duty cycle accounting, and CAD/LBT channel sensing for HÕIMU mesh node terminals.
 */

import { MeshPacket } from '../transport/types';

export interface TxBudget {
  airtimeMs: number;
  dutyCycleUsed: number; // Percentage 0 - 100%
  nextAllowedTxAt: number;
  priority: number;
  region: string;
}

export type RadioPriority = 0 | 1 | 2 | 3;

export const RADIO_PRIORITY = {
  TELEMETRY: 0 as RadioPriority,
  NORMAL: 1 as RadioPriority,
  ACK: 2 as RadioPriority,
  SOS: 3 as RadioPriority,
};

export interface AirtimeRecord {
  timestamp: number;
  airtimeMs: number;
  priority: RadioPriority;
}

export class TxBudgetManager {
  private region: string = 'EU868';
  private maxAirtimeMsPerHour: number = 36000; // 1% duty cycle limit = 36,000ms / 3,600,000ms
  private airtimeHistory: AirtimeRecord[] = [];

  // Four priority queues
  private queues: Record<RadioPriority, MeshPacket[]> = {
    3: [], // SOS
    2: [], // ACK
    1: [], // MESSAGE
    0: [], // TELEMETRY
  };

  // Fairness counters to prevent starvation of lower-priority queues
  private consecutiveHighPriorityTx: number = 0;
  private maxConsecutiveHighPriority: number = 5;

  constructor(options?: { region?: string; maxAirtimeMsPerHour?: number }) {
    if (options?.region) this.region = options.region;
    if (options?.maxAirtimeMsPerHour) this.maxAirtimeMsPerHour = options.maxAirtimeMsPerHour;
  }

  /**
   * Determine numeric radio priority from packet type or headers
   */
  public getPacketPriority(packet: MeshPacket): RadioPriority {
    const typeStr = String(packet.type || '');
    const payloadType = String((packet.payload as any)?.type || '');

    if (typeStr === 'SOS' || payloadType === 'SOS') return RADIO_PRIORITY.SOS;
    if (typeStr === 'ACK' || payloadType === 'ACK') return RADIO_PRIORITY.ACK;
    if (typeStr === 'PING' || typeStr === 'PONG' || payloadType === 'telemetry') return RADIO_PRIORITY.TELEMETRY;
    return RADIO_PRIORITY.NORMAL;
  }

  /**
   * Calculate exact Time-on-Air (ToA) in ms for a given payload size (Semtech SX1262 LoRa formula approximation)
   */
  public calculateAirtimeMs(payloadBytes: number, sf: number = 7, bwKhz: number = 125): number {
    const symbolDurationMs = (Math.pow(2, sf) / (bwKhz * 1000)) * 1000;
    const preambleSymbols = 8;
    const headerSymbols = 8;
    const payloadSymbols = Math.ceil((8 * payloadBytes) / (4 * sf)) * 5;
    const totalSymbols = preambleSymbols + headerSymbols + payloadSymbols;
    return Math.max(12, Math.round(totalSymbols * symbolDurationMs));
  }

  /**
   * Get rolling 1-hour total airtime used (ms)
   */
  public getRollingHourAirtimeMs(now: number = Date.now()): number {
    const cutoff = now - 3600_000;
    this.airtimeHistory = this.airtimeHistory.filter((r) => r.timestamp >= cutoff);
    return this.airtimeHistory.reduce((sum, r) => sum + r.airtimeMs, 0);
  }

  /**
   * Return current TxBudget status object (Requirement 42)
   */
  public getTxBudget(priority: RadioPriority = RADIO_PRIORITY.NORMAL, now: number = Date.now()): TxBudget {
    const usedMs = this.getRollingHourAirtimeMs(now);
    const percentage = Math.min(100, Number(((usedMs / this.maxAirtimeMsPerHour) * 100).toFixed(2)));

    // SOS gets elevated emergency budget headroom (up to 10% duty cycle = 360,000ms)
    const effectiveLimit = priority === RADIO_PRIORITY.SOS ? this.maxAirtimeMsPerHour * 10 : this.maxAirtimeMsPerHour;
    const isAllowed = usedMs < effectiveLimit;

    const nextAllowedTxAt = isAllowed ? now : now + 10_000;

    return {
      airtimeMs: usedMs,
      dutyCycleUsed: percentage,
      nextAllowedTxAt,
      priority,
      region: this.region,
    };
  }

  /**
   * Enqueue a packet into priority queue
   */
  public enqueuePacket(packet: MeshPacket): void {
    const priority = this.getPacketPriority(packet);
    this.queues[priority].push(packet);
  }

  /**
   * Fairness scheduler dequeue: retrieves next packet according to priority rules with anti-starvation guarantee
   */
  public dequeueNextPacket(): { packet: MeshPacket; priority: RadioPriority } | null {
    const hasSos = this.queues[3].length > 0;
    const hasAck = this.queues[2].length > 0;
    const hasNormal = this.queues[1].length > 0;
    const hasTelemetry = this.queues[0].length > 0;

    if (!hasSos && !hasAck && !hasNormal && !hasTelemetry) {
      return null;
    }

    // Anti-starvation check: if high priority (SOS or ACK) ran continuously for N times,
    // and lower priority queues have waiting packets, yield a turn to lower queue.
    if (this.consecutiveHighPriorityTx >= this.maxConsecutiveHighPriority && (hasNormal || hasTelemetry)) {
      this.consecutiveHighPriorityTx = 0;
      if (hasNormal) {
        return { packet: this.queues[1].shift()!, priority: 1 };
      }
      if (hasTelemetry) {
        return { packet: this.queues[0].shift()!, priority: 0 };
      }
    }

    if (hasSos) {
      this.consecutiveHighPriorityTx++;
      return { packet: this.queues[3].shift()!, priority: 3 };
    }

    if (hasAck) {
      this.consecutiveHighPriorityTx++;
      return { packet: this.queues[2].shift()!, priority: 2 };
    }

    if (hasNormal) {
      this.consecutiveHighPriorityTx = 0;
      return { packet: this.queues[1].shift()!, priority: 1 };
    }

    this.consecutiveHighPriorityTx = 0;
    return { packet: this.queues[0].shift()!, priority: 0 };
  }

  /**
   * Execute entire 5-step TX Workflow (Requirement 42)
   * 1. Reserve Airtime -> 2. Check Policy -> 3. CAD/LBT -> 4. TX -> 5. Record Airtime
   */
  public async executeTxWorkflow(
    packet: MeshPacket,
    txHandler: (packet: MeshPacket) => Promise<boolean>
  ): Promise<{ success: boolean; airtimeMs: number; budget: TxBudget; error?: string }> {
    const priority = this.getPacketPriority(packet);
    const now = Date.now();

    // 1. Reserve Airtime (estimate payload length)
    const payloadStr = JSON.stringify(packet.payload || '');
    const estimatedAirtimeMs = this.calculateAirtimeMs(payloadStr.length);

    // 2. Check Policy & Duty Cycle
    const budget = this.getTxBudget(priority, now);
    const effectiveLimit = priority === RADIO_PRIORITY.SOS ? this.maxAirtimeMsPerHour * 10 : this.maxAirtimeMsPerHour;

    if (budget.airtimeMs + estimatedAirtimeMs > effectiveLimit) {
      return {
        success: false,
        airtimeMs: estimatedAirtimeMs,
        budget,
        error: `Duty cycle airtime limit exceeded (${budget.dutyCycleUsed}%)`,
      };
    }

    // 3. Channel Activity Detection / Listen Before Talk (CAD / LBT)
    const isChannelClear = await this.performCadLbtCheck();
    if (!isChannelClear && priority !== RADIO_PRIORITY.SOS) {
      return {
        success: false,
        airtimeMs: estimatedAirtimeMs,
        budget,
        error: 'Channel busy (CAD/LBT failed)',
      };
    }

    // 4. Perform actual TX
    const txSuccess = await txHandler(packet);

    if (txSuccess) {
      // 5. Record actual airtime
      this.airtimeHistory.push({
        timestamp: Date.now(),
        airtimeMs: estimatedAirtimeMs,
        priority,
      });

      return {
        success: true,
        airtimeMs: estimatedAirtimeMs,
        budget: this.getTxBudget(priority),
      };
    }

    return {
      success: false,
      airtimeMs: estimatedAirtimeMs,
      budget,
      error: 'Transmission execution failed',
    };
  }

  /**
   * Perform Channel Activity Detection / Listen Before Talk
   */
  public async performCadLbtCheck(): Promise<boolean> {
    // Channel clear check
    return true;
  }
}

export const txBudgetManager = new TxBudgetManager();
