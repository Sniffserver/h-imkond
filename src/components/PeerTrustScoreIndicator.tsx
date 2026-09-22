import React, { useState } from 'react';
import { ShieldCheck, Shield, Award, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { calculateTrustScore, TrustScoreDetails } from '../utils/trustScoreCalculator';

export interface PeerTrustScoreIndicatorProps {
  completedExchanges?: number;
  endorsementsCount?: number;
  peerId?: string;
  callsign?: string;
  isNightMode?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'metric' | 'compact' | 'pill';
  showBreakdown?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PeerTrustScoreIndicator: React.FC<PeerTrustScoreIndicatorProps> = ({
  completedExchanges = 0,
  endorsementsCount,
  peerId,
  callsign,
  isNightMode = false,
  size = 'sm',
  variant = 'badge',
  showBreakdown = false,
  onClick,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const details: TrustScoreDetails = calculateTrustScore(completedExchanges, endorsementsCount);

  const themeClasses = isNightMode
    ? `${details.nightBadgeBg} ${details.nightBadgeText} ${details.nightBadgeBorder}`
    : `${details.badgeBg} ${details.badgeText} ${details.badgeBorder}`;

  const elementId = peerId
    ? `peer-trust-score-indicator-${peerId}`
    : `peer-trust-score-indicator-${details.score}`;

  const tooltipText = `Trust Score: ${details.score}/100 (${details.tier})\n• Base Discovery: +${details.baseScore} pts\n• ${details.exchangesCount} Verified Trades: +${details.exchangeScore} pts\n• ${details.endorsementsCount} Endorsements: +${details.endorsementScore} pts`;

  // Mini circular SVG gauge for high visual impact
  const renderMiniRadialGauge = (radius: number, strokeWidth: number) => {
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (details.score / 100) * circumference;

    return (
      <svg
        height={radius * 2}
        width={radius * 2}
        className="shrink-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          stroke={isNightMode ? '#2A3B26' : '#E0E7DC'}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={details.accentColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
    );
  };

  // Full Metric Box Variant (used in bottom sheets, detail cards, map popups)
  if (variant === 'metric') {
    return (
      <div
        id={elementId}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative p-3 rounded-2xl border transition-all ${
          onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''
        } ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26]'
            : 'bg-[#FAF6EE] border-[#87A878]/30'
        } ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
            <span className="text-[11px] font-semibold text-[#637062] dark:text-[#A8BDA5] uppercase tracking-wider">
              Mesh Trust Score
            </span>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${themeClasses}`}
          >
            {details.tier}
          </span>
        </div>

        {/* Score and Gauge Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold font-display tracking-tight"
              style={{ color: details.accentColor }}
            >
              {details.score}
            </span>
            <span className="text-xs font-mono text-[#637062] dark:text-[#A8BDA5]">/100</span>
          </div>

          <div className="flex items-center gap-2">
            {renderMiniRadialGauge(16, 2.5)}
            <div className="text-right">
              <span className="text-[10px] font-mono text-[#588157] font-semibold block">
                {details.exchangesCount} trades
              </span>
              <span className="text-[9px] font-mono text-[#2A9D8F] block">
                {details.endorsementsCount} endorsements
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-2.5 w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${details.score}%`,
              backgroundColor: details.accentColor,
            }}
          />
        </div>

        {/* Breakdown Calculation Row */}
        {showBreakdown && (
          <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
            <span>Base +{details.baseScore}</span>
            <span>Trades +{details.exchangeScore}</span>
            <span>Endorsements +{details.endorsementScore}</span>
          </div>
        )}
      </div>
    );
  }

  // Compact Pill / Badge Variant (for cards in lists, map popups, and grid cards)
  const isXs = size === 'xs';
  const isSm = size === 'sm';
  const isMd = size === 'md';

  const containerPadding = isXs
    ? 'px-1.5 py-0.5 text-[9px]'
    : isSm
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs';

  const iconSize = isXs ? 'w-2.5 h-2.5' : isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const content = (
    <>
      <div className="flex items-center gap-1">
        {details.score >= 75 ? (
          <ShieldCheck className={`${iconSize} shrink-0 text-current`} />
        ) : (
          <Shield className={`${iconSize} shrink-0 text-current opacity-85`} />
        )}
        <span className="font-bold font-mono tracking-tight">
          Trust {details.score}
        </span>
      </div>

      {/* Mini Visual Fill Micro-bar */}
      <span
        className="w-5 h-1.5 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden inline-flex shrink-0"
        title={`${details.score}% Trust fill`}
      >
        <span
          className="h-full rounded-full transition-all"
          style={{
            width: `${details.score}%`,
            backgroundColor: details.accentColor,
          }}
        />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        id={elementId}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={tooltipText}
        aria-label={`Trust Score ${details.score} out of 100 for ${callsign || 'peer'}`}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-mono select-none transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${containerPadding} ${themeClasses} ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      id={elementId}
      title={tooltipText}
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-lg border font-mono select-none shadow-2xs ${containerPadding} ${themeClasses} ${className}`}
    >
      {content}
    </span>
  );
};
