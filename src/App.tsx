import { QuickTip } from "./components/QuickTip";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MeshNode,
  ResourceItem,
  Transaction,
  JournalEntry,
  MeshMessage,
  UserProfile,
  BatteryManagerStatus,
  ToastMessage,
  SentimentType,
  NavTab,
  WishlistItem,
  CalendarEvent,
  SkillExchangeItem,
  TrustEndorsement,
  CrisisAlert,
  DaoProposal,
  ProposalCategory,
  ResourceCategory,
  CryptoIdentity,
} from './types';
import {
  INITIAL_USER,
  INITIAL_BATTERY_STATUS,
  INITIAL_PEERS,
  DISCOVERABLE_PEERS,
  INITIAL_RESOURCES,
  INITIAL_TRANSACTIONS,
  INITIAL_JOURNAL,
  INITIAL_MESSAGES,
} from './data/initialData';

import { HoimuAppHeader } from './components/HoimuAppHeader';
import { BottomNavBar } from './components/BottomNavBar';
import { ToastContainer } from './components/ToastContainer';
import { MeshTab } from './components/MeshTab';
import { MapViewTab } from './components/MapViewTab';
import { PathfinderTab } from './components/PathfinderTab';
import { useMeshStore, selectPeersArray } from './store/meshStore';
import { ExchangeTab } from './components/ExchangeTab';
import { JournalTab } from './components/JournalTab';
import { ProfileTab } from './components/ProfileTab';
import { achievementService, Achievement } from './services/achievementService';
import { AchievementCelebrationOverlay } from './components/AchievementCelebrationOverlay';

import { ReputationBreakdownDialog } from './components/ReputationBreakdownDialog';
import { PeerDetailBottomSheet } from './components/PeerDetailBottomSheet';
import { ResourceDetailModal } from './components/ResourceDetailModal';
import { ReflectionDialog } from './components/ReflectionDialog';
import { MeshChatDrawer } from './components/MeshChatDrawer';
import { LocalDataBackupPromptModal } from './components/LocalDataBackupPromptModal';
import { QuickAddResourceModal } from './components/QuickAddResourceModal';
import { WishlistAlertModal } from './components/WishlistAlertModal';
import { BioregionalDaoModal } from './components/BioregionalDaoModal';
import { CommunityCalendarModal } from './components/CommunityCalendarModal';
import { SkillExchangeModal } from './components/SkillExchangeModal';
import { ChainOfTrustModal } from './components/ChainOfTrustModal';
import { CrisisModeBar } from './components/CrisisModeBar';
import { HoimuLandingPageModal } from './components/HoimuLandingPageModal';
import { HoimuLandingPage } from './components/HoimuLandingPage';
import { SecurityKeyManagerModal } from './components/SecurityKeyManagerModal';
import { NetworkDiagnosticsModal } from './components/NetworkDiagnosticsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingModal } from './components/OnboardingModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { QuickActionDial } from './components/QuickActionDial';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { soundFeedback } from './services/soundFeedback';
import { stringResource, R } from './utils/stringResource';
import { getSafeLocalStorage, setSafeLocalStorage, getSecureLocalStorage, setSecureLocalStorage } from './utils/localStorageValidator';
import { initMeshSync } from './services/meshSync';
import { initMessageStorage } from './services/messageService';
import { initSosService } from './services/sosService';
import { SosAlertBanner } from './components/SosAlertBanner';
import { Plus } from 'lucide-react';

const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Solar PV & Battery Buffer Wiring Masterclass',
    description: 'Learn hands-on crimping, fuses, charge controllers & battery wire sizing for off-grid cabins.',
    category: 'Workshop',
    date: '2026-09-06',
    time: '14:00 - 17:00',
    location: 'River Crossing Common Hub',
    organizerCallsign: 'Cascadia-Node-44',
    attendeesCount: 8,
    maxCapacity: 15,
    isUserAttending: true,
  },
  {
    id: 'evt-2',
    title: 'Heritage Apple & Pear Orchards Pruning Talgud',
    description: 'Communal workday to restore old trees and collect grafting wood for spring nursery stock.',
    category: 'Workday',
    date: '2026-09-10',
    time: '09:00 - 13:00',
    location: 'Ridge Trailhead Orchards',
    organizerCallsign: 'Cedar-Steward',
    attendeesCount: 12,
    maxCapacity: 20,
    isUserAttending: false,
  },
];

const INITIAL_SKILLS: SkillExchangeItem[] = [
  {
    id: 'sk-1',
    title: 'Õpetan päikesepaneelide paigaldamist & akupanga hooldust',
    description: 'Practical training on solar array angles, MPPT charge controllers, and LiFePO4 battery cell balancing.',
    type: 'offer',
    category: 'Energy & Solar',
    providerCallsign: 'Cascadia-Node-44',
    experienceLevel: 'Master Practitioner',
    locationNote: 'River Crossing Hub',
    availabilityText: 'Saturdays 14:00',
    createdAt: Date.now() - 86400000,
    endorsementsCount: 14,
  },
  {
    id: 'sk-2',
    title: 'Looking for Mentor: Meshtastic & BLE Antenna Tuning',
    description: 'Seeking guidance on tuning 868MHz/915MHz Yagi antennas using NanoVNA analyzers.',
    type: 'request',
    category: 'Electronics',
    providerCallsign: 'Spruce-Relay',
    experienceLevel: 'Beginner Friendly',
    locationNote: 'South Bridge Relay',
    availabilityText: 'Flexible evenings',
    createdAt: Date.now() - 43200000,
    endorsementsCount: 6,
  },
];

const INITIAL_ENDORSEMENTS: TrustEndorsement[] = [
  {
    id: 'end-1',
    transactionId: 'tx-001',
    endorserCallsign: 'Cascadia-Node-44',
    recipientCallsign: 'Cedar-Steward',
    signatureHash: 'SHA256: e8a91f...90a42d',
    comment: 'Verified genuine heritage seed exchange. Prompt relay and exceptional seed viability.',
    timestamp: Date.now() - 172800000,
    reputationBonus: 15,
  },
];

const INITIAL_CRISIS_ALERTS: CrisisAlert[] = [];

const INITIAL_WISHLIST: WishlistItem[] = [
  {
    id: 'w-1',
    keyword: 'solar',
    category: 'Energy',
    createdAt: Date.now() - 86400000,
    isActive: true,
  },
  {
    id: 'w-2',
    keyword: 'seeds',
    category: 'Food',
    createdAt: Date.now() - 43200000,
    isActive: true,
  },
  {
    id: 'w-3',
    keyword: 'first aid',
    category: 'Bio-Remedy',
    createdAt: Date.now() - 21600000,
    isActive: true,
  },
];

const INITIAL_DAO_PROPOSALS: DaoProposal[] = [
  {
    id: 'prop-1',
    title: 'Deploy 100W Ridge Node Solar & BLE Relay Buffer',
    description:
      'Install a weatherized 100W monocrystalline solar panel and battery buffer at Ridge Trailhead Node 02 to enhance mesh packet routing reliability across Cascadia 44N.',
    category: 'Infrastructure',
    authorCallsign: 'Cascadia-Node-44',
    votesYes: 485,
    votesNo: 32,
    votesAbstain: 15,
    status: 'active',
    endsAt: Date.now() + 604800000,
    symbiosisReward: 15,
    requiredQuorum: 300,
  },
  {
    id: 'prop-2',
    title: 'Establish Communal Heritage Seed Vault at River Crossing',
    description:
      'Allocate a moisture-sealed physical storage locker for drought-resistant heritage seeds open to all verified bioregional stewards.',
    category: 'Ecological',
    authorCallsign: 'Cedar-Steward',
    votesYes: 612,
    votesNo: 18,
    votesAbstain: 8,
    status: 'active',
    endsAt: Date.now() + 1209600000,
    symbiosisReward: 15,
    requiredQuorum: 400,
  },
  {
    id: 'prop-3',
    title: 'Deploy High-Gain BLE Mesh Relay at South Bridge',
    description:
      'Erect a directional 12dBi antenna array to bridge the 1.2km river gap during storm outages.',
    category: 'Infrastructure',
    authorCallsign: 'Spruce-Relay',
    votesYes: 340,
    votesNo: 85,
    votesAbstain: 22,
    status: 'active',
    endsAt: Date.now() + 432000000,
    symbiosisReward: 15,
    requiredQuorum: 250,
  },
];

