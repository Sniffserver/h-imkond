import React from 'react';
import { PathfinderTab } from '../../components/PathfinderTab';
import { QuickTip } from '../../components/QuickTip';

export interface ScannerScreenProps {
  isNightMode?: boolean;
  onNavigateToMapWithFilter: (filterNew: boolean) => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = (props) => {
  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full relative">
      <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickTip
            id="pathfinder-tip"
            message="Scan for offline Wi-Fi, Bluetooth, and LoRa signals."
          />
        </div>
      </div>
      <PathfinderTab {...props} />
    </div>
  );
};

export * from '../../components/PathfinderTab';
