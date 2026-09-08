import React from 'react';
import { Wifi, WifiOff, Radio, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

export type ConnectionStatusType = 'online' | 'mesh' | 'offline' | 'syncing';

export interface ConnectionStatusInfo {
  status: ConnectionStatusType;
  lastUpdated?: string; // e.g. "12 sec ago"
  detail?: string;       // e.g. "3 radio peers active"
}

export interface StructuredError {
  whatHappened: string;  // Human-readable error description
  whatStillWorks: string; // Capabilities remaining functional off-grid
  whatYouCanDo: string;  // Immediate actionable recommendation
  onRetry?: () => void;
}

export interface FeatureFrameProps {
  title: string;
  purpose: string; // One-sentence purpose in human language
  connectionStatus?: ConnectionStatusType | ConnectionStatusInfo;
  primaryAction?: React.ReactNode;
  loading?: boolean;
  loadingSlot?: React.ReactNode;
  empty?: boolean;
  emptySlot?: React.ReactNode;
  error?: StructuredError | null;
  errorSlot?: React.ReactNode;
  isNightMode?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FeatureFrame: React.FC<FeatureFrameProps> = ({
  title,
  purpose,
  connectionStatus = 'mesh',
  primaryAction,
  loading = false,
  loadingSlot,
  empty = false,
  emptySlot,
  error = null,
  errorSlot,
  isNightMode = false,
  children,
  className = '',
}) => {
  // Process connection status object
  const connInfo: ConnectionStatusInfo =
    typeof connectionStatus === 'string'
      ? { status: connectionStatus, lastUpdated: 'Just now' }
      : connectionStatus;

  const statusBadges = {
    online: {
      label: 'Cloud & Mesh',
      color: 'text-[#2A9D8F]',
      bg: isNightMode ? 'bg-[#2A9D8F]/15 border-[#2A9D8F]/30' : 'bg-[#EBF7F5] border-[#2A9D8F]/20',
      icon: Wifi,
      symbol: '●',
    },
    mesh: {
      label: 'Peer-to-Peer Mesh',
      color: 'text-[#588157]',
      bg: isNightMode ? 'bg-[#588157]/15 border-[#588157]/30' : 'bg-[#F0F5EE] border-[#87A878]/30',
      icon: Radio,
      symbol: '◆',
    },
    offline: {
      label: 'Offline (Local Only)',
      color: 'text-[#E76F51]',
      bg: isNightMode ? 'bg-[#E76F51]/15 border-[#E76F51]/30' : 'bg-[#FDF1EE] border-[#E76F51]/20',
      icon: WifiOff,
      symbol: '▲',
    },
    syncing: {
      label: 'Syncing Mesh State',
      color: 'text-[#E9C46A]',
      bg: isNightMode ? 'bg-[#E9C46A]/15 border-[#E9C46A]/30' : 'bg-[#FEFBF3] border-[#E9C46A]/20',
      icon: RefreshCw,
      symbol: '⟳',
    },
  }[connInfo.status];

  const StatusIcon = statusBadges.icon;

  return (
    <div
      className={`w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 ${className}`}
      data-testid="feature-frame"
    >
      {/* HEADER BAR */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#87A878]/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display font-black text-xl sm:text-2xl text-[#203A2A] dark:text-[#F0F5EE] tracking-tight">
              {title}
            </h1>

            {/* Accessible Multi-Signal Connection Status (Icon + Shape + Text + Color) */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${statusBadges.bg} ${statusBadges.color}`}
              aria-label={`Connection status: ${statusBadges.label}`}
              title={`Status: ${statusBadges.label}. ${connInfo.detail || ''}`}
            >
              <StatusIcon className={`w-3.5 h-3.5 ${connInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
              <span aria-hidden="true" className="font-mono text-[10px]">{statusBadges.symbol}</span>
              <span>{statusBadges.label}</span>
              {connInfo.lastUpdated && (
                <span className="text-[10px] opacity-75 font-normal border-l border-current/20 pl-1.5 ml-0.5">
                  {connInfo.lastUpdated}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#588157] dark:text-[#A8BDA5] leading-relaxed max-w-2xl">
            {purpose}
          </p>
        </div>

        {/* PRIMARY ACTION SLOT */}
        {primaryAction && (
          <div className="self-start sm:self-auto shrink-0 min-h-[44px] min-w-[44px] flex items-center">
            {primaryAction}
          </div>
        )}
      </header>

      {/* ERROR STATE SLOT (Standardized: What happened / What still works / What you can do) */}
      {(error || errorSlot) && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border ${
            isNightMode ? 'bg-[#2B1B18] border-[#E76F51]/40 text-[#F0F5EE]' : 'bg-[#FDF1EE] border-[#E76F51]/30 text-[#203A2A]'
          } space-y-3`}
        >
          {errorSlot || (
            error && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[#E76F51]">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-display font-bold text-sm sm:text-base">
                    What Happened: {error.whatHappened}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="font-bold text-[#588157] dark:text-[#A8BDA5] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F]" />
                      What Still Works:
                    </span>
                    <p className="text-[#588157] dark:text-[#A8BDA5]">{error.whatStillWorks}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="font-bold text-[#E76F51] flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      What You Can Do Now:
                    </span>
                    <p className="text-[#588157] dark:text-[#A8BDA5]">{error.whatYouCanDo}</p>
                  </div>
                </div>

                {error.onRetry && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={error.onRetry}
                      className="px-4 py-2 min-h-[44px] min-w-[44px] bg-[#E76F51] hover:bg-[#d65f42] text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Operation</span>
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* LOADING SLOT */}
      {loading ? (
        loadingSlot || (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-[#588157]" />
            <p className="text-xs font-semibold text-[#588157] dark:text-[#A8BDA5]">
              Loading off-grid data...
            </p>
          </div>
        )
      ) : empty ? (
        /* EMPTY SLOT */
        emptySlot || (
          <div className="py-12 px-4 rounded-3xl border border-dashed border-[#87A878]/40 text-center space-y-3 bg-black/5 dark:bg-white/5">
            <p className="text-sm font-semibold text-[#588157] dark:text-[#A8BDA5]">
              No items found in this section yet.
            </p>
          </div>
        )
      ) : (
        /* MAIN FEATURE CONTENT */
        <main className="w-full">{children}</main>
      )}
    </div>
  );
};
