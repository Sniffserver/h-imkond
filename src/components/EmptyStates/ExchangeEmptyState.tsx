import React from 'react';
import { Sprout, PlusCircle, HandHeart, Sparkles } from 'lucide-react';

interface ExchangeEmptyStateProps {
  onOpenCreateOffering?: () => void;
  onOpenWishlist?: () => void;
  isNightMode?: boolean;
}

export const ExchangeEmptyState: React.FC<ExchangeEmptyStateProps> = ({
  onOpenCreateOffering,
  onOpenWishlist,
  isNightMode = false,
}) => {
  return (
    <div
      role="region"
      aria-label="No resources in exchange"
      className={`p-8 rounded-3xl border text-center flex flex-col items-center justify-center my-4 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
          isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
        }`}
      >
        <Sprout className="w-8 h-8" />
      </div>

      <h3 className="font-display font-bold text-lg mb-1">
        Add Your First Mutual Aid Resource
      </h3>

      <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] max-w-sm mb-4 leading-relaxed">
        List spare tools, solar energy capacity, seeds, medical kits, or specialized skills for local barter and gift sharing.
      </p>

      <div
        className={`p-3 rounded-2xl border text-xs max-w-md w-full mb-6 text-left space-y-1 ${
          isNightMode
            ? 'bg-[#121A10] border-[#364E30]/60 text-[#A8BDA5]'
            : 'bg-white/80 border-[#87A878]/20 text-[#3A4A38]'
        }`}
      >
        <div className="font-bold text-[#203A2A] dark:text-[#E9C46A] flex items-center gap-1.5">
          <HandHeart className="w-3.5 h-3.5 text-[#588157]" />
          <span>Why this matters:</span>
        </div>
        <p>
          Sharing local resources builds community resilience without money or internet, elevating your field Symbiosis Score.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {onOpenCreateOffering && (
          <button
            type="button"
            onClick={onOpenCreateOffering}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'bg-[#2A3B26] hover:bg-[#364E30] text-[#E9C46A]'
                : 'bg-[#588157] hover:bg-[#466845] text-white shadow-sm'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Resource / Skill Offer</span>
          </button>
        )}

        {onOpenWishlist && (
          <button
            type="button"
            onClick={onOpenWishlist}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all active:scale-95 cursor-pointer ${
              isNightMode
                ? 'border-[#364E30] bg-[#121A10] text-[#F0F5EE] hover:bg-[#1A2517]'
                : 'border-[#87A878]/40 bg-white text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Set Keyword Wishlist Alerts</span>
          </button>
        )}
      </div>
    </div>
  );
};
