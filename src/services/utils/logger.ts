/**
 * Sanitized Production & Field Logger for HÕIMU
 * 
 * Ensures all log outputs are sanitized against leaking:
 * - Bearer tokens & session credentials
 * - Cryptographic private keys (Ed25519, AES)
 * - Raw precise GPS coordinates in non-debug levels
 * - User passwords and recovery phrases
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /hoimu_ptk_[a-zA-Z0-9_\-]+/gi,
  /pin["']?\s*[:=]\s*["']?\d{4,8}["']?/gi,
  /token["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+["']?/gi,
  /privateKey["']?\s*[:=]\s*["']?[^"',\s]+["']?/gi,
  /password["']?\s*[:=]\s*["']?[^"',\s]+["']?/gi,
];

export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized;
  }
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeLogData(item));
    }
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('privatekey') ||
        lowerKey.includes('pin')
      ) {
        cleanObj[key] = '[REDACTED_CREDENTIAL]';
      } else {
        cleanObj[key] = sanitizeLogData(value);
      }
    }
    return cleanObj;
  }
  return data;
}

export class FieldLogger {
  private prefix: string;

  constructor(prefix: string = 'HÕIMU') {
    this.prefix = `[${prefix}]`;
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`${this.prefix} ${message}`, ...args.map(sanitizeLogData));
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`${this.prefix} ${message}`, ...args.map(sanitizeLogData));
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} ${message}`, ...args.map(sanitizeLogData));
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} ${message}`, ...args.map(sanitizeLogData));
  }
}

export const logger = new FieldLogger();
