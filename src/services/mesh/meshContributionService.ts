import { UserProfile, MeshNode, MeshLeaderboardNode } from '../../types';

const STORAGE_KEY = 'hoimu_mesh_contribution_data_v1';

export type ContributionTimeRange = 'all' | 'epoch' | 'today';
export type ContributionSortMetric = 'packets' | 'reliability' | 'symbiosis';

interface UserRelayData {
  relayedPackets: number;
  relayReliability: number;
  packetDeliveryRatio: number;
  airtimeMinutes: number;
  weeklyRelayHistory: number[];
  lastRelayTimestamp: number;
  recentPacketTypes: { type: string; count: number; iconName?: string }[];
}

const DEFAULT_USER_RELAY_DATA: UserRelayData = {
  relayedPackets: 486,
  relayReliability: 98.4,
  packetDeliveryRatio: 98.8,
  airtimeMinutes: 242,
  weeklyRelayHistory: [52, 64, 71, 59, 83, 75, 82],
  lastRelayTimestamp: Date.now() - 1000 * 60 * 4,
  recentPacketTypes: [
    { type: 'CRDT State Sync', count: 184, iconName: 'Layers' },
    { type: 'Encrypted Peer DM', count: 138, iconName: 'MessageSquare' },
    { type: 'Mutual Aid Bloom', count: 96, iconName: 'Sprout' },
    { type: 'SOS / Crisis Relay', count: 42, iconName: 'ShieldAlert' },
    { type: 'Time-bank Proof', count: 26, iconName: 'CheckCircle2' },
  ],
};

