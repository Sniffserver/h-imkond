import React from 'react';
import { MeshTab } from '../../components/MeshTab';
import { QuickTip } from '../../components/QuickTip';
import { MeshNode, BatteryManagerStatus } from '../../types';

export interface MeshScreenProps {
  peers: MeshNode[];
  batteryStatus: BatteryManagerStatus;
  userSymbiosisScore: number;
  userCallsign: string;
  onToggleSolarAware: () => void;
  onSelectPeer: (peer: MeshNode) => void;
  onOpenReputation: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode | null) => void;
  onRefreshScan: () => void;
  onOpenDiagnostics: () => void;
  onDiscoverPeer: () => void;
  isScanning: boolean;
  isNightMode?: boolean;
}

export const MeshScreen: React.FC<MeshScreenProps> = (props) => {
  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickTip
            id="mesh-tip"
            message="See nearby mesh nodes. Connect with trusted peers to relay messages."
          />
        </div>
      </div>
      <MeshTab {...props} />
    </div>
  );
};

export * from '../../components/MeshTab';
