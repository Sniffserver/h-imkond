import React, { useState, useEffect } from 'react';
import { MeshNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { ReputationPill, getReputationTier } from './ReputationPill';
import { PeerSignalPulseSVG, SignalStrengthMeterSVG } from './PeerSignalPulseSVG';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Radio,
  MessageSquare,
  ShieldCheck,
  X,
  Compass,
  Tag,
  Cpu,
  Lock,
  Save,
  Trash2,
  Check,
  Sparkles,
  FileText,
  Activity,
  Zap,
  Loader2,
  Wifi,
} from 'lucide-react';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';
import { peerPingService, PeerPingResult } from '../services/mesh/peerPingService';
import { soundFeedback } from '../services/utils/soundFeedback';
import { PeerContributionRadarChart } from './PeerContributionRadarChart';

interface PeerPrivateNoteRecord {
  note: string;
  updatedAt: number;
}

interface PeerDetailBottomSheetProps {
  peer: MeshNode | null;
  onClose: () => void;
  onOpenReputation: (peer: MeshNode) => void;
  onOpenChat: (peer: MeshNode) => void;
  isNightMode?: boolean;
}

const STORAGE_KEY_PEER_NOTES = 'hoimu_peer_private_notes';

const QUICK_TAG_SUGGESTIONS = [
  '🌱 Seed Saver',
  '⚡ Solar Gear',
  '🛠️ Tool Library',
  '🚲 Mesh Courier',
  '🌿 Bio-Remedy',
  '🤝 Trusted Exchange',
];

