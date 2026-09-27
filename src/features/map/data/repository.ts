/**
 * Canonical HÕIMU Map Repository API
 * Provides a unified abstraction layer for streets, places, and discovery queries.
 * Hides storage/source details (Local Snapshot, IndexedDB / localStorage, PMTiles) behind one clean API.
 */

import { Street, MapPlace, GeoPoint, PlaceMainCategory, DataSource } from '../../../types';
import { streetDiscoveryService } from '../streets/streetDiscoveryService';
import { TALLINN_MAP_PLACES } from '../places/placeData';
import { searchPlaces as performPlaceSearch } from '../places/placeSearch';
import { calculateNearbyReport } from '../places/nearbyEngine';
import generatedPlaces from '../../../data/generated/tallinn-places.json';

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

  // Storage / Snapshot Persistence
  savePlace(place: MapPlace): void;
  importPlacesSnapshot(places: MapPlace[]): void;
  resetToSnapshot(): void;
}

const STORAGE_KEY_PLACES = 'hoimu_map_places_cache_v1';

export class TallinnMapRepository implements MapRepository {
  private static instance: TallinnMapRepository | null = null;
  private placesCache: Map<string, MapPlace> = new Map();

  private constructor() {
    this.hydrateFromStorage();
  }

  public static getInstance(): TallinnMapRepository {
    if (!TallinnMapRepository.instance) {
      TallinnMapRepository.instance = new TallinnMapRepository();
    }
    return TallinnMapRepository.instance;
  }

  private hydrateFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY_PLACES);
        if (stored) {
          const parsed = JSON.parse(stored) as MapPlace[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((p) => this.placesCache.set(p.id, p));
            return;
          }
        }
      }
    } catch {
      // Fallback to base snapshot
    }

    // Initialize with canonical generated map-pack POI dataset
    if (Array.isArray(generatedPlaces) && generatedPlaces.length > 0) {
      (generatedPlaces as unknown as MapPlace[]).forEach((p) => this.placesCache.set(p.id, p));
    } else {
      TALLINN_MAP_PLACES.forEach((p) => this.placesCache.set(p.id, p));
    }
  }

  private persistToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.placesCache.values());
        localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(list));
      }
    } catch {
      // Storage quota or unavailable in testing environment
    }
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
    return this.placesCache.get(id);
  }

  public getAllPlaces(): MapPlace[] {
    return Array.from(this.placesCache.values());
  }

  public savePlace(place: MapPlace): void {
    this.placesCache.set(place.id, place);
    this.persistToStorage();
  }

  public importPlacesSnapshot(places: MapPlace[]): void {
    places.forEach((p) => this.placesCache.set(p.id, p));
    this.persistToStorage();
  }

  public resetToSnapshot(): void {
    this.placesCache.clear();
    if (Array.isArray(generatedPlaces) && generatedPlaces.length > 0) {
      (generatedPlaces as unknown as MapPlace[]).forEach((p) => this.placesCache.set(p.id, p));
    } else {
      TALLINN_MAP_PLACES.forEach((p) => this.placesCache.set(p.id, p));
    }
    this.persistToStorage();
  }

  public getNearbyPlaces(
    location: GeoPoint = { lat: 59.4370, lng: 24.7535 },
    radiusMeters: number = 3000,
    filter?: PlaceFilter
  ): MapPlace[] {
    const all = this.getAllPlaces();
    const report = calculateNearbyReport(location, radiusMeters, all);
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
    return performPlaceSearch(query, location, 10000, this.getAllPlaces());
  }
}

export const mapRepository = TallinnMapRepository.getInstance();
