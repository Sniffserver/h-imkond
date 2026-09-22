import React, { Suspense, lazy } from 'react';
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
  DaoProposal,
  CryptoIdentity,
  SentimentType,
  NavTab,
} from '../types';
import { Achievement } from '../services/game/achievementService';

import { QuickAddResourceModal } from './QuickAddResourceModal';
import { WishlistAlertModal } from './WishlistAlertModal';
import { HoimuLandingPageModal } from './HoimuLandingPageModal';
import { LocalDataBackupPromptModal } from './LocalDataBackupPromptModal';
import { ReputationBreakdownDialog } from './ReputationBreakdownDialog';
import { PeerDetailBottomSheet } from './PeerDetailBottomSheet';
import { ResourceDetailModal } from './ResourceDetailModal';
import { ReflectionDialog } from './ReflectionDialog';
import { MeshChatDrawer } from './MeshChatDrawer';
import { AchievementCelebrationOverlay } from './AchievementCelebrationOverlay';
import { OnboardingModal } from './OnboardingModal';
import { QuickActionDial } from './QuickActionDial';
import { CommandPaletteModal } from './CommandPaletteModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ToastContainer } from './ToastContainer';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy-loaded Modal Heavyweights with resilient automatic retry
const BioregionalDaoModal = lazyWithRetry(() => import('./BioregionalDaoModal').then((m) => ({ default: m.BioregionalDaoModal })));
const CommunityCalendarModal = lazyWithRetry(() => import('./CommunityCalendarModal').then((m) => ({ default: m.CommunityCalendarModal })));
const SkillExchangeModal = lazyWithRetry(() => import('./SkillExchangeModal').then((m) => ({ default: m.SkillExchangeModal })));
const CommunityToolsModal = lazyWithRetry(() => import('./CommunityToolsModal').then((m) => ({ default: m.CommunityToolsModal })));
const ChainOfTrustModal = lazyWithRetry(() => import('./ChainOfTrustModal').then((m) => ({ default: m.ChainOfTrustModal })));
const SecurityKeyManagerModal = lazyWithRetry(() => import('./SecurityKeyManagerModal').then((m) => ({ default: m.SecurityKeyManagerModal })));
const NetworkDiagnosticsModal = lazyWithRetry(() => import('./NetworkDiagnosticsModal').then((m) => ({ default: m.NetworkDiagnosticsModal })));

export interface AppModalsContainerProps {
  // Theme & Mode states
  isNightMode: boolean;
  isFocusMode: boolean;
  isGloveMode: boolean;
  isDirectSun: boolean;
  isCrisisMode: boolean;
  onToggleNightMode: () => void;
  onToggleFocusMode: () => void;
  onToggleGloveMode: () => void;
  onToggleDirectSun: () => void;
  onToggleSolarAware: () => void;
  onToggleCrisisMode: () => void;

  // Domain state
  user: UserProfile;
  peers: MeshNode[];
  resources: ResourceItem[];
  transactions: Transaction[];
  messages: MeshMessage[];
  wishlist: WishlistItem[];
  daoProposals: DaoProposal[];
  calendarEvents: CalendarEvent[];
  skills: SkillExchangeItem[];
  endorsements: TrustEndorsement[];
  cryptoIdentity: CryptoIdentity;
  batteryStatus: BatteryManagerStatus;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeWishlistMatchesCount: number;

  // Modal visibility & selection states
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (open: boolean) => void;
  isWishlistOpen: boolean;
  setIsWishlistOpen: (open: boolean) => void;
  isDaoModalOpen: boolean;
  setIsDaoModalOpen: (open: boolean) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  isSkillsOpen: boolean;
  setIsSkillsOpen: (open: boolean) => void;
  isToolsModalOpen: boolean;
  setIsToolsModalOpen: (open: boolean) => void;
  isTrustOpen: boolean;
  setIsTrustOpen: (open: boolean) => void;
  isManualOpen: boolean;
  setIsManualOpen: (open: boolean) => void;
  isBackupPromptOpen: boolean;
  setIsBackupPromptOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isSecurityKeysOpen: boolean;
  setIsSecurityKeysOpen: (open: boolean) => void;
  isDiagnosticsOpen: boolean;
  setIsDiagnosticsOpen: (open: boolean) => void;
  isOnboardingOpen: boolean;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  setIsLandingPageView: (open: boolean) => void;

  selectedPeerForReputation: MeshNode | null;
  setSelectedPeerForReputation: (peer: MeshNode | null) => void;
  selectedPeerForDetail: MeshNode | null;
  setSelectedPeerForDetail: (peer: MeshNode | null) => void;
  selectedResourceForDetail: ResourceItem | null;
  setSelectedResourceForDetail: (resource: ResourceItem | null) => void;
  activeResourceTransaction?: Transaction;
  activeResourcePeer?: MeshNode;
  reflectionResource: ResourceItem | null;
  setReflectionResource: (resource: ResourceItem | null) => void;
  chatActivePeer: MeshNode | null;
  activeAchievementCelebration: Achievement | null;
  setActiveAchievementCelebration: (achievement: Achievement | null) => void;

