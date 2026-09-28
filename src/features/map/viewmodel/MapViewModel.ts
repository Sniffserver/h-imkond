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

import { MeshNode, ResourceItem as DomainResourceItem, GeoPoint, SignalObservation, MapPlace, Street, FieldProvenance } from '../../../types';
import { PeerMapMarker } from '../explore/overlays/PeopleLayer';
import { ResourceItem as MapOverlayResourceItem } from '../explore/overlays/ResourcesLayer';
import { MeshLink } from '../explore/overlays/MeshLinksLayer';
import { mapRepository } from '../data/repository';
import { calculateHaversineMeters } from '../../../services/routing/routingEngine';

export interface MapViewModelInput {
  peers?: MeshNode[];
  resources?: DomainResourceItem[];
  userLocation: GeoPoint;
  meshLinks?: MeshLink[];
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
    meshLinks = [],
    signalTrail = [],
    places,
    streets,
  } = input;

  // 1. Transform MeshNode[] -> PeerMapMarker[]
  // Rule:
  // MeshNode
  //  ├── actual position? → map marker
  //  ├── no position? → no geographic marker
  //  │
  //  └── actual link observation?
  //        yes → MeshLinksLayer
  //        no  → no link
  // Unknown is a valid state: do NOT turn unknown position into "approximately somewhere here".
  const transformedPeers: PeerMapMarker[] = [];

  for (const node of peers) {
    let loc: GeoPoint | null = null;
    let locationProvenance: FieldProvenance = 'unknown';

    if (node.location && typeof node.location.lat === 'number' && typeof node.location.lng === 'number') {
      loc = node.location;
      locationProvenance = node.locationProvenance || 'observed';
    } else if ((node as any).position && typeof (node as any).position.lat === 'number' && typeof (node as any).position.lng === 'number') {
      loc = (node as any).position;
      locationProvenance = 'observed';
    }

    // No actual observed or estimated position? Exclude from geographic map!
    // The node remains valid and accessible in radar/comms, but not pinned to fake coordinates.
    if (!loc) {
      continue;
    }

    // Provenance for each field: observed | derived | estimated | unknown
    const rssi = typeof node.lastRssi === 'number' ? node.lastRssi : undefined;
    const rssiProvenance: FieldProvenance = node.rssiProvenance || (rssi !== undefined ? 'observed' : 'unknown');

    const battery = typeof node.batteryLevel === 'number' ? node.batteryLevel : undefined;
    const batteryProvenance: FieldProvenance = node.batteryProvenance || (battery !== undefined ? 'observed' : 'unknown');

    const online = node.connectionState === 'direct' || node.connectionState === 'relayed';
    const onlineProvenance: FieldProvenance = node.connectionState ? 'observed' : 'unknown';

    const distMeters = Math.round(
      calculateHaversineMeters(userLocation.lat, userLocation.lng, loc.lat, loc.lng)
    );
    const distanceProvenance: FieldProvenance = 'derived';

    transformedPeers.push({
      id: node.id,
      name: node.callsign || `Node ${node.id.substring(0, 6)}`,
      callsign: node.callsign || node.id.substring(0, 6).toUpperCase(),
      location: loc,
      locationProvenance,
      batteryPercent: battery,
      batteryProvenance,
      role: node.role || (node.hopDistance === 1 ? 'Direct Peer' : 'Relayed Node'),
      online,
      onlineProvenance,
      rssi,
      rssiProvenance,
      distanceMeters: distMeters,
      distanceProvenance,
    });
  }

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

  // 3. Mesh Links: Strictly actual link observations only.
  // Never synthesize fictitious connections with hardcoded RSSI/SNR between arbitrary peer pairs.
  const transformedMeshLinks: MeshLink[] = [];
  if (meshLinks && meshLinks.length > 0) {
    transformedMeshLinks.push(
      ...meshLinks.filter(
        (l) =>
          l.from &&
          typeof l.from.lat === 'number' &&
          typeof l.from.lng === 'number' &&
          l.to &&
          typeof l.to.lat === 'number' &&
          typeof l.to.lng === 'number'
      )
    );
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
