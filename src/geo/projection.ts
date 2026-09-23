/**
 * HÕIMU Geo-Spatial Projection Utilities
 * 
 * Provides accurate local metric projection (equirectangular flat-earth approximation
 * calibrated for Estonian latitudes ~58°-59.5° N) and spherical geodesy calculations.
 */

const EARTH_RADIUS_METERS = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Converts WGS84 (Lat, Lng) to local tangent plane coordinates (X: East, Y: North in meters)
 * relative to an arbitrary reference center.
 */
export function geoToLocalMeters(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number
): { x: number; y: number } {
  const avgLatRad = ((lat + centerLat) / 2) * DEG_TO_RAD;
  const metersPerLatDegree = 111320;
  const metersPerLngDegree = 111320 * Math.cos(avgLatRad);

  const x = (lng - centerLng) * metersPerLngDegree;
  const y = (lat - centerLat) * metersPerLatDegree;

  return { x, y };
}

/**
 * Converts local tangent plane coordinates (meters) back to WGS84 (Lat, Lng).
 */
export function localMetersToGeo(
  x: number,
  y: number,
  centerLat: number,
  centerLng: number
): { lat: number; lng: number } {
  const avgLatRad = centerLat * DEG_TO_RAD;
  const metersPerLatDegree = 111320;
  const metersPerLngDegree = 111320 * Math.cos(avgLatRad);

  const lat = centerLat + y / metersPerLatDegree;
  const lng = centerLng + x / metersPerLngDegree;

  return { lat, lng };
}

/**
 * Calculates great-circle distance between two points in meters using Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial forward azimuth / bearing in degrees (0° - 360°) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const y = Math.sin((lng2 - lng1) * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD);
  const x =
    Math.cos(lat1 * DEG_TO_RAD) * Math.sin(lat2 * DEG_TO_RAD) -
    Math.sin(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.cos((lng2 - lng1) * DEG_TO_RAD);

  const bearingRad = Math.atan2(y, x);
  return (bearingRad * RAD_TO_DEG + 360) % 360;
}
