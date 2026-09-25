/**
 * HÕIMU Unified Radio Profile & Regional Compliance Policy
 *
 * Implements:
 * - EU868_HOIMU_PROFILE (single source of truth for SX1262, Pi bridge, and web client)
 * - RadioRegionPolicy (channel plans, TX limits, airtime accounting, and LBT/CAD parameters)
 * - Semtech SX1261/SX1262 validated CAD configuration (AN1200.48 / datasheet compliance)
 * - Priority-aware duty cycle regulator policy
 */

export type RadioRegion = 'EU868' | 'US915' | 'AS923' | 'AU915';

export type ChannelRole =
  | 'primary_mesh'
  | 'alternate_mesh'
  | 'emergency_sos'
  | 'high_power_telemetry';

export interface RadioChannelConfig {
  frequencyMhz: number;
  bandwidthKhz: number; // e.g. 125.0
  spreadingFactor: number; // e.g. 7 (SF7..SF12)
  codingRate: number; // 1 = 4/5, 2 = 4/6, 3 = 4/7, 4 = 4/8
  txPowerDbm: number; // e.g. 14 dBm (up to 27 dBm on 869.525 MHz)
  maxDutyCyclePercent: number; // e.g. 1.0% or 10.0%
  role: ChannelRole;
  description: string;
}

export interface LbtCadPolicy {
  /**
   * Number of symbols to monitor during CAD.
   * Semtech SX1261/SX1262 datasheet Section 13.4.1 recommends 4 symbols
   * for high-reliability detection in noisy industrial/forest environments.
   */
  cadSymbolNum: number; // 4
  /**
   * Detection peak threshold for CAD.
   * AN1200.48 recommends 22 for SF7-SF8.
   */
  cadDetPeak: number; // 22
  /**
   * Detection minimum threshold for CAD.
   */
  cadDetMin: number; // 10
  /**
   * Exit mode after CAD: 0 = CAD_ONLY (STDBY_RC), 1 = CAD_RX (enter RX if detected)
   */
  cadExitMode: number; // 0
  /**
   * Maximum CAD verification timeout in milliseconds.
   */
  cadTimeoutMs: number; // 50
  /**
   * Maximum backoff attempts when channel activity is detected.
   */
  maxBackoffAttempts: number; // 4
  /**
   * Minimum and maximum randomized backoff slot times.
   */
  minBackoffMs: number; // 5
  maxBackoffMs: number; // 20
}

export interface PriorityAirtimeThresholds {
  emergencySos: number; // 1.0 = up to 100% of hour quota (36,000 ms)
  ackDirect: number; // 0.8 = up to 80% quota (28,800 ms)
  normalMessage: number; // 0.5 = up to 50% quota (18,000 ms)
  backgroundTelemetry: number; // 0.3 = up to 30% quota (10,800 ms)
}

export interface AirtimeAccountingPolicy {
  windowDurationMs: number; // 3,600,000 ms (1 rolling hour)
  maxAirtimeMs: number; // 36,000 ms (1% ETSI EU868 restriction)
  thresholds: PriorityAirtimeThresholds;
}

export interface RadioRegionPolicy {
  region: RadioRegion;
  name: string;
  regulatoryStandard: string;
  defaultChannel: RadioChannelConfig;
  channels: RadioChannelConfig[];
  cadPolicy: LbtCadPolicy;
  airtimePolicy: AirtimeAccountingPolicy;
}

/**
 * Standard HÕIMU EU868 Mesh Radio Profile
 * Complies with ETSI EN 300 220-2 & LoRa Alliance EU863-870.
 *
 * Primary mesh: 868.1 MHz (BW 125kHz, SF7, CR 4/5, +14dBm, 1% duty cycle)
 * Alternate 1: 868.3 MHz
 * Alternate 2: 868.5 MHz
 * Emergency / SOS: 869.525 MHz (Band g3, +27dBm, 10% duty cycle limit)
 */
