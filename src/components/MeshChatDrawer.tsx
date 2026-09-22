import React, { useState } from 'react';
import { MeshMessage, MeshNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { Send, Radio, Lock, CheckCheck, Clock, AlertCircle, X, RotateCcw, ShieldAlert } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface MeshChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: MeshMessage[];
  onSendMessage: (text: string, recipientId: string, recipientCallsign: string) => void;
  onRetryMessage?: (messageId: string) => void;
  activePeer: MeshNode | null;
  currentUserId: string;
  currentUserCallsign: string;
}

export const MeshChatDrawer: React.FC<MeshChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onRetryMessage,
  activePeer,
  currentUserId,
  currentUserCallsign,
}) => {
  const [inputText, setInputText] = useState('');
  const MAX_CHARS = 256;
  const drawerRef = useFocusTrap({
    isOpen,
    onClose,
    modalName: activePeer ? `Mesh Chat with ${activePeer.callsign}` : 'Bioregional Mesh Broadcast Chat',
  });

  if (!isOpen) return null;

  const recipientId = activePeer ? activePeer.id : 'broadcast';
  const recipientCallsign = activePeer ? activePeer.callsign : 'Bioregion Broadcast';

  // Filter messages for this conversation (direct or broadcast)
  const conversationMessages = messages.filter((m) => {
    if (activePeer) {
      return (
        (m.senderId === currentUserId && m.recipientId === activePeer.id) ||
        (m.senderId === activePeer.id && m.recipientId === currentUserId) ||
        m.recipientId === 'broadcast'
      );
    }
    return m.recipientId === 'broadcast';
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), recipientId, recipientCallsign);
    setInputText('');
  };

  const charsRemaining = MAX_CHARS - inputText.length;
  const isNearLimit = charsRemaining <= 30;

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mesh-chat-title"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#FAF6EE] shadow-2xl border-l border-[#87A878]/35 flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 bg-white/95 border-b border-[#87A878]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activePeer ? (
            <SolarpunkAvatarCanvas seed={activePeer.avatarSeed} size={38} />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-[#87A878]/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#203A2A]" />
            </div>
          )}
          <div>
            <h3 id="mesh-chat-title" className="font-display font-bold text-sm text-[#203A2A]">
              {activePeer ? activePeer.callsign : 'Bioregional Mesh Broadcast'}
            </h3>
            <p className="text-[11px] text-[#588157] font-mono flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#87A878]" />
              {activePeer
                ? `${activePeer.lastRssi} dBm • ${activePeer.hopDistance === 1 ? '1 hop (Direct)' : `${activePeer.hopDistance} hops`}`
                : 'All reachable nodes within RF reach'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close mesh chat drawer"
          className="p-1.5 rounded-full text-[#637062] hover:bg-[#E6EDE1] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Protocol Telemetry Banner */}
      <div className="px-4 py-1.5 bg-[#F0F5EE] text-[10px] font-mono text-[#588157] flex items-center justify-between border-b border-[#87A878]/15">
        <span>Packet Limit: 256 Bytes (BLE / Wi-Fi Direct)</span>
        <span className="text-[#E76F51] font-semibold">Offline Mesh</span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversationMessages.length === 0 ? (
          <EmptyState
            icon={<Radio />}
            title="No mesh packets exchanged yet"
            message="Send a lightweight packet to coordinate mutual aid or share status."
            isNightMode={false} // Assume false for now, would need to wire it down if needed
          />
        ) : (
          conversationMessages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Callout */}
                <div className="text-[10px] font-mono text-[#637062] mb-0.5 px-1 flex items-center gap-1.5">
                  <span>{isSelf ? `${currentUserCallsign} (You)` : msg.senderCallsign}</span>
                  <span className="text-[#7C8C77]">• {timeStr}</span>
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isSelf
                      ? 'bg-gradient-to-r from-[#588157] to-[#203A2A] text-white rounded-br-xs'
                      : 'bg-white text-[#203A2A] border border-[#87A878]/30 rounded-bl-xs'
                  }`}
                >
                  <p className="break-words font-sans">{msg.text}</p>

                  {/* Packet Telemetry Footnote */}
                  <div
                    className={`mt-1.5 flex items-center justify-between gap-2 text-[9px] font-mono ${
                      isSelf ? 'text-white/80' : 'text-[#637062]'
                    }`}
                  >
                    <span>
                      {msg.hopCount} {msg.hopCount === 1 ? 'hop' : 'hops'} • {msg.rssi} dBm
                    </span>

                    <span className="flex items-center gap-1">
                      {msg.status === 'delivered' && (
                        <>
                          <CheckCheck className="w-3 h-3 text-[#E9C46A]" />
                          <span>Delivered</span>
                        </>
                      )}
                      {msg.status === 'pending' && (
                        <>
                          <Clock className="w-3 h-3 animate-spin text-white/70" />
                          <span>Relaying...</span>
                        </>
                      )}
                      {msg.status === 'failed' && (
                        <span className="flex items-center gap-1 text-red-300">
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                          {onRetryMessage && (
                            <button
                              type="button"
                              onClick={() => onRetryMessage(msg.id)}
                              className="ml-1 underline flex items-center gap-0.5 hover:text-white"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Retry
                            </button>
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Composer Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-[#87A878]/20 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#637062] px-1">
          <span>Payload Size</span>
          <span
            className={
              isNearLimit
                ? 'text-[#E76F51] font-bold'
                : 'text-[#588157] font-semibold'
            }
          >
            {charsRemaining} chars remaining
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            maxLength={MAX_CHARS}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              activePeer
                ? `Direct packet to ${activePeer.callsign}...`
                : 'Broadcast packet to all mesh nodes...'
            }
            className="flex-1 px-3.5 py-2.5 bg-[#FAF6EE] border border-[#87A878]/35 rounded-xl text-xs text-[#203A2A] focus:outline-none focus:ring-2 focus:ring-[#87A878]"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 bg-[#203A2A] text-white rounded-xl hover:bg-[#16271c] disabled:opacity-40 transition-colors shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Send packet"
          >
            <Send className="w-4 h-4 text-[#E9C46A]" />
          </button>
        </div>

        {/* Prototype simulation disclaimer */}
        <div className="text-[10px] text-[#637062] font-mono flex items-center gap-1 pt-1">
          <ShieldAlert className="w-3 h-3 text-[#87A878] shrink-0" />
          <span>Messages are simulated in this prototype; no network transmission occurs.</span>
        </div>
      </form>
    </div>
  );
};
