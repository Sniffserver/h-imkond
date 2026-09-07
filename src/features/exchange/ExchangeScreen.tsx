import React from 'react';
import { ExchangeTab } from '../../components/ExchangeTab';
import { QuickTip } from '../../components/QuickTip';
import { ResourceItem, Transaction, MeshNode } from '../../types';

export interface ExchangeScreenProps {
  resources: ResourceItem[];
  transactions: Transaction[];
  peers: MeshNode[];
  userSymbiosisScore: number;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onOpenCreateOffering: () => void;
  onOpenWishlist: () => void;
  onOpenDaoModal: () => void;
  isNightMode?: boolean;
}

export const ExchangeScreen: React.FC<ExchangeScreenProps> = (props) => {
  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full relative">
      <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickTip
            id="exchange-tip"
            message="Trade resources or services offline securely."
          />
        </div>
      </div>
      <ExchangeTab {...props} />
    </div>
  );
};

export * from '../../components/ExchangeTab';