export const EU868_HOIMU_PROFILE: RadioRegionPolicy = {
  region: 'EU868',
  name: 'EU868 HÕIMU Mesh Radio Profile',
  regulatoryStandard: 'ETSI EN 300 220-2 / CEPT ERC 70-03',
  defaultChannel: {
    frequencyMhz: 868.1,
    bandwidthKhz: 125.0,
    spreadingFactor: 7,
    codingRate: 1, // 4/5
    txPowerDbm: 14,
    maxDutyCyclePercent: 1.0,
    role: 'primary_mesh',
    description: 'Primary Community Mesh Frequency (868.1 MHz)',
  },
  channels: [
    {
      frequencyMhz: 868.1,
      bandwidthKhz: 125.0,
      spreadingFactor: 7,
      codingRate: 1,
      txPowerDbm: 14,
      maxDutyCyclePercent: 1.0,
      role: 'primary_mesh',
      description: 'Primary Mesh Channel (EU868 Sub-band g1)',
    },
    {
      frequencyMhz: 868.3,
      bandwidthKhz: 125.0,
      spreadingFactor: 7,
      codingRate: 1,
      txPowerDbm: 14,
      maxDutyCyclePercent: 1.0,
      role: 'alternate_mesh',
      description: 'Alternate Mesh Channel 1 (EU868 Sub-band g1)',
    },
    {
      frequencyMhz: 868.5,
      bandwidthKhz: 125.0,
      spreadingFactor: 7,
      codingRate: 1,
      txPowerDbm: 14,
      maxDutyCyclePercent: 1.0,
      role: 'alternate_mesh',
      description: 'Alternate Mesh Channel 2 (EU868 Sub-band g1)',
    },
    {
      frequencyMhz: 869.525,
      bandwidthKhz: 125.0,
      spreadingFactor: 7,
      codingRate: 1,
      txPowerDbm: 27, // 500 mW allowable in Band g3
      maxDutyCyclePercent: 10.0,
      role: 'emergency_sos',
      description: 'High-Power Emergency & SOS Fallback Channel (EU868 Sub-band g3)',
    },
  ],
  cadPolicy: {
    cadSymbolNum: 4, // AN1200.48 recommended 4 symbols for robust preamble detection
    cadDetPeak: 22, // SF7-SF8 peak threshold
    cadDetMin: 10,
    cadExitMode: 0, // STDBY_RC
    cadTimeoutMs: 50,
    maxBackoffAttempts: 4,
    minBackoffMs: 5,
    maxBackoffMs: 20,
  },
  airtimePolicy: {
    windowDurationMs: 3_600_000, // 1 hour
    maxAirtimeMs: 36_000, // 36 seconds per hour = 1.0%
    thresholds: {
      emergencySos: 1.0, // 36,000 ms
      ackDirect: 0.8, // 28,800 ms
      normalMessage: 0.5, // 18,000 ms
      backgroundTelemetry: 0.3, // 10,800 ms
    },
  },
};

export const DEFAULT_RADIO_PROFILE: RadioRegionPolicy = EU868_HOIMU_PROFILE;

/**
 * Calculates physical LoRa symbol duration in milliseconds.
 * Tsym = 2^SF / BW_kHz
 */
export function getSymbolDurationMs(sf: number, bwKhz: number): number {
  return (2 ** sf) / bwKhz;
}

/**
 * Determines whether Low Data Rate Optimization (LDRO) is physically required.
 * Grounded in Semtech SX1261/SX1262 datasheet: LDRO is mandated when symbol duration >= 16.38 ms.
 */
export function isLdroRequired(sf: number, bwKhz: number): boolean {
  return getSymbolDurationMs(sf, bwKhz) >= 16.0;
}

/**
 * Calculates physical Semtech LoRa Time-on-Air (ToA) in milliseconds.
 * Grounded in Semtech SX1261/SX1262 datasheet equations.
 */
export function calculateAirtimeMs(
  payloadBytes: number,
  sf: number = DEFAULT_RADIO_PROFILE.defaultChannel.spreadingFactor,
  bwKhz: number = DEFAULT_RADIO_PROFILE.defaultChannel.bandwidthKhz,
  cr: number = DEFAULT_RADIO_PROFILE.defaultChannel.codingRate,
  preambleSymbols: number = 8,
  explicitHeader: boolean = true,
  crcOn: boolean = true
): number {
  const tsymMs = getSymbolDurationMs(sf, bwKhz);
  const tPreambleMs = (preambleSymbols + 4.25) * tsymMs;

  const lowDataRateOptimize = isLdroRequired(sf, bwKhz) ? 1 : 0;
  const h = explicitHeader ? 0 : 1;
  const crc = crcOn ? 1 : 0;

  const numerator = 8 * payloadBytes - 4 * sf + 28 + (16 * crc) - (20 * h);
  const denominator = 4 * (sf - 2 * lowDataRateOptimize);
  const nPayload = 8 + Math.max(Math.ceil(numerator / denominator) * (cr + 4), 0);

  const tPayloadMs = nPayload * tsymMs;
  return Math.max(10, Math.ceil(tPreambleMs + tPayloadMs));
}
