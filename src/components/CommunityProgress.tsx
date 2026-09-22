import React, { useState } from 'react';
import {
  MapPin,
  Shield,
  Sun,
  Radio,
  HeartHandshake,
  Sparkles,
  Droplets,
  Zap,
  CheckCircle2,
  Users,
  Compass,
  ArrowRight,
  TrendingUp,
  Award,
  Globe2,
} from 'lucide-react';

export interface CommunityImpactCardData {
  id: string;
  icon: React.ReactNode;
  category: string;
  title: string;
  impact: string;
  currentCount: number;
  goalCount: number;
  actionText?: string;
  actionTarget?: string;
}

export interface CommunityProgressProps {
  title?: string;
  impact?: string;
  action?: React.ReactNode;
  isNightMode?: boolean;
  onNavigateTab?: (target: string) => void;
  onOpenOfflineDownload?: () => void;
  onOpenResourceCatalog?: () => void;
  onOpenMeshScanner?: () => void;
}

export const CommunityProgress: React.FC<CommunityProgressProps> = ({
  title = 'Your neighborhood prepared 42 offline maps this month',
  impact = 'That could help 42 households stay oriented during an outage',
  action,
  isNightMode = false,
  onNavigateTab,
  onOpenOfflineDownload,
  onOpenResourceCatalog,
  onOpenMeshScanner,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'preparedness' | 'energy' | 'mesh'>('all');

  const impactCards: CommunityImpactCardData[] = [
    {
      id: 'offline_maps',
      category: 'preparedness',
      icon: <Compass className="w-5 h-5 text-[#2A9D8F]" />,
      title: '42 offline maps prepared this month',
      impact: 'That could help 42 households stay oriented during a grid or network outage',
      currentCount: 42,
      goalCount: 50,
      actionText: 'Explore local readiness',
      actionTarget: 'map',
    },
    {
      id: 'solar_energy',
      category: 'energy',
      icon: <Sun className="w-5 h-5 text-[#E9C46A]" />,
      title: '18 solar charging points & battery banks shared',
      impact: 'Provides emergency power for critical radios and communication devices',
      currentCount: 18,
      goalCount: 20,
      actionText: 'View Shared Energy',
      actionTarget: 'exchange',
    },
    {
      id: 'mesh_relays',
      category: 'mesh',
      icon: <Radio className="w-5 h-5 text-[#588157]" />,
      title: '348 mesh packets relayed through neighborhood hops',
      impact: 'Kept decentralized emergency alerts moving without cell tower dependency',
      currentCount: 348,
      goalCount: 400,
      actionText: 'Check Relay Coverage',
      actionTarget: 'mesh',
    },
    {
      id: 'water_seeds',
      category: 'preparedness',
      icon: <Droplets className="w-5 h-5 text-[#2A9D8F]" />,
      title: '12 clean water points and seed banks verified',
      impact: 'Strengthens neighborhood food security and clean water access',
      currentCount: 12,
      goalCount: 15,
      actionText: 'Browse Local Reserves',
      actionTarget: 'exchange',
    },
  ];

  const filteredCards = impactCards.filter((card) => {
    if (activeTab === 'all') return true;
    return card.category === activeTab;
  });

  const totalCurrent = impactCards.reduce((acc, c) => acc + c.currentCount, 0);
  const totalGoal = impactCards.reduce((acc, c) => acc + c.goalCount, 0);
  const aggregatePercentage = Math.round((totalCurrent / totalGoal) * 100);

  const handleCardAction = (card: CommunityImpactCardData) => {
    if (card.id === 'offline_maps' && onOpenOfflineDownload) {
      onOpenOfflineDownload();
    } else if ((card.id === 'solar_energy' || card.id === 'water_seeds') && onOpenResourceCatalog) {
      onOpenResourceCatalog();
    } else if (card.id === 'mesh_relays' && onOpenMeshScanner) {
      onOpenMeshScanner();
    } else if (onNavigateTab && card.actionTarget) {
      onNavigateTab(card.actionTarget);
    }
  };

  return (
    <div
      id="community-progress-section"
      className={`rounded-3xl border p-5 sm:p-6 space-y-6 transition-all duration-200 shadow-xs ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* 1. Primary Highlight Hero Card (Community Over Competition) */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-colors ${
          isNightMode
            ? 'bg-gradient-to-br from-[#1E2C1C] to-[#121A10] border-[#364E30]'
            : 'bg-gradient-to-br from-white to-[#F0F5EE] border-[#87A878]/30 shadow-xs'
        }`}
      >
        <div className="space-y-2 flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
            <Users className="w-3.5 h-3.5" />
            <span>Community Collective Progress</span>
          </div>

          <h3 className="font-display font-black text-lg sm:text-xl tracking-tight leading-snug">
            {title}
          </h3>

          <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] leading-relaxed max-w-xl">
            {impact}
          </p>

          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-[#588157]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Anonymous aggregate • No individual ranking • Voluntary participation</span>
          </div>
        </div>

        {/* Action Button or Custom Action */}
        <div className="shrink-0 w-full sm:w-auto">
          {action ? (
            action
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onOpenOfflineDownload) {
                  onOpenOfflineDownload();
                } else if (onNavigateTab) {
                  onNavigateTab('map');
                }
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <span>Explore local readiness</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Anonymous Aggregate Impact Cards Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-current/10 pb-3">
          <div>
            <h4 className="font-display font-bold text-sm tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E9C46A]" />
              <span>Neighborhood Resilience Impact Cards</span>
            </h4>
            <p className="text-xs text-[#588157]">
              Celebrating collective milestones achieved across your local cluster.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[#87A878]/20 self-start sm:self-auto">
            {(['all', 'preparedness', 'energy', 'mesh'] as const).map((tab) => {
              const isSelected = activeTab === tab;
              const labels = {
                all: 'All Milestones',
                preparedness: 'Preparedness',
                energy: 'Power & Solar',
                mesh: 'Mesh Relays',
              };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg capitalize transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#588157] text-white shadow-2xs'
                      : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Impact Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredCards.map((card) => {
            const percent = Math.min(100, Math.round((card.currentCount / card.goalCount) * 100));
            return (
              <div
                key={card.id}
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                  isNightMode
                    ? 'bg-[#1E2C1C] border-[#364E30]'
                    : 'bg-white border-[#87A878]/25 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 shrink-0">
                        {card.icon}
                      </div>
                      <div>
                        <div className="font-bold text-xs">{card.title}</div>
                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] capitalize font-mono">
                          {card.category} Track
                        </div>
                      </div>
                    </div>

                    <span className="font-display font-black text-sm text-[#588157]">
                      {percent}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                    {card.impact}
                  </p>
                </div>

                {/* Progress Bar & Target */}
                <div className="space-y-2 pt-1 border-t border-current/5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                    <span>Collective Target: {card.goalCount}</span>
                    <span className="font-bold text-[#588157]">{card.currentCount} Completed</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2A9D8F] to-[#588157] rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {card.actionText && (
                    <button
                      type="button"
                      onClick={() => handleCardAction(card)}
                      className="w-full text-right text-[11px] font-bold text-[#2A9D8F] hover:underline flex items-center justify-end gap-1 cursor-pointer pt-0.5"
                    >
                      <span>{card.actionText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Community Completion Celebration Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
          isNightMode
            ? 'bg-[#121A10] border-[#364E30] text-[#D8E6D5]'
            : 'bg-[#EBF7F5] border-[#2A9D8F]/30 text-[#165B53]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xs block">
              Bioregional Resilience Score: {aggregatePercentage}% Collective Readiness
            </span>
            <span className="text-[11px] opacity-90 block">
              Every voluntary step in offline maps, solar sharing, or mesh forwarding strengthens the safety of all neighbors.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
