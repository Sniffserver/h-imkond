/**
 * MapLibre Overlay Layer: Radio Signal Geography & Movement Breadcrumbs
 * Renders spatial signal observations color-coded by RSSI dBm signal strength.
 * 
 * Signal Geography Color Scale:
 * - Green (>-70 dBm): Strong, high-bandwidth LoRa/BLE signal
 * - Yellow (-70..-85 dBm): Moderate, reliable link
 * - Orange (-85..-100 dBm): Marginal / fringe reception
 * - Red (<-100 dBm): Very weak / dead zone edge
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint, SignalObservation } from '../../../../types';

export const SIGNAL_TRAIL_SOURCE_ID = 'hoimu-signaltrail-source';
export const SIGNAL_TRAIL_LINE_LAYER = 'signal-trail-line';
export const SIGNAL_TRAIL_POINTS_LAYER = 'signal-trail-points';

export function getRssiColor(rssi: number): string {
  if (rssi > -70) return '#2A9D8F'; // Green
  if (rssi > -85) return '#E9C46A'; // Yellow
  if (rssi > -100) return '#F4A261'; // Orange
  return '#E76F51'; // Red
}

export function convertTrailToGeoJson(
  observationsOrPoints: (SignalObservation | GeoPoint)[]
): GeoJSON.FeatureCollection {
  if (observationsOrPoints.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const features: GeoJSON.Feature[] = [];

  // 1. Convert to Point Features with RSSI color metadata
  const pointCoords: [number, number][] = [];

  observationsOrPoints.forEach((item, index) => {
    const isObs = 'rssi' in item;
    const pos = isObs ? item.position : item;
    const rssi = isObs ? item.rssi : -75;
    const peerId = isObs ? item.peerId : 'Self GPS';
    const medium = isObs ? item.medium : 'lora';

    pointCoords.push([pos.lng, pos.lat]);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pos.lng, pos.lat],
      },
      properties: {
        id: `sig_obs_${index}`,
        rssi,
        peerId,
        medium,
        color: getRssiColor(rssi),
        timestamp: isObs ? item.timestamp : Date.now(),
      },
    });
  });

  // 2. Convert to LineString Trail feature if >= 2 points
  if (pointCoords.length >= 2) {
    features.unshift({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: pointCoords,
      },
      properties: { type: 'trail_line' },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function setupSignalTrailLayer(
  map: maplibregl.Map,
  observationsOrPoints: (SignalObservation | GeoPoint)[]
): void {
  const geojson = convertTrailToGeoJson(observationsOrPoints);

  if (map.getSource(SIGNAL_TRAIL_SOURCE_ID)) {
    const src = map.getSource(SIGNAL_TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(SIGNAL_TRAIL_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  // Trail line layer
  map.addLayer({
    id: SIGNAL_TRAIL_LINE_LAYER,
    type: 'line',
    source: SIGNAL_TRAIL_SOURCE_ID,
    filter: ['==', ['get', 'type'], 'trail_line'],
    paint: {
      'line-color': '#2A9D8F',
      'line-width': 3,
      'line-opacity': 0.6,
      'line-dasharray': [2, 1],
    },
  });

  // Signal Geography Point observations layer
  map.addLayer({
    id: SIGNAL_TRAIL_POINTS_LAYER,
    type: 'circle',
    source: SIGNAL_TRAIL_SOURCE_ID,
    filter: ['!=', ['get', 'type'], 'trail_line'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'rssi'],
        '#E76F51', // <-100 Red
        -100, '#F4A261', // -100 to -85 Orange
        -85, '#E9C46A', // -85 to -70 Yellow
        -70, '#2A9D8F', // >-70 Green
      ],
      'circle-radius': 5,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });
}

export function updateSignalTrailData(
  map: maplibregl.Map,
  observationsOrPoints: (SignalObservation | GeoPoint)[]
): void {
  const src = map.getSource(SIGNAL_TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertTrailToGeoJson(observationsOrPoints));
  }
}
