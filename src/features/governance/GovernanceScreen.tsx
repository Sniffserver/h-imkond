import React from 'react';
import { BioregionalDaoModal } from '../../components/BioregionalDaoModal';
import { DaoProposal, ProposalCategory, UserProfile } from '../../types';

export interface GovernanceScreenProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  proposals: DaoProposal[];
  onVoteProposal: (proposalId: string, vote: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal: (data: {
    title: string;
    description: string;
    category: ProposalCategory;
  }) => void;
  isNightMode?: boolean;
}

export const GovernanceScreen: React.FC<GovernanceScreenProps> = (props) => {
  return <BioregionalDaoModal {...props} />;
};

export { BioregionalDaoModal };
