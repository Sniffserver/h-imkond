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
const TERM_ALIASES: Record<string, { categories: string[]; subCategories: string[]; tags: string[]; synonyms: string[] }> = {
  riistapood: {
    categories: ['tools'],
    subCategories: ['hardware', 'diy', 'tools', 'power_tools'],
    tags: ['tools', 'hardware'],
    synonyms: ['ehituspood', 'tööriistapood', 'rauapood', 'hardware'],
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
  päästeamet: {
    categories: ['safety'],
    subCategories: ['fire_station', 'emergency_services'],
    tags: ['rescue', 'fire_station'],
    synonyms: ['tuletõrje', 'päästekomando', 'fire'],
  },
  haigla: {
    categories: ['safety', 'health'],
    subCategories: ['hospital', 'medical', 'clinic'],
    tags: ['hospital', 'emergency'],
    synonyms: ['emo', 'kiirabi', 'arst', 'trauma'],
  },
  apteek: {
    categories: ['safety', 'health'],
    subCategories: ['pharmacy'],
    tags: ['pharmacy', 'medicine'],
    synonyms: ['valveapteek', 'rohud', 'ravimid'],
  },
  varjend: {
    categories: ['safety'],
    subCategories: ['shelter'],
    tags: ['shelter', 'civil_defense'],
    synonyms: ['avalik varjend', 'pommitusvarjend', 'tsiviilkaitse', 'varjumiskoht'],
  },
  vesi: {
    categories: ['water'],
    subCategories: ['spring', 'tap', 'hydrant', 'well'],
    tags: ['potable_water', 'natural_spring'],
    synonyms: ['joogivesi', 'allikas', 'kraan', 'veevõtukoht', 'kaev'],
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
    synonyms: ['toidupood', 'pood', 'turg', 'supermarket'],
  },
  ratas: {
    categories: ['tools', 'mobility'],
    subCategories: ['bicycle_shop', 'bike_rack'],
    tags: ['bicycle'],
    synonyms: ['jalgratas', 'rattapood', 'rattaparandus', 'bike'],
  },
};

export class PlaceSearchIndex {
  private invertedIndex: Map<string, InvertedIndexEntry[]> = new Map();
  private placesMap: Map<string, MapPlace> = new Map();
  private streetsMap: Map<string, Street> = new Map();

  constructor(places: MapPlace[] = [], streets: Street[] = []) {
    this.buildIndex(places, streets);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  public buildIndex(places: MapPlace[], streets: Street[]): void {
    this.invertedIndex.clear();
    this.placesMap.clear();
    this.streetsMap.clear();

    // 1. Index places
    for (const place of places) {
      this.placesMap.set(place.id, place);

      // Name tokens (Weight 100)
      const nameTokens = this.tokenize(place.name);
      nameTokens.forEach((token) => this.addIndexEntry(token, place.id, 'place', 'name', 100));

      // Address tokens (Weight 60)
      if (place.address) {
        const addrTokens = this.tokenize(place.address);
        addrTokens.forEach((token) => this.addIndexEntry(token, place.id, 'place', 'address', 60));
      }

      // Categories (Weight 75)
      this.addIndexEntry(place.mainCategory.toLowerCase(), place.id, 'place', 'category', 75);
      if (place.subCategory) {
        this.addIndexEntry(place.subCategory.toLowerCase(), place.id, 'place', 'subcategory', 80);
      }

      // Tags (Weight 40)
      if (place.tags) {
        Object.keys(place.tags).forEach((tag) => {
          this.addIndexEntry(tag.toLowerCase(), place.id, 'place', 'tag', 40);
        });
      }
    }

    // 2. Index streets
    for (const street of streets) {
      this.streetsMap.set(street.id, street);
      const streetTokens = this.tokenize(street.name);
      streetTokens.forEach((token) => this.addIndexEntry(token, street.id, 'street', 'name', 90));
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
   * Performs deterministic offline search with multi-token index matching and ranking.
   */
  public search(query: string, userLocation?: GeoPoint, radiusMeters?: number): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const queryTokens = this.tokenize(q);
    const candidateScores = new Map<string, { score: number; type: 'place' | 'street'; reason: string }>();

    // Check alias expansions
    const matchedCategories = new Set<string>();
    const matchedSubCategories = new Set<string>();
    const aliasExpandedTokens: string[] = [...queryTokens];

    Object.entries(TERM_ALIASES).forEach(([key, val]) => {
      if (q.includes(key) || key.includes(q)) {
        val.categories.forEach((c) => matchedCategories.add(c));
        val.subCategories.forEach((sc) => matchedSubCategories.add(sc));
        val.synonyms.forEach((syn) => aliasExpandedTokens.push(syn));
      }
    });

    // Score from Inverted Index
    for (const token of aliasExpandedTokens) {
      // 1. Exact token matches
      const exactEntries = this.invertedIndex.get(token) || [];
      for (const entry of exactEntries) {
        const current = candidateScores.get(entry.docId) || { score: 0, type: entry.type, reason: '' };
        current.score += entry.weight * 2.0;
        current.reason = `Exact token match on ${entry.field}`;
        candidateScores.set(entry.docId, current);
      }

      // 2. Prefix token matches
      for (const [indexedToken, entries] of this.invertedIndex.entries()) {
        if (indexedToken !== token && (indexedToken.startsWith(token) || token.startsWith(indexedToken))) {
          for (const entry of entries) {
            const current = candidateScores.get(entry.docId) || { score: 0, type: entry.type, reason: '' };
            current.score += entry.weight * 1.2;
            current.reason = `Prefix match on ${indexedToken}`;
            candidateScores.set(entry.docId, current);
          }
        }
      }
    }

    // Direct string scanning for complete phrase matches
    this.placesMap.forEach((place, id) => {
      const nameLower = place.name.toLowerCase();
      const addrLower = (place.address || '').toLowerCase();

      let boost = 0;
      let reason = '';

      if (nameLower === q) {
        boost += 500; // Exact full match
        reason = 'Exact name match';
      } else if (nameLower.startsWith(q)) {
        boost += 300; // Prefix match
        reason = 'Prefix name match';
      } else if (nameLower.includes(q)) {
        boost += 200; // Substring match
        reason = 'Substring name match';
      } else if (addrLower.includes(q)) {
        boost += 150; // Address match
        reason = 'Address match';
      }

      if (matchedCategories.has(place.mainCategory)) {
        boost += 180;
        reason = reason || `Category match: ${place.mainCategory}`;
      }
      if (matchedSubCategories.has(place.subCategory)) {
        boost += 220;
        reason = reason || `Subcategory match: ${place.subCategory}`;
      }

      // Freshness & authoritative boost
      if (place.provenanceStatus === 'official') {
        boost += 40;
      }

      if (boost > 0) {
        const current = candidateScores.get(id) || { score: 0, type: 'place', reason: '' };
        current.score += boost;
        current.reason = reason || current.reason;
        candidateScores.set(id, current);
      }
    });

    // Street direct scanning
    this.streetsMap.forEach((street, id) => {
      const nameLower = street.name.toLowerCase();
      let boost = 0;
      let reason = '';

      if (nameLower === q) {
        boost += 500;
        reason = 'Exact street match';
      } else if (nameLower.startsWith(q)) {
        boost += 300;
        reason = 'Prefix street match';
      } else if (nameLower.includes(q)) {
        boost += 200;
        reason = 'Street substring match';
      }

      if (boost > 0) {
        const current = candidateScores.get(id) || { score: 0, type: 'street', reason: '' };
        current.score += boost;
        current.reason = reason || current.reason;
        candidateScores.set(id, current);
      }
    });

    // Format and rank results deterministically
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

        // Deterministic distance penalty (logarithmic decay)
        const distancePenalty = distanceMeters > 0 ? Math.log10(distanceMeters + 10) * 8 : 0;
        const finalRank = info.score - distancePenalty;

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
          score: finalRank,
          _rank: finalRank,
        });
      } else {
        const street = this.streetsMap.get(docId);
        if (!street || !street.geometry.coordinates || street.geometry.coordinates.length === 0) return;

        // Use midpoint of street geometry
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

        const distancePenalty = distanceMeters > 0 ? Math.log10(distanceMeters + 10) * 8 : 0;
        const finalRank = info.score - distancePenalty;

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
          score: finalRank,
          _rank: finalRank,
        });
      }
    });

    // Deterministic sort: highest rank first, then alphabetical tie-breaker (no random ordering)
    return hits.sort((a, b) => {
      if (b._rank !== a._rank) return b._rank - a._rank;
      return a.name.localeCompare(b.name);
    });
  }
}
