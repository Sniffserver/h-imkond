import React from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { ActiveUndoState } from '../../hooks/useUndoAction';

interface UndoToastProps {
  activeUndo: ActiveUndoState | null;
  onUndo: () => void;
  onDismiss: () => void;
  isNightMode?: boolean;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  activeUndo,
  onUndo,
  onDismiss,
  isNightMode = false,
}) => {
  if (!activeUndo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-5 duration-200"
    >
      <div
        className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md ${
          isNightMode
            ? 'bg-[#182315]/95 border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0" />
          <span className="text-xs font-semibold truncate">
            {activeUndo.action.message}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            className="px-3 py-1.5 min-h-[44px] min-w-[44px] bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {activeUndo.action.category === 'message' ? 'Cancel' : 'Undo'}
            </span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss undo notification"
            className="p-2 min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[#637062] cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
