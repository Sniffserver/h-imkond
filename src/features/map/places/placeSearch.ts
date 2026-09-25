/**
 * Natural Language Multilingual Search Normalizer (Estonian + English)
 * Maps colloquial and natural search phrases into canonical MapPlace categories, tags, and keywords.
 */

import { MapPlace, GeoPoint } from '../../../types';
import { TALLINN_MAP_PLACES } from './placeData';
import { haversineDistanceMeters } from '../../../geo/projection';

interface TermMapping {
  keywords: string[];
  canonicalCategories: string[];
  canonicalSubCategories: string[];
  tags: string[];
}

const SEARCH_MAPPINGS: TermMapping[] = [
  // 1. Tools, Hardware & DIY
  {
    keywords: ['riistapood', 'tööriistapood', 'ehituspood', 'ehitusmaterjalid', 'tööriistad', 'riistad', 'rauapood', 'hardware', 'hardware store', 'diy', 'tools', 'power tools', 'building supply', 'ehitus'],
    canonicalCategories: ['tools'],
    canonicalSubCategories: ['hardware', 'diy', 'tools', 'power_tools', 'building_supply'],
    tags: ['tools', 'hardware', 'shop'],
  },
  // 2. Electronics & Radio
  {
    keywords: ['elektroonika', 'arvuti', 'arvutid', 'kaablid', 'jootekolb', 'antenn', 'raadio', 'oomipood', 'electronics', 'computer', 'computer hardware', 'cables', 'soldering', 'lora', 'radio components'],
    canonicalCategories: ['tools'],
    canonicalSubCategories: ['electronics', 'computer_hardware'],
    tags: ['electronics', 'radio_parts'],
  },
  // 3. Police & Law Enforcement
  {
    keywords: ['politsei', 'politseijaoskond', 'korrakaitse', 'patrull', 'police', 'police station', 'law enforcement', 'precinct'],
    canonicalCategories: ['safety'],
    canonicalSubCategories: ['police'],
    tags: ['police', 'emergency_services'],
  },
  // 4. Fire & Rescue
  {
    keywords: ['päästeamet', 'tuletõrje', 'päästekomando', 'pritsumaja', 'fire', 'fire station', 'fire department', 'rescue'],
    canonicalCategories: ['safety'],
    canonicalSubCategories: ['fire_station', 'emergency_services'],
    tags: ['fire_station', 'rescue'],
  },
  // 5. Medical, Hospital & EMO
  {
    keywords: ['haigla', 'kiirabi', 'emo', 'trauma', 'arst', 'arstiabi', 'hospital', 'emergency room', 'ambulance', 'medical', 'clinic', 'trauma center'],
    canonicalCategories: ['safety'],
    canonicalSubCategories: ['hospital', 'medical', 'emergency_services'],
    tags: ['hospital', 'emergency'],
  },
  // 6. Pharmacy & Drugs
  {
    keywords: ['apteek', 'valveapteek', 'rohud', 'ravimid', 'sidemed', 'pharmacy', 'chemist', 'drugstore', 'medicine', 'first aid'],
    canonicalCategories: ['safety'],
    canonicalSubCategories: ['pharmacy', 'medical'],
    tags: ['pharmacy'],
  },
  // 7. Shelters & Civil Defense
  {
    keywords: ['varjend', 'avalik varjend', 'pommitusvarjend', 'tsiviilkaitse', 'varjumiskoht', 'shelter', 'public shelter', 'civil protection', 'bunker', 'refuge'],
    canonicalCategories: ['safety'],
    canonicalSubCategories: ['shelter'],
    tags: ['shelter', 'civil_defense'],
  },
  // 8. Water, Springs & Taps
  {
    keywords: ['vesi', 'joogivesi', 'allikas', 'kraan', 'veevõtukoht', 'kaev', 'pumbajaam', 'water', 'potable water', 'spring', 'water tap', 'drinking water', 'hydrant', 'well'],
    canonicalCategories: ['water'],
    canonicalSubCategories: ['spring', 'tap', 'hydrant', 'well'],
    tags: ['potable_water', 'natural_spring'],
  },
  // 9. Finds, Reuse, Give Boxes & Second Hand
  {
    keywords: ['uuskasutus', 'kasutatud', 'kaltsukas', 'kirbukas', 'tasuta', 'tasuta kast', 'raamatukapp', 'tööriistalaenutus', 'paranduskohvik', 'second hand', 'reuse', 'give box', 'public bookcase', 'free stuff', 'flea market', 'tool library', 'repair cafe', 'makerspace', 'charity shop'],
    canonicalCategories: ['finds'],
    canonicalSubCategories: ['second_hand', 'reuse', 'give_box', 'public_bookcase', 'tool_library', 'flea_market', 'repair_cafe'],
    tags: ['mutual_aid', 'reuse', 'freeshop'],
  },
  // 10. Stores, Markets & Food
  {
    keywords: ['pood', 'toidupood', 'turg', 'supermarket', 'taluturg', 'toit', 'grocery', 'supermarket', 'market', 'farmers market', 'food', 'convenience', 'store', 'bazaar'],
    canonicalCategories: ['stores'],
    canonicalSubCategories: ['supermarket', 'market', 'convenience', 'general_store'],
    tags: ['food', 'shop'],
  },
  // 11. Bicycle & Cycling
  {
    keywords: ['ratas', 'jalgratas', 'rattapood', 'rattaparandus', 'sisekumm', 'bicycle', 'bike', 'bike shop', 'bicycle repair', 'cycling'],
    canonicalCategories: ['tools'],
    canonicalSubCategories: ['bicycle_shop'],
    tags: ['bicycle'],
  },
  // 12. Fuel & Energy
  {
    keywords: ['tankla', 'kütus', 'diisel', 'bensiin', 'laadimine', 'päikeseelekter', 'fuel', 'petrol', 'diesel', 'gas station', 'charging', 'solar'],
    canonicalCategories: ['stores', 'energy'],
    canonicalSubCategories: ['fuel', 'solar_hub', 'charging'],
    tags: ['fuel', 'energy'],
  },
  // 13. Nature, Parks & Permaculture
  {
    keywords: ['park', 'mets', 'roheala', 'kogukonnaaed', 'loodus', 'taimed', 'nature', 'park', 'forest', 'garden', 'green area', 'permaculture'],
    canonicalCategories: ['nature'],
    canonicalSubCategories: ['park', 'garden', 'forest', 'green_area'],
    tags: ['permaculture', 'park'],
  },
];

