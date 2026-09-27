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
import { SignalObservation } from '../../../../types';

export const SIGNAL_TRAIL_SOURCE_ID = 'hoimu-signaltrail-source';
export const SIGNAL_TRAIL_LINE_LAYER = 'signal-trail-line';
export const SIGNAL_TRAIL_POINTS_LAYER = 'signal-trail-points';

/**
 * Architectural Invariant:
 * GPS track ≠ RSSI measurement ≠ mesh topology ≠ RF coverage model.
 * SignalTrailPoint is strictly an RF SignalObservation (never a raw GPS breadcrumb).
 */
export type SignalTrailPoint = SignalObservation;

export function getRssiColor(rssi: number): string {
  if (rssi > -70) return '#2A9D8F'; // Green: strong link
  if (rssi > -85) return '#E9C46A'; // Yellow: reliable link
  if (rssi > -100) return '#F4A261'; // Orange: marginal
  return '#E76F51'; // Red: edge / near dead zone
}

export function convertTrailToGeoJson(
  observations: SignalTrailPoint[]
): GeoJSON.FeatureCollection {
  if (observations.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const features: GeoJSON.Feature[] = [];
  const pointCoords: [number, number][] = [];

  observations.forEach((obs, index) => {
    const pos = obs.position;
    pointCoords.push([pos.lng, pos.lat]);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pos.lng, pos.lat],
      },
      properties: {
        id: `sig_obs_${index}`,
        rssi: obs.rssi,
        peerId: obs.peerId,
        medium: obs.medium,
        color: getRssiColor(obs.rssi),
        timestamp: obs.timestamp,
      },
    });
  });

  // Signal propagation path if >= 2 consecutive observations
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
  observations: SignalTrailPoint[]
): void {
  const geojson = convertTrailToGeoJson(observations);

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
      'line-width': 2.5,
      'line-opacity': 0.6,
      'line-dasharray': [2, 1],
    },
  });

  // Signal Geography Point observations layer (strictly genuine RSSI values)
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
  observations: SignalTrailPoint[]
): void {
  const src = map.getSource(SIGNAL_TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertTrailToGeoJson(observations));
  }
}
