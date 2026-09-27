import { CityMapData, VectorStreet, VectorZone, VectorLandmark } from '../types';

/**
 * OpenStreetMap (OSM) and Overpass API to HÕIMU Topography Vector Map Converter.
 * Parses OSM GeoJSON or Overpass JSON exports into HÕIMU's offline-first
 * coordinates, scaling geographic lat/lon to custom grid (-200 to 200).
 */
export function convertOsmGeoJsonToHoimu(
  geoJson: any,
  cityName: string,
  centerLat: number,
  centerLon: number
): CityMapData {
  const streets: VectorStreet[] = [];
  const zones: VectorZone[] = [];
  const landmarks: VectorLandmark[] = [];

  const latToGrid = (lat: number) => {
    // Map latitude delta to -200..200 grid
    return Math.max(-200, Math.min(200, (lat - centerLat) * 3500));
  };

  const lonToGrid = (lon: number) => {
    // Map longitude delta to -200..200 grid
    return Math.max(-200, Math.min(200, (lon - centerLon) * 2000));
  };

  const features = geoJson.features || [];

  features.forEach((feature: any, index: number) => {
    const props = feature.properties || {};
    const geom = feature.geometry || {};
    const id = props.id || `osm_${index}`;
    const name = props.name || props.ref || `OSM Objekt #${index + 1}`;

    // Handle Nodes (Landmarks / POIs)
    if (geom.type === 'Point' && geom.coordinates) {
      const [lon, lat] = geom.coordinates;
      let type: 'hub' | 'historic' | 'eco' | 'water' | 'station' = 'eco';

      if (props.amenity === 'place_of_worship' || props.historic) type = 'historic';
      else if (props.natural === 'water' || props.waterway) type = 'water';
      else if (props.emergency || props.amenity === 'hospital') type = 'station';
      else if (props.amenity === 'marketplace' || props.highway === 'bus_stop') type = 'hub';

      landmarks.push({
        id,
        name,
        x: lonToGrid(lon),
        y: latToGrid(lat),
        type,
      });
    }

    // Handle LineStrings (Streets / Trails)
    if (geom.type === 'LineString' && geom.coordinates) {
      const points = geom.coordinates.map(([lon, lat]: [number, number]): [number, number] => [
        lonToGrid(lon),
        latToGrid(lat),
      ]);

      let type: 'primary' | 'secondary' | 'trail' = 'secondary';
      let width = 2.0;

      if (props.highway === 'motorway' || props.highway === 'trunk' || props.highway === 'primary') {
        type = 'primary';
        width = 3.5;
      } else if (props.highway === 'cycleway' || props.highway === 'footway' || props.highway === 'path') {
        type = 'trail';
        width = 1.5;
      }

      streets.push({
        name,
        points,
        width,
        type,
      });
    }

    // Handle Polygons (Zones - Water, Parks, Forests)
    if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
      const points = geom.coordinates[0].map(([lon, lat]: [number, number]): [number, number] => [
        lonToGrid(lon),
        latToGrid(lat),
      ]);

      let type: 'water' | 'park' | 'urban' = 'urban';
      if (props.natural === 'water' || props.waterway || props.water) {
        type = 'water';
      } else if (props.leisure === 'park' || props.landuse === 'forest' || props.natural === 'wood') {
        type = 'park';
      }

      zones.push({
        name,
        type,
        points,
      });
    }
  });

  return {
    id: `custom_osm_${Date.now()}`,
    cityName: cityName || 'Imporditud OSM Kaart',
    country: 'OSM Import',
    bioregionName: 'Kohalik Biopiirkond (Imported)',
    centerCoordsText: `${centerLat.toFixed(4)}° N, ${centerLon.toFixed(4)}° E`,
    description: `Manuaalselt imporditud OpenStreetMap kaart sisaldab ${streets.length} tänavat, ${zones.length} tsooni ja ${landmarks.length} maamärki.`,
    streets,
    zones,
    landmarks,
    districts: [
      { name: 'Keskpunkt', x: 0, y: 0 },
    ],
  };
}

/**
 * Loads vector dataset from scheduled offline build artifacts (poi.pmtiles / tallinn-places.json).
 * Adheres strictly to OSM Overpass usage policy by using pre-compiled scheduled extracts.
 */
export async function fetchLiveOsmData(lat: number, lon: number): Promise<any> {
  try {
    const res = await fetch('/maps/tallinn-places.json');
    if (res.ok) {
      const places = await res.json();
      return {
        type: 'FeatureCollection',
        features: places.map((p: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.location.lng, p.location.lat],
          },
          properties: {
            id: p.id,
            name: p.name,
            amenity: p.subCategory,
            source: p.sourceName,
          },
        })),
      };
    }
  } catch {
    // Fall back to empty GeoJSON if offline
  }

  return {
    type: 'FeatureCollection',
    features: [],
  };
}

/**
 * Helper to convert Overpass raw nodes/ways JSON into standard GeoJSON 
 * so our converter can parse it smoothly.
 */
function overpassJsonToGeoJson(overpassData: any): any {
  const elements = overpassData.elements || [];
  const nodesMap = new Map<number, [number, number]>();
  const features: any[] = [];

  // 1. Gather all nodes coordinates
  elements.forEach((el: any) => {
    if (el.type === 'node') {
      nodesMap.set(el.id, [el.lon, el.lat]);
    }
  });

  // 2. Build GeoJSON features
  elements.forEach((el: any) => {
    const props = el.tags || {};
    props.id = String(el.id);

    if (el.type === 'node') {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [el.lon, el.lat],
        },
        properties: props,
      });
    } else if (el.type === 'way' && el.nodes) {
      const coordinates = el.nodes
        .map((nodeId: number) => nodesMap.get(nodeId))
        .filter((coords: any) => coords !== undefined);

      if (coordinates.length >= 2) {
        // Simple heuristic: If closed loop, treat as polygon
        const isClosed = el.nodes[0] === el.nodes[el.nodes.length - 1];
        const isArea = isClosed && (props.natural === 'water' || props.leisure === 'park' || props.landuse);

        features.push({
          type: 'Feature',
          geometry: {
            type: isArea ? 'Polygon' : 'LineString',
            coordinates: isArea ? [coordinates] : coordinates,
          },
          properties: props,
        });
      }
    }
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}
