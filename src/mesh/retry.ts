export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
}

export class RetryScheduler {
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private jitterRatio: number;

  constructor(options?: RetryOptions) {
    this.maxRetries = options?.maxRetries ?? 5;
    this.baseDelayMs = options?.baseDelayMs ?? 1000;
    this.maxDelayMs = options?.maxDelayMs ?? 30000;
    this.jitterRatio = options?.jitterRatio ?? 0.2;
  }

  public getBackoffDelay(attempt: number): number {
    const rawDelay = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attempt));
    const jitter = rawDelay * this.jitterRatio * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(rawDelay + jitter));
  }

  public shouldRetry(attempt: number): boolean {
    return attempt < this.maxRetries;
  }
}
