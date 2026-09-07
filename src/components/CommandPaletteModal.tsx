import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Radio,
  MapPin,
  Footprints,
  Sprout,
  BookOpen,
  User,
  Sun,
  Moon,
  Zap,
  Eye,
  EyeOff,
  ShieldCheck,
  Calendar,
  GraduationCap,
  Download,
  AlertTriangle,
  Key,
  Activity,
  Plus,
  Bell,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import { NavTab, MeshNode, ResourceItem } from '../types';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  peers: MeshNode[];
  resources: ResourceItem[];
  onSelectPeer: (peer: MeshNode) => void;
  onSelectResource: (resource: ResourceItem) => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isGloveMode: boolean;
  onToggleGloveMode: () => void;
  isDirectSun: boolean;
  onToggleDirectSun: () => void;
  isSolarAware: boolean;
  onToggleSolarAware: () => void;
  onRefreshScan: () => void;
  onOpenQuickAdd: () => void;
  onOpenWishlist: () => void;
  onOpenDao: () => void;
  onOpenCalendar: () => void;
  onOpenSkills: () => void;
  onOpenTrust: () => void;
  onOpenManual: () => void;
  onOpenSecurityKeys: () => void;
  onOpenDiagnostics: () => void;
  onExportLedger: () => void;
  onTriggerSos: () => void;
}

