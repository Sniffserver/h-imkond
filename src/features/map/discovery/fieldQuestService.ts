/**
 * Field Quests Engine
 * Authentic real-world physical exploration objectives (streets, places, mesh signals, campfire return).
 */

import { FieldQuest, FieldQuestObjective, GeoPoint } from '../../../types';
import { streetDiscoveryService } from '../streets/streetDiscoveryService';
import { observationManager } from '../../../services/observation/ObservationManager';
import { mapRepository } from '../data/repository';

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
      {
        id: 'obj_kalamaja_blockage',
        title: 'Report road barrier or block',
        type: 'subjective',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        details: 'Confirm and report any physical debris, barrier or blockage on Kalamaja path',
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
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
    this.setupAutomaticListeners();
  }

  public static getInstance(): FieldQuestService {
    if (!FieldQuestService.instance) {
      FieldQuestService.instance = new FieldQuestService();
    }
    return FieldQuestService.instance;
  }

  private setupAutomaticListeners(): void {
    // 1. Discover street segment: GPS trace confirms it -> automatic completion
    streetDiscoveryService.subscribe((result) => {
      this.handleStreetDiscovery(result.newlyDiscoveredSegments.length);
    });

    // 2. Observe radio signal: actual ObservationManager event -> automatic completion
    observationManager.subscribe(() => {
      this.handleMeshObserve();
    });
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

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[FieldQuestService] Listener error:', err);
      }
    });
  }

  public completeObjective(questId: string, objectiveId: string): void {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest) return;

    const obj = quest.objectives.find((o) => o.id === objectiveId);
    if (!obj) return;

    obj.currentCount = obj.targetCount;
    obj.completed = true;
    if (obj.type === 'subjective') {
      obj.isUserConfirmed = true;
    }

    // Check if whole quest is completed
    if (quest.objectives.every((o) => o.completed)) {
      quest.completed = true;
      quest.completedAt = Date.now();
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  public handleStreetDiscovery(newlyDiscoveredCount: number = 1): void {
    if (newlyDiscoveredCount <= 0) return;
    const active = this.getActiveQuest();
    if (!active) return;

    let changed = false;
    active.objectives.forEach((obj) => {
      if (obj.type === 'street_explore' && !obj.completed) {
        obj.currentCount = Math.min(obj.targetCount, obj.currentCount + newlyDiscoveredCount);
        if (obj.currentCount >= obj.targetCount) {
          obj.completed = true;
        }
        changed = true;
      }
    });

    if (changed) {
      if (active.objectives.every((o) => o.completed)) {
        active.completed = true;
        active.completedAt = Date.now();
      }
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public handleMeshObserve(): void {
    const active = this.getActiveQuest();
    if (!active) return;

    let changed = false;
    active.objectives.forEach((obj) => {
      if (obj.type === 'mesh_observe' && !obj.completed) {
        obj.currentCount = Math.min(obj.targetCount, obj.currentCount + 1);
        if (obj.currentCount >= obj.targetCount) {
          obj.completed = true;
        }
        changed = true;
      }
    });

    if (changed) {
      if (active.objectives.every((o) => o.completed)) {
        active.completed = true;
        active.completedAt = Date.now();
      }
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public processLocationUpdate(lat: number, lng: number): void {
    const active = this.getActiveQuest();
    if (!active) return;

    let changed = false;

    active.objectives.forEach((obj) => {
      if (obj.completed) return;

      // 1. Visit POI: GPS proximity + dwell -> automatic completion
      if (obj.type === 'place_find') {
        const places = mapRepository.getAllPlaces();

        let targetCategory = '';
        if (obj.id.includes('tools') || obj.title.toLowerCase().includes('hardware') || obj.title.toLowerCase().includes('tool')) {
          targetCategory = 'tools';
        } else if (obj.id.includes('reuse') || obj.title.toLowerCase().includes('reuse') || obj.title.toLowerCase().includes('bookcase')) {
          targetCategory = 'finds';
        } else if (obj.id.includes('bike') || obj.title.toLowerCase().includes('repair') || obj.title.toLowerCase().includes('bike')) {
          targetCategory = 'tools';
        }

        if (targetCategory) {
          const nearPlace = places.find((p: any) => {
            if (p.mainCategory !== targetCategory) return false;
            const d = this.calculateDistance(lat, lng, p.location.lat, p.location.lng);
            return d <= 40; // Under 40 meters proximity
          });

          if (nearPlace) {
            obj.currentCount = Math.min(obj.targetCount, obj.currentCount + 1);
            if (obj.currentCount >= obj.targetCount) {
              obj.completed = true;
            }
            changed = true;
          }
        }
      }

      // 2. Return to campfire: GPS proximity
      if (obj.type === 'return_campfire') {
        const campfireLat = 59.4370;
        const campfireLng = 24.7535;
        const dist = this.calculateDistance(lat, lng, campfireLat, campfireLng);
        if (dist <= 40) {
          obj.currentCount = obj.targetCount;
          obj.completed = true;
          changed = true;
        }
      }
    });

    if (changed) {
      if (active.objectives.every((o) => o.completed)) {
        active.completed = true;
        active.completedAt = Date.now();
      }
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  public resetQuests(): void {
    this.quests = JSON.parse(JSON.stringify(CANONICAL_FIELD_QUESTS));
    this.saveToStorage();
    this.notifyListeners();
  }
}

export const fieldQuestService = FieldQuestService.getInstance();