  // Handlers
  handleQuickAddResource: (data: any) => void;
  handleAddWishlistItem: (keyword: string, category?: string) => void;
  handleRemoveWishlistItem: (id: string) => void;
  handleVoteProposal: (proposalId: string, vote: 'yes' | 'no' | 'abstain') => void;
  handleCreateProposal: (data: any) => void;
  handleAddCalendarEvent: (event: any) => void;
  handleToggleRsvp: (eventId: string) => void;
  handleAddSkill: (skill: any) => void;
  handleRequestSkillSession: (skill: any, details?: any) => void;
  handleEndorseSkillTrade?: (
    skillId: string,
    recipientCallsign: string,
    comment: string,
    rating?: number,
    transactionId?: string,
    tags?: string[]
  ) => void;
  handleEndorseTransaction: (transactionId: string, comment: string) => void;
  handleExportLocalDataJSON: () => void;
  handleOpenChatWithPeer: (peer: MeshNode) => void;
  handleRequestExchange: (resource: ResourceItem) => void;
  handleOpenReflection: (resource: ResourceItem) => void;
  handleSaveReflection: (reflectionText: string, sentiment: SentimentType) => void;
  handleSendMessage: (text: string, attachment?: any) => void;
  handleRetryMessage: (id: string) => void;
  handleImportIdentity: (imported: CryptoIdentity) => void;
  handleCloseOnboarding: () => void;
  handleCompleteOnboarding: (updatedProfile?: Partial<UserProfile>, visibilityPrefs?: any) => void;
  handleDiscoverNewPeer: () => void;
  handleTriggerSos: () => void;

  // Toasts
  toasts: ToastMessage[];
  handleDismissToast: (id: string) => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  isNightMode,
  isFocusMode,
  isGloveMode,
  isDirectSun,
  isCrisisMode,
  onToggleNightMode,
  onToggleFocusMode,
  onToggleGloveMode,
  onToggleDirectSun,
  onToggleSolarAware,
  onToggleCrisisMode,

  user,
  peers,
  resources,
  transactions,
  messages,
  wishlist,
  daoProposals,
  calendarEvents,
  skills,
  endorsements,
  cryptoIdentity,
  batteryStatus,
  activeTab,
  onSelectTab,
  activeWishlistMatchesCount,

  isQuickAddOpen,
  setIsQuickAddOpen,
  isWishlistOpen,
  setIsWishlistOpen,
  isDaoModalOpen,
  setIsDaoModalOpen,
  isCalendarOpen,
  setIsCalendarOpen,
  isSkillsOpen,
  setIsSkillsOpen,
  isToolsModalOpen,
  setIsToolsModalOpen,
  isTrustOpen,
  setIsTrustOpen,
  isManualOpen,
  setIsManualOpen,
  isBackupPromptOpen,
  setIsBackupPromptOpen,
  isChatOpen,
  setIsChatOpen,
  isSecurityKeysOpen,
  setIsSecurityKeysOpen,
  isDiagnosticsOpen,
  setIsDiagnosticsOpen,
  isOnboardingOpen,
  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  isShortcutsOpen,
  setIsShortcutsOpen,
  setIsLandingPageView,

  selectedPeerForReputation,
  setSelectedPeerForReputation,
  selectedPeerForDetail,
  setSelectedPeerForDetail,
  selectedResourceForDetail,
  setSelectedResourceForDetail,
  activeResourceTransaction,
  activeResourcePeer,
  reflectionResource,
  setReflectionResource,
  chatActivePeer,
  activeAchievementCelebration,
  setActiveAchievementCelebration,

  handleQuickAddResource,
  handleAddWishlistItem,
  handleRemoveWishlistItem,
  handleVoteProposal,
  handleCreateProposal,
  handleAddCalendarEvent,
  handleToggleRsvp,
  handleAddSkill,
  handleRequestSkillSession,
  handleEndorseSkillTrade,
  handleEndorseTransaction,
  handleExportLocalDataJSON,
  handleOpenChatWithPeer,
  handleRequestExchange,
  handleOpenReflection,
  handleSaveReflection,
  handleSendMessage,
  handleRetryMessage,
  handleImportIdentity,
  handleCloseOnboarding,
  handleCompleteOnboarding,
  handleDiscoverNewPeer,
  handleTriggerSos,