export const PeerDetailBottomSheet: React.FC<PeerDetailBottomSheetProps> = ({
  peer,
  onClose,
  onOpenReputation,
  onOpenChat,
  isNightMode = false,
}) => {
  // Private Local Notes State
  const [noteText, setNoteText] = useState('');
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Low-Energy BLE Heartbeat Ping State
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingResult, setLastPingResult] = useState<PeerPingResult | null>(null);

  const sheetRef = useFocusTrap({
    isOpen: Boolean(peer),
    onClose,
    modalName: peer ? `Peer Details for ${peer.callsign}` : 'Peer Details',
  });

  // Load encrypted notes whenever active peer changes
  useEffect(() => {
    if (!peer) return;
    const allNotes = getSecureLocalStorage<Record<string, PeerPrivateNoteRecord>>(
      STORAGE_KEY_PEER_NOTES,
      {}
    );
    const peerRecord = allNotes[peer.id] || allNotes[peer.callsign];
    if (peerRecord) {
      setNoteText(peerRecord.note || '');
      setLastSavedTime(peerRecord.updatedAt || null);
    } else {
      setNoteText('');
      setLastSavedTime(null);
    }
    setSaveStatus('idle');
  }, [peer]);

  if (!peer) return null;

  const tier = getReputationTier(peer.completedExchanges);

  const handlePingPeer = async () => {
    if (!peer || isPinging) return;
    try {
      setIsPinging(true);
      soundFeedback.playClick();
      const result = await peerPingService.pingPeer(peer);
      setLastPingResult(result);
      soundFeedback.playSuccess();
    } catch (err) {
      console.error('Ping failed:', err);
    } finally {
      setIsPinging(false);
    }
  };

  // Save note to AES-256 encrypted local storage
  const handleSaveNote = () => {
    if (!peer) return;
    const allNotes = getSecureLocalStorage<Record<string, PeerPrivateNoteRecord>>(
      STORAGE_KEY_PEER_NOTES,
      {}
    );

    const updatedNotes: Record<string, PeerPrivateNoteRecord> = {
      ...allNotes,
      [peer.id]: {
        note: noteText.trim(),
        updatedAt: Date.now(),
      },
    };

    setSecureLocalStorage(STORAGE_KEY_PEER_NOTES, updatedNotes);
    setLastSavedTime(Date.now());
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2400);
  };

  // Clear note
  const handleClearNote = () => {
    if (!peer) return;
    if (noteText.trim().length > 0 && !window.confirm('Delete local private note for this peer?')) {
      return;
    }
    const allNotes = getSecureLocalStorage<Record<string, PeerPrivateNoteRecord>>(
      STORAGE_KEY_PEER_NOTES,
      {}
    );
    delete allNotes[peer.id];
    delete allNotes[peer.callsign];
    setSecureLocalStorage(STORAGE_KEY_PEER_NOTES, allNotes);
    setNoteText('');
    setLastSavedTime(null);
    setSaveStatus('idle');
  };

  const handleAppendTag = (tag: string) => {
    setNoteText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed}\n${tag}`;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="peer-detail-title"
        id="peer-detail-sheet"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FAF6EE] rounded-t-3xl sm:rounded-3xl border border-[#87A878]/35 shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-6 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-3">
            <PeerSignalPulseSVG
              rssi={peer.lastRssi}
              connectionState={peer.connectionState}
              isDirect={peer.isDirect}
              size={58}
            >
              <SolarpunkAvatarCanvas seed={peer.avatarSeed} size={42} />
            </PeerSignalPulseSVG>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="peer-detail-title" className="font-display font-bold text-lg text-[#203A2A]">
                  {peer.callsign}
                </h3>
                <ReputationPill
                  completedExchanges={peer.completedExchanges}
                  size="sm"
                  onClick={() => onOpenReputation(peer)}
                />
              </div>
              <p className="text-xs text-[#588157] font-mono flex items-center gap-1 mt-0.5">
                <Compass className="w-3.5 h-3.5 text-[#87A878]" />
                Bearing {peer.angle}° • {peer.isDirect ? 'Direct RF Link' : `${peer.hopDistance} Mesh Hops`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close peer details"
            className="p-1.5 rounded-full text-[#637062] hover:bg-[#E6EDE1] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bio */}
        <div className="p-3.5 bg-white/85 rounded-2xl border border-[#87A878]/20 text-xs">
          <div className="text-[11px] font-semibold text-[#637062] uppercase tracking-wider mb-1">
            Bioregional Self-Attestation
          </div>
          <p className="text-[#203A2A] leading-relaxed">{peer.bio}</p>
        </div>

        {/* Skills Tag Cloud */}
        {peer.skills && peer.skills.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-[#637062] flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#2A9D8F]" />
              Shared Skills & Knowledge
            </div>
            <div className="flex flex-wrap gap-1.5">
              {peer.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 bg-[#EBF7F5] text-[#165B53] border border-[#2A9D8F]/30 rounded-lg text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Telemetry Matrix */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062]">Signal Strength:</span>
            <SignalStrengthMeterSVG
              rssi={peer.lastRssi}
              connectionState={peer.connectionState}
            />
          </div>

          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062]">Link State:</span>
            <span className="font-semibold text-[#588157] capitalize">
              {peer.connectionState.replace('_', ' ')}
            </span>
          </div>

          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062]">Trust Index:</span>
            <span className="font-bold text-[#203A2A]">{peer.trustScore}/100</span>
          </div>

          <div className="p-2.5 bg-white/80 rounded-xl border border-[#87A878]/20 flex items-center justify-between">
            <span className="text-[#637062]">Relay Health:</span>
            <span className="font-mono font-bold text-[#E76F51]">{peer.relayReliability}%</span>
          </div>
        </div>

        {/* Community Contribution Radar Chart */}
        <PeerContributionRadarChart
          peer={peer}
          isNightMode={isNightMode}
        />

        {/* Low-Energy BLE Heartbeat Ping Test */}
        <div
          id="peer-ble-ping-card"
          className="p-3 bg-[#FAF6EE] dark:bg-[#141F12] rounded-2xl border border-[#87A878]/35 dark:border-[#2A3B26] space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-[#2A9D8F]/20 text-[#2A9D8F]">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="font-display font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                BLE Heartbeat Ping &amp; Latency
              </span>
            </div>

            <button
              id="btn-ping-peer"
              type="button"
              onClick={handlePingPeer}
              disabled={isPinging}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isPinging
                  ? 'bg-[#2A9D8F] text-white animate-pulse'
                  : 'bg-[#203A2A] hover:bg-[#16271c] text-white'
              }`}
              title="Send 16-byte low-energy BLE heartbeat frame to measure link RTT"
            >
              {isPinging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E9C46A]" />
                  <span>Pinging BLE...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Ping Peer</span>
                </>
              )}
            </button>
          </div>

          {lastPingResult ? (
            <div className="p-2.5 bg-white dark:bg-[#1C2C19] rounded-xl border border-[#87A878]/30 dark:border-[#364E30] flex items-center justify-between text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    lastPingResult.status === 'optimal'
                      ? 'bg-[#10B981] animate-ping'
                      : lastPingResult.status === 'good'
                      ? 'bg-[#2A9D8F]'
                      : 'bg-[#F4A261]'
                  }`}
                />
                <div>
                  <div className="font-mono font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <span>{lastPingResult.latencyMs} ms RTT</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans font-medium border ${
                        lastPingResult.status === 'optimal'
                          ? 'bg-[#10B981]/15 text-[#065F46] dark:text-[#34D399] border-[#10B981]/30'
                          : lastPingResult.status === 'good'
                          ? 'bg-[#2A9D8F]/15 text-[#165B53] dark:text-[#38BDF8] border-[#2A9D8F]/30'
                          : 'bg-[#E76F51]/15 text-[#991B1B] dark:text-[#F87171] border-[#E76F51]/30'
                      }`}
                    >
                      {lastPingResult.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                    {lastPingResult.isDirectBle ? 'Direct 0-Hop BLE' : `${lastPingResult.hopCount} Hops`} • {lastPingResult.rssiDbm} dBm • {lastPingResult.packetSizeBytes}B Frame
                  </div>
                </div>
              </div>

              <div className="text-right text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                {new Date(lastPingResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
              Sends an ultra-low energy 16-byte RF heartbeat frame to verify link reachability and round-trip time (RTT) without initiating a full database sync or consuming data bandwidth.
            </p>
          )}
        </div>

        {/* Private Local Notes (Encrypted Storage) */}
        <div
          id="peer-local-notes-container"
          className="p-3.5 bg-gradient-to-br from-[#F5FAF2] to-[#FAF6EE] rounded-2xl border border-[#87A878]/35 shadow-2xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-[#203A2A] text-[#E9C46A]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-display font-bold text-xs text-[#203A2A] flex items-center gap-1.5">
                  Private Local Notes
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono text-[#588157] bg-white/90 px-2 py-0.5 rounded-full border border-[#87A878]/30">
              <ShieldCheck className="w-3 h-3 text-[#2A9D8F]" />
              <span>AES-256 Encrypted</span>
            </div>
          </div>

          <p className="text-[11px] text-[#637062] leading-tight">
            Encrypted exclusively on your local device. Notes are never broadcast across the mesh or shared with peers.
          </p>

          <textarea
            id="peer-private-note-input"
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              if (saveStatus === 'saved') setSaveStatus('idle');
            }}
            placeholder={`Add personal context or reminders about ${peer.callsign} (e.g. shared seeds, loaned solar panels, workshop agreements, preferred rendezvous)...`}
            rows={3}
            className="w-full p-2.5 bg-white border border-[#87A878]/35 rounded-xl text-xs text-[#203A2A] placeholder-[#8F9D8D] focus:outline-none focus:ring-2 focus:ring-[#87A878] transition-all resize-none font-sans leading-relaxed"
          />

          {/* Quick Tag Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-[#637062] font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#E9C46A]" /> Quick tags:
            </span>
            {QUICK_TAG_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAppendTag(tag)}
                className="px-2 py-0.5 bg-white/90 hover:bg-[#EBF5E9] text-[#243B22] border border-[#87A878]/30 hover:border-[#588157] rounded-md text-[10px] font-medium transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-1 border-t border-[#87A878]/20">
            <div className="text-[10px] text-[#637062] font-mono">
              {lastSavedTime ? (
                <span>
                  Saved {new Date(lastSavedTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                  {new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span className="italic">Not saved yet</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {noteText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleClearNote}
                  className="px-2.5 py-1 text-[#C44536] hover:bg-[#FBEBE8] rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveNote}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  saveStatus === 'saved'
                    ? 'bg-[#2A9D8F] text-white'
                    : 'bg-[#203A2A] hover:bg-[#16271c] text-white'
                }`}
              >
                {saveStatus === 'saved' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white animate-in zoom-in-50 duration-150" />
                    <span>Saved Encrypted</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenReputation(peer);
            }}
            className="flex-1 py-2.5 px-3 bg-white text-[#203A2A] border border-[#87A878]/40 hover:bg-[#FAF6EE] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
            Trust Telemetry
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenChat(peer);
            }}
            className="flex-1 py-2.5 px-3 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-[#E9C46A]" />
            Send Mesh Message
          </button>
        </div>
      </div>
    </div>
  );
};

