import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  formatHoursMinutes,
  formatDepletionTime,
  calculateSolarAutonomy,
  getDefaultSolarDevices,
  SolarDeviceProfile,
} from '../utils/solarAutonomyCalculator';
import { SolarDeviceTimeToEmptyWidget } from '../components/SolarDeviceTimeToEmptyWidget';
import { BatteryManagerStatus } from '../types';

describe('solarAutonomyCalculator unit tests', () => {
  it('formats hours and minutes accurately', () => {
    expect(formatHoursMinutes(0)).toBe('0m');
    expect(formatHoursMinutes(0.5)).toBe('30m');
    expect(formatHoursMinutes(1.0)).toBe('1h');
    expect(formatHoursMinutes(2.25)).toBe('2h 15m');
    expect(formatHoursMinutes(24)).toBe('1d 0h');
    expect(formatHoursMinutes(30.5)).toBe('1d 7h');
  });

  it('formats future depletion time correctly', () => {
    const fixedNow = new Date('2026-09-21T12:00:00Z').getTime();
    const formatted = formatDepletionTime(4, fixedNow);
    expect(formatted).toContain(':00');
  });

  it('calculates discharging time-to-empty when load exceeds harvest', () => {
    const testDevice: SolarDeviceProfile = {
      id: 'test-device',
      name: 'Test Field Unit',
      category: 'terminal',
      description: 'Testing unit',
      batteryCapacityWh: 20.0,
      nominalVoltageV: 3.7,
      currentBatteryPercent: 50, // 10 Wh remaining
      solarPanelPeakW: 10,
      currentHarvestW: 0, // No sun
      baseConsumptionW: 2.0, // 2W load
      ecoConsumptionW: 1.0,
      highLoadConsumptionW: 4.0,
    };

    const result = calculateSolarAutonomy(testDevice);

    expect(result.remainingEnergyWh).toBe(10.0);
    expect(result.netPowerW).toBe(2.0);
    expect(result.isSurplus).toBe(false);
    expect(result.isSelfSustaining).toBe(false);
    // 10 Wh / 2W = 5 hours
    expect(result.timeToEmptyHours).toBe(5.0);
    expect(result.timeToEmptyFormatted).toBe('5h');
    expect(result.autonomyStatus).toBe('warning');
  });

  it('calculates self-sustaining state when solar generation exceeds load', () => {
    const testDevice: SolarDeviceProfile = {
      id: 'test-device-surplus',
      name: 'Test Solar Unit',
      category: 'terminal',
      description: 'Surplus unit',
      batteryCapacityWh: 20.0,
      nominalVoltageV: 3.7,
      currentBatteryPercent: 50, // 10 Wh remaining
      solarPanelPeakW: 15,
      currentHarvestW: 12.0, // 12W sun
      baseConsumptionW: 2.0, // 2W load
      ecoConsumptionW: 1.0,
      highLoadConsumptionW: 4.0,
    };

    const result = calculateSolarAutonomy(testDevice);

    expect(result.netPowerW).toBe(-10.0); // 2W - 12W = -10W net
    expect(result.isSurplus).toBe(true);
    expect(result.isSelfSustaining).toBe(true);
    expect(result.timeToEmptyHours).toBeNull();
    expect(result.timeToEmptyFormatted).toBe('∞ Self-Sustaining');
    expect(result.autonomyStatus).toBe('surplus');
    // Time to 100% full: 10 Wh deficit / 10W net charging = 1.0 hour
    expect(result.timeToFullHours).toBe(1.0);
    expect(result.timeToFullFormatted).toContain('1h to 100%');
  });

  it('extends autonomy when eco mode is enabled', () => {
    const testDevice: SolarDeviceProfile = {
      id: 'test-device-eco',
      name: 'Eco Test Unit',
      category: 'terminal',
      description: 'Testing eco mode',
      batteryCapacityWh: 20.0,
      nominalVoltageV: 3.7,
      currentBatteryPercent: 50, // 10 Wh remaining
      solarPanelPeakW: 10,
      currentHarvestW: 0,
      baseConsumptionW: 2.0,
      ecoConsumptionW: 1.0,
      highLoadConsumptionW: 4.0,
      isEcoModeActive: true,
    };

    const result = calculateSolarAutonomy(testDevice);
    // 10 Wh / 1.0W = 10 hours
    expect(result.currentConsumptionW).toBe(1.0);
    expect(result.timeToEmptyHours).toBe(10.0);
    expect(result.timeToEmptyFormatted).toBe('10h');
  });

  it('returns default devices calibrated with live battery status', () => {
    const mockStatus: BatteryManagerStatus = {
      isSolarAwareActive: true,
      hasSolarPanels: true,
      wifiDirectSyncEnabled: false,
      workManagerIntervalMinutes: 15,
      bleBeaconOnly: false,
      radarRefreshRateHz: 0.5,
      solarHarvestRateW: 16.5,
      batteryLevelPercent: 91,
    };

    const devices = getDefaultSolarDevices(mockStatus);
    expect(devices.length).toBeGreaterThanOrEqual(4);
    
    const terminal = devices.find((d) => d.id === 'field-terminal');
    expect(terminal).toBeDefined();
    expect(terminal?.currentBatteryPercent).toBe(91);
    expect(terminal?.currentHarvestW).toBe(16.5);
    expect(terminal?.isEcoModeActive).toBe(true);
  });
});

