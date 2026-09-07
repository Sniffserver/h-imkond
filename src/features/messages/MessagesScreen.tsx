import React from 'react';
import { DirectMessageModal } from '../../components/DirectMessageModal';
import { MeshChatDrawer } from '../../components/MeshChatDrawer';
import { MeshMessage, MeshNode } from '../../types';

export interface MessagesScreenProps {
  isOpen: boolean;
  onClose: () => void;
  activePeer: MeshNode | null;
  messages: MeshMessage[];
  onSendMessage: (text: string, attachment?: any) => void;
  onRetryMessage: (messageId: string) => void;
  isNightMode?: boolean;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  isOpen,
  onClose,
  activePeer,
  isNightMode = false,
}) => {
  if (!isOpen || !activePeer) return null;

  return (
    <DirectMessageModal
      isOpen={isOpen}
      onClose={onClose}
      peer={activePeer}
      isNightMode={isNightMode}
    />
  );
};

export { MeshChatDrawer };
