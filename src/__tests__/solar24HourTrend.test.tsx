import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  generate24HourSolarTrend,
  HourlyEnergyTrendPoint,
  EnergyPlanningSummary,
} from '../utils/solar24HourTrendCalculator';
import { Solar24HourTrendChart } from '../components/Solar24HourTrendChart';
import { getDefaultSolarDevices } from '../utils/solarAutonomyCalculator';
import { BatteryManagerStatus } from '../types';

describe('solar24HourTrendCalculator', () => {
  const mockStatus: BatteryManagerStatus = {
    isSolarAwareActive: false,
    hasSolarPanels: true,
    wifiDirectSyncEnabled: true,
    workManagerIntervalMinutes: 5,
    bleBeaconOnly: false,
    radarRefreshRateHz: 2.0,
    solarHarvestRateW: 14.5,
    batteryLevelPercent: 82,
  };

  const devices = getDefaultSolarDevices(mockStatus);
  const terminal = devices[0]; // Field Terminal

  it('generates 25 hourly points covering 24-hour historical window', () => {
    const { points, summary } = generate24HourSolarTrend(terminal, mockStatus, 'partly_cloudy');
    expect(points.length).toBe(25);
    expect(points[points.length - 1].timeLabel).toBe('Now');

    // Solar intake is 0 or low at midnight and peaks around midday
    const daytimePoints = points.filter((p) => p.hour >= 11 && p.hour <= 15);
    const nightPoints = points.filter((p) => p.hour >= 1 && p.hour <= 4);

    daytimePoints.forEach((p) => {
      expect(p.solarIntakeW).toBeGreaterThan(0);
    });

    nightPoints.forEach((p) => {
      expect(p.solarIntakeW).toBe(0);
    });
  });

  it('computes realistic energy planning summary metrics', () => {
    const { summary } = generate24HourSolarTrend(terminal, mockStatus, 'partly_cloudy');
    expect(summary.peakSolarW).toBeGreaterThan(0);
    expect(summary.totalHarvestedWh).toBeGreaterThan(0);
    expect(summary.totalConsumedWh).toBeGreaterThan(0);
    expect(summary.minBatteryPercent).toBeGreaterThanOrEqual(10);
    expect(summary.maxBatteryPercent).toBeLessThanOrEqual(100);
    expect(summary.depthOfDischargePercent).toBeGreaterThanOrEqual(0);
    expect(summary.selfSufficiencyRatio).toBeGreaterThan(0);
    expect(summary.planningAdvice.length).toBeGreaterThan(0);
    expect(summary.statusLabel).toBeDefined();
  });

  it('reflects weather scenario changes (clear vs overcast)', () => {
    const clearResult = generate24HourSolarTrend(terminal, mockStatus, 'clear');
    const overcastResult = generate24HourSolarTrend(terminal, mockStatus, 'overcast');

    expect(clearResult.summary.totalHarvestedWh).toBeGreaterThan(overcastResult.summary.totalHarvestedWh);
    expect(clearResult.summary.peakSolarW).toBeGreaterThan(overcastResult.summary.peakSolarW);
  });
});

describe('Solar24HourTrendChart component', () => {
  const mockStatus: BatteryManagerStatus = {
    isSolarAwareActive: true,
    hasSolarPanels: true,
    wifiDirectSyncEnabled: true,
    workManagerIntervalMinutes: 5,
    bleBeaconOnly: false,
    radarRefreshRateHz: 2.0,
    solarHarvestRateW: 16.0,
    batteryLevelPercent: 78,
  };

  it('renders chart title, energy planning cards, and controls', () => {
    const handleSelectDevice = vi.fn();
    render(
      <Solar24HourTrendChart
        batteryStatus={mockStatus}
        onSelectDevice={handleSelectDevice}
        isNightMode={false}
      />
    );

    // Title & subtitle
    expect(screen.getByText('Solar Intake vs. Battery Charge Trend')).toBeDefined();
    expect(screen.getByText(/24-hour diurnal insolation curve/)).toBeDefined();

    // Planning matrix cards
    expect(screen.getByText('Peak Solar Power')).toBeDefined();
    expect(screen.getByText('24h Net Balance')).toBeDefined();
    expect(screen.getByText('Battery Diurnal Swing')).toBeDefined();
    expect(screen.getByText('Autonomy Index')).toBeDefined();

    // Recommendations section
    expect(screen.getByText('Bioregional Energy Planning Recommendations')).toBeDefined();

    // Scenario buttons
    expect(screen.getByTitle('Simulate peak clear sunlight conditions')).toBeDefined();
    expect(screen.getByTitle('Simulate typical variable cloud cover')).toBeDefined();
    expect(screen.getByTitle('Simulate overcast weather stress-test')).toBeDefined();

    // Toggles
    const solarToggle = screen.getByText('Solar Intake (W)');
    const batteryToggle = screen.getByText('Battery Charge (%)');
    expect(solarToggle).toBeDefined();
    expect(batteryToggle).toBeDefined();

    // Click toggles without crashing
    fireEvent.click(solarToggle);
    fireEvent.click(batteryToggle);
  });

  it('switches weather scenarios when buttons are clicked', () => {
    const { container } = render(<Solar24HourTrendChart batteryStatus={mockStatus} isNightMode={true} />);

    const overcastBtn = container.querySelector('#scenario-btn-overcast') as HTMLElement;
    expect(overcastBtn).not.toBeNull();
    fireEvent.click(overcastBtn);

    const clearBtn = container.querySelector('#scenario-btn-clear') as HTMLElement;
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn);
  });

  it('allows selecting different devices in the device tabs', () => {
    const handleSelectDevice = vi.fn();
    const { container } = render(
      <Solar24HourTrendChart
        batteryStatus={mockStatus}
        onSelectDevice={handleSelectDevice}
      />
    );

    // Click Hilltop Solar LoRa Repeater tab chip
    const repeaterChip = container.querySelector('#trend-device-chip-repeater-hilltop') as HTMLElement;
    expect(repeaterChip).not.toBeNull();
    fireEvent.click(repeaterChip);
    expect(handleSelectDevice).toHaveBeenCalledWith('repeater-hilltop');
  });
});
