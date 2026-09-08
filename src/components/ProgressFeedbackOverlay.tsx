import React, { useEffect, useState } from 'react';
import { TrackChangeReason } from '../services/game/progressTracksService';
import { ShieldCheck, Users, Sprout, X, ExternalLink } from 'lucide-react';

interface ProgressFeedbackOverlayProps {
  changeReason: TrackChangeReason | null;
  onClose: () => void;
  onNavigate?: (target: string) => void;
  isNightMode?: boolean;
}

export const ProgressFeedbackOverlay: React.FC<ProgressFeedbackOverlayProps> = ({
  changeReason,
  onClose,
  onNavigate,
  isNightMode = false,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (changeReason) {
      setVisible(true);
      const timer = setTimeout(() => {
        handleDismiss();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [changeReason]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleAction = () => {
    if (changeReason?.actionTarget && onNavigate) {
      onNavigate(changeReason.actionTarget);
    }
    handleDismiss();
  };

  if (!changeReason) return null;

  const trackInfo = {
    preparedness: {
      title: 'Preparedness increased',
      color: '#E76F51',
      bg: isNightMode ? 'bg-[#E76F51]/15' : 'bg-[#FDF1EE]',
      border: 'border-[#E76F51]/40',
      icon: ShieldCheck,
    },
    connection: {
      title: 'Local Connection strengthened',
      color: '#2A9D8F',
      bg: isNightMode ? 'bg-[#2A9D8F]/15' : 'bg-[#F4FAFA]',
      border: 'border-[#2A9D8F]/40',
      icon: Users,
    },
    contribution: {
      title: 'Community Contribution updated',
      color: '#588157',
      bg: isNightMode ? 'bg-[#588157]/15' : 'bg-[#F4F8F3]',
      border: 'border-[#588157]/40',
      icon: Sprout,
    },
  }[changeReason.track];

  const IconComponent = trackInfo.icon;

  return (
    <div
      className={`fixed bottom-6 right-6 z-100 max-w-sm w-full transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div
        className={`relative rounded-2xl border p-5 shadow-xl backdrop-blur-md space-y-3.5 ${
          isNightMode ? 'bg-[#182315]/95 text-[#F0F5EE]' : 'bg-[#FAF6EE]/95 text-[#203A2A]'
        } ${trackInfo.border}`}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#637062] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${trackInfo.bg}`}
            style={{ color: trackInfo.color }}
          >
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: trackInfo.color }}
            >
              {trackInfo.title}
            </div>
            <h4 className="font-display font-bold text-base leading-tight">
              {changeReason.title}
            </h4>
          </div>
        </div>

        <p className="text-xs text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
          {changeReason.explanation}
        </p>

        {/* Why did this change indicator */}
        <div className="text-[10px] font-mono text-[#87A878] bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
          <span>Why did this change?</span>
          <span className="font-bold">+{changeReason.deltaPercent}% {changeReason.track}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {changeReason.actionLabel && (
            <button
              type="button"
              onClick={handleAction}
              className="flex-1 py-2 px-3 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>{changeReason.actionLabel}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              changeReason.actionLabel ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10' : 'w-full bg-[#588157] text-white'
            }`}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
