import React, { useState } from 'react';
import { ResourceItem, Transaction, MeshNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { ReputationPill, getReputationTier } from './ReputationPill';
import { CATEGORY_STYLES } from './CategoryFilterChips';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  X,
  MapPin,
  Clock,
  MessageSquare,
  Handshake,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  QrCode,
} from 'lucide-react';

interface ResourceDetailModalProps {
  resource: ResourceItem | null;
  transaction?: Transaction;
  peer?: MeshNode;
  onClose: () => void;
  onRequestExchange: (resource: ResourceItem) => void;
  onCompleteExchange: (resource: ResourceItem) => void;
  onOpenChat: (peer: MeshNode | null) => void;
  onOpenReputation: (peer: MeshNode) => void;
}

export const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  resource,
  transaction,
  peer,
  onClose,
  onRequestExchange,
  onCompleteExchange,
  onOpenChat,
  onOpenReputation,
}) => {
  const [showRequestConfirm, setShowRequestConfirm] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const modalRef = useFocusTrap({
    isOpen: Boolean(resource),
    onClose,
    modalName: resource ? `Resource details for ${resource.title}` : 'Resource Details',
  });

  React.useEffect(() => {
    if (showQr && canvasRef.current && resource) {
      const qrPayload = JSON.stringify({
        protocol: 'hoimu-p2p',
        type: 'resource',
        data: {
          id: resource.id,
          title: resource.title,
          description: resource.description,
          category: resource.category,
          ownerCallsign: resource.ownerCallsign,
          ownerCompletedExchanges: resource.ownerCompletedExchanges || 0,
          ownerReputationTier: resource.ownerReputationTier || 'Active Helper',
          avatarSeed: resource.avatarSeed,
          availabilityText: resource.availabilityText,
          distanceKm: resource.distanceKm,
          isActive: resource.isActive,
        }
      });

      import('qrcode').then((QRCode) => {
        QRCode.toCanvas(canvasRef.current, qrPayload, {
          width: 180,
          margin: 1,
          color: {
            dark: '#203A2A',
            light: '#FAF6EE',
          },
        }, (err) => {
          if (err) console.error('[QR Sync] Failed to render QR:', err);
        });
      });
    }
  }, [showQr, resource]);

  if (!resource) return null;

  const style = CATEGORY_STYLES[resource.category] || CATEGORY_STYLES['Tools'];
  const tier =
    resource.ownerReputationTier ||
    getReputationTier(resource.ownerCompletedExchanges || 0);

  const isPending = transaction?.status === 'pending';
  const isActive = transaction?.status === 'active';
  const isCompleted = transaction?.status === 'completed';

  const handleConfirmRequest = () => {
    onRequestExchange(resource);
    setShowRequestConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-detail-title"
        id="resource-detail-modal"
        className="w-full max-w-lg bg-[#FAF6EE] rounded-t-3xl sm:rounded-3xl border border-[#87A878]/35 shadow-2xl p-5 sm:p-6 overflow-hidden animate-in slide-in-from-bottom-6 duration-200 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-3 min-w-0">
            <SolarpunkAvatarCanvas seed={resource.avatarSeed} size={48} />
            <div className="truncate">
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text}`}
              >
                {resource.category}
              </span>
              <h3 id="resource-detail-title" className="font-display font-bold text-lg text-[#203A2A] mt-1 leading-snug truncate">
                {resource.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close resource details"
            className="p-1.5 rounded-full text-[#637062] hover:bg-[#E6EDE1] transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Profile Snippet */}
        <div className="p-3.5 bg-white/80 rounded-2xl border border-[#87A878]/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SolarpunkAvatarCanvas seed={resource.avatarSeed} size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#203A2A]">
                  Offered by {resource.ownerCallsign}
                </span>
                <ReputationPill
                  tier={tier}
                  size="sm"
                  onClick={() => peer && onOpenReputation(peer)}
                />
              </div>
              <p className="text-[11px] text-[#637062] mt-0.5">
                {peer?.bio || 'Active participant in local bioregional network.'}
              </p>
            </div>
          </div>

          {peer && (
            <button
              type="button"
              onClick={() => onOpenReputation(peer)}
              className="p-2 rounded-xl text-[#2A9D8F] hover:bg-[#EBF7F5] border border-[#2A9D8F]/30 transition-colors shrink-0"
              title="View trust graph"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Full Description */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-[#637062] uppercase tracking-wider">
            Resource Details
          </div>
          <p className="text-xs text-[#203A2A] leading-relaxed bg-white/60 p-3.5 rounded-2xl border border-[#87A878]/20">
            {resource.description}
          </p>
        </div>

        {/* Telemetry / Location Matrix */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#87A878]" />
              Distance:
            </span>
            <span className="font-mono font-bold text-[#203A2A]">{resource.distanceKm} km away</span>
          </div>

          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#E9C46A]" />
              Status:
            </span>
            <span className="font-semibold text-[#588157]">
              {resource.isActive ? 'Available' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Availability text */}
        <div className="p-3 bg-[#F0F5EE] rounded-2xl border border-[#87A878]/25 text-xs text-[#588157] font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#87A878] shrink-0" />
          <span>{resource.availabilityText}</span>
        </div>

        {/* Confirmation Modal overlay for Request */}
        {showRequestConfirm ? (
          <div className="p-4 bg-[#FFF8E7] rounded-2xl border border-[#E9C46A] space-y-3 animate-in fade-in duration-150">
            <div className="flex items-start gap-2 text-xs text-[#7A5200]">
              <Handshake className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Confirm Mutual Aid Request</strong>
                <p className="mt-0.5 text-[11px]">
                  This sends a lightweight P2P exchange packet to{' '}
                  <span className="font-semibold">{resource.ownerCallsign}</span>. You can coordinate timing and pickup via direct mesh messaging.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRequestConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[#637062] hover:text-[#203A2A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRequest}
                className="px-4 py-1.5 bg-[#203A2A] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#16271c]"
              >
                Confirm Request
              </button>
            </div>
          </div>
        ) : (
          /* Primary Action Buttons */
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-3">
              {/* Message Provider button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChat(peer || null);
                }}
                className="flex-1 py-2.5 px-3 bg-white text-[#203A2A] border border-[#87A878]/40 hover:bg-[#FAF6EE] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#588157]" />
                Message {resource.ownerCallsign}
              </button>

              {/* Conditional Mutual Aid Action Button */}
              {isCompleted ? (
                <div className="flex-1 py-2.5 px-3 bg-[#87A878]/20 text-[#344E2C] border border-[#87A878] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#588157]" />
                  Exchange Completed
                </div>
              ) : isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCompleteExchange(resource);
                  }}
                  className="flex-1 py-2.5 px-3 bg-gradient-to-r from-[#87A878] to-[#588157] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#E9C46A]" />
                  Complete & Reflect
                </button>
              ) : isPending ? (
                <div className="flex-1 py-2.5 px-3 bg-[#E9C46A]/20 text-[#8C6207] border border-[#E9C46A] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#F4A261] animate-spin" />
                  Request Pending
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRequestConfirm(true)}
                  className="flex-1 py-2.5 px-3 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Handshake className="w-4 h-4 text-[#E9C46A]" />
                  Request Exchange
                </button>
              )}
            </div>

            {/* Share P2P QR Code Button */}
            <button
              type="button"
              onClick={() => setShowQr((prev) => !prev)}
              className="w-full py-2.5 bg-[#FAF6EE] hover:bg-[#F0F5EE] text-[#203A2A] border border-[#87A878]/40 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer mt-2"
            >
              <QrCode className="w-4 h-4 text-[#588157]" />
              {showQr ? 'Hide Sync QR Code' : 'Share Offline Sync QR Code'}
            </button>

            {/* QR Code display area */}
            {showQr && (
              <div className="p-4 bg-white rounded-2xl border border-[#87A878]/30 flex flex-col items-center text-center space-y-2 mt-2 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="p-2 bg-[#FAF6EE] rounded-2xl border border-[#87A878]/20 shadow-xs">
                  <canvas ref={canvasRef} className="max-w-full" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#203A2A]">P2P Sync Packet Generated</h4>
                  <p className="text-[10px] text-[#637062] max-w-[320px]">
                    Have your neighbor scan this QR code with their terminal to instantly clone this resource. No internet connection required.
                  </p>
                </div>
              </div>
            )}

            {/* Prototype Local Storage Note */}
            <div className="text-[10px] text-[#637062] font-mono text-center pt-2">
              Requests and status updates persist locally in browser state.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
