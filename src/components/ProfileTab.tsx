import React, { useState, useRef } from 'react';
import {
  UserProfile,
  JournalEntry,
  Transaction,
  DaoProposal,
  MeshNode,
  TrustEndorsement,
  ResourceItem,
  MeshMessage,
} from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { SymbiosisScoreBadge } from './SymbiosisScoreBadge';
import { mapRevealService } from '../services/map/mapRevealService';
import { AchievementsPanel } from './AchievementsPanel';
import { SeasonalChallengesPanel } from './SeasonalChallengesPanel';
import { SeasonalProgressDisplay } from './SeasonalProgressDisplay';
import { PersonalRecordsStats } from './PersonalRecordsStats';
import { MeshContributionLeaderboard } from './MeshContributionLeaderboard';
import { TrustNetworkGraph } from './TrustNetworkGraph';
import { PiHardwareBridgeCard } from './PiHardwareBridgeCard';
import {
  exportMeshData,
  exportMessageArchive,
  exportIdentity,
  importIdentity,
  exportCSVData,
  exportEncryptedArchive,
  downloadFile,
} from '../services/utils/exportService';
import {
  User,
  Edit3,
  Save,
  X,
  Plus,
  Radio,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Sprout,
  Tag,
  Package,
  Download,
  Copy,
  FileText,
  Check,
  Moon,
  Sun,
  HardDrive,
  FileCode,
  Layers,
  Landmark,
  BellRing,
  Map as MapIcon,
  Footprints,
  Award,
  Lock,
  Globe,
  ExternalLink,
  Compass,
  Maximize2,
  Smartphone,
  Hand,
  Contrast,
  SunDim,
  Volume2,
  Key,
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  FolderArchive,
} from 'lucide-react';

