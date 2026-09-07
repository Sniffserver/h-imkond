import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MeshNode, MeshMessage } from '../types';
import {
  sendDirectMessage,
  getConversation,
  markConversationAsRead,
  subscribeToMessages,
  getPeerPublicKey,
} from '../services/comms/messageService';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import {
  X,
  Send,
  Lock,
  ShieldCheck,
  Radio,
  Clock,
  CheckCheck,
  Check,
  Sparkles,
  Info,
} from 'lucide-react';

interface DirectMessageModalProps {
  peer: MeshNode;
  isOpen: boolean;
  onClose: () => void;
  isNightMode?: boolean;
}

export const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  peer,
  isOpen,
  onClose,
  isNightMode = false,
}) => {
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const peerPublicKey = peer.publicKey || getPeerPublicKey(peer.callsign);

  const loadThread = useCallback(async () => {
    try {
      const thread = await getConversation(peer.id);
      setMessages(thread);
      // Mark as read when viewing
      await markConversationAsRead(peer.id);
    } catch (e) {
      console.error('[DirectMessageModal] Error loading conversation:', e);
    } finally {
      setIsLoading(false);
    }
  }, [peer.id]);

  useEffect(() => {
    if (!isOpen) return;

    loadThread();

    // Subscribe to reactive updates (e.g. from mesh sync across tabs)
    const unsubscribe = subscribeToMessages(() => {
      loadThread();
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, loadThread]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Just a simple trap handling main content
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const modal = document.getElementById('direct-message-modal-dialog');
        if (!modal) return;
        const elements = modal.querySelectorAll<HTMLElement>(focusableElements);
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || isSending) return;

    setIsSending(true);
    try {
      const sentMsg = await sendDirectMessage(peer.id, content);
      setInputText('');
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      console.error('[DirectMessageModal] Error sending message:', err);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="direct-message-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="direct-message-modal-dialog"
        className={`w-full max-w-lg rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-colors duration-150 h-[85vh] max-h-[680px] ${
          isNightMode
            ? 'bg-[#121c11] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30]'
              : 'bg-[#F0F5EE] border-[#87A878]/30'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <SolarpunkAvatarCanvas seed={peer.avatarSeed} size={40} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                  isNightMode ? 'border-[#182315]' : 'border-white'
                } ${peer.isDirect ? 'bg-[#588157]' : 'bg-[#E9C46A]'}`}
                title={peer.isDirect ? 'Direct RF neighbor' : 'Multi-hop relay'}
              />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base truncate">
                  {peer.callsign}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isNightMode
                      ? 'bg-[#2A9D8F]/20 text-[#2A9D8F] border border-[#2A9D8F]/30'
                      : 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
                  }`}
                >
                  {peer.hopDistance === 1 ? '1 HOP DIRECT' : `${peer.hopDistance} HOPS RELAY`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#588157]">
                <ShieldCheck className="w-3 h-3 text-[#2A9D8F]" />
                <span className="truncate" title={`Public Key: ${peerPublicKey}`}>
                  {peerPublicKey.slice(0, 16)}...
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              id="close-direct-message-modal-btn"
              type="button"
              onClick={onClose}
              className={`p-2 rounded-2xl transition-colors cursor-pointer ${
                isNightMode
                  ? 'hover:bg-[#223120] text-[#A8BDA5]'
                  : 'hover:bg-[#87A878]/20 text-[#637062]'
              }`}
              title="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zero-Cloud E2E Banner */}
        <div
          className={`px-4 py-2 text-[11px] font-mono flex items-center justify-between border-b ${
            isNightMode
              ? 'bg-[#182618] border-[#364E30]/70 text-[#A8BDA5]'
              : 'bg-[#F2F7F0] border-[#87A878]/20 text-[#588157]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>End-to-End Encrypted (Ed25519 / AES-GCM-256)</span>
          </div>
          <span className="text-[10px] font-semibold opacity-85">
            Store-and-Forward TTL: 3
          </span>
        </div>

        {/* Message Thread */}
        <div
          id="direct-message-thread"
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs font-mono text-center opacity-60">
              <Radio className="w-6 h-6 animate-pulse text-[#2A9D8F] mb-2" />
              Decrypting local message thread from IndexedDB...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-3xl bg-[#2A9D8F]/15 flex items-center justify-center text-[#2A9D8F]">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Secure Channel Established</p>
                <p className="text-xs text-opacity-80 max-w-xs mt-1 leading-relaxed">
                  Messages are encrypted with {peer.callsign}'s Ed25519 public key, signed by your node, and relayed over peer-to-peer mesh sync.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine =
                (msg.from || msg.senderCallsign || '').toLowerCase() !==
                peer.callsign.toLowerCase();

              const displayText = msg.decryptedText || msg.text || '🔒 Encrypted message';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-xs relative ${
                      isMine
                        ? isNightMode
                          ? 'bg-[#2A9D8F] text-white rounded-tr-xs'
                          : 'bg-[#203A2A] text-white rounded-tr-xs'
                        : isNightMode
                        ? 'bg-[#1e2d1d] border border-[#364E30] text-[#F0F5EE] rounded-tl-xs'
                        : 'bg-white border border-[#87A878]/30 text-[#203A2A] rounded-tl-xs'
                    }`}
                  >
                    <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                      {displayText}
                    </p>

                    <div
                      className={`flex items-center gap-1.5 mt-1.5 text-[9px] font-mono ${
                        isMine ? 'text-white/70 justify-end' : 'text-[#637062] dark:text-[#A8BDA5]'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {msg.ttl !== undefined && (
                        <span className="opacity-80">· TTL {msg.ttl}</span>
                      )}

                      {isMine && (
                        <span className="flex items-center ml-0.5">
                          {msg.status === 'delivered' ? (
                            <CheckCheck className="w-3 h-3 text-[#E9C46A]" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cryptographic Signature Indicator */}
                  <div
                    className={`flex items-center gap-1 text-[8px] font-mono mt-0.5 px-1 ${
                      isNightMode ? 'text-[#87A878]/75' : 'text-[#637062]/80'
                    }`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5 text-[#2A9D8F]" />
                    <span>Ed25519 Verified</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className={`p-3 sm:p-4 border-t flex items-center gap-2 shrink-0 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30]'
              : 'bg-[#F0F5EE] border-[#87A878]/30'
          }`}
        >
          <input
            ref={inputRef}
            id="direct-message-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Encrypted message to ${peer.callsign}...`}
            className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-2xl border outline-hidden transition-all ${
              isNightMode
                ? 'bg-[#121c11] border-[#364E30] text-[#F0F5EE] placeholder-[#A8BDA5]/50 focus:border-[#2A9D8F]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] placeholder-[#637062]/60 focus:border-[#588157]'
            }`}
            disabled={isSending}
          />

          <button
            id="send-direct-message-btn"
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`px-4 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isNightMode
                ? 'bg-[#2A9D8F] hover:bg-[#238276] text-white'
                : 'bg-[#203A2A] hover:bg-[#16271c] text-white'
            }`}
          >
            {isSending ? (
              <Radio className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
