/**
 * MapLibre Overlay Layer: Active A* Navigation Polyline & Waypoints
 */

import type * as maplibregl from 'maplibre-gl';
import { RouteResult } from '../../../../services/routing/routingEngine';

export const ROUTE_SOURCE_ID = 'hoimu-route-source';
export const ROUTE_CASING_LAYER = 'route-casing-line';
export const ROUTE_ACTIVE_LAYER = 'route-active-line';
export const ROUTE_NODES_LAYER = 'route-nodes-point';

export function convertRouteToGeoJson(route: RouteResult | null): GeoJSON.FeatureCollection {
  if (!route || !route.path || route.path.length < 2) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: route.path,
    },
    properties: {
      type: 'activeRoute',
      distanceMeters: route.totalDistanceMeters,
      estimatedMinutes: route.estimatedMinutes,
      profile: route.profileUsed || 'walking',
    },
  };

  // Start & End node markers
  const startCoords = route.path[0];
  const endCoords = route.path[route.path.length - 1];

  const startPoint: GeoJSON.Feature<GeoJSON.Point> = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: startCoords,
    },
    properties: { nodeType: 'start', label: 'Algus' },
  };

  const endPoint: GeoJSON.Feature<GeoJSON.Point> = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: endCoords,
    },
    properties: { nodeType: 'destination', label: 'Sihtkoht' },
  };

  return {
    type: 'FeatureCollection',
    features: [lineFeature, startPoint, endPoint],
  };
}

export function setupRouteLayer(map: maplibregl.Map, route: RouteResult | null): void {
  const geojson = convertRouteToGeoJson(route);

  if (map.getSource(ROUTE_SOURCE_ID)) {
    const src = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource;
    src.setData(geojson);
    return;
  }

  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  // 1. Casing (Thick semi-transparent line behind route)
  map.addLayer({
    id: ROUTE_CASING_LAYER,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': '#10170F',
      'line-width': 8,
      'line-opacity': 0.5,
    },
  });

  // 2. Active Route Line (Bright Amber/Cyan polyline)
  map.addLayer({
    id: ROUTE_ACTIVE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': '#E9C46A',
      'line-width': 5,
      'line-opacity': 0.95,
    },
  });

  // 3. Start/End Node Markers
  map.addLayer({
    id: ROUTE_NODES_LAYER,
    type: 'circle',
    source: ROUTE_SOURCE_ID,
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-color': [
        'match',
        ['get', 'nodeType'],
        'start', '#2A9D8F',
        'destination', '#E76F51',
        '#FFFFFF',
      ],
      'circle-radius': 7,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#FFFFFF',
    },
  });
}

export function updateRouteLayerData(map: maplibregl.Map, route: RouteResult | null): void {
  const src = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(convertRouteToGeoJson(route));
  }
}
