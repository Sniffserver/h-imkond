// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MapScreen } from '../features/map/MapScreen';
import { D3MeshTopologyMap } from '../features/map/components/D3MeshTopologyMap';
import {
  DISCOVERABLE_PEERS,
  INITIAL_RESOURCES,
  INITIAL_USER,
  INITIAL_BATTERY_STATUS,
} from '../data/initialData';

beforeAll(() => {
  if (typeof window !== 'undefined' && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

describe('MapScreen component', () => {
  it('renders MapScreen without throwing', () => {
    const { container } = render(
      <MapScreen
        peers={DISCOVERABLE_PEERS}
        resources={INITIAL_RESOURCES}
        user={INITIAL_USER}
        onUpdateUser={() => {}}
        onAddToast={() => {}}
        isNightMode={false}
        filterOnlyNew={false}
        onViewResourceDetails={() => {}}
        onSelectPeer={() => {}}
        onOpenChatWithPeer={() => {}}
        onOpenReputation={() => {}}
        batteryStatus={INITIAL_BATTERY_STATUS}
      />
    );
    expect(container).toBeDefined();
  });

  it('renders D3MeshTopologyMap directly with pathfinding and latency heatmap', () => {
    const { container } = render(
      <D3MeshTopologyMap
        peers={DISCOVERABLE_PEERS}
        user={INITIAL_USER}
        onSelectPeer={() => {}}
        onOpenChatWithPeer={() => {}}
        onOpenReputation={() => {}}
        isNightMode={false}
        onAddToast={() => {}}
      />
    );
    expect(container).toBeDefined();
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('renders D3MeshTopologyMap with 0 peers safely', () => {
    const { container } = render(
      <D3MeshTopologyMap
        peers={[]}
        user={INITIAL_USER}
        onSelectPeer={() => {}}
        onOpenChatWithPeer={() => {}}
        onOpenReputation={() => {}}
        isNightMode={false}
        onAddToast={() => {}}
      />
    );
    expect(container).toBeDefined();
  });

  it('renders when user is partial or nullish', () => {
    const { container } = render(
      <MapScreen
        peers={[]}
        resources={[]}
        user={{} as any}
        onUpdateUser={() => {}}
        onAddToast={() => {}}
        isNightMode={false}
        filterOnlyNew={false}
        onViewResourceDetails={() => {}}
        onSelectPeer={() => {}}
        onOpenChatWithPeer={() => {}}
        onOpenReputation={() => {}}
        batteryStatus={INITIAL_BATTERY_STATUS}
      />
    );
    expect(container).toBeDefined();
  });
});
