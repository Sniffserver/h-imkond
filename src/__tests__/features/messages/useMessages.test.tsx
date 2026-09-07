import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessages } from '../../../features/messages/useMessages';
import {
  encryptWithPublicKey,
  decryptWithKey,
  initMessageStorage,
} from '../../../services/comms/messageService';

vi.mock('../../../services/comms/messageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/comms/messageService')>();
  return {
    ...actual,
    initMessageStorage: vi.fn(() => Promise.resolve()),
  };
});

describe('useMessages & Encrypted Messaging Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Cryptographic Encryption / Decryption', () => {
    it('executes encrypt/decrypt round trip accurately', async () => {
      const plaintext = 'Secret Mesh Payload 123!';
      const testKeyHex = 'ed25519:abcdef0123456789abcdef0123456789';

      const encrypted = await encryptWithPublicKey(plaintext, testKeyHex);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);

      const decrypted = await decryptWithKey(encrypted, testKeyHex);
      expect(decrypted).toBe(plaintext);
    });

    it('gracefully handles missing or corrupt ciphertext keys without crashing', async () => {
      const corruptCiphertext = btoa('invalid-json-payload');
      const testKeyHex = 'ed25519:abcdef0123456789abcdef0123456789';

      const decrypted = await decryptWithKey(corruptCiphertext, testKeyHex);
      expect(decrypted).toBe('🔒 [Encrypted Mesh Packet]');
    });
  });

  describe('Message Hook Lifecycle & Delivery Retries', () => {
    it('initializes and saves messages to local storage', () => {
      const { result } = renderHook(() => useMessages('TEST_USER', 'user_123'));
      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(initMessageStorage).toHaveBeenCalledTimes(1);
    });

    it('reloads persisted messages from local storage upon initial render', () => {
      const persisted = [
        {
          id: 'msg-persisted-1',
          from: 'PIONEER-01',
          to: 'TEST_USER',
          content: 'Persisted Content',
          timestamp: Date.now(),
          ttl: 3,
          signature: 'SIG',
          status: 'delivered',
          isRead: true,
        },
      ];
      localStorage.setItem('hoimu_messages', JSON.stringify(persisted));

      const { result } = renderHook(() => useMessages('TEST_USER', 'user_123'));
      expect(result.current.messages).toEqual(persisted);
    });

    it('queues a pending message, transitions to delivered, and supports manual retries', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useMessages('TEST_USER', 'user_123'));

      let msgId: string = '';
      act(() => {
        const msg = result.current.sendMessage('Resilient Comms Test');
        msgId = msg.id;
      });

      const pendingMsg = result.current.messages.find((m) => m.id === msgId);
      expect(pendingMsg?.text).toBe('Resilient Comms Test');
      expect(pendingMsg?.status).toBe('pending');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const deliveredMsg = result.current.messages.find((m) => m.id === msgId);
      expect(deliveredMsg?.status).toBe('delivered');

      // Test retryQueue manually trigger retry
      act(() => {
        result.current.retryMessage(msgId);
      });

      const retryingMsg = result.current.messages.find((m) => m.id === msgId);
      expect(retryingMsg?.status).toBe('pending');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const retrySuccessMsg = result.current.messages.find((m) => m.id === msgId);
      expect(retrySuccessMsg?.status).toBe('delivered');

      vi.useRealTimers();
    });
  });
});
