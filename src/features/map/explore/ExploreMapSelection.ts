/**
 * Selection & Click Interaction Handler for ExploreMap
 */

import type * as maplibregl from 'maplibre-gl';
import {
  PLACES_SOURCE_ID,
  PLACES_CLUSTER_CIRCLE_LAYER,
  PLACES_UNCLUSTERED_POINT_LAYER,
} from './overlays/PlacesLayer';
import { DISCOVERY_DISCOVERED_LAYER, DISCOVERY_UNEXPLORED_LAYER } from './overlays/DiscoveryLayer';
import { MapPlace, Street } from '../../../types';

export interface SelectionCallbacks {
  onSelectPlace?: (place: MapPlace) => void;
  onSelectStreet?: (street: Street) => void;
  onClearSelection?: () => void;
}

export function bindExploreMapInteractions(
  map: maplibregl.Map,
  places: MapPlace[],
  streets: Street[],
  callbacks: SelectionCallbacks
): void {
  // 1. Cluster Click -> Expand Cluster & Zoom In
  map.on('click', PLACES_CLUSTER_CIRCLE_LAYER, (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [PLACES_CLUSTER_CIRCLE_LAYER] });
    if (!features.length) return;

    const clusterId = features[0].properties?.cluster_id;
    const src = map.getSource(PLACES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

    if (src && typeof clusterId === 'number') {
      src.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (zoom === undefined || zoom === null) return;
        const coordinates = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({
          center: coordinates,
          zoom: Math.min(zoom + 0.5, 16),
          duration: 500,
        });
      }).catch(() => {
        // Fallback zoom in
        const coordinates = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({
          center: coordinates,
          zoom: Math.min(map.getZoom() + 2, 16),
          duration: 500,
        });
      });
    }
  });

  // 2. Unclustered POI Click -> Select MapPlace
  map.on('click', PLACES_UNCLUSTERED_POINT_LAYER, (e) => {
    if (!e.features || !e.features.length) return;
    const placeId = e.features[0].properties?.id;
    if (placeId) {
      const match = places.find((p) => p.id === placeId);
      if (match && callbacks.onSelectPlace) {
        callbacks.onSelectPlace(match);
      }
    }
  });

  // 3. Street Click -> Select Street
  const handleStreetClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
    if (!e.features || !e.features.length) return;
    const streetId = e.features[0].properties?.streetId;
    if (streetId) {
      const match = streets.find((s) => s.id === streetId);
      if (match && callbacks.onSelectStreet) {
        callbacks.onSelectStreet(match);
      }
    }
  };

  map.on('click', DISCOVERY_DISCOVERED_LAYER, handleStreetClick);
  map.on('click', DISCOVERY_UNEXPLORED_LAYER, handleStreetClick);

  // Hover Cursor Styling
  const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
  const unsetPointer = () => { map.getCanvas().style.cursor = ''; };

  [PLACES_CLUSTER_CIRCLE_LAYER, PLACES_UNCLUSTERED_POINT_LAYER, DISCOVERY_DISCOVERED_LAYER, DISCOVERY_UNEXPLORED_LAYER].forEach((layer) => {
    map.on('mouseenter', layer, setPointer);
    map.on('mouseleave', layer, unsetPointer);
  });
}
