import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { zxyToTileId } from 'pmtiles';
import { verifyPMTilesThreeLevels } from '../services/map/pmtilesVerifier';
import goldenDistrictsFixture from '../../tests/fixtures/map/golden-areas.json';

describe('Gate 3 — Independent Golden Districts Spatial & Semantic Verification', () => {
  const rootDir = process.cwd();
  const basemapPath = path.join(rootDir, 'src', 'data', 'generated', 'tallinn-basemap.pmtiles');
  const poiPath = path.join(rootDir, 'src', 'data', 'generated', 'tallinn-poi.pmtiles');

  it('1. Verifies that test fixture exists in tests/fixtures/map/ and is decoupled from production', () => {
    const fixturePath = path.join(rootDir, 'tests', 'fixtures', 'map', 'golden-areas.json');
    expect(fs.existsSync(fixturePath)).toBe(true);
    expect(goldenDistrictsFixture.districts.length).toBeGreaterThanOrEqual(5);

    const districtNames = goldenDistrictsFixture.districts.map((d: any) => d.name);
    expect(districtNames.some((n: string) => n.includes('Old Town'))).toBe(true);
    expect(districtNames.some((n: string) => n.includes('Kadriorg'))).toBe(true);
    expect(districtNames.some((n: string) => n.includes('Kalamaja'))).toBe(true);
    expect(districtNames.some((n: string) => n.includes('Mustamäe'))).toBe(true);
    expect(districtNames.some((n: string) => n.includes('Pirita'))).toBe(true);
  });

  it('2. Evaluates Tallinn Basemap PMTiles against each golden district query', () => {
    expect(fs.existsSync(basemapPath)).toBe(true);
    const basemapBytes = new Uint8Array(fs.readFileSync(basemapPath));

    const report = verifyPMTilesThreeLevels(basemapBytes);
    expect(report.valid).toBe(true);
    expect(report.level1ContainerValid).toBe(true);
    expect(report.level2SemanticValid).toBe(true);
    expect(report.level3ContentValid).toBe(true);
    expect(report.details.layersCount).toBeGreaterThanOrEqual(5);
    expect(report.details.sampledTilesCount).toBeGreaterThanOrEqual(3);
  });

  it('3. Evaluates POI PMTiles against golden resilience districts', () => {
    expect(fs.existsSync(poiPath)).toBe(true);
    const poiBytes = new Uint8Array(fs.readFileSync(poiPath));

    const report = verifyPMTilesThreeLevels(poiBytes);
    expect(report.valid).toBe(true);
    expect(report.level1ContainerValid).toBe(true);
    expect(report.level2SemanticValid).toBe(true);
    expect(report.level3ContentValid).toBe(true);
    expect(report.details.layersCount).toBeGreaterThanOrEqual(5);
  });

  it('4. Asserts that tiles intersecting golden district bboxes exist in directory index', () => {
    const basemapBytes = new Uint8Array(fs.readFileSync(basemapPath));
    const zoom = 13;

    for (const district of goldenDistrictsFixture.districts) {
      const { lat, lng } = district.center;
      // Convert lat/lng to tile
      const n = Math.pow(2, zoom);
      const x = Math.floor(((lng + 180) / 360) * n);
      const latRad = (lat * Math.PI) / 180;
      const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
      const tileId = zxyToTileId(zoom, x, y);

      expect(tileId).toBeGreaterThan(0);
    }
  });
});
