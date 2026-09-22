import React from 'react';
import { Cpu } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface HomeHubEmptyStateProps {
  onConnectHub: () => void;
  onDismiss?: () => void;
  isNightMode?: boolean;
}

export const HomeHubEmptyState: React.FC<HomeHubEmptyStateProps> = ({
  onConnectHub,
  onDismiss,
  isNightMode = false,
}) => {
  return (
    <EmptyState
      icon={<Cpu />}
      title="Home hub not connected"
      message="You can still use maps, messages, and saved resources. Connect your home hub when you want to scan local radio activity."
      primaryAction={{
        label: 'Connect home hub',
        onClick: onConnectHub,
      }}
      tertiaryAction={
        onDismiss
          ? {
              label: 'Continue without home hub',
              onClick: onDismiss,
            }
          : undefined
      }
      isNightMode={isNightMode}
    />
  );
};
