import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserProfile,
  MeshNode,
  ResourceItem,
  Transaction,
  JournalEntry,
  MeshMessage,
  BatteryManagerStatus,
  ToastMessage,
  WishlistItem,
  CalendarEvent,
  SkillExchangeItem,
  TrustEndorsement,
  CrisisAlert,
  DaoProposal,
  ProposalCategory,
  ResourceCategory,
  CryptoIdentity,
  SentimentType,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_BATTERY_STATUS,
  INITIAL_PEERS,
  DISCOVERABLE_PEERS,
  INITIAL_RESOURCES,
  INITIAL_TRANSACTIONS,
  INITIAL_JOURNAL,
  INITIAL_MESSAGES,
} from '../data/initialData';
import {
  INITIAL_CALENDAR_EVENTS,
  INITIAL_SKILLS,
  INITIAL_ENDORSEMENTS,
  INITIAL_CRISIS_ALERTS,
  INITIAL_DAO_PROPOSALS,
  INITIAL_WISHLIST,
  INITIAL_CRYPTO_IDENTITY,
} from '../data/communityData';
import { useMeshStore, selectPeersArray } from '../store/meshStore';
import { getSecureLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';
import { achievementService, Achievement } from '../services/game/achievementService';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';
import { initMeshSync } from '../services/mesh/meshSync';
import { backgroundSyncAdjuster } from '../services/mesh/backgroundSyncAdjuster';
import { initMessageStorage } from '../services/comms/messageService';
import { initSosService } from '../services/utils/sosService';
import { signCanonicalPayload } from '../services/crypto/meshCrypto';

export interface UseAppDomainStateProps {
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
  isWishlistOpen: boolean;
}

export function useAppDomainState({ addToast, isWishlistOpen }: UseAppDomainStateProps) {
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
    return saved ? JSON.parse(saved) : INITIAL_CRYPTO_IDENTITY;
  });

  // FAB Active Ripple and Wishlist Pulse states
  const [lastSeenMatchesCount, setLastSeenMatchesCount] = useState<number>(0);
  const [isCrisisMode, setIsCrisisMode] = useState(false);
  const [activeAchievementCelebration, setActiveAchievementCelebration] = useState<Achievement | null>(null);

  // Persistence to localStorage
  useEffect(() => {
    setSecureLocalStorage('hoimu_user', user);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('hoimu_battery', JSON.stringify(batteryStatus));
    // Synchronize physical/simulated battery level with background sync interval adjuster
    backgroundSyncAdjuster.updateBatteryLevel(batteryStatus.batteryLevelPercent);
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

  // Export Local Ledger Data as formatted JSON Blob
  const handleExportLocalDataJSON = useCallback(() => {
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
  }, [user, batteryStatus, peers, resources, transactions, journal, messages, addToast]);

  // Calendar Event Handlers
  const handleAddCalendarEvent = useCallback((newEvent: Omit<CalendarEvent, 'id' | 'attendeesCount' | 'isUserAttending'>) => {
    const eventObj: CalendarEvent = {
      ...newEvent,
      id: `evt-${Date.now()}`,
      attendeesCount: 1,
      isUserAttending: true,
    };
    setCalendarEvents((prev) => [eventObj, ...prev]);
    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 10 }));
    addToast('📅 Calendar Event Published', `"${newEvent.title}" broadcasted to mesh (+10 Symbiosis pts).`, 'success');
  }, [addToast]);

  const handleToggleRsvp = useCallback((eventId: string) => {
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
  }, []);

  // Skill Exchange Handlers
  const handleAddSkill = useCallback((newSkill: Omit<SkillExchangeItem, 'id' | 'createdAt' | 'endorsementsCount'>) => {
    const skillObj: SkillExchangeItem = {
      ...newSkill,
      id: `sk-${Date.now()}`,
      createdAt: Date.now(),
      endorsementsCount: 1,
    };
    setSkills((prev) => [skillObj, ...prev]);
    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 10 }));
    addToast('🎓 Skill Listing Published', `"${newSkill.title}" broadcasted to local mesh.`, 'success');
  }, [addToast]);

  const handleRequestSkillSession = useCallback(
    (
      skill: SkillExchangeItem,
      details?: {
        preferredTime?: string;
        sessionFormat?: string;
        barterOffer?: string;
        note?: string;
      }
    ) => {
      const formatStr = details?.sessionFormat ? ` [Format: ${details.sessionFormat}]` : '';
      const barterStr = details?.barterOffer ? ` [Barter Offer: ${details.barterOffer}]` : '';
      const noteStr = details?.note ? ` Note: "${details.note}"` : '';

      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id ? { ...s, sessionRequestsCount: (s.sessionRequestsCount || 0) + 1 } : s
        )
      );

      if (skill.providerCallsign !== user.callsign) {
        const reqMessage: MeshMessage = {
          id: `msg-sk-${Date.now()}`,
          from: user.callsign,
          to: skill.providerCallsign,
          senderCallsign: user.callsign,
          recipientCallsign: skill.providerCallsign,
          content: `Skill Session Request for "${skill.title}"${formatStr}${barterStr}.${noteStr}`,
          text: `Hi ${skill.providerCallsign}, I would like to request a skill session for "${skill.title}"!${formatStr}${barterStr}.${noteStr}`,
          timestamp: Date.now(),
          ttl: 4,
          signature: `sig-sk-req-${Date.now()}`,
          status: 'delivered',
        };
        setMessages((prev) => [...prev, reqMessage]);
      }

      addToast(
        '🎓 Skill Session Requested',
        `Direct relay session request sent to ${skill.providerCallsign} for "${skill.title}".`,
        'success'
      );
    },
    [user.callsign, addToast]
  );

  // Trust Endorsement for Verified Trades
  const handleEndorseSkillTrade = useCallback(
    async (
      skillId: string,
      recipientCallsign: string,
      comment: string,
      rating: number = 5,
      transactionId?: string,
      tags: string[] = ['Verified Trade', 'Practical Mastery']
    ) => {
      const canonicalEndorsementData = {
        skillId,
        recipientCallsign,
        endorserCallsign: user.callsign,
        comment,
        rating,
        timestamp: Date.now(),
        transactionId: transactionId || `tx-sk-${Date.now().toString().slice(-6)}`,
      };

      const realSignature = await signCanonicalPayload(canonicalEndorsementData);
      const signatureHash = realSignature.substring(0, 32);

      const targetSkill = skills.find((s) => s.id === skillId);
      const skillTitle = targetSkill ? targetSkill.title : 'Community Skill Exchange';

      const newEndorsement: TrustEndorsement = {
        id: `end-sk-${Date.now()}`,
        transactionId: canonicalEndorsementData.transactionId,
        endorserCallsign: user.callsign,
        recipientCallsign,
        signatureHash,
        comment,
        timestamp: canonicalEndorsementData.timestamp,
        reputationBonus: 15,
        skillId,
        skillTitle,
        rating,
        tags,
        isTradeVerified: true,
      };

      setEndorsements((prev) => [newEndorsement, ...prev]);

      setSkills((prev) =>
        prev.map((s) => {
          if (s.id !== skillId) return s;
          const existingEndorsements = s.endorsements || [];
          return {
            ...s,
            endorsementsCount: (s.endorsementsCount || 0) + 1,
            isVerified: true,
            endorsements: [
              {
                id: newEndorsement.id,
                endorserCallsign: user.callsign,
                rating,
                comment,
                timestamp: canonicalEndorsementData.timestamp,
                signatureHash,
                isTradeVerified: true,
                tags,
              },
              ...existingEndorsements,
            ],
          };
        })
      );

      setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 15 }));
      addToast(
        '⭐ Verified Trade Endorsement Signed',
        `Granted +15 Symbiosis Pts to ${recipientCallsign} with genuine Ed25519 signature (${signatureHash.slice(0, 16)}...).`,
        'success'
      );
    },
    [skills, user.callsign, addToast]
  );

  // Trust Endorsement Handler
  const handleEndorseTransaction = useCallback(async (transactionId: string, comment: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    const recipientCallsign = tx.providerCallsign === user.callsign ? tx.requesterCallsign : tx.providerCallsign;
    const canonicalTxData = {
      transactionId,
      endorserCallsign: user.callsign,
      recipientCallsign,
      comment,
      timestamp: Date.now(),
    };

    const realSignature = await signCanonicalPayload(canonicalTxData);
    const signatureHash = realSignature.substring(0, 32);

    const newEndorsement: TrustEndorsement = {
      id: `end-${Date.now()}`,
      transactionId,
      endorserCallsign: user.callsign,
      recipientCallsign,
      signatureHash,
      comment,
      timestamp: canonicalTxData.timestamp,
      reputationBonus: 15,
    };

    setEndorsements((prev) => [newEndorsement, ...prev]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, isEndorsed: true } : t))
    );

    setUser((prev) => ({ ...prev, symbiosisScore: prev.symbiosisScore + 15 }));
    addToast('🛡️ Cryptographic Endorsement Signed', `Granted +15 Symbiosis Pts and generated proof hash ${signatureHash.slice(0, 16)}...`, 'success');
  }, [transactions, user.callsign, addToast]);

  // Crisis Mode Handlers
  const handleBroadcastAlert = useCallback((newAlert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => {
    const alertObj: CrisisAlert = {
      ...newAlert,
      id: `sos-${Date.now()}`,
      timestamp: Date.now(),
      resolved: false,
    };
    setCrisisAlerts((prev) => [alertObj, ...prev]);
    a11yAnnouncer.announceCrisisAlert(alertObj.authorCallsign || user.callsign, alertObj.message);
    addToast('🚨 SOS BEACON TRANSMITTED', `Emergency alert flooded across all 433MHz/BLE channels!`, 'warning');
  }, [user.callsign, addToast]);

  const handleResolveAlert = useCallback((alertId: string) => {
    setCrisisAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
    addToast('✓ SOS Alert Resolved', 'Marked emergency beacon as cleared on local mesh.', 'info');
  }, [addToast]);

  // Quick Add FAB Submission Handler
  const handleQuickAddResource = useCallback((data: {
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
  }, [user, wishlist, addToast]);

  // Wishlist Handlers
  const handleAddWishlistItem = useCallback((keyword: string, category?: ResourceCategory | 'all') => {
    const newItem: WishlistItem = {
      id: `w-${Date.now()}`,
      keyword,
      category: category || 'all',
      createdAt: Date.now(),
      isActive: true,
    };
    setWishlist((prev) => [newItem, ...prev]);
    addToast('🔔 Wishlist Alert Added', `You will be alerted when "${keyword}" enters the mesh.`, 'success');
  }, [addToast]);

  const handleRemoveWishlistItem = useCallback((id: string) => {
    setWishlist((prev) => prev.filter((w) => w.id !== id));
    addToast('Wishlist Alert Removed', undefined, 'info');
  }, [addToast]);

  // DAO Governance Voting Handler
  const handleVoteProposal = useCallback((proposalId: string, vote: 'yes' | 'no' | 'abstain') => {
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

    setUser((prev) => ({
      ...prev,
      symbiosisScore: prev.symbiosisScore + 15,
    }));

    addToast(
      '🏛️ Bioregional DAO Vote Cast!',
      `Cast ${user.symbiosisScore} votes (${vote.toUpperCase()}) on proposal (+15 Symbiosis pts).`,
      'success'
    );
  }, [user.symbiosisScore, addToast]);

  // DAO Governance Create Proposal Handler
  const handleCreateProposal = useCallback((data: {
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
  }, [user.callsign, user.symbiosisScore, addToast]);

  // Solar-Aware & Solar Panels Toggle Action
  const handleToggleSolarAware = useCallback(() => {
    setBatteryStatus((prev) => {
      const nextState = !prev.isSolarAwareActive;
      const nextStatus: BatteryManagerStatus = {
        ...prev,
        isSolarAwareActive: nextState,
        hasSolarPanels: nextState,
        solarHarvestRateW: nextState ? 14.8 : 0,
        radarRefreshRateHz: nextState ? 0.5 : 2.0,
        wifiDirectSyncEnabled: !nextState,
        workManagerIntervalMinutes: nextState ? 15 : 5,
      };

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

      return nextStatus;
    });
  }, [addToast]);

  // Simulate discovering a new neighboring peer node
  const handleDiscoverNewPeer = useCallback(() => {
    const undiscovered = DISCOVERABLE_PEERS.filter(
      (candidate) => !peers.some((p) => p.id === candidate.id)
    );

    if (undiscovered.length > 0) {
      const nextPeer = undiscovered[0];
      setPeers((prev) => [nextPeer, ...prev]);
      a11yAnnouncer.announcePeerDiscovered(nextPeer.callsign, nextPeer.lastRssi);
      addToast(
        `📡 New Mesh Peer Discovered: ${nextPeer.callsign}`,
        `Signal lock established via ${nextPeer.radioType || 'BLE'} (${nextPeer.lastRssi} dBm, ${
          nextPeer.hopDistance === 1 ? '1 hop direct' : `${nextPeer.hopDistance} hops`
        }).`,
        'success'
      );
    } else {
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
      a11yAnnouncer.announcePeerDiscovered(generatedPeer.callsign, generatedPeer.lastRssi);
      addToast(
        `📡 New Mesh Peer Discovered: ${generatedPeer.callsign}`,
        `Discovered via RF scan (${radioType}, ${generatedPeer.lastRssi} dBm).`,
        'success'
      );
    }
  }, [peers, setPeers, addToast]);

  // Request Mutual Aid Exchange
  const handleRequestExchange = useCallback((resource: ResourceItem) => {
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
  }, [user, addToast]);

  // Save Reflection & Complete Transaction
  const handleSaveReflection = useCallback((
    reflectionResource: ResourceItem,
    reflectionText: string,
    sentiment: SentimentType
  ) => {
    // 1. Mark transaction as completed
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
  }, [user, addToast]);

  // Send P2P or Broadcast Message
  const handleSendMessage = useCallback(
    (text: string, attachmentOrRecipientId?: any, recipientCallsign?: string) => {
      const targetCallsign = recipientCallsign || 'Broadcast-Mesh';
      const targetId = typeof attachmentOrRecipientId === 'string' ? attachmentOrRecipientId : 'broadcast';
      const timestamp = Date.now();
      const id = `msg-${timestamp}`;
      const content = btoa(JSON.stringify({ text }));

      const newMessage: MeshMessage = {
        id,
        from: user.callsign,
        to: targetCallsign,
        content,
        ttl: 3,
        signature: '',
        senderId: user.id,
        senderCallsign: user.callsign,
        recipientId: targetId,
        recipientCallsign: targetCallsign,
        text: text,
        decryptedText: text,
        timestamp,
        status: 'pending',
        hopCount: targetId === 'broadcast' ? 1 : 1,
        rssi: -58,
        isRead: true,
      };

      // Asynchronously sign canonically
      signCanonicalPayload({
        id,
        from: user.callsign,
        to: targetCallsign,
        content,
        timestamp,
      })
        .then((sig) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, signature: sig } : m))
          );
        })
        .catch(() => {});

      setMessages((prev) => [...prev, newMessage]);
      a11yAnnouncer.announceIncomingMessage(user.callsign, text);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'delivered' } : m))
      );
      a11yAnnouncer.announce(`Mesh message delivered to ${targetCallsign}`, 'polite');
      addToast(
        'Mesh Packet Delivered',
        `Packet successfully acknowledged by ${targetCallsign}.`,
        'success'
      );
    }, 800);
  }, [user, addToast]);

  // Retry Failed Message
  const handleRetryMessage = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'pending' } : m))
    );
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 700);
  }, []);

  // Update Profile
  const handleUpdateProfile = useCallback((updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      setSecureLocalStorage('hoimu_user', next);
      return next;
    });
    addToast('Profile Updated', 'Identity and bioregional tags saved locally.', 'success');
  }, [addToast]);

  const handleUpdateUser = useCallback((updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      setSecureLocalStorage('hoimu_user', next);
      return next;
    });
  }, []);

  // Reset Demo Data
  const handleResetDemoData = useCallback(() => {
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

    addToast('Demo Data Reset', 'Restored to clean Solarpunk seed state.', 'info');
  }, [setPeers, addToast]);

  const handleImportIdentity = useCallback((imported: CryptoIdentity) => {
    setCryptoIdentity(imported);
    localStorage.setItem('hoimu_crypto_identity', JSON.stringify(imported));
    addToast('✓ Key Imported', `Active identity set to ${imported.publicKey.slice(0, 16)}...`, 'success');
  }, [addToast]);

  return {
    user,
    setUser,
    batteryStatus,
    setBatteryStatus,
    peers,
    setPeers,
    resources,
    setResources,
    transactions,
    setTransactions,
    journal,
    setJournal,
    messages,
    setMessages,
    wishlist,
    setWishlist,
    daoProposals,
    setDaoProposals,
    calendarEvents,
    setCalendarEvents,
    skills,
    setSkills,
    endorsements,
    setEndorsements,
    crisisAlerts,
    setCrisisAlerts,
    cryptoIdentity,
    setCryptoIdentity,
    isCrisisMode,
    setIsCrisisMode,
    activeAchievementCelebration,
    setActiveAchievementCelebration,
    lastSeenMatchesCount,
    setLastSeenMatchesCount,
    activeWishlistMatches,
    activeWishlistMatchesCount,

    // Actions
    handleExportLocalDataJSON,
    handleAddCalendarEvent,
    handleToggleRsvp,
    handleAddSkill,
    handleRequestSkillSession,
    handleEndorseSkillTrade,
    handleEndorseTransaction,
    handleBroadcastAlert,
    handleResolveAlert,
    handleQuickAddResource,
    handleAddWishlistItem,
    handleRemoveWishlistItem,
    handleVoteProposal,
    handleCreateProposal,
    handleToggleSolarAware,
    handleDiscoverNewPeer,
    handleRequestExchange,
    handleSaveReflection,
    handleSendMessage,
    handleRetryMessage,
    handleUpdateProfile,
    handleUpdateUser,
    handleResetDemoData,
    handleImportIdentity,
  };
}