export function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('mesh');
  const [filterOnlyNewMap, setFilterOnlyNewMap] = useState(false);

  // Dedicated Solarpunk Landing Page View State
  const [isLandingPageView, setIsLandingPageView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return window.location.hash === '#landing' || params.get('view') === 'landing';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      if (window.location.hash === '#landing') {
        setIsLandingPageView(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Onboarding Modal State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    return !getSafeLocalStorage('hoimu_has_seen_onboarding', false);
  });

  const handleCloseOnboarding = () => {
    setIsOnboardingOpen(false);
    setSafeLocalStorage('hoimu_has_seen_onboarding', true);
  };

  const handleCompleteOnboarding = (updatedProfile?: Partial<UserProfile>, visibilityPrefs?: any) => {
    setIsOnboardingOpen(false);
    setSafeLocalStorage('hoimu_has_seen_onboarding', true);
    if (updatedProfile) {
      setUser((prev) => {
        const nextUser = { ...prev, ...updatedProfile };
        setSecureLocalStorage('hoimu_user', nextUser);
        return nextUser;
      });
      if (visibilityPrefs) {
        setSafeLocalStorage('hoimu_visibility_prefs', visibilityPrefs);
      }
      addToast(
        stringResource(R.string.toast_onboarding_completed_title),
        stringResource(
          R.string.toast_onboarding_completed_desc,
          updatedProfile.callsign || 'Hõimlane'
        ),
        'success'
      );
    }
  };

  // Backup Prompt Dialog State
  const [isBackupPromptOpen, setIsBackupPromptOpen] = useState(false);

  // 2026 UX Modernization: Global Command Palette & Keyboard Shortcuts Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('hoimu_backup_prompt_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => {
        setIsBackupPromptOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Night Mode Field Theme State (with System Preference Auto-Detection)
  const [isNightMode, setIsNightMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_night_mode');
    if (saved !== null) return JSON.parse(saved);
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // ADHD Focus Mode State
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_focus_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Glove Mode State (Min 56×56dp touch targets, 72×72dp canvas tap points, +20% font scaling)
  const [isGloveMode, setIsGloveMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_glove_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // High Contrast Mode State (Thick borders, no transparency, prefers-contrast override)
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_high_contrast');
    return saved ? JSON.parse(saved) : false;
  });

  // Direct Sun Mode State (Forces pure white background and bold black text for direct sunlight glare)
  const [isDirectSun, setIsDirectSun] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_direct_sun');
    return saved ? JSON.parse(saved) : false;
  });

  // Listen to system color scheme changes if user hasn't explicitly overridden theme
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('hoimu_night_mode') === null) {
        setIsNightMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Sync Night Mode & Dark Class on document root
  useEffect(() => {
    localStorage.setItem('hoimu_night_mode', JSON.stringify(isNightMode));
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isNightMode);
    }
  }, [isNightMode]);

  // Sync Focus Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_focus_mode', JSON.stringify(isFocusMode));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('focus-mode', isFocusMode);
    }
  }, [isFocusMode]);

  // Sync Glove Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_glove_mode', JSON.stringify(isGloveMode));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('glove-mode', isGloveMode);
    }
  }, [isGloveMode]);

  // Sync High Contrast Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_high_contrast', JSON.stringify(isHighContrast));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('high-contrast', isHighContrast);
    }
  }, [isHighContrast]);

  // Sync Direct Sun Mode on body tag
  useEffect(() => {
    localStorage.setItem('hoimu_direct_sun', JSON.stringify(isDirectSun));
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('direct-sun', isDirectSun);
    }
  }, [isDirectSun]);



  // Ambient Light Sensor detection for Direct Sun Mode auto-trigger
  useEffect(() => {
    if (typeof window !== 'undefined' && 'AmbientLightSensor' in window) {
      try {
        const SensorClass = (window as any).AmbientLightSensor;
        const sensor = new SensorClass();
        sensor.addEventListener('reading', () => {
          if (sensor.illuminance > 10000 && !isDirectSun) {
            setIsDirectSun(true);
            addToast(
              '☀️ Direct Sun Mode Auto-Enabled',
              `Ambient light sensor > 10,000 lux detected (${Math.round(sensor.illuminance)} lux). Pure white high contrast mode active.`,
              'info'
            );
          }
        });
        sensor.start();
        return () => sensor.stop();
      } catch {
        // Sensor API present but permissions/hardware unavail
      }
    }
  }, [isDirectSun]);

  const handleToggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      addToast(
        next ? 'Fookusrežiim SISSE' : 'Fookusrežiim VÄLJA',
        next
          ? 'Liigsed animatsioonid peidetud, suurendatud kontrastsus ADHD/fookuse jaoks.'
          : 'Tavalised animatsioonid taastatud.',
        'info'
      );
      return next;
    });
  };

  const handleToggleGloveMode = () => {
    setIsGloveMode((prev) => {
      const next = !prev;
      addToast(
        next ? 'Glove Mode (Large Targets) ON' : 'Glove Mode OFF',
        next
          ? 'Min 56×56dp buttons, 72×72dp map points, +20% global text scaling active.'
          : 'Standard touch targets restored.',
        'info'
      );
      return next;
    });
  };

  const handleToggleHighContrast = () => {
    setIsHighContrast((prev) => {
      const next = !prev;
      addToast(
        next ? 'High Contrast Mode ON' : 'High Contrast Mode OFF',
        next
          ? 'Thick 2px solid borders active, translucency & glassmorphism removed.'
          : 'Standard visual styling restored.',
        'info'
      );
      return next;
    });
  };

  const handleToggleDirectSun = () => {
    setIsDirectSun((prev) => {
      const next = !prev;
      addToast(
        next ? 'Direct Sun Mode ON' : 'Direct Sun Mode OFF',
        next
          ? 'Forced pure white background & bold high-density black typography for outdoor glare.'
          : 'Standard theme background restored.',
        'info'
      );
      return next;
    });
  };

  // Application Domain State (Hydrated from localStorage or Initial Data)
  const [user, setUser] = useState<UserProfile>(() => {
    return getSecureLocalStorage<UserProfile>('hoimu_user', INITIAL_USER);
  });

  const [batteryStatus, setBatteryStatus] = useState<BatteryManagerStatus>(() => {
    const saved = localStorage.getItem('hoimu_battery');
    return saved ? JSON.parse(saved) : INITIAL_BATTERY_STATUS;
  });

  const peers = useMeshStore(selectPeersArray);
  const setStorePeers = useMeshStore((state) => state.setPeers);

  const setPeers = useCallback((updater: MeshNode[] | ((prev: MeshNode[]) => MeshNode[])) => {
    if (typeof updater === 'function') {
      const next = updater(useMeshStore.getState().getPeersArray());
      setStorePeers(next);
    } else {
      setStorePeers(updater);
    }
  }, [setStorePeers]);

  const [resources, setResources] = useState<ResourceItem[]>(() => {
    const saved = localStorage.getItem('hoimu_resources');
    return saved ? JSON.parse(saved) : INITIAL_RESOURCES;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('hoimu_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    return getSecureLocalStorage<JournalEntry[]>('hoimu_journal', INITIAL_JOURNAL);
  });

  const [messages, setMessages] = useState<MeshMessage[]>(() => {
    return getSecureLocalStorage<MeshMessage[]>('hoimu_messages', INITIAL_MESSAGES);
  });

  // Export Local Ledger Data as formatted JSON Blob
  const handleExportLocalDataJSON = () => {
    const backupPayload = {
      app: 'HÕIMU-Mesh-Ledger',
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      user,
      batteryStatus,
      peers,
      resources,
      transactions,
      journal,
      messages,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `hoimu-mesh-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addToast('Local ledger exported successfully as JSON file.', 'success');
  };

  // Quick Add, Wishlist & Feature Modal States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isDaoModalOpen, setIsDaoModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSecurityKeysOpen, setIsSecurityKeysOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isCrisisMode, setIsCrisisMode] = useState(false);
  const [activeAchievementCelebration, setActiveAchievementCelebration] = useState<Achievement | null>(null);

  // FAB Active Ripple and Wishlist Pulse states
  const [isFabRippling, setIsFabRippling] = useState(false);
  const [lastSeenMatchesCount, setLastSeenMatchesCount] = useState<number>(0);

  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    const saved = localStorage.getItem('hoimu_wishlist');
    return saved ? JSON.parse(saved) : INITIAL_WISHLIST;
  });

  const [daoProposals, setDaoProposals] = useState<DaoProposal[]>(() => {
    const saved = localStorage.getItem('hoimu_dao_proposals');
    return saved ? JSON.parse(saved) : INITIAL_DAO_PROPOSALS;
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('hoimu_calendar_events');
    return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
  });

  const [skills, setSkills] = useState<SkillExchangeItem[]>(() => {
    const saved = localStorage.getItem('hoimu_skills');
    return saved ? JSON.parse(saved) : INITIAL_SKILLS;
  });

  const [endorsements, setEndorsements] = useState<TrustEndorsement[]>(() => {
    const saved = localStorage.getItem('hoimu_endorsements');
    return saved ? JSON.parse(saved) : INITIAL_ENDORSEMENTS;
  });

  const [crisisAlerts, setCrisisAlerts] = useState<CrisisAlert[]>(() => {
    const saved = localStorage.getItem('hoimu_crisis_alerts');
    return saved ? JSON.parse(saved) : INITIAL_CRISIS_ALERTS;
  });

  const [cryptoIdentity, setCryptoIdentity] = useState<CryptoIdentity>(() => {
    const saved = localStorage.getItem('hoimu_crypto_identity');
    return saved
      ? JSON.parse(saved)
      : {
          publicKey: 'ed25519:e8a91f4b82...90a42d',
          algorithm: 'Ed25519',
          createdAt: Date.now(),
        };
  });

  useEffect(() => {
    localStorage.setItem('hoimu_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('hoimu_dao_proposals', JSON.stringify(daoProposals));
  }, [daoProposals]);

  useEffect(() => {
    localStorage.setItem('hoimu_calendar_events', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('hoimu_skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    localStorage.setItem('hoimu_endorsements', JSON.stringify(endorsements));
  }, [endorsements]);

  useEffect(() => {
    localStorage.setItem('hoimu_crisis_alerts', JSON.stringify(crisisAlerts));
  }, [crisisAlerts]);

  // Check for newly unlocked Achievements/badges
  useEffect(() => {
    const newlyUnlocked = achievementService.checkForNewUnlocks(user, journal, daoProposals);
    if (newlyUnlocked.length > 0) {
      setActiveAchievementCelebration(newlyUnlocked[0]);
    }
  }, [user, journal, daoProposals]);

  // Initialize encrypted direct messaging & CRDT mesh sync & SOS emergency service
  useEffect(() => {
    initMeshSync();
    initSosService();
    initMessageStorage().catch((err) => {
      console.warn('[HÕIMU] Could not init encrypted message storage:', err);
    });
  }, []);

  // Calendar Event Handlers
  const handleAddCalendarEvent = (newEvent: Omit<CalendarEvent, 'id' | 'attendeesCount' | 'isUserAttending'>) => {
    const eventObj: CalendarEvent = {
      ...newEvent,
      id: `evt-${Date.now()}`,
      attendeesCount: 1,
      isUserAttending: true,
    };
    setCalendarEvents((prev) => [eventObj, ...prev]);
    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 10 }));
    addToast('📅 Calendar Event Published', `"${newEvent.title}" broadcasted to mesh (+10 Symbiosis pts).`, 'success');
  };

  const handleToggleRsvp = (eventId: string) => {
    setCalendarEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attending = !e.isUserAttending;
          return {
            ...e,
            isUserAttending: attending,
            attendeesCount: attending ? e.attendeesCount + 1 : Math.max(0, e.attendeesCount - 1),
          };
        }
        return e;
      })
    );
  };

  // Skill Exchange Handlers
  const handleAddSkill = (newSkill: Omit<SkillExchangeItem, 'id' | 'createdAt' | 'endorsementsCount'>) => {
    const skillObj: SkillExchangeItem = {
      ...newSkill,
      id: `sk-${Date.now()}`,
      createdAt: Date.now(),
      endorsementsCount: 1,
    };
    setSkills((prev) => [skillObj, ...prev]);
    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 10 }));
    addToast('🎓 Skill Listing Published', `"${newSkill.title}" broadcasted to local mesh.`, 'success');
  };

  const handleRequestSkillSession = (skill: SkillExchangeItem) => {
    addToast('💬 Mesh Session Requested', `Sent direct relay request to ${skill.providerCallsign} regarding "${skill.title}".`, 'info');
  };

  // Trust Endorsement Handler
  const handleEndorseTransaction = (transactionId: string, comment: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    const hashSeed = `ED25519_${Date.now()}_${tx.id}_${user.callsign}`;
    const hashStr = `SHA256: ${hashSeed.slice(-12).toLowerCase()}`;

    const newEndorsement: TrustEndorsement = {
      id: `end-${Date.now()}`,
      transactionId,
      endorserCallsign: user.callsign,
      recipientCallsign: tx.providerCallsign === user.callsign ? tx.requesterCallsign : tx.providerCallsign,
      signatureHash: hashStr,
      comment,
      timestamp: Date.now(),
      reputationBonus: 15,
    };

    setEndorsements((prev) => [newEndorsement, ...prev]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, isEndorsed: true } : t))
    );

    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 15 }));
    addToast('🛡️ Cryptographic Endorsement Signed', `Granted +15 Symbiosis Pts and generated proof hash ${hashStr}.`, 'success');
  };

  // Crisis Mode Handlers
  const handleBroadcastAlert = (newAlert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => {
    const alertObj: CrisisAlert = {
      ...newAlert,
      id: `sos-${Date.now()}`,
      timestamp: Date.now(),
      resolved: false,
    };
    setCrisisAlerts((prev) => [alertObj, ...prev]);
    addToast('🚨 SOS BEACON TRANSMITTED', `Emergency alert flooded across all 433MHz/BLE channels!`, 'warning');
  };

  const handleResolveAlert = (alertId: string) => {
    setCrisisAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
    addToast('✓ SOS Alert Resolved', 'Marked emergency beacon as cleared on local mesh.', 'info');
  };

  // Quick Add FAB Submission Handler
  const handleQuickAddResource = (data: {
    title: string;
    description: string;
    category: ResourceCategory;
    type: 'offer' | 'request';
    availabilityText: string;
  }) => {
    const newRes: ResourceItem = {
      id: `res-${Date.now()}`,
      ownerId: user.deviceNodeId || 'user-node-001',
      ownerCallsign: user.callsign,
      title: data.title,
      description: data.description,
      category: data.category,
      distanceKm: 0.1,
      createdAt: Date.now(),
      isActive: true,
      availabilityText: data.availabilityText || 'Available immediately at home node',
      avatarSeed: user.avatarSeed,
      ownerReputationTier: 'Steward',
      ownerCompletedExchanges: user.completedExchanges,
    };

    setResources((prev) => [newRes, ...prev]);

    // Award +10 Symbiosis Points
    setUser((prev) => ({
      ...prev,
      symbiosisScore: prev.symbiosisScore + 10,
      offeredResources:
        data.type === 'offer'
          ? [...prev.offeredResources, data.title]
          : prev.offeredResources,
    }));

    addToast(
      `📢 Resource ${data.type === 'offer' ? 'Offered' : 'Requested'}!`,
      `"${data.title}" broadcasted over BLE mesh (+10 Symbiosis pts).`,
      'success'
    );

    // Check against active Wishlist Items
    wishlist.forEach((item) => {
      if (!item.isActive) return;
      const kw = item.keyword.toLowerCase();
      const matchesTitle = data.title.toLowerCase().includes(kw);
      const matchesDesc = data.description.toLowerCase().includes(kw);
      const matchesCat = item.category === 'all' || item.category === data.category;

      if ((matchesTitle || matchesDesc) && matchesCat) {
        setTimeout(() => {
          addToast(
            `🔔 Wishlist Match Alert!`,
            `New resource "${data.title}" matches your alert keyword "${item.keyword}".`,
            'info'
          );
        }, 500);
      }
    });
  };

  // Wishlist Handlers
  const handleAddWishlistItem = (keyword: string, category?: ResourceCategory | 'all') => {
    const newItem: WishlistItem = {
      id: `w-${Date.now()}`,
      keyword,
      category: category || 'all',
      createdAt: Date.now(),
      isActive: true,
    };
    setWishlist((prev) => [newItem, ...prev]);
    addToast('🔔 Wishlist Alert Added', `You will be alerted when "${keyword}" enters the mesh.`, 'success');
  };

  const handleRemoveWishlistItem = (id: string) => {
    setWishlist((prev) => prev.filter((w) => w.id !== id));
    addToast('Wishlist Alert Removed', undefined, 'info');
  };

  // Active Wishlist Matches from Recent Mesh Scan / Network Resources
  const activeWishlistMatches = useMemo(() => {
    const activeRules = wishlist.filter((item) => item.isActive && item.keyword.trim().length > 0);
    if (activeRules.length === 0) return [];

    return resources.filter((res) => {
      if (res.isActive === false) return false;
      return activeRules.some((rule) => {
        const kw = rule.keyword.trim().toLowerCase();
        const kwRoot = kw.endsWith('s') && kw.length > 3 ? kw.slice(0, -1) : kw;
        const title = res.title.toLowerCase();
        const desc = (res.description || '').toLowerCase();

        const matchesKeyword =
          title.includes(kw) ||
          desc.includes(kw) ||
          title.includes(kwRoot) ||
          desc.includes(kwRoot) ||
          kw.split(/\s+/).some((part) => part.length > 2 && (title.includes(part) || desc.includes(part)));

        const matchesCat = rule.category === 'all' || rule.category === res.category;
        return matchesKeyword && matchesCat;
      });
    });
  }, [wishlist, resources]);

  const activeWishlistMatchesCount = activeWishlistMatches.length;

  useEffect(() => {
    if (isWishlistOpen) {
      setLastSeenMatchesCount(activeWishlistMatchesCount);
    }
  }, [isWishlistOpen, activeWishlistMatchesCount]);

  // DAO Governance Voting Handler
  const handleVoteProposal = (proposalId: string, vote: 'yes' | 'no' | 'abstain') => {
    setDaoProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            userVoted: vote,
            votesYes: vote === 'yes' ? p.votesYes + user.symbiosisScore : p.votesYes,
            votesNo: vote === 'no' ? p.votesNo + user.symbiosisScore : p.votesNo,
            votesAbstain: vote === 'abstain' ? p.votesAbstain + user.symbiosisScore : p.votesAbstain,
          };
        }
        return p;
      })
    );

    // Award +15 Symbiosis score points for governance participation
    setUser((prev) => ({
      ...prev,
      symbiosisScore: prev.symbiosisScore + 15,
    }));

    addToast(
      '🏛️ Bioregional DAO Vote Cast!',
      `Cast ${user.symbiosisScore} votes (${vote.toUpperCase()}) on proposal (+15 Symbiosis pts).`,
      'success'
    );
  };

  // DAO Governance Create Proposal Handler
  const handleCreateProposal = (data: {
    title: string;
    description: string;
    category: ProposalCategory;
  }) => {
    const newProp: DaoProposal = {
      id: `prop-${Date.now()}`,
      title: data.title,
      description: data.description,
      category: data.category,
      authorCallsign: user.callsign,
      votesYes: user.symbiosisScore,
      votesNo: 0,
      votesAbstain: 0,
      userVoted: 'yes',
      status: 'active',
      endsAt: Date.now() + 604800000,
      symbiosisReward: 15,
      requiredQuorum: 200,
    };

    setDaoProposals((prev) => [newProp, ...prev]);

    setUser((prev) => ({
      ...prev,
      symbiosisScore: prev.symbiosisScore + 15,
    }));

    addToast(
      '🏛️ Bioregional Proposal Published',
      `"${data.title}" broadcasted to council (+15 Symbiosis pts).`,
      'success'
    );
  };
  // Dialog & Sheet States
  const [selectedPeerForDetail, setSelectedPeerForDetail] = useState<MeshNode | null>(null);
  const [selectedPeerForReputation, setSelectedPeerForReputation] = useState<MeshNode | null>(null);
  const [selectedResourceForDetail, setSelectedResourceForDetail] = useState<ResourceItem | null>(null);

  // Chat Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatActivePeer, setChatActivePeer] = useState<MeshNode | null>(null);

  // Reflection Dialog State
  const [reflectionResource, setReflectionResource] = useState<ResourceItem | null>(null);

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);

  // Persistence to localStorage
  useEffect(() => {
    localStorage.setItem('hoimu_night_mode', JSON.stringify(isNightMode));
  }, [isNightMode]);

  useEffect(() => {
    setSecureLocalStorage('hoimu_user', user);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('hoimu_battery', JSON.stringify(batteryStatus));
  }, [batteryStatus]);

  useEffect(() => {
    localStorage.setItem('hoimu_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('hoimu_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    setSecureLocalStorage('hoimu_journal', journal);
  }, [journal]);

  useEffect(() => {
    setSecureLocalStorage('hoimu_messages', messages);
  }, [messages]);

  // Local Toast Notifications State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast Helper
  const addToast = useCallback((title: string, description?: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    const newToast: ToastMessage = { id, title, description, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Toggle Night Mode Theme
  const handleToggleNightMode = () => {
    setIsNightMode((prev) => {
      const next = !prev;
      addToast(
        next ? 'Night Mode Activated' : 'Day Mode Activated',
        next
          ? 'Deep forest palette (#1A2617) engaged for night-time field operation.'
          : 'Solarpunk earth tones (#FAF6EE) restored for daytime visibility.',
        'info'
      );
      return next;
    });
  };

  // Solar-Aware & Solar Panels Toggle Action
  const handleToggleSolarAware = () => {
    const nextState = !batteryStatus.isSolarAwareActive;
    setBatteryStatus((prev) => ({
      ...prev,
      isSolarAwareActive: nextState,
      hasSolarPanels: nextState,
      solarHarvestRateW: nextState ? 14.8 : 0,
      radarRefreshRateHz: nextState ? 0.5 : 2.0,
      wifiDirectSyncEnabled: !nextState,
      workManagerIntervalMinutes: nextState ? 15 : 5,
    }));

    if (nextState) {
      addToast(
        '☀️ Päikesepaneelid & Solar-Saver SEES',
        'Päikesepaneeli laadimine aktiveeritud (~14.8W), BLE energiasääst ja 15m taustatsükkel töös.',
        'success'
      );
    } else {
      addToast(
        '🔌 Solar-Saver & Päikesepaneelid VÄLJAS',
        'Tavapärane akurežiim (0W päikesetoodang), täiskiirusel BLE + Wi-Fi Direct sünkroonimine.',
        'info'
      );
    }
  };

  // Simulate discovering a new neighboring peer node
  const handleDiscoverNewPeer = () => {
    const undiscovered = DISCOVERABLE_PEERS.filter(
      (candidate) => !peers.some((p) => p.id === candidate.id)
    );

    if (undiscovered.length > 0) {
      const nextPeer = undiscovered[0];
      setPeers((prev) => [nextPeer, ...prev]);
      addToast(
        `📡 New Mesh Peer Discovered: ${nextPeer.callsign}`,
        `Signal lock established via ${nextPeer.radioType || 'BLE'} (${nextPeer.lastRssi} dBm, ${
          nextPeer.hopDistance === 1 ? '1 hop direct' : `${nextPeer.hopDistance} hops`
        }).`,
        'success'
      );
    } else {
      // Create a dynamic bio-regional field node if all presets are already discovered
      const prefixes = ['Fern', 'Birch', 'Lichen', 'Rowan', 'Brook', 'Cedar', 'Hawk'];
      const suffixes = ['Spire', 'Spring', 'Glade', 'Ridge', 'Haven', 'Forge', 'Echo'];
      const skillsPool = [
        'LiFePO4 Welding',
        'Solar Inverters',
        'Ham Radio',
        'Herbal Tinctures',
        'Permaculture',
        'Micro-hydro',
      ];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const randomCallsign = `${randomPrefix}-${randomSuffix}`;
      const randomId = `peer_dyn_${Date.now()}`;
      const randomRssi = Math.floor(Math.random() * 35) - 82; // -82 to -47 dBm
      const isDirect = randomRssi > -65;
      const radioType: 'BLE' | 'Wi-Fi Direct' = Math.random() > 0.5 ? 'BLE' : 'Wi-Fi Direct';

      const generatedPeer: MeshNode = {
        id: randomId,
        callsign: randomCallsign,
        bio: 'Decentralized energy micro-grid and regional resilient food web enthusiast.',
        skills: [skillsPool[Math.floor(Math.random() * skillsPool.length)], 'Emergency Comms'],
        lastRssi: randomRssi,
        hopDistance: isDirect ? 1 : 2,
        lastSeen: 'Just now',
        trustScore: Math.floor(Math.random() * 25) + 70,
        completedExchanges: Math.floor(Math.random() * 20) + 5,
        relayReliability: 97.2,
        isDirect,
        connectionState: isDirect ? 'direct' : 'relayed',
        avatarSeed: `avatar-${randomId}`,
        recentInteractions: [4, 8, 15, 22],
        angle: Math.floor(Math.random() * 360),
        distanceRatio: isDirect ? 0.35 : 0.65,
        radioType,
        linkQualityPercent: Math.max(
          30,
          Math.min(98, Math.round(100 - (Math.abs(randomRssi) - 40) * 1.3))
        ),
        channelOrFrequency: radioType === 'BLE' ? 'BLE Adv Ch 37' : 'Wi-Fi P2P Ch 6',
      };

      setPeers((prev) => [generatedPeer, ...prev]);
      addToast(
        `📡 New Mesh Peer Discovered: ${generatedPeer.callsign}`,
        `Discovered via RF scan (${radioType}, ${generatedPeer.lastRssi} dBm).`,
        'success'
      );
    }
  };

  // Scan Beacons Action (Simulated)
  const handleRefreshScan = () => {
    setIsScanning(true);
    addToast(
      'Scanning 2.4GHz BLE & Wi-Fi Direct Beacons...',
      'Discovering direct links and multi-hop mesh neighbors.',
      'info'
    );

    setTimeout(() => {
      setIsScanning(false);
      localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());

      // Check if there is an undiscovered peer to discover organically during scan
      const undiscovered = DISCOVERABLE_PEERS.filter(
        (candidate) => !peers.some((p) => p.id === candidate.id)
      );

      if (undiscovered.length > 0 && Math.random() > 0.25) {
        const nextPeer = undiscovered[0];
        setPeers((prev) => [nextPeer, ...prev]);
        addToast(
          `✨ New Neighbor Discovered: ${nextPeer.callsign}`,
          `Direct link established via ${nextPeer.radioType || 'BLE'} at ${nextPeer.lastRssi} dBm.`,
          'success'
        );
      } else {
        // Naturally fluctuate RSSI slightly to reflect real-world RF propagation
        setPeers((prev) =>
          prev.map((p) => ({
            ...p,
            lastRssi: Math.max(-92, Math.min(-42, p.lastRssi + Math.floor(Math.random() * 5) - 2)),
            lastSeen: 'Just now',
          }))
        );
      }

      const matchCount = activeWishlistMatches.length;
      addToast(
        'Scan Completed',
        `RF spectrum scan complete. Active peers verified in local mesh range.${
          matchCount > 0
            ? ` ${matchCount} active wishlist match${matchCount === 1 ? '' : 'es'} found in range!`
            : ''
        }`,
        'success'
      );
    }, 1200);
  };

  // 2026 UX: Global Keyboard Shortcuts (Cmd+K Command Palette, 1-6 Tabs, Esc Close, N/F/S/G Hotkeys, ? Help)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable;

      // Cmd+K or Ctrl+K opens Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsOpen(false);
        setIsOnboardingOpen(false);
        setIsBackupPromptOpen(false);
        setIsQuickAddOpen(false);
        setIsWishlistOpen(false);
        setIsDaoModalOpen(false);
        setIsCalendarOpen(false);
        setIsSkillsOpen(false);
        setIsTrustOpen(false);
        setIsManualOpen(false);
        setSelectedPeerForDetail(null);
        setSelectedResourceForDetail(null);
        setReflectionResource(null);
        return;
      }

      // Ignore single character shortcuts while user is actively typing in form inputs
      if (isInput) return;

      // Question mark '?' for shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 1 to 6 tab switching
      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const tabMap: NavTab[] = ['mesh', 'map', 'pathfinder', 'exchange', 'journal', 'profile'];
        const targetTab = tabMap[parseInt(e.key, 10) - 1];
        if (targetTab) {
          soundFeedback.playClick();
          setActiveTab(targetTab);
        }
        return;
      }

      // 'r' for RF spectrum scan
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        soundFeedback.playPacketTransmit();
        handleDiscoverNewPeer();
        return;
      }

      // 'n' for night mode
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleNightMode();
        return;
      }

      // 'f' for focus mode
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleFocusMode();
        return;
      }

      // 's' for solar-saver mode
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleSolarAware();
        return;
      }

      // 'g' for glove mode
      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleGloveMode();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    handleToggleNightMode,
    handleToggleFocusMode,
    handleToggleSolarAware,
    handleToggleGloveMode,
    handleDiscoverNewPeer,
  ]);

  // Request Mutual Aid Exchange
  const handleRequestExchange = (resource: ResourceItem) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      resourceId: resource.id,
      resourceTitle: resource.title,
      requesterId: user.id,
      requesterCallsign: user.callsign,
      providerId: resource.ownerId,
      providerCallsign: resource.ownerCallsign,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    addToast(
      'Mutual Aid Requested',
      `Exchange packet queued for ${resource.ownerCallsign} for "${resource.title}".`,
      'success'
    );
  };

  // Trigger Complete & Reflect from resource modal or list
  const handleOpenReflection = (resource: ResourceItem) => {
    setReflectionResource(resource);
  };

  // Save Reflection & Complete Transaction
  const handleSaveReflection = (reflectionText: string, sentiment: SentimentType) => {
    if (!reflectionResource) return;

    // 1. Mark transaction as completed (or create one as completed if missing)
    setTransactions((prev) => {
      const existingIdx = prev.findIndex((t) => t.resourceId === reflectionResource.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          status: 'completed',
          updatedAt: Date.now(),
          reflection: reflectionText,
        };
        return updated;
      } else {
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          resourceId: reflectionResource.id,
          resourceTitle: reflectionResource.title,
          requesterId: user.id,
          requesterCallsign: user.callsign,
          providerId: reflectionResource.ownerId,
          providerCallsign: reflectionResource.ownerCallsign,
          status: 'completed',
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          reflection: reflectionText,
        };
        return [newTx, ...prev];
      }
    });

    // 2. Add Journal Entry
    const newJournalEntry: JournalEntry = {
      id: `journal-${Date.now()}`,
      partnerCallsign: reflectionResource.ownerCallsign,
      resourceTitle: reflectionResource.title,
      reflection: reflectionText,
      sentiment: sentiment,
      scoreDelta: 5,
      timestamp: Date.now(),
    };
    setJournal((prev) => [newJournalEntry, ...prev]);

    // 3. Increment User Symbiosis Score
    setUser((prev) => ({
      ...prev,
      symbiosisScore: prev.symbiosisScore + 5,
      completedExchanges: prev.completedExchanges + 1,
    }));

    addToast(
      'Reflection Recorded & Exchange Completed',
      `+5 Symbiosis points added to your Bioregion Ledger!`,
      'success'
    );

    setReflectionResource(null);
  };

  // Send P2P or Broadcast Message
  const handleSendMessage = (text: string, recipientId: string, recipientCallsign: string) => {
    const newMessage: MeshMessage = {
      id: `msg-${Date.now()}`,
      from: user.callsign,
      to: recipientCallsign,
      content: btoa(JSON.stringify({ text })),
      ttl: 3,
      signature: `SIG_ED25519_${Date.now()}`,
      senderId: user.id,
      senderCallsign: user.callsign,
      recipientId: recipientId,
      recipientCallsign: recipientCallsign,
      text: text,
      decryptedText: text,
      timestamp: Date.now(),
      status: 'pending',
      hopCount: recipientId === 'broadcast' ? 1 : 1,
      rssi: -58,
      isRead: true,
    };

    setMessages((prev) => [...prev, newMessage]);

    // Simulate transition to delivered
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'delivered' } : m))
      );
      addToast(
        'Mesh Packet Delivered',
        `Packet successfully acknowledged by ${recipientCallsign}.`,
        'success'
      );
    }, 800);
  };

  // Retry Failed Message
  const handleRetryMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'pending' } : m))
    );
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 700);
  };

  // Update Profile
  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      setSecureLocalStorage('hoimu_user', next);
      return next;
    });
    addToast('Profile Updated', 'Identity and bioregional tags saved locally.', 'success');
  };

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      setSecureLocalStorage('hoimu_user', next);
      return next;
    });
  };

  // Reset Demo Data
  const handleResetDemoData = () => {
    localStorage.removeItem('hoimu_user');
    localStorage.removeItem('hoimu_battery');
    localStorage.removeItem('hoimu_peers');
    localStorage.removeItem('hoimu_resources');
    localStorage.removeItem('hoimu_transactions');
    localStorage.removeItem('hoimu_journal');
    localStorage.removeItem('hoimu_messages');
    localStorage.removeItem('hoimu_night_mode');

    setUser(INITIAL_USER);
    setBatteryStatus(INITIAL_BATTERY_STATUS);
    setPeers(INITIAL_PEERS);
    setResources(INITIAL_RESOURCES);
    setTransactions(INITIAL_TRANSACTIONS);
    setJournal(INITIAL_JOURNAL);
    setMessages(INITIAL_MESSAGES);
    setIsNightMode(false);

    addToast('Demo Data Reset', 'Restored to clean Solarpunk seed state.', 'info');
  };

  // Quick Open Chat
  const handleOpenChatWithPeer = (peer: MeshNode | null) => {
    setChatActivePeer(peer);
    setIsChatOpen(true);
  };

  // Find transaction for selected resource modal
  const activeResourceTransaction = selectedResourceForDetail
    ? transactions.find((t) => t.resourceId === selectedResourceForDetail.id)
    : undefined;

  const activeResourcePeer = selectedResourceForDetail
    ? peers.find((p) => p.id === selectedResourceForDetail.ownerId)
    : undefined;

  const completedExchangesCount = transactions.filter((t) => t.status === 'completed').length;

  if (isLandingPageView) {
    return (
      <div className={`min-h-screen ${isNightMode ? 'dark' : ''}`}>
        <HoimuLandingPage
          onEnterApp={() => {
            setIsLandingPageView(false);
            if (typeof window !== 'undefined' && window.location.hash === '#landing') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
          onNavigateToTab={(tab) => {
            setActiveTab(tab);
            setIsLandingPageView(false);
            if (typeof window !== 'undefined' && window.location.hash === '#landing') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
          isNightMode={isNightMode}
          onToggleNightMode={handleToggleNightMode}
          peersCount={peers.length}
          batteryStatus={batteryStatus}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans flex flex-col antialiased selection:bg-[#87A878]/30 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#1A2617] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] text-[#243128]'
      }`}
    >
      {/* Emergency SOS Received Alert Banner */}
      <SosAlertBanner
        userCallsign={user.callsign}
        onSelectOnMap={(lat, lng) => {
          setActiveTab('map');
        }}
        isNightMode={isNightMode}
      />

      {/* Top Application Header */}
      <HoimuAppHeader
        batteryStatus={batteryStatus}
        onToggleSolarAware={handleToggleSolarAware}
        peerCount={peers.length}
        isNightMode={isNightMode}
        onToggleNightMode={handleToggleNightMode}
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        isCrisisMode={isCrisisMode}
        onToggleCrisisMode={() => setIsCrisisMode(!isCrisisMode)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenTrust={() => setIsTrustOpen(true)}
        onOpenManual={() => setIsManualOpen(true)}
        onOpenLandingPage={() => setIsLandingPageView(true)}
        onOpenSecurityKeys={() => setIsSecurityKeysOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenPiBridge={() => {
          setActiveTab('profile');
          setTimeout(() => {
            document.getElementById('pi-bridge-panel')?.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        }}
        userCallsign={user.callsign}
        onSosTriggered={(reason) => {
          addToast('🚨 SOS BEACON ACTIVATED', `Emergency alert broadcasted across local mesh: ${reason}`, 'warning');
        }}
      />

      <OfflineIndicator onAddToast={addToast} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-28 md:pb-24 space-y-4">
        {/* Crisis Mode Emergency Bar */}
        {(isCrisisMode || crisisAlerts.some((a) => !a.resolved)) && (
          <CrisisModeBar
            isCrisisMode={isCrisisMode}
            onToggleCrisisMode={() => setIsCrisisMode(!isCrisisMode)}
            crisisAlerts={crisisAlerts}
            onBroadcastAlert={handleBroadcastAlert}
            onResolveAlert={handleResolveAlert}
            userCallsign={user.callsign}
            isNightMode={isNightMode}
          />
        )}

        {activeTab === 'mesh' && (
          <div className="flex-1 overflow-hidden flex flex-col h-full">
            <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
              <div className="pointer-events-auto">
                <QuickTip id="mesh-tip" message="See nearby mesh nodes. Connect with trusted peers to relay messages." />
              </div>
            </div>
            <MeshTab
              peers={peers}
              batteryStatus={batteryStatus}
              userSymbiosisScore={user.symbiosisScore}
              onToggleSolarAware={handleToggleSolarAware}
              onSelectPeer={(peer) => setSelectedPeerForDetail(peer)}
              onOpenReputation={(peer) => setSelectedPeerForReputation(peer)}
              onOpenChatWithPeer={handleOpenChatWithPeer}
              onRefreshScan={handleRefreshScan}
              onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
              onDiscoverPeer={handleDiscoverNewPeer}
              isScanning={isScanning}
              isNightMode={isNightMode}
            />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="flex-1 overflow-hidden flex flex-col h-full relative">
            <div className="shrink-0 absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-sm">
              <div className="pointer-events-auto">
                <QuickTip id="map-tip" message="Switch between layers, walk to uncover areas, or long-press to drop a custom survival marker." />
              </div>
            </div>
            <MapViewTab
              peers={peers}
              resources={resources}
              user={user}
              onUpdateUser={handleUpdateUser}
              onAddToast={addToast}
              isNightMode={isNightMode}
              filterOnlyNew={filterOnlyNewMap}
              onViewResourceDetails={(resource) => setSelectedResourceForDetail(resource)}
              onSelectPeer={(peer) => setSelectedPeerForDetail(peer)}
              onOpenChatWithPeer={handleOpenChatWithPeer}
              onOpenReputation={(peer) => setSelectedPeerForReputation(peer)}
              batteryStatus={batteryStatus}
            />
          </div>
        )}

        {activeTab === 'pathfinder' && (
          <div className="flex-1 overflow-hidden flex flex-col h-full relative">
            <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
              <div className="pointer-events-auto">
                <QuickTip id="pathfinder-tip" message="Scan for offline Wi-Fi, Bluetooth, and LoRa signals." />
              </div>
            </div>
            <PathfinderTab
              isNightMode={isNightMode}
              onNavigateToMapWithFilter={(filterNew) => {
                setFilterOnlyNewMap(filterNew);
                setActiveTab('map');
              }}
            />
          </div>
        )}

        {activeTab === 'exchange' && (
          <div className="flex-1 overflow-hidden flex flex-col h-full relative">
            <div className="shrink-0 absolute top-0 left-0 right-0 z-20 pointer-events-none">
              <div className="pointer-events-auto">
                <QuickTip id="exchange-tip" message="Trade resources or services offline securely." />
              </div>
            </div>
            <ExchangeTab
              resources={resources}
              transactions={transactions}
              peers={peers}
              userSymbiosisScore={user.symbiosisScore}
              onViewResourceDetails={(resource) => setSelectedResourceForDetail(resource)}
              onOpenCreateOffering={() => setIsQuickAddOpen(true)}
              onOpenWishlist={() => setIsWishlistOpen(true)}
              onOpenDaoModal={() => setIsDaoModalOpen(true)}
              isNightMode={isNightMode}
            />
          </div>
        )}

        {activeTab === 'journal' && (
          <JournalTab
            journal={journal}
            peers={peers}
            userSymbiosisScore={user.symbiosisScore}
            completedExchangesCount={completedExchangesCount}
            isNightMode={isNightMode}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            journal={journal}
            transactions={transactions}
            proposals={daoProposals}
            peers={peers}
            endorsements={endorsements}
            resources={resources}
            messages={messages}
            onSelectPeer={(peer) => setSelectedPeerForDetail(peer)}
            onUpdateProfile={handleUpdateProfile}
            onResetDemoData={handleResetDemoData}
            isNightMode={isNightMode}
            onToggleNightMode={handleToggleNightMode}
            isGloveMode={isGloveMode}
            onToggleGloveMode={handleToggleGloveMode}
            isHighContrast={isHighContrast}
            onToggleHighContrast={handleToggleHighContrast}
            isDirectSun={isDirectSun}
            onToggleDirectSun={handleToggleDirectSun}
            onOpenBackupSetup={() => setIsBackupPromptOpen(true)}
            onOpenWishlist={() => setIsWishlistOpen(true)}
            onOpenDaoModal={() => setIsDaoModalOpen(true)}
            onOpenLandingPage={() => setIsLandingPageView(true)}
            onAddToast={addToast}
          />
        )}
      </main>

      {/* Screen Reader Live Region for Mesh Network Status */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" id="sr-mesh-announcer">
        {peers.length === 0
          ? '0 peers nearby on local mesh network.'
          : `${peers.length} peer${peers.length === 1 ? '' : 's'} nearby, strongest signal ${peers[0]?.callsign || 'node'} at ${peers[0]?.lastRssi || -60} dBm.`}
      </div>

      {/* Floating Action Button (FAB) - Quick Add Resource Offer/Need */}
      <button
        type="button"
        id="quick-add-fab-btn"
        onClick={() => {
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
          }
          setIsFabRippling(true);
          setTimeout(() => setIsFabRippling(false), 600);
          setIsQuickAddOpen(true);
        }}
        className={`fixed bottom-20 right-5 sm:bottom-6 sm:right-6 z-40 p-3.5 bg-[#203A2A] hover:bg-[#16271c] text-[#E9C46A] rounded-2xl shadow-2xl border border-[#87A878]/50 transition-all active:scale-95 cursor-pointer flex items-center gap-2 group animate-fab-breathing ${isFabRippling ? 'animate-active-ripple' : ''}`}
        title={
          activeWishlistMatchesCount > 0
            ? `Quick Post Resource Offer or Request (${activeWishlistMatchesCount} active wishlist match${activeWishlistMatchesCount === 1 ? '' : 'es'} found in recent scan)`
            : 'Quick Post Resource Offer or Request'
        }
        aria-label="Quick Post Resource Offer or Request"
      >
        <div className="w-7 h-7 rounded-xl bg-[#588157] text-white flex items-center justify-center shrink-0">
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
        </div>
        <span className="font-display font-bold text-xs pr-1 hidden sm:inline text-white">
          Quick Add
        </span>

        {/* Active Wishlist Matches Notification Badge */}
        {activeWishlistMatchesCount > 0 && (
          <span
            id="quick-add-wishlist-badge"
            data-testid="quick-add-wishlist-badge"
            className={`absolute -top-2 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#E76F51] text-white text-[11px] font-mono font-bold shadow-md border-2 border-[#203A2A] ${activeWishlistMatchesCount > lastSeenMatchesCount ? 'animate-pulse' : ''}`}
            title={`${activeWishlistMatchesCount} active wishlist match${activeWishlistMatchesCount === 1 ? '' : 'es'} found in recent scan`}
            aria-label={`${activeWishlistMatchesCount} active wishlist matches found in recent scan`}
          >
            {activeWishlistMatchesCount}
          </span>
        )}
      </button>

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isNightMode={isNightMode}
      />

      {/* Modals, Drawers & Sheets */}
      {/* 0. Quick Add Resource FAB Modal */}
      <QuickAddResourceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSubmit={handleQuickAddResource}
        isNightMode={isNightMode}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        activeWishlistMatchesCount={activeWishlistMatchesCount}
      />

      {/* 1. Wishlist Resource Alerts Manager Modal */}
      <WishlistAlertModal
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlist={wishlist}
        onAddWishlistItem={handleAddWishlistItem}
        onRemoveWishlistItem={handleRemoveWishlistItem}
        isNightMode={isNightMode}
      />

      {/* 2. Bioregional Solarpunk DAO Governance Modal */}
      <BioregionalDaoModal
        isOpen={isDaoModalOpen}
        onClose={() => setIsDaoModalOpen(false)}
        user={user}
        proposals={daoProposals}
        onVoteProposal={handleVoteProposal}
        onCreateProposal={handleCreateProposal}
        isNightMode={isNightMode}
      />

      {/* 3. Community Calendar Modal */}
      <CommunityCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        events={calendarEvents}
        onAddEvent={handleAddCalendarEvent}
        onToggleRsvp={handleToggleRsvp}
        isNightMode={isNightMode}
        userCallsign={user.callsign}
      />

      {/* 4. Skill Exchange Modal */}
      <SkillExchangeModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        skills={skills}
        onAddSkill={handleAddSkill}
        onRequestSkillSession={handleRequestSkillSession}
        isNightMode={isNightMode}
        userCallsign={user.callsign}
      />

      {/* 5. Chain of Trust Endorsement Modal */}
      <ChainOfTrustModal
        isOpen={isTrustOpen}
        onClose={() => setIsTrustOpen(false)}
        transactions={transactions}
        endorsements={endorsements}
        user={user}
        peers={peers}
        onEndorseTransaction={handleEndorseTransaction}
        isNightMode={isNightMode}
      />

      {/* 6. HÕIMU Field Manual & Self-Hosting Guide */}
      <HoimuLandingPageModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onOpenFullLandingPage={() => setIsLandingPageView(true)}
        isNightMode={isNightMode}
      />

      {/* 3. Periodic Local Data Backup Setup Modal */}
      <LocalDataBackupPromptModal
        isOpen={isBackupPromptOpen}
        onClose={() => setIsBackupPromptOpen(false)}
        onExportJSON={handleExportLocalDataJSON}
        isNightMode={isNightMode}
      />
      {/* 4. Reputation Breakdown Dialog */}
      <ReputationBreakdownDialog
        peer={selectedPeerForReputation}
        onClose={() => setSelectedPeerForReputation(null)}
      />

      {/* 2. Peer Detail Bottom Sheet */}
      <PeerDetailBottomSheet
        peer={selectedPeerForDetail}
        onClose={() => setSelectedPeerForDetail(null)}
        onOpenReputation={(peer) => {
          setSelectedPeerForDetail(null);
          setSelectedPeerForReputation(peer);
        }}
        onOpenChat={(peer) => {
          setSelectedPeerForDetail(null);
          handleOpenChatWithPeer(peer);
        }}
      />

      {/* 3. Resource Detail Modal */}
      <ResourceDetailModal
        resource={selectedResourceForDetail}
        transaction={activeResourceTransaction}
        peer={activeResourcePeer}
        onClose={() => setSelectedResourceForDetail(null)}
        onRequestExchange={handleRequestExchange}
        onCompleteExchange={(resource) => {
          setSelectedResourceForDetail(null);
          handleOpenReflection(resource);
        }}
        onOpenChat={(peer) => {
          setSelectedResourceForDetail(null);
          handleOpenChatWithPeer(peer);
        }}
        onOpenReputation={(peer) => {
          setSelectedResourceForDetail(null);
          setSelectedPeerForReputation(peer);
        }}
      />

      {/* 4. Reflection Dialog */}
      <ReflectionDialog
        isOpen={Boolean(reflectionResource)}
        partnerCallsign={reflectionResource?.ownerCallsign || ''}
        resourceTitle={reflectionResource?.title || ''}
        onClose={() => setReflectionResource(null)}
        onSaveReflection={handleSaveReflection}
      />

      {/* 5. Mesh Chat Drawer */}
      <MeshChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
        activePeer={chatActivePeer}
        currentUserId={user.id}
        currentUserCallsign={user.callsign}
      />

      {/* 6. Security Key Manager Modal */}
      <SecurityKeyManagerModal
        isOpen={isSecurityKeysOpen}
        onClose={() => setIsSecurityKeysOpen(false)}
        cryptoIdentity={cryptoIdentity}
        onImportIdentity={(imported) => {
          setCryptoIdentity(imported);
          localStorage.setItem('hoimu_crypto_identity', JSON.stringify(imported));
          addToast('✓ Key Imported', `Active identity set to ${imported.publicKey.slice(0, 16)}...`, 'success');
        }}
        isNightMode={isNightMode}
      />

      {/* 7. Detailed Network Diagnostics & RF Telemetry Modal */}
      <NetworkDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        peers={peers}
        batteryStatus={batteryStatus}
        userCallsign={user.callsign}
        isNightMode={isNightMode}
      />

       {/* 8. Elegant Achievement Celebration Overlay */}
      <AchievementCelebrationOverlay
        achievement={activeAchievementCelebration}
        onClose={() => setActiveAchievementCelebration(null)}
        isNightMode={isNightMode}
      />

      {/* 9. Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={handleCloseOnboarding}
        isNightMode={isNightMode}
        onComplete={handleCompleteOnboarding}
        currentUser={user}
      />

      {/* 2026 UX: Solarpunk Quick Action Hub / Floating Action Button */}
      <QuickActionDial
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenJournal={() => {
          setActiveTab('journal');
        }}
        onRefreshScan={handleDiscoverNewPeer}
        onTriggerSos={() => {
          setIsCrisisMode(true);
          addToast('🚨 SOS Emergency Activated', 'Distress telemetry dispatched to all RF mesh neighbors.', 'warning');
        }}
        isNightMode={isNightMode}
      />

      {/* 2026 UX: Global Command Palette & Solarpunk Search */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        peers={peers}
        resources={resources}
        onSelectPeer={(peer) => {
          setSelectedPeerForDetail(peer);
        }}
        onSelectResource={(res) => {
          setSelectedResourceForDetail(res);
        }}
        isNightMode={isNightMode}
        onToggleNightMode={handleToggleNightMode}
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        isGloveMode={isGloveMode}
        onToggleGloveMode={handleToggleGloveMode}
        isDirectSun={isDirectSun}
        onToggleDirectSun={handleToggleDirectSun}
        isSolarAware={batteryStatus.isSolarAwareActive}
        onToggleSolarAware={handleToggleSolarAware}
        onRefreshScan={handleDiscoverNewPeer}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenDao={() => setIsDaoModalOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenTrust={() => setIsTrustOpen(true)}
        onOpenManual={() => setIsManualOpen(true)}
        onOpenSecurityKeys={() => setIsSecurityKeysOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onExportLedger={handleExportLocalDataJSON}
        onTriggerSos={() => {
          setIsCrisisMode(true);
          addToast('🚨 SOS Emergency Activated', 'Distress telemetry dispatched to all RF mesh neighbors.', 'warning');
        }}
      />

      {/* 2026 UX: Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        isNightMode={isNightMode}
      />

      {/* 10. Non-intrusive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
export default App;
