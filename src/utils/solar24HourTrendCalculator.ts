import { BatteryManagerStatus } from '../types';
import { SolarDeviceProfile, getDefaultSolarDevices } from './solarAutonomyCalculator';

export type WeatherScenario = 'clear' | 'partly_cloudy' | 'overcast';

export interface HourlyEnergyTrendPoint {
  hour: number;
  timeLabel: string;
  isoTimestamp: number;
  solarIntakeW: number;
  consumptionW: number;
  netPowerW: number;
  batteryPercent: number;
  batteryEnergyWh: number;
  isCharging: boolean;
  solarIrradianceWm2: number;
  weatherCondition: string;
  daylightPhase: 'night' | 'dawn' | 'day' | 'peak' | 'dusk';
  energyPlanningNote: string;
}

export interface EnergyPlanningSummary {
  peakSolarHour: string;
  peakSolarW: number;
  totalHarvestedWh: number;
  totalConsumedWh: number;
  netEnergyBalanceWh: number;
  minBatteryPercent: number;
  minBatteryTime: string;
  maxBatteryPercent: number;
  maxBatteryTime: string;
  depthOfDischargePercent: number;
  selfSufficiencyRatio: number; // percentage e.g. 100%
  recommendedHighLoadWindow: string;
  energyPlanningStatus: 'optimal_surplus' | 'balanced' | 'deficit_warning' | 'critical_conservation';
  statusLabel: string;
  statusBadgeColor: string;
  planningAdvice: string[];
}

/**
 * Generates 24-hour historical telemetry points ending at the current time.
 */
