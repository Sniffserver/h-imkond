import { UserProfile, JournalEntry, DaoProposal } from '../types';
import { mapRevealService } from './mapRevealService';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  currentValue: number;
  targetValue: number;
  isUnlocked: boolean;
  progressPercent: number;
  tier?: 'bronze' | 'silver' | 'gold' | 'solar';
  category?: 'exploration' | 'community' | 'mesh' | 'reflection' | 'governance';
  hint?: string;
  milestoneReward?: string;
}

class AchievementService {
  private unlockedIdsKey = 'hoimu_unlocked_achievements';

  getUnlockedIds(): string[] {
    const saved = localStorage.getItem(this.unlockedIdsKey);
    return saved ? JSON.parse(saved) : [];
  }

  saveUnlockedIds(ids: string[]): void {
    localStorage.setItem(this.unlockedIdsKey, JSON.stringify(ids));
  }

  getAchievements(
    user: UserProfile,
    journal: JournalEntry[],
    proposals: DaoProposal[] = []
  ): Achievement[] {
    const unlockedIds = this.getUnlockedIds();

    // 1. Esimene samm (First Step)
    const exploredStreetsCount = user.exploredStreets ? user.exploredStreets.length : 0;
    const isFirstStepUnlocked = exploredStreetsCount >= 1;

    // 2. Rajaleidja (Pathfinder)
    const revealedAreasCount = mapRevealService.getRevealedAreas().length;
    const isPathfinderUnlocked = revealedAreasCount >= 5;

    // 3. Kogukonna toetaja (Community Supporter)
    const completedExchanges = user.completedExchanges || 0;
    const isCommunitySupporterUnlocked = completedExchanges >= 10;

    // 4. Refleksiivne rändaja (Reflective Wanderer)
    const journalCount = journal.length;
    const isReflectiveWandererUnlocked = journalCount >= 5;

    // 5. Valvepost (Sentry / Guard)
    const votedCount = proposals.filter((p) => p.userVoted).length;
    const isSentryUnlocked = votedCount >= 3;

    // 6. Sümbioosi meister (Symbiosis Master)
    const symbiosisScore = user.symbiosisScore || 0;
    const isSymbiosisUnlocked = symbiosisScore >= 100;

    // 7. Võrgu varahoidja (Resource Steward)
    const offeredCount = user.offeredResources ? user.offeredResources.length : 0;
    const isResourceStewardUnlocked = offeredCount >= 3;

    // 8. Võrgu teerajaja (Mesh Pioneer)
    const skillsCount = user.skills ? user.skills.length : 0;
    const isMeshPioneerUnlocked = skillsCount >= 3;

    const list: Achievement[] = [
      {
        id: 'first_step',
        title: 'Esimene samm',
        description: 'Avasta oma esimene tänav (kõnni asukoha lähedal).',
        icon: '👣',
        currentValue: exploredStreetsCount,
        targetValue: 1,
        isUnlocked: isFirstStepUnlocked || unlockedIds.includes('first_step'),
        progressPercent: Math.min(100, (exploredStreetsCount / 1) * 100),
        tier: 'bronze',
        category: 'exploration',
        hint: 'Kõnni päriselus või liigu kaardil tänavate läheduses.',
        milestoneReward: '+5 Sümbioosipunkti',
      },
      {
        id: 'pathfinder',
        title: 'Rajaleidja',
        description: 'Avasta vähemalt 5 erinevat piirkonda kohalikult kaardilt.',
        icon: '🧭',
        currentValue: revealedAreasCount,
        targetValue: 5,
        isUnlocked: isPathfinderUnlocked || unlockedIds.includes('pathfinder'),
        progressPercent: Math.min(100, (revealedAreasCount / 5) * 100),
        tier: 'silver',
        category: 'exploration',
        hint: 'Avasta linnaosasid jalgsi, et hajutada udu bioregiooni kaardilt.',
        milestoneReward: '+15 Sümbioosipunkti',
      },
      {
        id: 'community_supporter',
        title: 'Kogukonna toetaja',
        description: 'Tee vähemalt 10 edukat võrguvälist ressursivahetust.',
        icon: '🤝',
        currentValue: completedExchanges,
        targetValue: 10,
        isUnlocked: isCommunitySupporterUnlocked || unlockedIds.includes('community_supporter'),
        progressPercent: Math.min(100, (completedExchanges / 10) * 100),
        tier: 'gold',
        category: 'community',
        hint: 'Vaheta naabritega seemneid, tööriistu või akumahtu.',
        milestoneReward: '+30 Sümbioosipunkti',
      },
      {
        id: 'reflective_wanderer',
        title: 'Refleksiivne rändaja',
        description: 'Kirjuta vähemalt 5 kohalikku päeviku sissekannet.',
        icon: '✍️',
        currentValue: journalCount,
        targetValue: 5,
        isUnlocked: isReflectiveWandererUnlocked || unlockedIds.includes('reflective_wanderer'),
        progressPercent: Math.min(100, (journalCount / 5) * 100),
        tier: 'silver',
        category: 'reflection',
        hint: 'Talleta oma maastikuperspektiivid ja mõtisklused Päevikusse.',
        milestoneReward: '+10 Sümbioosipunkti',
      },
      {
        id: 'sentry',
        title: 'Valvepost',
        description: 'Osale kohalikus DAO hääletuses vähemalt 3 korda.',
        icon: '🏛️',
        currentValue: votedCount,
        targetValue: 3,
        isUnlocked: isSentryUnlocked || unlockedIds.includes('sentry'),
        progressPercent: Math.min(100, (votedCount / 3) * 100),
        tier: 'silver',
        category: 'governance',
        hint: 'Hääleta aktiivsete DAO ettepanekute poolt või vastu.',
        milestoneReward: '+15 Sümbioosipunkti',
      },
      {
        id: 'symbiosis_master',
        title: 'Sümbioosi meister',
        description: 'Kogu vähemalt 100 bioregionaalset sümbioosipunkti.',
        icon: '🌿',
        currentValue: symbiosisScore,
        targetValue: 100,
        isUnlocked: isSymbiosisUnlocked || unlockedIds.includes('symbiosis_master'),
        progressPercent: Math.min(100, (symbiosisScore / 100) * 100),
        tier: 'solar',
        category: 'community',
        hint: 'Toeta naabreid, kirjuta päevikut ja aita signaali releerida.',
        milestoneReward: '☀️ Päikesemärk & Kuldtase',
      },
      {
        id: 'resource_steward',
        title: 'Võrgu varahoidja',
        description: 'Paku kogukonnale vähemalt 3 kohalikku ressurssi või tööriista.',
        icon: '🌱',
        currentValue: offeredCount,
        targetValue: 3,
        isUnlocked: isResourceStewardUnlocked || unlockedIds.includes('resource_steward'),
        progressPercent: Math.min(100, (offeredCount / 3) * 100),
        tier: 'silver',
        category: 'community',
        hint: 'Lisa oma profiilile jagatavaid varasid (tööriistad, seemned, akud).',
        milestoneReward: '+15 Sümbioosipunkti',
      },
      {
        id: 'mesh_pioneer',
        title: 'Võrgu teerajaja',
        description: 'Registreeri oma profiilil vähemalt 3 bioregiooni oskust.',
        icon: '⚡',
        currentValue: skillsCount,
        targetValue: 3,
        isUnlocked: isMeshPioneerUnlocked || unlockedIds.includes('mesh_pioneer'),
        progressPercent: Math.min(100, (skillsCount / 3) * 100),
        tier: 'bronze',
        category: 'mesh',
        hint: 'Märgi oma oskused (nt parandus, päikeseenergia, permakultuur).',
        milestoneReward: '+10 Sümbioosipunkti',
      },
    ];

    return list;
  }

