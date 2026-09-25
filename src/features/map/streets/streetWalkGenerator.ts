/**
 * Tallinn Street Hunt & Field Walk Generator
 * Generates actionable, loop-based field exploration routes based on nearby unexplored streets and useful POIs.
 */

import { GeoPoint, Street, MapPlace } from '../../../types';
import { mapRepository } from '../data/repository';
import { haversineDistanceMeters } from '../../../geo/projection';

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
  stops: FieldWalkStop[];
  unexploredStreets: Street[];
  suggestedPlaces: MapPlace[];
  fieldcraftRewards: {
    streetsToDiscover: number;
    placesToFind: number;
    distanceKm: number;
  };
}

export function generateFieldWalkRoute(
  startLoc: GeoPoint = { lat: 59.4370, lng: 24.7535 }
): FieldWalkRoute {
  const allStreets = mapRepository.getAllStreets();
  const sLat = startLoc.lat;
  const sLng = startLoc.lng;
  const safeStart: GeoPoint = { lat: sLat, lng: sLng };
  
  // 1. Sort unexplored or partially explored streets by distance from start
  const candidateStreets = allStreets
    .filter((s) => (s.exploredPercent || 0) < 100)
    .map((s) => {
      const firstPt: GeoPoint = { lat: s.geometry.coordinates[0][1], lng: s.geometry.coordinates[0][0] };
      const dist = haversineDistanceMeters(sLat, sLng, firstPt.lat, firstPt.lng);
      return { street: s, distanceMeters: dist, firstPt };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const selectedStreets = candidateStreets.slice(0, 3).map((c) => c.street);

  // 2. Find nearby useful places from mapRepository
  const nearbyPlaces = mapRepository.getNearbyPlaces(startLoc, 3000);
  const selectedPlaces = nearbyPlaces.slice(0, 2);

  // 3. Build ordered stops loop: START -> Street 1 -> POI 1 -> Street 2 -> Street 3 -> HOME
  const stops: FieldWalkStop[] = [
    {
      id: 'stop_start',
      name: 'Current Position (Start)',
      type: 'start',
      location: safeStart,
      actionInstruction: 'Begin field walk and activate GPS trace',
    },
  ];

  if (selectedStreets[0]) {
    const s1 = selectedStreets[0];
    stops.push({
      id: `stop_${s1.id}`,
      name: s1.name,
      type: 'street',
      location: { lat: s1.geometry.coordinates[0][1], lng: s1.geometry.coordinates[0][0] },
      actionInstruction: `Explore ${s1.district || 'district'} (${s1.exploredPercent || 0}% currently mapped)`,
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
      actionInstruction: `Verify place: ${p1.description || p1.address || 'Field Place'}`,
    });
  }

  if (selectedStreets[1]) {
    const s2 = selectedStreets[1];
    stops.push({
      id: `stop_${s2.id}`,
      name: s2.name,
      type: 'street',
      location: { lat: s2.geometry.coordinates[0][1], lng: s2.geometry.coordinates[0][0] },
      actionInstruction: `Traverse segment across ${s2.name}`,
    });
  }

  if (selectedStreets[2]) {
    const s3 = selectedStreets[2];
    stops.push({
      id: `stop_${s3.id}`,
      name: s3.name,
      type: 'street',
      location: { lat: s3.geometry.coordinates[0][1], lng: s3.geometry.coordinates[0][0] },
      actionInstruction: `Complete exploration loop on ${s3.name}`,
    });
  }

  stops.push({
    id: 'stop_home',
    name: 'Campfire Core (Return)',
    type: 'home',
    location: safeStart,
    actionInstruction: 'Return to local campfire node and sync mesh logs',
  });

  // Calculate total loop distance
  let totalDistanceMeters = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const latA = stops[i].location.lat ?? stops[i].location.latitude ?? 0;
    const lngA = stops[i].location.lng ?? stops[i].location.longitude ?? 0;
    const latB = stops[i + 1].location.lat ?? stops[i + 1].location.latitude ?? 0;
    const lngB = stops[i + 1].location.lng ?? stops[i + 1].location.longitude ?? 0;
    totalDistanceMeters += haversineDistanceMeters(latA, lngA, latB, lngB);
  }

  const totalDistanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));
  const estimatedTimeMinutes = Math.round(totalDistanceKm * 12); // ~5 km/h walking pace

  return {
    id: `walk_${Date.now()}`,
    title: "Today's Field Walk Route",
    unexploredStreetsCount: selectedStreets.length,
    totalDistanceKm: Math.max(1.2, totalDistanceKm),
    estimatedTimeMinutes: Math.max(15, estimatedTimeMinutes),
    stops,
    unexploredStreets: selectedStreets,
    suggestedPlaces: selectedPlaces,
    fieldcraftRewards: {
      streetsToDiscover: selectedStreets.length,
      placesToFind: selectedPlaces.length,
      distanceKm: Math.max(1.2, totalDistanceKm),
    },
  };
}