export function generate24HourSolarTrend(
  device: SolarDeviceProfile,
  batteryStatus?: BatteryManagerStatus,
  scenario: WeatherScenario = 'partly_cloudy',
  baseReferenceDate: Date = new Date()
): { points: HourlyEnergyTrendPoint[]; summary: EnergyPlanningSummary } {
  const points: HourlyEnergyTrendPoint[] = [];
  const currentBatteryPct = batteryStatus?.batteryLevelPercent ?? device.currentBatteryPercent;
  const nominalCapacityWh = device.batteryCapacityWh;
  const peakPanelW = device.solarPanelPeakW;
  const baseConsumptionW = device.baseConsumptionW * (device.isEcoModeActive ? 0.65 : 1.0);

  // Weather scenario attenuation factor
  const weatherFactors: Record<WeatherScenario, { solarMultiplier: number; noiseScale: number; label: string }> = {
    clear: { solarMultiplier: 0.95, noiseScale: 0.05, label: 'Clear Sky' },
    partly_cloudy: { solarMultiplier: 0.78, noiseScale: 0.18, label: 'Variable Sunlight' },
    overcast: { solarMultiplier: 0.32, noiseScale: 0.12, label: 'Overcast & Drizzle' },
  };

  const weatherConfig = weatherFactors[scenario];
  const currentMillis = baseReferenceDate.getTime();

  // Step backwards 24 hours (24 points at 1-hour resolution)
  let simulatedEnergyWh = Math.min(
    nominalCapacityWh,
    (currentBatteryPct / 100) * nominalCapacityWh
  );

  // First pass: generate points backward from 24h ago to now
  const tempPoints: Omit<HourlyEnergyTrendPoint, 'batteryPercent' | 'batteryEnergyWh' | 'isCharging'>[] = [];

  for (let i = 24; i >= 0; i--) {
    const pointDate = new Date(currentMillis - i * 3600 * 1000);
    const hour = pointDate.getHours();
    const timeLabel = i === 0 ? 'Now' : `${hour.toString().padStart(2, '0')}:00`;

    // Solar curve computation based on time of day (sunrise ~06:00, peak ~13:00, sunset ~20:00)
    let solarIntakeW = 0;
    let irradianceWm2 = 0;
    let daylightPhase: HourlyEnergyTrendPoint['daylightPhase'] = 'night';
    let condition = 'Night';

    if (hour >= 6 && hour <= 20) {
      const peakHour = 13.0;
      const hoursFromPeak = Math.abs(hour - peakHour);
      const daylightSpan = 7.0; // 6 to 20 is +/- 7 hours from 13:00

      if (hoursFromPeak <= daylightSpan) {
        // Bell-like cosine insolation model
        const normalizedAngle = (hoursFromPeak / daylightSpan) * (Math.PI / 2);
        const solarIntensity = Math.max(0, Math.cos(normalizedAngle));

        // Pseudo-random pseudo-deterministic variation based on hour for realistic cloud dips
        const seedFactor = Math.sin(hour * 1.9 + (scenario === 'overcast' ? 2.5 : 0.8));
        const cloudDip = 1 - Math.max(0, seedFactor) * weatherConfig.noiseScale;

        solarIntakeW = Number((solarIntensity * peakPanelW * weatherConfig.solarMultiplier * cloudDip).toFixed(2));
        irradianceWm2 = Math.round(solarIntensity * 950 * cloudDip);

        if (hour < 8) {
          daylightPhase = 'dawn';
          condition = 'Dawn Inflow';
        } else if (hour > 18) {
          daylightPhase = 'dusk';
          condition = 'Dusk Horizon';
        } else if (hoursFromPeak < 2.5) {
          daylightPhase = 'peak';
          condition = weatherConfig.label;
        } else {
          daylightPhase = 'day';
          condition = weatherConfig.label;
        }
      }
    }

    // Dynamic mesh consumption variations (e.g. periodic mesh heartbeats & community sync bursts)
    const burstFactor = (hour % 4 === 0) ? 0.8 : (hour >= 9 && hour <= 17) ? 0.3 : 0.05;
    const hourlyConsumptionW = Number((baseConsumptionW + burstFactor).toFixed(2));
    const netPowerW = Number((solarIntakeW - hourlyConsumptionW).toFixed(2));

    let note = '';
    if (solarIntakeW > hourlyConsumptionW * 2) {
      note = 'Peak charging window. High-power packet relay safe.';
    } else if (solarIntakeW > hourlyConsumptionW) {
      note = 'Surplus solar intake. Battery buffering active.';
    } else if (solarIntakeW > 0) {
      note = 'Partial solar harvest. Extends battery runtime.';
    } else {
      note = 'Night discharge. Powering base BLE & LoRa routing.';
    }

    tempPoints.push({
      hour,
      timeLabel,
      isoTimestamp: pointDate.getTime(),
      solarIntakeW,
      consumptionW: hourlyConsumptionW,
      netPowerW,
      solarIrradianceWm2: irradianceWm2,
      weatherCondition: condition,
      daylightPhase,
      energyPlanningNote: note,
    });
  }

  // Forward pass to simulate battery charge state across the 24 hours
  // Estimate starting battery 24 hours ago so it ends approximately at currentBatteryPct
  let totalHarvestWh = 0;
  let totalConsumedWh = 0;
  tempPoints.forEach(p => {
    totalHarvestWh += p.solarIntakeW;
    totalConsumedWh += p.consumptionW;
  });

  const net24hWh = totalHarvestWh - totalConsumedWh;
  let runningEnergyWh = Math.min(
    nominalCapacityWh,
    Math.max(nominalCapacityWh * 0.25, simulatedEnergyWh - (net24hWh * 0.4))
  );

  tempPoints.forEach((p, idx) => {
    // Add net Wh for this hour
    runningEnergyWh = Math.min(
      nominalCapacityWh,
      Math.max(nominalCapacityWh * 0.08, runningEnergyWh + p.netPowerW)
    );

    // Pin final point to current battery percent if available
    const batteryPct = idx === tempPoints.length - 1
      ? currentBatteryPct
      : Math.min(100, Math.max(10, Math.round((runningEnergyWh / nominalCapacityWh) * 100)));

    points.push({
      ...p,
      batteryPercent: batteryPct,
      batteryEnergyWh: Number(runningEnergyWh.toFixed(1)),
      isCharging: p.solarIntakeW > p.consumptionW,
    });
  });

  // Calculate Energy Planning Summary
  let peakSolarW = 0;
  let peakSolarHour = '13:00';
  let minBatteryPct = 100;
  let minBatteryTime = '06:00';
  let maxBatteryPct = 0;
  let maxBatteryTime = '14:00';

  points.forEach((pt) => {
    if (pt.solarIntakeW > peakSolarW) {
      peakSolarW = pt.solarIntakeW;
      peakSolarHour = pt.timeLabel;
    }
    if (pt.batteryPercent < minBatteryPct) {
      minBatteryPct = pt.batteryPercent;
      minBatteryTime = pt.timeLabel;
    }
    if (pt.batteryPercent > maxBatteryPct) {
      maxBatteryPct = pt.batteryPercent;
      maxBatteryTime = pt.timeLabel;
    }
  });

  const depthOfDischarge = maxBatteryPct - minBatteryPct;
  const selfSufficiencyRatio = totalConsumedWh > 0
    ? Math.min(100, Math.round((totalHarvestWh / totalConsumedWh) * 100))
    : 100;

  let energyPlanningStatus: EnergyPlanningSummary['energyPlanningStatus'] = 'optimal_surplus';
  let statusLabel = 'Net Positive Energy Surplus';
  let statusBadgeColor = '#2A9D8F';

  if (selfSufficiencyRatio >= 150) {
    energyPlanningStatus = 'optimal_surplus';
    statusLabel = 'Exceptional Surplus (Lending Ready)';
    statusBadgeColor = '#2A9D8F';
  } else if (selfSufficiencyRatio >= 100) {
    energyPlanningStatus = 'balanced';
    statusLabel = '100% Solar Self-Sustaining';
    statusBadgeColor = '#588157';
  } else if (selfSufficiencyRatio >= 65) {
    energyPlanningStatus = 'deficit_warning';
    statusLabel = 'Partial Deficit (Conserving)';
    statusBadgeColor = '#E9C46A';
  } else {
    energyPlanningStatus = 'critical_conservation';
    statusLabel = 'Severe Deficit (Critical Throttling)';
    statusBadgeColor = '#E76F51';
  }

  const advice: string[] = [];
  if (energyPlanningStatus === 'optimal_surplus') {
    advice.push('Optimal window for bulk file replication and LoRa routing between 10:00 and 16:00.');
    advice.push('Solar intake exceeds total daily load by over 50%; safe to lend auxiliary 5V USB output to neighbors.');
    advice.push('Depth of discharge remained below 40%, ensuring long lithium battery cycle life (>2,500 cycles).');
  } else if (energyPlanningStatus === 'balanced') {
    advice.push('Battery consistently recovers to >90% during peak sun hours.');
    advice.push('Schedule large off-grid database synchronizations during the midday solar surge.');
    advice.push('Keep standard power profiles active; no emergency throttling required.');
  } else if (energyPlanningStatus === 'deficit_warning') {
    advice.push('Recommend enabling Solar-Aware Adaptive Throttling to reduce idle radio polling.');
    advice.push('Shift high-power map tile transfers to midday peak or wait for clearer skies.');
    advice.push('Ensure solar panel is angled south and cleaned of tree debris or dust.');
  } else {
    advice.push('Critical energy deficit detected. Immediate radio throttling recommended.');
    advice.push('Switch to BLE beacon-only mode and increase WorkManager intervals to 30 minutes.');
    advice.push('Relocate solar panel to an unobstructed clearing or deploy supplementary portable reflector.');
  }

  const summary: EnergyPlanningSummary = {
    peakSolarHour,
    peakSolarW,
    totalHarvestedWh: Number(totalHarvestWh.toFixed(1)),
    totalConsumedWh: Number(totalConsumedWh.toFixed(1)),
    netEnergyBalanceWh: Number((totalHarvestWh - totalConsumedWh).toFixed(1)),
    minBatteryPercent: minBatteryPct,
    minBatteryTime,
    maxBatteryPercent: maxBatteryPct,
    maxBatteryTime,
    depthOfDischargePercent: depthOfDischarge,
    selfSufficiencyRatio,
    recommendedHighLoadWindow: '10:00 - 15:30',
    energyPlanningStatus,
    statusLabel,
    statusBadgeColor,
    planningAdvice: advice,
  };

  return { points, summary };
}
