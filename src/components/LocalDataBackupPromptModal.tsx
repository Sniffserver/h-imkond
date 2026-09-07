import React, { useState } from 'react';
import { ShieldCheck, Download, Clock, HardDrive, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface LocalDataBackupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJSON: () => void;
  isNightMode?: boolean;
}

export const LocalDataBackupPromptModal: React.FC<LocalDataBackupPromptModalProps> = ({
  isOpen,
  onClose,
  onExportJSON,
  isNightMode = false,
}) => {
  const [reminderDays, setReminderDays] = useState<number>(14);
  const [isExported, setIsExported] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    onExportJSON();
    setIsExported(true);
    localStorage.setItem('hoimu_backup_prompt_dismissed', 'true');
    localStorage.setItem('hoimu_backup_frequency_days', reminderDays.toString());
    localStorage.setItem('hoimu_last_backup_timestamp', Date.now().toString());

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleDismiss = () => {
    localStorage.setItem('hoimu_backup_prompt_dismissed', 'true');
    localStorage.setItem('hoimu_backup_frequency_days', reminderDays.toString());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
          title="Dismiss for now"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#588157]/20 border border-[#87A878]/40 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-6 h-6 text-[#588157] dark:text-[#87A878]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] text-[10px] font-mono font-bold border border-[#E9C46A]/40 mb-0.5">
              <HardDrive className="w-3 h-3" />
              100% Zero-Cloud Storage
            </div>
            <h2 className="font-display font-bold text-xl tracking-tight">
              Local Ledger Resilience Setup
            </h2>
          </div>
        </div>

        {/* Description & Resilience Benefits */}
        <div className="space-y-3.5 mb-6 text-xs leading-relaxed">
          <p
            className={`p-3 rounded-2xl border ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-white/80 border-[#87A878]/30 text-[#637062]'
            }`}
          >
            HÕIMU operates as a self-sovereign offline mesh application. Your completed mutual aid exchanges, symbiosis points, and journal reflections are stored <strong>strictly on this device</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-medium">
            <div
              className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                isNightMode ? 'bg-[#223120] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/25'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#2A9D8F] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#2A9D8F] block">Zero-Cloud Privacy</span>
                <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                  No central servers or third-party databases.
                </span>
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                isNightMode ? 'bg-[#223120] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/25'
              }`}
            >
              <HardDrive className="w-4 h-4 text-[#E9C46A] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#E9C46A] block">Device Loss Protection</span>
                <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                  Export `.json` backups to prevent data loss.
                </span>
              </div>
            </div>
          </div>

          {/* Backup Frequency Selector */}
          <div className="pt-2">
            <label className="block text-xs font-bold mb-1.5 text-[#588157]">
              Periodic Backup Reminder Schedule:
            </label>
            <div className="flex items-center gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setReminderDays(days)}
                  className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    reminderDays === days
                      ? 'bg-[#588157] text-white border-[#588157] shadow-xs'
                      : isNightMode
                      ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/50'
                      : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Every {days} Days
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExported}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isExported
                ? 'bg-[#2A9D8F] text-white'
                : 'bg-[#203A2A] hover:bg-[#16271c] text-white active:scale-98'
            }`}
          >
            {isExported ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#E9C46A] animate-bounce" />
                <span>Backup JSON Downloaded & Saved!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#E9C46A]" />
                <span>Export Local Ledger JSON Now</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className={`w-full py-2.5 px-4 rounded-2xl font-semibold text-xs border transition-colors cursor-pointer ${
              isNightMode
                ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:bg-[#2A3B26]'
                : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:bg-[#E6EDE1]'
            }`}
          >
            I'll Backup Later (Dismiss Setup)
          </button>
        </div>
      </div>
    </div>
  );
};
