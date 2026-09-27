import { Street, StreetSegment, GeoPoint } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';

export interface IndexedSegment {
  segment: StreetSegment;
  street: Street;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Lightweight Spatial Grid Hash Index for Tallinn Street Segments.
 * Allows O(1) grid bucket lookups for GPS fixes instead of iterating through every segment.
 */
export class SpatialSegmentIndex {
  // Grid size ~ 0.002 degrees (~200m)
  private readonly cellSize = 0.002;
  private grid: Map<string, IndexedSegment[]> = new Map();
  private allSegments: IndexedSegment[] = [];

  constructor(streets: Street[]) {
    this.buildIndex(streets);
  }

  private getCellKey(lat: number, lng: number): string {
    const latIndex = Math.floor(lat / this.cellSize);
    const lngIndex = Math.floor(lng / this.cellSize);
    return `${latIndex}:${lngIndex}`;
  }

  public buildIndex(streets: Street[]): void {
    this.grid.clear();
    this.allSegments = [];

    for (const street of streets) {
      for (const segment of street.segments || []) {
        const minLat = Math.min(segment.start.lat, segment.end.lat);
        const maxLat = Math.max(segment.start.lat, segment.end.lat);
        const minLng = Math.min(segment.start.lng, segment.end.lng);
        const maxLng = Math.max(segment.start.lng, segment.end.lng);

        const item: IndexedSegment = {
          segment,
          street,
          minLat,
          maxLat,
          minLng,
          maxLng,
        };
        this.allSegments.push(item);

        // Map segment into all overlapping cells
        const minCellLat = Math.floor(minLat / this.cellSize);
        const maxCellLat = Math.floor(maxLat / this.cellSize);
        const minCellLng = Math.floor(minLng / this.cellSize);
        const maxCellLng = Math.floor(maxLng / this.cellSize);

        for (let clat = minCellLat; clat <= maxCellLat; clat++) {
          for (let clng = minCellLng; clng <= maxCellLng; clng++) {
            const key = `${clat}:${clng}`;
            let list = this.grid.get(key);
            if (!list) {
              list = [];
              this.grid.set(key, list);
            }
            list.push(item);
          }
        }
      }
    }
  }

  /**
   * Retrieves candidate segments within search radius in meters around the query point.
   */
  public queryCandidates(point: GeoPoint, radiusMeters: number = 50): IndexedSegment[] {
    // Convert radius to approximate degree offsets
    const latDegOffset = (radiusMeters / 111320) + this.cellSize;
    const lngDegOffset = (radiusMeters / (111320 * Math.cos((point.lat * Math.PI) / 180))) + this.cellSize;

    const minCellLat = Math.floor((point.lat - latDegOffset) / this.cellSize);
    const maxCellLat = Math.floor((point.lat + latDegOffset) / this.cellSize);
    const minCellLng = Math.floor((point.lng - lngDegOffset) / this.cellSize);
    const maxCellLng = Math.floor((point.lng + lngDegOffset) / this.cellSize);

    const candidates = new Set<IndexedSegment>();

    for (let clat = minCellLat; clat <= maxCellLat; clat++) {
      for (let clng = minCellLng; clng <= maxCellLng; clng++) {
        const key = `${clat}:${clng}`;
        const items = this.grid.get(key);
        if (items) {
          for (const item of items) {
            candidates.add(item);
          }
        }
      }
    }

    return Array.from(candidates);
  }

  public getAllIndexedCount(): number {
    return this.allSegments.length;
  }
}
