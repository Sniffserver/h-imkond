import React from 'react';
import { ReputationTier } from '../types';

export function getReputationTier(completedExchanges: number): ReputationTier {
  if (completedExchanges >= 51) return 'Steward';
  if (completedExchanges >= 10) return 'Verified Peer';
  if (completedExchanges >= 2) return 'Neighbor';
  return 'New Kin';
}

export const REPUTATION_COLORS: Record<
  ReputationTier,
  { bg: string; text: string; border: string; label: string; icon: string; range: string }
> = {
  'Steward': {
    bg: 'bg-[#EBF7F5]',
    text: 'text-[#165B53]',
    border: 'border-[#2A9D8F]',
    label: 'Steward',
    icon: '🌿',
    range: '51+ exchanges',
  },
  'Verified Peer': {
    bg: 'bg-[#F0F5EE]',
    text: 'text-[#344E2C]',
    border: 'border-[#87A878]',
    label: 'Verified Peer',
    icon: '🌾',
    range: '10–50 exchanges',
  },
  'Neighbor': {
    bg: 'bg-[#FDF8EB]',
    text: 'text-[#8C6207]',
    border: 'border-[#E9C46A]',
    label: 'Neighbor',
    icon: '🌱',
    range: '2–9 exchanges',
  },
  'New Kin': {
    bg: 'bg-[#FDF1EE]',
    text: 'text-[#9A3822]',
    border: 'border-[#F4A261]',
    label: 'New Kin',
    icon: '☀️',
    range: '0–1 exchanges',
  },
};

interface ReputationPillProps {
  tier?: ReputationTier;
  completedExchanges?: number;
  onClick?: () => void;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export const ReputationPill: React.FC<ReputationPillProps> = ({
  tier,
  completedExchanges,
  onClick,
  showIcon = true,
  size = 'md',
}) => {
  const resolvedTier: ReputationTier =
    tier || (completedExchanges !== undefined ? getReputationTier(completedExchanges) : 'New Kin');

  const config = REPUTATION_COLORS[resolvedTier] || REPUTATION_COLORS['New Kin'];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${
        config.bg
      } ${config.text} ${config.border} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${
        onClick
          ? 'cursor-pointer hover:shadow-xs active:scale-95'
          : 'cursor-default'
      }`}
      title={`Reputation: ${resolvedTier} (${config.range}) · Local mesh estimate`}
    >
      {showIcon && <span className="text-[11px] leading-none">{config.icon}</span>}
      <span className="font-semibold whitespace-nowrap">{resolvedTier}</span>
    </button>
  );
};
