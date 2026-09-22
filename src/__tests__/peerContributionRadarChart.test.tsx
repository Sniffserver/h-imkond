import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { calculatePeerContribution } from '../utils/peerContributionCalculator';
import { PeerContributionRadarChart } from '../components/PeerContributionRadarChart';
import { PeerDetailBottomSheet } from '../components/PeerDetailBottomSheet';
import { ReputationBreakdownDialog } from '../components/ReputationBreakdownDialog';
import { MeshNode } from '../types';

describe('calculatePeerContribution utility', () => {
  const samplePeer: MeshNode = {
    id: 'peer-tartu-1',
    callsign: 'TARTU-SOLAR',
    bio: 'Community microgrid engineer and seed library steward.',
    skills: ['Solar PV', 'Seed Saving', 'Antenna Tuning', 'Composting'],
    lastRssi: -58,
    hopDistance: 1,
    lastSeen: 'Just now',
    trustScore: 92,
    completedExchanges: 14,
    relayReliability: 98.7,
    isDirect: true,
    connectionState: 'direct',
    avatarSeed: 'seed-tartu',
    recentInteractions: [95, 98, 97, 99],
    angle: 45,
    distanceRatio: 0.3,
    relayedPackets: 160,
  };

  it('calculates verified skills, successful trades, and mesh connectivity reliability', () => {
    const result = calculatePeerContribution(samplePeer);

    expect(result.peerId).toBe('peer-tartu-1');
    expect(result.callsign).toBe('TARTU-SOLAR');
    expect(result.metrics.length).toBe(5);

    // Verified Skills
    const skillsMetric = result.metrics.find((m) => m.key === 'skills');
    expect(skillsMetric).toBeDefined();
    expect(skillsMetric?.metric).toBe('Verified Skills');
    expect(skillsMetric?.rawValue).toBe(4);
    expect(skillsMetric?.score).toBe(88);

    // Successful Trades
    const tradesMetric = result.metrics.find((m) => m.key === 'trades');
    expect(tradesMetric).toBeDefined();
    expect(tradesMetric?.metric).toBe('Successful Trades');
    expect(tradesMetric?.rawValue).toBe(14);
    expect(tradesMetric?.score).toBe(88);

    // Mesh Reliability
    const meshMetric = result.metrics.find((m) => m.key === 'reliability');
    expect(meshMetric).toBeDefined();
    expect(meshMetric?.metric).toBe('Mesh Reliability');
    expect(meshMetric?.rawValue).toBe('98.7%');
    expect(meshMetric?.score).toBe(99);

    // Composite Index & Tier
    expect(result.compositeContributionScore).toBeGreaterThanOrEqual(85);
    expect(result.contributionTier).toBe('Bioregional Anchor');
  });

  it('handles emerging nodes with zero or sparse history gracefully', () => {
    const freshPeer: MeshNode = {
      id: 'peer-fresh',
      callsign: 'NOVICE-NODE',
      bio: 'New explorer',
      skills: [],
      lastRssi: -82,
      hopDistance: 2,
      lastSeen: '10m ago',
      trustScore: 50,
      completedExchanges: 0,
      relayReliability: 75.0,
      isDirect: false,
      connectionState: 'relayed',
      avatarSeed: 'seed-novice',
      recentInteractions: [],
      angle: 120,
      distanceRatio: 0.8,
    };

    const result = calculatePeerContribution(freshPeer);
    expect(result.metrics.find((m) => m.key === 'skills')?.score).toBe(15);
    expect(result.metrics.find((m) => m.key === 'trades')?.score).toBe(15);
    expect(result.metrics.find((m) => m.key === 'reliability')?.score).toBe(75);
    expect(result.contributionTier).toBe('Reliable Node');
  });
});

describe('PeerContributionRadarChart UI component', () => {
  const samplePeer: MeshNode = {
    id: 'peer-elva-7',
    callsign: 'ELVA-PERMACULTURE',
    bio: 'Greywater recycling and LoRa mesh relay',
    skills: ['Greywater', 'LoRa', 'Mushroom Cultivation'],
    lastRssi: -64,
    hopDistance: 1,
    lastSeen: '2m ago',
    trustScore: 88,
    completedExchanges: 9,
    relayReliability: 96.5,
    isDirect: true,
    connectionState: 'direct',
    avatarSeed: 'seed-elva',
    recentInteractions: [90, 92, 95],
    angle: 90,
    distanceRatio: 0.4,
  };

  it('renders contribution radar chart with tier, composite score, and metric badges', () => {
    const { container } = render(<PeerContributionRadarChart peer={samplePeer} />);

    expect(screen.getByText('Community Contribution Radar')).toBeDefined();
    expect(screen.getByText('Community Standing')).toBeDefined();
    expect(screen.getByText('Composite Index')).toBeDefined();

    // Verify key metrics exist
    expect(container.querySelector('#metric-pill-skills')).not.toBeNull();
    expect(container.querySelector('#metric-pill-trades')).not.toBeNull();
    expect(container.querySelector('#metric-pill-reliability')).not.toBeNull();
  });

  it('allows clicking metric cards to inspect detailed breakdown', () => {
    const { container } = render(<PeerContributionRadarChart peer={samplePeer} />);

    const tradesPill = container.querySelector('#metric-pill-trades');
    expect(tradesPill).not.toBeNull();

    fireEvent.click(tradesPill!);

    // Summary capsule should update to describe the trades metric
    expect(screen.getByText(/confirmed mutual aid resource exchanges/i)).toBeDefined();
  });

  it('renders within PeerDetailBottomSheet', () => {
    const handleClose = vi.fn();
    const handleOpenRep = vi.fn();
    const handleOpenChat = vi.fn();

    render(
      <PeerDetailBottomSheet
        peer={samplePeer}
        onClose={handleClose}
        onOpenReputation={handleOpenRep}
        onOpenChat={handleOpenChat}
      />
    );

    expect(screen.getAllByText('ELVA-PERMACULTURE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Community Contribution Radar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Private Local Notes')).toBeDefined();
  });

  it('renders within ReputationBreakdownDialog in compact mode', () => {
    const handleClose = vi.fn();

    render(
      <ReputationBreakdownDialog
        peer={samplePeer}
        onClose={handleClose}
      />
    );

    expect(screen.getAllByText('ELVA-PERMACULTURE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Community Contribution Radar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Observed Relay Reliability')).toBeDefined();
  });
});
