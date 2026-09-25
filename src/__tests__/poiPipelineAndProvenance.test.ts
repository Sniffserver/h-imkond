import { describe, it, expect } from 'vitest';
import { buildCanonicalMapPlaces, RAW_AUTHORITATIVE_PLACES, RAW_OSM_PLACES, RAW_HOIMU_COMMUNITY_PLACES } from '../features/map/places/poiPipeline';

describe('HÕIMU Multi-Source POI Pipeline & Provenance', () => {
  it('combines authoritative state registries with OSM and mesh observations', () => {
    const places = buildCanonicalMapPlaces();
    expect(places.length).toBeGreaterThan(0);

    // Police stations exist under category 'safety' and subCategory 'police'
    const policeStations = places.filter((p) => p.mainCategory === 'safety' && p.subCategory === 'police');
    expect(policeStations.length).toBeGreaterThanOrEqual(3);

    // Shelters exist under category 'safety' and subCategory 'shelter'
    const shelters = places.filter((p) => p.mainCategory === 'safety' && p.subCategory === 'shelter');
    expect(shelters.length).toBeGreaterThanOrEqual(2);
  });

  it('detects and explicitly flags data mismatches between PPA registry and OSM', () => {
    const places = buildCanonicalMapPlaces();
    
    // Find Kesklinna police station which has parcel vs entrance discrepancy
    const kesklinnaPolice = places.find((p) => p.name.includes('Põhja Prefektuur (Kesklinna Jaoskond)'));
    expect(kesklinnaPolice).toBeDefined();
    expect(kesklinnaPolice?.source).toBe('ppa');
    expect(kesklinnaPolice?.secondarySource).toBe('osm');
    expect(kesklinnaPolice?.hasMismatch).toBe(true);
    expect(kesklinnaPolice?.provenanceStatus).toBe('mismatch');
    expect(kesklinnaPolice?.discrepancies).toBeDefined();
    expect(kesklinnaPolice?.discrepancies?.length).toBeGreaterThan(0);

    const addressDiscrepancy = kesklinnaPolice?.discrepancies?.find((d) => d.field.includes('Address'));
    expect(addressDiscrepancy).toBeDefined();
    expect(addressDiscrepancy?.valueA).toContain('Pärnu mnt 139');
    expect(addressDiscrepancy?.valueB).toContain('Pärnu mnt 139a');
  });

  it('preserves community observation status without converting observed to official', () => {
    const places = buildCanonicalMapPlaces();
    
    const telliskiviTools = places.find((p) => p.name.includes('Telliskivi Mutual Aid Tool Library'));
    expect(telliskiviTools).toBeDefined();
    expect(telliskiviTools?.source).toBe('hoimu');
    expect(telliskiviTools?.provenanceStatus).toBe('community');
    expect(telliskiviTools?.observedByNodes).toBe(3);
    expect(telliskiviTools?.lastConfirmed).toContain('Yesterday');
  });
});
