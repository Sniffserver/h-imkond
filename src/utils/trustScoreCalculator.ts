/**
 * Trust Score Calculation Engine for HÕIMU Decentralized Mesh
 *
 * Computes a verifiable 0-100 Trust Score derived from:
 * 1. Number of successful mutual-aid resource exchanges (Weight: up to 45 pts)
 * 2. Cryptographic peer endorsements (Weight: up to 25 pts)
 * 3. Base network discovery trust (Baseline: 30 pts)
 */

export interface TrustScoreDetails {
  score: number; // 0 to 100
  baseScore: number; // 30
  exchangeScore: number; // 0 to 45
  endorsementScore: number; // 0 to 25
  exchangesCount: number;
  endorsementsCount: number;
  tier: 'Sovereign Steward' | 'Verified Partner' | 'Active Kin' | 'Emerging Peer' | 'New Kin';
  tierLabel: string;
  tierDescription: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  nightBadgeBg: string;
  nightBadgeBorder: string;
  nightBadgeText: string;
}

export function calculateTrustScore(
  completedExchanges: number = 0,
  endorsementsCount?: number
): TrustScoreDetails {
  const safeExchanges = Math.max(0, Math.round(completedExchanges || 0));

  // If endorsementsCount is not explicitly defined, derive reasonable baseline from exchange history
  const safeEndorsements = Math.max(
    0,
    endorsementsCount !== undefined
      ? Math.round(endorsementsCount)
      : safeExchanges >= 30
      ? Math.round(safeExchanges * 0.3)
      : safeExchanges >= 10
      ? Math.max(2, Math.round(safeExchanges * 0.35))
      : safeExchanges >= 1
      ? 1
      : 0
  );

  // Baseline mesh presence: 30 pts
  const baseScore = 30;

  // Resource exchanges: 1.25 pts per exchange, capped at 45 pts
  const exchangeScore = Math.min(45, Math.round(safeExchanges * 1.25));

  // Endorsements: 2.5 pts per endorsement, capped at 25 pts
  const endorsementScore = Math.min(25, Math.round(safeEndorsements * 2.5));

  // Total clamped between 10 and 100
  const score = Math.min(100, Math.max(10, baseScore + exchangeScore + endorsementScore));

  if (score >= 90) {
    return {
      score,
      baseScore,
      exchangeScore,
      endorsementScore,
      exchangesCount: safeExchanges,
      endorsementsCount: safeEndorsements,
      tier: 'Sovereign Steward',
      tierLabel: 'Steward',
      tierDescription: 'Exceptional community trust, high-frequency verified exchanges, and extensive mutual endorsements.',
      accentColor: '#588157',
      badgeBg: 'bg-[#EFF5EC]',
      badgeBorder: 'border-[#588157]/50',
      badgeText: 'text-[#2D5A27]',
      nightBadgeBg: 'bg-[#182B18]',
      nightBadgeBorder: 'border-[#588157]/60',
      nightBadgeText: 'text-[#87D07B]',
    };
  }

  if (score >= 75) {
    return {
      score,
      baseScore,
      exchangeScore,
      endorsementScore,
      exchangesCount: safeExchanges,
      endorsementsCount: safeEndorsements,
      tier: 'Verified Partner',
      tierLabel: 'Verified',
      tierDescription: 'Solid mutual-aid track record with multiple verified trades and peer endorsements.',
      accentColor: '#2A9D8F',
      badgeBg: 'bg-[#EBF7F5]',
      badgeBorder: 'border-[#2A9D8F]/50',
      badgeText: 'text-[#165B53]',
      nightBadgeBg: 'bg-[#112926]',
      nightBadgeBorder: 'border-[#2A9D8F]/60',
      nightBadgeText: 'text-[#5CD2C3]',
    };
  }

  if (score >= 55) {
    return {
      score,
      baseScore,
      exchangeScore,
      endorsementScore,
      exchangesCount: safeExchanges,
      endorsementsCount: safeEndorsements,
      tier: 'Active Kin',
      tierLabel: 'Active',
      tierDescription: 'Regular contributor to local mesh exchanges with verified peer attestations.',
      accentColor: '#E9C46A',
      badgeBg: 'bg-[#FDF6E2]',
      badgeBorder: 'border-[#E9C46A]/60',
      badgeText: 'text-[#8C6207]',
      nightBadgeBg: 'bg-[#2E2410]',
      nightBadgeBorder: 'border-[#E9C46A]/60',
      nightBadgeText: 'text-[#F3D78A]',
    };
  }

  if (score >= 40) {
    return {
      score,
      baseScore,
      exchangeScore,
      endorsementScore,
      exchangesCount: safeExchanges,
      endorsementsCount: safeEndorsements,
      tier: 'Emerging Peer',
      tierLabel: 'Emerging',
      tierDescription: 'Initial mutual-aid exchanges recorded; building local barter rapport.',
      accentColor: '#87A878',
      badgeBg: 'bg-[#F4F7F2]',
      badgeBorder: 'border-[#87A878]/60',
      badgeText: 'text-[#476043]',
      nightBadgeBg: 'bg-[#1B261A]',
      nightBadgeBorder: 'border-[#87A878]/50',
      nightBadgeText: 'text-[#A4C49F]',
    };
  }

  return {
    score,
    baseScore,
    exchangeScore,
    endorsementScore,
    exchangesCount: safeExchanges,
    endorsementsCount: safeEndorsements,
    tier: 'New Kin',
    tierLabel: 'New Kin',
    tierDescription: 'Recently connected RF node. Baseline discovery trust without completed exchanges yet.',
    accentColor: '#737871',
    badgeBg: 'bg-[#F9F9F8]',
    badgeBorder: 'border-[#D1D5CB]',
    badgeText: 'text-[#737871]',
    nightBadgeBg: 'bg-[#212620]',
    nightBadgeBorder: 'border-[#3D473B]',
    nightBadgeText: 'text-[#9AA297]',
  };
}
