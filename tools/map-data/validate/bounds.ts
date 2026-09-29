/**
 * Geographic Bounds Validation
 */

import { BoundingBox, TALLINN_BBOX } from '../types';

export function isWithinBoundingBox(lat: number, lng: number, bbox: BoundingBox = TALLINN_BBOX): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}
