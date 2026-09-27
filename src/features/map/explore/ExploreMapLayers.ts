/**
 * Layer Management for ExploreMap
 * Configures basemap vector layers and mounts dynamic overlay layers.
 */

import type * as maplibregl from 'maplibre-gl';
import { setupUserLocationLayer, updateUserLocationData } from './overlays/UserLocationLayer';
import { setupPlacesLayer, updatePlacesLayerData, PLACES_UNCLUSTERED_POINT_LAYER } from './overlays/PlacesLayer';
import { setupPeopleLayer, updatePeopleLayerData } from './overlays/PeopleLayer';
import { setupResourcesLayer, updateResourcesLayerData } from './overlays/ResourcesLayer';
import { setupMeshLinksLayer, updateMeshLinksLayerData } from './overlays/MeshLinksLayer';
import { setupSignalTrailLayer, updateSignalTrailData } from './overlays/SignalTrailLayer';
import { setupDiscoveryLayer, updateDiscoveryLayerData } from './overlays/DiscoveryLayer';
import { setupRouteLayer, updateRouteLayerData } from './overlays/RouteLayer';
import { MapPlace, Street, GeoPoint, SignalObservation } from '../../../types';
import { RouteResult } from '../../../services/routing/routingEngine';
import { PeerMapMarker } from './overlays/PeopleLayer';
import { ResourceItem } from './overlays/ResourcesLayer';
import { MeshLink } from './overlays/MeshLinksLayer';

export interface OverlayData {
  userLocation?: GeoPoint;
  places: MapPlace[];
  streets: Street[];
  peers?: PeerMapMarker[];
  resources?: ResourceItem[];
  meshLinks?: MeshLink[];
  signalTrail?: SignalObservation[];
  route?: RouteResult | null;
}

/**
 * Section 38: 10-Step Unified Tactical Map Layer Pipeline
 * Step 1: Base MapLibre & PMTiles Protocol
 * Step 2: Vector Basemap Layers (Roads, Buildings, Water, Landuse, Places, Labels)
 * Step 3: Dynamic GeoJSON User Location & Accuracy Pulse
 * Step 4: Places (Clustered POIs with Categories & Inspector)
 * Step 5: Resources (Mutual Aid Tools, Energy Hubs, Water)
 * Step 6: Peers (Mesh Nodes with Callsigns & RSSI)
 * Step 7: Mesh Links (Active Peer-to-Peer RF Links)
 * Step 8: Signal Trail (Color-Coded Spatial Observations)
 * Step 9: Street Discovery (Explored vs Unexplored Road Segments)
 * Step 10: Routing (A* Walk Loops & Offline Route Lines)
 */
export function setupAllOverlayLayers(map: maplibregl.Map, data: OverlayData): void {
  // Step 9: Street Discovery Layer (Background street network)
  setupDiscoveryLayer(map, data.streets);

  // Step 8: Signal Trail Layer (Breadcrumbs & radio landscape)
  setupSignalTrailLayer(map, data.signalTrail || []);

  // Step 7: Mesh Links Layer (Active RF connections)
  setupMeshLinksLayer(map, data.meshLinks || []);

  // Step 10: Active Route Layer (A* pathfinding line)
  setupRouteLayer(map, data.route || null);

  // Step 4: Clustered Places / POIs Layer
  setupPlacesLayer(map, data.places);

  // Step 5: Resources Layer
  setupResourcesLayer(map, data.resources || []);

  // Step 6: Active Peers Layer
  setupPeopleLayer(map, data.peers || []);

  // Step 3: User Location Pin & Pulse
  if (data.userLocation) {
    setupUserLocationLayer(map, data.userLocation);
  }
}

export { updateUserLocationData };

export function updateAllOverlayLayers(map: maplibregl.Map, data: Partial<OverlayData>): void {
  if (data.places) updatePlacesLayerData(map, data.places);
  if (data.streets) updateDiscoveryLayerData(map, data.streets);
  if (data.peers) updatePeopleLayerData(map, data.peers);
  if (data.resources) updateResourcesLayerData(map, data.resources);
  if (data.meshLinks) updateMeshLinksLayerData(map, data.meshLinks);
  if (data.signalTrail) updateSignalTrailData(map, data.signalTrail);
  if (data.userLocation) updateUserLocationData(map, data.userLocation);
  if (data.route !== undefined) updateRouteLayerData(map, data.route);
}

export function applyCategoryFilterToPlaces(map: maplibregl.Map, categoryFilter: string | null): void {
  if (!map || !map.getLayer(PLACES_UNCLUSTERED_POINT_LAYER)) return;

  if (!categoryFilter) {
    map.setFilter(PLACES_UNCLUSTERED_POINT_LAYER, ['!', ['has', 'point_count']]);
  } else {
    map.setFilter(PLACES_UNCLUSTERED_POINT_LAYER, [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'mainCategory'], categoryFilter],
    ]);
  }
}
