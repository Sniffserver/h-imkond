import React from 'react';
import { ProfileTab } from '../../components/ProfileTab';
import {
  UserProfile,
  JournalEntry,
  Transaction,
  DaoProposal,
  MeshNode,
  TrustEndorsement,
  ResourceItem,
  MeshMessage,
  ToastMessage,
} from '../../types';

export interface ProfileScreenProps {
  user: UserProfile;
  journal: JournalEntry[];
  transactions: Transaction[];
  proposals: DaoProposal[];
  peers: MeshNode[];
  endorsements: TrustEndorsement[];
  resources: ResourceItem[];
  messages: MeshMessage[];
  onSelectPeer: (peer: MeshNode) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onResetDemoData: () => void;
  isNightMode?: boolean;
  onToggleNightMode: () => void;
  isGloveMode?: boolean;
  onToggleGloveMode: () => void;
  isHighContrast?: boolean;
  onToggleHighContrast: () => void;
  isDirectSun?: boolean;
  onToggleDirectSun: () => void;
  onOpenBackupSetup: () => void;
  onOpenWishlist: () => void;
  onOpenDaoModal: () => void;
  onOpenLandingPage: () => void;
  onAddToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = (props) => {
  return <ProfileTab {...props} />;
};

export * from '../../components/ProfileTab';