export interface NormalizedSearchTerms {
  rawQuery: string;
  matchedCategories: string[];
  matchedSubCategories: string[];
  matchedTags: string[];
}

/**
 * Normalizes user search input into canonical categories and tags.
 * e.g. "riistapood" -> ['tools'], ['hardware', 'diy', 'tools']
 */
export function normalizeSearchQuery(query: string): NormalizedSearchTerms {
  const q = query.trim().toLowerCase();
  const matchedCategories = new Set<string>();
  const matchedSubCategories = new Set<string>();
  const matchedTags = new Set<string>();

  SEARCH_MAPPINGS.forEach((mapping) => {
    const isMatched = mapping.keywords.some((kw) => {
      return q === kw || q.includes(kw) || kw.includes(q);
    });

    if (isMatched) {
      mapping.canonicalCategories.forEach((c) => matchedCategories.add(c));
      mapping.canonicalSubCategories.forEach((sc) => matchedSubCategories.add(sc));
      mapping.tags.forEach((t) => matchedTags.add(t));
    }
  });

  return {
    rawQuery: q,
    matchedCategories: Array.from(matchedCategories),
    matchedSubCategories: Array.from(matchedSubCategories),
    matchedTags: Array.from(matchedTags),
  };
}

/**
 * Searches places using both natural language term normalization and direct text matches.
 */
export function searchPlaces(
  query: string,
  userLocation?: GeoPoint,
  radiusMeters?: number,
  allPlaces: MapPlace[] = TALLINN_MAP_PLACES
): (MapPlace & { distanceMeters?: number; _score?: number })[] {
  if (!query || !query.trim()) {
    return [];
  }

  const { rawQuery, matchedCategories, matchedSubCategories, matchedTags } = normalizeSearchQuery(query);

  const uLat = userLocation?.lat;
  const uLng = userLocation?.lng;

  const results = allPlaces
    .map((place) => {
      const pLat = place.location.lat;
      const pLng = place.location.lng;
      
      let distanceMeters = 0;
      if (uLat !== undefined && uLng !== undefined) {
        distanceMeters = Math.round(haversineDistanceMeters(uLat, uLng, pLat, pLng));
      }

      // Filter by radius if provided
      if (radiusMeters && distanceMeters > radiusMeters) {
        return null;
      }

      // Compute relevance score
      let score = 0;
      const nameLower = place.name.toLowerCase();
      const addrLower = (place.address || '').toLowerCase();
      const descLower = (place.description || '').toLowerCase();

      // 1. Direct name/address match
      if (nameLower.includes(rawQuery)) score += 50;
      if (addrLower.includes(rawQuery)) score += 30;
      if (descLower.includes(rawQuery)) score += 20;

      // 2. Normalized category matches
      if (matchedCategories.includes(place.mainCategory)) score += 40;
      if (matchedSubCategories.includes(place.subCategory)) score += 45;

      // 3. Tag matches
      if (place.tags) {
        Object.keys(place.tags).forEach((k) => {
          if (matchedTags.includes(k) || rawQuery.includes(k)) score += 25;
        });
      }

      if (score === 0) return null;

      const placeWithScore: MapPlace & { _score: number; distanceMeters: number } = {
        ...place,
        distanceMeters,
        _score: score,
      };
      return placeWithScore;
    })
    .filter((p): p is MapPlace & { _score: number; distanceMeters: number } => p !== null)
    .sort((a, b) => {
      // Sort by relevance score first, then by distance if location available
      if (b._score !== a._score) return b._score - a._score;
      return (a.distanceMeters || 0) - (b.distanceMeters || 0);
    });

  return results;
}

export const normalizeQuery = (q: string) => {
  const norm = normalizeSearchQuery(q);
  return {
    ...norm,
    categories: norm.matchedCategories,
    subCategories: norm.matchedSubCategories,
    tags: norm.matchedTags,
  };
};

export const searchTallinnPlaces = searchPlaces;

