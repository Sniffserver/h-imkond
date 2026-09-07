import { useState, useEffect } from 'react';
import { achievementService, Achievement } from '../../services/game/achievementService';
import { UserProfile, JournalEntry, DaoProposal } from '../../types';

export function useAchievements(user: UserProfile, journal: JournalEntry[], proposals: DaoProposal[]) {
  const [activeCelebration, setActiveCelebration] = useState<Achievement | null>(null);

  useEffect(() => {
    const newlyUnlocked = achievementService.checkForNewUnlocks(user, journal, proposals);
    if (newlyUnlocked.length > 0) {
      setActiveCelebration(newlyUnlocked[0]);
    }
  }, [user, journal, proposals]);

  return {
    activeCelebration,
    setActiveCelebration,
    achievements: achievementService.getAchievements(user, journal, proposals),
  };
}
