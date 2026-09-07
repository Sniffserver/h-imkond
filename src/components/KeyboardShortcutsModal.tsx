import React from 'react';
import { Keyboard, X, Command, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightMode?: boolean;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  isNightMode = false,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'General & Navigation',
      items: [
        { key: 'Cmd/Ctrl + K', description: 'Open Global Command Palette & Solarpunk Search' },
        { key: '1 – 6', description: 'Switch tabs (Mesh, Map, Pathfinder, Exchange, Journal, Profile)' },
        { key: '?', description: 'Show keyboard shortcuts guide' },
        { key: 'Esc', description: 'Close any active modal, dialog, or drawer' },
      ],
    },
    {
      category: 'Field Actions & Hardware',
      items: [
        { key: 'R', description: 'Trigger 2.4GHz BLE & Wi-Fi Direct spectrum scan' },
        { key: 'N', description: 'Toggle Day / Night Mode (Deep Forest Dark #182315)' },
        { key: 'F', description: 'Toggle ADHD Focus Mode (Reduce motion & clutter)' },
        { key: 'S', description: 'Toggle Solar-Saver Mode (15-min battery conserve cycle)' },
        { key: 'G', description: 'Toggle Glove Mode (Enlarged 56dp touch targets)' },
      ],
    },
  ];

  return (
    <div
      id="keyboard-shortcuts-backdrop"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="keyboard-shortcuts-dialog"
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isNightMode ? 'border-[#364E30] bg-[#121A10]' : 'border-[#87A878]/25 bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base">
                Field Terminal Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-[#637062]">
                Instant hotkeys for rapid offline mesh operations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#637062] hover:text-[#203A2A] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[60vh] text-xs">
          {shortcuts.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-[#637062]">
                {group.category}
              </h4>
              <div
                className={`divide-y rounded-2xl border overflow-hidden ${
                  isNightMode
                    ? 'divide-[#364E30]/50 border-[#364E30] bg-[#121A10]/50'
                    : 'divide-[#87A878]/20 border-[#87A878]/30 bg-white/70'
                }`}
              >
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-3.5 py-2.5 gap-3"
                  >
                    <span className="text-[#203A2A] dark:text-[#F0F5EE] font-medium">
                      {item.description}
                    </span>
                    <kbd
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border shadow-xs whitespace-nowrap ${
                        isNightMode
                          ? 'bg-[#2A3B26] border-[#364E30] text-[#E9C46A]'
                          : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
                      }`}
                    >
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t text-[11px] font-mono flex items-center justify-between ${
            isNightMode ? 'border-[#364E30] bg-[#121A10] text-[#A8BDA5]' : 'border-[#87A878]/25 bg-white/50 text-[#637062]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
            Press <kbd className="px-1 py-0.5 rounded bg-black/10">?</kbd> anytime to toggle
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-xl bg-[#203A2A] text-white font-semibold cursor-pointer hover:bg-[#2B3A28] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
