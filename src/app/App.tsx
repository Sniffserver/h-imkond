import React, { useState, useEffect, useCallback } from 'react';
import {
  MeshNode,
  ResourceItem,
  UserProfile,
  NavTab,
} from '../types';
import { DISCOVERABLE_PEERS } from '../data/initialData';
import { HoimuAppHeader } from '../components/HoimuAppHeader';
import { BottomNavBar } from '../components/BottomNavBar';
import { AppRoutes } from './routes';
import { AppModalsContainer } from '../components/AppModalsContainer';
import { HoimuLandingPage } from '../components/HoimuLandingPage';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { OfflineTransitionIndicator } from '../components/OfflineTransitionIndicator';
import { OfflineSyncProgress } from '../components/OfflineSyncProgress';
import { SosAlertBanner } from '../components/SosAlertBanner';
import { A11yLiveAnnouncer } from '../components/A11yLiveAnnouncer';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';
import { useAppToasts, AppProviders } from './providers';
import { useAppThemeModes } from '../hooks/useAppThemeModes';
import { useAppDomainState } from '../hooks/useAppDomainState';
import { useHighTrustProximityNotifier } from '../hooks/useHighTrustProximityNotifier';
import { soundFeedback } from '../services/utils/soundFeedback';
import { stringResource, R } from '../utils/stringResource';
import { getSafeLocalStorage, setSafeLocalStorage, setSecureLocalStorage } from '../utils/localStorageValidator';
import { Plus } from 'lucide-react';

