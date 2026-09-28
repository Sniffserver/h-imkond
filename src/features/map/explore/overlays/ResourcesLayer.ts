/**
 * MapLibre Overlay Layer: Dynamic Mutual Aid & Resource Exchanges
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint } from '../../../../types';

export const RESOURCES_SOURCE_ID = 'hoimu-resources-source';
export const RESOURCES_POINT_LAYER = 'resources-points';
export const RESOURCES_LABEL_LAYER = 'resources-labels';

export interface ResourceItem {
  id: string;
  title: string;
  category: string;
  type?: 'offer' | 'request';
  location: GeoPoint;
  description?: string;
  availableQuantity?: string;
}

export function convertResourcesToGeoJson(resources: ResourceItem[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: resources.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.location.lng, r.location.lat],
      },
      properties: {
        id: r.id,
        title: r.title,
        category: r.category,
        type: r.type,
        description: r.description || '',
        availableQuantity: r.availableQuantity || '1',
      },
    })),
  };
}

export function setupResourcesLayer(map: maplibregl.Map, resources: ResourceItem[]): void {
  const geojson = convertResourcesToGeoJson(resources);

  if (map.getSource(RESOURCES_SOURCE_ID)) {
    const src = map.getSource(RESOURCES_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(RESOURCES_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: RESOURCES_POINT_LAYER,
    type: 'circle',
    source: RESOURCES_SOURCE_ID,
    paint: {
      'circle-color': [
        'match',
        ['get', 'type'],
        'offer', '#2A9D8F',
        'request', '#E76F51',
        '#F4A261',
      ],
      'circle-radius': 6.5,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FFFFFF',
    },
  });

  map.addLayer({
    id: RESOURCES_LABEL_LAYER,
    type: 'symbol',
    source: RESOURCES_SOURCE_ID,
    minzoom: 13,
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
      'text-size': 10,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#203A2A',
      'text-halo-color': '#FAF6EE',
      'text-halo-width': 1.5,
    },
  });
}

export function updateResourcesLayerData(map: maplibregl.Map, resources: ResourceItem[]): void {
  const src = map.getSource(RESOURCES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertResourcesToGeoJson(resources));
  }
}
