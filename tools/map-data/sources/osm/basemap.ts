/**
 * OSM Basemap Source Extraction Worker
 * Extracts basemap vector elements: roads, pedestrian paths, buildings, water bodies, landuse, transit lines, and localized labels.
 */

import { RawOsmElement } from '../../osm/fetch';

export interface BasemapLayerExtraction {
  roads: RawOsmElement[];
  paths: RawOsmElement[];
  buildings: RawOsmElement[];
  water: RawOsmElement[];
  landuse: RawOsmElement[];
  transit: RawOsmElement[];
  labels: RawOsmElement[];
}

export function extractOsmBasemapLayers(elements: RawOsmElement[]): BasemapLayerExtraction {
  const roads: RawOsmElement[] = [];
  const paths: RawOsmElement[] = [];
  const buildings: RawOsmElement[] = [];
  const water: RawOsmElement[] = [];
  const landuse: RawOsmElement[] = [];
  const transit: RawOsmElement[] = [];
  const labels: RawOsmElement[] = [];

  elements.forEach((el) => {
    const tags = el.tags || {};

    if (tags.highway) {
      if (['footway', 'pedestrian', 'path', 'steps', 'cycleway', 'living_street'].includes(tags.highway)) {
        paths.push(el);
      } else {
        roads.push(el);
      }
    } else if (tags.building) {
      buildings.push(el);
    } else if (tags.natural === 'water' || tags.waterway || tags.water) {
      water.push(el);
    } else if (tags.landuse || tags.leisure === 'park') {
      landuse.push(el);
    } else if (tags.railway || tags.public_transport || tags.amenity === 'bus_station') {
      transit.push(el);
    } else if (tags['name:et'] || tags.name) {
      labels.push(el);
    }
  });

  return {
    roads,
    paths,
    buildings,
    water,
    landuse,
    transit,
    labels,
  };
}
