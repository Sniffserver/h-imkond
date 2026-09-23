import React from 'react';
import { NavTab } from '../types';
import { MeshScreen } from '../features/mesh/MeshScreen';
import { QuickStartGuide } from '../components/QuickStartGuide';
import { CrisisModeBar } from '../components/CrisisModeBar';
import { AppMainContentProps } from '../components/AppMainContent';
import { SafetyView } from '../components/SafetyView';
import { TodayDashboard } from '../features/today/TodayDashboard';
import { MoreScreen } from '../features/more/MoreScreen';
import { MapScreen } from '../features/map/MapScreen';
import { ScannerScreen } from '../features/scanner/ScannerScreen';
import { ExchangeScreen } from '../features/exchange/ExchangeScreen';
import { JournalScreen } from '../features/journal/JournalScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';

export interface AppRoutesProps extends AppMainContentProps {
  onOpenTrustModal: () => void;
  onOpenSkillsModal: () => void;
  onOpenSecurityKeys: () => void;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
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
  themeMode,
  fieldDisplayMode,
  onSetThemeMode,
  onSetFieldDisplayMode,
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
  onOpenTrustModal,
  onOpenSkillsModal,
  onOpenSecurityKeys,
  addToast,
}) => {
  const completedExchangesCount = transactions.filter((t) => t.status === 'completed').length;

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-28 md:pb-24 space-y-4">
      {/* Solarpunk Quick Start Helper Guide */}
      <QuickStartGuide
        onNavigateTab={setActiveTab}
        onOpenQuickAdd={onOpenQuickAdd}
        isNightMode={isNightMode}
        onOpenToolsModal={onOpenToolsModal}
        onOpenManual={onOpenManual}
      />

      {/* Emergency Distress Bar */}
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

      {/* Active Tab Screen Routing */}
      {activeTab === 'today' && (
        <TodayDashboard
          user={user}
          peers={peers}
          resources={resources}
          daoProposals={daoProposals}
          batteryStatus={batteryStatus}
          isNightMode={isNightMode}
          onNavigateTab={setActiveTab}
          onOpenQuickAdd={onOpenQuickAdd}
          onOpenChatWithPeer={onOpenChatWithPeer}
          onOpenDaoModal={onOpenDaoModal}
          onOpenManual={onOpenManual}
        />
      )}

      {activeTab === 'more' && (
        <MoreScreen
          user={user}
          resources={resources}
          transactions={transactions}
          journal={journal}
          daoProposals={daoProposals}
          isNightMode={isNightMode}
          onNavigateTab={setActiveTab}
          onOpenDaoModal={onOpenDaoModal}
          onOpenTrustModal={onOpenTrustModal}
          onOpenSkillsModal={onOpenSkillsModal}
          onOpenToolsModal={onOpenToolsModal}
          onOpenDiagnostics={onOpenDiagnostics}
          onOpenSecurityKeys={onOpenSecurityKeys}
          onOpenBackupSetup={onOpenBackupSetup}
          onOpenManual={onOpenManual}
        />
      )}

      {activeTab === 'messages' && (
        <MeshScreen
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
      )}

      {activeTab === 'sos' && (
        <SafetyView
          isCrisisMode={isCrisisMode}
          onToggleCrisisMode={onToggleCrisisMode}
          crisisAlerts={crisisAlerts}
          onBroadcastAlert={onBroadcastAlert}
          onResolveAlert={onResolveAlert}
          onOpenDiagnostics={onOpenDiagnostics}
          onOpenManual={onOpenManual}
          isNightMode={isNightMode}
        />
      )}

      {activeTab === 'map' && (
        <MapScreen
          peers={peers}
          resources={resources}
          user={user}
          onUpdateUser={onUpdateUser}
          onAddToast={addToast}
          isNightMode={isNightMode}
          themeMode={themeMode}
          fieldDisplayMode={fieldDisplayMode}
          onSetThemeMode={onSetThemeMode}
          onSetFieldDisplayMode={onSetFieldDisplayMode}
          filterOnlyNew={filterOnlyNewMap}
          onViewResourceDetails={onSelectResourceForDetail}
          onSelectPeer={onSelectPeerForDetail}
          onOpenChatWithPeer={onOpenChatWithPeer}
          onOpenReputation={onSelectPeerForReputation}
          batteryStatus={batteryStatus}
        />
      )}

      {activeTab === 'pathfinder' && (
        <ScannerScreen
          isNightMode={isNightMode}
          onNavigateToMapWithFilter={(filterNew) => {
            setFilterOnlyNewMap(filterNew);
            setActiveTab('map');
          }}
        />
      )}

      {activeTab === 'exchange' && (
        <ExchangeScreen
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
      )}

      {activeTab === 'journal' && (
        <JournalScreen
          journal={journal}
          peers={peers}
          userSymbiosisScore={user.symbiosisScore}
          completedExchangesCount={completedExchangesCount}
          isNightMode={isNightMode}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileScreen
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
