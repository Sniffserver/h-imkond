/**
 * HÕIMU Tactical Vector Map Engine (PMTiles + MapLibre GL)
 * 
 * Custom crafted HÕIMU tactical cartographic styles with zero generic OSM defaults:
 * - HÕIMU DAY: Warm paper, muted Baltic blue, soft green parks, almost-white buildings, olive/gray roads, stronger green primary, dark charcoal labels.
 * - HÕIMU NIGHT: Low luminance (#10170F), low glare (#14242B water, #132018 parks, #1B211A buildings, #4A5148 roads, #8E9A71 primary, #B9C2AC labels).
 * - HÕIMU RED (Stealth Red Mode): Pure low-glare tactical night vision mode.
 * - Multi-scale zoom architecture (Z10 City -> Z12 Arteries -> Z13 Roads & Rail -> Z14 Buildings -> Z15+ Estonian Street Names `name:et`).
 * - In-place paint property switching (applyMapTheme) to eliminate canvas destruction & GPU spikes during Day/Night transitions.
 */

import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

export type TacticalMapTheme = 'day' | 'night' | 'red' | 'high_contrast' | 'direct_sun' | 'eco' | 'crisis';

let pmtilesProtocolInitialized = false;
let globalProtocolInstance: Protocol | null = null;

export function initializePMTilesProtocol(): Protocol {
  if (!pmtilesProtocolInitialized) {
    globalProtocolInstance = new Protocol();
    const originalTile = globalProtocolInstance.tile.bind(globalProtocolInstance);
    maplibregl.addProtocol('pmtiles', (requestParameters, abortController) => {
      return originalTile(requestParameters, abortController).catch(() => {
        // Return empty ArrayBuffer when byte serving is unavailable or tile missing
        return { data: new ArrayBuffer(0) };
      });
    });
    pmtilesProtocolInitialized = true;
  }
  return globalProtocolInstance!;
}

export interface ThemePalette {
  bg: string;
  water: string;
  waterway: string;
  landuse: string;
  parks: string;
  roadsPrimary: string;
  roadsSecondary: string;
  roadsResidential: string;
  rail: string;
  buildings: string;
  buildingsOutline: string;
  buildingsOpacity: number;
  textPrimary: string;
  textHalo: string;
  textOpacity: number;
  boundary: string;
  poiAlert: string;
}

