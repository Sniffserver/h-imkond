import { MapPlace, Street, GeoPoint } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';

export interface SearchHit {
  entityId: string;
  type: 'place' | 'street';
  id: string;
  name: string;
  category?: string;
  subCategory?: string;
  address?: string;
  location: GeoPoint;
  place?: MapPlace;
  street?: Street;
  distanceMeters?: number;
  reason: string;
  matchReason?: string;
  score: number;
  _rank: number;
}

interface InvertedIndexEntry {
  docId: string;
  type: 'place' | 'street';
  field: 'name' | 'alias' | 'category' | 'subcategory' | 'address' | 'tag';
  weight: number;
}

// Multilingual and Estonian colloquial aliases
export const TERM_ALIASES: Record<string, { categories: string[]; subCategories: string[]; tags: string[]; synonyms: string[] }> = {
  riistapood: {
    categories: ['tools'],
    subCategories: ['hardware', 'diy', 'tools', 'power_tools'],
    tags: ['tools', 'hardware'],
    synonyms: ['ehituspood', 'tööriistapood', 'rauapood', 'hardware', 'tools'],
  },
  tools: {
    categories: ['tools'],
    subCategories: ['hardware', 'diy', 'tools'],
    tags: ['tools'],
    synonyms: ['riistapood', 'tööriistad', 'ehituspood'],
  },
  tööriistad: {
    categories: ['tools'],
    subCategories: ['hardware', 'tools'],
    tags: ['tools'],
    synonyms: ['riistapood', 'tools'],
  },
  politsei: {
    categories: ['safety'],
    subCategories: ['police'],
    tags: ['police', 'emergency_services'],
    synonyms: ['politseijaoskond', 'korrakaitse', 'patrull', 'police'],
  },
  police: {
    categories: ['safety'],
    subCategories: ['police'],
    tags: ['police'],
    synonyms: ['politsei', 'jaoskond'],
  },
  päästeamet: {
    categories: ['safety'],
    subCategories: ['fire_station', 'emergency_services'],
    tags: ['rescue', 'fire_station'],
    synonyms: ['tuletõrje', 'päästekomando', 'fire', 'rescue'],
  },
  haigla: {
    categories: ['safety', 'health'],
    subCategories: ['hospital', 'medical', 'clinic'],
    tags: ['hospital', 'emergency'],
    synonyms: ['emo', 'kiirabi', 'arst', 'trauma', 'hospital'],
  },
  hospital: {
    categories: ['safety', 'health'],
    subCategories: ['hospital'],
    tags: ['hospital'],
    synonyms: ['haigla', 'emo', 'kiirabi'],
  },
  apteek: {
    categories: ['safety', 'health'],
    subCategories: ['pharmacy'],
    tags: ['pharmacy', 'medicine'],
    synonyms: ['valveapteek', 'rohud', 'ravimid', 'pharmacy', 'chemist'],
  },
  pharmacy: {
    categories: ['safety', 'health'],
    subCategories: ['pharmacy'],
    tags: ['pharmacy'],
    synonyms: ['apteek', 'valveapteek', 'medicine'],
  },
  varjend: {
    categories: ['safety'],
    subCategories: ['shelter'],
    tags: ['shelter', 'civil_defense'],
    synonyms: ['avalik varjend', 'pommitusvarjend', 'tsiviilkaitse', 'varjumiskoht', 'shelter'],
  },
  shelter: {
    categories: ['safety'],
    subCategories: ['shelter'],
    tags: ['shelter'],
    synonyms: ['varjend', 'varjumiskoht'],
  },
  vesi: {
    categories: ['water'],
    subCategories: ['spring', 'tap', 'hydrant', 'well'],
    tags: ['potable_water', 'natural_spring', 'drinking_water'],
    synonyms: ['joogivesi', 'allikas', 'kraan', 'veevõtukoht', 'kaev', 'water'],
  },
  water: {
    categories: ['water'],
    subCategories: ['spring', 'tap', 'hydrant', 'well'],
    tags: ['potable_water', 'drinking_water'],
    synonyms: ['vesi', 'joogivesi', 'allikas', 'kraan', 'well', 'tap', 'spring'],
  },
  uuskasutus: {
    categories: ['finds'],
    subCategories: ['second_hand', 'reuse', 'give_box'],
    tags: ['reuse', 'mutual_aid'],
    synonyms: ['kaltsukas', 'kirbukas', 'tasuta', 'second hand', 'reuse'],
  },
  reuse: {
    categories: ['finds'],
    subCategories: ['second_hand', 'reuse', 'give_box', 'public_bookcase', 'tool_library'],
    tags: ['reuse', 'mutual_aid', 'freeshop'],
    synonyms: ['uuskasutus', 'second hand', 'free stuff', 'give box'],
  },
  toit: {
    categories: ['stores', 'food'],
    subCategories: ['supermarket', 'market', 'grocery', 'bakery'],
    tags: ['food'],
    synonyms: ['toidupood', 'pood', 'turg', 'supermarket', 'food'],
  },
  food: {
    categories: ['stores', 'food'],
    subCategories: ['supermarket', 'market', 'grocery'],
    tags: ['food'],
    synonyms: ['toit', 'toidupood', 'pood'],
  },
  ratas: {
    categories: ['tools', 'mobility'],
    subCategories: ['bicycle_shop', 'bike_rack'],
    tags: ['bicycle'],
    synonyms: ['jalgratas', 'rattapood', 'rattaparandus', 'bike', 'bicycle'],
  },
};

