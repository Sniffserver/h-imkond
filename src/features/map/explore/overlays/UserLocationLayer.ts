/**
 * MapLibre Overlay Layer: User Location & GPS Accuracy Pulse (Step 3)
 * Renders high-visibility live GPS coordinate pin with pulsating accuracy halo.
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint } from '../../../../types';

export const USER_LOCATION_SOURCE_ID = 'hoimu-user-location-source';
export const USER_LOCATION_HALO_LAYER = 'user-location-halo';
export const USER_LOCATION_PIN_LAYER = 'user-location-pin';

export function convertUserLocationToGeoJson(
  location: GeoPoint,
  accuracyMeters: number = 15
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [location.lng, location.lat],
        },
        properties: {
          accuracyMeters,
          title: 'You (Mesh Operator)',
        },
      },
    ],
  };
}

export function setupUserLocationLayer(
  map: maplibregl.Map,
  location: GeoPoint,
  accuracyMeters: number = 15
): void {
  const geojson = convertUserLocationToGeoJson(location, accuracyMeters);

  if (map.getSource(USER_LOCATION_SOURCE_ID)) {
    const src = map.getSource(USER_LOCATION_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(USER_LOCATION_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  // Pulsating / Semi-transparent accuracy halo
  map.addLayer({
    id: USER_LOCATION_HALO_LAYER,
    type: 'circle',
    source: USER_LOCATION_SOURCE_ID,
    paint: {
      'circle-radius': 16,
      'circle-color': '#588157',
      'circle-opacity': 0.25,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#588157',
      'circle-stroke-opacity': 0.6,
    },
  });

  // Solid user location center pin
  map.addLayer({
    id: USER_LOCATION_PIN_LAYER,
    type: 'circle',
    source: USER_LOCATION_SOURCE_ID,
    paint: {
      'circle-radius': 6,
      'circle-color': '#203A2A',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
      'circle-opacity': 1.0,
    },
  });
}

export function updateUserLocationData(
  map: maplibregl.Map,
  location: GeoPoint,
  accuracyMeters: number = 15
): void {
  const src = map.getSource(USER_LOCATION_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertUserLocationToGeoJson(location, accuracyMeters));
  }
}