export const THEME_PALETTES: Record<TacticalMapTheme, ThemePalette> = {
  // HÕIMU DAY: Warm paper, muted Baltic blue, soft green, almost-white buildings, olive/gray roads, strong green primary
  day: {
    bg: '#FAF6EE',
    water: '#98B6C6',
    waterway: '#88A6B6',
    landuse: '#F2EDE4',
    parks: '#C9DBC8',
    roadsPrimary: '#687A5B',
    roadsSecondary: '#B5BAA8',
    roadsResidential: '#C8CDC0',
    rail: '#7B8876',
    buildings: '#EAE5DA',
    buildingsOutline: '#DCD6C9',
    buildingsOpacity: 0.85,
    textPrimary: '#203A2A',
    textHalo: '#FAF6EE',
    textOpacity: 1.0,
    boundary: '#687A5B',
    poiAlert: '#E76F51',
  },

  // HÕIMU NIGHT: Low luminance, low glare, low blue, stealth OLED field map (#10170F)
  night: {
    bg: '#10170F',
    water: '#14242B',
    waterway: '#182C35',
    landuse: '#121A11',
    parks: '#132018',
    roadsPrimary: '#8E9A71',
    roadsSecondary: '#4A5148',
    roadsResidential: '#2D352B',
    rail: '#3F493D',
    buildings: '#1B211A',
    buildingsOutline: '#222B21',
    buildingsOpacity: 0.45,
    textPrimary: '#B9C2AC',
    textHalo: '#10170F',
    textOpacity: 0.75,
    boundary: '#4F5E46',
    poiAlert: '#E76F51',
  },

  // HÕIMU RED: Tactical red light stealth mode for nighttime perimeter discipline
  red: {
    bg: '#0D0303',
    water: '#1E0A0D',
    waterway: '#250D11',
    landuse: '#140507',
    parks: '#16080A',
    roadsPrimary: '#C93B46',
    roadsSecondary: '#5C1B20',
    roadsResidential: '#381014',
    rail: '#4A151A',
    buildings: '#1A0A0C',
    buildingsOutline: '#2B0E12',
    buildingsOpacity: 0.4,
    textPrimary: '#E88088',
    textHalo: '#0D0303',
    textOpacity: 0.7,
    boundary: '#A62632',
    poiAlert: '#FF4D5A',
  },

  // HIGH CONTRAST: Thick lines, pure yellow/white on deep black for smoke/dirty screens
  high_contrast: {
    bg: '#000000',
    water: '#002B49',
    waterway: '#003E6B',
    landuse: '#0A0A0A',
    parks: '#003311',
    roadsPrimary: '#FFFF00',
    roadsSecondary: '#FFFFFF',
    roadsResidential: '#CCCCCC',
    rail: '#00FFFF',
    buildings: '#1A1A1A',
    buildingsOutline: '#FFFFFF',
    buildingsOpacity: 0.9,
    textPrimary: '#FFFF00',
    textHalo: '#000000',
    textOpacity: 1.0,
    boundary: '#FF0055',
    poiAlert: '#FF0000',
  },

  // DIRECT SUN: Monochromatic high albedo for direct outdoor solar glare
  direct_sun: {
    bg: '#FFFDF7',
    water: '#88AEC4',
    waterway: '#769CB2',
    landuse: '#F5F2E9',
    parks: '#CCD8CC',
    roadsPrimary: '#4D4032',
    roadsSecondary: '#7A6B5C',
    roadsResidential: '#9E9082',
    rail: '#3A424E',
    buildings: '#D9D0BE',
    buildingsOutline: '#594A38',
    buildingsOpacity: 0.9,
    textPrimary: '#000000',
    textHalo: '#FFFFFF',
    textOpacity: 1.0,
    boundary: '#3D5240',
    poiAlert: '#B30000',
  },

  // ECO: Monochromatic phosphor green for ultra-low power emergency operations
  eco: {
    bg: '#030804',
    water: '#05180B',
    waterway: '#092512',
    landuse: '#071509',
    parks: '#0A200E',
    roadsPrimary: '#4EBA6F',
    roadsSecondary: '#246135',
    roadsResidential: '#143B1E',
    rail: '#1D532B',
    buildings: '#0E2412',
    buildingsOutline: '#1C4A28',
    buildingsOpacity: 0.5,
    textPrimary: '#70E090',
    textHalo: '#030804',
    textOpacity: 0.85,
    boundary: '#4EBA6F',
    poiAlert: '#B5E48C',
  },

  // CRISIS: High alert emergency mode highlighting shelters and water springs
  crisis: {
    bg: '#0D0505',
    water: '#150A10',
    waterway: '#221019',
    landuse: '#1A0D0E',
    parks: '#101A0E',
    roadsPrimary: '#FF4D4D',
    roadsSecondary: '#5E2428',
    roadsResidential: '#3A1518',
    rail: '#6A2E35',
    buildings: '#210F11',
    buildingsOutline: '#4A1D20',
    buildingsOpacity: 0.5,
    textPrimary: '#FFD166',
    textHalo: '#0D0505',
    textOpacity: 0.9,
    boundary: '#EF476F',
    poiAlert: '#FF1E00',
  },
};

/**
 * Generates initial MapLibre style specification
 */
