import { BatteryManagerStatus } from '../types';

export interface SolarDeviceProfile {
  id: string;
  name: string;
  category: 'terminal' | 'relay' | 'gateway' | 'sensor';
  description: string;
  batteryCapacityWh: number; // Watt-hours total
  nominalVoltageV: number;
  currentBatteryPercent: number; // 0 - 100
  solarPanelPeakW: number;
  currentHarvestW: number;
  baseConsumptionW: number;
  ecoConsumptionW: number;
  highLoadConsumptionW: number;
  isEcoModeActive?: boolean;
  location?: string;
  hardware?: string;
}

export interface SolarAutonomyEstimate {
  deviceId: string;
  deviceName: string;
  batteryPercent: number;
  batteryCapacityWh: number;
  remainingEnergyWh: number;
  currentConsumptionW: number;
  currentHarvestW: number;
  netPowerW: number; // Positive = draining battery, Negative = charging battery
  isSurplus: boolean;
  isSelfSustaining: boolean;
  
  timeToEmptyHours: number | null; // null if self-sustaining or charging
  timeToEmptyFormatted: string;
  depletionTimestamp: number | null;
  depletionTimeFormatted: string | null;
  
  nightAutonomyHours: number; // Time until empty if solar harvest drops to 0W
  nightAutonomyFormatted: string;
  
  timeToFullHours: number | null;
  timeToFullFormatted: string | null;
  
  autonomyStatus: 'critical' | 'warning' | 'stable' | 'optimal' | 'surplus';
  statusLabel: string;
  statusRecommendation: string;
}

/**
 * Format decimal hours into a concise, human-readable string (e.g. "6h 45m" or "2d 4h")
 */
