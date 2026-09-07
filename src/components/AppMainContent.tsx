import React from 'react';
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
  DaoProposal,
  TrustEndorsement,
  CrisisAlert,
  NavTab,
} from '../types';
import { QuickTip } from './QuickTip';
import { QuickStartGuide } from './QuickStartGuide';
import { CrisisModeBar } from './CrisisModeBar';
import { MeshTab } from './MeshTab';
import { MapViewTab } from './MapViewTab';
import { PathfinderTab } from './PathfinderTab';
import { ExchangeTab } from './ExchangeTab';
import { JournalTab } from './JournalTab';
import { ProfileTab } from './ProfileTab';

export interface AppMainContentProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: UserProfile;
  peers: MeshNode[];
  resources: ResourceItem[];
  transactions: Transaction[];
  journal: JournalEntry[];
  messages: MeshMessage[];
  daoProposals: DaoProposal[];
  endorsements: TrustEndorsement[];
  crisisAlerts: CrisisAlert[];
  batteryStatus: BatteryManagerStatus;
  isNightMode: boolean;
  isFocusMode: boolean;
  isGloveMode: boolean;
  isHighContrast: boolean;
  isDirectSun: boolean;
  isCrisisMode: boolean;
  isScanning: boolean;
  filterOnlyNewMap: boolean;
  setFilterOnlyNewMap: (filter: boolean) => void;

  // Handlers
  onToggleNightMode: () => void;
  onToggleGloveMode: () => void;
  onToggleHighContrast: () => void;
  onToggleDirectSun: () => void;
  onToggleSolarAware: () => void;
  onToggleCrisisMode: () => void;
  onBroadcastAlert: (alert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => void;
  onResolveAlert: (id: string) => void;
  onSelectPeerForDetail: (peer: MeshNode) => void;
  onSelectPeerForReputation: (peer: MeshNode) => void;
  onSelectResourceForDetail: (resource: ResourceItem) => void;
  onOpenChatWithPeer: (peer: MeshNode | null) => void;
  onRefreshScan: () => void;
  onDiscoverPeer: () => void;
  onOpenDiagnostics: () => void;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onResetDemoData: () => void;
  onOpenQuickAdd: () => void;
  onOpenWishlist: () => void;
  onOpenDaoModal: () => void;
  onOpenToolsModal: () => void;
  onOpenManual: () => void;
  onOpenBackupSetup: () => void;
  onOpenLandingPage: () => void;
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
}

export const AppMainContent: React.FC<AppMainContentProps> = ({
  activeTab,
  setActiveTab,
  user,
  peers,
  resources,
  transactions,
  journal,
  messages,
  daoProposals,
  endorsements,
  crisisAlerts,
  batteryStatus,
  isNightMode,
  isFocusMode,
  isGloveMode,
  isHighContrast,
  isDirectSun,
  isCrisisMode,
  isScanning,
  filterOnlyNewMap,
  setFilterOnlyNewMap,

  onToggleNightMode,
  onToggleGloveMode,
  onToggleHighContrast,
  onToggleDirectSun,
  onToggleSolarAware,
  onToggleCrisisMode,
  onBroadcastAlert,
  onResolveAlert,
  onSelectPeerForDetail,
  onSelectPeerForReputation,
  onSelectResourceForDetail,
  onOpenChatWithPeer,
  onRefreshScan,
  onDiscoverPeer,
  onOpenDiagnostics,
  onUpdateUser,
  onUpdateProfile,
  onResetDemoData,
  onOpenQuickAdd,
  onOpenWishlist,
  onOpenDaoModal,
  onOpenToolsModal,
  onOpenManual,
  onOpenBackupSetup,
  onOpenLandingPage,
  addToast,
}) => {
  const completedExchangesCount = transactions.filter((t) => t.status === 'completed').length;

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-28 md:pb-24 space-y-4">
      {/* Solarpunk Quick Start Helper Guide (Dismissable) */}
      <QuickStartGuide
        onNavigateTab={setActiveTab}
        onOpenQuickAdd={onOpenQuickAdd}
        isNightMode={isNightMode}
        onOpenToolsModal={onOpenToolsModal}
        onOpenManual={onOpenManual}
      />

      {/* Crisis Mode Emergency Bar */}
      {(isCrisisMode || crisisAlerts.some((a) => !a.resolved)) && (
        <CrisisModeBar
          isCrisisMode={isCrisisMode}
          onToggleCrisisMode={onToggleCrisisMode}
          crisisAlerts={crisisAlerts}
          onBroadcastAlert={onBroadcastAlert}
          onResolveAlert={onResolveAlert}
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
            userCallsign={user.callsign}
            onToggleSolarAware={onToggleSolarAware}
            onSelectPeer={onSelectPeerForDetail}
            onOpenReputation={onSelectPeerForReputation}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onRefreshScan={onRefreshScan}
            onOpenDiagnostics={onOpenDiagnostics}
            onDiscoverPeer={onDiscoverPeer}
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
            onUpdateUser={onUpdateUser}
            onAddToast={addToast}
            isNightMode={isNightMode}
            filterOnlyNew={filterOnlyNewMap}
            onViewResourceDetails={onSelectResourceForDetail}
            onSelectPeer={onSelectPeerForDetail}
            onOpenChatWithPeer={onOpenChatWithPeer}
            onOpenReputation={onSelectPeerForReputation}
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
            onViewResourceDetails={onSelectResourceForDetail}
            onOpenCreateOffering={onOpenQuickAdd}
            onOpenWishlist={onOpenWishlist}
            onOpenDaoModal={onOpenDaoModal}
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
          onSelectPeer={onSelectPeerForDetail}
          onUpdateProfile={onUpdateProfile}
          onResetDemoData={onResetDemoData}
          isNightMode={isNightMode}
          onToggleNightMode={onToggleNightMode}
          isGloveMode={isGloveMode}
          onToggleGloveMode={onToggleGloveMode}
          isHighContrast={isHighContrast}
          onToggleHighContrast={onToggleHighContrast}
          isDirectSun={isDirectSun}
          onToggleDirectSun={onToggleDirectSun}
          onOpenBackupSetup={onOpenBackupSetup}
          onOpenWishlist={onOpenWishlist}
          onOpenDaoModal={onOpenDaoModal}
          onOpenLandingPage={onOpenLandingPage}
          onAddToast={addToast}
        />
      )}
    </main>
  );
};
