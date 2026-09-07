import React, { useState } from 'react';
import { SentimentType } from '../types';
import { Sprout, Heart, Sparkles, TrendingUp, X } from 'lucide-react';

interface ReflectionDialogProps {
  partnerCallsign: string;
  resourceTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveReflection: (reflectionText: string, sentiment: SentimentType) => void;
}

export const ReflectionDialog: React.FC<ReflectionDialogProps> = ({
  partnerCallsign,
  resourceTitle,
  isOpen,
  onClose,
  onSaveReflection,
}) => {
  const [reflectionText, setReflectionText] = useState('');
  const [sentiment, setSentiment] = useState<SentimentType>('positive');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText.trim()) return;
    onSaveReflection(reflectionText.trim(), sentiment);
    setReflectionText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="reflection-dialog"
        className="w-full max-w-lg bg-[#FAF6EE] rounded-3xl border border-[#87A878]/35 shadow-2xl p-5 sm:p-6 relative overflow-hidden space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#87A878]/20 flex items-center justify-center text-[#203A2A]">
              <Sprout className="w-5 h-5 text-[#588157]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#203A2A]">
                Co-Evolution Journal
              </h3>
              <p className="text-xs text-[#588157]">
                Record your reflection to complete the exchange
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#637062] hover:bg-[#E6EDE1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exchange Context */}
          <div className="bg-white/85 p-3 rounded-2xl border border-[#87A878]/20 text-xs">
            <div className="text-[#637062]">
              Resource:{' '}
              <strong className="text-[#203A2A]">{resourceTitle}</strong>
            </div>
            <div className="text-[#637062] mt-0.5">
              Mutual Aid Partner:{' '}
              <strong className="text-[#203A2A]">{partnerCallsign}</strong>
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs font-bold text-[#203A2A] mb-1.5 flex items-center justify-between">
              <span>How did this exchange strengthen your bioregion?</span>
              <span className="text-[10px] font-mono text-[#E76F51] bg-[#FDF1EE] border border-[#E76F51]/30 px-2 py-0.5 rounded-full font-bold">
                +5 Symbiosis
              </span>
            </label>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="E.g., Repaired local microgrid hardware, tested solar load, and shared regional maintenance insights..."
              rows={3}
              required
              className="w-full p-3.5 rounded-2xl bg-white border border-[#87A878]/35 focus:outline-none focus:ring-2 focus:ring-[#87A878] text-xs text-[#203A2A] placeholder-[#9CA3AF] resize-none leading-relaxed"
            />
          </div>

          {/* Sentiment Selector */}
          <div>
            <label className="block text-xs font-bold text-[#203A2A] mb-1.5">
              Exchange Sentiment & Bioregional Harmony:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSentiment('positive')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                  sentiment === 'positive'
                    ? 'bg-[#588157] text-white border-[#588157] shadow-xs'
                    : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                Positive
              </button>

              <button
                type="button"
                onClick={() => setSentiment('growth')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                  sentiment === 'growth'
                    ? 'bg-[#E9C46A] text-[#243128] border-[#E9C46A] shadow-xs'
                    : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Growth
              </button>

              <button
                type="button"
                onClick={() => setSentiment('neutral')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                  sentiment === 'neutral'
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                    : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Neutral
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#637062] hover:text-[#203A2A] rounded-xl"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!reflectionText.trim()}
              className="px-5 py-2.5 bg-[#203A2A] hover:bg-[#16271c] disabled:opacity-40 text-white text-xs font-bold rounded-2xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Sprout className="w-4 h-4 text-[#E9C46A]" />
              Save to Journal (+5 Symbiosis)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
