/**
 * HÕIMU Golden Route Corpus (Release Gate Validation)
 * 
 * Verifies real pedestrian navigability across all key Tallinn district pairs.
 * Evaluates:
 * - Reachability
 * - Path geometry validity (consecutive distance bounds, no teleportation)
 * - Plausible distance & duration
 * - Graph containment
 * - Accessibility constraints (wheelchair avoiding stairs)
 */

export interface GoldenRoutePair {
  id: string;
  name: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  expectedMinDistanceMeters: number;
  expectedMaxDistanceMeters: number;
  expectedMinSteps: number;
  allowStairs?: boolean;
}

export const GOLDEN_ROUTE_CORPUS: GoldenRoutePair[] = [
  {
    id: 'raekoja_to_vabaduse',
    name: 'Raekoja plats → Vabaduse väljak',
    from: { name: 'Raekoja plats', lat: 59.4374, lng: 24.7452 },
    to: { name: 'Vabaduse väljak', lat: 59.4345, lng: 24.7445 },
    expectedMinDistanceMeters: 250,
    expectedMaxDistanceMeters: 900,
    expectedMinSteps: 2,
    allowStairs: false,
  },
  {
    id: 'kalamaja_to_vanalinn',
    name: 'Kalamaja → Vanalinn',
    from: { name: 'Vana-Kalamaja', lat: 59.4465, lng: 24.7310 },
    to: { name: 'Raekoja plats', lat: 59.4374, lng: 24.7452 },
    expectedMinDistanceMeters: 700,
    expectedMaxDistanceMeters: 2800,
    expectedMinSteps: 3,
    allowStairs: false,
  },
  {
    id: 'baltijaam_to_noblessner',
    name: 'Balti Jaam → Noblessner',
    from: { name: 'Balti Jaam', lat: 59.4405, lng: 24.7375 },
    to: { name: 'Noblessner', lat: 59.4525, lng: 24.7250 },
    expectedMinDistanceMeters: 1000,
    expectedMaxDistanceMeters: 3500,
    expectedMinSteps: 3,
    allowStairs: false,
  },
  {
    id: 'kadriorg_to_pirita',
    name: 'Kadriorg → Pirita',
    from: { name: 'Kadriorg Park (Poska)', lat: 59.4402, lng: 24.7761 },
    to: { name: 'Pirita Sild', lat: 59.4680, lng: 24.8320 },
    expectedMinDistanceMeters: 2500,
    expectedMaxDistanceMeters: 7500,
    expectedMinSteps: 3,
    allowStairs: false,
  },
  {
    id: 'mustamae_to_kesklinn',
    name: 'Mustamäe → Kesklinn',
    from: { name: 'Mustamäe Magistral', lat: 59.4010, lng: 24.6850 },
    to: { name: 'Vabaduse väljak', lat: 59.4345, lng: 24.7445 },
    expectedMinDistanceMeters: 3000,
    expectedMaxDistanceMeters: 9000,
    expectedMinSteps: 3,
    allowStairs: false,
  },
  {
    id: 'nomme_to_mustamae',
    name: 'Nõmme → Mustamäe',
    from: { name: 'Nõmme Turg', lat: 59.3900, lng: 24.6650 },
    to: { name: 'Männi Park', lat: 59.4020, lng: 24.6780 },
    expectedMinDistanceMeters: 800,
    expectedMaxDistanceMeters: 3500,
    expectedMinSteps: 2,
    allowStairs: false,
  },
  {
    id: 'lasnamae_to_kadriorg',
    name: 'Lasnamäe → Kadriorg',
    from: { name: 'Pae Park', lat: 59.4320, lng: 24.8120 },
    to: { name: 'KUMU / Kadriorg', lat: 59.4380, lng: 24.7950 },
    expectedMinDistanceMeters: 800,
    expectedMaxDistanceMeters: 3000,
    expectedMinSteps: 2,
    allowStairs: true,
  },
];
