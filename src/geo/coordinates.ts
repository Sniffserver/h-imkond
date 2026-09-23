/**
 * HÕIMU Geo-Coordinate Parsing and Formatting Utilities
 */

import { ESTONIA_CITY_DEFAULTS, ESTONIA_NATIONAL_BBOX } from './defaults';
import { haversineDistanceMeters } from './projection';

/**
 * Parses coordinate strings like "59.4370° N, 24.7535° E" or "59.437, 24.7535" into [lat, lng].
 */
export function parseCoordinateString(text: string): [number, number] | null {
  if (!text || typeof text !== 'string') return null;

  // Try standard degree decimal or DMS formats
  const clean = text.replace(/[°'"]/g, '').trim();
  const parts = clean.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

  if (parts.length >= 2) {
    let lat = parseFloat(parts[0]);
    let lng = parseFloat(parts[1]);

    if (parts[0].toUpperCase().endsWith('S')) lat = -lat;
    if (parts[1].toUpperCase().endsWith('W')) lng = -lng;

    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }

  // Regex match for formatted strings
  const match = text.match(/([0-9.]+)\s*°?\s*([NS])?[,\s]+([0-9.]+)\s*°?\s*([EW])?/i);
  if (match) {
    let lat = parseFloat(match[1]);
    let lng = parseFloat(match[3]);
    if (match[2] && match[2].toUpperCase() === 'S') lat = -lat;
    if (match[4] && match[4].toUpperCase() === 'W') lng = -lng;
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }

  return null;
}

/**
 * Formats coordinates nicely for field UI display: "59.4370° N, 24.7535° E"
 */
export function formatCoordinates(lat: number, lng: number, precision = 4): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(precision)}° ${latDir}, ${Math.abs(lng).toFixed(precision)}° ${lngDir}`;
}

/**
 * Checks if a coordinate is within Estonia's bounding box.
 */
export function isWithinEstonia(lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = ESTONIA_NATIONAL_BBOX;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/**
 * Finds the closest regional city center to a given location.
 */
export function getClosestCity(lat: number, lng: number): string {
  let closestCityId = 'tallinn';
  let minDistance = Infinity;

  for (const [id, config] of Object.entries(ESTONIA_CITY_DEFAULTS)) {
    const dist = haversineDistanceMeters(lat, lng, config.lat, config.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestCityId = id;
    }
  }

  return closestCityId;
}
