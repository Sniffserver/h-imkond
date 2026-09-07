import React, { useState } from 'react';
import { Plus, X, Radio, Sprout, BookOpen, Search, AlertTriangle } from 'lucide-react';
import { soundFeedback } from '../services/soundFeedback';

interface QuickActionDialProps {
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onOpenJournal: () => void;
  onRefreshScan: () => void;
  onTriggerSos: () => void;
  isNightMode?: boolean;
}

export const QuickActionDial: React.FC<QuickActionDialProps> = ({
  onOpenCommandPalette,
  onOpenQuickAdd,
  onOpenJournal,
  onRefreshScan,
  onTriggerSos,
  isNightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    soundFeedback.playClick();
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
          className="fixed inset-0 bg-black/25 backdrop-blur-xs z-30 pointer-events-auto transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Expanded Action Menu */}
      {isOpen && (
        <div className="z-40 flex flex-col items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-150 pointer-events-auto">
          {/* Quick Search */}
          <button
            type="button"
            onClick={() => handleAction(onOpenCommandPalette)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Command Palette & Search</span>
            <div className="w-7 h-7 rounded-xl bg-[#2A9D8F]/15 flex items-center justify-center text-[#2A9D8F]">
              <Search className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Quick Add Resource */}
          <button
            type="button"
            onClick={() => handleAction(onOpenQuickAdd)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Offer / Request Resource</span>
            <div className="w-7 h-7 rounded-xl bg-[#588157]/15 flex items-center justify-center text-[#588157]">
              <Sprout className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* New Reflection */}
          <button
            type="button"
            onClick={() => handleAction(onOpenJournal)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Log Co-Evolution Journal</span>
            <div className="w-7 h-7 rounded-xl bg-[#E9C46A]/20 flex items-center justify-center text-[#8C6207] dark:text-[#E9C46A]">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Scan Spectrum */}
          <button
            type="button"
            onClick={() => handleAction(onRefreshScan)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
            }`}
          >
            <span>Scan 2.4GHz Spectrum Beacons</span>
            <div className="w-7 h-7 rounded-xl bg-[#2A9D8F]/15 flex items-center justify-center text-[#2A9D8F]">
              <Radio className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Emergency SOS Quick Option */}
          <button
            type="button"
            onClick={() => handleAction(onTriggerSos)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border border-red-500/40 bg-red-600 text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Emergency SOS Alert</span>
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* Main Trigger Floating Action Button */}
      <button
        id="quick-action-fab"
        type="button"
        onClick={toggleOpen}
        aria-label="Open Solarpunk Quick Actions Menu"
        className={`z-40 pointer-events-auto w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 cursor-pointer border ${
          isOpen
            ? 'bg-[#203A2A] text-white border-[#588157] rotate-90'
            : isNightMode
            ? 'bg-[#2A3B26] text-[#E9C46A] border-[#364E30] hover:bg-[#364E30]'
            : 'bg-[#203A2A] text-[#FAF6EE] border-[#87A878]/50 hover:bg-[#2B3A28]'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
};
