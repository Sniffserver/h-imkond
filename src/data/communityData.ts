import {
  CalendarEvent,
  SkillExchangeItem,
  TrustEndorsement,
  CrisisAlert,
  WishlistItem,
  DaoProposal,
  CryptoIdentity,
} from '../types';

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Solar PV & Battery Buffer Wiring Masterclass',
    description: 'Learn hands-on crimping, fuses, charge controllers & battery wire sizing for off-grid cabins.',
    category: 'Workshop',
    date: '2026-09-06',
    time: '14:00 - 17:00',
    location: 'River Crossing Common Hub',
    organizerCallsign: 'Cascadia-Node-44',
    attendeesCount: 8,
    maxCapacity: 15,
    isUserAttending: true,
  },
  {
    id: 'evt-2',
    title: 'Heritage Apple & Pear Orchards Pruning Talgud',
    description: 'Communal workday to restore old trees and collect grafting wood for spring nursery stock.',
    category: 'Workday',
    date: '2026-09-10',
    time: '09:00 - 13:00',
    location: 'Ridge Trailhead Orchards',
    organizerCallsign: 'Cedar-Steward',
    attendeesCount: 12,
    maxCapacity: 20,
    isUserAttending: false,
  },
];

export const INITIAL_SKILLS: SkillExchangeItem[] = [
  {
    id: 'sk-1',
    title: 'Õpetan päikesepaneelide paigaldamist & akupanga hooldust',
    description: 'Practical training on solar array angles, MPPT charge controllers, and LiFePO4 battery cell balancing.',
    type: 'offer',
    category: 'Energy & Solar',
    providerCallsign: 'Cascadia-Node-44',
    experienceLevel: 'Master Practitioner',
    locationNote: 'River Crossing Hub',
    availabilityText: 'Saturdays 14:00',
    createdAt: Date.now() - 86400000,
    endorsementsCount: 14,
  },
  {
    id: 'sk-2',
    title: 'Looking for Mentor: Meshtastic & BLE Antenna Tuning',
    description: 'Seeking guidance on tuning 868MHz/915MHz Yagi antennas using NanoVNA analyzers.',
    type: 'request',
    category: 'Electronics',
    providerCallsign: 'Spruce-Relay',
    experienceLevel: 'Beginner Friendly',
    locationNote: 'South Bridge Relay',
    availabilityText: 'Flexible evenings',
    createdAt: Date.now() - 43200000,
    endorsementsCount: 6,
  },
];

export const INITIAL_ENDORSEMENTS: TrustEndorsement[] = [
  {
    id: 'end-1',
    transactionId: 'tx-001',
    endorserCallsign: 'Cascadia-Node-44',
    recipientCallsign: 'Cedar-Steward',
    signatureHash: 'SHA256: e8a91f...90a42d',
    comment: 'Verified genuine heritage seed exchange. Prompt relay and exceptional seed viability.',
    timestamp: Date.now() - 172800000,
    reputationBonus: 15,
  },
];

export const INITIAL_CRISIS_ALERTS: CrisisAlert[] = [];

export const INITIAL_WISHLIST: WishlistItem[] = [
  {
    id: 'w-1',
    keyword: 'solar',
    category: 'Energy',
    createdAt: Date.now() - 86400000,
    isActive: true,
  },
  {
    id: 'w-2',
    keyword: 'seeds',
    category: 'Food',
    createdAt: Date.now() - 43200000,
    isActive: true,
  },
  {
    id: 'w-3',
    keyword: 'first aid',
    category: 'Bio-Remedy',
    createdAt: Date.now() - 21600000,
    isActive: true,
  },
];

export const INITIAL_DAO_PROPOSALS: DaoProposal[] = [
  {
    id: 'prop-1',
    title: 'Deploy 100W Ridge Node Solar & BLE Relay Buffer',
    description:
      'Install a weatherized 100W monocrystalline solar panel and battery buffer at Ridge Trailhead Node 02 to enhance mesh packet routing reliability across Cascadia 44N.',
    category: 'Infrastructure',
    authorCallsign: 'Cascadia-Node-44',
    votesYes: 485,
    votesNo: 32,
    votesAbstain: 15,
    status: 'active',
    endsAt: Date.now() + 604800000,
    symbiosisReward: 15,
    requiredQuorum: 300,
  },
  {
    id: 'prop-2',
    title: 'Establish Communal Heritage Seed Vault at River Crossing',
    description:
      'Allocate a moisture-sealed physical storage locker for drought-resistant heritage seeds open to all verified bioregional stewards.',
    category: 'Ecological',
    authorCallsign: 'Cedar-Steward',
    votesYes: 612,
    votesNo: 18,
    votesAbstain: 8,
    status: 'active',
    endsAt: Date.now() + 1209600000,
    symbiosisReward: 15,
    requiredQuorum: 400,
  },
  {
    id: 'prop-3',
    title: 'Deploy High-Gain BLE Mesh Relay at South Bridge',
    description:
      'Erect a directional 12dBi antenna array to bridge the 1.2km river gap during storm outages.',
    category: 'Infrastructure',
    authorCallsign: 'Spruce-Relay',
    votesYes: 340,
    votesNo: 85,
    votesAbstain: 22,
    status: 'active',
    endsAt: Date.now() + 432000000,
    symbiosisReward: 15,
    requiredQuorum: 250,
  },
];

export const INITIAL_CRYPTO_IDENTITY: CryptoIdentity = {
  publicKey: 'ed25519:e8a91f4b82...90a42d',
  algorithm: 'Ed25519',
  createdAt: Date.now(),
};