export function formatHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0m';
  }
  
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return `${days}d ${remHours}h`;
  }
  
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  
  if (h === 0) {
    return `${Math.max(1, m)}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/**
 * Formats estimated depletion timestamp relative to a target hour
 */
export function formatDepletionTime(hoursRemaining: number, baseTimestamp: number = Date.now()): string {
  if (!Number.isFinite(hoursRemaining) || hoursRemaining <= 0) {
    return 'Immediate';
  }
  
  const targetDate = new Date(baseTimestamp + hoursRemaining * 3600 * 1000);
  const nowDate = new Date(baseTimestamp);
  
  const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Same day
  if (targetDate.toDateString() === nowDate.toDateString()) {
    return `Today at ${timeStr}`;
  }
  
  // Tomorrow
  const tomorrow = new Date(baseTimestamp + 24 * 3600 * 1000);
  if (targetDate.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${timeStr}`;
  }
  
  // Future date
  const dayStr = targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dayStr} at ${timeStr}`;
}

/**
 * Core calculation of Solar Autonomy and Time-to-Empty
 */
export function calculateSolarAutonomy(
  device: SolarDeviceProfile,
  overrideHarvestW?: number,
  overrideConsumptionW?: number
): SolarAutonomyEstimate {
  const currentHarvest = Math.max(
    0,
    overrideHarvestW !== undefined ? overrideHarvestW : device.currentHarvestW
  );
  
  const defaultConsumption = device.isEcoModeActive
    ? device.ecoConsumptionW
    : device.baseConsumptionW;
    
  const currentConsumption = Math.max(
    0.05,
    overrideConsumptionW !== undefined ? overrideConsumptionW : defaultConsumption
  );

  const batteryPercent = Math.min(100, Math.max(0, device.currentBatteryPercent));
  const remainingEnergyWh = Number(
    ((device.batteryCapacityWh * batteryPercent) / 100).toFixed(2)
  );
  
  // Net power: Positive = discharging, Negative = charging surplus
  const netPowerW = Number((currentConsumption - currentHarvest).toFixed(2));
  const isSurplus = netPowerW <= 0;
  const isSelfSustaining = isSurplus;
  
  // Night-fall zero solar autonomy
  const nightAutonomyHours = Number((remainingEnergyWh / currentConsumption).toFixed(2));
  const nightAutonomyFormatted = formatHoursMinutes(nightAutonomyHours);
  
  let timeToEmptyHours: number | null = null;
  let timeToEmptyFormatted = '∞ Self-Sustaining';
  let depletionTimestamp: number | null = null;
  let depletionTimeFormatted: string | null = null;
  
  let timeToFullHours: number | null = null;
  let timeToFullFormatted: string | null = null;
  
  if (!isSurplus && netPowerW > 0) {
    timeToEmptyHours = Number((remainingEnergyWh / netPowerW).toFixed(2));
    timeToEmptyFormatted = formatHoursMinutes(timeToEmptyHours);
    depletionTimestamp = Date.now() + timeToEmptyHours * 3600 * 1000;
    depletionTimeFormatted = formatDepletionTime(timeToEmptyHours);
  } else if (isSurplus) {
    const chargeRateW = Math.abs(netPowerW);
    const deficitWh = device.batteryCapacityWh - remainingEnergyWh;
    if (deficitWh > 0.05 && chargeRateW > 0.1) {
      timeToFullHours = Number((deficitWh / chargeRateW).toFixed(2));
      timeToFullFormatted = `${formatHoursMinutes(timeToFullHours)} to 100%`;
    } else {
      timeToFullFormatted = 'Fully Charged';
    }
  }
  
  // Autonomy health evaluation
  let autonomyStatus: SolarAutonomyEstimate['autonomyStatus'] = 'stable';
  let statusLabel = 'Stable Autonomy';
  let statusRecommendation = 'Consumption is balanced with solar reserve.';
  
  if (isSelfSustaining) {
    autonomyStatus = 'surplus';
    statusLabel = 'Positive Energy Balance';
    statusRecommendation = `Harvesting +${currentHarvest.toFixed(1)}W with ${currentConsumption.toFixed(1)}W load. Surplus energy is charging battery.`;
  } else if (timeToEmptyHours !== null) {
    if (timeToEmptyHours < 2.0 || batteryPercent < 15) {
      autonomyStatus = 'critical';
      statusLabel = 'Critical Battery Depletion';
      statusRecommendation = 'Engage Solar-Aware eco mode immediately or reposition solar panel towards sunlight.';
    } else if (timeToEmptyHours < 6.0) {
      autonomyStatus = 'warning';
      statusLabel = 'Limited Runtime';
      statusRecommendation = 'Battery will deplete before midnight unless load is reduced or sun recovers.';
    } else if (timeToEmptyHours >= 18.0) {
      autonomyStatus = 'optimal';
      statusLabel = 'Extended Reserve';
      statusRecommendation = 'Sufficient reserve to comfortably bridge overnight hours until morning sunrise.';
    } else {
      autonomyStatus = 'stable';
      statusLabel = 'Standard Autonomy';
      statusRecommendation = 'Normal discharge curve; monitor evening packet traffic.';
    }
  }

  return {
    deviceId: device.id,
    deviceName: device.name,
    batteryPercent,
    batteryCapacityWh: device.batteryCapacityWh,
    remainingEnergyWh,
    currentConsumptionW: Number(currentConsumption.toFixed(2)),
    currentHarvestW: Number(currentHarvest.toFixed(2)),
    netPowerW,
    isSurplus,
    isSelfSustaining,
    timeToEmptyHours,
    timeToEmptyFormatted,
    depletionTimestamp,
    depletionTimeFormatted,
    nightAutonomyHours,
    nightAutonomyFormatted,
    timeToFullHours,
    timeToFullFormatted,
    autonomyStatus,
    statusLabel,
    statusRecommendation,
  };
}

/**
 * Returns preset list of current solar-powered devices in the local mesh network,
 * synchronized with active terminal status.
 */
export function getDefaultSolarDevices(batteryStatus?: BatteryManagerStatus): SolarDeviceProfile[] {
  const terminalBatteryPct = batteryStatus?.batteryLevelPercent ?? 88;
  const terminalHarvestW = batteryStatus?.solarHarvestRateW ?? (batteryStatus?.isSolarAwareActive ? 14.8 : 0);
  const terminalIsEco = batteryStatus?.isSolarAwareActive ?? false;

  return [
    {
      id: 'field-terminal',
      name: 'Field Terminal (This Device)',
      category: 'terminal',
      description: 'Your handheld off-grid terminal running HÕIMU mesh node and BLE beaconing.',
      batteryCapacityWh: 18.5, // 5000mAh @ 3.7V
      nominalVoltageV: 3.7,
      currentBatteryPercent: terminalBatteryPct,
      solarPanelPeakW: 20.0,
      currentHarvestW: terminalHarvestW,
      baseConsumptionW: 2.4, // Screen + BLE beacon + MCU
      ecoConsumptionW: 1.1,  // 0.5Hz radar + BLE only
      highLoadConsumptionW: 5.6, // Wi-Fi Direct sync bursts
      isEcoModeActive: terminalIsEco,
      location: 'Local Operator Pocket / Field Kit',
      hardware: 'Nordic nRF52840 + SX1262 LoRa HAT',
    },
    {
      id: 'repeater-hilltop',
      name: 'Hilltop Solar LoRa Repeater (Koidu-868)',
      category: 'relay',
      description: 'Autonomous high-ground 868MHz relay node forwarding packets across valleys.',
      batteryCapacityWh: 100.0, // 25Ah @ 3.2V LiFePO4
      nominalVoltageV: 3.2,
      currentBatteryPercent: 92,
      solarPanelPeakW: 35.0,
      currentHarvestW: terminalHarvestW > 0 ? 22.4 : 0,
      baseConsumptionW: 1.85,
      ecoConsumptionW: 0.95,
      highLoadConsumptionW: 4.2,
      isEcoModeActive: false,
      location: 'Koidu Hilltop Mast (Elevation +124m)',
      hardware: 'RAK Wireless WisBlock + 35W Monocrystal Panel',
    },
    {
      id: 'gateway-pibridge',
      name: 'Pi 4 Micro-Bridge Gateway',
      category: 'gateway',
      description: 'Local microserver caching bioregional maps, emergency manuals, and long-range LoRa bridge.',
      batteryCapacityWh: 54.0, // 14,600mAh battery pack
      nominalVoltageV: 5.1,
      currentBatteryPercent: 76,
      solarPanelPeakW: 40.0,
      currentHarvestW: terminalHarvestW > 0 ? 26.5 : 0,
      baseConsumptionW: 5.2,
      ecoConsumptionW: 3.1,
      highLoadConsumptionW: 8.9,
      isEcoModeActive: false,
      location: 'Community Barn South Wall',
      hardware: 'Raspberry Pi 4B + Waveshare LoRa HAT + MPPT Solar Controller',
    },
    {
      id: 'forest-relay',
      name: 'Tree-Canopy Relay (Mets-04)',
      category: 'relay',
      description: 'Camouflaged weather-sealed mesh router deployed in Scots pine canopy.',
      batteryCapacityWh: 22.0, // Dual 18650 Li-ion
      nominalVoltageV: 3.7,
      currentBatteryPercent: 81,
      solarPanelPeakW: 12.0,
      currentHarvestW: terminalHarvestW > 0 ? 7.8 : 0,
      baseConsumptionW: 0.85,
      ecoConsumptionW: 0.42,
      highLoadConsumptionW: 2.1,
      isEcoModeActive: true,
      location: 'Pine Grove Grid 4C',
      hardware: 'Heltec Wireless Tracker v3 + 12W ETFE Panel',
    },
    {
      id: 'sensor-well',
      name: 'Community Water Well Telemetry Node',
      category: 'sensor',
      description: 'Solar-powered aquifer depth and drinking water purification telemetry probe.',
      batteryCapacityWh: 12.5, // 3,400mAh Li-ion
      nominalVoltageV: 3.7,
      currentBatteryPercent: 95,
      solarPanelPeakW: 6.0,
      currentHarvestW: terminalHarvestW > 0 ? 4.2 : 0,
      baseConsumptionW: 0.32,
      ecoConsumptionW: 0.18,
      highLoadConsumptionW: 0.95,
      isEcoModeActive: false,
      location: 'Spring Wellhead South',
      hardware: 'ESP32-S3 + Hydrostatic Level Sensor + 6W Micro Panel',
    },
  ];
}
