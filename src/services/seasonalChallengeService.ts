import { UserProfile, JournalEntry } from '../types';

export interface SeasonalChallenge {
  id: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  seasonName: string;
  months: string;
  title: string;
  description: string;
  goalLabel: string;
  targetValue: number;
  rewardBadge: string;
  rewardBadgeIcon: string;
  isUnlocked: boolean;
}

class SeasonalChallengeService {
  private storagePrefix = 'hoimu_seasonal_';

  // Get active season based on a date or month index (0-11)
  getSeasonByMonth(monthIndex: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    if (monthIndex >= 2 && monthIndex <= 4) return 'spring'; // Mar, Apr, May
    if (monthIndex >= 5 && monthIndex <= 7) return 'summer'; // Jun, Jul, Aug
    if (monthIndex >= 8 && monthIndex <= 10) return 'autumn'; // Sep, Oct, Nov
    return 'winter'; // Dec, Jan, Feb
  }

  getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth();
    return this.getSeasonByMonth(month);
  }

  // Get progress value for a specific challenge
  getProgress(challengeId: string): number {
    const saved = localStorage.getItem(`${this.storagePrefix}progress_${challengeId}`);
    return saved ? parseInt(saved, 10) : 0;
  }

  saveProgress(challengeId: string, value: number): void {
    localStorage.setItem(`${this.storagePrefix}progress_${challengeId}`, value.toString());
  }

  // Get unlocked badge status
  isBadgeUnlocked(badgeId: string): boolean {
    const saved = localStorage.getItem(`${this.storagePrefix}badge_${badgeId}`);
    return saved === 'true';
  }

  unlockBadge(badgeId: string): void {
    localStorage.setItem(`${this.storagePrefix}badge_${badgeId}`, 'true');
  }

  // Get checklists or sub-tasks for Winter challenge specifically
  getWinterChecklist(): { id: string; label: string; completed: boolean }[] {
    const saved = localStorage.getItem(`${this.storagePrefix}winter_checklist`);
    if (saved) return JSON.parse(saved);

    return [
      { id: 'battery', label: 'Kontrolli seadme aku ja võrgu diagnostikat 🔋', completed: false },
      { id: 'crisis', label: 'Testi kriisirežiimi või edasta test-häiresignaal 🚨', completed: false },
      { id: 'backup', label: 'Ekspordi kohaliku identiteedi turvakoopia (JSON fail) 🔑', completed: false },
    ];
  }

  saveWinterChecklist(checklist: { id: string; label: string; completed: boolean }[]): void {
    localStorage.setItem(`${this.storagePrefix}winter_checklist`, JSON.stringify(checklist));
    
    // Auto update winter challenge progress to the count of completed items
    const completedCount = checklist.filter(item => item.completed).length;
    this.saveProgress('winter', completedCount);
  }

  // Calculate dynamic progress values based on app state
  syncProgressWithAppState(
    challengeId: string,
    user: UserProfile,
    revealedAreasCount: number
  ): number {
    if (challengeId === 'spring') {
      // "Avasta 3 uut parki / haljasala"
      // Let's use either the manual counter or map reveal count
      const manualProgress = this.getProgress('spring');
      const calculated = Math.max(manualProgress, Math.min(3, Math.floor(revealedAreasCount / 2)));
      this.saveProgress('spring', calculated);
      return calculated;
    }

    if (challengeId === 'summer') {
      // "Kõnni 10 000 sammu 5 päeval"
      // Summer has a daily count state
      return this.getProgress('summer');
    }

    if (challengeId === 'autumn') {
      // "Jaga 5 saagikoristuse ressurssi"
      // Sync with user offered resources length
      const count = user.offeredResources ? user.offeredResources.length : 0;
      const progress = Math.min(5, count);
      this.saveProgress('autumn', progress);
      return progress;
    }

    if (challengeId === 'winter') {
      // "Valmista kriisipakett"
      // Uses winter checklist completed count
      const checklist = this.getWinterChecklist();
      const progress = checklist.filter(item => item.completed).length;
      this.saveProgress('winter', progress);
      return progress;
    }

    return 0;
  }

  getChallenges(
    user: UserProfile,
    revealedAreasCount: number
  ): SeasonalChallenge[] {
    return [
      {
        id: 'spring',
        season: 'spring',
        seasonName: 'Kevad',
        months: 'Märts – Mai',
        title: 'Kevadine tärkamine 🌿',
        description: 'Uuri kohalikku elurikkust! Avasta kohalikult bioregionaalselt kaardilt vähemalt 3 uut haljasala, jõeäärset piirkonda või loodusparki.',
        goalLabel: 'Avastatud rohealad',
        targetValue: 3,
        rewardBadge: 'Haruldane Taimemärk',
        rewardBadgeIcon: '🌿',
        isUnlocked: this.isBadgeUnlocked('spring') || this.getProgress('spring') >= 3,
      },
      {
        id: 'summer',
        season: 'summer',
        seasonName: 'Suvi',
        months: 'Juuni – August',
        title: 'Suvine Solarpunk rännak ☀️',
        description: 'Tee pikemaid jalutuskäike, et koguda päikeseenergiat ja kaardistada uusi mesh-sõlmi. Saavuta vähemalt 10 000 sammu 5 erineval päeval.',
        goalLabel: 'Päevad sammueesmärgiga (10k)',
        targetValue: 5,
        rewardBadge: 'Päikeseenergia teema',
        rewardBadgeIcon: '☀️',
        isUnlocked: this.isBadgeUnlocked('summer') || this.getProgress('summer') >= 5,
      },
      {
        id: 'autumn',
        season: 'autumn',
        seasonName: 'Sügis',
        months: 'September – November',
        title: 'Sügisene saagikoristus 🍁',
        description: 'Sügis on jagamise aeg! Jaga kohalikus võrgus vähemalt 5 sügisest saaki, taimeteed, seemneid, hoidiseid või aiasaadusi.',
        goalLabel: 'Jagatud sügisesed ressursid',
        targetValue: 5,
        rewardBadge: 'Kuldne Lehemärk',
        rewardBadgeIcon: '🍁',
        isUnlocked: this.isBadgeUnlocked('autumn') || this.getProgress('autumn') >= 5,
      },
      {
        id: 'winter',
        season: 'winter',
        seasonName: 'Talv',
        months: 'Detsember – Veebruar',
        title: 'Talvine kriisivalmidus ❄️',
        description: 'Valmista ette võrguväline kriisipakett. Vali profiilist turvakoopia, käivita kriisiseisundi test ja veendu, et seade on ekstreemoludeks valmis.',
        goalLabel: 'Kriisivalmiduse kontrollid',
        targetValue: 3,
        rewardBadge: 'Lumehelbe märk',
        rewardBadgeIcon: '❄️',
        isUnlocked: this.isBadgeUnlocked('winter') || this.getProgress('winter') >= 3,
      },
    ];
  }

  // Reset all challenge progress for testing
  resetAllProgress(): void {
    const ids = ['spring', 'summer', 'autumn', 'winter'];
    ids.forEach(id => {
      localStorage.removeItem(`${this.storagePrefix}progress_${id}`);
      localStorage.removeItem(`${this.storagePrefix}badge_${id}`);
    });
    localStorage.removeItem(`${this.storagePrefix}winter_checklist`);
  }

  // Play a beautiful bell arpeggio for seasonal achievements
  playSeasonalChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Bright nature/solar chord (Major 7th arpeggio)
      const freqs = [587.33, 739.99, 880.00, 1109.73, 1174.66]; // D5, F#5, A5, C#6, D6

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Elegant Sine synth for smooth seasonal bells
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.4);
      });
    } catch (e) {
      console.warn('Audio Context not available yet:', e);
    }
  }
}

export const seasonalChallengeService = new SeasonalChallengeService();
