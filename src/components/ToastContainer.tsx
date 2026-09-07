import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-lg border backdrop-blur-md flex items-start gap-3 transition-all transform translate-y-0 duration-200 animate-in fade-in slide-in-from-bottom-3 ${
              isSuccess
                ? 'bg-[#FAF6EE]/95 border-[#87A878]/50 text-[#2B3A28]'
                : isWarning
                ? 'bg-[#FFF8E7]/95 border-[#E9C46A] text-[#7A5200]'
                : 'bg-[#F0F5EE]/95 border-[#2A9D8F]/40 text-[#203A2A]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#588157]" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-[#F4A261]" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-[#2A9D8F]" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-[#2B3A28] leading-tight">
                {toast.title}
              </h4>
              {toast.description && (
                <p className="text-[11px] text-[#637062] mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 -mr-1 -mt-1 text-[#7C8C77] hover:text-[#2B3A28] rounded-full hover:bg-black/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
