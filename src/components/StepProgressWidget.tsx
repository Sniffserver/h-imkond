import React from 'react';
import { Footprints, Settings } from 'lucide-react';

interface StepProgressWidgetProps {
  totalSteps: number;
  stepsPerReveal: number;
  onOpenSettings?: () => void;
  isNightMode?: boolean;
}

export const StepProgressWidget: React.FC<StepProgressWidgetProps> = ({
  totalSteps,
  stepsPerReveal,
  onOpenSettings,
  isNightMode = false,
}) => {
  const currentProgressSteps = totalSteps % stepsPerReveal;
  const progress = currentProgressSteps / stepsPerReveal;
  const stepsRemaining = stepsPerReveal - currentProgressSteps;

  return (
    <div 
      id="step-progress-widget"
      className={`absolute top-4 left-4 z-30 rounded-2xl p-3.5 shadow-lg border backdrop-blur-md transition-all duration-300 flex flex-col gap-2 w-48 sm:w-56 animate-in fade-in slide-in-from-top-3 duration-200 ${
        isNightMode 
          ? 'bg-[#182315]/90 border-[#2A3B26] text-[#F0F5EE]' 
          : 'bg-white/95 border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-display font-bold text-xs">
          <Footprints className="w-4 h-4 text-[#E76F51]" />
          <span>Kõnni ja ava</span>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1 rounded-lg hover:bg-current/10 transition-colors cursor-pointer text-[#588157]"
            title="Sammude seaded"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Kokku samme:</span>
        <span className="font-mono text-xs font-bold">{totalSteps}</span>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-1">
        <div className="w-full h-2 bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/15 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#E76F51] to-[#2A9D8F] transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-[9px] text-[#637062] dark:text-[#A8BDA5] font-mono">
          <span>{currentProgressSteps} / {stepsPerReveal}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      <p className="text-[9.5px] leading-tight text-[#637062] dark:text-[#A8BDA5]">
        Veel <strong className="font-mono text-[#E76F51]">{stepsRemaining} sammu</strong> järgmise piirkonna avamiseni!
      </p>
    </div>
  );
};
