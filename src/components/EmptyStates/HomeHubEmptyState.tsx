import React from 'react';
import { Cpu, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';

interface HomeHubEmptyStateProps {
  onConnectHub: () => void;
  onDismiss?: () => void;
  isNightMode?: boolean;
}

export const HomeHubEmptyState: React.FC<HomeHubEmptyStateProps> = ({
  onConnectHub,
  onDismiss,
  isNightMode = false,
}) => {
  return (
    <div
      role="region"
      aria-label="Home hub status"
      className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
          }`}
        >
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-display font-bold text-base">Home hub not connected</h3>
          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5 max-w-md">
            You can still use maps, messages, and saved resources. Connect your home hub when you want to scan local radio activity.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={onConnectHub}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
            isNightMode
              ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A]'
              : 'bg-[#588157] hover:bg-[#466845] text-white shadow-xs'
          }`}
        >
          <span>Connect home hub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isNightMode
                ? 'text-[#A8BDA5] hover:text-white'
                : 'text-[#637062] hover:text-[#203A2A]'
            }`}
          >
            Continue without it
          </button>
        )}
      </div>
    </div>
  );
};
