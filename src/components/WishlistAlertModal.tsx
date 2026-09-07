import React, { useState } from 'react';
import { WishlistItem, ResourceCategory } from '../types';
import {
  X,
  BellRing,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WishlistAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlist: WishlistItem[];
  onAddWishlistItem: (keyword: string, category?: ResourceCategory | 'all') => void;
  onRemoveWishlistItem: (id: string) => void;
  isNightMode?: boolean;
}

export const WishlistAlertModal: React.FC<WishlistAlertModalProps> = ({
  isOpen,
  onClose,
  wishlist,
  onAddWishlistItem,
  onRemoveWishlistItem,
  isNightMode = false,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedCat, setSelectedCat] = useState<ResourceCategory | 'all'>('all');

  if (!isOpen) return null;

  const categories: (ResourceCategory | 'all')[] = [
    'all',
    'Energy',
    'Tools',
    'Skills',
    'Food',
    'Care & Housing',
    'Bio-Remedy',
    'Electronics',
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    onAddWishlistItem(newKeyword.trim(), selectedCat);
    setNewKeyword('');
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
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F]">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Mesh Resource Wishlist Alerts</h2>
            <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              Get automated toast notifications when matching items enter the mesh.
            </p>
          </div>
        </div>

        {/* Add New Keyword Form */}
        <form onSubmit={handleAdd} className="mb-5 space-y-2.5">
          <label className="block text-xs font-bold text-[#588157]">
            Flag Keyword or Asset Name:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. solar charger, water filter, seeds, battery..."
              className={`flex-1 px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition-colors ${
                isNightMode
                  ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE] focus:border-[#87A878]'
                  : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
              }`}
            />
            <button
              type="submit"
              disabled={!newKeyword.trim()}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer ${
                !newKeyword.trim()
                  ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                  : 'bg-[#588157] hover:bg-[#466845] text-white active:scale-95'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Category Filter selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
            <span className="text-[#637062] dark:text-[#A8BDA5] font-semibold shrink-0">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition-all cursor-pointer ${
                  selectedCat === cat
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                    : isNightMode
                    ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                    : 'bg-white text-[#637062] border-[#87A878]/30'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </form>

        {/* Active Wishlist Rules List */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#588157] pb-1 border-b border-current/10">
            <span>Active Wishlist Alerts ({wishlist.length})</span>
            <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
              Real-time BLE Scan Active
            </span>
          </div>

          {wishlist.length === 0 ? (
            <div
              className={`p-4 rounded-2xl text-center border text-xs ${
                isNightMode
                  ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                  : 'bg-white/80 border-[#87A878]/20 text-[#637062]'
              }`}
            >
              <Sparkles className="w-5 h-5 mx-auto mb-1 text-[#E9C46A]" />
              <p className="font-semibold">No active wishlist alerts set yet.</p>
              <p className="text-[11px] mt-0.5">
                Add keywords above (e.g. "solar", "seedlings") to be alerted immediately when peers broadcast matching resources.
              </p>
            </div>
          ) : (
            wishlist.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]'
                    : 'bg-white border-[#87A878]/30 text-[#203A2A]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs">"{item.keyword}"</span>
                    {item.category && item.category !== 'all' && (
                      <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#2A9D8F]/15 text-[#2A9D8F] font-semibold">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveWishlistItem(item.id)}
                  className={`p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0`}
                  title="Remove alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-current/10 flex items-center justify-between text-xs text-[#637062] dark:text-[#A8BDA5]">
          <span className="flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F]" />
            Local evaluation • No data sent off-device
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#203A2A] hover:bg-[#16271c] text-white font-bold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
