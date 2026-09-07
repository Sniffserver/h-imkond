import React, { useState, useEffect } from 'react';
import { Info, X, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { NavTab } from '../types';

interface FeatureOnboardingProps {
  tab: NavTab;
  isNightMode?: boolean;
}

interface FeatureGuide {
  title: string;
  subtitle: string;
  whyItMatters: string;
  tips: string[];
}

const FEATURE_GUIDES: Record<NavTab, FeatureGuide> = {
  mesh: {
    title: 'Zero-Cloud Mesh Radar',
    subtitle: 'Discover nearby Bluetooth LE and Wi-Fi Direct peer nodes without cell towers or internet.',
    whyItMatters: 'Peer-to-peer radio packets form an ad-hoc mesh network, dynamically hopping across field nodes to relay emergency alerts and encrypted text.',
    tips: [
      'Nodes automatically update RSSI signal strength in real time.',
      'Connect to a Raspberry Pi Bridge for extended 868MHz LoRa radio reach.',
      'Tap any peer node to inspect trust scores or initiate a direct chat.',
    ],
  },
  map: {
    title: 'Offline Bioregional Map & Grid',
    subtitle: 'Vector terrain map, local water/food resources, and survival POI markers.',
    whyItMatters: 'Provides 100% offline geospatial awareness using pre-cached city vector grids and field-recorded GPS waypoints.',
    tips: [
      'Switch layers between Topo, Thermal/Solar, and Survival POIs.',
      'Download offline region bundles for zero-network field missions.',
      'Long-press on the map to drop a custom field waypoint.',
    ],
  },
  pathfinder: {
    title: 'RF Wardriving & Pathfinder Scanner',
    subtitle: 'Log offline Wi-Fi access points, BLE beacons, and LoRa repeaters during walks.',
    whyItMatters: 'Maps ambient RF spectrum signals to build community coverage maps and locate isolated radio repeaters.',
    tips: [
      'Start a Walk Session to record GPS tracks alongside RF discoveries.',
      'Filter discoveries by Wi-Fi, Bluetooth, or LoRa medium.',
      'Export discovery tracks as open GeoJSON files for community maps.',
    ],
  },
  exchange: {
    title: 'Mutual Aid & Resource Exchange',
    subtitle: 'Share tools, solar power, skills, and emergency supplies locally.',
    whyItMatters: 'Fosters local circular economy resilience through zero-money barter, gift economy, and verified trust endorsements.',
    tips: [
      'List spare tools, seed stock, or solar battery charging capacity.',
      'Submit DAO governance proposals for community resource allocation.',
      'Build trust points through verified offline exchanges.',
    ],
  },
  journal: {
    title: 'Community Co-Evolution Journal',
    subtitle: 'Reflect on past exchanges, ecological stewardship, and mutual aid history.',
    whyItMatters: 'Maintains an immutable local ledger of community collaboration, fostering long-term social cohesion and trust.',
    tips: [
      'Record post-exchange reflections and community feedback.',
      'Track your Symbiosis Score growth over time.',
      'Review historical trust endorsements from neighborhood peers.',
    ],
  },
  profile: {
    title: 'Field Identity & Node Settings',
    subtitle: 'Manage your callsign, encryption keys, backup archives, and field modes.',
    whyItMatters: 'Your cryptographic identity signs outgoing mesh packets while encrypted backups protect your state from hardware loss.',
    tips: [
      'Enable Glove Mode for enlarged 56dp touch targets in field conditions.',
      'Export password-protected .hoimu-archive files for offline safety.',
      'Pair with your local Raspberry Pi Bridge via 2-step PIN authentication.',
    ],
  },
};

export const FeatureOnboarding: React.FC<FeatureOnboardingProps> = ({
  tab,
  isNightMode = false,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storageKey = `hoimu_onboarding_dismissed_${tab}`;
      const dismissed = localStorage.getItem(storageKey);
      setIsDismissed(dismissed === 'true');
      setIsExpanded(false);
    } catch {
      setIsDismissed(false);
    }
  }, [tab]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(`hoimu_onboarding_dismissed_${tab}`, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const guide = FEATURE_GUIDES[tab];
  if (!guide) return null;

  if (isDismissed && !isExpanded) {
    return (
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:text-[#E9C46A] hover:bg-[#223120]'
              : 'bg-white/80 border-[#87A878]/30 text-[#637062] hover:text-[#203A2A] hover:bg-[#87A878]/10'
          }`}
          aria-label={`Show ${guide.title} feature guide`}
        >
          <Info className="w-3.5 h-3.5 text-[#588157]" />
          <span>Feature Guide</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`${guide.title} Onboarding Guide`}
      className={`mb-4 p-4 rounded-2xl border shadow-sm transition-all duration-200 relative overflow-hidden ${
        isNightMode
          ? 'bg-[#1D2B1A] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#F4EFE6] border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base flex items-center gap-2">
              {guide.title}
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#588157]/20 text-[#203A2A] dark:text-[#E9C46A]">
                Guide
              </span>
            </h3>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
              {guide.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-full text-[#637062] hover:text-[#203A2A] dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss feature onboarding"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
          isNightMode
            ? 'bg-[#121A10] border-[#364E30]/60 text-[#A8BDA5]'
            : 'bg-white/80 border-[#87A878]/20 text-[#3A4A38]'
        }`}
      >
        <span className="font-bold text-[#203A2A] dark:text-[#E9C46A]">Why this matters: </span>
        {guide.whyItMatters}
      </div>

      <div className="mt-3 space-y-1.5">
        {guide.tips.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#588157] shrink-0 mt-0.5" />
            <span className="text-[#3A4A38] dark:text-[#E0EAE0]">{tip}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-dashed border-[#87A878]/20 flex items-center justify-between text-xs">
        <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
          Dismissing saves your preference locally.
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 font-bold text-[#588157] hover:underline cursor-pointer"
        >
          <span>Got it, thanks</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
