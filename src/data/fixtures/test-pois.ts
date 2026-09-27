/**
 * HÕIMU Test Fixture POIs (Development / Testing Only)
 * 
 * CRITICAL RULE:
 * Fixture data must be explicitly marked:
 * source: 'fixture'
 * provenanceStatus: 'simulated'
 * 
 * Never mix simulated fixtures into official production registry snapshots.
 */

import { MapPlace } from '../../types';

export interface FixturePoi extends MapPlace {
  source: 'fixture';
}

export const TEST_FIXTURE_POIS: FixturePoi[] = [
  {
    id: 'fix_bauhaus_lasna',
    name: 'Bauhaus Lasnamäe Hardware & Tools (Fixture)',
    mainCategory: 'tools',
    subCategory: 'hardware',
    source: 'fixture',
    provenanceStatus: 'fixture' as any,
    location: { lat: 59.4385, lng: 24.8450 },
    address: 'Tähesaju tee 8, Lasnamäe',
    openingHours: '07:00-20:00',
    description: '[SIMULATED FIXTURE] Hand tools, fasteners, electrical cable, off-grid materials.',
    tags: { tools: 'true', generator_parts: 'true' },
  },
  {
    id: 'fix_shelter_balti_jaam',
    name: 'Balti Jaam Civil Protection Shelter (Fixture)',
    mainCategory: 'safety',
    subCategory: 'shelter',
    source: 'fixture',
    provenanceStatus: 'fixture' as any,
    location: { lat: 59.4402, lng: 24.7375 },
    address: 'Toompuiestee 37, Kesklinn',
    description: '[SIMULATED FIXTURE] Designated reinforced public shelter.',
    tags: { emergency_shelter: 'true', capacity: '1200' },
  },
  {
    id: 'fix_water_kadriorg',
    name: 'Kadriorg Natural Water Spring (Fixture)',
    mainCategory: 'water',
    subCategory: 'spring',
    source: 'fixture',
    provenanceStatus: 'fixture' as any,
    location: { lat: 59.4390, lng: 24.7890 },
    address: 'Kadriorg Park, Kesklinn',
    description: '[SIMULATED FIXTURE] Tested potable groundwater spring.',
    tags: { potable_water: 'true' },
  }
];
