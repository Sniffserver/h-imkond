import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface TechTermDefinition {
  plainLabel: string;
  technicalTerm: string;
  explanation: string;
}

export const TECH_TERMS: Record<string, TechTermDefinition> = {
  mesh: {
    plainLabel: 'Nearby network',
    technicalTerm: 'Mesh Network',
    explanation: 'Off-grid wireless peer-to-peer network connecting phones and radios directly without cell towers or internet.',
  },
  pathfinder: {
    plainLabel: 'Explore signals',
    technicalTerm: 'Pathfinder RF Discovery',
    explanation: 'Passive Bluetooth & Wi-Fi scanner mapping neighborhood radio beacons during walking walks.',
  },
  dao: {
    plainLabel: 'Community decisions',
    technicalTerm: 'Bioregional DAO',
    explanation: 'Decentralized local governance where members propose and vote on mutual aid resources.',
  },
  symbiosis: {
    plainLabel: 'Community contribution',
    technicalTerm: 'Symbiosis Score',
    explanation: 'Cryptographically signed metric tracking verified mutual aid, exchanges, and community support.',
  },
  trust: {
    plainLabel: 'Connections',
    technicalTerm: 'Web of Trust Network',
    explanation: 'Chain of cryptographic endorsements verifying honest participants without centralized identity checks.',
  },
  rssi: {
    plainLabel: 'Signal strength',
    technicalTerm: 'RSSI (dBm)',
    explanation: 'Received Signal Strength Indication measuring real-time radio connectivity between nodes.',
  },
  pibridge: {
    plainLabel: 'Home hub',
    technicalTerm: 'Raspberry Pi Gateway Bridge',
    explanation: 'Always-on solar-powered local micro-server bridging community mesh packets.',
  },
};

interface TechTooltipProps {
  termKey: keyof typeof TECH_TERMS;
  children?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
  isNightMode?: boolean;
}

export const TechTooltip: React.FC<TechTooltipProps> = ({
  termKey,
  children,
  showIcon = false,
  className = '',
  isNightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const term = TECH_TERMS[termKey];

  if (!term) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex items-center gap-1 group cursor-help ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
      tabIndex={0}
      role="button"
      aria-label={`${term.plainLabel} (Technical: ${term.technicalTerm})`}
    >
      <span>{children || term.plainLabel}</span>
      {showIcon && (
        <Info className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
      )}

      {isOpen && (
        <span
          role="tooltip"
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-2xl border shadow-xl z-50 text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
              : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
          }`}
        >
          <span className="block text-[10px] font-mono uppercase tracking-wider text-[#588157] dark:text-[#E9C46A] font-bold">
            Technical: {term.technicalTerm}
          </span>
          <span className="block text-xs font-medium text-[#637062] dark:text-[#A8BDA5] mt-1 leading-snug">
            {term.explanation}
          </span>
        </span>
      )}
    </span>
  );
};

export default TechTooltip;