/**
 * Normalizes Estonian street suffixes (tn -> tänav, mnt -> maantee, pst -> puiestee)
 */
export function normalizeStreetSuffixes(text: string): string {
  return text
    .toLowerCase()
    .replace(/\btn\.?\b/g, 'tänav')
    .replace(/\bmnt\.?\b/g, 'maantee')
    .replace(/\bpst\.?\b/g, 'puiestee')
    .replace(/\bpk\.?\b/g, 'põik')
    .replace(/\s+/g, ' ')
    .trim();
}

export class PlaceSearchIndex {
  private invertedIndex: Map<string, InvertedIndexEntry[]> = new Map();
  private placesMap: Map<string, MapPlace> = new Map();
  private streetsMap: Map<string, Street> = new Map();

  constructor(places: MapPlace[] = [], streets: Street[] = []) {
    this.buildIndex(places, streets);
  }

  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  public buildIndex(places: MapPlace[], streets: Street[]): void {
    this.invertedIndex.clear();
    this.placesMap.clear();
    this.streetsMap.clear();

    // 1. Index places
    for (const place of places) {
      this.placesMap.set(place.id, place);

      // Name tokens
      const nameTokens = this.tokenize(place.name);
      nameTokens.forEach((token) => this.addIndexEntry(token, place.id, 'place', 'name', 100));

      // Address tokens
      if (place.address) {
        const addrTokens = this.tokenize(place.address);
        addrTokens.forEach((token) => this.addIndexEntry(token, place.id, 'place', 'address', 60));
        const normAddr = normalizeStreetSuffixes(place.address);
        const normTokens = this.tokenize(normAddr);
        normTokens.forEach((token) => this.addIndexEntry(token, place.id, 'place', 'address', 60));
      }

      // Categories
      this.addIndexEntry(place.mainCategory.toLowerCase(), place.id, 'place', 'category', 75);
      if (place.subCategory) {
        this.addIndexEntry(place.subCategory.toLowerCase(), place.id, 'place', 'subcategory', 80);
      }

      // Tags
      if (place.tags) {
        Object.entries(place.tags).forEach(([k, v]) => {
          this.addIndexEntry(k.toLowerCase(), place.id, 'place', 'tag', 40);
          if (typeof v === 'string') {
            this.addIndexEntry(v.toLowerCase(), place.id, 'place', 'tag', 40);
          }
        });
      }
    }

    // 2. Index streets
    for (const street of streets) {
      this.streetsMap.set(street.id, street);
      const streetTokens = this.tokenize(street.name);
      streetTokens.forEach((token) => this.addIndexEntry(token, street.id, 'street', 'name', 90));
      const normStreet = normalizeStreetSuffixes(street.name);
      const normTokens = this.tokenize(normStreet);
      normTokens.forEach((token) => this.addIndexEntry(token, street.id, 'street', 'name', 90));

      if (street.district) {
        this.addIndexEntry(street.district.toLowerCase(), street.id, 'street', 'address', 50);
      }
    }
  }

  private addIndexEntry(token: string, docId: string, type: 'place' | 'street', field: InvertedIndexEntry['field'], weight: number): void {
    let entries = this.invertedIndex.get(token);
    if (!entries) {
      entries = [];
      this.invertedIndex.set(token, entries);
    }
    entries.push({ docId, type, field, weight });
  }

