/**
 * Web Worker for Off-Main-Thread Deterministic Search Indexing & Queries
 * 
 * Prevents main thread UI stutter during fast user typing.
 */

import { PlaceSearchIndex, SearchHit } from '../map/places/placeSearchIndex';
import { MapPlace, Street, GeoPoint } from '../../types';

let searchIndex: PlaceSearchIndex | null = null;

export interface WorkerInitMessage {
  type: 'INIT';
  places: MapPlace[];
  streets: Street[];
}

export interface WorkerSearchMessage {
  type: 'SEARCH';
  id: string;
  query: string;
  userLocation?: GeoPoint;
  limit?: number;
}

export type WorkerInMessage = WorkerInitMessage | WorkerSearchMessage;

export interface WorkerSearchResponseMessage {
  type: 'SEARCH_RESULT';
  id: string;
  results: SearchHit[];
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'INIT') {
    searchIndex = new PlaceSearchIndex(data.places, data.streets);
    self.postMessage({ type: 'INIT_DONE' });
  } else if (data.type === 'SEARCH') {
    if (!searchIndex) {
      self.postMessage({ type: 'SEARCH_RESULT', id: data.id, results: [] });
      return;
    }

    const hits = searchIndex.search(data.query, data.userLocation);
    const topHits = hits.slice(0, data.limit || 6);

    const response: WorkerSearchResponseMessage = {
      type: 'SEARCH_RESULT',
      id: data.id,
      results: topHits,
    };

    self.postMessage(response);
  }
};