  /**
   * Returns only achievements that the user has unlocked.
   */
  getUnlockedAchievements(
    user: UserProfile,
    journal: JournalEntry[],
    proposals: DaoProposal[] = []
  ): Achievement[] {
    return this.getAchievements(user, journal, proposals).filter((a) => a.isUnlocked);
  }

  /**
   * Checks if any achievements are newly unlocked.
   * Returns the achievements that were just unlocked on this check.
   */
  checkForNewUnlocks(
    user: UserProfile,
    journal: JournalEntry[],
    proposals: DaoProposal[] = []
  ): Achievement[] {
    const currentList = this.getAchievements(user, journal, proposals);
    const previouslyUnlocked = this.getUnlockedIds();
    const newlyUnlocked: Achievement[] = [];

    currentList.forEach((ach) => {
      if (ach.isUnlocked && !previouslyUnlocked.includes(ach.id)) {
        newlyUnlocked.push(ach);
        previouslyUnlocked.push(ach.id);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveUnlockedIds(previouslyUnlocked);
    }

    return newlyUnlocked;
  }

  /**
   * Synthesizes an elegant, solar-punk chime sound when an achievement is unlocked.
   */
  playChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Golden solar chime chord (Major pentatonic arpeggio)
      const freqs = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5, E5, G5, B5, C6
      const now = ctx.currentTime;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // High quality glass-like synth
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        // Gentle envelope decay
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 1.0);
      });
    } catch (e) {
      console.warn('Audio Context is blocked or not supported yet:', e);
    }
  }
}

export const achievementService = new AchievementService();