  toasts,
  handleDismissToast,
}) => {
  return (
    <Suspense fallback={null}>
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
      {isDaoModalOpen && (
        <BioregionalDaoModal
          isOpen={isDaoModalOpen}
          onClose={() => setIsDaoModalOpen(false)}
          user={user}
          proposals={daoProposals}
          onVoteProposal={handleVoteProposal}
          onCreateProposal={handleCreateProposal}
          isNightMode={isNightMode}
        />
      )}

      {/* 3. Community Calendar Modal */}
      {isCalendarOpen && (
        <CommunityCalendarModal
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          events={calendarEvents}
          onAddEvent={handleAddCalendarEvent}
          onToggleRsvp={handleToggleRsvp}
          isNightMode={isNightMode}
          userCallsign={user.callsign}
        />
      )}

      {/* 4. Skill Exchange Modal */}
      {isSkillsOpen && (
        <SkillExchangeModal
          isOpen={isSkillsOpen}
          onClose={() => setIsSkillsOpen(false)}
          skills={skills}
          endorsements={endorsements}
          transactions={transactions}
          onAddSkill={handleAddSkill}
          onRequestSkillSession={handleRequestSkillSession}
          onEndorseSkillTrade={handleEndorseSkillTrade}
          onOpenChatWithPeer={(callsign) => {
            const peer = peers.find((p) => p.callsign === callsign);
            if (peer) {
              handleOpenChatWithPeer(peer);
            }
          }}
          isNightMode={isNightMode}
          userCallsign={user.callsign}
        />
      )}

      {/* Unified Solarpunk Community Hub & Tools Directory */}
      {isToolsModalOpen && (
        <CommunityToolsModal
          isOpen={isToolsModalOpen}
          onClose={() => setIsToolsModalOpen(false)}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onOpenSkills={() => setIsSkillsOpen(true)}
          onOpenTrust={() => setIsTrustOpen(true)}
          onOpenManual={() => setIsManualOpen(true)}
          onOpenLandingPage={() => setIsLandingPageView(true)}
          onOpenSecurityKeys={() => setIsSecurityKeysOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          onOpenDaoModal={() => setIsDaoModalOpen(true)}
          onOpenPiBridge={() => {
            onSelectTab('profile');
            setTimeout(() => {
              document.getElementById('pi-bridge-panel')?.scrollIntoView({ behavior: 'smooth' });
            }, 150);
          }}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenQuickGuide={() => {
            setIsToolsModalOpen(false);
            document.getElementById('solarpunk-quick-start-guide')?.scrollIntoView({ behavior: 'smooth' });
          }}
          onToggleCrisisMode={onToggleCrisisMode}
          isNightMode={isNightMode}
          isCrisisMode={isCrisisMode}
          peers={peers}
          batteryStatus={batteryStatus}
          onToggleSolarAware={onToggleSolarAware}
        />
      )}

      {/* 5. Chain of Trust Endorsement Modal */}
      {isTrustOpen && (
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
      )}

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
        isNightMode={isNightMode}
      />

      {/* 2. Peer Detail Bottom Sheet */}
      <PeerDetailBottomSheet
        peer={selectedPeerForDetail}
        onClose={() => setSelectedPeerForDetail(null)}
        isNightMode={isNightMode}
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
      {isSecurityKeysOpen && (
        <SecurityKeyManagerModal
          isOpen={isSecurityKeysOpen}
          onClose={() => setIsSecurityKeysOpen(false)}
          cryptoIdentity={cryptoIdentity}
          onImportIdentity={handleImportIdentity}
          isNightMode={isNightMode}
        />
      )}

      {/* 7. Detailed Network Diagnostics & RF Telemetry Modal */}
      {isDiagnosticsOpen && (
        <NetworkDiagnosticsModal
          isOpen={isDiagnosticsOpen}
          onClose={() => setIsDiagnosticsOpen(false)}
          peers={peers}
          batteryStatus={batteryStatus}
          userCallsign={user.callsign}
          isNightMode={isNightMode}
        />
      )}

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
        onOpenJournal={() => onSelectTab('journal')}
        onOpenMap={() => onSelectTab('map')}
        onRefreshScan={handleDiscoverNewPeer}
        onTriggerSos={handleTriggerSos}
        activeWishlistMatchesCount={activeWishlistMatchesCount}
        isNightMode={isNightMode}
      />

      {/* 2026 UX: Global Command Palette & Solarpunk Search */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        peers={peers}
        resources={resources}
        onSelectPeer={(peer) => setSelectedPeerForDetail(peer)}
        onSelectResource={(res) => setSelectedResourceForDetail(res)}
        isNightMode={isNightMode}
        onToggleNightMode={onToggleNightMode}
        isFocusMode={isFocusMode}
        onToggleFocusMode={onToggleFocusMode}
        isGloveMode={isGloveMode}
        onToggleGloveMode={onToggleGloveMode}
        isDirectSun={isDirectSun}
        onToggleDirectSun={onToggleDirectSun}
        isSolarAware={batteryStatus.isSolarAwareActive}
        onToggleSolarAware={onToggleSolarAware}
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
        onTriggerSos={handleTriggerSos}
      />

      {/* 2026 UX: Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        isNightMode={isNightMode}
      />

      {/* 10. Non-intrusive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </Suspense>
  );
};
