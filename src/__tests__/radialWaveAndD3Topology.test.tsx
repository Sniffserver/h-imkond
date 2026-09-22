import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineRadarCanvas } from '../components/OfflineRadarCanvas';
import { D3MeshTopologyMap } from '../features/map/components/D3MeshTopologyMap';
import { MapScreen } from '../features/map/MapScreen';
import { MeshNode, UserProfile } from '../types';

const mockUser: UserProfile = {
  id: 'user_self',
  callsign: 'Kestrel-7',
  bio: 'Sovereign mesh node runner',
  skills: ['Solar Power', 'Packet Radio'],
  offeredResources: ['LiFePO4 Welding', 'Solar Inverters'],
  symbiosisScore: 85,
  completedExchanges: 12,
  meshVisible: true,
  avatarSeed: 'user-seed-7',
  symbiosisHistory: [{ date: '2026-01-01', score: 85 }],
};

const mockPeers: MeshNode[] = [
  {
    id: 'peer_1',
    callsign: 'Fern-Spire',
    bio: 'Permaculture and solar battery tech',
    skills: ['Solar', 'Gardening'],
    lastRssi: -58,
    hopDistance: 1,
    lastSeen: '1m ago',
    trustScore: 88,
    completedExchanges: 9,
    relayReliability: 98.2,
    isDirect: true,
    connectionState: 'direct',
    avatarSeed: 'fern-1',
    recentInteractions: [1, 2],
    angle: 45,
    distanceRatio: 0.35,
    radioType: 'BLE',
    linkQualityPercent: 88,
  },
  {
    id: 'peer_2',
    callsign: 'Birch-Ridge',
    bio: 'LoRa repeater station operator',
    skills: ['LoRa', 'Hardware'],
    lastRssi: -78,
    hopDistance: 2,
    lastSeen: '3m ago',
    trustScore: 75,
    completedExchanges: 4,
    relayReliability: 94.0,
    isDirect: false,
    connectionState: 'relayed',
    avatarSeed: 'birch-2',
    recentInteractions: [3],
    angle: 180,
    distanceRatio: 0.72,
    radioType: 'Wi-Fi Direct',
    linkQualityPercent: 65,
  },
];

describe('Radial Wave Animation and D3 Topology Suite', () => {
  beforeEach(() => {
    // Mock ResizeObserver for container measurement in jsdom
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  describe('Feature 1: Radial Wave Animation in Scanning UI', () => {
    it('renders OfflineRadarCanvas with passive state when isScanning is false', () => {
      const onSelectPeer = vi.fn();
      render(
        <OfflineRadarCanvas
          peers={mockPeers}
          onSelectPeer={onSelectPeer}
          isSolarAware={false}
          isNightMode={false}
          isScanning={false}
        />
      );

      expect(screen.queryByText(/RADIAL WAVE DISCOVERY ACTIVE/i)).toBeNull();
    });

    it('renders prominent radial wave discovery banner and active ring pulse when isScanning is true', () => {
      const onSelectPeer = vi.fn();
      render(
        <OfflineRadarCanvas
          peers={mockPeers}
          onSelectPeer={onSelectPeer}
          isSolarAware={false}
          isNightMode={false}
          isScanning={true}
        />
      );

      expect(screen.getByText(/RADIAL WAVE DISCOVERY ACTIVE/i)).toBeDefined();
    });
  });

  describe('Feature 2: D3 Node-Link Diagram on Map Tab', () => {
    it('renders D3MeshTopologyMap with SVG canvas, density metrics HUD, and interactive controls', () => {
      const onSelectPeer = vi.fn();
      const { container } = render(
        <D3MeshTopologyMap
          peers={mockPeers}
          user={mockUser}
          onSelectPeer={onSelectPeer}
          isNightMode={false}
        />
      );

      // SVG root rendered
      const svgElement = container.querySelector('svg');
      expect(svgElement).toBeDefined();

      // Density Metrics HUD rendered
      expect(screen.getAllByText(/Mesh Connectivity Density/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Nodes:/i).length).toBeGreaterThan(0);
    });

    it('allows switching to Mesh Topology mode on MapScreen', () => {
      const onUpdateUser = vi.fn();
      const onViewResourceDetails = vi.fn();
      const onSelectPeer = vi.fn();
      const onOpenChatWithPeer = vi.fn();
      const onOpenReputation = vi.fn();

      render(
        <MapScreen
          peers={mockPeers}
          resources={[]}
          user={mockUser}
          onUpdateUser={onUpdateUser}
          onViewResourceDetails={onViewResourceDetails}
          onSelectPeer={onSelectPeer}
          onOpenChatWithPeer={onOpenChatWithPeer}
          onOpenReputation={onOpenReputation}
        />
      );

      // Mode buttons exist
      const topologyBtn = screen.getByRole('button', { name: /Mesh Topology/i });
      expect(topologyBtn).toBeDefined();

      // Switch to Mesh Topology
      fireEvent.click(topologyBtn);

      // Mesh Topology Header / Metrics visible
      expect(screen.getAllByText(/Mesh Connectivity Density/i).length).toBeGreaterThan(0);
    });
  });
});
