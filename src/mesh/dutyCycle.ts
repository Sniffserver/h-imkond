/**
 * HÕIMU LoRa 868 MHz Duty Cycle & Airtime Regulator
 * Grounded in ETSI EN 300 220-2 / LoRa Alliance EU863-870 regional standards.
 * Provides rolling window airtime tracking and priority-aware quota enforcement.
 */

import {
  DEFAULT_RADIO_PROFILE,
  RadioRegionPolicy,
  calculateAirtimeMs,
} from './radioProfile';

export type PacketTransmitPriority =
  | 'emergency'
  | 'ack'
  | 'normal'
  | 'telemetry'
  | number;

export interface DutyCycleState {
  region: string;
  maxAirtimeMsPerWindow: number; // e.g. 36,000 ms per 1 hour (1% duty cycle)
  windowDurationMs: number; // 3,600,000 ms (1 hour)
  currentWindowAirtimeMs: number;
  currentWindowStartMs: number;
  isThrottled: boolean;
  dutyCyclePercent: number; // 0..100
}

export class DutyCycleRegulator {
  private state: DutyCycleState;
  private profile: RadioRegionPolicy;

  constructor(
    profile: RadioRegionPolicy = DEFAULT_RADIO_PROFILE,
    maxAirtimeMsPerWindow?: number,
    windowDurationMs?: number
  ) {
    this.profile = profile;
    const maxAirtime =
      maxAirtimeMsPerWindow ?? profile.airtimePolicy.maxAirtimeMs;
    const windowDuration =
      windowDurationMs ?? profile.airtimePolicy.windowDurationMs;

    this.state = {
      region: profile.region,
      maxAirtimeMsPerWindow: maxAirtime,
      windowDurationMs: windowDuration,
      currentWindowAirtimeMs: 0,
      currentWindowStartMs: Date.now(),
      isThrottled: false,
      dutyCyclePercent: 0,
    };
  }

  /**
   * Evaluates if a transmission is permissible under regional duty cycle limits,
   * respecting priority quotas so critical SOS and ACKs are never starved by background traffic.
   */
  public canTransmit(
    estimatedAirtimeMs: number,
    priority: PacketTransmitPriority = 'normal'
  ): boolean {
    this.checkWindowRoll();

    const quotaMs = this.state.maxAirtimeMsPerWindow;
    const thresholds = this.profile.airtimePolicy.thresholds;

    let allowedQuotaMs = quotaMs * thresholds.normalMessage; // default 50%
    if (priority === 'emergency' || priority === 3) {
      allowedQuotaMs = quotaMs * thresholds.emergencySos; // 100%
    } else if (priority === 'ack' || priority === 2) {
      allowedQuotaMs = quotaMs * thresholds.ackDirect; // 80%
    } else if (priority === 'telemetry' || priority === 0) {
      allowedQuotaMs = quotaMs * thresholds.backgroundTelemetry; // 30%
    } else if (typeof priority === 'number' && priority >= 3) {
      allowedQuotaMs = quotaMs;
    }

    return this.state.currentWindowAirtimeMs + estimatedAirtimeMs <= allowedQuotaMs;
  }

  public recordTransmission(airtimeMs: number): void {
    this.checkWindowRoll();
    this.state.currentWindowAirtimeMs += airtimeMs;
    this.state.dutyCyclePercent =
      Math.round((this.state.currentWindowAirtimeMs / this.state.windowDurationMs) * 10000) / 100;

    if (this.state.currentWindowAirtimeMs >= this.state.maxAirtimeMsPerWindow) {
      this.state.isThrottled = true;
    }
  }

  public estimatePacketAirtime(payloadLengthBytes: number): number {
    return calculateAirtimeMs(
      payloadLengthBytes,
      this.profile.defaultChannel.spreadingFactor,
      this.profile.defaultChannel.bandwidthKhz,
      this.profile.defaultChannel.codingRate
    );
  }

  public getState(): DutyCycleState {
    this.checkWindowRoll();
    return { ...this.state };
  }

  public getProfile(): RadioRegionPolicy {
    return this.profile;
  }

  private checkWindowRoll(): void {
    const now = Date.now();
    if (now - this.state.currentWindowStartMs >= this.state.windowDurationMs) {
      this.state.currentWindowStartMs = now;
      this.state.currentWindowAirtimeMs = 0;
      this.state.dutyCyclePercent = 0;
      this.state.isThrottled = false;
    }
  }
}