describe('SolarDeviceTimeToEmptyWidget UI component', () => {
  const mockStatus: BatteryManagerStatus = {
    isSolarAwareActive: false,
    hasSolarPanels: false,
    wifiDirectSyncEnabled: true,
    workManagerIntervalMinutes: 5,
    bleBeaconOnly: false,
    radarRefreshRateHz: 2.0,
    solarHarvestRateW: 0,
    batteryLevelPercent: 88,
  };

  it('renders dashboard variant with time-to-empty readout and controls', () => {
    const handleExpand = vi.fn();
    render(
      <SolarDeviceTimeToEmptyWidget
        batteryStatus={mockStatus}
        variant="dashboard"
        onExpand={handleExpand}
      />
    );

    expect(screen.getByText('Time-to-Empty Estimator')).toBeDefined();
    expect(screen.getByText('Estimated Time to Empty')).toBeDefined();
    expect(screen.getByText('Field Terminal')).toBeDefined();

    const expandBtn = screen.getByTitle('Open Full Solar Device Autonomy Simulator');
    fireEvent.click(expandBtn);
    expect(handleExpand).toHaveBeenCalledTimes(1);
  });

  it('renders full variant with device tabs, sliders, and night stress test', () => {
    const handleToggleSolarAware = vi.fn();
    render(
      <SolarDeviceTimeToEmptyWidget
        batteryStatus={mockStatus}
        variant="full"
        onToggleSolarAware={handleToggleSolarAware}
      />
    );

    expect(screen.getByText('Solar Device Autonomy & Time-to-Empty')).toBeDefined();
    expect(screen.getByText('Power Simulation Controls')).toBeDefined();

    // Night Simulation button
    const nightSimBtn = screen.getByText('Night Simulation (0W)');
    fireEvent.click(nightSimBtn);

    // Hardware info
    expect(screen.getByText(/Nordic nRF52840/)).toBeDefined();

    // Solar Aware action button
    const solarAwareBtn = screen.getByText(/Engage Solar-Aware Throttling/);
    fireEvent.click(solarAwareBtn);
    expect(handleToggleSolarAware).toHaveBeenCalledTimes(1);
  });

  it('applies subtle pulse animation to widget background when solar intake exceeds consumption (battery charging)', () => {
    const surplusStatus: BatteryManagerStatus = {
      isSolarAwareActive: true,
      hasSolarPanels: true,
      wifiDirectSyncEnabled: true,
      workManagerIntervalMinutes: 5,
      bleBeaconOnly: false,
      radarRefreshRateHz: 2.0,
      solarHarvestRateW: 25.0, // High solar intake > consumption
      batteryLevelPercent: 75,
    };

    const { container, rerender } = render(
      <SolarDeviceTimeToEmptyWidget
        batteryStatus={surplusStatus}
        variant="dashboard"
        isNightMode={false}
      />
    );

    const widget = container.querySelector('#solar-time-to-empty-dashboard-widget');
    expect(widget).not.toBeNull();
    // Verify pulse animation class is applied
    expect(widget?.className).toContain('animate-solar-charge-pulse-light');

    // Verify charging status badge
    expect(screen.getByText('CHARGING')).toBeDefined();

    // Verify dark mode pulse class
    rerender(
      <SolarDeviceTimeToEmptyWidget
        batteryStatus={surplusStatus}
        variant="dashboard"
        isNightMode={true}
      />
    );
    expect(widget?.className).toContain('animate-solar-charge-pulse-dark');
  });

  it('does not pulse when consumption exceeds intake or harvest is 0', () => {
    const drainingStatus: BatteryManagerStatus = {
      isSolarAwareActive: false,
      hasSolarPanels: false,
      wifiDirectSyncEnabled: true,
      workManagerIntervalMinutes: 5,
      bleBeaconOnly: false,
      radarRefreshRateHz: 2.0,
      solarHarvestRateW: 0, // No solar intake
      batteryLevelPercent: 40,
    };

    const { container } = render(
      <SolarDeviceTimeToEmptyWidget
        batteryStatus={drainingStatus}
        variant="dashboard"
        isNightMode={false}
      />
    );

    const widget = container.querySelector('#solar-time-to-empty-dashboard-widget');
    expect(widget).not.toBeNull();
    expect(widget?.className).not.toContain('animate-solar-charge-pulse-light');
    expect(widget?.className).not.toContain('animate-solar-charge-pulse-dark');
    expect(container.querySelector('#solar-charging-indicator-badge')).toBeNull();
  });
});
