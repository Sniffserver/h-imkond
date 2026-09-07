import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShoppingBag,
  MapPin,
  Radio,
  X,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
  Sun,
  CheckCircle2,
  BookOpen,
  WifiOff,
} from 'lucide-react';
import { NavTab } from '../types';
import { getSafeLocalStorage, setSafeLocalStorage } from '../utils/localStorageValidator';

interface QuickStartGuideProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  isNightMode?: boolean;
  onOpenToolsModal?: () => void;
  onOpenManual?: () => void;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({
  onNavigateTab,
  onOpenQuickAdd,
  isNightMode = false,
  onOpenToolsModal,
  onOpenManual,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return getSafeLocalStorage('hoimu_quickstart_dismissed', false);
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    setSafeLocalStorage('hoimu_quickstart_dismissed', true);
  };

  const handleOpenDetail = () => {
    setIsDetailModalOpen(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <>
      {/* Quick Start Helper Banner */}
      <section
        id="quick-start-helper-banner"
        aria-label="Quick Start Guide"
        className={`relative rounded-3xl p-4 sm:p-5 border shadow-sm transition-all duration-200 overflow-hidden ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#FAF6EE]'
            : 'bg-gradient-to-br from-[#FAF6EE] to-[#EDF2EB] border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        {/* Subtle Solarpunk Background Leaf Graphic Accent */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#588157]/10 pointer-events-none blur-xl" />

        {/* Banner Header */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#588157] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-[#E9C46A]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base leading-tight">
                Getting Started with HÕIMU
              </h2>
              <p className={`text-xs mt-0.5 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                Your privacy-first mutual aid terminal — coordinates peer-to-peer even without cell service.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="open-full-guide-btn"
              onClick={handleOpenDetail}
              className={`text-xs px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                isNightMode
                  ? 'border-[#364E30] text-[#E9C46A] hover:bg-[#2A3B26]'
                  : 'border-[#588157]/30 text-[#203A2A] hover:bg-white/80'
              }`}
              title="Read complete visual guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#588157] dark:text-[#E9C46A]" />
              <span className="hidden sm:inline">How it works</span>
            </button>

            <button
              type="button"
              id="dismiss-quick-start-btn"
              onClick={handleDismiss}
              aria-label="Dismiss quick start banner"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isNightMode
                  ? 'text-[#A8BDA5] hover:text-white hover:bg-[#2A3B26]'
                  : 'text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/20'
              }`}
              title="Dismiss guide (can be reopened via Help in top bar)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Step Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5 relative z-10">
          {/* Card 1: Share & Find Aid */}
          <button
            type="button"
            id="quickstart-goto-exchange"
            onClick={() => onNavigateTab('exchange')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] hover:border-[#87A878]'
                : 'bg-white/90 border-[#87A878]/30 hover:border-[#588157]'
            }`}
          >
            <div>
              <div className="w-7 h-7 rounded-xl bg-[#588157]/20 text-[#588157] dark:text-[#87A878] flex items-center justify-center mb-2">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-display font-bold text-xs">
                1. Share Resources
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-2 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                Browse food, tools, seeds, and battery power, or post an offer.
              </p>
            </div>
            <div className="mt-2.5 flex items-center text-[11px] font-bold text-[#588157] dark:text-[#E9C46A] gap-1">
              <span>Open Exchange</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Card 2: Offline Map */}
          <button
            type="button"
            id="quickstart-goto-map"
            onClick={() => onNavigateTab('map')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] hover:border-[#87A878]'
                : 'bg-white/90 border-[#87A878]/30 hover:border-[#588157]'
            }`}
          >
            <div>
              <div className="w-7 h-7 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center mb-2">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-display font-bold text-xs">
                2. Explore Grid Map
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-2 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                Find nearby water points, solar hubs, and community storage.
              </p>
            </div>
            <div className="mt-2.5 flex items-center text-[11px] font-bold text-[#2A9D8F] dark:text-[#E9C46A] gap-1">
              <span>View Map</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Card 3: Mesh Radar */}
          <button
            type="button"
            id="quickstart-goto-mesh"
            onClick={() => onNavigateTab('mesh')}
            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] hover:border-[#87A878]'
                : 'bg-white/90 border-[#87A878]/30 hover:border-[#588157]'
            }`}
          >
            <div>
              <div className="w-7 h-7 rounded-xl bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] flex items-center justify-center mb-2">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-display font-bold text-xs">
                3. Connect to Mesh
              </h3>
              <p className={`text-[11px] mt-0.5 line-clamp-2 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                Chat and relay offline packets across Bluetooth, Wi-Fi, or LoRa.
              </p>
            </div>
            <div className="mt-2.5 flex items-center text-[11px] font-bold text-[#8C6207] dark:text-[#E9C46A] gap-1">
              <span>Open Radar</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </section>

      {/* Complete Step-by-Step Guide Modal */}
      {isDetailModalOpen && (
        <div
          id="how-it-works-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div
            id="how-it-works-modal"
            className={`w-full max-w-xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
              isNightMode
                ? 'bg-[#182315] border-[#2A3B26] text-[#FAF6EE]'
                : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#588157]/20 flex items-center justify-center text-[#588157] dark:text-[#E9C46A]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">
                    How HÕIMU Works
                  </h3>
                  <p className={`text-xs ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    Resilience principles made simple
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isNightMode
                    ? 'border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                    : 'border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#2A9D8F]/20 text-[#2A9D8F] flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold">1. Zero Cloud Dependency</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    No account required, no remote servers, and no tracking. All data is saved directly in your browser's encrypted local storage and exchanged peer-to-peer.
                  </p>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#588157]/20 text-[#588157] flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold">2. Local Mesh Networking</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    Nodes discover each other through Bluetooth Low Energy (BLE) beacons and Wi-Fi Direct. Packets hop from neighbor to neighbor, extending range across valleys and buildings.
                  </p>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold">3. Cryptographic Trust</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    Every node has an ED25519 key pair. Exchanges and endorsements are signed locally, building verifiable community reputation without corporate credit scores.
                  </p>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#F4A261]/20 text-[#F4A261] flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold">4. Solar & Battery Awareness</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
                    Turn on Solar-Aware mode in low battery conditions. HÕIMU automatically reduces radar ping frequency and turns off heavy animations to conserve your energy reserves.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`p-4 border-t flex items-center justify-between shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/50'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  if (onOpenManual) onOpenManual();
                }}
                className="text-xs font-semibold flex items-center gap-1 text-[#588157] hover:underline cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read Full Survival Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-2xl bg-[#588157] text-white font-display font-bold text-xs hover:bg-[#466a45] transition-colors cursor-pointer"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
