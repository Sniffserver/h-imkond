// Offline Vector Street Network Graph & A* Metric Pathfinding Engine
import { VectorStreet } from '../types';
import { RoutingEngine, RouteOptions, RoutingProfileType } from '../services/routing/routingEngine';

export interface RouteStep {
  instruction: string;
  streetName: string;
  distanceMeters: number;
  distanceM?: number;
}

export interface RouteResult {
  path: [number, number][];
  totalDistanceMeters: number;
  totalDistanceM?: number;
  estimatedWalkMinutes: number;
  estimatedWalkMin?: number;
  estimatedBikeMinutes: number;
  estimatedBikeMin?: number;
  estimatedWheelchairMinutes?: number;
  estimatedEmergencyMinutes?: number;
  steps: RouteStep[];
  profileUsed?: RoutingProfileType;
}

/**
 * Plans an offline route using the high-performance Metric Routing Engine.
 * Supports projected metric coordinates, profile weighting (walking, bike, wheelchair, emergency),
 * and hazard avoidance (stairs, unsafe zones).
 */
export function planOfflineRoute(
  streets: VectorStreet[],
  start: { x: number; y: number },
  destination: { x: number; y: number },
  options: RouteOptions = {}
): RouteResult {
  if (!streets || streets.length === 0) {
    const dx = destination.x - start.x;
    const dy = destination.y - start.y;
    // Euclidean distance in projected meters
    const rawDist = Math.hypot(dx, dy);
    const distMeters = Math.max(10, Math.round(rawDist > 180 ? rawDist * 10 : rawDist * 111320));

    return {
      path: [
        [start.x, start.y],
        [destination.x, destination.y],
      ],
      totalDistanceMeters: distMeters,
      totalDistanceM: distMeters,
      estimatedWalkMinutes: Math.max(1, Math.round(distMeters / 75)),
      estimatedBikeMinutes: Math.max(1, Math.round(distMeters / 250)),
      estimatedWheelchairMinutes: Math.max(1, Math.round(distMeters / 55)),
      estimatedEmergencyMinutes: Math.max(1, Math.round(distMeters / 660)),
      steps: [
        {
          instruction: 'Otsetee sihtpunkti (otsetrajektoor)',
          streetName: 'Otsetee',
          distanceMeters: distMeters,
          distanceM: distMeters,
        },
      ],
      profileUsed: options.profile || 'walking',
    };
  }

  // Convert VectorStreet[] format into street inputs for RoutingEngine
  const convertedStreets = streets.map((st, idx) => ({
    id: `street_${idx}`,
    name: st.name || 'Nimetu tee',
    coordinates: (st.points || []).map((p) => [p[0], p[1]] as [number, number]),
    type: st.type,
  }));

  const engine = RoutingEngine.fromVectorStreets(convertedStreets);

  // Determine if coordinates are WGS84 [lng, lat] or projected grid
  const isWgs84 = Math.abs(start.x) <= 180 && Math.abs(start.y) <= 90;

  const originLat = isWgs84 ? start.y : start.y / 111320;
  const originLng = isWgs84 ? start.x : start.x / 111320;
  const destLat = isWgs84 ? destination.y : destination.y / 111320;
  const destLng = isWgs84 ? destination.x : destination.x / 111320;

  const result = engine.planRoute(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng },
    options
  );

  if (!result) {
    // Direct path fallback
    const distMeters = Math.round(Math.hypot(destination.x - start.x, destination.y - start.y) * (isWgs84 ? 111320 : 10));
    return {
      path: [[start.x, start.y], [destination.x, destination.y]],
      totalDistanceMeters: distMeters,
      totalDistanceM: distMeters,
      estimatedWalkMinutes: Math.max(1, Math.round(distMeters / 75)),
      estimatedBikeMinutes: Math.max(1, Math.round(distMeters / 250)),
      estimatedWheelchairMinutes: Math.max(1, Math.round(distMeters / 55)),
      estimatedEmergencyMinutes: Math.max(1, Math.round(distMeters / 660)),
      steps: [
        {
          instruction: 'Otsetee sihtpunkti',
          streetName: 'Otsetee',
          distanceMeters: distMeters,
          distanceM: distMeters,
        },
      ],
      profileUsed: options.profile || 'walking',
    };
  }

  // Map result path back to original coordinate system
  const finalPath: [number, number][] = result.path.map(([lng, lat]) => [
    isWgs84 ? lng : lng * 111320,
    isWgs84 ? lat : lat * 111320,
  ]);

  return {
    path: finalPath,
    totalDistanceMeters: result.totalDistanceMeters,
    totalDistanceM: result.totalDistanceMeters,
    estimatedWalkMinutes: Math.max(1, Math.round(result.totalDistanceMeters / 75)),
    estimatedBikeMinutes: Math.max(1, Math.round(result.totalDistanceMeters / 250)),
    estimatedWheelchairMinutes: Math.max(1, Math.round(result.totalDistanceMeters / 54)),
    estimatedEmergencyMinutes: Math.max(1, Math.round(result.totalDistanceMeters / 660)),
    steps: result.steps.map((s) => ({
      ...s,
      distanceM: s.distanceMeters,
    })),
    profileUsed: result.profileUsed,
  };
}
