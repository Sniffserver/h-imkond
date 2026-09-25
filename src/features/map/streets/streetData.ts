/**
 * Canonical Tallinn Street Database
 * Real-world geographic coordinates [lng, lat] and segmented representations.
 */

import { Street, StreetSegment, GeoPoint } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';

function generateSegments(streetId: string, coords: [number, number][], discoveredIds: Set<string>): { segments: StreetSegment[]; totalMeters: number; exploredPercent: number } {
  const segments: StreetSegment[] = [];
  let totalMeters = 0;
  let discoveredMeters = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const start: GeoPoint = { lat: coords[i][1], lng: coords[i][0] };
    const end: GeoPoint = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const segId = `${streetId}_seg_${i + 1}`;
    const length = Math.round(haversineDistanceMeters(start.lat, start.lng, end.lat, end.lng));
    const isDiscovered = discoveredIds.has(segId);

    totalMeters += length;
    if (isDiscovered) {
      discoveredMeters += length;
    }

    segments.push({
      id: segId,
      streetId,
      start,
      end,
      lengthMeters: length,
      discoveryState: isDiscovered ? 'discovered' : 'unexplored',
    });
  }

  const exploredPercent = totalMeters > 0 ? Math.round((discoveredMeters / totalMeters) * 100) : 0;
  return { segments, totalMeters, exploredPercent };
}

export const RAW_TALLINN_STREETS: Array<{
  id: string;
  name: string;
  district: string;
  highwayClass: string;
  walkable: boolean;
  bicycle: boolean;
  coordinates: [number, number][]; // [lng, lat]
}> = [
  {
    id: 'narva_mnt',
    name: 'Narva maantee',
    district: 'Kesklinn / Kadriorg',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7548, 59.4368],
      [24.7635, 59.4382],
      [24.7761, 59.4402],
      [24.7925, 59.4445],
      [24.8112, 59.4520],
      [24.8320, 59.4580],
    ],
  },
  {
    id: 'parnu_mnt',
    name: 'Pärnu maantee',
    district: 'Kesklinn / Tondi / Nõmme',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7450, 59.4345],
      [24.7410, 59.4280],
      [24.7335, 59.4160],
      [24.7210, 59.4010],
      [24.6980, 59.3850],
    ],
  },
  {
    id: 'tartu_mnt',
    name: 'Tartu maantee',
    district: 'Kesklinn / Sikupilli / Ülemiste',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7570, 59.4350],
      [24.7700, 59.4310],
      [24.7860, 59.4240],
      [24.8080, 59.4170],
    ],
  },
  {
    id: 'paldiski_mnt',
    name: 'Paldiski maantee',
    district: 'Kesklinn / Pelgulinn / Haabersti',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7320, 59.4360],
      [24.7150, 59.4340],
      [24.6920, 59.4290],
      [24.6600, 59.4240],
    ],
  },
  {
    id: 'telliskivi_tn',
    name: 'Telliskivi tänav',
    district: 'Põhja-Tallinn / Kalamaja',
    highwayClass: 'secondary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7280, 59.4390],
      [24.7315, 59.4410],
      [24.7340, 59.4440],
    ],
  },
  {
    id: 'koidu_tn',
    name: 'Koidu tänav',
    district: 'Kesklinn / Uus Maailm',
    highwayClass: 'residential',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7380, 59.4320],
      [24.7360, 59.4270],
      [24.7340, 59.4210],
    ],
  },
  {
    id: 'vana_kalamaja_tn',
    name: 'Vana-Kalamaja tänav',
    district: 'Põhja-Tallinn / Kalamaja',
    highwayClass: 'residential',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7400, 59.4415],
      [24.7420, 59.4460],
      [24.7445, 59.4505],
    ],
  },
  {
    id: 'toostuse_tn',
    name: 'Tööstuse tänav',
    district: 'Põhja-Tallinn / Noblessner',
    highwayClass: 'secondary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7340, 59.4445],
      [24.7250, 59.4510],
      [24.7080, 59.4560],
    ],
  },
  {
    id: 'kopli_tn',
    name: 'Kopli tänav',
    district: 'Põhja-Tallinn / Kopli',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7380, 59.4400],
      [24.7180, 59.4490],
      [24.6980, 59.4570],
      [24.6750, 59.4620],
    ],
  },
  {
    id: 'liivalaia_tn',
    name: 'Liivalaia tänav',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7460, 59.4280],
      [24.7570, 59.4295],
      [24.7670, 59.4310],
    ],
  },
  {
    id: 'reidi_tee',
    name: 'Reidi tee',
    district: 'Kesklinn / Kadriorg / Port',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7640, 59.4435],
      [24.7780, 59.4440],
      [24.7930, 59.4455],
    ],
  },
  {
    id: 'viru_tn',
    name: 'Viru tänav',
    district: 'Kesklinn / Vanalinn',
    highwayClass: 'pedestrian',
    walkable: true,
    bicycle: false,
    coordinates: [
      [24.7500, 59.4365],
      [24.7465, 59.4372],
    ],
  },
  {
    id: 'sopruse_pst',
    name: 'Sõpruse puiestee',
    district: 'Kristiine / Mustamäe',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7210, 59.4230],
      [24.7080, 59.4100],
      [24.6960, 59.3970],
    ],
  },
  {
    id: 'mustamae_tee',
    name: 'Mustamäe tee',
    district: 'Kristiine / Mustamäe',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.7120, 59.4260],
      [24.7010, 59.4120],
      [24.6910, 59.3980],
    ],
  },
  {
    id: 'ehitajate_tee',
    name: 'Ehitajate tee',
    district: 'Mustamäe / Nõmme / Õismäe',
    highwayClass: 'primary',
    walkable: true,
    bicycle: true,
    coordinates: [
      [24.6650, 59.4150],
      [24.6780, 59.4020],
      [24.6890, 59.3920],
    ],
  },
];

export function getTallinnStreets(discoveredSegmentIds: Set<string> = new Set()): Street[] {
  return RAW_TALLINN_STREETS.map((raw) => {
    const { segments, totalMeters, exploredPercent } = generateSegments(raw.id, raw.coordinates, discoveredSegmentIds);
    return {
      id: raw.id,
      name: raw.name,
      district: raw.district,
      highwayClass: raw.highwayClass,
      walkable: raw.walkable,
      bicycle: raw.bicycle,
      lengthMeters: totalMeters,
      exploredPercent,
      segments,
      geometry: {
        coordinates: raw.coordinates,
      },
    };
  });
}
