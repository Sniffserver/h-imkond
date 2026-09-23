import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CITY_ID,
  ESTONIA_CITY_DEFAULTS,
  geoToLocalMeters,
  localMetersToGeo,
  haversineDistanceMeters,
  calculateBearing,
  parseCoordinateString,
  formatCoordinates,
  isWithinEstonia,
  getClosestCity,
} from '../geo';
import { getTacticalVectorMapStyle, initializePMTilesProtocol } from '../features/map/pmtiles';

describe('HÕIMU Unified Geo & Projection Engine', () => {
  it('provides default city configuration for Tallinn and regional Estonian centers', () => {
    expect(DEFAULT_CITY_ID).toBe('tallinn');
    expect(ESTONIA_CITY_DEFAULTS.tallinn.lat).toBeCloseTo(59.4370, 3);
    expect(ESTONIA_CITY_DEFAULTS.tallinn.lng).toBeCloseTo(24.7535, 3);
  });

  it('accurately projects geo coordinates to metric plane and back', () => {
    const center = ESTONIA_CITY_DEFAULTS.tallinn;
    const testLat = 59.4400;
    const testLng = 24.7600;

    const localMeters = geoToLocalMeters(testLat, testLng, center.lat, center.lng);
    expect(typeof localMeters.x).toBe('number');
    expect(typeof localMeters.y).toBe('number');

    const backGeo = localMetersToGeo(localMeters.x, localMeters.y, center.lat, center.lng);
    expect(backGeo.lat).toBeCloseTo(testLat, 5);
    expect(backGeo.lng).toBeCloseTo(testLng, 5);
  });

  it('calculates accurate Haversine distance between Tallinn and Tartu', () => {
    const dist = haversineDistanceMeters(
      ESTONIA_CITY_DEFAULTS.tallinn.lat,
      ESTONIA_CITY_DEFAULTS.tallinn.lng,
      ESTONIA_CITY_DEFAULTS.tartu.lat,
      ESTONIA_CITY_DEFAULTS.tartu.lng
    );

    // Tallinn to Tartu is approximately 160-170 km straight line
    expect(dist).toBeGreaterThan(150000);
    expect(dist).toBeLessThan(180000);
  });

  it('calculates bearing degrees', () => {
    const bearing = calculateBearing(
      ESTONIA_CITY_DEFAULTS.tallinn.lat,
      ESTONIA_CITY_DEFAULTS.tallinn.lng,
      ESTONIA_CITY_DEFAULTS.tartu.lat,
      ESTONIA_CITY_DEFAULTS.tartu.lng
    );
    expect(bearing).toBeGreaterThan(120);
    expect(bearing).toBeLessThan(150); // South-East direction (~135°)
  });

  it('parses formatted coordinate strings and identifies Estonian bounding box', () => {
    const parsed = parseCoordinateString('59.4370° N, 24.7535° E');
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed[0]).toBeCloseTo(59.4370, 4);
    expect(parsed[1]).toBeCloseTo(24.7535, 4);

    expect(isWithinEstonia(parsed[0], parsed[1])).toBe(true);
    expect(isWithinEstonia(10.0, 10.0)).toBe(false);
    expect(getClosestCity(59.43, 24.75)).toBe('tallinn');
    expect(getClosestCity(58.38, 26.72)).toBe('tartu');

    const formatted = formatCoordinates(59.437, 24.7535);
    expect(formatted).toContain('59.4370° N');
    expect(formatted).toContain('24.7535° E');
  });

  it('generates tactical vector map style with PMTiles protocol source', () => {
    const proto = initializePMTilesProtocol();
    expect(proto).toBeDefined();

    const style = getTacticalVectorMapStyle('/maps/tallinn.pmtiles');
    expect(style.version).toBe(8);
    expect(style.sources.protomaps).toBeDefined();
    expect((style.sources.protomaps as any).url).toBe('pmtiles:///maps/tallinn.pmtiles');
  });
});
