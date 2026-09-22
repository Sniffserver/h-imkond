import React from 'react';
import { Radio } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface MeshEmptyStateProps {
  isScanning?: boolean;
  onRefreshScan?: () => void;
  onStartExploring?: () => void;
  onOpenHowDiscoveryWorks?: () => void;
  onOpenPiBridge?: () => void;
  onDiscoverPeer?: () => void;
  isNightMode?: boolean;
}

export const MeshEmptyState: React.FC<MeshEmptyStateProps> = ({
  isScanning = false,
  onRefreshScan,
  onStartExploring,
  onOpenHowDiscoveryWorks,
  onOpenPiBridge,
  onDiscoverPeer,
  isNightMode = false,
}) => {
  return (
    <EmptyState
      icon={<Radio className="animate-pulse" />}
      title="Listening for nearby network"
      message="Devices connect automatically over Bluetooth and local radio. This can take a moment."
      primaryAction={
        onRefreshScan
          ? {
              label: isScanning ? 'Scanning...' : 'Refresh scan',
              onClick: onRefreshScan,
              disabled: isScanning,
            }
          : undefined
      }
      secondaryAction={
        onOpenHowDiscoveryWorks
          ? {
              label: 'Learn how it works',
              onClick: onOpenHowDiscoveryWorks,
            }
          : undefined
      }
      tertiaryAction={
        onStartExploring
          ? {
              label: 'Explore on map instead',
              onClick: onStartExploring,
            }
          : undefined
      }
      isNightMode={isNightMode}
    />
  );
};


