/**
 * HÕIMU Living Fieldcraft Milestones
 * Replaces synthetic gamification XP with real, verifiable milestones.
 */

export interface FieldcraftMilestone {
  id: string;
  category: 'ready' | 'connected' | 'helpful' | 'secure' | 'explorer';
  title: string;
  description: string;
  isUnlocked: boolean;
  unlockedAt?: number;
  evidence?: string;
}

export interface FieldSparkAction {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionTab?: 'map' | 'messages' | 'today' | 'more' | 'exchange';
  actionCommand?: string;
}

const STORAGE_KEY = 'hoimu_fieldcraft_milestones_v1';

export class FieldcraftService {
  private static instance: FieldcraftService | null = null;
  private milestones: Map<string, FieldcraftMilestone> = new Map();
  private listeners: Set<(list: FieldcraftMilestone[]) => void> = new Set();

  private constructor() {
    this.initDefaultMilestones();
    this.load();
  }

  public static getInstance(): FieldcraftService {
    if (!FieldcraftService.instance) {
      FieldcraftService.instance = new FieldcraftService();
    }
    return FieldcraftService.instance;
  }

  private initDefaultMilestones(): void {
    const defaults: FieldcraftMilestone[] = [
      {
        id: 'first_map',
        category: 'ready',
        title: 'FIRST MAP',
        description: 'Installed verified offline vector map pack.',
        isUnlocked: true, // Default Tallinn is embedded/installed
        unlockedAt: Date.now(),
        evidence: 'Tallinn PMTiles verified',
      },
      {
        id: 'first_spark',
        category: 'connected',
        title: 'FIRST SPARK',
        description: 'Discovered or verified your first nearby peer.',
        isUnlocked: false,
      },
      {
        id: 'first_relay',
        category: 'connected',
        title: 'FIRST RELAY',
        description: 'Successfully relayed a mesh frame between two nodes.',
        isUnlocked: false,
      },
      {
        id: 'off_grid',
        category: 'ready',
        title: 'OFF-GRID',
        description: 'Operated HÕIMU node for over 1 hour purely offline.',
        isUnlocked: false,
      },
      {
        id: 'mesh_walk',
        category: 'explorer',
        title: 'MESH WALK',
        description: 'Carried a packet between disconnected mesh zones via Pathfinder.',
        isUnlocked: false,
      },
      {
        id: 'trusted_node',
        category: 'secure',
        title: 'TRUSTED',
        description: 'Completed cryptographic Ed25519 identity verification with a neighbor.',
        isUnlocked: false,
      },
      {
        id: 'keeper',
        category: 'secure',
        title: 'KEEPER',
        description: 'Secured node backup file to local filesystem.',
        isUnlocked: false,
      },
      {
        id: 'resource_shared',
        category: 'helpful',
        title: 'NEIGHBOR AID',
        description: 'Shared a resource or tool on the mutual aid exchange.',
        isUnlocked: false,
      },
    ];

    defaults.forEach((m) => this.milestones.set(m.id, m));
  }

  private load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: FieldcraftMilestone[] = JSON.parse(saved);
        parsed.forEach((m) => {
          if (this.milestones.has(m.id)) {
            this.milestones.set(m.id, { ...this.milestones.get(m.id)!, ...m });
          }
        });
      }
    } catch {
      // Ignore
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const arr = Array.from(this.milestones.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // Ignore
    }
  }

  public getMilestones(): FieldcraftMilestone[] {
    return Array.from(this.milestones.values());
  }

  public unlock(id: string, evidence?: string): boolean {
    const existing = this.milestones.get(id);
    if (existing && !existing.isUnlocked) {
      existing.isUnlocked = true;
      existing.unlockedAt = Date.now();
      if (evidence) existing.evidence = evidence;
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  public subscribe(listener: (list: FieldcraftMilestone[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getMilestones());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = this.getMilestones();
    this.listeners.forEach((fn) => fn(list));
  }

  /**
   * Evaluates current system state and generates a single concrete Field Spark action
   */
  public getActiveFieldSpark(state: {
    peerCount: number;
    hasIdentityBackup: boolean;
    isMapReady: boolean;
    batteryPercent: number;
  }): FieldSparkAction {
    if (!state.hasIdentityBackup) {
      return {
        id: 'spark_backup',
        title: 'Protect Your Node',
        subtitle: 'Your node identity is not backed up to a key file yet.',
        actionLabel: 'Create backup',
        actionCommand: 'backup',
      };
    }

    if (state.peerCount > 0) {
      return {
        id: 'spark_verify',
        title: 'Verify Your Nearest Peer',
        subtitle: 'Exchange cryptographic signatures with a nearby node.',
        actionLabel: 'Open Connect',
        actionTab: 'messages',
      };
    }

    if (state.isMapReady) {
      return {
        id: 'spark_map',
        title: 'Test Offline Navigation',
        subtitle: 'Tallinn vector basemap is ready for zero-cell field use.',
        actionLabel: 'Explore Map',
        actionTab: 'map',
      };
    }

    return {
      id: 'spark_ping',
      title: 'Send a Harmless Ping',
      subtitle: 'Broadcast a light RF beacon to test local link propagation.',
      actionLabel: 'Test mesh',
      actionTab: 'today',
    };
  }
}

export const fieldcraftService = FieldcraftService.getInstance();
