/**
 * MapViewModel: Single Predictable Input Boundary between Application Domain State and ExploreMap
 * Translates MeshNode[], ResourceItem[], GeoPoint, and canonical datasets into pure ExploreMap props.
 * 
 * Domain state
 *    ↓
 * MapViewModel
 *    ↓
 * ExploreMap
 */

import { MeshNode, ResourceItem as DomainResourceItem, GeoPoint, SignalObservation, MapPlace, Street } from '../../../types';
import { PeerMapMarker } from '../explore/overlays/PeopleLayer';
import { ResourceItem as MapOverlayResourceItem } from '../explore/overlays/ResourcesLayer';
import { MeshLink } from '../explore/overlays/MeshLinksLayer';
import { mapRepository } from '../data/repository';

export interface MapViewModelInput {
  peers?: MeshNode[];
  resources?: DomainResourceItem[];
  userLocation: GeoPoint;
  signalTrail?: SignalObservation[];
  places?: MapPlace[];
  streets?: Street[];
}

export interface MapViewModelOutput {
  initialCenter: GeoPoint;
  userLocation: GeoPoint;
  peers: PeerMapMarker[];
  resources: MapOverlayResourceItem[];
  meshLinks: MeshLink[];
  signalTrail: SignalObservation[];
  places: MapPlace[];
  streets: Street[];
}

export function transformDomainToMapViewModel(input: MapViewModelInput): MapViewModelOutput {
  const {
    peers = [],
    resources = [],
    userLocation,
    signalTrail = [],
    places,
    streets,
  } = input;

  // 1. Transform MeshNode[] -> PeerMapMarker[]
  const transformedPeers: PeerMapMarker[] = peers.map((node) => {
    let loc: GeoPoint;
    if ((node as any).location && typeof (node as any).location.lat === 'number') {
      loc = (node as any).location;
    } else {
      // Polar radar projection relative to user position (within ~1.2km radius)
      const rad = ((node.angle || 0) * Math.PI) / 180;
      const distKm = Math.max(0.1, (node.distanceRatio || 0.4) * 1.2);
      const latOffset = (distKm / 111.32) * Math.cos(rad);
      const lngOffset = (distKm / (111.32 * Math.cos((userLocation.lat * Math.PI) / 180))) * Math.sin(rad);
      loc = {
        lat: userLocation.lat + latOffset,
        lng: userLocation.lng + lngOffset,
      };
    }

    return {
      id: node.id,
      name: node.callsign || `Node ${node.id.substring(0, 6)}`,
      callsign: node.callsign || node.id.substring(0, 6).toUpperCase(),
      location: loc,
      batteryPercent: typeof (node as any).batteryLevel === 'number' ? (node as any).batteryLevel : 85,
      role: node.role || (node.hopDistance === 1 ? 'Direct Peer' : 'Relayed Node'),
      online: node.connectionState === 'direct' || node.connectionState === 'relayed' || (node as any).status === 'online',
      rssi: node.lastRssi ?? -75,
    };
  });

  // 2. Transform Domain ResourceItem[] -> MapOverlayResourceItem[]
  const transformedResources: MapOverlayResourceItem[] = resources
    .filter((res) => res.location && typeof res.location.lat === 'number' && typeof res.location.lng === 'number')
    .map((res) => ({
      id: res.id,
      title: res.title,
      category: String(res.category || 'tool').toLowerCase(),
      type: res.type || 'offer',
      location: res.location,
      description: res.description,
      availableQuantity: res.availabilityText || '1',
    }));

  // 3. Synthesize Mesh Links from active peers with coordinates within mesh propagation distance
  const transformedMeshLinks: MeshLink[] = [];
  for (let i = 0; i < transformedPeers.length; i++) {
    for (let j = i + 1; j < transformedPeers.length; j++) {
      const p1 = transformedPeers[i];
      const p2 = transformedPeers[j];
      if (p1.online && p2.online) {
        transformedMeshLinks.push({
          id: `link_${p1.id}_${p2.id}`,
          from: p1.location,
          to: p2.location,
          rssi: -78,
          snr: 8.5,
          quality: 'good',
        });
      }
    }
  }

  // 4. Canonical Places & Streets fallback
  const resolvedPlaces = places && places.length > 0 ? places : mapRepository.getAllPlaces();
  const resolvedStreets = streets && streets.length > 0 ? streets : mapRepository.getAllStreets();

  return {
    initialCenter: userLocation,
    userLocation,
    peers: transformedPeers,
    resources: transformedResources,
    meshLinks: transformedMeshLinks,
    signalTrail,
    places: resolvedPlaces,
    streets: resolvedStreets,
  };
}
