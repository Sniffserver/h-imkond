import React from 'react';
import { AchievementsPanel } from '../../components/AchievementsPanel';
import { AchievementCelebrationOverlay } from '../../components/AchievementCelebrationOverlay';
import { Achievement } from '../../services/game/achievementService';
import { UserProfile, JournalEntry, DaoProposal } from '../../types';

export interface AchievementsScreenProps {
  user: UserProfile;
  journal: JournalEntry[];
  proposals: DaoProposal[];
  isNightMode?: boolean;
  activeCelebration: Achievement | null;
  onCloseCelebration: () => void;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  user,
  journal,
  proposals,
  isNightMode = false,
  activeCelebration,
  onCloseCelebration,
}) => {
  return (
    <>
      <AchievementsPanel
        user={user}
        journal={journal}
        proposals={proposals}
        isNightMode={isNightMode}
      />
      {activeCelebration && (
        <AchievementCelebrationOverlay
          achievement={activeCelebration}
          onClose={onCloseCelebration}
          isNightMode={isNightMode}
        />
      )}
    </>
  );
};

export { AchievementsPanel, AchievementCelebrationOverlay };
