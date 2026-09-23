import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapPackService,
  AVAILABLE_MAP_PACKS,
} from '../services/map/mapPackService';
import {
  getTacticalVectorMapStyle,
  TacticalMapTheme,
  initializePMTilesProtocol,
} from '../features/map/pmtiles';

describe('HÕIMU PMTiles Map Pack & Zero-Scraping Offline Vector Architecture', () => {
  beforeEach(async () => {
    await mapPackService.deleteMapPack('tallinn');
  });

  describe('Map Pack Service (Single-File PMTiles)', () => {
    it('provides metadata for primary Estonian bioregions', async () => {
      const packs = await mapPackService.getMapPackList();
      expect(packs.length).toBeGreaterThanOrEqual(4);

      const tallinn = packs.find((p) => p.cityId === 'tallinn');
      expect(tallinn).toBeDefined();
      expect(tallinn?.fileName).toBe('tallinn.pmtiles');
      expect(tallinn?.sizeBytes).toBeGreaterThan(0);
      expect(tallinn?.features.some((f) => f.includes('name:et'))).toBe(true);

      const tartu = packs.find((p) => p.cityId === 'tartu');
      expect(tartu).toBeDefined();
      expect(tartu?.cityName).toBe('Tartu');
    });

    it('installs a single-file map pack with progress tracking and zero raster scraping', async () => {
      let progressReported = false;
      const success = await mapPackService.installMapPack('tallinn', (_received, _total, pct) => {
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
        progressReported = true;
      });

      expect(success).toBe(true);
      expect(progressReported).toBe(true);

      const isInstalled = await mapPackService.isMapPackInstalled('tallinn');
      expect(isInstalled).toBe(true);
    });

    it('deletes an installed map pack cleanly', async () => {
      await mapPackService.installMapPack('tallinn');
      expect(await mapPackService.isMapPackInstalled('tallinn')).toBe(true);

      await mapPackService.deleteMapPack('tallinn');
      expect(await mapPackService.isMapPackInstalled('tallinn')).toBe(false);
    });
  });

  describe('Tactical Vector Map Styles & Multi-Level Zoom Architecture', () => {
    it('initializes PMTiles protocol handler for MapLibre GL', () => {
      const proto = initializePMTilesProtocol();
      expect(proto).toBeDefined();
      expect(typeof proto.tile).toBe('function');
    });

    const themes: TacticalMapTheme[] = ['day', 'night', 'high_contrast', 'direct_sun', 'eco', 'crisis'];

    themes.forEach((theme) => {
      it(`generates valid tactical vector map style for theme: ${theme}`, () => {
        const style = getTacticalVectorMapStyle('/maps/tallinn.pmtiles', theme);
        expect(style.version).toBe(8);
        expect(style.name).toContain(theme.toUpperCase());
        expect(style.sources.protomaps).toBeDefined();
        expect((style.sources.protomaps as any).url).toBe('pmtiles:///maps/tallinn.pmtiles');

        // Verify zero external raster tile server URLs
        const jsonString = JSON.stringify(style);
        expect(jsonString).not.toContain('tile.openstreetmap.org');

        // Check multi-zoom layers
        const layerIds = style.layers.map((l) => l.id);
        expect(layerIds).toContain('background');
        expect(layerIds).toContain('landuse-base');
        expect(layerIds).toContain('water-areas');
        expect(layerIds).toContain('railways');
        expect(layerIds).toContain('roads-motorway-primary');
        expect(layerIds).toContain('roads-secondary');
        expect(layerIds).toContain('roads-residential');
        expect(layerIds).toContain('buildings-footprints');
        expect(layerIds).toContain('places-labels');
        expect(layerIds).toContain('road-labels');
      });
    });

    it('enforces Estonian street name localization (name:et) in label layers', () => {
      const style = getTacticalVectorMapStyle('/maps/tallinn.pmtiles', 'night');
      const roadLabelsLayer = style.layers.find((l) => l.id === 'road-labels');
      expect(roadLabelsLayer).toBeDefined();

      const textField = (roadLabelsLayer as any)?.layout?.['text-field'];
      expect(JSON.stringify(textField)).toContain('name:et');
      expect(JSON.stringify(textField)).toContain('name');
    });

    it('implements zoom thresholds according to tactical specifications', () => {
      const style = getTacticalVectorMapStyle('/maps/tallinn.pmtiles', 'day');

      const landuse = style.layers.find((l) => l.id === 'landuse-base');
      expect(landuse?.minzoom).toBe(10); // ZOOM 10: city / district

      const majorRoads = style.layers.find((l) => l.id === 'roads-motorway-primary');
      expect(majorRoads?.minzoom).toBe(11); // ZOOM 11-12: main arteries

      const rail = style.layers.find((l) => l.id === 'railways');
      expect(rail?.minzoom).toBe(13); // ZOOM 13: rail & secondary

      const buildings = style.layers.find((l) => l.id === 'buildings-footprints');
      expect(buildings?.minzoom).toBe(14); // ZOOM 14: buildings & residential

      const roadLabels = style.layers.find((l) => l.id === 'road-labels');
      expect(roadLabels?.minzoom).toBe(14); // ZOOM 14-15+: street names
    });
  });
});
