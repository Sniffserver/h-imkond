import { BatteryHistoryPoint } from '../types';

const STORAGE_KEY = 'hoimu_battery_history_24h';

/**
 * Generates a realistic 24-hour battery and solar telemetry log for the field terminal.
 */
export function generateInitial24hBatteryHistory(
  currentBatteryLevel = 88,
  isSolarAware = false,
  hasSolarPanels = false
): BatteryHistoryPoint[] {
  const now = Date.now();
  const points: BatteryHistoryPoint[] = [];

  // Anchor points for 24-hour curve ending at currentBatteryLevel
  // 24 hours ago (yesterday around this time)
  for (let i = 24; i >= 0; i--) {
    const timestamp = now - i * 3600 * 1000;
    const date = new Date(timestamp);
    const hourOfDay = date.getHours();
    const timeLabel = i === 0 
      ? 'Praegu (Now)' 
      : `${hourOfDay.toString().padStart(2, '0')}:00`;

    let solarHarvestW = 0;
    let consumptionW = isSolarAware ? 1.8 : 3.8;
    let activeProtocol: 'BLE' | 'Wi-Fi Direct' | 'Standby' | 'Solar Float' = 'Standby';
    let modeDescription = 'Öine energiasääst (Night Eco Standby)';

    // Solar model based on daylight hours (06:00 to 20:00) ONLY if user has solar panels active
    if (hasSolarPanels && hourOfDay >= 6 && hourOfDay <= 20) {
      const solarPeakHour = 13;
      const hoursFromPeak = Math.abs(hourOfDay - solarPeakHour);
      if (hoursFromPeak <= 7) {
        // Bell-curve solar intensity
        const factor = Math.cos((hoursFromPeak / 7) * (Math.PI / 2));
        solarHarvestW = Math.round(Math.max(0, factor * 21.8) * 10) / 10;
      }
    }

    // Protocol consumption profile
    if (hourOfDay >= 23 || hourOfDay < 6) {
      // Night sleep: BLE beacon only on 15m cadence
      consumptionW = isSolarAware ? 1.4 : 2.2;
      activeProtocol = 'BLE';
      modeDescription = 'Öine ooterežiim (BLE 15m intervall)';
    } else if (hourOfDay >= 11 && hourOfDay <= 15) {
      // Midday peak: Wi-Fi Direct sync bursts
      consumptionW = isSolarAware ? 4.2 : 7.8;
      activeProtocol = 'Wi-Fi Direct';
      modeDescription = hasSolarPanels 
        ? 'Päikesetipu sünkroonimine (Wi-Fi Direct P2P)' 
        : 'Aktiivne võrgusünkroonimine (Wi-Fi Direct P2P)';
    } else if (solarHarvestW > 14) {
      activeProtocol = 'Solar Float';
      modeDescription = 'Päikesepaneeli laadimisrežiim (MPPT Float)';
    } else {
      consumptionW = isSolarAware ? 2.1 : 4.4;
      activeProtocol = 'BLE';
      modeDescription = 'Aktiivne BLE majakavõrk (Active Beaconing)';
    }

    // Battery level progression
    let simulatedLevel: number;
    if (i === 0) {
      simulatedLevel = currentBatteryLevel;
    } else {
      const nightDip = Math.sin(((hourOfDay + 12) % 24) / 24 * Math.PI * 2) * (hasSolarPanels ? 14 : 6);
      const baseLevel = currentBatteryLevel - (i / 24) * (hasSolarPanels ? 4 : -12);
      simulatedLevel = Math.min(100, Math.max(15, Math.round(baseLevel + nightDip * 0.5)));
    }

    const netPowerW = Math.round((solarHarvestW - consumptionW) * 10) / 10;

    points.push({
      timestamp,
      timeLabel,
      hour: hourOfDay,
      batteryLevel: simulatedLevel,
      solarHarvestW,
      consumptionW,
      netPowerW,
      activeProtocol,
      modeDescription,
    });
  }

  // Ensure last point matches current battery level exactly
  if (points.length > 0) {
    points[points.length - 1].batteryLevel = currentBatteryLevel;
  }

  return points;
}

/**
 * Returns cached 24h battery history or creates a new calibrated history.
 */
export function getStoredOrGeneratedBatteryHistory(
  currentBatteryLevel = 88,
  isSolarAware = false,
  hasSolarPanels = false
): BatteryHistoryPoint[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: BatteryHistoryPoint[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 12) {
        // Update the latest point to reflect the live battery level
        parsed[parsed.length - 1].batteryLevel = currentBatteryLevel;
        parsed[parsed.length - 1].solarHarvestW = hasSolarPanels ? (isSolarAware ? 14.8 : 18.2) : 0;
        parsed[parsed.length - 1].consumptionW = isSolarAware ? 2.1 : 5.4;
        parsed[parsed.length - 1].netPowerW = Math.round(
          (parsed[parsed.length - 1].solarHarvestW - parsed[parsed.length - 1].consumptionW) * 10
        ) / 10;
        return parsed;
      }
    }
  } catch {
    // Ignore error and generate fresh
  }

  const generated = generateInitial24hBatteryHistory(currentBatteryLevel, isSolarAware, hasSolarPanels);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
  } catch {
    // Ignore storage quota
  }
  return generated;
}

/**
 * Computes energy analytics and optimization advice from 24h battery data.
 */
export function computeBatteryTelemetryAnalytics(data: BatteryHistoryPoint[]) {
  if (!data || data.length === 0) {
    return {
      totalSolarWh: 145,
      totalConsumedWh: 78,
      netBalanceWh: 67,
      peakSolarW: 21.8,
      peakSolarHour: '13:00',
      minBattery: 62,
      maxBattery: 94,
      avgHourlyDrainRate: 2.3,
      estimatedRemainingHours: 38.2,
      solarSelfSufficiencyPct: 185,
    };
  }

  let totalSolarWh = 0;
  let totalConsumedWh = 0;
  let peakSolarW = 0;
  let peakSolarHour = '12:00';
  let minBattery = 100;
  let maxBattery = 0;

  data.forEach((p) => {
    totalSolarWh += p.solarHarvestW; // 1-hour intervals: Watts * 1h = Wh
    totalConsumedWh += p.consumptionW;
    if (p.solarHarvestW > peakSolarW) {
      peakSolarW = p.solarHarvestW;
      peakSolarHour = p.timeLabel;
    }
    if (p.batteryLevel < minBattery) minBattery = p.batteryLevel;
    if (p.batteryLevel > maxBattery) maxBattery = p.batteryLevel;
  });

  const netBalanceWh = Math.round((totalSolarWh - totalConsumedWh) * 10) / 10;
  const current = data[data.length - 1];
  const currentDrawW = current.consumptionW || 2.4;
  // Terminal battery pack assumed to be 100Wh total capacity
  const remainingWh = (current.batteryLevel / 100) * 100;
  const estimatedRemainingHours = Math.round((remainingWh / Math.max(0.8, currentDrawW)) * 10) / 10;
  const avgHourlyDrainRate = Math.round((totalConsumedWh / 24) * 10) / 10;
  const solarSelfSufficiencyPct = totalConsumedWh > 0 
    ? Math.round((totalSolarWh / totalConsumedWh) * 100) 
    : 100;

  return {
    totalSolarWh: Math.round(totalSolarWh * 10) / 10,
    totalConsumedWh: Math.round(totalConsumedWh * 10) / 10,
    netBalanceWh,
    peakSolarW,
    peakSolarHour,
    minBattery,
    maxBattery,
    avgHourlyDrainRate,
    estimatedRemainingHours,
    solarSelfSufficiencyPct,
  };
}
