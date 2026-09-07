import React, { useState, useMemo } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { MeshMessage, Transaction } from '../types';
import { soundFeedback } from '../services/utils/soundFeedback';
import {
  WifiOff,
  Radio,
  RefreshCw,
  Clock,
  ShieldCheck,
  HardDrive,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
} from 'lucide-react';

interface OfflineSyncProgressProps {
  messages?: MeshMessage[];
  transactions?: Transaction[];
  onTriggerMeshSync?: () => void;
  isNightMode?: boolean;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const OfflineSyncProgress: React.FC<OfflineSyncProgressProps> = ({
  messages = [],
  transactions = [],
  onTriggerMeshSync,
  isNightMode = false,
  onAddToast,
}) => {
  const isOnline = useOnlineStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    const saved = localStorage.getItem('hoimu_last_sync_timestamp');
    return saved ? parseInt(saved, 10) : Date.now();
  });

  // Calculate pending packets
  const pendingMessages = useMemo(() => {
    return messages.filter(
      (m) => m.status === 'pending' || m.status === 'queued' || (!m.isIncoming && m.status !== 'delivered')
    );
  }, [messages]);

  const pendingTransactions = useMemo(() => {
    return transactions.filter((t) => t.status === 'pending');
  }, [transactions]);

  const totalPending = pendingMessages.length + pendingTransactions.length;

  // If online and no pending packets, do not show offline alert
  if (isOnline && totalPending === 0) {
    return null;
  }

  const handleManualSync = () => {
    setIsSyncing(true);
    soundFeedback.playPacketTransmit();

    if (onTriggerMeshSync) {
      onTriggerMeshSync();
    }

    setTimeout(() => {
      setIsSyncing(false);
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('hoimu_last_sync_timestamp', now.toString());

      onAddToast?.(
        '⚡ Mesh Packets Broadcasted',
        totalPending > 0
          ? `${totalPending} packet${totalPending === 1 ? '' : 's'} dispatched to local BLE & Wi-Fi Direct store-and-forward neighbors.`
          : 'RF beacon broadcast complete. All local queues are up to date.',
        'success'
      );
    }, 900);
  };

  const minutesSinceSync = Math.max(0, Math.floor((Date.now() - lastSyncTime) / 60000));

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
        isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
      }`}
    >
      <div
        className={`rounded-2xl border shadow-xl backdrop-blur-md transition-colors overflow-hidden ${
          isNightMode
            ? 'bg-[#182315]/95 border-[#364E30] shadow-black/40'
            : 'bg-[#FAF6EE]/95 border-[#87A878]/50 shadow-[#2A9D8F]/10'
        }`}
      >
        {/* Main Status Bar */}
        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                !isOnline
                  ? 'bg-[#E76F51]/20 text-[#E76F51] border border-[#E76F51]/30 animate-pulse'
                  : 'bg-[#2A9D8F]/20 text-[#2A9D8F] border border-[#2A9D8F]/30'
              }`}
            >
              {!isOnline ? <WifiOff className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xs sm:text-sm truncate">
                  {!isOnline ? 'Local-Only Mesh Active' : 'Store & Forward Mesh'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                    totalPending > 0
                      ? 'bg-[#E9C46A]/25 text-[#9A6A12] dark:text-[#E9C46A] border border-[#E9C46A]/40'
                      : 'bg-[#588157]/20 text-[#588157] dark:text-[#87A878] border border-[#588157]/30'
                  }`}
                >
                  {totalPending > 0 ? `${totalPending} Queued` : 'Synced'}
                </span>
              </div>

              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono truncate">
                {!isOnline ? 'No cloud • P2P RF RF relays only' : 'Direct peer mesh connected'} •{' '}
                {minutesSinceSync === 0 ? 'Just synced' : `Synced ${minutesSinceSync}m ago`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Immediate Burst / Relay Broadcast */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Broadcast pending packets to in-range RF neighbors"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                isSyncing
                  ? 'bg-[#E9C46A] text-[#1A2617] animate-pulse'
                  : 'bg-[#588157] hover:bg-[#476a46] text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Broadcasting...' : 'Relay Sync'}</span>
            </button>

            {/* Expand / Details Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                isNightMode
                  ? 'border-[#364E30] hover:bg-[#223120] text-[#A8BDA5]'
                  : 'border-[#87A878]/40 hover:bg-white text-[#637062]'
              }`}
              title={isExpanded ? 'Hide packet queue' : 'Inspect pending mesh packets'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Sync Progress Bar */}
        <div className="w-full bg-black/10 dark:bg-white/10 h-1">
          <div
            className={`h-full transition-all duration-500 ${
              totalPending === 0
                ? 'bg-[#2A9D8F] w-full'
                : 'bg-gradient-to-r from-[#E76F51] to-[#E9C46A] w-2/3 animate-pulse'
            }`}
          />
        </div>

        {/* Expandable Details Drawer */}
        {isExpanded && (
          <div
            className={`p-3.5 sm:p-4 border-t space-y-3 max-h-72 overflow-y-auto text-xs ${
              isNightMode ? 'border-[#364E30] bg-[#121B10]' : 'border-[#87A878]/30 bg-white/80'
            }`}
          >
            {/* Status explanation */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#2A9D8F]/10 border border-[#2A9D8F]/25 text-[#2A9D8F]">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="block font-semibold">Zero-Cloud Sovereign Storage:</strong>
                All outgoing messages and transactions are signed with your local Ed25519 key and stored safely in device storage. When mesh neighbors come within RF radio range (BLE or Wi-Fi Direct), packets relay automatically without requiring any internet access.
              </div>
            </div>

            {/* Pending Packets List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#637062] dark:text-[#87A878]">
                <span>PENDING STORE-AND-FORWARD PACKETS ({totalPending})</span>
                <span>LOCAL QUEUE</span>
              </div>

              {totalPending === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-current/20 text-center text-[#588157] flex items-center justify-center gap-1.5 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All local mesh packets delivered and acknowledged</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Messages */}
                  {pendingMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-[11px] truncate block">
                            Message to {msg.to || msg.recipientCallsign || 'Mesh Peer'}
                          </span>
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate block">
                            {msg.text || msg.decryptedText || 'Encrypted mesh payload'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[#E9C46A]/20 text-[#9A6A12] dark:text-[#E9C46A] shrink-0">
                        Queued for Hop
                      </span>
                    </div>
                  ))}

                  {/* Transactions */}
                  {pendingTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Repeat className="w-3.5 h-3.5 text-[#E76F51] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-[11px] truncate block">
                            Exchange: {tx.resourceTitle}
                          </span>
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] truncate block">
                            With {tx.providerCallsign === tx.requesterCallsign ? 'Peer' : (tx.providerCallsign || tx.requesterCallsign)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[#E76F51]/20 text-[#E76F51] shrink-0">
                        Awaiting Handshake
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Storage Quota & Local Radio Info */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#87A878] pt-2 border-t border-current/10">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-[#588157]" /> Encrypted Local Store: 100% Offline
              </span>
              <span className="flex items-center gap-1 text-[#2A9D8F]">
                <Zap className="w-3 h-3" /> BLE 5.2 / Wi-Fi Direct Store-and-Forward
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default OfflineSyncProgress;
