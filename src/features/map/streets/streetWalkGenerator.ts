/**
 * Tallinn Street Hunt & Field Walk Generator
 * Generates actionable, loop-based field exploration routes based on nearby unexplored streets and useful POIs.
 */

import { GeoPoint, Street, MapPlace, FieldObjectives, FieldReport, SignalObservation } from '../../../types';
import { mapRepository } from '../data/repository';
import { haversineDistanceMeters } from '../../../geo/projection';
import { routingRepository } from '../../../services/routing/routingRepository';

export interface FieldWalkStop {
  id: string;
  name: string;
  type: 'street' | 'place' | 'start' | 'home';
  location: GeoPoint;
  category?: string;
  actionInstruction: string;
}

export interface FieldWalkRoute {
  id: string;
  title: string;
  unexploredStreetsCount: number;
  totalDistanceKm: number;
  estimatedTimeMinutes: number;
  neighborhoodsVisited: string[];
  stops: FieldWalkStop[];
  unexploredStreets: Street[];
  suggestedPlaces: MapPlace[];
  routePath: [number, number][];
  fieldObjectives: FieldObjectives;
  fieldReport?: FieldReport;
  fieldcraftRewards: {
    streetsToDiscover: number;
    placesToFind: number;
    distanceKm: number;
  };
}

/**
 * Calculates nearest point and distance on a street's polyline geometry from a given reference point.
 */
export function getNearestPointOnStreetGeometry(
  street: Street,
  refLoc: GeoPoint
): { nearestPoint: GeoPoint; distanceMeters: number } {
  const coords = street.geometry?.coordinates || [];
  if (coords.length === 0) {
    return { nearestPoint: refLoc, distanceMeters: Infinity };
  }

  if (coords.length === 1) {
    const pt: GeoPoint = { lat: coords[0][1], lng: coords[0][0] };
    return {
      nearestPoint: pt,
      distanceMeters: haversineDistanceMeters(refLoc.lat, refLoc.lng, pt.lat, pt.lng),
    };
  }

  let minDistance = Infinity;
  let bestPoint: GeoPoint = { lat: coords[0][1], lng: coords[0][0] };

  for (let i = 0; i < coords.length - 1; i++) {
    const a: GeoPoint = { lat: coords[i][1], lng: coords[i][0] };
    const b: GeoPoint = { lat: coords[i + 1][1], lng: coords[i + 1][0] };

    // Segment projection calculation
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const l2 = dx * dx + dy * dy;

    let t = 0;
    if (l2 > 0) {
      t = Math.max(0, Math.min(1, ((refLoc.lng - a.lng) * dx + (refLoc.lat - a.lat) * dy) / l2));
    }

    const projPoint: GeoPoint = {
      lat: a.lat + t * dy,
      lng: a.lng + t * dx,
    };

    const dist = haversineDistanceMeters(refLoc.lat, refLoc.lng, projPoint.lat, projPoint.lng);
    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = projPoint;
    }
  }

  return { nearestPoint: bestPoint, distanceMeters: minDistance };
}

/**
 * Requirement #22 & #23: "Discover Tallinn" Pedestrian Graph Route Loop Generator
 * Calculates an actual walking loop over the pedestrian graph:
 * unexplored street + interesting place + second unexplored street + return
 */
