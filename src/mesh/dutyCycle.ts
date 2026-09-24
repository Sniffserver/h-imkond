/**
 * HÕIMU LoRa 868 MHz Duty Cycle & Airtime Regulator (1% EU Band Regulation)
 */

export interface DutyCycleState {
  maxAirtimeMsPerWindow: number; // e.g. 36,000 ms per 1 hour (1% duty cycle)
  windowDurationMs: number; // 3,600,000 ms (1 hour)
  currentWindowAirtimeMs: number;
  currentWindowStartMs: number;
  isThrottled: boolean;
}

export class DutyCycleRegulator {
  private state: DutyCycleState;

  constructor(maxAirtimeMsPerWindow = 36000, windowDurationMs = 3600000) {
    this.state = {
      maxAirtimeMsPerWindow,
      windowDurationMs,
      currentWindowAirtimeMs: 0,
      currentWindowStartMs: Date.now(),
      isThrottled: false,
    };
  }

  public canTransmit(estimatedAirtimeMs: number): boolean {
    this.checkWindowRoll();
    return this.state.currentWindowAirtimeMs + estimatedAirtimeMs <= this.state.maxAirtimeMsPerWindow;
  }

  public recordTransmission(airtimeMs: number): void {
    this.checkWindowRoll();
    this.state.currentWindowAirtimeMs += airtimeMs;
    if (this.state.currentWindowAirtimeMs >= this.state.maxAirtimeMsPerWindow) {
      this.state.isThrottled = true;
    }
  }

  public getState(): DutyCycleState {
    this.checkWindowRoll();
    return { ...this.state };
  }

  private checkWindowRoll(): void {
    const now = Date.now();
    if (now - this.state.currentWindowStartMs >= this.state.windowDurationMs) {
      this.state.currentWindowStartMs = now;
      this.state.currentWindowAirtimeMs = 0;
      this.state.isThrottled = false;
    }
  }
}