interface ProfileTabProps {
  user: UserProfile;
  journal: JournalEntry[];
  transactions?: Transaction[];
  proposals?: DaoProposal[];
  peers?: MeshNode[];
  endorsements?: TrustEndorsement[];
  resources?: ResourceItem[];
  messages?: MeshMessage[];
  onSelectPeer?: (peer: MeshNode) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onResetDemoData: () => void;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  isGloveMode?: boolean;
  onToggleGloveMode?: () => void;
  isHighContrast?: boolean;
  onToggleHighContrast?: () => void;
  isDirectSun?: boolean;
  onToggleDirectSun?: () => void;
  onOpenBackupSetup?: () => void;
  onOpenDaoModal?: () => void;
  onOpenWishlist?: () => void;
  onOpenLandingPage?: () => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  journal,
  transactions = [],
  proposals = [],
  peers = [],
  endorsements = [],
  resources = [],
  messages = [],
  onSelectPeer,
  onUpdateProfile,
  onResetDemoData,
  isNightMode = false,
  onToggleNightMode,
  isGloveMode = false,
  onToggleGloveMode,
  isHighContrast = false,
  onToggleHighContrast,
  isDirectSun = false,
  onToggleDirectSun,
  onOpenBackupSetup,
  onOpenDaoModal,
  onOpenWishlist,
  onOpenLandingPage,
  onAddToast,
}) => {
  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editCallsign, setEditCallsign] = useState(user.callsign);
  const [editBio, setEditBio] = useState(user.bio);
  const [newSkill, setNewSkill] = useState('');
  const [newResource, setNewResource] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // File Input Ref for Identity Key Restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export State & Format Selector
  const [copiedState, setCopiedState] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'geojson' | 'csv' | 'archive' | 'json' | 'messages'>('geojson');

  // Identity Backup & Restore Modal States
  const [isBackupIdentityModalOpen, setIsBackupIdentityModalOpen] = useState(false);
  const [isRestoreIdentityModalOpen, setIsRestoreIdentityModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [archivePassword, setArchivePassword] = useState('');

  const [selectedKeyFileContent, setSelectedKeyFileContent] = useState<string | null>(null);
  const [selectedKeyFileName, setSelectedKeyFileName] = useState<string | null>(null);

  const [lastIdentityBackupTime, setLastIdentityBackupTime] = useState<number>(() => {
    return Number(localStorage.getItem('hoimu_last_identity_backup_time') || 0);
  });

  const daysSinceIdentityBackup = lastIdentityBackupTime === 0
    ? 999
    : Math.floor((Date.now() - lastIdentityBackupTime) / (1000 * 60 * 60 * 24));

  const handleSaveBio = () => {
    if (!editCallsign.trim()) return;
    onUpdateProfile({
      callsign: editCallsign.trim(),
      bio: editBio.trim(),
    });
    setIsEditing(false);
  };

  const handleCancelBio = () => {
    setEditCallsign(user.callsign);
    setEditBio(user.bio);
    setIsEditing(false);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    const current = user.skills || [];
    if (!current.includes(newSkill.trim())) {
      onUpdateProfile({ skills: [...current, newSkill.trim()] });
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = (user.skills || []).filter((s) => s !== skillToRemove);
    onUpdateProfile({ skills: updated });
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.trim()) return;
    const current = user.offeredResources || [];
    if (!current.includes(newResource.trim())) {
      onUpdateProfile({ offeredResources: [...current, newResource.trim()] });
    }
    setNewResource('');
  };

  const handleRemoveResource = (resourceToRemove: string) => {
    const updated = (user.offeredResources || []).filter((r) => r !== resourceToRemove);
    onUpdateProfile({ offeredResources: updated });
  };

  const handleToggleMeshVisibility = () => {
    onUpdateProfile({ isMeshVisible: !user.isMeshVisible });
  };

  const handleToggleLandscapeMode = () => {
    const nextState = !user.forceLandscapeMap;
    onUpdateProfile({ forceLandscapeMap: nextState });
    try {
      if (nextState && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore if screen orientation lock is not supported or permitted
    }
  };

  // Trajectory historical calculations
  const trajectoryPoints = [
    { label: 'Genesis', score: 30 },
    { label: 'Epoch 1', score: 45 },
    { label: 'Epoch 2', score: 65 },
    { label: 'Current', score: user.symbiosisScore },
  ];

  // Prepare Export Payload
  const getExportData = () => {
    return {
      metadata: {
        application: 'HÕIMU Mutual Aid Mesh Terminal',
        version: '1.0-solarpunk',
        schemaVersion: '2026.1',
        exportedAt: new Date().toISOString(),
        nodeId: user.deviceNodeId || 'NODE-ESP32-9F42',
        bioregion: user.bioregion || 'Cascadia-44N',
      },
      userProfile: {
        id: user.id,
        callsign: user.callsign,
        bio: user.bio,
        skills: user.skills,
        offeredResources: user.offeredResources,
        symbiosisScore: user.symbiosisScore,
        completedExchanges: user.completedExchanges,
        meshVisible: user.isMeshVisible,
        avatarSeed: user.avatarSeed,
      },
      journalEntries: journal.map((entry) => ({
        id: entry.id,
        date: new Date(entry.timestamp).toISOString(),
        partnerCallsign: entry.partnerCallsign,
        resourceTitle: entry.resourceTitle || 'General Mutual Aid',
        sentiment: entry.sentiment,
        scoreDelta: entry.scoreDelta,
        reflection: entry.reflection,
      })),
      transactionHistory: transactions.map((tx) => ({
        id: tx.id,
        resourceId: tx.resourceId,
        resourceTitle: tx.resourceTitle,
        provider: tx.providerCallsign,
        requester: tx.requesterCallsign,
        status: tx.status,
        createdAt: new Date(tx.createdAt).toISOString(),
        updatedAt: tx.updatedAt ? new Date(tx.updatedAt).toISOString() : undefined,
        reflection: tx.reflection,
      })),
    };
  };

  // Generate Plain Text / Markdown Field Ledger
  const generateTextLedger = (): string => {
    const data = getExportData();
    let text = `# HÕIMU BIOREGIONAL MUTUAL AID LEDGER (OFFLINE BACKUP)\n`;
    text += `Generated: ${data.metadata.exportedAt}\n`;
    text += `Node ID: ${data.metadata.nodeId} | Bioregion: ${data.metadata.bioregion}\n`;
    text += `Operator Callsign: ${data.userProfile.callsign}\n`;
    text += `Symbiosis Score: ${data.userProfile.symbiosisScore} Pts | Completed Exchanges: ${data.userProfile.completedExchanges}\n`;
    text += `Skills: ${data.userProfile.skills.join(', ')}\n`;
    text += `Offered Resources: ${data.userProfile.offeredResources.join(', ')}\n\n`;

    text += `=================================================================\n`;
    text += `JOURNAL & CO-EVOLUTION REFLECTION ENTRIES (${data.journalEntries.length})\n`;
    text += `=================================================================\n\n`;

    data.journalEntries.forEach((entry, idx) => {
      text += `[#${idx + 1}] Date: ${entry.date}\n`;
      text += `Partner: ${entry.partnerCallsign} | Resource: ${entry.resourceTitle}\n`;
      text += `Sentiment: ${entry.sentiment.toUpperCase()} (+${entry.scoreDelta} Pts)\n`;
      text += `Reflection: "${entry.reflection}"\n`;
      text += `-----------------------------------------------------------------\n`;
    });

    text += `\n=================================================================\n`;
    text += `TRANSACTION HISTORY RECORD (${data.transactionHistory.length})\n`;
    text += `=================================================================\n\n`;

    data.transactionHistory.forEach((tx, idx) => {
      text += `[#${idx + 1}] TxID: ${tx.id} | Status: ${tx.status.toUpperCase()}\n`;
      text += `Resource: ${tx.resourceTitle}\n`;
      text += `Provider: ${tx.provider} -> Requester: ${tx.requester}\n`;
      text += `Created: ${tx.createdAt}\n`;
      if (tx.reflection) text += `Reflection Note: ${tx.reflection}\n`;
      text += `-----------------------------------------------------------------\n`;
    });

    text += `\n* End of local-first self-sovereign cryptographic export *\n`;
    return text;
  };

  // Download JSON Backup File
  const handleDownloadJson = () => {
    const data = getExportData();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const filename = `hoimu-backup-${user.callsign.toLowerCase()}-${Date.now()}.json`;
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download Text Ledger Backup File
  const handleDownloadText = () => {
    const textData = generateTextLedger();
    const textString = `data:text/plain;charset=utf-8,${encodeURIComponent(textData)}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', textString);
    const filename = `hoimu-ledger-${user.callsign.toLowerCase()}-${Date.now()}.txt`;
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 1) Execute Identity Backup (Password Protected .hoimu-key)
  const handleExecuteBackupIdentity = async () => {
    if (!backupPassword || backupPassword.length < 4) {
      onAddToast?.('Password Too Short', 'Identity encryption password must be at least 4 characters.', 'warning');
      return;
    }
    if (backupPassword !== confirmBackupPassword) {
      onAddToast?.('Password Mismatch', 'Backup password and confirmation do not match.', 'warning');
      return;
    }

    try {
      const encryptedKeyContent = await exportIdentity(user, backupPassword);
      const filename = `${user.callsign.toLowerCase().replace(/[^a-z0-9]/g, '_')}_identity.hoimu-key`;
      downloadFile(encryptedKeyContent, filename, 'application/json');

      const now = Date.now();
      localStorage.setItem('hoimu_last_identity_backup_time', String(now));
      setLastIdentityBackupTime(now);

      setIsBackupIdentityModalOpen(false);
      setBackupPassword('');
      setConfirmBackupPassword('');

      onAddToast?.(
        '🔑 Identity Key Backed Up',
        `Ed25519 cryptographic key encrypted with PBKDF2 + AES-GCM and saved as ${filename}.`,
        'success'
      );
    } catch (err: any) {
      onAddToast?.('Backup Failed', err.message || 'Could not export identity key.', 'warning');
    }
  };

  // 2) Select .hoimu-key file for restore
  const handleFileSelectedForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSelectedKeyFileContent(content);
        setSelectedKeyFileName(file.name);
        setIsRestoreIdentityModalOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3) Execute Identity Restore (Decrypts .hoimu-key)
  const handleExecuteRestoreIdentity = async () => {
    if (!selectedKeyFileContent) return;
    if (!restorePassword) {
      onAddToast?.('Password Required', 'Please enter password to decrypt identity backup.', 'warning');
      return;
    }

    try {
      const restoredUser = await importIdentity(selectedKeyFileContent, restorePassword);
      onUpdateProfile(restoredUser);

      const now = Date.now();
      setLastIdentityBackupTime(now);

      setIsRestoreIdentityModalOpen(false);
      setRestorePassword('');
      setSelectedKeyFileContent(null);
      setSelectedKeyFileName(null);

      onAddToast?.(
        '🎉 Identity Restored!',
        `Successfully decrypted and restored Ed25519 identity for @${restoredUser.callsign}.`,
        'success'
      );
    } catch (err: any) {
      onAddToast?.('Restore Failed', err.message || 'Invalid password or corrupted backup file.', 'warning');
    }
  };

  // 4) Execute Selected Export Format (GeoJSON, CSV, Encrypted Archive, JSON, Messages)
  const handleExportSelectedFormat = async () => {
    if (exportFormat === 'geojson') {
      const geojsonStr = exportMeshData(peers, resources, []);
      downloadFile(geojsonStr, `hoimu_mesh_${user.callsign.toLowerCase()}.geojson`, 'application/geo+json');
      onAddToast?.(
        '🗺️ GeoJSON Exported',
        'Valid GeoJSON FeatureCollection generated. Ready to open in QGIS / GIS software.',
        'success'
      );
    } else if (exportFormat === 'csv') {
      const { combinedCsv } = exportCSVData();
      downloadFile(combinedCsv, `hoimu_telemetry_sync_${user.callsign.toLowerCase()}.csv`, 'text/csv');
      onAddToast?.(
        '📊 CSV Exported',
        'Sync history, battery telemetry, and mesh contributions saved as CSV.',
        'success'
      );
    } else if (exportFormat === 'archive') {
      setIsArchiveModalOpen(true);
    } else if (exportFormat === 'json') {
      handleDownloadJson();
    } else if (exportFormat === 'messages') {
      const archive = await exportMessageArchive(messages, '');
      downloadFile(archive, `hoimu_messages_${user.callsign.toLowerCase()}.json`, 'application/json');
      onAddToast?.('💬 Messages Exported', 'Message history archive exported.', 'success');
    }
  };

  // 5) Execute Encrypted Full Archive
  const handleExecuteArchiveExport = async () => {
    if (!archivePassword || archivePassword.length < 4) {
      onAddToast?.('Password Too Short', 'Archive password must be at least 4 characters long.', 'warning');
      return;
    }

    try {
      const archiveStr = await exportEncryptedArchive(archivePassword);
      downloadFile(archiveStr, `hoimu_full_archive_${user.callsign.toLowerCase()}.hoimu-archive`, 'application/json');
      setIsArchiveModalOpen(false);
      setArchivePassword('');
      onAddToast?.(
        '🔒 Encrypted Archive Saved',
        'Complete localStorage & state backup encrypted with AES-256-GCM downloaded.',
        'success'
      );
    } catch (err: any) {
      onAddToast?.('Archive Failed', err.message || 'Could not export encrypted archive.', 'warning');
    }
  };

  // Copy JSON to Clipboard
  const handleCopyJson = () => {
    const data = getExportData();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Profile Header Card */}
      <div
        className={`rounded-3xl border p-6 shadow-xs relative space-y-5 transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Large Solarpunk Avatar */}
          <div className="relative shrink-0">
            <div className="p-1 rounded-full bg-gradient-to-tr from-[#588157] via-[#87A878] to-[#E9C46A] shadow-md">
              <div className={isNightMode ? 'bg-[#182315] rounded-full p-0.5' : 'bg-white rounded-full p-0.5'}>
                <SolarpunkAvatarCanvas seed={user.avatarSeed} size={84} />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#2A9D8F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-xs">
              Local ID
            </div>
          </div>

          {/* Bio & Identity Details */}
          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#637062] mb-1">
                    Mesh Callsign
                  </label>
                  <input
                    type="text"
                    value={editCallsign}
                    onChange={(e) => setEditCallsign(e.target.value)}
                    required
                    className={`w-full sm:w-64 px-3 py-1.5 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#87A878] ${
                      isNightMode
                        ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                        : 'bg-white text-[#203A2A] border-[#87A878]/40'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#637062] mb-1">
                    Bioregional Bio & Focus
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={2}
                    className={`w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#87A878] resize-none ${
                      isNightMode
                        ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30]'
                        : 'bg-white text-[#203A2A] border-[#87A878]/40'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveBio}
                    disabled={!editCallsign.trim()}
                    className="px-3.5 py-1.5 bg-[#203A2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs hover:bg-[#16271c] disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#E9C46A]" />
                    Save Identity
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelBio}
                    className={`px-3 py-1.5 border text-xs font-semibold rounded-xl cursor-pointer ${
                      isNightMode
                        ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5]'
                        : 'bg-white border-[#87A878]/30 text-[#637062] hover:bg-[#FAF6EE]'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="font-display font-black text-2xl">
                    {user.callsign}
                  </h2>
                  <span className="text-[10px] font-mono text-[#588157] font-bold px-2.5 py-0.5 bg-[#87A878]/20 rounded-full border border-[#87A878]/30">
                    Self-Sovereign Node
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg text-[#637062] hover:text-[#203A2A] hover:bg-white/80 transition-colors cursor-pointer"
                    title="Edit profile callsign and bio"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[#588157] font-mono mt-0.5">
                  Bioregion: {user.bioregion || 'Cascadia-44N'} • Mesh Device: {user.deviceNodeId || 'NODE-ESP32-9F42'}
                </p>

                <p
                  className={`text-xs mt-2 leading-relaxed p-3 rounded-2xl border ${
                    isNightMode
                      ? 'bg-[#182315]/80 text-[#D3E2D0] border-[#2A3B26]'
                      : 'bg-white/70 text-[#203A2A] border-[#87A878]/20'
                  }`}
                >
                  {user.bio}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Controls Grid: Mesh Visibility, Field Night Mode & Landscape Navigation Mode */}
        <div className="pt-3 border-t border-current/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Mesh Beacon Visibility */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/70 border-[#87A878]/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {user.isMeshVisible ? (
                <Eye className="w-4 h-4 text-[#588157] shrink-0" />
              ) : (
                <EyeOff className="w-4 h-4 text-[#E76F51] shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold block">
                  {user.isMeshVisible ? 'Mesh Beacon: Visible' : 'Dark Mode (Hidden)'}
                </span>
                <span className="text-[10px] text-[#637062] block">
                  {user.isMeshVisible ? 'Broadcasting on BLE 2.4GHz' : 'Scanning only'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMeshVisibility}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 ${
                user.isMeshVisible
                  ? 'bg-[#87A878]/20 text-[#344E2C] border border-[#87A878]/40'
                  : 'bg-[#E76F51]/20 text-[#9A3822] border border-[#E76F51]/40'
              }`}
            >
              {user.isMeshVisible ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* 2. Night Mode Field Display Toggle */}
          {onToggleNightMode && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/70 border-[#87A878]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {isNightMode ? (
                  <Moon className="w-4 h-4 text-[#E9C46A] shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-[#F4A261] shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold block">
                    Field Theme: {isNightMode ? 'Night Forest' : 'Day Solarpunk'}
                  </span>
                  <span className="text-[10px] text-[#637062] block">
                    {isNightMode ? 'Deep #1A2617 eye-safe tones' : 'Light Earth canvas'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleNightMode}
                className={`px-3 py-1 text-xs font-bold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isNightMode
                    ? 'bg-[#E9C46A]/20 text-[#E9C46A] border-[#E9C46A]/40 hover:bg-[#E9C46A]/30'
                    : 'bg-[#87A878]/20 text-[#203A2A] border-[#87A878]/40 hover:bg-[#87A878]/30'
                }`}
              >
                {isNightMode ? 'Day Mode' : 'Night Mode'}
              </button>
            </div>
          )}

          {/* 3. Landscape Mode for Field Navigation */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/70 border-[#87A878]/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Compass className={`w-4 h-4 shrink-0 ${user.forceLandscapeMap ? 'text-[#2A9D8F]' : 'text-[#637062]'}`} />
              <div>
                <span className="text-xs font-bold block">
                  Field Landscape View
                </span>
                <span className="text-[10px] text-[#637062] block">
                  {user.forceLandscapeMap ? 'Max horizontal coverage' : 'Standard portrait layout'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleLandscapeMode}
              className={`px-3 py-1 text-xs font-bold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                user.forceLandscapeMap
                  ? 'bg-[#2A9D8F]/20 text-[#2A9D8F] border-[#2A9D8F]/40 hover:bg-[#2A9D8F]/30'
                  : isNightMode
                  ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#223120]'
                  : 'bg-black/5 border-black/10 text-[#637062] hover:bg-black/10'
              }`}
              title="Sunni kaardivaade rõhtpaigutusse maastikunavigatsiooniks ja laiaulatusliku mesh-võrgu vaatluseks"
            >
              {user.forceLandscapeMap ? 'Landscape ON' : 'Standard'}
            </button>
          </div>
        </div>
      </div>

      {/* Field Hardening & Accessibility Card */}
      <div
        id="field-accessibility-card"
        className={`rounded-3xl border p-5 sm:p-6 shadow-xs space-y-4 transition-colors ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Hand className="w-5 h-5 text-[#E9C46A]" />
              <h3 className="font-display font-bold text-base sm:text-lg">
                Field Hardening & Accessibility Controls
              </h3>
            </div>
            <p className="text-xs text-[#588157]">
              Optimized for work gloves, high contrast screen readers, and direct sunlight glare.
            </p>
          </div>

          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/30 flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            axe-core Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Glove Mode (Large Touch Targets & 20% Font Boost) */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
              isGloveMode
                ? 'bg-[#E9C46A]/15 border-[#E9C46A] shadow-xs'
                : isNightMode
                ? 'bg-[#182315] border-[#2A3B26]'
                : 'bg-white/80 border-[#87A878]/25'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display flex items-center gap-1.5">
                  <Hand className="w-4 h-4 text-[#E9C46A]" />
                  Glove Mode (56px+)
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isGloveMode ? 'bg-[#E9C46A] text-[#203A2A]' : 'bg-black/10 text-current/60'}`}>
                  {isGloveMode ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                Min 56×56dp touch targets, 72×72dp map points & +20% global text scale for heavy field gloves.
              </p>
            </div>

            {onToggleGloveMode && (
              <button
                type="button"
                id="glove-mode-toggle-btn"
                onClick={onToggleGloveMode}
                className={`w-full py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isGloveMode
                    ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] shadow-md'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:border-[#87A878]'
                    : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
                }`}
              >
                {isGloveMode ? 'Disable Glove Mode' : 'Enable Glove Mode'}
              </button>
            )}
          </div>

          {/* 2. High Contrast Mode */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
              isHighContrast
                ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] shadow-xs'
                : isNightMode
                ? 'bg-[#182315] border-[#2A3B26]'
                : 'bg-white/80 border-[#87A878]/25'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display flex items-center gap-1.5">
                  <Contrast className="w-4 h-4 text-[#2A9D8F]" />
                  High Contrast Mode
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isHighContrast ? 'bg-[#2A9D8F] text-white' : 'bg-black/10 text-current/60'}`}>
                  {isHighContrast ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                Thick 2px solid borders, removes transparency, supports <code className="font-mono text-[10px]">prefers-contrast: more</code>.
              </p>
            </div>

            {onToggleHighContrast && (
              <button
                type="button"
                id="high-contrast-toggle-btn"
                onClick={onToggleHighContrast}
                className={`w-full py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isHighContrast
                    ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-md'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:border-[#87A878]'
                    : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
                }`}
              >
                {isHighContrast ? 'Disable High Contrast' : 'Enable High Contrast'}
              </button>
            )}
          </div>

          {/* 3. Sunlight Readability (Direct Sun Mode) */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
              isDirectSun
                ? 'bg-[#F4A261]/20 border-[#F4A261] shadow-xs'
                : isNightMode
                ? 'bg-[#182315] border-[#2A3B26]'
                : 'bg-white/80 border-[#87A878]/25'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display flex items-center gap-1.5">
                  <SunDim className="w-4 h-4 text-[#F4A261]" />
                  Direct Sun Readability
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isDirectSun ? 'bg-[#F4A261] text-white' : 'bg-black/10 text-current/60'}`}>
                  {isDirectSun ? 'DIRECT SUN' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                Pure white background, high density black typography, auto-triggers via ambient light sensor (&gt;10k lux).
              </p>
            </div>

            {onToggleDirectSun && (
              <button
                type="button"
                id="direct-sun-toggle-btn"
                onClick={onToggleDirectSun}
                className={`w-full py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isDirectSun
                    ? 'bg-[#F4A261] text-white border-[#F4A261] shadow-md'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:border-[#87A878]'
                    : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
                }`}
              >
                {isDirectSun ? 'Disable Direct Sun' : 'Enable Direct Sun'}
              </button>
            )}
          </div>
        </div>
      </div>
      <PiHardwareBridgeCard isNightMode={isNightMode} onAddToast={onAddToast} />

      {/* Cryptographic Identity Backup Warning Banner (>30 days) */}
      {daysSinceIdentityBackup > 30 && (
        <div
          id="identity-backup-warning-banner"
          className="rounded-3xl border-2 border-[#E9C46A] bg-[#E9C46A]/15 p-4 sm:p-5 text-[#203A2A] dark:text-[#F0F5EE] flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#E9C46A]/30 text-[#E9C46A] shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#E9C46A]" />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-display font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Cryptographic Identity Key Not Backed Up</span>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-[#E9C46A] text-[#203A2A]">
                  ACTION RECOMMENDED
                </span>
              </h4>
              <p className="text-xs text-[#588157] dark:text-[#A8BDA5] leading-relaxed">
                {lastIdentityBackupTime === 0
                  ? 'Your Ed25519 identity key, callsign, and reputation score are stored only in browser local storage. Create a password-protected backup now to prevent data loss.'
                  : `Your last identity backup was created ${daysSinceIdentityBackup} days ago. Back up regularly to secure your cryptographic key.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="banner-backup-identity-btn"
            onClick={() => setIsBackupIdentityModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-xl bg-[#E9C46A] hover:bg-[#d9b258] text-[#203A2A] shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Key className="w-4 h-4" />
            <span>Backup Identity Key Now</span>
          </button>
        </div>
      )}

      {/* Hidden File Input for Identity Key Restoration */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectedForRestore}
        accept=".hoimu-key,.json"
        className="hidden"
        id="hoimu-identity-file-input"
      />

      {/* Self-Sovereign Data Export & Identity Backup Card */}
      <div
        id="export-data-card"
        className={`rounded-3xl border p-5 sm:p-6 shadow-xs space-y-5 transition-colors ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#2A9D8F]" />
              <h3 className="font-display font-bold text-base sm:text-lg">
                Self-Sovereign Data Export & Identity Backup
              </h3>
            </div>
            <p className="text-xs text-[#588157] dark:text-[#A8BDA5]">
              Export spatial GIS data, encrypted archives, telemetry CSV logs, and password-protected Ed25519 identity backups.
            </p>
          </div>

          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            PBKDF2 / AES-256-GCM Local Crypto
          </span>
        </div>

        {/* 1. Cryptographic Identity Management Section */}
        <div className={`p-4 rounded-2xl border space-y-3 ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#E9C46A]" />
              <span className="text-xs font-bold font-display text-[#203A2A] dark:text-[#F0F5EE]">
                Ed25519 Key & Identity Backup (.hoimu-key)
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
              {lastIdentityBackupTime === 0
                ? 'Status: Never Backed Up'
                : `Last Backed Up: ${daysSinceIdentityBackup}d ago`}
            </span>
          </div>

          <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
            Export your private identity key encrypted with password-derived PBKDF2 salt and AES-256-GCM cipher. Restore anytime to migrate nodes or recover access.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Backup Identity Button */}
            <button
              type="button"
              id="backup-identity-btn"
              onClick={() => setIsBackupIdentityModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Backup Identity (.hoimu-key)</span>
            </button>

            {/* Restore Identity Button */}
            <button
              type="button"
              id="restore-identity-btn"
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] text-[#2A9D8F] border-[#364E30] hover:border-[#87A878]'
                  : 'bg-white text-[#2A9D8F] border-[#2A9D8F]/30 hover:bg-[#FAF6EE]'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Restore Identity from File</span>
            </button>
          </div>
        </div>

        {/* 2. Format Picker & Data Export Section */}
        <div className={`p-4 rounded-2xl border space-y-3 ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold font-display text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
              <Download className="w-4 h-4 text-[#2A9D8F]" />
              Export My Data Format Picker
            </span>
            <span className="text-[10px] font-mono text-[#588157]">RFC 7946 GeoJSON / QGIS Compatible</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {/* Format 1: GeoJSON */}
            <label
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                exportFormat === 'geojson'
                  ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] ring-1 ring-[#2A9D8F]'
                  : 'border-current/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value="geojson"
                checked={exportFormat === 'geojson'}
                onChange={() => setExportFormat('geojson')}
                className="sr-only"
              />
              <MapIcon className="w-4 h-4 text-[#2A9D8F] shrink-0" />
              <div>
                <span className="text-xs font-bold block">GeoJSON Map Data</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">QGIS GIS Points & Lines</span>
              </div>
            </label>

            {/* Format 2: CSV Telemetry */}
            <label
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                exportFormat === 'csv'
                  ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] ring-1 ring-[#2A9D8F]'
                  : 'border-current/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="sr-only"
              />
              <FileSpreadsheet className="w-4 h-4 text-[#2A9D8F] shrink-0" />
              <div>
                <span className="text-xs font-bold block">CSV Telemetry Logs</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Sync, Battery & Solar</span>
              </div>
            </label>

            {/* Format 3: Encrypted Archive */}
            <label
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                exportFormat === 'archive'
                  ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] ring-1 ring-[#2A9D8F]'
                  : 'border-current/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value="archive"
                checked={exportFormat === 'archive'}
                onChange={() => setExportFormat('archive')}
                className="sr-only"
              />
              <FolderArchive className="w-4 h-4 text-[#E9C46A] shrink-0" />
              <div>
                <span className="text-xs font-bold block">Encrypted Archive</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">AES-256 Full Backup</span>
              </div>
            </label>

            {/* Format 4: JSON State */}
            <label
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                exportFormat === 'json'
                  ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] ring-1 ring-[#2A9D8F]'
                  : 'border-current/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value="json"
                checked={exportFormat === 'json'}
                onChange={() => setExportFormat('json')}
                className="sr-only"
              />
              <FileCode className="w-4 h-4 text-[#588157] shrink-0" />
              <div>
                <span className="text-xs font-bold block">Offline JSON State</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Journal & Exchanges</span>
              </div>
            </label>

            {/* Format 5: Encrypted Messages */}
            <label
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                exportFormat === 'messages'
                  ? 'bg-[#2A9D8F]/15 border-[#2A9D8F] ring-1 ring-[#2A9D8F]'
                  : 'border-current/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value="messages"
                checked={exportFormat === 'messages'}
                onChange={() => setExportFormat('messages')}
                className="sr-only"
              />
              <Lock className="w-4 h-4 text-[#2A9D8F] shrink-0" />
              <div>
                <span className="text-xs font-bold block">Messages Archive</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Mesh Conversations</span>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {/* Primary Format Export Trigger */}
            <button
              type="button"
              id="export-format-btn"
              onClick={handleExportSelectedFormat}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Export {exportFormat.toUpperCase()} File</span>
            </button>

            {/* Plain Text Field Ledger Button */}
            <button
              type="button"
              id="download-text-ledger-btn"
              onClick={handleDownloadText}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 border text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] text-[#F0F5EE] border-[#364E30] hover:border-[#87A878]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/40 hover:bg-[#FAF6EE]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#588157]" />
              <span>Field Ledger (.txt)</span>
            </button>

            {/* Copy to Clipboard */}
            <button
              type="button"
              id="copy-json-clipboard-btn"
              onClick={handleCopyJson}
              className={`px-3.5 py-2.5 border text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                copiedState
                  ? 'bg-[#588157] text-white border-[#588157]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              {copiedState ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Raw</span>
                </>
              )}
            </button>

            {/* Inspect Preview */}
            <button
              type="button"
              onClick={() => setShowPreviewModal(!showPreviewModal)}
              className={`px-3.5 py-2.5 border text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                showPreviewModal
                  ? 'bg-[#2A9D8F]/20 text-[#2A9D8F] border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreviewModal ? 'Close Preview' : 'Inspect Raw'}</span>
            </button>
          </div>
        </div>

        {/* Live Schema Preview Box */}
        {showPreviewModal && (
          <div
            className={`p-3.5 rounded-2xl border font-mono text-[11px] overflow-x-auto max-h-56 ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
            }`}
          >
            <pre className="whitespace-pre-wrap">{JSON.stringify(getExportData(), null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Skills & Offered Resources Editors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Skills Tag Cloud */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border shadow-xs space-y-3 transition-colors ${
            isNightMode
              ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
              : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-display font-bold text-sm">
              <Tag className="w-4 h-4 text-[#2A9D8F]" />
              Bioregional Skills
            </div>
            <span className="text-[10px] font-mono text-[#588157] font-semibold bg-[#87A878]/20 px-2 py-0.5 rounded-full">
              {user.skills?.length || 0} Tags
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[44px]">
            {user.skills?.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EBF7F5] text-[#165B53] border border-[#2A9D8F]/30 rounded-xl text-xs font-medium"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-red-700 p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add Skill Form */}
          <form onSubmit={handleAddSkill} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add skill (e.g. Permaculture)..."
              className={`flex-1 px-3 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#87A878] ${
                isNightMode
                  ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                  : 'bg-white border-[#87A878]/35 text-[#203A2A]'
              }`}
            />
            <button
              type="submit"
              disabled={!newSkill.trim()}
              className="px-3 py-1.5 bg-[#203A2A] text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-[#16271c] cursor-pointer"
            >
              Add
            </button>
          </form>
        </div>

        {/* Offered Resources Tag Cloud */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border shadow-xs space-y-3 transition-colors ${
            isNightMode
              ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
              : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-display font-bold text-sm">
              <Package className="w-4 h-4 text-[#E76F51]" />
              Offered Resources
            </div>
            <span className="text-[10px] font-mono text-[#588157] font-semibold bg-[#87A878]/20 px-2 py-0.5 rounded-full">
              {user.offeredResources?.length || 0} Listed
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[44px]">
            {user.offeredResources?.map((res, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FDF1EE] text-[#9A3822] border border-[#E76F51]/30 rounded-xl text-xs font-medium"
              >
                <span>{res}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveResource(res)}
                  className="hover:text-red-700 p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add Resource Form */}
          <form onSubmit={handleAddResource} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newResource}
              onChange={(e) => setNewResource(e.target.value)}
              placeholder="Add resource (e.g. Seed Library)..."
              className={`flex-1 px-3 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#87A878] ${
                isNightMode
                  ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                  : 'bg-white border-[#87A878]/35 text-[#203A2A]'
              }`}
            />
            <button
              type="submit"
              disabled={!newResource.trim()}
              className="px-3 py-1.5 bg-[#203A2A] text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-[#16271c] cursor-pointer"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Active Seasonal Challenge Progress Banner */}
      <SeasonalProgressDisplay
        user={user}
        isNightMode={isNightMode}
        onUpdateUser={onUpdateProfile}
        onAddToast={onAddToast}
      />

      {/* Personal Records and Lifetime Stats */}
      <PersonalRecordsStats isNightMode={isNightMode} />

      {/* Mesh Contribution Leaderboard (Packets Relayed & High-Reliability Nodes) */}
      <MeshContributionLeaderboard
        user={user}
        peers={peers}
        isNightMode={isNightMode}
        onUpdateProfile={onUpdateProfile}
        onAddToast={onAddToast}
      />

      {/* Raspberry Pi Zero 2 W Hardware Bridge Panel */}
      <PiHardwareBridgeCard
        isNightMode={isNightMode}
        onAddToast={onAddToast}
      />

      {/* Symbiosis Trajectory & Score Section */}
      <div
        className={`p-5 rounded-3xl border shadow-xs space-y-4 transition-colors ${
          isNightMode
            ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#588157]" />
              Bioregional Symbiosis Trajectory
            </h3>
            <p className="text-xs text-[#588157]">
              Cumulative mutual aid reflections and mesh relay contributions.
            </p>
          </div>

          <SymbiosisScoreBadge score={user.symbiosisScore} size="lg" />
        </div>

        {/* Dynamic Trajectory Mini-Chart */}
        <div
          className={`p-4 rounded-2xl border space-y-3 ${
            isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/80 border-[#87A878]/20'
          }`}
        >
          <div className="flex items-end justify-between gap-4 h-24 pt-4 px-2">
            {trajectoryPoints.map((pt, idx) => {
              const maxVal = Math.max(100, user.symbiosisScore);
              const heightPct = Math.max(20, (pt.score / maxVal) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      isNightMode ? 'text-[#E9C46A]' : 'text-[#203A2A]'
                    }`}
                  >
                    {pt.score}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 ${
                      idx === trajectoryPoints.length - 1
                        ? 'bg-gradient-to-t from-[#588157] to-[#87A878] shadow-xs'
                        : 'bg-[#87A878]/40 group-hover:bg-[#87A878]/60'
                    }`}
                  />
                  <span className="text-[10px] font-mono text-[#637062]">{pt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* D3 Trust Network Visualization & Community Graph */}
      <TrustNetworkGraph
        user={user}
        peers={peers}
        endorsements={endorsements}
        transactions={transactions}
        isNightMode={isNightMode}
        onSelectPeer={onSelectPeer}
      />

      {/* Exploration Mini-Map & Gamified Progression Widget */}
      <div
        className={`p-5 rounded-3xl border shadow-xs space-y-4 transition-colors ${
          isNightMode
            ? 'bg-[#1E2C1C] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#87A878]/20 pb-3">
          <div>
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-[#E76F51]" />
              Minu Avastuste Kaart (Exploration Progress)
            </h3>
            <p className="text-xs text-[#588157]">
              Kõnni päriselus ja avasta uusi asukohapunkte oma piirkonnas.
            </p>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#E76F51]/10 text-[#E76F51] border border-[#E76F51]/25">
            <Footprints className="w-3.5 h-3.5" />
            <span>{mapRevealService.getRevealedAreas().length} alad avatud</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Progress gauge/stats */}
          <div className="md:col-span-5 space-y-3 flex flex-col justify-center">
            <div className="text-center md:text-left">
              <span className="text-4xl font-display font-black text-[#588157] tracking-tight">
                {Math.min(100, Math.round((mapRevealService.getRevealedAreas().length / 20) * 100))}%
              </span>
              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-bold uppercase tracking-wider block mt-1">
                Uuritud piirkondade tase
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E76F51] to-[#2A9D8F] transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(4, Math.min(100, (mapRevealService.getRevealedAreas().length / 20) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                <span>Algaja rändur</span>
                <span>Meister-uurija (20 alad)</span>
              </div>
            </div>

            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              Iga avastatud piirkond tugevdab kohalikku võrgusagedust ja lisab sinu kontole <strong className="text-[#2A9D8F]">+2 sümbioosi punkti</strong>!
            </p>
          </div>

          {/* Interactive abstract vector mini-map rendering */}
          <div className="md:col-span-7 h-36 rounded-2xl bg-[#FAF6EE]/70 dark:bg-[#121A10]/70 border border-[#87A878]/30 relative overflow-hidden flex items-center justify-center p-4">
            {/* Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(135,168,120,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(135,168,120,0.08)_1px,transparent_1px)] bg-[size:14px_14px]" />
            
            {/* Concentric rings representing map radius */}
            <div className="w-20 h-20 rounded-full border border-[#87A878]/15 absolute animate-pulse duration-1000" />
            <div className="w-28 h-28 rounded-full border border-[#87A878]/10 absolute" />
            
            {/* Render random node dots represent revealed areas */}
            {mapRevealService.getRevealedAreas().length === 0 ? (
              <div className="z-10 text-center space-y-1.5 p-4">
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] italic">Kõnni kaardil, et kanda esimesed avastatud kohad siia kaardile!</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Center dot */}
                <div className="w-3.5 h-3.5 rounded-full bg-[#E76F51] border-2 border-white dark:border-[#121A10] z-20 shadow-xs shadow-[#E76F51]/50" />
                
                {/* Dynamically offset child dots from center */}
                {mapRevealService.getRevealedAreas().slice(0, 10).map((area, idx) => {
                  // Determinstic positioning based on revealed timestamp
                  const angle = (idx * 57) % 360;
                  const rad = (idx * 15 + 24) % 60;
                  const x = Math.cos((angle * Math.PI) / 180) * rad;
                  const y = Math.sin((angle * Math.PI) / 180) * rad;
                  
                  return (
                    <div
                      key={idx}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute w-2.5 h-2.5 rounded-full bg-[#2A9D8F] border border-white dark:border-[#121A10] shadow-xs shadow-[#2A9D8F]/50 animate-ping duration-1000 select-none pointer-events-none"
                    />
                  );
                })}
                {mapRevealService.getRevealedAreas().slice(0, 10).map((area, idx) => {
                  const angle = (idx * 57) % 360;
                  const rad = (idx * 15 + 24) % 60;
                  const x = Math.cos((angle * Math.PI) / 180) * rad;
                  const y = Math.sin((angle * Math.PI) / 180) * rad;
                  
                  return (
                    <div
                      key={`static-${idx}`}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute w-2 h-2 rounded-full bg-[#588157] border border-white dark:border-[#121A10] shadow-xs"
                      title={`Avastatud ala: ${new Date(area.revealedAt).toLocaleDateString()}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saavutuste paneel (Achievements Panel) */}
      <AchievementsPanel
        user={user}
        journal={journal}
        proposals={proposals}
        isNightMode={isNightMode}
        onAddToast={onAddToast}
      />

      {/* Seasonal Challenges Panel */}
      <SeasonalChallengesPanel
        user={user}
        onUpdateUser={onUpdateProfile}
        onAddToast={onAddToast}
        isNightMode={isNightMode}
      />

      {/* Solarpunk Landing Page & Manifesto Entry Card */}
      {onOpenLandingPage && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
            isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-white border-[#87A878]/35 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                HÕIMU Solarpunk Landing Page
              </h4>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                View architectural manifesto, interactive mesh radio simulator, self-hosting guide, and protocol FAQ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLandingPage}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[#588157] hover:bg-[#476a46] text-white shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:scale-95"
          >
            <span>Open Landing Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reset Demo Data & Local State Notice */}
      <div
        className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30]'
            : 'bg-[#F0F5EE] border-[#87A878]/30'
        }`}
      >
        <div className="flex items-center gap-2 text-xs text-[#637062]">
          <ShieldCheck className="w-4 h-4 text-[#2A9D8F] shrink-0" />
          <span>All edits are stored locally in your browser's persistent state.</span>
        </div>

        {showResetConfirm ? (
          <div className="flex items-center gap-2 animate-in fade-in">
            <span className="text-xs text-red-700 font-bold">Reset all data?</span>
            <button
              type="button"
              onClick={() => {
                onResetDemoData();
                setShowResetConfirm(false);
              }}
              className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-red-700 cursor-pointer"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-2 py-1 text-xs text-[#637062] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#637062] hover:text-red-700 border rounded-xl transition-colors cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] hover:border-red-500'
                : 'bg-white border-[#87A878]/30 hover:border-red-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Seed Data</span>
          </button>
        )}
      </div>

      {/* MODAL 1: Password-Protected Identity Key Backup (.hoimu-key) */}
      {isBackupIdentityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#203A2A] text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40 dark:border-[#364E30] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#E9C46A]" />
                <h3 className="font-display font-bold text-base">
                  Backup Ed25519 Identity Key
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupIdentityModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              Set a password to protect your private Ed25519 key, callsign <strong className="text-[#203A2A] dark:text-white">@{user.callsign}</strong>, and reputation score. Your backup will be encrypted using <strong className="text-[#2A9D8F]">PBKDF2 (100k iterations) + AES-256-GCM</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteBackupIdentity();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold mb-1">
                  Encryption Password
                </label>
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="At least 4 characters..."
                  required
                  minLength={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#87A878]/40 dark:border-[#364E30] bg-white dark:bg-[#182315] text-xs focus:ring-2 focus:ring-[#E9C46A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmBackupPassword}
                  onChange={(e) => setConfirmBackupPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  required
                  minLength={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#87A878]/40 dark:border-[#364E30] bg-white dark:bg-[#182315] text-xs focus:ring-2 focus:ring-[#E9C46A] focus:outline-none"
                />
              </div>

              {backupPassword && confirmBackupPassword && backupPassword !== confirmBackupPassword && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Passwords do not match.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBackupIdentityModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#637062] hover:text-[#203A2A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!backupPassword || backupPassword !== confirmBackupPassword}
                  className="px-5 py-2.5 bg-[#E9C46A] hover:bg-[#d9b258] text-[#203A2A] text-xs font-bold rounded-xl shadow-md disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .hoimu-key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Identity Key Restore Decryption Modal */}
      {isRestoreIdentityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#203A2A] text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40 dark:border-[#364E30] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#2A9D8F]" />
                <h3 className="font-display font-bold text-base">
                  Restore Cryptographic Identity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRestoreIdentityModalOpen(false);
                  setSelectedKeyFileContent(null);
                  setSelectedKeyFileName(null);
                }}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#2A9D8F]/15 border border-[#2A9D8F]/30 text-xs flex items-center gap-2">
              <FileCode className="w-4 h-4 text-[#2A9D8F] shrink-0" />
              <span className="font-mono text-[11px] truncate">
                Selected File: <strong>{selectedKeyFileName}</strong>
              </span>
            </div>

            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              Enter the password used when generating this identity backup file to decrypt and restore your Ed25519 identity key, callsign, and reputation.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteRestoreIdentity();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold mb-1">
                  Decryption Password
                </label>
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Enter backup password..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#87A878]/40 dark:border-[#364E30] bg-white dark:bg-[#182315] text-xs focus:ring-2 focus:ring-[#2A9D8F] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRestoreIdentityModalOpen(false);
                    setSelectedKeyFileContent(null);
                    setSelectedKeyFileName(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#637062] hover:text-[#203A2A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!restorePassword}
                  className="px-5 py-2.5 bg-[#2A9D8F] hover:bg-[#238378] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Decrypt & Restore Identity</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AES-256-GCM Encrypted Full State Archive Password Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#203A2A] text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40 dark:border-[#364E30] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-[#E9C46A]" />
                <h3 className="font-display font-bold text-base">
                  Encrypted Archive Backup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              Export an <strong className="text-[#2A9D8F]">AES-256-GCM encrypted container</strong> of all local storage state (Journal, exchanges, offline map caches, keys). Choose an archive password below.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteArchiveExport();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold mb-1">
                  Archive Encryption Password
                </label>
                <input
                  type="password"
                  value={archivePassword}
                  onChange={(e) => setArchivePassword(e.target.value)}
                  placeholder="At least 4 characters..."
                  required
                  minLength={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#87A878]/40 dark:border-[#364E30] bg-white dark:bg-[#182315] text-xs focus:ring-2 focus:ring-[#E9C46A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#637062] hover:text-[#203A2A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!archivePassword || archivePassword.length < 4}
                  className="px-5 py-2.5 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Download .hoimu-archive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
