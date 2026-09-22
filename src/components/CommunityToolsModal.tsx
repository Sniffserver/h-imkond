import React, { useState } from 'react';
import {
  X,
  Calendar,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Key,
  Activity,
  Globe,
  Siren,
  Landmark,
  Search,
  ArrowRight,
  ArrowLeft,
  Radio,
  Cpu,
  HelpCircle,
  Keyboard,
  Signal,
  Sun,
} from 'lucide-react';
import { MeshNode, BatteryManagerStatus } from '../types';
import { MeshHealthOptimizerView } from './MeshHealthOptimizerView';
import { SolarDeviceTimeToEmptyWidget } from './SolarDeviceTimeToEmptyWidget';
import { soundFeedback } from '../services/utils/soundFeedback';

interface CommunityToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalendar: () => void;
  onOpenSkills: () => void;
  onOpenTrust: () => void;
  onOpenManual: () => void;
  onOpenLandingPage: () => void;
  onOpenSecurityKeys: () => void;
  onOpenDiagnostics: () => void;
  onOpenDaoModal: () => void;
  onOpenPiBridge: () => void;
  onOpenShortcuts: () => void;
  onOpenQuickGuide: () => void;
  onToggleCrisisMode?: () => void;
  isCrisisMode?: boolean;
  isNightMode?: boolean;
  peers?: MeshNode[];
  batteryStatus?: BatteryManagerStatus;
  onToggleSolarAware?: () => void;
}

interface ToolItem {
  id: string;
  title: string;
  description: string;
  category: 'community' | 'mesh' | 'guides';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
  action: () => void;
}

