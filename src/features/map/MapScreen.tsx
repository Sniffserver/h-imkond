import React from 'react';
import { MapViewTab } from '../../components/MapViewTab';
import { QuickTip } from '../../components/QuickTip';
import { MeshNode, ResourceItem, UserProfile, ToastMessage, BatteryManagerStatus } from '../../types';

export interface MapScreenProps {
  peers: MeshNode[];
  resources: ResourceItem[];
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
  isNightMode?: boolean;
  filterOnlyNew?: boolean;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onSelectPeer: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode | null) => void;
  onOpenReputation: (peer: MeshNode) => void;
  batteryStatus?: BatteryManagerStatus;
}

export const MapScreen: React.FC<MapScreenProps> = (props) => {
  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full relative">
      <div className="shrink-0 absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-sm">
        <div className="pointer-events-auto">
          <QuickTip
            id="map-tip"
            message="Switch between layers, walk to uncover areas, or long-press to drop a custom survival marker."
          />
        </div>
      </div>
      <MapViewTab {...props} />
    </div>
  );
};

export * from '../../components/MapViewTab';