export function AppContent() {
  const { toasts, addToast, dismissToast } = useAppToasts();

  // Theme & Environmental Mode Hook
  const {
    isNightMode,
    isFocusMode,
    isGloveMode,
    isHighContrast,
    isDirectSun,
    handleToggleNightMode,
    handleToggleFocusMode,
    handleToggleGloveMode,
    handleToggleHighContrast,
    handleToggleDirectSun,
  } = useAppThemeModes({ addToast });

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [filterOnlyNewMap, setFilterOnlyNewMap] = useState(false);

  // Modals Visibility & Floating States
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isDaoModalOpen, setIsDaoModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSecurityKeysOpen, setIsSecurityKeysOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBackupPromptOpen, setIsBackupPromptOpen] = useState(false);
  const [isFabRippling, setIsFabRippling] = useState(false);

  // Solarpunk Landing Page View State
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

  // First-time Onboarding State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    return !getSafeLocalStorage('hoimu_has_seen_onboarding', false);
  });

  useEffect(() => {
    const dismissed = localStorage.getItem('hoimu_backup_prompt_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => {
        setIsBackupPromptOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Selection & Detail Sheet States
  const [selectedPeerForDetail, setSelectedPeerForDetail] = useState<MeshNode | null>(null);
  const [selectedPeerForReputation, setSelectedPeerForReputation] = useState<MeshNode | null>(null);
  const [selectedResourceForDetail, setSelectedResourceForDetail] = useState<ResourceItem | null>(null);
  const [reflectionResource, setReflectionResource] = useState<ResourceItem | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatActivePeer, setChatActivePeer] = useState<MeshNode | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // App Domain State & Handlers Hook
  const {
    user,
    setUser,
    batteryStatus,
    peers,
    setPeers,
    resources,
    transactions,
    journal,
    messages,
    wishlist,
    daoProposals,
    calendarEvents,
    skills,
    endorsements,
    crisisAlerts,
    cryptoIdentity,
    isCrisisMode,
    setIsCrisisMode,
    activeAchievementCelebration,
    setActiveAchievementCelebration,
    lastSeenMatchesCount,
    activeWishlistMatches,
    activeWishlistMatchesCount,
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
  } = useAppDomainState({ addToast, isWishlistOpen });

  // High-Trust Peer Bluetooth Proximity Notifier (Triggers Haptic & Audible chime for RSSI > -70 dBm)
  useHighTrustProximityNotifier({
    peers,
    addToast,
    enabled: true,
  });

  // Onboarding Handlers
  const handleCloseOnboarding = useCallback(() => {
    setIsOnboardingOpen(false);
    setSafeLocalStorage('hoimu_has_seen_onboarding', true);
  }, []);

  const handleCompleteOnboarding = useCallback((updatedProfile?: Partial<UserProfile>, visibilityPrefs?: any) => {
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
  }, [setUser, addToast]);

  // Scan Beacons Action
  const handleRefreshScan = useCallback(() => {
    setIsScanning(true);
    addToast(
      'Scanning 2.4GHz BLE & Wi-Fi Direct Beacons...',
      'Discovering direct links and multi-hop mesh neighbors.',
      'info'
    );

    setTimeout(() => {
      setIsScanning(false);
      localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());

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
  }, [peers, setPeers, activeWishlistMatches.length, addToast]);

  const handleOpenChatWithPeer = useCallback((peer: MeshNode | null) => {
    setChatActivePeer(peer);
    setIsChatOpen(true);
  }, []);

  const handleOpenReflectionForResource = useCallback((resource: ResourceItem) => {
    setReflectionResource(resource);
  }, []);

  const handleTriggerSos = useCallback(() => {
    setIsCrisisMode(true);
    addToast('🚨 SOS Emergency Activated', 'Distress telemetry dispatched to all RF mesh neighbors.', 'warning');
  }, [setIsCrisisMode, addToast]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable;

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

      if (isInput) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

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

      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        soundFeedback.playPacketTransmit();
        handleDiscoverNewPeer();
        return;
      }

      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleNightMode();
        return;
      }

      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleFocusMode();
        return;
      }

      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleSolarAware();
        return;
      }

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

  const activeResourceTransaction = selectedResourceForDetail
    ? transactions.find((t) => t.resourceId === selectedResourceForDetail.id)
    : undefined;

  const activeResourcePeer = selectedResourceForDetail
    ? peers.find((p) => p.id === selectedResourceForDetail.ownerId)
    : undefined;

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
      {/* Keyboard Accessibility: Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#203A2A] focus:text-[#E9C46A] focus:font-bold focus:rounded-xl focus:shadow-2xl focus:border-2 focus:border-[#E9C46A] focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Screen Reader Live Announcements Container (Polite & Assertive) */}
      <A11yLiveAnnouncer />

      {/* Emergency SOS Received Alert Banner */}
      <SosAlertBanner
        userCallsign={user.callsign}
        onSelectOnMap={() => setActiveTab('map')}
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
        onOpenToolsModal={() => setIsToolsModalOpen(true)}
        onOpenQuickGuide={() => {
          document.getElementById('solarpunk-quick-start-guide')?.scrollIntoView({ behavior: 'smooth' });
        }}
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
      <OfflineTransitionIndicator
        isNightMode={isNightMode}
        onReconnect={() => {
          addToast('Checking Mesh & Network', 'Re-evaluating gateway status...', 'info');
        }}
      />
      <OfflineSyncProgress
        messages={messages}
        transactions={transactions}
        isNightMode={isNightMode}
        onAddToast={addToast}
      />

      {/* Main Tab Content Landmark */}
      <main id="main-content" role="main" tabIndex={-1} className="outline-none flex-1">
        <AppRoutes
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          peers={peers}
          resources={resources}
          transactions={transactions}
          journal={journal}
          messages={messages}
          daoProposals={daoProposals}
          endorsements={endorsements}
          crisisAlerts={crisisAlerts}
          batteryStatus={batteryStatus}
          isNightMode={isNightMode}
          isFocusMode={isFocusMode}
          isGloveMode={isGloveMode}
          isHighContrast={isHighContrast}
          isDirectSun={isDirectSun}
          isCrisisMode={isCrisisMode}
          isScanning={isScanning}
          filterOnlyNewMap={filterOnlyNewMap}
          setFilterOnlyNewMap={setFilterOnlyNewMap}
          onToggleNightMode={handleToggleNightMode}
          onToggleGloveMode={handleToggleGloveMode}
          onToggleHighContrast={handleToggleHighContrast}
          onToggleDirectSun={handleToggleDirectSun}
          onToggleSolarAware={handleToggleSolarAware}
          onToggleCrisisMode={() => setIsCrisisMode(!isCrisisMode)}
          onBroadcastAlert={handleBroadcastAlert}
          onResolveAlert={handleResolveAlert}
          onSelectPeerForDetail={(peer) => setSelectedPeerForDetail(peer)}
          onSelectPeerForReputation={(peer) => setSelectedPeerForReputation(peer)}
          onSelectResourceForDetail={(res) => setSelectedResourceForDetail(res)}
          onOpenChatWithPeer={handleOpenChatWithPeer}
          onRefreshScan={handleRefreshScan}
          onDiscoverPeer={handleDiscoverNewPeer}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          onUpdateUser={handleUpdateUser}
          onUpdateProfile={handleUpdateProfile}
          onResetDemoData={handleResetDemoData}
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          onOpenWishlist={() => setIsWishlistOpen(true)}
          onOpenDaoModal={() => setIsDaoModalOpen(true)}
          onOpenToolsModal={() => setIsToolsModalOpen(true)}
          onOpenManual={() => setIsManualOpen(true)}
          onOpenBackupSetup={() => setIsBackupPromptOpen(true)}
          onOpenLandingPage={() => setIsLandingPageView(true)}
          onOpenTrustModal={() => setIsTrustOpen(true)}
          onOpenSkillsModal={() => setIsSkillsOpen(true)}
          onOpenSecurityKeys={() => setIsSecurityKeysOpen(true)}
          addToast={addToast}
        />
      </main>

      {/* Screen Reader Live Region for Mesh Network Status */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" id="sr-mesh-announcer">
        {peers.length === 0
          ? '0 peers nearby on local mesh network.'
          : `${peers.length} peer${peers.length === 1 ? '' : 's'} nearby, strongest signal ${peers[0]?.callsign || 'node'} at ${peers[0]?.lastRssi || -60} dBm.`}
      </div>

      {/* Floating Action Button (FAB) */}
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
        className={`fixed bottom-20 right-5 sm:bottom-6 sm:right-6 z-40 p-3.5 bg-[#203A2A] hover:bg-[#16271c] text-[#E9C46A] rounded-2xl shadow-2xl border border-[#87A878]/50 transition-all active:scale-95 cursor-pointer flex items-center gap-2 group animate-fab-breathing ${
          isFabRippling ? 'animate-active-ripple' : ''
        }`}
        title="Quick Post Resource Offer or Request"
        aria-label="Quick Post Resource Offer or Request"
      >
        <div className="w-7 h-7 rounded-xl bg-[#588157] text-white flex items-center justify-center shrink-0">
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
        </div>
        <span className="font-display font-bold text-xs pr-1 hidden sm:inline text-white">
          Quick Add
        </span>
        {activeWishlistMatchesCount > 0 && (
          <span
            id="quick-add-wishlist-badge"
            data-testid="quick-add-wishlist-badge"
            className={`absolute -top-2 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#E76F51] text-white text-[11px] font-mono font-bold shadow-md border-2 border-[#203A2A] ${
              activeWishlistMatchesCount > lastSeenMatchesCount ? 'animate-pulse' : ''
            }`}
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

      {/* Modals, Drawers & Sheets Container */}
      <AppModalsContainer
        isNightMode={isNightMode}
        isFocusMode={isFocusMode}
        isGloveMode={isGloveMode}
        isDirectSun={isDirectSun}
        isCrisisMode={isCrisisMode}
        onToggleNightMode={handleToggleNightMode}
        onToggleFocusMode={handleToggleFocusMode}
        onToggleGloveMode={handleToggleGloveMode}
        onToggleDirectSun={handleToggleDirectSun}
        onToggleSolarAware={handleToggleSolarAware}
        onToggleCrisisMode={() => setIsCrisisMode(!isCrisisMode)}
        user={user}
        peers={peers}
        resources={resources}
        transactions={transactions}
        messages={messages}
        wishlist={wishlist}
        daoProposals={daoProposals}
        calendarEvents={calendarEvents}
        skills={skills}
        endorsements={endorsements}
        cryptoIdentity={cryptoIdentity}
        batteryStatus={batteryStatus}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeWishlistMatchesCount={activeWishlistMatchesCount}
        isQuickAddOpen={isQuickAddOpen}
        setIsQuickAddOpen={setIsQuickAddOpen}
        isWishlistOpen={isWishlistOpen}
        setIsWishlistOpen={setIsWishlistOpen}
        isDaoModalOpen={isDaoModalOpen}
        setIsDaoModalOpen={setIsDaoModalOpen}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        isSkillsOpen={isSkillsOpen}
        setIsSkillsOpen={setIsSkillsOpen}
        isToolsModalOpen={isToolsModalOpen}
        setIsToolsModalOpen={setIsToolsModalOpen}
        isTrustOpen={isTrustOpen}
        setIsTrustOpen={setIsTrustOpen}
        isManualOpen={isManualOpen}
        setIsManualOpen={setIsManualOpen}
        isBackupPromptOpen={isBackupPromptOpen}
        setIsBackupPromptOpen={setIsBackupPromptOpen}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        isSecurityKeysOpen={isSecurityKeysOpen}
        setIsSecurityKeysOpen={setIsSecurityKeysOpen}
        isDiagnosticsOpen={isDiagnosticsOpen}
        setIsDiagnosticsOpen={setIsDiagnosticsOpen}
        isOnboardingOpen={isOnboardingOpen}
        isCommandPaletteOpen={isCommandPaletteOpen}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        isShortcutsOpen={isShortcutsOpen}
        setIsShortcutsOpen={setIsShortcutsOpen}
        setIsLandingPageView={setIsLandingPageView}
        selectedPeerForReputation={selectedPeerForReputation}
        setSelectedPeerForReputation={setSelectedPeerForReputation}
        selectedPeerForDetail={selectedPeerForDetail}
        setSelectedPeerForDetail={setSelectedPeerForDetail}
        selectedResourceForDetail={selectedResourceForDetail}
        setSelectedResourceForDetail={setSelectedResourceForDetail}
        activeResourceTransaction={activeResourceTransaction}
        activeResourcePeer={activeResourcePeer}
        reflectionResource={reflectionResource}
        setReflectionResource={setReflectionResource}
        chatActivePeer={chatActivePeer}
        activeAchievementCelebration={activeAchievementCelebration}
        setActiveAchievementCelebration={setActiveAchievementCelebration}
        handleQuickAddResource={handleQuickAddResource}
        handleAddWishlistItem={handleAddWishlistItem}
        handleRemoveWishlistItem={handleRemoveWishlistItem}
        handleVoteProposal={handleVoteProposal}
        handleCreateProposal={handleCreateProposal}
        handleAddCalendarEvent={handleAddCalendarEvent}
        handleToggleRsvp={handleToggleRsvp}
        handleAddSkill={handleAddSkill}
        handleRequestSkillSession={handleRequestSkillSession}
        handleEndorseSkillTrade={handleEndorseSkillTrade}
        handleEndorseTransaction={handleEndorseTransaction}
        handleExportLocalDataJSON={handleExportLocalDataJSON}
        handleOpenChatWithPeer={handleOpenChatWithPeer}
        handleRequestExchange={handleRequestExchange}
        handleOpenReflection={handleOpenReflectionForResource}
        handleSaveReflection={(reflectionText, sentiment) => {
          if (reflectionResource) {
            handleSaveReflection(reflectionResource, reflectionText, sentiment);
            setReflectionResource(null);
          }
        }}
        handleSendMessage={handleSendMessage}
        handleRetryMessage={handleRetryMessage}
        handleImportIdentity={handleImportIdentity}
        handleCloseOnboarding={handleCloseOnboarding}
        handleCompleteOnboarding={handleCompleteOnboarding}
        handleDiscoverNewPeer={handleDiscoverNewPeer}
        handleTriggerSos={handleTriggerSos}
        toasts={toasts}
        handleDismissToast={dismissToast}
      />
    </div>
  );
}

export function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

export default App;
