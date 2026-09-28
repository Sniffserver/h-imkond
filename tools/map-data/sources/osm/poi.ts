/**
 * OSM Resilience POI Source Extraction Worker
 * Extracts civil resilience POI elements: shelters, hardware/tool workshops, bicycle hubs, water points, give-boxes, medical resources.
 */

import { RawOsmElement } from '../../osm/fetch';

export function extractOsmResiliencePois(elements: RawOsmElement[]): RawOsmElement[] {
  return elements.filter((el) => {
    const tags = el.tags || {};
    return (
      tags.amenity === 'shelter' ||
      tags.amenity === 'drinking_water' ||
      tags.amenity === 'hospital' ||
      tags.amenity === 'pharmacy' ||
      tags.shop === 'hardware' ||
      tags.shop === 'bicycle' ||
      tags.shop === 'doityourself' ||
      tags.recycling_type === 'container' ||
      tags.amenity === 'give_box' ||
      tags.emergency === 'shelter' ||
      tags.emergency === 'fire_hydrant'
    );
  });
}
