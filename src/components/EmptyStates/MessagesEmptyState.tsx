import React from 'react';
import { MessageSquare } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface MessagesEmptyStateProps {
  onOpenChatWithPeer?: () => void;
  onBroadcastAlert?: () => void;
  isNightMode?: boolean;
}

export const MessagesEmptyState: React.FC<MessagesEmptyStateProps> = ({
  onOpenChatWithPeer,
  onBroadcastAlert,
  isNightMode = false,
}) => {
  return (
    <EmptyState
      icon={<MessageSquare />}
      title="Start a Zero-Cloud Conversation"
      message="Send end-to-end encrypted messages to direct callsigns or broadcast general emergency alerts to the local mesh."
      primaryAction={
        onOpenChatWithPeer
          ? {
              label: 'Message Nearby Node',
              onClick: onOpenChatWithPeer,
            }
          : undefined
      }
      secondaryAction={
        onBroadcastAlert
          ? {
              label: 'Broadcast to Mesh',
              onClick: onBroadcastAlert,
            }
          : undefined
      }
      isNightMode={isNightMode}
    />
  );
};
