/**
 * Camera Gestures & Motion Controller for ExploreMap
 */

import type * as maplibregl from 'maplibre-gl';
import { GeoPoint } from '../../../types';

export function flyToPoint(map: maplibregl.Map, point: GeoPoint, zoom: number = 15): void {
  if (!map) return;
  map.flyTo({
    center: [point.lng, point.lat],
    zoom,
    pitch: 25,
    duration: 1200,
  });
}

export function fitToGeoJsonBounds(map: maplibregl.Map, path: [number, number][]): void {
  if (!map || path.length < 2) return;

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of path) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    {
      padding: { top: 80, bottom: 120, left: 50, right: 50 },
      maxZoom: 16,
      duration: 1000,
    }
  );
}

export function resetMapNorth(map: maplibregl.Map): void {
  if (!map) return;
  map.easeTo({
    bearing: 0,
    pitch: 0,
    duration: 500,
  });
}
