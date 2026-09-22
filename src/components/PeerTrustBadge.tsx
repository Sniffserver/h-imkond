import React from 'react';
import { Award, ShieldCheck, CheckCircle2, Zap, Shield } from 'lucide-react';

export interface PeerTrustBadgeProps {
  completedExchanges: number;
  peerId?: string;
  isNightMode?: boolean;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export interface ExchangeTrustConfig {
  tierName: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  lightBg: string;
  lightText: string;
  lightBorder: string;
  nightBg: string;
  nightText: string;
  nightBorder: string;
  description: string;
}

export function getExchangeTrustConfig(completedExchanges: number): ExchangeTrustConfig {
  const count = Math.max(0, completedExchanges || 0);

  if (count >= 15) {
    return {
      tierName: 'Champion Exchanger',
      shortLabel: `${count} trades`,
      icon: Award,
      lightBg: 'bg-[#FDF6E2]',
      lightText: 'text-[#8C6207]',
      lightBorder: 'border-[#E9C46A]',
      nightBg: 'bg-[#2E2410]',
      nightText: 'text-[#F3D78A]',
      nightBorder: 'border-[#E9C46A]/60',
      description: `High-frequency trading partner (${count} successful exchanges). Exceptional local peer reliability.`,
    };
  }

  if (count >= 8) {
    return {
      tierName: 'Active Exchanger',
      shortLabel: `${count} trades`,
      icon: ShieldCheck,
      lightBg: 'bg-[#EBF7F5]',
      lightText: 'text-[#165B53]',
      lightBorder: 'border-[#2A9D8F]',
      nightBg: 'bg-[#112926]',
      nightText: 'text-[#5CD2C3]',
      nightBorder: 'border-[#2A9D8F]/60',
      description: `Active exchange partner (${count} successful transfers). High mutual network trust.`,
    };
  }

  if (count >= 3) {
    return {
      tierName: 'Proven Partner',
      shortLabel: `${count} trades`,
      icon: CheckCircle2,
      lightBg: 'bg-[#EFF5EC]',
      lightText: 'text-[#2D5A27]',
      lightBorder: 'border-[#588157]',
      nightBg: 'bg-[#182B18]',
      nightText: 'text-[#87D07B]',
      nightBorder: 'border-[#588157]/60',
      description: `Proven exchange history (${count} verified trades). Establishing local barter record.`,
    };
  }

  if (count >= 1) {
    return {
      tierName: 'Emerging Peer',
      shortLabel: `${count} trade`,
      icon: Zap,
      lightBg: 'bg-[#F4F7F2]',
      lightText: 'text-[#476043]',
      lightBorder: 'border-[#87A878]/60',
      nightBg: 'bg-[#1B261A]',
      nightText: 'text-[#A4C49F]',
      nightBorder: 'border-[#87A878]/40',
      description: `Initial transfer completed (${count} exchange). Growing barter connection.`,
    };
  }

  return {
    tierName: 'New Kin',
    shortLabel: '0 trades',
    icon: Shield,
    lightBg: 'bg-[#F9F9F8]',
    lightText: 'text-[#737871]',
    lightBorder: 'border-[#D1D5CB]',
    nightBg: 'bg-[#212620]',
    nightText: 'text-[#9AA297]',
    nightBorder: 'border-[#3D473B]',
    description: 'No verified exchanges yet on this local mesh node.',
  };
}

export const PeerTrustBadge: React.FC<PeerTrustBadgeProps> = ({
  completedExchanges,
  peerId,
  isNightMode = false,
  size = 'xs',
  onClick,
  className = '',
}) => {
  const config = getExchangeTrustConfig(completedExchanges);
  const Icon = config.icon;

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[9px] gap-1'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1.5'
      : 'px-2.5 py-1 text-xs gap-1.5';

  const iconSizes = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const themeClasses = isNightMode
    ? `${config.nightBg} ${config.nightText} ${config.nightBorder}`
    : `${config.lightBg} ${config.lightText} ${config.lightBorder}`;

  const badgeContent = (
    <>
      <Icon className={`${iconSizes} shrink-0`} />
      <span className="font-semibold whitespace-nowrap">{config.shortLabel}</span>
    </>
  );

  const titleText = `Trust Badge: ${config.tierName} • ${config.description}`;
  const elementId = peerId ? `peer-trust-badge-${peerId}` : `peer-trust-badge-${completedExchanges}`;

  if (onClick) {
    return (
      <button
        id={elementId}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={titleText}
        aria-label={titleText}
        className={`inline-flex items-center rounded-md border font-mono transition-transform hover:scale-105 active:scale-95 cursor-pointer select-none ${sizeClasses} ${themeClasses} ${className}`}
      >
        {badgeContent}
      </button>
    );
  }

  return (
    <span
      id={elementId}
      title={titleText}
      role="status"
      className={`inline-flex items-center rounded-md border font-mono select-none ${sizeClasses} ${themeClasses} ${className}`}
    >
      {badgeContent}
    </span>
  );
};
