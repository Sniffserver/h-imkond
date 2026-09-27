/**
 * Field Quests Engine
 * Authentic real-world physical exploration objectives (streets, places, mesh signals, campfire return).
 */

import { FieldQuest, FieldQuestObjective } from '../../../types';
import { streetDiscoveryService } from '../streets/streetDiscoveryService';

const STORAGE_KEY_QUESTS = 'hoimu_field_quests';

export const CANONICAL_FIELD_QUESTS: FieldQuest[] = [
  {
    id: 'quest_kalamaja_core',
    title: 'Kalamaja Perimeter Survey',
    district: 'Kalamaja',
    description: 'Explore unconfirmed street segments, locate a local tool hardware resource, spot a reuse point, and confirm mesh signal coverage.',
    targetDistanceKm: 2.7,
    estimatedMinutes: 35,
    completed: false,
    objectives: [
      {
        id: 'obj_kalamaja_streets',
        title: 'Explore 1 new street',
        type: 'street_explore',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Walk along any unconfirmed street segment in Kalamaja',
      },
      {
        id: 'obj_kalamaja_tools',
        title: 'Find a hardware or tool store',
        type: 'place_find',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Verify location of a hardware/maker resource (e.g. Espak, Bauhaus or local workshop)',
      },
      {
        id: 'obj_kalamaja_reuse',
        title: 'Find a reuse or give box place',
        type: 'place_find',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Locate a public bookcase, Uuskasutuskeskus, or community give box',
      },
      {
        id: 'obj_kalamaja_mesh',
        title: 'Observe one mesh node packet',
        type: 'mesh_observe',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Receive a radio beacon from a nearby LoRa or BLE peer',
      },
      {
        id: 'obj_kalamaja_return',
        title: 'Return to campfire / origin',
        type: 'return_campfire',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Complete loop back to base Campfire',
      },
    ],
  },
  {
    id: 'quest_telliskivi_creative',
    title: 'Telliskivi Mutual Aid Circuit',
    district: 'Telliskivi',
    description: 'Chart community repair spots, bicycle support hubs, and verify local solar beacon.',
    targetDistanceKm: 1.8,
    estimatedMinutes: 25,
    completed: false,
    objectives: [
      {
        id: 'obj_telliskivi_streets',
        title: 'Explore 2 street segments',
        type: 'street_explore',
        targetCount: 2,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'obj_telliskivi_bike',
        title: 'Find bicycle repair station',
        type: 'place_find',
        targetCount: 1,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'obj_telliskivi_solar',
        title: 'Observe mesh solar hub',
        type: 'mesh_observe',
        targetCount: 1,
        currentCount: 0,
        completed: false,
      },
    ],
  },
];

export class FieldQuestService {
  private static instance: FieldQuestService | null = null;
  private quests: FieldQuest[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): FieldQuestService {
    if (!FieldQuestService.instance) {
      FieldQuestService.instance = new FieldQuestService();
    }
    return FieldQuestService.instance;
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_QUESTS);
        if (saved) {
          this.quests = JSON.parse(saved);
          return;
        }
      } catch {
        // Ignored
      }
    }
    this.quests = JSON.parse(JSON.stringify(CANONICAL_FIELD_QUESTS));
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_QUESTS, JSON.stringify(this.quests));
      } catch {
        // Ignored
      }
    }
  }

  public getQuests(): FieldQuest[] {
    return this.quests;
  }

  public getActiveQuest(): FieldQuest | undefined {
    return this.quests.find((q) => !q.completed) || this.quests[0];
  }

  public completeObjective(questId: string, objectiveId: string): void {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest) return;

    const obj = quest.objectives.find((o) => o.id === objectiveId);
    if (!obj) return;

    obj.currentCount = obj.targetCount;
    obj.completed = true;

    // Check if whole quest is completed
    if (quest.objectives.every((o) => o.completed)) {
      quest.completed = true;
      quest.completedAt = Date.now();
    }

    this.saveToStorage();
  }

  public resetQuests(): void {
    this.quests = JSON.parse(JSON.stringify(CANONICAL_FIELD_QUESTS));
    this.saveToStorage();
  }
}

export const fieldQuestService = FieldQuestService.getInstance();