  /**
   * Performs deterministic search according to strict ranking hierarchy:
   * exact name -> exact street -> prefix -> alias -> category -> distance -> freshness
   */
  public search(query: string, userLocation?: GeoPoint, radiusMeters?: number): SearchHit[] {
    const rawQ = query.trim().toLowerCase();
    if (!rawQ) return [];

    const normQ = normalizeStreetSuffixes(rawQ);
    const queryTokens = this.tokenize(rawQ);
    const normTokens = this.tokenize(normQ);
    const allTokens = Array.from(new Set([...queryTokens, ...normTokens]));

    // Parse structured query tokens (Category terms, Location/Street terms, Numbers)
    const categoryMatches = new Set<string>();
    const subCategoryMatches = new Set<string>();
    const locationTokens: string[] = [];
    const numberTokens: string[] = [];

    for (const tok of allTokens) {
      if (/^\d+[a-z]?$/i.test(tok)) {
        numberTokens.push(tok);
      } else if (TERM_ALIASES[tok]) {
        TERM_ALIASES[tok].categories.forEach((c) => categoryMatches.add(c));
        TERM_ALIASES[tok].subCategories.forEach((sc) => subCategoryMatches.add(sc));
      } else {
        locationTokens.push(tok);
      }
    }

    const candidateScores = new Map<
      string,
      { tier: number; score: number; type: 'place' | 'street'; reason: string }
    >();

    const recordCandidate = (
      id: string,
      type: 'place' | 'street',
      tier: number,
      scoreBonus: number,
      reason: string
    ) => {
      const existing = candidateScores.get(id);
      if (!existing || tier < existing.tier || (tier === existing.tier && scoreBonus > existing.score)) {
        candidateScores.set(id, { tier, score: scoreBonus, type, reason });
      }
    };

    // -------------------------------------------------------------
    // TIER 1: Exact Place Name Match
    // -------------------------------------------------------------
    this.placesMap.forEach((place, id) => {
      const pName = place.name.toLowerCase();
      if (pName === rawQ || pName === normQ) {
        recordCandidate(id, 'place', 1, 100000, 'Exact place name match');
      }
    });

    // -------------------------------------------------------------
    // TIER 2: Exact Street Match (e.g. "Viru tänav", "Viru tn")
    // -------------------------------------------------------------
    this.streetsMap.forEach((street, id) => {
      const sName = street.name.toLowerCase();
      const sNorm = normalizeStreetSuffixes(sName);
      if (sName === rawQ || sNorm === rawQ || sName === normQ || sNorm === normQ) {
        recordCandidate(id, 'street', 2, 50000, 'Exact street match');
      }
    });

    // -------------------------------------------------------------
    // TIER 3: Prefix Match on Place Name or Street
    // -------------------------------------------------------------
    this.placesMap.forEach((place, id) => {
      const pName = place.name.toLowerCase();
      if (pName.startsWith(rawQ) || pName.startsWith(normQ)) {
        recordCandidate(id, 'place', 3, 25000 + (100 - pName.length), 'Prefix place match');
      }
    });

    this.streetsMap.forEach((street, id) => {
      const sName = street.name.toLowerCase();
      const sNorm = normalizeStreetSuffixes(sName);
      if (sName.startsWith(rawQ) || sNorm.startsWith(normQ) || sName.startsWith(normQ)) {
        recordCandidate(id, 'street', 3, 24000 + (100 - sName.length), 'Prefix street match');
      }
    });

    // -------------------------------------------------------------
    // TIER 4: Alias / Compound Category+Location or Street+Number
    // Examples: "apteek Viru", "water Viru", "Viru 4"
    // -------------------------------------------------------------
    this.placesMap.forEach((place, id) => {
      const pName = place.name.toLowerCase();
      const pAddr = (place.address || '').toLowerCase();
      const pNormAddr = normalizeStreetSuffixes(pAddr);

      // Check compound category + location (e.g. "apteek Viru", "water Viru")
      if (categoryMatches.size > 0 || subCategoryMatches.size > 0) {
        const matchesCat =
          categoryMatches.has(place.mainCategory.toLowerCase()) ||
          (place.subCategory && subCategoryMatches.has(place.subCategory.toLowerCase())) ||
          (place.tags && Object.keys(place.tags).some((t) => categoryMatches.has(t) || subCategoryMatches.has(t)));

        if (matchesCat) {
          // Check if location tokens match this place or its street
          const matchesLoc = locationTokens.length === 0 || locationTokens.some(
            (loc) => pName.includes(loc) || pAddr.includes(loc) || pNormAddr.includes(loc)
          );

          if (matchesLoc) {
            recordCandidate(
              id,
              'place',
              4,
              15000 + (locationTokens.length > 0 ? 3000 : 0),
              `Alias category match: ${place.mainCategory} in ${place.name}`
            );
          }
        }
      }

      // Check house number structured match (e.g. "Viru 4")
      if (numberTokens.length > 0 && locationTokens.length > 0) {
        const matchesStreet = locationTokens.every(
          (loc) => pName.includes(loc) || pAddr.includes(loc) || pNormAddr.includes(loc)
        );
        const matchesNum = numberTokens.some(
          (num) => pAddr.includes(num) || pName.includes(num)
        );

        if (matchesStreet && matchesNum) {
          recordCandidate(id, 'place', 4, 18000, `Address match: ${place.address}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TIER 5: Category & Tag Search
    // -------------------------------------------------------------
    this.placesMap.forEach((place, id) => {
      if (categoryMatches.has(place.mainCategory.toLowerCase()) || (place.subCategory && subCategoryMatches.has(place.subCategory.toLowerCase()))) {
        recordCandidate(id, 'place', 5, 8000, `Category match: ${place.mainCategory}`);
      }
    });

    // -------------------------------------------------------------
    // TIER 6: Substring / Token Multi-Term Inverted Index Search
    // -------------------------------------------------------------
    this.placesMap.forEach((place, id) => {
      const pName = place.name.toLowerCase();
      const pAddr = (place.address || '').toLowerCase();
      if (allTokens.some((tok) => pName.includes(tok) || pAddr.includes(tok))) {
        recordCandidate(id, 'place', 6, 3000, `Token match: ${place.name}`);
      }
    });

    this.streetsMap.forEach((street, id) => {
      const sName = street.name.toLowerCase();
      const sNorm = normalizeStreetSuffixes(sName);
      if (allTokens.some((tok) => sName.includes(tok) || sNorm.includes(tok))) {
        recordCandidate(id, 'street', 6, 2500, `Street token match: ${street.name}`);
      }
    });

    // -------------------------------------------------------------
    // Compile Hits & Apply Tier Rank + Distance + Freshness Modifiers
    // -------------------------------------------------------------
    const hits: SearchHit[] = [];

    candidateScores.forEach((info, docId) => {
      if (info.type === 'place') {
        const place = this.placesMap.get(docId);
        if (!place) return;

        let distanceMeters = 0;
        if (userLocation) {
          distanceMeters = Math.round(
            haversineDistanceMeters(userLocation.lat, userLocation.lng, place.location.lat, place.location.lng)
          );
        }

        if (radiusMeters && distanceMeters > radiusMeters) return;

        // Base tier multiplier (Tier 1 gets highest base)
        const tierBase = (7 - info.tier) * 20000;
        
        // Distance modifier: Closer items within tier get smooth boost (up to +500)
        const distanceBonus = userLocation && distanceMeters > 0
          ? Math.max(0, 500 - Math.min(500, distanceMeters / 20))
          : 0;

        // Freshness & official provenance boost
        const freshnessBonus = place.provenanceStatus === 'official' ? 200 : 50;

        const finalScore = tierBase + info.score + distanceBonus + freshnessBonus;

        hits.push({
          entityId: place.id,
          type: 'place',
          id: place.id,
          name: place.name,
          category: place.mainCategory,
          subCategory: place.subCategory,
          address: place.address,
          location: place.location,
          place,
          distanceMeters: userLocation ? distanceMeters : undefined,
          reason: info.reason,
          matchReason: info.reason,
          score: finalScore,
          _rank: finalScore,
        });
      } else {
        const street = this.streetsMap.get(docId);
        if (!street || !street.geometry.coordinates || street.geometry.coordinates.length === 0) return;

        const midIdx = Math.floor(street.geometry.coordinates.length / 2);
        const [lng, lat] = street.geometry.coordinates[midIdx];
        const location = { lat, lng };

        let distanceMeters = 0;
        if (userLocation) {
          distanceMeters = Math.round(
            haversineDistanceMeters(userLocation.lat, userLocation.lng, lat, lng)
          );
        }

        if (radiusMeters && distanceMeters > radiusMeters) return;

        const tierBase = (7 - info.tier) * 20000;
        const distanceBonus = userLocation && distanceMeters > 0
          ? Math.max(0, 500 - Math.min(500, distanceMeters / 20))
          : 0;

        const finalScore = tierBase + info.score + distanceBonus;

        hits.push({
          entityId: street.id,
          type: 'street',
          id: street.id,
          name: street.name,
          category: 'Street',
          subCategory: street.highwayClass,
          address: street.district,
          location,
          street,
          distanceMeters: userLocation ? distanceMeters : undefined,
          reason: info.reason,
          matchReason: info.reason,
          score: finalScore,
          _rank: finalScore,
        });
      }
    });

    // Sort by rank descending
    return hits.sort((a, b) => {
      if (b._rank !== a._rank) return b._rank - a._rank;
      return a.name.localeCompare(b.name);
    });
  }
}
