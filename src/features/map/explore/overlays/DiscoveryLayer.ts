/**
 * MapLibre Overlay Layer: Street Discovery & Exploration Progress
 */

import type * as maplibregl from 'maplibre-gl';
import { Street } from '../../../../types';

export const DISCOVERY_SOURCE_ID = 'hoimu-discovery-source';
export const DISCOVERY_UNEXPLORED_LAYER = 'discovery-unexplored-line';
export const DISCOVERY_DISCOVERED_LAYER = 'discovery-discovered-line';

export function convertStreetsToDiscoveryGeoJson(streets: Street[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  for (const street of streets) {
    for (const segment of street.segments || []) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [segment.start.lng, segment.start.lat],
            [segment.end.lng, segment.end.lat],
          ],
        },
        properties: {
          id: segment.id,
          streetId: street.id,
          streetName: street.name,
          district: street.district || 'Tallinn',
          discoveryState: segment.discoveryState || 'unexplored',
          exploredPercent: street.exploredPercent || 0,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function setupDiscoveryLayer(map: maplibregl.Map, streets: Street[]): void {
  const geojson = convertStreetsToDiscoveryGeoJson(streets);

  if (map.getSource(DISCOVERY_SOURCE_ID)) {
    const src = map.getSource(DISCOVERY_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(DISCOVERY_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  // 1. Unexplored Street Segments (Dashed)
  map.addLayer({
    id: DISCOVERY_UNEXPLORED_LAYER,
    type: 'line',
    source: DISCOVERY_SOURCE_ID,
    filter: ['==', ['get', 'discoveryState'], 'unexplored'],
    paint: {
      'line-color': '#8FA875',
      'line-width': 2.5,
      'line-dasharray': [3, 2],
      'line-opacity': 0.5,
    },
  });

  // 2. Discovered Street Segments (Glowing Emerald)
  map.addLayer({
    id: DISCOVERY_DISCOVERED_LAYER,
    type: 'line',
    source: DISCOVERY_SOURCE_ID,
    filter: ['==', ['get', 'discoveryState'], 'discovered'],
    paint: {
      'line-color': '#2A9D8F',
      'line-width': 4.5,
      'line-opacity': 0.85,
    },
  });
}

export function updateDiscoveryLayerData(map: maplibregl.Map, streets: Street[]): void {
  const src = map.getSource(DISCOVERY_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertStreetsToDiscoveryGeoJson(streets));
  }
}
