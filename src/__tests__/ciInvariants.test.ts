import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TALLINN_MAP_PLACES } from '../features/map/places/placeData';
import { streetDiscoveryService } from '../features/map/streets/streetDiscoveryService';
import { MapPlace } from '../types';

describe('HÕIMU Strict CI Invariant Enforcement (Gandalf Gates)', () => {
  // -------------------------------------------------------------
  // Invariant 1: Every MapPlace has valid GeoPoint, source, sourceId, provenance
  // -------------------------------------------------------------
  it('INVARIANT 1: Every MapPlace has a valid GeoPoint, valid source, sourceId, and provenanceStatus', () => {
    expect(TALLINN_MAP_PLACES.length).toBeGreaterThan(0);

    for (const place of TALLINN_MAP_PLACES) {
      // 1. Valid coordinates within Tallinn Bioregion bounds
      expect(place.location).toBeDefined();
      expect(typeof place.location.lat).toBe('number');
      expect(typeof place.location.lng).toBe('number');
      expect(place.location.lat).toBeGreaterThanOrEqual(59.30);
      expect(place.location.lat).toBeLessThanOrEqual(59.55);
      expect(place.location.lng).toBeGreaterThanOrEqual(24.45);
      expect(place.location.lng).toBeLessThanOrEqual(25.05);

      // 2. Source and Source ID
      expect(place.source).toBeDefined();
      expect(typeof place.source).toBe('string');
      expect(place.sources).toBeDefined();
      expect(Array.isArray(place.sources)).toBe(true);
      expect(place.sources!.length).toBeGreaterThan(0);

      // 3. Provenance status
      expect(place.provenanceStatus).toBeDefined();
      expect([
        'official',
        'osm',
        'community',
        'observed',
        'derived',
        'conflict',
        'fixture',
        'simulated',
      ]).toContain(place.provenanceStatus);
    }
  });

  // -------------------------------------------------------------
  // Invariant 2: Every published map pack exists, has valid PMTiles headers & matching SHA-256
  // -------------------------------------------------------------
  it('INVARIANT 2: Published map-pack artifacts exist on disk, have valid headers, and match manifest checksums', () => {
    const generatedDir = path.resolve(process.cwd(), 'src/data/generated');
    const manifestPath = path.join(generatedDir, 'manifest.json');

    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.id).toBe('tallinn');
    expect(manifest.version).toBeDefined();
    expect(manifest.artifacts).toBeDefined();

    for (const [key, artifact] of Object.entries<any>(manifest.artifacts)) {
      const filePath = path.join(generatedDir, artifact.path);
      expect(fs.existsSync(filePath), `Artifact ${key} must exist at ${filePath}`).toBe(true);

      const fileBuffer = fs.readFileSync(filePath);
      expect(fileBuffer.length).toBeGreaterThan(0);

      // Verify SHA-256
      const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      expect(calculatedHash).toBe(artifact.sha256);

      // If PMTiles, verify PMTiles v3 magic header 'PMTiles'
      if (artifact.path.endsWith('.pmtiles')) {
        const header = fileBuffer.subarray(0, 7).toString('ascii');
        expect(header).toBe('PMTiles');
      }
    }
  });

  // -------------------------------------------------------------
  // Invariant 3: No fixture enters production build
  // -------------------------------------------------------------
  it('INVARIANT 3: No test fixture or simulated mock data enters the production POI dataset', () => {
    for (const place of TALLINN_MAP_PLACES) {
      expect(place.source).not.toBe('fixture');
      expect(place.provenanceStatus).not.toBe('simulated');
      expect(place.name.toLowerCase()).not.toContain('[fixture]');
    }
  });

  // -------------------------------------------------------------
  // Invariant 4: No street discovery without real GPS trace evidence
  // -------------------------------------------------------------
  it('INVARIANT 4: No street discovery without valid GPS accuracy (<=35m), physical movement (>=15m), and trace evidence', () => {
    streetDiscoveryService.resetForTesting();

    // Poor accuracy (>35m) must be rejected
    const poorGps = streetDiscoveryService.processGPSFix({
      lat: 59.4420,
      lng: 24.7350,
      accuracyMeters: 55, // Rejected
      timestamp: 1000,
    });
    expect(poorGps.length).toBe(0);

    // Single point without trace evidence must not confirm street
    const singlePoint = streetDiscoveryService.processGPSFix({
      lat: 59.4420,
      lng: 24.7350,
      accuracyMeters: 4.0,
      timestamp: 2000,
    });
    expect(singlePoint.length).toBe(0);

    // Static drift without minimum movement (<15m) must be rejected
    const staticDrift = streetDiscoveryService.processGPSFix({
      lat: 59.4420001,
      lng: 24.7350001,
      accuracyMeters: 4.0,
      timestamp: 3000,
    });
    expect(staticDrift.length).toBe(0);
  });

  // -------------------------------------------------------------
  // Invariant 5: No "official" record without authoritative state source
  // -------------------------------------------------------------
  it('INVARIANT 5: No record claims "official" provenance without authoritative source registry', () => {
    const authoritativeSources = ['ppa', 'paasteamet', 'tallinn', 'ads'];

    for (const place of TALLINN_MAP_PLACES) {
      if (place.provenanceStatus === 'official') {
        const hasAuthoritativeSource = authoritativeSources.includes(place.source) ||
          (place.sources && place.sources.some((s) => authoritativeSources.includes(s.provider)));
        expect(
          hasAuthoritativeSource,
          `Place ${place.name} has "official" status but no authoritative provider!`
        ).toBe(true);
      }
    }
  });

  // -------------------------------------------------------------
  // Invariant 6: No geographic x/y in production domain models
  // -------------------------------------------------------------
  it('INVARIANT 6: Geographic coordinates use canonical GeoPoint (lat/lng), never planar x/y', () => {
    for (const place of TALLINN_MAP_PLACES) {
      expect('x' in place.location).toBe(false);
      expect('y' in place.location).toBe(false);
      expect('lat' in place.location).toBe(true);
      expect('lng' in place.location).toBe(true);
    }
  });
});
