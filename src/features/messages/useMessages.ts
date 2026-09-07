import { useState, useEffect, useCallback } from 'react';
import { MeshMessage, MeshNode } from '../../types';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';
import { INITIAL_MESSAGES } from '../../data/initialData';
import { initMessageStorage } from '../../services/comms/messageService';

export function useMessages(userCallsign: string, userId: string) {
  const [messages, setMessages] = useState<MeshMessage[]>(() => {
    return getSecureLocalStorage<MeshMessage[]>('hoimu_messages', INITIAL_MESSAGES);
  });

  useEffect(() => {
    setSecureLocalStorage('hoimu_messages', messages);
  }, [messages]);

  useEffect(() => {
    initMessageStorage().catch((err) => {
      console.warn('[HÕIMU] Could not init encrypted message storage:', err);
    });
  }, []);

  const sendMessage = useCallback(
    (text: string, recipient?: MeshNode | null) => {
      const targetCallsign = recipient?.callsign || 'Broadcast-Mesh';
      const targetId = recipient?.id || 'broadcast';

      const newMessage: MeshMessage = {
        id: `msg-${Date.now()}`,
        from: userCallsign,
        to: targetCallsign,
        content: btoa(JSON.stringify({ text })),
        ttl: 3,
        signature: `SIG_ED25519_${Date.now()}`,
        senderId: userId,
        senderCallsign: userCallsign,
        recipientId: targetId,
        recipientCallsign: targetCallsign,
        text: text,
        decryptedText: text,
        timestamp: Date.now(),
        status: 'pending',
        hopCount: targetId === 'broadcast' ? 1 : 1,
        rssi: -58,
        isRead: true,
      };

      setMessages((prev) => [...prev, newMessage]);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'delivered' } : m))
        );
      }, 800);

      return newMessage;
    },
    [userCallsign, userId]
  );

  const retryMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'pending' } : m))
    );
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 700);
  }, []);

  const markAsRead = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m))
    );
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    retryMessage,
    markAsRead,
  };
}
