import React, { useState } from 'react';
import { Plus, X, Radio, Sprout, BookOpen, Search, AlertTriangle, MapPin } from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

interface QuickActionDialProps {
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onOpenJournal: () => void;
  onOpenMap?: () => void;
  onRefreshScan: () => void;
  onTriggerSos: () => void;
  activeWishlistMatchesCount?: number;
  isNightMode?: boolean;
}

export const QuickActionDial: React.FC<QuickActionDialProps> = ({
  onOpenCommandPalette,
  onOpenQuickAdd,
  onOpenJournal,
  onOpenMap,
  onRefreshScan,
  onTriggerSos,
  activeWishlistMatchesCount = 0,
  isNightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    soundFeedback.playClick();
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(30);
    }
    setIsOpen(!isOpen);
  };

  const handleAction = (action: () => void) => {
    soundFeedback.playPacketTransmit();
    action();
    setIsOpen(false);
  };

  return (
    <div
      id="quick-action-dial-hub"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-2 pointer-events-none"
    >
      {/* Backdrop for closing dial on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 pointer-events-auto transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Expanded Action Menu */}
      {isOpen && (
        <div className="z-40 flex flex-col items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-150 pointer-events-auto">
          {/* 1. Quick Add Resource */}
          <button
            type="button"
            id="dial-quick-add-btn"
            onClick={() => handleAction(onOpenQuickAdd)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#FAF6EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/50 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Offer or Request Resource</span>
            <div className="w-7 h-7 rounded-xl bg-[#588157] text-white flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Quick Search */}
          <button
            type="button"
            id="dial-search-btn"
            onClick={() => handleAction(onOpenCommandPalette)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#FAF6EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/50 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Quick Search (⌘K)</span>
            <div className="w-7 h-7 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Open Map */}
          {onOpenMap && (
            <button
              type="button"
              id="dial-map-btn"
              onClick={() => handleAction(onOpenMap)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] text-[#FAF6EE] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/50 hover:bg-[#FAF6EE]'
              }`}
            >
              <span>Explore Resource Map</span>
              <div className="w-7 h-7 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
            </button>
          )}

          {/* 4. Scan Mesh Spectrum */}
          <button
            type="button"
            id="dial-scan-btn"
            onClick={() => handleAction(onRefreshScan)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#FAF6EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/50 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Scan Nearby Peers & Beacons</span>
            <div className="w-7 h-7 rounded-xl bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </button>

          {/* 5. New Reflection */}
          <button
            type="button"
            id="dial-journal-btn"
            onClick={() => handleAction(onOpenJournal)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#FAF6EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/50 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Log Activity Journal</span>
            <div className="w-7 h-7 rounded-xl bg-[#87A878]/20 text-[#588157] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </button>

          {/* 6. Emergency SOS Alert */}
          <button
            type="button"
            id="dial-sos-btn"
            onClick={() => handleAction(onTriggerSos)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl border border-red-500/40 bg-red-600 text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Emergency SOS Beacon</span>
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* Main Trigger Floating Action Button */}
      <button
        id="quick-add-fab-btn"
        data-testid="quick-add-fab-btn"
        type="button"
        onClick={toggleOpen}
        aria-label="Open Quick Actions and Resource Posting Menu"
        title="Quick Actions Menu: Post Offer, Search, Scan Mesh, Map"
        className={`z-40 pointer-events-auto min-h-[48px] px-3.5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 transition-all duration-200 active:scale-95 hover:scale-105 cursor-pointer border ${
          isOpen
            ? 'bg-[#203A2A] text-white border-[#588157]'
            : isNightMode
            ? 'bg-[#203A2A] text-[#E9C46A] border-[#364E30] hover:bg-[#2A3B26]'
            : 'bg-[#203A2A] text-white border-[#87A878]/50 hover:bg-[#16271c]'
        }`}
      >
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 ${
          isOpen ? 'bg-red-600' : 'bg-[#588157]'
        }`}>
          {isOpen ? <X className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
        </div>
        <span className="font-display font-bold text-xs pr-1 hidden sm:inline">
          {isOpen ? 'Close' : 'Quick Actions'}
        </span>

        {/* Wishlist Matches Count Badge */}
        {activeWishlistMatchesCount > 0 && !isOpen && (
          <span
            id="quick-add-wishlist-badge"
            data-testid="quick-add-wishlist-badge"
            className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#E76F51] text-white text-[11px] font-mono font-bold shadow-md border-2 border-[#203A2A] animate-pulse"
            title={`${activeWishlistMatchesCount} active wishlist match${activeWishlistMatchesCount === 1 ? '' : 'es'} found`}
          >
            {activeWishlistMatchesCount}
          </span>
        )}
      </button>
    </div>
  );
};