type PaletteCategory = 'all' | 'actions' | 'peers' | 'resources' | 'navigation';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'actions' | 'peers' | 'resources' | 'navigation';
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  badge?: string;
  shortcut?: string;
  run: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  peers,
  resources,
  onSelectPeer,
  onSelectResource,
  isNightMode,
  onToggleNightMode,
  isFocusMode,
  onToggleFocusMode,
  isGloveMode,
  onToggleGloveMode,
  isDirectSun,
  onToggleDirectSun,
  isSolarAware,
  onToggleSolarAware,
  onRefreshScan,
  onOpenQuickAdd,
  onOpenWishlist,
  onOpenDao,
  onOpenCalendar,
  onOpenSkills,
  onOpenTrust,
  onOpenManual,
  onOpenSecurityKeys,
  onOpenDiagnostics,
  onExportLedger,
  onTriggerSos,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<PaletteCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => soundFeedback.getMuted());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      soundFeedback.playClick();
    }
  }, [isOpen]);

  const toggleSound = () => {
    const next = soundFeedback.toggleMute();
    setIsMuted(next);
  };

  // Compile all commands and searchable items
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Navigation
    const navs: Array<{ id: NavTab; label: string; icon: any }> = [
      { id: 'mesh', label: 'Mesh Radar & Peers', icon: Radio },
      { id: 'map', label: 'Bioregional Map & Nodes', icon: MapPin },
      { id: 'pathfinder', label: 'Pathfinder Wardriving & RF Tracks', icon: Footprints },
      { id: 'exchange', label: 'Mutual Aid Resource Exchange', icon: Sprout },
      { id: 'journal', label: 'Co-Evolution Journal & Reflections', icon: BookOpen },
      { id: 'profile', label: 'Identity & Symbiosis Ledger', icon: User },
    ];

    navs.forEach((n, idx) => {
      items.push({
        id: `nav-${n.id}`,
        title: `Switch to ${n.label}`,
        subtitle: `Tab #${idx + 1}`,
        category: 'navigation',
        icon: n.icon,
        iconColor: 'text-[#2A9D8F]',
        shortcut: `${idx + 1}`,
        badge: activeTab === n.id ? 'Active' : undefined,
        run: () => {
          onSelectTab(n.id);
          onClose();
        },
      });
    });

    // Primary Actions & Quick Toggles
    items.push({
      id: 'action-scan',
      title: 'Scan RF Spectrum Beacons',
      subtitle: 'Trigger 2.4GHz BLE & Wi-Fi Direct neighbor sweep',
      category: 'actions',
      icon: Radio,
      iconColor: 'text-[#2A9D8F]',
      shortcut: 'R',
      run: () => {
        onRefreshScan();
        onClose();
      },
    });

    items.push({
      id: 'action-add-resource',
      title: 'Post New Resource (Mutual Aid)',
      subtitle: 'Offer seeds, tools, energy, or skills to local mesh',
      category: 'actions',
      icon: Plus,
      iconColor: 'text-[#588157]',
      run: () => {
        onOpenQuickAdd();
        onClose();
      },
    });

    items.push({
      id: 'action-night-mode',
      title: isNightMode ? 'Switch to Day Mode (Solarpunk Light)' : 'Switch to Night Mode (Deep Forest Dark)',
      subtitle: isNightMode ? 'Active theme: Night #182315' : 'Active theme: Light #FAF6EE',
      category: 'actions',
      icon: isNightMode ? Sun : Moon,
      iconColor: 'text-[#E9C46A]',
      shortcut: 'N',
      run: () => {
        onToggleNightMode();
        onClose();
      },
    });

    items.push({
      id: 'action-focus-mode',
      title: isFocusMode ? 'Turn OFF Focus Mode' : 'Turn ON ADHD Focus Mode',
      subtitle: 'Hide excess animations, high-contrast borders for concentration',
      category: 'actions',
      icon: isFocusMode ? EyeOff : Eye,
      iconColor: 'text-[#2A9D8F]',
      shortcut: 'F',
      run: () => {
        onToggleFocusMode();
        onClose();
      },
    });

    items.push({
      id: 'action-solar-mode',
      title: isSolarAware ? 'Turn OFF Solar-Saver Mode' : 'Turn ON Solar-Saver Mode (15-min Cadence)',
      subtitle: 'Conserve battery on solar-charged field nodes',
      category: 'actions',
      icon: Zap,
      iconColor: 'text-[#E9C46A]',
      shortcut: 'S',
      run: () => {
        onToggleSolarAware();
        onClose();
      },
    });

    items.push({
      id: 'action-glove-mode',
      title: isGloveMode ? 'Disable Glove Mode' : 'Enable Glove Mode (Large 56dp Touch Targets)',
      subtitle: 'Enlarge buttons and touch targets for winter/field operation',
      category: 'actions',
      icon: Footprints,
      iconColor: 'text-[#588157]',
      shortcut: 'G',
      run: () => {
        onToggleGloveMode();
        onClose();
      },
    });

    items.push({
      id: 'action-direct-sun',
      title: isDirectSun ? 'Disable Direct Sun Mode' : 'Enable Direct Sun Mode (Max Outdoor Glare Contrast)',
      subtitle: 'Force pure white background & bold high-density black typography',
      category: 'actions',
      icon: Sun,
      iconColor: 'text-[#E76F51]',
      run: () => {
        onToggleDirectSun();
        onClose();
      },
    });

    items.push({
      id: 'action-sound-toggle',
      title: isMuted ? 'Unmute Audio & Haptic Clicks' : 'Mute Audio & Haptic Clicks',
      subtitle: 'Subtle analog Web Audio feedback blips and vibration',
      category: 'actions',
      icon: isMuted ? VolumeX : Volume2,
      iconColor: 'text-[#637062]',
      run: () => {
        toggleSound();
      },
    });

    items.push({
      id: 'action-dao',
      title: 'Bioregional DAO Governance',
      subtitle: 'Vote on community infrastructure & ecological proposals',
      category: 'actions',
      icon: ShieldCheck,
      iconColor: 'text-[#588157]',
      run: () => {
        onOpenDao();
        onClose();
      },
    });

    items.push({
      id: 'action-calendar',
      title: 'Community Mesh Calendar',
      subtitle: 'Solar gatherings, seed swaps, and work parties',
      category: 'actions',
      icon: Calendar,
      iconColor: 'text-[#588157]',
      run: () => {
        onOpenCalendar();
        onClose();
      },
    });

    items.push({
      id: 'action-skills',
      title: 'Skill Exchange & Apprenticeships',
      subtitle: 'Browse local knowledge and offer hands-on workshops',
      category: 'actions',
      icon: GraduationCap,
      iconColor: 'text-[#E9C46A]',
      run: () => {
        onOpenSkills();
        onClose();
      },
    });

    items.push({
      id: 'action-wishlist',
      title: 'Wishlist Proximity Alerts',
      subtitle: 'Notify automatically when desired resources appear in RF range',
      category: 'actions',
      icon: Bell,
      iconColor: 'text-[#E76F51]',
      run: () => {
        onOpenWishlist();
        onClose();
      },
    });

    items.push({
      id: 'action-diagnostics',
      title: 'Network Diagnostics & Telemetry',
      subtitle: 'Inspect hop metrics, packet loss, and RF spectrum health',
      category: 'actions',
      icon: Activity,
      iconColor: 'text-[#2A9D8F]',
      run: () => {
        onOpenDiagnostics();
        onClose();
      },
    });

    items.push({
      id: 'action-security-keys',
      title: 'Cryptographic Security & Identity Keys',
      subtitle: 'View Ed25519 public key fingerprint, export or import keys',
      category: 'actions',
      icon: Key,
      iconColor: 'text-[#2A9D8F]',
      run: () => {
        onOpenSecurityKeys();
        onClose();
      },
    });

    items.push({
      id: 'action-manual',
      title: 'Solarpunk Field Operations Manual',
      subtitle: 'Offline radio protocols, antenna building, and mesh etiquette',
      category: 'actions',
      icon: BookOpen,
      iconColor: 'text-[#F4A261]',
      run: () => {
        onOpenManual();
        onClose();
      },
    });

    items.push({
      id: 'action-export-ledger',
      title: 'Export Encrypted Local Ledger (JSON)',
      subtitle: 'Full backup of identities, transactions, and reflections',
      category: 'actions',
      icon: Download,
      iconColor: 'text-[#588157]',
      run: () => {
        onExportLedger();
        onClose();
      },
    });

    items.push({
      id: 'action-sos',
      title: '🚨 Emergency SOS Beacon',
      subtitle: 'Broadcast emergency coordinates to all mesh nodes immediately',
      category: 'actions',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      badge: 'URGENT',
      run: () => {
        onTriggerSos();
        onClose();
      },
    });

    // Mesh Peers
    peers.forEach((peer) => {
      items.push({
        id: `peer-${peer.id}`,
        title: `${peer.callsign}`,
        subtitle: `${peer.bio || 'Mesh Node'} • ${peer.radioType || 'BLE'} • ${peer.lastRssi} dBm (${peer.hopDistance === 1 ? 'Direct Link' : `${peer.hopDistance} hops`})`,
        category: 'peers',
        icon: User,
        iconColor: 'text-[#588157]',
        badge: `${peer.relayReliability}% Relay`,
        run: () => {
          onSelectPeer(peer);
          onClose();
        },
      });
    });

    // Mutual Aid Resources
    resources.forEach((res) => {
      items.push({
        id: `resource-${res.id}`,
        title: res.title,
        subtitle: `${res.category} • Offered by ${res.ownerCallsign} • ${res.description || ''}`,
        category: 'resources',
        icon: Sprout,
        iconColor: 'text-[#2A9D8F]',
        badge: res.type === 'offer' ? 'Offering' : 'Requesting',
        run: () => {
          onSelectResource(res);
          onClose();
        },
      });
    });

    return items;
  }, [
    activeTab,
    isNightMode,
    isFocusMode,
    isSolarAware,
    isGloveMode,
    isDirectSun,
    isMuted,
    peers,
    resources,
    onSelectTab,
    onClose,
    onRefreshScan,
    onOpenQuickAdd,
    onToggleNightMode,
    onToggleFocusMode,
    onToggleSolarAware,
    onToggleGloveMode,
    onToggleDirectSun,
    onOpenDao,
    onOpenCalendar,
    onOpenSkills,
    onOpenWishlist,
    onOpenDiagnostics,
    onOpenSecurityKeys,
    onOpenManual,
    onExportLedger,
    onTriggerSos,
    onSelectPeer,
    onSelectResource,
  ]);

  // Filter items by category and search text
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCommands.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
      return matchTitle || matchSub;
    });
  }, [allCommands, activeCategory, query]);

  // Keep selected index bounded
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      soundFeedback.playClick();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      soundFeedback.playClick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) {
        soundFeedback.playPacketTransmit();
        current.run();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="command-palette-backdrop"
      className="fixed inset-0 z-[110] flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="command-palette-container"
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div
          className={`flex items-center gap-3 px-5 py-4 border-b ${
            isNightMode ? 'border-[#364E30] bg-[#121A10]' : 'border-[#87A878]/30 bg-white/70'
          }`}
        >
          <Search className={`w-5 h-5 shrink-0 ${isNightMode ? 'text-[#E9C46A]' : 'text-[#588157]'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tabs, peers, resources, or type a command... (Esc to close)"
            className="w-full bg-transparent text-sm sm:text-base font-medium placeholder:text-[#637062] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-[#637062] hover:text-[#203A2A] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd
            className={`hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
              isNightMode ? 'bg-[#2A3B26] border-[#364E30] text-[#A8BDA5]' : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#637062]'
            }`}
          >
            ESC
          </kbd>
        </div>

        {/* Category Tabs */}
        <div
          className={`flex items-center gap-1.5 px-4 py-2 border-b overflow-x-auto text-xs ${
            isNightMode ? 'border-[#364E30] bg-[#182315]' : 'border-[#87A878]/20 bg-[#F0F5EE]/50'
          }`}
        >
          {(
            [
              { id: 'all', label: 'All Results' },
              { id: 'actions', label: 'Actions & Modes' },
              { id: 'peers', label: `Peers (${peers.length})` },
              { id: 'resources', label: `Resources (${resources.length})` },
              { id: 'navigation', label: 'Tabs' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? isNightMode
                    ? 'bg-[#2A3B26] text-[#E9C46A] shadow-xs'
                    : 'bg-[#203A2A] text-white shadow-xs'
                  : 'text-[#637062] hover:bg-black/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 divide-y divide-[#87A878]/15 space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#637062] space-y-1">
              <Sparkles className="w-6 h-6 mx-auto text-[#E9C46A] opacity-60" />
              <p className="font-semibold text-sm">No matching commands or peers</p>
              <p>Try searching for "mesh", "solar", "seed", "night", or a callsign.</p>
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={() => {
                    soundFeedback.playPacketTransmit();
                    item.run();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group px-3 py-2.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? isNightMode
                        ? 'bg-[#2A3B26] text-[#FAF6EE]'
                        : 'bg-[#87A878]/25 text-[#203A2A]'
                      : 'hover:bg-black/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20'
                          : isNightMode
                          ? 'bg-[#121A10]'
                          : 'bg-white border border-[#87A878]/30'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${item.iconColor || 'text-[#588157]'}`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              item.badge === 'URGENT'
                                ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                                : 'bg-[#588157]/15 text-[#588157] border border-[#588157]/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-[#637062] truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                          isNightMode
                            ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5]'
                            : 'bg-white border-[#87A878]/30 text-[#637062]'
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'translate-x-0.5 opacity-100 text-[#E9C46A]' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div
          className={`px-4 py-2.5 border-t text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 ${
            isNightMode ? 'border-[#364E30] bg-[#121A10] text-[#A8BDA5]' : 'border-[#87A878]/30 bg-white/60 text-[#637062]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-black/10 text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-black/10 text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 text-[10px]">↵</kbd>
              Select
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 text-[10px]">ESC</kbd>
              Dismiss
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="flex items-center gap-1 hover:text-[#203A2A] transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#588157]" />}
              <span>{isMuted ? 'Muted' : 'Audio On'}</span>
            </button>
            <span>•</span>
            <span>HÕIMU Terminal 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
