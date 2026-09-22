import React from 'react';
import { Sprout } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface ExchangeEmptyStateProps {
  onOpenCreateOffering?: () => void;
  onOpenWishlist?: () => void;
  isNightMode?: boolean;
}

export const ExchangeEmptyState: React.FC<ExchangeEmptyStateProps> = ({
  onOpenCreateOffering,
  onOpenWishlist,
  isNightMode = false,
}) => {
  return (
    <EmptyState
      icon={<Sprout />}
      title="Add Your First Mutual Aid Resource"
      message="List spare tools, solar energy capacity, seeds, medical kits, or specialized skills for local barter and gift sharing."
      primaryAction={
        onOpenCreateOffering
          ? {
              label: 'Share Resource',
              onClick: onOpenCreateOffering,
            }
          : undefined
      }
      secondaryAction={
        onOpenWishlist
          ? {
              label: 'Request a need',
              onClick: onOpenWishlist,
            }
          : undefined
      }
      isNightMode={isNightMode}
    />
  );
};
