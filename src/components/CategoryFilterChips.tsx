import React from 'react';
import { ResourceCategory } from '../types';

export const CATEGORY_STYLES: Record<
  ResourceCategory, 
  { bg: string; text: string; border: string; activeBg: string; dot: string }
> = {
  'Energy': {
    bg: 'bg-[#FDF8EB]',
    text: 'text-[#8C6207]',
    border: 'border-[#E9C46A]',
    activeBg: 'bg-[#E9C46A] text-[#2C1F03]',
    dot: '#E9C46A',
  },
  'Tools': {
    bg: 'bg-[#FDF1EE]',
    text: 'text-[#9A3822]',
    border: 'border-[#E76F51]',
    activeBg: 'bg-[#E76F51] text-white',
    dot: '#E76F51',
  },
  'Skills': {
    bg: 'bg-[#EBF7F5]',
    text: 'text-[#165B53]',
    border: 'border-[#2A9D8F]',
    activeBg: 'bg-[#2A9D8F] text-white',
    dot: '#2A9D8F',
  },
  'Food': {
    bg: 'bg-[#F2F6F0]',
    text: 'text-[#344E2C]',
    border: 'border-[#87A878]',
    activeBg: 'bg-[#87A878] text-white',
    dot: '#87A878',
  },
  'Care & Housing': {
    bg: 'bg-[#FAF4EE]',
    text: 'text-[#7A4E27]',
    border: 'border-[#D4A373]',
    activeBg: 'bg-[#D4A373] text-white',
    dot: '#D4A373',
  },
  'Electronics': {
    bg: 'bg-[#EEF2FF]',
    text: 'text-[#3730A3]',
    border: 'border-[#6366F1]',
    activeBg: 'bg-[#6366F1] text-white',
    dot: '#6366F1',
  },
  'Bio-Remedy': {
    bg: 'bg-[#EFF5EE]',
    text: 'text-[#253E2A]',
    border: 'border-[#588157]',
    activeBg: 'bg-[#588157] text-white',
    dot: '#588157',
  },
};

interface CategoryFilterChipsProps {
  selectedCategory: ResourceCategory | 'ALL';
  onSelectCategory: (category: ResourceCategory | 'ALL') => void;
  categoryCounts: Record<ResourceCategory | 'ALL', number>;
}

export const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  const categories: (ResourceCategory | 'ALL')[] = [
    'ALL',
    'Energy',
    'Tools',
    'Skills',
    'Food',
    'Care & Housing',
    'Bio-Remedy',
    'Electronics',
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        const count = categoryCounts[cat] || 0;

        if (cat === 'ALL') {
          return (
            <button
              key="all"
              id="filter-chip-all"
              onClick={() => onSelectCategory('ALL')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                isSelected
                  ? 'bg-[#2B3A28] text-[#F0F4ED] border-[#2B3A28] shadow-xs'
                  : 'bg-white/80 text-[#4A5D45] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <span>All Bioregional Needs</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                isSelected ? 'bg-white/20 text-white' : 'bg-[#E6EDE1] text-[#2B3A28]'
              }`}>
                {count}
              </span>
            </button>
          );
        }

        const style = CATEGORY_STYLES[cat];
        return (
          <button
            key={cat}
            id={`filter-chip-${cat.toLowerCase().replace(/[^a-z]/g, '-')}`}
            onClick={() => onSelectCategory(cat)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              isSelected
                ? `${style.activeBg} border-transparent shadow-xs font-semibold`
                : `${style.bg} ${style.border} hover:opacity-90`
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isSelected ? '#FFFFFF' : style.dot }}
            />
            <span className="whitespace-nowrap">{cat}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-black/20 text-white' : 'bg-white/60 text-inherit'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
