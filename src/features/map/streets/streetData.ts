/**
 * Canonical Tallinn Street Database
 * Real-world geographic coordinates [lng, lat] and segmented representations
 * derived from normalized OSM pedestrian network.
 */

import { Street, StreetSegment, GeoPoint } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';
import { OSM_PEDESTRIAN_NETWORK, WalkableWay } from '../../../../tools/map-data/osm/pedestrian';

function generateSegments(streetId: string, coords: [number, number][], discoveredIds: Set<string>): { segments: StreetSegment[]; totalMeters: number; discoveredMeters: number; exploredPercent: number } {
  const segments: StreetSegment[] = [];
  let totalMeters = 0;
  let discoveredMeters = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const start: GeoPoint = { lat: coords[i][1], lng: coords[i][0] };
    const end: GeoPoint = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const segId = `${streetId}_seg_${i + 1}`;
    const length = Math.round(haversineDistanceMeters(start.lat, start.lng, end.lat, end.lng));
    const isDiscovered = discoveredIds.has(segId);

    totalMeters += length;
    if (isDiscovered) {
      discoveredMeters += length;
    }

    segments.push({
      id: segId,
      streetId,
      start,
      end,
      lengthMeters: length,
      discoveryState: isDiscovered ? 'discovered' : 'unexplored',
    });
  }

  const exploredPercent = totalMeters > 0 ? Math.round((discoveredMeters / totalMeters) * 100) : 0;
  return { segments, totalMeters, discoveredMeters, exploredPercent };
}

export const RAW_TALLINN_STREETS: Array<{
  id: string;
  name: string;
  district: string;
  highwayClass: string;
  walkable: boolean;
  bicycle: boolean;
  coordinates: [number, number][]; // [lng, lat]
}> = OSM_PEDESTRIAN_NETWORK.map((w) => ({
  id: w.id,
  name: w.name,
  district: w.district,
  highwayClass: w.highwayClass,
  walkable: w.walkable,
  bicycle: w.bicycle,
  coordinates: w.coordinates,
}));

export function getTallinnStreets(discoveredSegmentIds: Set<string> = new Set()): Street[] {
  return OSM_PEDESTRIAN_NETWORK.map((raw) => {
    const { segments, totalMeters, discoveredMeters, exploredPercent } = generateSegments(raw.id, raw.coordinates, discoveredSegmentIds);
    return {
      id: raw.id,
      name: raw.name,
      district: raw.district,
      highwayClass: raw.highwayClass,
      walkable: raw.walkable,
      bicycle: raw.bicycle,
      lengthMeters: totalMeters,
      discoveredMeters,
      exploredPercent,
      segments,
      geometry: {
        coordinates: raw.coordinates,
      },
    };
  });
}
