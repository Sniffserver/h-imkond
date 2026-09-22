import React, { useState } from 'react';
import {
  Repeat,
  BookOpen,
  Vote,
  User,
  ShieldCheck,
  Award,
  Activity,
  Compass,
  Download,
  Key,
  HelpCircle,
  Search,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import { NavTab, UserProfile, ResourceItem, Transaction, JournalEntry, DaoProposal } from '../../types';
import { TechTooltip } from '../../components/TechTooltip';

interface MoreScreenProps {
  user: UserProfile;
  resources: ResourceItem[];
  transactions: Transaction[];
  journal: JournalEntry[];
  daoProposals: DaoProposal[];
  isNightMode?: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onOpenDaoModal: () => void;
  onOpenTrustModal: () => void;
  onOpenSkillsModal: () => void;
  onOpenToolsModal: () => void;
  onOpenDiagnostics: () => void;
  onOpenSecurityKeys: () => void;
  onOpenBackupSetup: () => void;
  onOpenManual: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  user,
  resources,
  transactions,
  journal,
  daoProposals,
  isNightMode = false,
  onNavigateTab,
  onOpenDaoModal,
  onOpenTrustModal,
  onOpenSkillsModal,
  onOpenToolsModal,
  onOpenDiagnostics,
  onOpenSecurityKeys,
  onOpenBackupSetup,
  onOpenManual,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const completedExchanges = transactions.filter((t) => t.status === 'completed').length;
  const activeProposals = daoProposals.filter((p) => p.status === 'active').length;

  type ToolSectionItem = {
    id: string;
    title: string;
    techTerm: string;
    description: string;
    icon: React.ElementType;
    color: string;
    action: () => void;
    badge?: string;
    termKey?: 'mesh' | 'pathfinder' | 'dao' | 'symbiosis' | 'trust' | 'rssi' | 'pibridge';
  };

  type ToolSection = {
    title: string;
    items: ToolSectionItem[];
  };

  const toolSections: ToolSection[] = [
    {
      title: 'Community & Sharing',
      items: [
        {
          id: 'exchange',
          title: 'Resource Exchange',
          techTerm: 'Mutual Aid Hub',
          description: 'Offer or request tools, batteries, water, seeds, and solar energy.',
          badge: `${resources.length} items`,
          icon: Repeat,
          color: 'text-[#2A9D8F] bg-[#2A9D8F]/15',
          action: () => onNavigateTab('exchange'),
        },
        {
          id: 'journal',
          title: 'Activity Journal',
          techTerm: 'Cryptographic Ledger',
          description: 'Your verified offline record of exchanges, reflections, and community milestones.',
          badge: `${journal.length} entries`,
          icon: BookOpen,
          color: 'text-[#588157] bg-[#588157]/15',
          action: () => onNavigateTab('journal'),
        },
        {
          id: 'governance',
          title: 'Community Decisions',
          techTerm: 'Bioregional DAO',
          termKey: 'dao' as const,
          description: 'Participate in democratic voting on resource allocations and neighborhood proposals.',
          badge: activeProposals > 0 ? `${activeProposals} voting` : 'Up to date',
          icon: Vote,
          color: 'text-[#E9C46A] bg-[#E9C46A]/20',
          action: onOpenDaoModal,
        },
        {
          id: 'skills',
          title: 'Skills & Knowledge',
          techTerm: 'P2P Skill Tree',
          description: 'Discover local expertise in foraging, carpentry, radio repair, and permaculture.',
          icon: Award,
          color: 'text-[#D4A373] bg-[#D4A373]/15',
          action: onOpenSkillsModal,
        },
      ],
    },
    {
      title: 'Signals & Infrastructure',
      items: [
        {
          id: 'pathfinder',
          title: 'Explore Signals',
          techTerm: 'Pathfinder Scanner',
          termKey: 'pathfinder' as const,
          description: 'Scan Bluetooth and Wi-Fi beacons while walking to map local coverage.',
          icon: Compass,
          color: 'text-[#2A9D8F] bg-[#2A9D8F]/15',
          action: () => onNavigateTab('pathfinder'),
        },
        {
          id: 'homehub',
          title: 'Home Hub & Bridges',
          techTerm: 'Pi Gateway Bridge',
          termKey: 'pibridge' as const,
          description: 'Check status of stationary Raspberry Pi nodes and regional relay bridges.',
          icon: Server,
          color: 'text-[#588157] bg-[#588157]/15',
          action: onOpenToolsModal,
        },
        {
          id: 'diagnostics',
          title: 'Network Diagnostics',
          techTerm: 'RF Telemetry',
          description: 'View packet error rates, link budgets, hop counts, and frequency health.',
          icon: Activity,
          color: 'text-[#3A86FF] bg-[#3A86FF]/15',
          action: onOpenDiagnostics,
        },
        {
          id: 'trust',
          title: 'Connections',
          techTerm: 'Web of Trust Network',
          termKey: 'trust' as const,
          description: 'Inspect cryptographic endorsements and peer signatures.',
          icon: ShieldCheck,
          color: 'text-[#588157] bg-[#588157]/15',
          action: onOpenTrustModal,
        },
      ],
    },
    {
      title: 'Identity & Security',
      items: [
        {
          id: 'profile',
          title: 'User Profile & Settings',
          techTerm: 'Node Configuration',
          description: 'Update your callsign, display themes, night mode, and environmental switches.',
          badge: user.callsign,
          icon: User,
          color: 'text-[#203A2A] dark:text-[#F0F5EE] bg-black/5 dark:bg-white/10',
          action: () => onNavigateTab('profile'),
        },
        {
          id: 'keys',
          title: 'Security Keys',
          techTerm: 'Ed25519 Keypair',
          description: 'Export or back up your cryptographic private keys securely offline.',
          icon: Key,
          color: 'text-amber-500 bg-amber-500/15',
          action: onOpenSecurityKeys,
        },
        {
          id: 'backup',
          title: 'Offline Data Backup',
          techTerm: 'JSON Archive',
          description: 'Save an encrypted snapshot of all local messages, peers, and exchanges.',
          icon: Download,
          color: 'text-[#2A9D8F] bg-[#2A9D8F]/15',
          action: onOpenBackupSetup,
        },
        {
          id: 'manual',
          title: 'Help & Field Manual',
          techTerm: 'Documentation',
          description: 'Complete offline guide to survival mesh networking and antenna building.',
          icon: HelpCircle,
          color: 'text-[#588157] bg-[#588157]/15',
          action: onOpenManual,
        },
      ],
    },
  ];

  // Filter items if user typed a search query
  const filteredSections = toolSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.techTerm.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <section
        className={`p-5 rounded-3xl border ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-bold">More Features & Tools</h1>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Advanced community coordination, exchange logs, RF tools, and security controls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-xs font-mono bg-[#588157]/10 text-[#588157] dark:text-[#87A878] border border-[#588157]/20">
              <TechTooltip termKey="symbiosis">Score: {user.symbiosisScore}</TechTooltip>
            </span>
          </div>
        </div>

        {/* Quick search */}
        <div className="relative mt-4">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#637062] dark:text-[#A8BDA5]" />
          <input
            type="text"
            placeholder="Search tools, terms, or features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs border transition-colors outline-none ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE] focus:border-[#2A9D8F]'
                : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A] focus:border-[#588157]'
            }`}
          />
        </div>
      </section>

      {/* Grouped Sections */}
      {filteredSections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#637062] dark:text-[#A8BDA5] px-1">
            {section.title}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className={`p-4 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex items-start justify-between gap-3 group shadow-xs ${
                    isNightMode
                      ? 'bg-[#182315] hover:bg-[#223120] border-[#2A3B26]'
                      : 'bg-[#FAF6EE] hover:bg-white border-[#87A878]/30'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs sm:text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                          {item.termKey ? (
                            <TechTooltip termKey={item.termKey}>{item.title}</TechTooltip>
                          ) : (
                            item.title
                          )}
                        </h3>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/5 dark:bg-white/10 text-[#637062] dark:text-[#A8BDA5]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#637062] dark:text-[#A8BDA5] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MoreScreen;