export function getTacticalVectorMapStyle(
  pmtilesUrl: string = '/maps/tallinn.pmtiles',
  theme: TacticalMapTheme = 'night'
): maplibregl.StyleSpecification {
  const p = THEME_PALETTES[theme] || THEME_PALETTES.night;

  return {
    version: 8,
    name: `HÕIMU Tactical Map (${theme.toUpperCase()})`,
    glyphs: '/fonts/glyphs/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© OpenStreetMap contributors • HÕIMU Tactical Vector',
      },
    },
    layers: [
      // 1. BASE BACKGROUND
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': p.bg,
        },
      },

      // 2. LANDUSE & NATURE (ZOOM 10+)
      {
        id: 'landuse-base',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        minzoom: 10,
        paint: {
          'fill-color': p.landuse,
          'fill-opacity': 0.6,
        },
      },
      {
        id: 'landuse-parks-forests',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'natural',
        minzoom: 10,
        paint: {
          'fill-color': p.parks,
          'fill-opacity': 0.75,
        },
      },

      // 3. WATER BODIES & WATERWAYS (ZOOM 10+)
      {
        id: 'water-areas',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        minzoom: 10,
        paint: {
          'fill-color': p.water,
          'fill-opacity': 0.95,
        },
      },
      {
        id: 'water-lines',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'waterways',
        minzoom: 12,
        paint: {
          'line-color': p.waterway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 3],
        },
      },

      // 4. RAIL & TRANSIT (ZOOM 13+)
      {
        id: 'railways',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'transit',
        minzoom: 13,
        paint: {
          'line-color': p.rail,
          'line-width': 1.8,
          'line-dasharray': [3, 2],
        },
      },

      // 5. ROADS HIERARCHY (Strict Protomaps/OSM attribute filters to prevent overdraw)
      // ZOOM 11+: Major Arteries (Motorway, Trunk, Primary)
      {
        id: 'roads-motorway-primary',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 11,
        filter: [
          'any',
          [
            'in',
            ['coalesce', ['get', 'pmap:kind'], ['get', 'kind'], ['get', 'highway'], ['get', 'class'], ''],
            ['literal', ['motorway', 'trunk', 'primary', 'highway', 'major_road', 'motorway_link', 'trunk_link', 'primary_link']],
          ],
          ['==', ['get', 'pmap:kind'], 'major_road'],
        ],
        paint: {
          'line-color': p.roadsPrimary,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 2,
            13, 3.5,
            15, 6,
          ],
        },
      },

      // ZOOM 13+: Secondary & Connecting Roads (Secondary, Tertiary)
      {
        id: 'roads-secondary',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 13,
        filter: [
          'any',
          [
            'in',
            ['coalesce', ['get', 'pmap:kind'], ['get', 'kind'], ['get', 'highway'], ['get', 'class'], ''],
            ['literal', ['secondary', 'tertiary', 'medium_road', 'secondary_link', 'tertiary_link']],
          ],
          ['==', ['get', 'pmap:kind'], 'medium_road'],
        ],
        paint: {
          'line-color': p.roadsSecondary,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 1.5,
            15, 3.5,
          ],
        },
      },

      // ZOOM 14+: Residential & Service Roads (Minor, Residential, Service, Path)
      {
        id: 'roads-residential',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 14,
        filter: [
          'any',
          [
            'in',
            ['coalesce', ['get', 'pmap:kind'], ['get', 'kind'], ['get', 'highway'], ['get', 'class'], ''],
            ['literal', ['residential', 'service', 'track', 'path', 'footway', 'cycleway', 'unclassified', 'minor_road', 'living_street', 'pedestrian', 'road']],
          ],
          ['==', ['get', 'pmap:kind'], 'minor_road'],
        ],
        paint: {
          'line-color': p.roadsResidential,
          'line-width': 1.2,
          'line-opacity': 0.85,
        },
      },

      // 6. BUILDINGS & INFRASTRUCTURE (ZOOM 14+)
      {
        id: 'buildings-footprints',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 14,
        paint: {
          'fill-color': p.buildings,
          'fill-outline-color': p.buildingsOutline,
          'fill-opacity': p.buildingsOpacity,
        },
      },

      // 7. LABELS & ESTONIAN STREET NAMES (ZOOM 10 -> ZOOM 15+)
      // ZOOM 10+: Districts & Places (Kesklinn, Mustamäe, Lasnamäe, Pirita, Nõmme, etc.)
      {
        id: 'places-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        minzoom: 10,
        maxzoom: 15,
        layout: {
          'text-field': ['coalesce', ['get', 'name:et'], ['get', 'name'], ''],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 15],
          'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: {
          'text-color': p.textPrimary,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.5,
          'text-opacity': p.textOpacity,
        },
      },

      // ZOOM 14+: Street Names (Pärnu maantee, Narva maantee, Sõpruse pst, Mustamäe tee...)
      {
        id: 'road-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:et'], ['get', 'name'], ['get', 'ref'], ''],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 13],
          'text-font': ['Noto Sans Regular', 'Open Sans Regular'],
          'text-letter-spacing': 0.05,
        },
        paint: {
          'text-color': p.textPrimary,
          'text-halo-color': p.textHalo,
          'text-halo-width': 2,
          'text-opacity': p.textOpacity,
        },
      },

      // ZOOM 15+: POIs, Vital Emergency Points
      {
        id: 'pois-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'pois',
        minzoom: 15,
        layout: {
          'text-field': ['coalesce', ['get', 'name:et'], ['get', 'name'], ''],
          'text-size': 10,
          'text-offset': [0, 1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': p.poiAlert,
          'text-halo-color': p.textHalo,
          'text-halo-width': 1.5,
          'text-opacity': p.textOpacity,
        },
      },
    ],
  };
}

