/**
 * MapLibre Overlay Layer: Clustered POIs & Civilian Resilience Places
 * 
 * Static/Dynamic POI Layer featuring native MapLibre GL clustering:
 * - Zoom <= 14: Renders aggregated cluster circles with count badges (e.g., ⦿ 87, ⦿ 43, ⦿ 129).
 * - Zoom > 14: Expands to unclustered category-colored POI icons & labels.
 * - Handles cluster click expansion.
 */

import type * as maplibregl from 'maplibre-gl';
import { MapPlace } from '../../../../types';

export const PLACES_SOURCE_ID = 'hoimu-places-source';
export const PLACES_CLUSTER_CIRCLE_LAYER = 'places-cluster-circle';
export const PLACES_CLUSTER_COUNT_LAYER = 'places-cluster-count';
export const PLACES_UNCLUSTERED_POINT_LAYER = 'places-unclustered-point';
export const PLACES_UNCLUSTERED_LABEL_LAYER = 'places-unclustered-label';

export function convertPlacesToGeoJson(places: MapPlace[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.location.lng, p.location.lat],
      },
      properties: {
        id: p.id,
        name: p.name,
        mainCategory: p.mainCategory,
        subCategory: p.subCategory,
        source: p.source,
        sourceName: p.sourceName,
        provenanceStatus: p.provenanceStatus || 'official',
        address: p.address || '',
        phone: p.phone || '',
        openingHours: p.openingHours || '',
        description: p.description || '',
        hasMismatch: p.hasMismatch ? 'true' : 'false',
        observedByNodes: p.observedByNodes || 0,
      },
    })),
  };
}

export function setupPlacesLayer(map: maplibregl.Map, places: MapPlace[]): void {
  const geojson = convertPlacesToGeoJson(places);

  if (map.getSource(PLACES_SOURCE_ID)) {
    const src = map.getSource(PLACES_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  // Add clustered GeoJSON source
  map.addSource(PLACES_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  // 1. Cluster Circles Layer (Zoom <= 14)
  map.addLayer({
    id: PLACES_CLUSTER_CIRCLE_LAYER,
    type: 'circle',
    source: PLACES_SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#588157', // < 10 points
        10,
        '#E76F51', // 10 - 49 points
        50,
        '#2A9D8F', // >= 50 points
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18, // radius at < 10
        10,
        24, // radius at 10-49
        50,
        30, // radius at >= 50
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
      'circle-opacity': 0.9,
    },
  });

  // 2. Cluster Count Text Layer
  map.addLayer({
    id: PLACES_CLUSTER_COUNT_LAYER,
    type: 'symbol',
    source: PLACES_SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Bold', 'Open Sans Bold'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#FFFFFF',
    },
  });

  // 3. Unclustered Individual POI Points (Zoom > 14)
  map.addLayer({
    id: PLACES_UNCLUSTERED_POINT_LAYER,
    type: 'circle',
    source: PLACES_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match',
        ['get', 'mainCategory'],
        'safety', '#E76F51',
        'water', '#457B9D',
        'tools', '#2A9D8F',
        'stores', '#F4A261',
        'energy', '#E9C46A',
        'finds', '#8AB17D',
        '#264653', // fallback
      ],
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
    },
  });

  // 4. Unclustered POI Labels (Zoom >= 14)
  map.addLayer({
    id: PLACES_UNCLUSTERED_LABEL_LAYER,
    type: 'symbol',
    source: PLACES_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    minzoom: 14,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#203A2A',
      'text-halo-color': '#FAF6EE',
      'text-halo-width': 1.5,
    },
  });
}

export function updatePlacesLayerData(map: maplibregl.Map, places: MapPlace[]): void {
  const src = map.getSource(PLACES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertPlacesToGeoJson(places));
  }
}
