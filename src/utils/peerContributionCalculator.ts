import { MeshNode } from '../types';

export interface ContributionMetricPoint {
  key: string;
  metric: string;
  score: number; // 0 - 100
  rawValue: string | number;
  unit: string;
  description: string;
  iconName?: string;
  category: 'skills' | 'trades' | 'mesh' | 'trust' | 'relay';
}

export interface PeerContributionProfile {
  peerId: string;
  callsign: string;
  compositeContributionScore: number; // 0 - 100 weighted
  contributionTier: 'Emerging Contributor' | 'Active Steward' | 'Reliable Node' | 'Mesh Pillar' | 'Bioregional Anchor';
  tierColor: string;
  metrics: ContributionMetricPoint[];
  summaryText: string;
}

/**
 * Calculates normalized scores (0 - 100) for a peer's community contributions.
 */
export function calculatePeerContribution(peer: MeshNode): PeerContributionProfile {
  // 1. Verified Skills: diversity and count
  const skillCount = peer.skills?.length || 0;
  let skillsScore = Math.min(100, Math.round(skillCount * 22));
  if (skillCount >= 5) skillsScore = 100;
  else if (skillCount === 0) skillsScore = 15;

  // 2. Successful Trades: completed exchanges in the mutual aid network
  const exchanges = peer.completedExchanges || 0;
  let tradesScore = 0;
  if (exchanges >= 20) tradesScore = 100;
  else if (exchanges >= 12) tradesScore = 88;
  else if (exchanges >= 8) tradesScore = 75;
  else if (exchanges >= 4) tradesScore = 60;
  else if (exchanges >= 2) tradesScore = 45;
  else if (exchanges === 1) tradesScore = 30;
  else tradesScore = 15;

  // 3. Mesh Connectivity Reliability: packet delivery %, signal, hop stability
  const rawReliability = peer.relayReliability !== undefined ? peer.relayReliability : 90;
  const meshScore = Math.min(100, Math.max(10, Math.round(rawReliability)));

  // 4. Trust & Endorsements: trustScore & signed attestations
  const rawTrust = peer.trustScore !== undefined ? peer.trustScore : 80;
  const trustScore = Math.min(100, Math.max(0, Math.round(rawTrust)));

  // 5. Packet Relay Contribution: packets relayed for other off-grid neighbors
  const relayedPkts = peer.relayedPackets || Math.round(exchanges * 18 + rawReliability * 0.8 + (peer.isDirect ? 20 : 45));
  let relayScore = Math.min(100, Math.max(20, Math.round((relayedPkts / 180) * 100)));
  if (relayedPkts > 150) relayScore = 100;

  const metrics: ContributionMetricPoint[] = [
    {
      key: 'skills',
      metric: 'Verified Skills',
      score: skillsScore,
      rawValue: skillCount,
      unit: 'skills',
      description: `${skillCount} community-attested skills listed in bio-directory.`,
      category: 'skills',
    },
    {
      key: 'trades',
      metric: 'Successful Trades',
      score: tradesScore,
      rawValue: exchanges,
      unit: 'trades',
      description: `${exchanges} confirmed mutual aid resource exchanges completed.`,
      category: 'trades',
    },
    {
      key: 'reliability',
      metric: 'Mesh Reliability',
      score: meshScore,
      rawValue: `${rawReliability.toFixed(1)}%`,
      unit: '% uptime',
      description: `Observed packet delivery and connection stability.`,
      category: 'mesh',
    },
    {
      key: 'trust',
      metric: 'Trust & Endorsements',
      score: trustScore,
      rawValue: `${trustScore}/100`,
      unit: 'pts',
      description: `Cryptographic peer endorsements and zero-knowledge trust standing.`,
      category: 'trust',
    },
    {
      key: 'relay',
      metric: 'Packet Relay Volume',
      score: relayScore,
      rawValue: relayedPkts,
      unit: 'pkts',
      description: `Packets forwarded to extend the bioregional emergency mesh horizon.`,
      category: 'relay',
    },
  ];

  // Weighted composite contribution score
  // Trades: 25%, Skills: 25%, Mesh Reliability: 25%, Trust: 15%, Relay: 10%
  const compositeScore = Math.round(
    tradesScore * 0.25 +
    skillsScore * 0.25 +
    meshScore * 0.25 +
    trustScore * 0.15 +
    relayScore * 0.10
  );

  let contributionTier: PeerContributionProfile['contributionTier'] = 'Emerging Contributor';
  let tierColor = '#87A878';
  let summaryText = 'Actively participating in local mesh exchanges and packet forwarding.';

  if (compositeScore >= 88) {
    contributionTier = 'Bioregional Anchor';
    tierColor = '#2A9D8F';
    summaryText = 'Core community anchor with exemplary trades, high mesh relay uptime, and verified masteries.';
  } else if (compositeScore >= 75) {
    contributionTier = 'Mesh Pillar';
    tierColor = '#588157';
    summaryText = 'Highly dependable peer regularly sharing tools, skills, and routing neighborhood packets.';
  } else if (compositeScore >= 60) {
    contributionTier = 'Active Steward';
    tierColor = '#E9C46A';
    summaryText = 'Consistent trader and stable mesh node supporting nearby community neighbors.';
  } else if (compositeScore >= 40) {
    contributionTier = 'Reliable Node';
    tierColor = '#F4A261';
    summaryText = 'Established peer with verified skills and active packet relaying.';
  }

  return {
    peerId: peer.id,
    callsign: peer.callsign,
    compositeContributionScore: compositeScore,
    contributionTier,
    tierColor,
    metrics,
    summaryText,
  };
}
