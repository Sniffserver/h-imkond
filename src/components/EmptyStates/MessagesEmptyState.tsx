import React from 'react';
import { MessageSquare, Send, ShieldCheck, Radio } from 'lucide-react';

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
    <div
      role="region"
      aria-label="No messages available"
      className={`p-8 rounded-3xl border text-center flex flex-col items-center justify-center my-4 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
          isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
        }`}
      >
        <MessageSquare className="w-8 h-8" />
      </div>

      <h3 className="font-display font-bold text-lg mb-1">
        Start a Zero-Cloud Conversation
      </h3>

      <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] max-w-sm mb-4 leading-relaxed">
        Send end-to-end encrypted messages to direct callsigns or broadcast general emergency alerts to the local mesh.
      </p>

      <div
        className={`p-3 rounded-2xl border text-xs max-w-md w-full mb-6 text-left space-y-1 ${
          isNightMode
            ? 'bg-[#121A10] border-[#364E30]/60 text-[#A8BDA5]'
            : 'bg-white/80 border-[#87A878]/20 text-[#3A4A38]'
        }`}
      >
        <div className="font-bold text-[#203A2A] dark:text-[#E9C46A] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#588157]" />
          <span>Why this matters:</span>
        </div>
        <p>
          Messages travel using store-and-forward bundle routing with ECC Curve25519 signatures, guaranteeing offline privacy without internet dependencies.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {onOpenChatWithPeer && (
          <button
            type="button"
            onClick={onOpenChatWithPeer}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A]'
                : 'bg-[#588157] hover:bg-[#466845] text-white shadow-sm'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Select Peer to Message</span>
          </button>
        )}

        {onBroadcastAlert && (
          <button
            type="button"
            onClick={onBroadcastAlert}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'border-[#364E30] bg-[#121A10] text-[#F0F5EE] hover:bg-[#1A2517]'
                : 'border-[#87A878]/40 bg-white text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#E76F51]" />
            <span>Broadcast Mesh Alert</span>
          </button>
        )}
      </div>
    </div>
  );
};