/**
 * Dynamically applies theme colors to an existing MapLibre GL map instance
 * WITHOUT destroying the map, reloading tiles, or causing WebGL context recreation.
 */
export function applyMapTheme(map: maplibregl.Map, theme: TacticalMapTheme): void {
  if (!map || !map.isStyleLoaded()) return;

  const p = THEME_PALETTES[theme] || THEME_PALETTES.night;

  const safeSetPaint = (layerId: string, prop: string, value: any) => {
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, prop as any, value);
      }
    } catch {
      // Ignore if layer is currently not present
    }
  };

  safeSetPaint('background', 'background-color', p.bg);
  safeSetPaint('landuse-base', 'fill-color', p.landuse);
  safeSetPaint('landuse-parks-forests', 'fill-color', p.parks);
  safeSetPaint('water-areas', 'fill-color', p.water);
  safeSetPaint('water-lines', 'line-color', p.waterway);
  safeSetPaint('railways', 'line-color', p.rail);
  safeSetPaint('roads-motorway-primary', 'line-color', p.roadsPrimary);
  safeSetPaint('roads-secondary', 'line-color', p.roadsSecondary);
  safeSetPaint('roads-residential', 'line-color', p.roadsResidential);
  safeSetPaint('buildings-footprints', 'fill-color', p.buildings);
  safeSetPaint('buildings-footprints', 'fill-outline-color', p.buildingsOutline);
  safeSetPaint('buildings-footprints', 'fill-opacity', p.buildingsOpacity);
  safeSetPaint('places-labels', 'text-color', p.textPrimary);
  safeSetPaint('places-labels', 'text-halo-color', p.textHalo);
  safeSetPaint('places-labels', 'text-opacity', p.textOpacity);
  safeSetPaint('road-labels', 'text-color', p.textPrimary);
  safeSetPaint('road-labels', 'text-halo-color', p.textHalo);
  safeSetPaint('road-labels', 'text-opacity', p.textOpacity);
  safeSetPaint('pois-labels', 'text-color', p.poiAlert);
  safeSetPaint('pois-labels', 'text-halo-color', p.textHalo);
  safeSetPaint('pois-labels', 'text-opacity', p.textOpacity);
}
