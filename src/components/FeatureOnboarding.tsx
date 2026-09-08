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

const FEATURE_GUIDES: Partial<Record<NavTab, FeatureGuide>> = {
  home: {
    title: 'Today & Field Readiness',
    subtitle: 'What matters now: active setup milestones, emergency alerts, and quick actions.',
    whyItMatters: 'Provides an immediate snapshot of your field readiness without forcing complex settings upfront.',
    tips: [
      'Complete the 3 field readiness milestones to ensure offline connectivity.',
      'Check active emergency distress signals or broadcast a safety alert.',
      'Launch quick actions or toggle night/sun outdoor display modes.',
    ],
  },
  mesh: {
    title: 'Nearby Network',
    subtitle: 'Devices and people discovered nearby via Bluetooth LE and Wi-Fi Direct.',
    whyItMatters: 'Peer-to-peer radio packets form an ad-hoc mesh network, dynamically hopping across field nodes to relay emergency alerts and encrypted text.',
    tips: [
      'Nodes automatically update Signal Strength in real time.',
      'Connect to a Home Hub (Raspberry Pi Bridge) for extended 868MHz LoRa radio reach.',
      'Tap any peer node to inspect Connections or initiate a direct chat.',
    ],
  },
  map: {
    title: 'Offline Bioregional Map & Grid',
    subtitle: 'Vector terrain map, local water/food resources, and survival markers.',
    whyItMatters: 'Provides 100% offline geospatial awareness using pre-cached city vector grids and field-recorded GPS waypoints.',
    tips: [
      'Switch layers between Topo, Thermal/Solar, and Survival POIs.',
      'Download offline region bundles for zero-network field missions.',
      'Long-press on the map to drop a custom field waypoint.',
    ],
  },
  pathfinder: {
    title: 'Explore Signals',
    subtitle: 'Find local beacons, Wi-Fi access points, and radio activity.',
    whyItMatters: 'Maps ambient spectrum signals to build community coverage maps and locate isolated radio repeaters.',
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
      'Participate in Community Decisions for local resource allocation.',
      'Build trust points through verified offline exchanges.',
    ],
  },
  journal: {
    title: 'Community Journal',
    subtitle: 'Reflect on past exchanges, ecological stewardship, and mutual aid history.',
    whyItMatters: 'Maintains an immutable local ledger of community collaboration, fostering long-term social cohesion.',
    tips: [
      'Record post-exchange reflections and community feedback.',
      'Track your Community Contribution growth over time.',
      'Review historical connections and endorsements from neighborhood peers.',
    ],
  },
  profile: {
    title: 'Field Identity & Credentials',
    subtitle: 'Manage your callsign, encryption keys, backup archives, and field modes.',
    whyItMatters: 'Your cryptographic identity signs outgoing mesh packets while encrypted backups protect your state from hardware loss.',
    tips: [
      'Enable Glove Mode for enlarged touch targets in field conditions.',
      'Export password-protected .hoimu-archive files for offline safety.',
      'Pair with your local Home Hub (Pi Bridge) via 2-step PIN authentication.',
    ],
  },
  more: {
    title: 'Tools & Community Hub',
    subtitle: 'Access Mutual Aid, Community Decisions, Field Identity, and System Diagnostics.',
    whyItMatters: 'Consolidates advanced community resilience and settings into one accessible directory.',
    tips: [
      'Tap Mutual Aid Exchange to browse shared local resources.',
      'Access Community Decisions to cast offline votes on local proposals.',
      'Open Home Hub settings to check LoRa radio power and battery status.',
    ],
  },
  sos: {
    title: 'Field Safety & Emergency Hub',
    subtitle: 'Trigger zero-cloud emergency distress beacons and view active field alerts.',
    whyItMatters: 'Dispatches signed distress packets across all nearby mesh nodes when cell towers and internet are unavailable.',
    tips: [
      'Press Trigger SOS Alert to transmit emergency coordinates.',
      'Review active field alerts from nearby community members.',
      'Consult the 100% offline survival manual for medical and water instructions.',
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