export const CommunityToolsModal: React.FC<CommunityToolsModalProps> = ({
  isOpen,
  onClose,
  onOpenCalendar,
  onOpenSkills,
  onOpenTrust,
  onOpenManual,
  onOpenLandingPage,
  onOpenSecurityKeys,
  onOpenDiagnostics,
  onOpenDaoModal,
  onOpenPiBridge,
  onOpenShortcuts,
  onOpenQuickGuide,
  onToggleCrisisMode,
  isCrisisMode = false,
  isNightMode = false,
  peers = [],
  batteryStatus,
  onToggleSolarAware,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'community' | 'mesh' | 'guides'>('all');
  const [selectedToolView, setSelectedToolView] = useState<'directory' | 'mesh_health' | 'solar_autonomy'>('directory');

  if (!isOpen) return null;

  const tools: ToolItem[] = [
    // Community & Mutual Aid
    {
      id: 'calendar',
      title: 'Community Calendar',
      description: 'Seed swaps, solar maintenance workshops, and mutual aid work parties.',
      category: 'community',
      icon: Calendar,
      color: '#588157',
      action: onOpenCalendar,
    },
    {
      id: 'skills',
      title: 'Skill Exchange Directory',
      description: 'Connect with local mentors in solar power, antenna tuning, food preservation, and herbal remedy.',
      category: 'community',
      icon: GraduationCap,
      color: '#E9C46A',
      action: onOpenSkills,
    },
    {
      id: 'trust',
      title: 'Trust & Endorsement Network',
      description: 'View cryptographically signed peer endorsements and trust chains without central authorities.',
      category: 'community',
      icon: ShieldCheck,
      color: '#2A9D8F',
      action: onOpenTrust,
    },
    {
      id: 'dao',
      title: 'Bioregional DAO Council',
      description: 'Review and cast consensus votes on local community proposals and emergency grain reserves.',
      category: 'community',
      icon: Landmark,
      color: '#E9C46A',
      action: onOpenDaoModal,
    },

    // Mesh & Field Utilities
    {
      id: 'solar_autonomy',
      title: 'Solar Device Time-to-Empty Estimator',
      description: 'Calculates estimated runtime and battery depletion curves for solar-powered mesh nodes based on current consumption rates.',
      category: 'mesh',
      icon: Sun,
      color: '#E9C46A',
      badge: 'Live Calculator',
      action: () => {
        soundFeedback.playClick();
        setSelectedToolView('solar_autonomy');
      },
    },
    {
      id: 'mesh_health',
      title: 'Mesh Health & Signal Optimizer',
      description: 'Real-time RSSI signal histograms, packet loss % analysis, node hop-count distribution, and device placement tips.',
      category: 'mesh',
      icon: Activity,
      color: '#2A9D8F',
      badge: 'D3/Recharts',
      action: () => {
        soundFeedback.playClick();
        setSelectedToolView('mesh_health');
      },
    },
    {
      id: 'diagnostics',
      title: 'Network Diagnostics',
      description: 'Analyze 2.4GHz RF spectrum, BLE beacon health, node hop counts, and packet traceroutes.',
      category: 'mesh',
      icon: Radio,
      color: '#2A9D8F',
      action: onOpenDiagnostics,
    },
    {
      id: 'keys',
      title: 'Security & Cryptographic Keys',
      description: 'Manage your local ED25519 node identity, export offline QR identity cards, and inspect key pairs.',
      category: 'mesh',
      icon: Key,
      color: '#E76F51',
      action: onOpenSecurityKeys,
    },
    {
      id: 'pibridge',
      title: 'Raspberry Pi & LoRa Gateway',
      description: 'Inspect status and hardware connection for long-range 868/915MHz off-grid packet relays.',
      category: 'mesh',
      icon: Cpu,
      color: '#588157',
      action: onOpenPiBridge,
    },
    ...(onToggleCrisisMode
      ? [
          {
            id: 'crisis',
            title: isCrisisMode ? 'Crisis Mode (Active)' : 'Crisis Mode Alert',
            description: 'Trigger community emergency protocol: high-priority water, medical, and energy alerts.',
            category: 'mesh' as const,
            icon: Siren,
            color: '#E63946',
            badge: isCrisisMode ? 'ACTIVE' : undefined,
            action: onToggleCrisisMode,
          },
        ]
      : []),

    // Guides & Principles
    {
      id: 'manual',
      title: 'Offline Field Manual',
      description: 'Survival protocols, emergency water purification, off-grid power wiring, and radio antenna guides.',
      category: 'guides',
      icon: BookOpen,
      color: '#F4A261',
      action: onOpenManual,
    },
    {
      id: 'landing',
      title: 'Solarpunk Manifesto & Principles',
      description: 'Read the philosophy behind HÕIMU: bioregional resilience, zero-cloud privacy, and post-scarcity mutual aid.',
      category: 'guides',
      icon: Globe,
      color: '#588157',
      action: onOpenLandingPage,
    },
    {
      id: 'guide',
      title: 'How to Use HÕIMU (Quick Guide)',
      description: 'A simple, visual walkthrough of offline mesh networking, sharing resources, and finding nodes.',
      category: 'guides',
      icon: HelpCircle,
      color: '#2A9D8F',
      action: onOpenQuickGuide,
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'Speed up navigation with fast keys (1-6 for tabs, ⌘K for search, / for filter, ? for help).',
      category: 'guides',
      icon: Keyboard,
      color: '#87A878',
      action: onOpenShortcuts,
    },
  ];

  const filteredTools = tools.filter((tool) => {
    if (activeCategory !== 'all' && tool.category !== activeCategory) {
      return false;
    }
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectTool = (tool: ToolItem) => {
    if (tool.id === 'mesh_health' || tool.id === 'solar_autonomy') {
      tool.action();
      return;
    }
    onClose();
    tool.action();
  };

  return (
    <div
      id="community-tools-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="community-tools-modal"
        className={`w-full max-w-3xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#FAF6EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {selectedToolView === 'solar_autonomy' ? (
          <>
            {/* Solar Autonomy Subview Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="back-to-tools-from-solar-btn"
                  onClick={() => {
                    soundFeedback.playClick();
                    setSelectedToolView('directory');
                  }}
                  className={`px-3 py-1.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    isNightMode
                      ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                      : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/15'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Tagasi tööriistadesse (Back to Tools)</span>
                </button>
              </div>

              <button
                type="button"
                id="close-tools-modal-btn"
                onClick={onClose}
                aria-label="Close community tools modal"
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isNightMode
                    ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                    : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/15'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Solar Autonomy Subview Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <SolarDeviceTimeToEmptyWidget
                batteryStatus={batteryStatus}
                isNightMode={isNightMode}
                onToggleSolarAware={onToggleSolarAware}
                variant="full"
              />
            </div>
          </>
        ) : selectedToolView === 'mesh_health' ? (
          <>
            {/* Mesh Health Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="back-to-tools-btn"
                  onClick={() => {
                    soundFeedback.playClick();
                    setSelectedToolView('directory');
                  }}
                  className={`px-3 py-1.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    isNightMode
                      ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                      : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/15'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Tagasi tööriistadesse (Back to Tools)</span>
                </button>
              </div>

              <button
                type="button"
                id="close-tools-modal-btn"
                onClick={onClose}
                aria-label="Close community tools modal"
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isNightMode
                    ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                    : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/15'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mesh Health Subview Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <MeshHealthOptimizerView
                peers={peers}
                batteryStatus={batteryStatus}
                isNightMode={isNightMode}
              />
            </div>
          </>
        ) : (
          <>
            {/* Modal Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#588157]/20 flex items-center justify-center text-[#588157] dark:text-[#E9C46A]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg sm:text-xl">
                    Community Hub & Tools
                  </h2>
                  <p className={`text-xs ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    All off-grid utilities, collaborative directories, and resilience guides
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="close-tools-modal-btn"
                onClick={onClose}
                aria-label="Close community tools modal"
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isNightMode
                    ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                    : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/15'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Category Filter */}
            <div className="p-4 sm:p-5 pb-2 shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search tools, guides, or utilities..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm border transition-colors focus:outline-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#2A3B26] text-[#FAF6EE] focus:border-[#87A878]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                  }`}
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400 hover:text-neutral-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Categories */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'All Tools' },
                  { id: 'community', label: '🤝 Community' },
                  { id: 'mesh', label: '📡 Mesh & Utilities' },
                  { id: 'guides', label: '📖 Guides & Manuals' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                      activeCategory === cat.id
                        ? isNightMode
                          ? 'bg-[#2A3B26] text-[#E9C46A]'
                          : 'bg-[#203A2A] text-white'
                        : isNightMode
                        ? 'text-[#A8BDA5] hover:bg-[#1C2918]'
                        : 'text-[#637062] hover:bg-[#87A878]/15'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Widget: Solar Device Time-to-Empty */}
            <div className="px-4 sm:px-5 pb-1 shrink-0">
              <SolarDeviceTimeToEmptyWidget
                batteryStatus={batteryStatus}
                isNightMode={isNightMode}
                onToggleSolarAware={onToggleSolarAware}
                variant="dashboard"
                onExpand={() => {
                  soundFeedback.playClick();
                  setSelectedToolView('solar_autonomy');
                }}
              />
            </div>

            {/* Tools Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-2 space-y-2.5">
              {filteredTools.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-60">
                  No matching tools found for "{filterQuery}". Try a different keyword.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        id={`tool-card-${tool.id}`}
                        type="button"
                        onClick={() => handleSelectTool(tool)}
                        className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer group ${
                          isNightMode
                            ? 'bg-[#121A10] border-[#2A3B26] hover:border-[#87A878] hover:bg-[#1A2617]'
                            : 'bg-white border-[#87A878]/30 hover:border-[#588157] hover:bg-[#FAF6EE]'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: `${tool.color}20`, color: tool.color }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-display font-bold text-xs sm:text-sm truncate">
                              {tool.title}
                            </span>
                            {tool.badge && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#2A9D8F] text-white">
                                {tool.badge}
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#588157] shrink-0" />
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 line-clamp-2 ${
                              isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'
                            }`}
                          >
                            {tool.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Tip */}
            <div
              className={`p-3 sm:px-5 text-center text-[11px] border-t shrink-0 ${
                isNightMode ? 'border-[#2A3B26] text-[#87A878] bg-[#121A10]' : 'border-[#87A878]/20 text-[#588157] bg-white/40'
              }`}
            >
              💡 Tip: Press <kbd className="px-1.5 py-0.5 rounded border text-[10px] font-mono">⌘K</kbd> anywhere in the app to quickly search resources, nodes, and commands.
            </div>
          </>
        )}
      </div>
    </div>
  );
};
