/**
 * Canonical HÕIMU Map Repository API
 * Provides a unified abstraction layer for streets, places, and discovery queries.
 * Hides storage/source details (JSON, PMTiles, IndexedDB) behind one clean API.
 */

import { Street, MapPlace, GeoPoint, PlaceMainCategory, DataSource } from '../../../types';
import { streetDiscoveryService } from '../streets/streetDiscoveryService';
import { TALLINN_MAP_PLACES } from '../places/placeData';
import { searchPlaces as performPlaceSearch } from '../places/placeSearch';
import { calculateNearbyReport } from '../places/nearbyEngine';

export interface PlaceFilter {
  category?: PlaceMainCategory;
  subCategory?: string;
  source?: DataSource;
  maxDistanceMeters?: number;
}

export interface MapRepository {
  getStreet(id: string): Street | undefined;
  getAllStreets(): Street[];
  searchStreets(query: string): Street[];

  getPlace(id: string): MapPlace | undefined;
  getAllPlaces(): MapPlace[];
  getNearbyPlaces(
    location: GeoPoint,
    radiusMeters?: number,
    filter?: PlaceFilter
  ): MapPlace[];
  searchPlaces(
    query: string,
    location?: GeoPoint
  ): MapPlace[];
}

export class TallinnMapRepository implements MapRepository {
  private static instance: TallinnMapRepository | null = null;

  public static getInstance(): TallinnMapRepository {
    if (!TallinnMapRepository.instance) {
      TallinnMapRepository.instance = new TallinnMapRepository();
    }
    return TallinnMapRepository.instance;
  }

  public getStreet(id: string): Street | undefined {
    return streetDiscoveryService.getStreetById(id);
  }

  public getAllStreets(): Street[] {
    return streetDiscoveryService.getStreets();
  }

  public searchStreets(query: string): Street[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.getAllStreets().filter(
      (s) => s.name.toLowerCase().includes(q) || (s.district && s.district.toLowerCase().includes(q))
    );
  }

  public getPlace(id: string): MapPlace | undefined {
    return TALLINN_MAP_PLACES.find((p) => p.id === id);
  }

  public getAllPlaces(): MapPlace[] {
    return TALLINN_MAP_PLACES;
  }

  public getNearbyPlaces(
    location: GeoPoint = { lat: 59.4370, lng: 24.7535 },
    radiusMeters: number = 3000,
    filter?: PlaceFilter
  ): MapPlace[] {
    const report = calculateNearbyReport(location, radiusMeters, TALLINN_MAP_PLACES);
    let places = report.allNearbyPlaces;

    if (filter) {
      if (filter.category) {
        places = places.filter((p) => p.mainCategory === filter.category);
      }
      if (filter.subCategory) {
        places = places.filter((p) => p.subCategory === filter.subCategory);
      }
      if (filter.source) {
        places = places.filter((p) => p.source === filter.source);
      }
    }

    return places;
  }

  public searchPlaces(
    query: string,
    location?: GeoPoint
  ): MapPlace[] {
    return performPlaceSearch(query, location, 10000, TALLINN_MAP_PLACES);
  }
}

export const mapRepository = TallinnMapRepository.getInstance();
