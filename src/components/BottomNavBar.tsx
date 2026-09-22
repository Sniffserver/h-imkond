import React, { useState, useEffect } from 'react';
import { Home, Compass, MessageSquare, ShieldAlert, Grid } from 'lucide-react';
import { NavTab } from '../types';
import { pathfinderScanner } from '../services/scanner/pathfinderScanner';
import { soundFeedback } from '../services/utils/soundFeedback';

interface BottomNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount?: number;
  isNightMode?: boolean;
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

  const tabs = [
    {
      id: 'today' as NavTab, // Today / Home
      label: 'Today',
      sublabel: 'What matters now',
      icon: Home,
    },
    {
      id: 'map' as NavTab, // Explore / Nearby
      label: 'Explore',
      sublabel: 'Map & Nearby',
      icon: Compass,
      badge: isWalkActive,
    },
    {
      id: 'messages' as NavTab, // Connect / Messages
      label: 'Connect',
      sublabel: 'Encrypted Chat',
      icon: MessageSquare,
      hasUnread: unreadCount > 0,
    },
    {
      id: 'sos' as NavTab, // Safety / SOS
      label: 'Safety',
      sublabel: 'Emergency & Hub',
      icon: ShieldAlert,
    },
    {
      id: 'more' as NavTab, // More / Tools & Community
      label: 'More',
      sublabel: 'Exchange & Tools',
      icon: Grid,
    },
  ];

  // Helper to determine active tab section
  const isTabActive = (tabId: NavTab) => {
    if (tabId === 'today') return activeTab === 'today' || activeTab === 'mesh' || activeTab === 'home';
    if (tabId === 'map') return activeTab === 'map' || activeTab === 'nearby' || activeTab === 'pathfinder';
    if (tabId === 'messages') return activeTab === 'messages' || activeTab === 'connect';
    if (tabId === 'sos') return activeTab === 'sos' || activeTab === 'help';
    if (tabId === 'more') return activeTab === 'more' || activeTab === 'exchange' || activeTab === 'journal' || activeTab === 'profile';
    return activeTab === tabId;
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
          const isActive = isTabActive(tab.id);

          return (
            <button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tab.label} tab - ${tab.sublabel}${
                tab.id === 'messages' && unreadCount > 0 ? `, ${unreadCount} unread messages` : ''
              }`}
              onClick={() => {
                soundFeedback.playClick();
                onTabChange(tab.id);
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

