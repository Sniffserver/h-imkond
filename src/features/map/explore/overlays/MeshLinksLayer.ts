/**
 * MapLibre Overlay Layer: Radio Mesh Links & RF Signal Topology
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint, FieldProvenance } from '../../../../types';

export const MESH_LINKS_SOURCE_ID = 'hoimu-meshlinks-source';
export const MESH_LINKS_LINE_LAYER = 'mesh-links-line';

export interface MeshLink {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  rssi?: number;
  rssiProvenance?: FieldProvenance;
  snr?: number;
  snrProvenance?: FieldProvenance;
  quality?: 'excellent' | 'good' | 'marginal';
  qualityProvenance?: FieldProvenance;
}

export function convertMeshLinksToGeoJson(links: MeshLink[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: links.map((l) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [l.from.lng, l.from.lat],
          [l.to.lng, l.to.lat],
        ],
      },
      properties: {
        id: l.id,
        rssi: l.rssi ?? -80,
        snr: l.snr ?? 5,
        quality: l.quality || 'good',
        rssiProvenance: l.rssiProvenance || 'observed',
        snrProvenance: l.snrProvenance || 'observed',
        qualityProvenance: l.qualityProvenance || 'observed',
      },
    })),
  };
}

export function setupMeshLinksLayer(map: maplibregl.Map, links: MeshLink[]): void {
  const geojson = convertMeshLinksToGeoJson(links);

  if (map.getSource(MESH_LINKS_SOURCE_ID)) {
    const src = map.getSource(MESH_LINKS_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(MESH_LINKS_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  map.addLayer({
    id: MESH_LINKS_LINE_LAYER,
    type: 'line',
    source: MESH_LINKS_SOURCE_ID,
    paint: {
      'line-color': [
        'match',
        ['get', 'quality'],
        'excellent', '#2A9D8F',
        'good', '#E9C46A',
        'marginal', '#E76F51',
        '#6C757D',
      ],
      'line-width': 2,
      'line-dasharray': [4, 2],
      'line-opacity': 0.8,
    },
  });
}

export function updateMeshLinksLayerData(map: maplibregl.Map, links: MeshLink[]): void {
  const src = map.getSource(MESH_LINKS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertMeshLinksToGeoJson(links));
  }
}
