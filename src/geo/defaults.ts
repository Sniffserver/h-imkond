/**
 * HÕIMU Unified Geographic Defaults
 * 
 * Single source of truth for Estonian regional centers, bounding boxes, and default projections.
 */

export const DEFAULT_CITY_ID = 'tallinn';

export interface CityGeoConfig {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export const ESTONIA_CITY_DEFAULTS: Record<string, CityGeoConfig> = {
  tallinn: {
    id: 'tallinn',
    name: 'Tallinn',
    lat: 59.4370,
    lng: 24.7535,
    zoom: 13,
    bbox: [24.50, 59.34, 25.00, 59.53],
  },
  tartu: {
    id: 'tartu',
    name: 'Tartu',
    lat: 58.3780,
    lng: 26.7290,
    zoom: 13,
    bbox: [26.60, 58.32, 26.85, 58.42],
  },
  parnu: {
    id: 'parnu',
    name: 'Pärnu',
    lat: 58.3859,
    lng: 24.4971,
    zoom: 13,
    bbox: [24.40, 58.33, 24.60, 58.44],
  },
  narva: {
    id: 'narva',
    name: 'Narva',
    lat: 59.3797,
    lng: 28.1791,
    zoom: 13,
    bbox: [28.10, 59.33, 28.25, 59.42],
  },
};

export const ESTONIA_NATIONAL_BBOX: [number, number, number, number] = [21.76, 57.51, 28.21, 59.68];