export function generateFieldWalkRoute(
  startLoc: GeoPoint = { lat: 59.4370, lng: 24.7535 },
  categoryFilter?: string,
  actualObservations: SignalObservation[] | number = []
): FieldWalkRoute {
  const radioObservationsCount = Array.isArray(actualObservations)
    ? actualObservations.length
    : typeof actualObservations === 'number'
    ? actualObservations
    : 0;

  const allStreets = mapRepository.getAllStreets();
  const sLat = startLoc.lat;
  const sLng = startLoc.lng;
  const safeStart: GeoPoint = { lat: sLat, lng: sLng };

  // 1. Sort unexplored or partially explored streets by orthogonal projection onto real street polyline geometry
  const candidateStreets = allStreets
    .filter((s) => (s.exploredPercent || 0) < 100)
    .map((s) => {
      const { nearestPoint, distanceMeters } = getNearestPointOnStreetGeometry(s, safeStart);
      return { street: s, distanceMeters, nearestPoint };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const selectedStreets = candidateStreets.slice(0, 2);

  // 2. Find nearby useful places from mapRepository (optionally filtered by category)
  let nearbyPlaces = mapRepository.getNearbyPlaces(startLoc, 3000);
  if (categoryFilter) {
    nearbyPlaces = nearbyPlaces.filter(
      (p) => p.mainCategory === categoryFilter || p.subCategory === categoryFilter
    );
  }
  const selectedPlaces = nearbyPlaces.slice(0, 1);

  // 3. Build ordered stops loop:
  // START -> Unexplored Street 1 -> Interesting Place -> Unexplored Street 2 -> Return
  const stops: FieldWalkStop[] = [
    {
      id: 'stop_start',
      name: 'Current Position (Start)',
      type: 'start',
      location: safeStart,
      actionInstruction: 'Begin field walk and log GPS signal trail',
    },
  ];

  if (selectedStreets[0]) {
    const s1 = selectedStreets[0];
    stops.push({
      id: `stop_${s1.street.id}`,
      name: s1.street.name,
      type: 'street',
      location: s1.nearestPoint,
      actionInstruction: `Explore segment on ${s1.street.name} (${s1.street.district || 'Tallinn'})`,
    });
  }

  if (selectedPlaces[0]) {
    const p1 = selectedPlaces[0];
    stops.push({
      id: `stop_${p1.id}`,
      name: p1.name,
      type: 'place',
      category: p1.mainCategory,
      location: p1.location,
      actionInstruction: `Visit & verify place: ${p1.description || p1.address || 'Useful Place'}`,
    });
  }

  if (selectedStreets[1]) {
    const s2 = selectedStreets[1];
    stops.push({
      id: `stop_${s2.street.id}`,
      name: s2.street.name,
      type: 'street',
      location: s2.nearestPoint,
      actionInstruction: `Traverse unexplored segment on ${s2.street.name}`,
    });
  }

  stops.push({
    id: 'stop_home',
    name: 'Campfire Core (Return)',
    type: 'home',
    location: safeStart,
    actionInstruction: 'Return to origin, confirm objectives & sync mesh logs',
  });

  // 4. Calculate actual pedestrian graph path using routingRepository between consecutive stops
  let fullRoutePath: [number, number][] = [];
  let totalDistanceMeters = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].location;
    const to = stops[i + 1].location;

    const route = routingRepository.planRoute(from, to, { profile: 'walking' });

    if (route && route.path.length > 0) {
      if (fullRoutePath.length > 0) {
        fullRoutePath = fullRoutePath.concat(route.path.slice(1));
      } else {
        fullRoutePath = route.path;
      }
      totalDistanceMeters += route.totalDistanceMeters;
    } else {
      totalDistanceMeters += haversineDistanceMeters(from.lat, from.lng, to.lat, to.lng);
      fullRoutePath.push([from.lng, from.lat], [to.lng, to.lat]);
    }
  }

  const totalDistanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));
  const estimatedTimeMinutes = Math.max(15, Math.round(totalDistanceKm * 12.5)); // ~4.8 km/h walking pace

  const rawSelectedStreets = selectedStreets.map((s) => s.street);
  const neighborhoodsVisited = Array.from(
    new Set(rawSelectedStreets.map((s) => s.district).filter(Boolean) as string[])
  );
  if (neighborhoodsVisited.length === 0) neighborhoodsVisited.push('Kesklinn / Kalamaja');

  const fieldObjectives: FieldObjectives = {
    discoverStreetSegments: rawSelectedStreets.length,
    visitPlacesCount: selectedPlaces.length,
    observeMeshSignal: true,
    returnToCampfire: true,
    targetDistanceKm: Math.max(1.2, totalDistanceKm),
  };

  const fieldReport: FieldReport = {
    id: `report_${Date.now()}`,
    timestamp: Date.now(),
    streetsDiscoveredCount: rawSelectedStreets.length,
    placesConfirmedCount: selectedPlaces.length,
    distanceKm: Math.max(1.2, totalDistanceKm),
    radioObservationsCount: Array.isArray(actualObservations)
      ? actualObservations.length
      : radioObservationsCount,
    neighborhoodsVisited,
    durationMinutes: estimatedTimeMinutes,
  };

  return {
    id: `walk_${Date.now()}`,
    title: "Surprise Me Field Loop",
    unexploredStreetsCount: rawSelectedStreets.length,
    totalDistanceKm: Math.max(1.2, totalDistanceKm),
    estimatedTimeMinutes,
    neighborhoodsVisited,
    stops,
    unexploredStreets: rawSelectedStreets,
    suggestedPlaces: selectedPlaces,
    routePath: fullRoutePath,
    fieldObjectives,
    fieldReport,
    fieldcraftRewards: {
      streetsToDiscover: rawSelectedStreets.length,
      placesToFind: selectedPlaces.length,
      distanceKm: Math.max(1.2, totalDistanceKm),
    },
  };
}
