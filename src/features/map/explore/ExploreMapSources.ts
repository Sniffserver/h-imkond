/**
 * Source Management for ExploreMap
 * Handles static PMTiles vector tile sources and dynamic GeoJSON sources.
 */

import type * as maplibregl from 'maplibre-gl';
import { initializePMTilesProtocol } from '../pmtiles';

export const BASEMAP_SOURCE_ID = 'protomaps';
export const POI_TILE_SOURCE_ID = 'poi-protomaps';

export function initializeMapSources(map: maplibregl.Map, pmtilesUrl: string = '/maps/tallinn.pmtiles'): void {
  initializePMTilesProtocol();

  // 1. Static Basemap Vector Tiles
  if (!map.getSource(BASEMAP_SOURCE_ID)) {
    map.addSource(BASEMAP_SOURCE_ID, {
      type: 'vector',
      url: `pmtiles://${pmtilesUrl}`,
      attribution: '© OpenStreetMap contributors • HÕIMU Vector',
    });
  }

  // 2. Static POI Vector Tiles
  if (!map.getSource(POI_TILE_SOURCE_ID)) {
    map.addSource(POI_TILE_SOURCE_ID, {
      type: 'vector',
      url: 'pmtiles:///maps/tallinn-poi.pmtiles',
      attribution: '© OpenStreetMap contributors • Päästeamet • Tallinn Geoportal',
    });
  }
}
