import { useState, useEffect, useCallback } from 'react';
import { MeshMessage, MeshNode } from '../../types';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';
import { INITIAL_MESSAGES } from '../../data/initialData';
import { initMessageStorage } from '../../services/comms/messageService';
import { signCanonicalPayload } from '../../core/identity';

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
      const timestamp = Date.now();
      const id = `msg-${timestamp}`;
      const content = btoa(JSON.stringify({ text }));

      const newMessage: MeshMessage = {
        id,
        from: userCallsign,
        to: targetCallsign,
        content,
        ttl: 3,
        signature: '',
        senderId: userId,
        senderCallsign: userCallsign,
        recipientId: targetId,
        recipientCallsign: targetCallsign,
        text: text,
        decryptedText: text,
        timestamp,
        status: 'pending',
        hopCount: targetId === 'broadcast' ? 1 : 1,
        rssi: -58,
        isRead: true,
      };

      signCanonicalPayload({
        id,
        from: userCallsign,
        to: targetCallsign,
        content,
        timestamp,
      })
        .then((sig) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, signature: sig } : m))
          );
        })
        .catch(() => {});

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
