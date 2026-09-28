/**
 * MapLibre Overlay Layer: Active Mesh Peers & Field Personnel
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint, FieldProvenance } from '../../../../types';

export const PEOPLE_SOURCE_ID = 'hoimu-people-source';
export const PEOPLE_POINT_LAYER = 'people-points';
export const PEOPLE_LABEL_LAYER = 'people-labels';

export interface PeerMapMarker {
  id: string;
  name: string;
  callsign: string;
  location: GeoPoint;
  locationProvenance?: FieldProvenance;
  batteryPercent?: number;
  batteryProvenance?: FieldProvenance;
  role?: string;
  online: boolean;
  onlineProvenance?: FieldProvenance;
  rssi?: number;
  rssiProvenance?: FieldProvenance;
  distanceMeters?: number;
  distanceProvenance?: FieldProvenance;
}

export function convertPeersToGeoJson(peers: PeerMapMarker[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: peers.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.location.lng, p.location.lat],
      },
      properties: {
        id: p.id,
        name: p.name,
        callsign: p.callsign,
        batteryPercent: p.batteryPercent,
        batteryProvenance: p.batteryProvenance || 'unknown',
        role: p.role || 'Peer',
        online: p.online ? 'true' : 'false',
        onlineProvenance: p.onlineProvenance || 'observed',
        rssi: p.rssi,
        rssiProvenance: p.rssiProvenance || 'unknown',
        locationProvenance: p.locationProvenance || 'observed',
        distanceMeters: p.distanceMeters,
        distanceProvenance: p.distanceProvenance || 'derived',
      },
    })),
  };
}

export function setupPeopleLayer(map: maplibregl.Map, peers: PeerMapMarker[]): void {
  const geojson = convertPeersToGeoJson(peers);

  if (map.getSource(PEOPLE_SOURCE_ID)) {
    const src = map.getSource(PEOPLE_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(PEOPLE_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: PEOPLE_POINT_LAYER,
    type: 'circle',
    source: PEOPLE_SOURCE_ID,
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'online'], 'true'],
        '#2A9D8F',
        '#6C757D',
      ],
      'circle-radius': 8,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#FFFFFF',
    },
  });

  map.addLayer({
    id: PEOPLE_LABEL_LAYER,
    type: 'symbol',
    source: PEOPLE_SOURCE_ID,
    minzoom: 12,
    layout: {
      'text-field': ['get', 'callsign'],
      'text-font': ['Noto Sans Bold', 'Open Sans Bold'],
      'text-size': 11,
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#203A2A',
      'text-halo-color': '#FAF6EE',
      'text-halo-width': 2,
    },
  });
}

export function updatePeopleLayerData(map: maplibregl.Map, peers: PeerMapMarker[]): void {
  const src = map.getSource(PEOPLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertPeersToGeoJson(peers));
  }
}