// Realistic mock mesh contribution data for community nodes
const INITIAL_PEER_CONTRIBUTIONS: Record<string, Partial<MeshLeaderboardNode>> = {
  peer_fern_weaver: {
    id: 'peer_fern_weaver',
    callsign: 'Fern-Weaver',
    avatarSeed: 'fern-weaver-bio-94',
    relayedPackets: 712,
    relayReliability: 99.4,
    packetDeliveryRatio: 99.1,
    airtimeMinutes: 380,
    primaryMedium: 'BLE 5.0 Coded',
    tierTitle: 'Master Sentinel Hub',
    tierBadgeColor: 'bg-[#E9C46A]/20 text-[#B8860B] border-[#E9C46A]/40 dark:text-[#E9C46A]',
    symbiosisRewardPoints: 95,
    weeklyRelayHistory: [88, 94, 102, 110, 98, 108, 112],
    uptimePercentage: 99.8,
    solarPowered: true,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 290 },
      { type: 'Mutual Aid Bloom', count: 185 },
      { type: 'Encrypted Peer DM', count: 162 },
      { type: 'SOS / Crisis Relay', count: 75 },
    ],
  },
  peer_sol_spark: {
    id: 'peer_sol_spark',
    callsign: 'Sol-Spark',
    avatarSeed: 'sol-spark-pv-88',
    relayedPackets: 594,
    relayReliability: 98.9,
    packetDeliveryRatio: 98.2,
    airtimeMinutes: 310,
    primaryMedium: 'LoRa 868MHz',
    tierTitle: 'Solar Backbone Node',
    tierBadgeColor: 'bg-[#588157]/20 text-[#344E2C] border-[#588157]/40 dark:text-[#87A878]',
    symbiosisRewardPoints: 78,
    weeklyRelayHistory: [70, 78, 85, 92, 88, 91, 90],
    uptimePercentage: 99.2,
    solarPowered: true,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 220 },
      { type: 'Encrypted Peer DM', count: 180 },
      { type: 'Mutual Aid Bloom', count: 134 },
      { type: 'SOS / Crisis Relay', count: 60 },
    ],
  },
  peer_moss_whisper: {
    id: 'peer_moss_whisper',
    callsign: 'Moss-Whisper',
    avatarSeed: 'moss-whisper-hydro-92',
    relayedPackets: 432,
    relayReliability: 98.1,
    packetDeliveryRatio: 97.6,
    airtimeMinutes: 215,
    primaryMedium: 'BLE 5.0 Coded',
    tierTitle: 'Guardian Conduit',
    tierBadgeColor: 'bg-[#2A9D8F]/20 text-[#165B53] border-[#2A9D8F]/40 dark:text-[#2A9D8F]',
    symbiosisRewardPoints: 58,
    weeklyRelayHistory: [50, 56, 62, 68, 60, 65, 71],
    uptimePercentage: 98.5,
    solarPowered: true,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 160 },
      { type: 'Mutual Aid Bloom', count: 140 },
      { type: 'Encrypted Peer DM', count: 98 },
      { type: 'SOS / Crisis Relay', count: 34 },
    ],
  },
  peer_river_oak: {
    id: 'peer_river_oak',
    callsign: 'River-Oak',
    avatarSeed: 'river-oak-wood-76',
    relayedPackets: 328,
    relayReliability: 94.6,
    packetDeliveryRatio: 93.8,
    airtimeMinutes: 165,
    primaryMedium: 'Wi-Fi Direct P2P',
    tierTitle: 'Trusted Forwarder',
    tierBadgeColor: 'bg-[#87A878]/20 text-[#203A2A] border-[#87A878]/40 dark:text-[#A8BDA5]',
    symbiosisRewardPoints: 44,
    weeklyRelayHistory: [35, 42, 48, 50, 46, 52, 55],
    uptimePercentage: 95.0,
    solarPowered: false,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 120 },
      { type: 'Encrypted Peer DM', count: 110 },
      { type: 'Mutual Aid Bloom', count: 72 },
      { type: 'SOS / Crisis Relay', count: 26 },
    ],
  },
  peer_clay_root: {
    id: 'peer_clay_root',
    callsign: 'Clay-Root',
    avatarSeed: 'clay-root-terracotta-68',
    relayedPackets: 216,
    relayReliability: 92.4,
    packetDeliveryRatio: 91.5,
    airtimeMinutes: 115,
    primaryMedium: 'BLE 5.0 Coded',
    tierTitle: 'Community Relay',
    tierBadgeColor: 'bg-[#E76F51]/15 text-[#9A3822] border-[#E76F51]/30 dark:text-[#E76F51]',
    symbiosisRewardPoints: 29,
    weeklyRelayHistory: [20, 25, 30, 32, 34, 36, 39],
    uptimePercentage: 91.2,
    solarPowered: false,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 80 },
      { type: 'Encrypted Peer DM', count: 76 },
      { type: 'Mutual Aid Bloom', count: 42 },
      { type: 'SOS / Crisis Relay', count: 18 },
    ],
  },
  peer_spore_walker: {
    id: 'peer_spore_walker',
    callsign: 'Spore-Walker',
    avatarSeed: 'spore-walker-fungi-52',
    relayedPackets: 148,
    relayReliability: 89.2,
    packetDeliveryRatio: 88.0,
    airtimeMinutes: 75,
    primaryMedium: 'BLE 5.0 Coded',
    tierTitle: 'Trail Scout Repeater',
    tierBadgeColor: 'bg-[#637062]/20 text-[#637062] border-[#637062]/30 dark:text-[#A8BDA5]',
    symbiosisRewardPoints: 19,
    weeklyRelayHistory: [12, 16, 20, 22, 24, 26, 28],
    uptimePercentage: 87.5,
    solarPowered: false,
    recentPacketTypes: [
      { type: 'CRDT State Sync', count: 54 },
      { type: 'Encrypted Peer DM', count: 48 },
      { type: 'Mutual Aid Bloom', count: 32 },
      { type: 'SOS / Crisis Relay', count: 14 },
    ],
  },
};

type Listener = (leaderboard: MeshLeaderboardNode[]) => void;

