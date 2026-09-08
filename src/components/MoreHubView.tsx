import React from 'react';
import {
  Sprout,
  BookOpen,
  User,
  Vote,
  Cpu,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { NavTab, UserProfile } from '../types';

interface MoreHubViewProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenDaoModal: () => void;
  onOpenDiagnostics: () => void;
  onOpenManual: () => void;
  user: UserProfile;
  isNightMode?: boolean;
}

export const MoreHubView: React.FC<MoreHubViewProps> = ({
  onNavigateTab,
  onOpenDaoModal,
  onOpenDiagnostics,
  onOpenManual,
  user,
  isNightMode = false,
}) => {
  const tools = [
    {
      id: 'exchange',
      title: 'Mutual Aid Exchange',
      subtitle: 'Share tools, solar energy, skills, and seed stock',
      icon: Sprout,
      color: 'text-[#588157]',
      bgColor: 'bg-[#588157]/15',
      action: () => onNavigateTab('exchange'),
    },
    {
      id: 'journal',
      title: 'Community Journal',
      subtitle: 'Reflect on shared history, trade logs, and social cohesion',
      icon: BookOpen,
      color: 'text-[#E9C46A]',
      bgColor: 'bg-[#E9C46A]/15',
      action: () => onNavigateTab('journal'),
    },
    {
      id: 'dao',
      title: 'Community Decisions',
      subtitle: 'Bioregional governance proposals and offline voting',
      icon: Vote,
      color: 'text-[#2A9D8F]',
      bgColor: 'bg-[#2A9D8F]/15',
      action: onOpenDaoModal,
    },
    {
      id: 'profile',
      title: 'Field Identity & Credentials',
      subtitle: 'Callsign, encryption keys, Community Contribution score',
      icon: User,
      color: 'text-[#E76F51]',
      bgColor: 'bg-[#E76F51]/15',
      action: () => onNavigateTab('profile'),
    },
    {
      id: 'diagnostics',
      title: 'Home Hub & Hardware Settings',
      subtitle: 'Raspberry Pi Bridge status, LoRa frequencies, backup archives',
      icon: Cpu,
      color: 'text-[#588157]',
      bgColor: 'bg-[#588157]/15',
      action: onOpenDiagnostics,
    },
    {
      id: 'manual',
      title: 'Field Operations Manual',
      subtitle: '100% offline survival guides, radio protocols, and FAQs',
      icon: HelpCircle,
      color: 'text-[#203A2A] dark:text-[#E9C46A]',
      bgColor: 'bg-[#87A878]/20',
      action: onOpenManual,
    },
  ];

  return (
    <div
      role="region"
      aria-label="More Tools & Community Hub"
      className="space-y-4 pb-4 animate-fadeIn"
    >
      {/* Header banner */}
      <div
        className={`p-5 rounded-3xl border shadow-sm ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Tools & Community Hub</h2>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Advanced features, mutual aid, decision-making, and field identity
              </p>
            </div>
          </div>
        </div>

        {/* User Callout summary */}
        <div
          className={`mt-3 p-3 rounded-2xl border flex items-center justify-between text-xs ${
            isNightMode
              ? 'bg-[#121A10] border-[#364E30]/60 text-[#A8BDA5]'
              : 'bg-white/80 border-[#87A878]/20 text-[#3A4A38]'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#588157]" />
            <span>
              Signed in as <strong className="text-[#203A2A] dark:text-[#E9C46A]">{user.callsign}</strong>
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-[#588157]">
            Contribution: {user.symbiosisScore} pts
          </span>
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`p-4 rounded-3xl border text-left flex items-start gap-3.5 transition-all duration-200 hover:scale-[1.01] active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] hover:bg-[#223120] border-[#364E30] text-[#F0F5EE]'
                  : 'bg-white hover:bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A] shadow-xs'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.bgColor} ${item.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-display font-bold text-sm truncate">{item.title}</h3>
                  <ChevronRight className="w-4 h-4 text-[#637062] shrink-0" />
                </div>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5 line-clamp-2">
                  {item.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
