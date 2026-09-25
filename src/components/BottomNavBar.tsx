import React, { useState, useEffect } from 'react';
import { Flame, Compass, Sparkles, HeartHandshake, Grid } from 'lucide-react';
import { NavTab, PrimarySection } from '../types';
import { pathfinderScanner } from '../services/scanner/pathfinderScanner';
import { soundFeedback } from '../services/utils/soundFeedback';

interface BottomNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount?: number;
  isNightMode?: boolean;
}

export interface PrimaryTabItem {
  id: NavTab;
  section: PrimarySection;
  targetTab: NavTab;
  label: string;
  sublabel: string;
  icon: any;
  hasUnread?: boolean;
  badge?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  isNightMode = false,
}) => {
  const [isWalkActive, setIsWalkActive] = useState(false);

  useEffect(() => {
    const unsub = pathfinderScanner.subscribe((st) => {
      setIsWalkActive(st.isRecording);
    });
    return unsub;
  }, []);

  const tabs: PrimaryTabItem[] = [
    {
      id: 'today',
      section: 'now',
      targetTab: 'today',
      label: 'Campfire',
      sublabel: 'You & Sparks',
      icon: Flame,
    },
    {
      id: 'map',
      section: 'explore',
      targetTab: 'map',
      label: 'Landscape',
      sublabel: 'Around the fire',
      icon: Compass,
      badge: isWalkActive,
    },
    {
      id: 'messages',
      section: 'connect',
      targetTab: 'messages',
      label: 'Connect',
      sublabel: 'Carried sparks',
      icon: Sparkles,
      hasUnread: unreadCount > 0,
    },
    {
      id: 'exchange',
      section: 'exchange',
      targetTab: 'exchange',
      label: 'Exchange',
      sublabel: 'Mutual aid',
      icon: HeartHandshake,
    },
    {
      id: 'more',
      section: 'more',
      targetTab: 'more',
      label: 'Lab',
      sublabel: 'Tools & radio',
      icon: Grid,
    },
  ];

  const isSectionActive = (section: PrimarySection) => {
    if (section === 'now') return activeTab === 'today' || activeTab === 'mesh' || activeTab === 'home';
    if (section === 'explore') return activeTab === 'map' || activeTab === 'nearby' || activeTab === 'pathfinder';
    if (section === 'connect') return activeTab === 'messages' || activeTab === 'connect';
    if (section === 'exchange') return activeTab === 'exchange';
    if (section === 'more') return activeTab === 'more' || activeTab === 'journal' || activeTab === 'profile';
    return false;
  };

  return (
    <nav
      id="persistent-bottom-nav"
      aria-label="Main Navigation"
      className={`fixed bottom-0 inset-x-0 z-40 backdrop-blur-lg border-t transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315]/95 border-[#2A3B26] shadow-[0_-4px_20px_rgba(0,0,0,0.4)]'
          : 'bg-[#FAF6EE]/95 border-[#87A878]/30 shadow-[0_-4px_20px_rgba(32,58,42,0.06)]'
      }`}
    >
      <div
        role="tablist"
        aria-label="Field Terminal Navigation Tabs"
        className="max-w-md md:max-w-xl mx-auto px-2 py-2 flex items-center justify-around"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isSectionActive(tab.section);

          return (
            <button
              key={tab.section}
              id={`nav-btn-${tab.section}`}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tab.label} tab - ${tab.sublabel}${
                tab.section === 'connect' && unreadCount > 0 ? `, ${unreadCount} unread messages` : ''
              }`}
              onClick={() => {
                soundFeedback.playClick();
                onTabChange(tab.targetTab);
              }}
              className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
                isActive
                  ? isNightMode
                    ? 'bg-[#2A3B26] text-[#E9C46A]'
                    : 'bg-[#87A878]/20 text-[#203A2A]'
                  : isNightMode
                  ? 'text-[#A8BDA5] hover:text-[#E9C46A] hover:bg-[#223120]'
                  : 'text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/10'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive
                      ? isNightMode
                        ? 'scale-110 text-[#E9C46A]'
                        : 'scale-110 text-[#588157]'
                      : isNightMode
                      ? 'text-[#A8BDA5]'
                      : 'text-[#637062]'
                  }`}
                />
                {tab.id === 'messages' && unreadCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-bold font-mono rounded-full bg-[#E76F51] text-white ring-2 ${
                      isNightMode ? 'ring-[#182315]' : 'ring-[#FAF6EE]'
                    }`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {tab.id === 'map' && tab.badge && (
                  <span
                    aria-label="Signal walk active"
                    className={`absolute -top-1 -right-2 w-2.5 h-2.5 rounded-full bg-[#E76F51] animate-ping ring-2 ${
                      isNightMode ? 'ring-[#182315]' : 'ring-[#FAF6EE]'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium transition-colors ${
                  isActive
                    ? isNightMode
                      ? 'font-bold text-[#E9C46A]'
                      : 'font-bold text-[#203A2A]'
                    : isNightMode
                    ? 'text-[#A8BDA5]'
                    : 'text-[#637062]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