class MeshContributionService {
  private userData: UserRelayData;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.userData = this.loadUserData();
  }

  private loadUserData(): UserRelayData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_USER_RELAY_DATA, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_USER_RELAY_DATA };
  }

  private saveUserData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userData));
    } catch {
      // ignore
    }
  }

  public getUserRelayData(): UserRelayData {
    return { ...this.userData };
  }

  public getLeaderboard(
    user: UserProfile,
    peers: MeshNode[] = [],
    timeRange: ContributionTimeRange = 'all',
    sortBy: ContributionSortMetric = 'packets'
  ): MeshLeaderboardNode[] {
    const timeScale = timeRange === 'today' ? 0.15 : timeRange === 'epoch' ? 0.45 : 1.0;

    // Build Current User Leaderboard entry
    const userRelayed = Math.max(1, Math.round((user.relayedPackets || this.userData.relayedPackets) * timeScale));
    const userReliability = user.relayReliability || this.userData.relayReliability;
    const userRewardPts = Math.round(userRelayed * 0.13 + (userReliability >= 98 ? 15 : 5));

    let userTierTitle = 'Beacon Sentinel';
    let userTierColor = 'bg-[#2A9D8F]/20 text-[#165B53] border-[#2A9D8F]/40 dark:text-[#2A9D8F]';
    if (userReliability >= 99 && userRelayed >= 500) {
      userTierTitle = 'Master Sentinel Hub';
      userTierColor = 'bg-[#E9C46A]/20 text-[#B8860B] border-[#E9C46A]/40 dark:text-[#E9C46A]';
    } else if (userReliability >= 98) {
      userTierTitle = 'Solar Backbone Node';
      userTierColor = 'bg-[#588157]/20 text-[#344E2C] border-[#588157]/40 dark:text-[#87A878]';
    } else if (userReliability >= 95) {
      userTierTitle = 'Guardian Conduit';
      userTierColor = 'bg-[#2A9D8F]/20 text-[#165B53] border-[#2A9D8F]/40 dark:text-[#2A9D8F]';
    }

    const currentUserEntry: MeshLeaderboardNode = {
      id: user.id || 'usr_kestrel_7',
      callsign: user.callsign || 'Kestrel-7',
      bio: user.bio || 'Community Mesh Operator',
      avatarSeed: user.avatarSeed || 'kestrel-7-solarpunk',
      isCurrentUser: true,
      relayedPackets: userRelayed,
      relayReliability: userReliability,
      packetDeliveryRatio: this.userData.packetDeliveryRatio,
      airtimeMinutes: Math.round(this.userData.airtimeMinutes * timeScale),
      primaryMedium: 'LoRa 868MHz',
      tierTitle: userTierTitle,
      tierBadgeColor: userTierColor,
      symbiosisRewardPoints: userRewardPts,
      recentPacketTypes: this.userData.recentPacketTypes.map((p) => ({
        ...p,
        count: Math.max(1, Math.round(p.count * timeScale)),
      })),
      weeklyRelayHistory: this.userData.weeklyRelayHistory,
      uptimePercentage: 99.4,
      solarPowered: true,
    };

    // Combine with peers
    const allPeerMap = new Map<string, MeshLeaderboardNode>();

    Object.entries(INITIAL_PEER_CONTRIBUTIONS).forEach(([id, preset]) => {
      const scaledRelayed = Math.max(1, Math.round((preset.relayedPackets || 200) * timeScale));
      const peerNode: MeshLeaderboardNode = {
        id,
        callsign: preset.callsign || 'Peer Node',
        bio: preset.bio || 'Solarpunk mesh relay partner',
        avatarSeed: preset.avatarSeed || id,
        isCurrentUser: false,
        relayedPackets: scaledRelayed,
        relayReliability: preset.relayReliability || 95.0,
        packetDeliveryRatio: preset.packetDeliveryRatio || 94.0,
        airtimeMinutes: Math.round((preset.airtimeMinutes || 120) * timeScale),
        primaryMedium: preset.primaryMedium || 'BLE 5.0 Coded',
        tierTitle: preset.tierTitle || 'Community Node',
        tierBadgeColor: preset.tierBadgeColor || 'bg-[#87A878]/20 text-[#203A2A]',
        symbiosisRewardPoints: Math.round((preset.symbiosisRewardPoints || 30) * timeScale),
        recentPacketTypes: (preset.recentPacketTypes || []).map((p) => ({
          ...p,
          count: Math.max(1, Math.round(p.count * timeScale)),
        })),
        weeklyRelayHistory: preset.weeklyRelayHistory || [20, 25, 30, 35, 40, 45, 50],
        uptimePercentage: preset.uptimePercentage || 95.0,
        solarPowered: !!preset.solarPowered,
      };
      allPeerMap.set(id, peerNode);
    });

    // Check if any new dynamic peers were discovered
    peers.forEach((p) => {
      if (!allPeerMap.has(p.id)) {
        const estPackets = Math.max(
          50,
          Math.round((p.trustScore * 4 + p.completedExchanges * 6) * timeScale)
        );
        allPeerMap.set(p.id, {
          id: p.id,
          callsign: p.callsign,
          bio: p.bio,
          avatarSeed: p.avatarSeed || p.id,
          isCurrentUser: false,
          relayedPackets: estPackets,
          relayReliability: p.relayReliability || 95.0,
          packetDeliveryRatio: Math.max(90, Math.min(99.9, p.relayReliability - 0.4)),
          airtimeMinutes: Math.round(estPackets * 0.5),
          primaryMedium: p.radioType === 'Wi-Fi Direct' ? 'Wi-Fi Direct P2P' : 'BLE 5.0 Coded',
          tierTitle: p.relayReliability >= 98 ? 'Solar Backbone Node' : 'Trusted Forwarder',
          tierBadgeColor:
            p.relayReliability >= 98
              ? 'bg-[#588157]/20 text-[#344E2C] border-[#588157]/40 dark:text-[#87A878]'
              : 'bg-[#87A878]/20 text-[#203A2A] border-[#87A878]/40 dark:text-[#A8BDA5]',
          symbiosisRewardPoints: Math.round(estPackets * 0.12),
          recentPacketTypes: [
            { type: 'CRDT State Sync', count: Math.round(estPackets * 0.4) },
            { type: 'Encrypted Peer DM', count: Math.round(estPackets * 0.3) },
            { type: 'Mutual Aid Bloom', count: Math.round(estPackets * 0.2) },
            { type: 'SOS / Crisis Relay', count: Math.round(estPackets * 0.1) },
          ],
          weeklyRelayHistory: [20, 24, 28, 30, 32, 34, 38],
          uptimePercentage: 96.2,
          solarPowered: p.relayReliability > 97,
        });
      }
    });

    const combinedList = [currentUserEntry, ...Array.from(allPeerMap.values())];

    // Sort accordingly
    combinedList.sort((a, b) => {
      if (sortBy === 'packets') {
        return b.relayedPackets - a.relayedPackets;
      }
      if (sortBy === 'reliability') {
        if (b.relayReliability === a.relayReliability) {
          return b.relayedPackets - a.relayedPackets;
        }
        return b.relayReliability - a.relayReliability;
      }
      if (sortBy === 'symbiosis') {
        return b.symbiosisRewardPoints - a.symbiosisRewardPoints;
      }
      return b.relayedPackets - a.relayedPackets;
    });

    // Assign rank
    return combinedList.map((node, index) => ({
      ...node,
      rank: index + 1,
    }));
  }

  /**
   * Simulates forwarding community packets through the local node,
   * rewarding the user with reliability points & symbiosis score.
   */
  public simulateRelayPacket(
    packetCount: number = 3,
    packetType: string = 'CRDT State Sync',
    sourceCallsign: string = 'Fern-Weaver'
  ): {
    success: boolean;
    packetsRelayed: number;
    newTotal: number;
    newReliability: number;
    symbiosisPointsEarned: number;
    sourceCallsign: string;
    packetType: string;
  } {
    this.userData.relayedPackets += packetCount;
    this.userData.airtimeMinutes += Math.round(packetCount * 0.4);
    this.userData.lastRelayTimestamp = Date.now();

    // Slightly refine reliability towards 99.5% with successful relays
    const currentReliability = this.userData.relayReliability;
    this.userData.relayReliability = Number(
      Math.min(99.9, currentReliability + 0.04 * packetCount).toFixed(1)
    );
    this.userData.packetDeliveryRatio = Number(
      Math.min(99.8, this.userData.packetDeliveryRatio + 0.03 * packetCount).toFixed(1)
    );

    // Update recent packet types
    const foundType = this.userData.recentPacketTypes.find((p) => p.type === packetType);
    if (foundType) {
      foundType.count += packetCount;
    } else {
      this.userData.recentPacketTypes.unshift({
        type: packetType,
        count: packetCount,
        iconName: 'Layers',
      });
    }

    // Update today's weekly history bucket (last element)
    if (this.userData.weeklyRelayHistory.length > 0) {
      this.userData.weeklyRelayHistory[this.userData.weeklyRelayHistory.length - 1] += packetCount;
    }

    this.saveUserData();
    this.notifyListeners();

    const symbiosisPointsEarned = Math.max(1, Math.round(packetCount * 0.8));

    return {
      success: true,
      packetsRelayed: packetCount,
      newTotal: this.userData.relayedPackets,
      newReliability: this.userData.relayReliability,
      symbiosisPointsEarned,
      sourceCallsign,
      packetType,
    };
  }

  public resetContributions(): void {
    this.userData = { ...DEFAULT_USER_RELAY_DATA };
    this.saveUserData();
    this.notifyListeners();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn([]));
  }
}

export const meshContributionService = new MeshContributionService();
