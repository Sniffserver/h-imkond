/**
 * Lightweight, zero-dependency offline full-text search index for HÕIMU.
 *
 * Designed for local-first, zero-cloud mesh environments:
 * - In-memory inverted index with tokenization and normalization
 * - Diacritic stripping and case insensitivity
 * - Field-weighted scoring (e.g. title: 5x, tags/category: 3x, description/reflection: 1.5x)
 * - Prefix matching for fast type-ahead search
 * - Multi-term queries with intersection boosting and ranking
 * - Highlight fragment generator for UI presentation
 */

export interface IndexableField {
  name: string;
  weight: number;
}

export interface SearchableItem<T = any> {
  id: string;
  fields: Record<string, string | string[] | number | undefined>;
  data: T;
}

export interface SearchMatchResult<T = any> {
  id: string;
  item: T;
  score: number;
  matchedTerms: string[];
  matchedFields: string[];
  highlights: Record<string, string>;
}

export interface SearchIndexConfig {
  fields: IndexableField[];
  minTokenLength?: number;
  prefixMatch?: boolean;
}

/**
 * Normalizes text: lowercase, trims, strips diacritics (e.g., ä/ö/õ/ü -> a/o/o/u or preserved equivalents),
 * and removes non-alphanumeric punctuation.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Splits text into normalized search tokens.
 */
export function tokenize(text: string, minLength = 2): string[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  // Match alphanumeric words (including Estonian / European letters)
  const rawWords = normalized.split(/[\s,.;:!?_/\-+()\[\]"']+/);
  const validTokens: string[] = [];

  for (const word of rawWords) {
    const cleaned = word.replace(/[^a-z0-9]/g, '');
    if (cleaned.length >= minLength) {
      validTokens.push(cleaned);
    }
  }

  return validTokens;
}

/**
 * Lightweight in-memory full-text search index.
 */
export class LightweightSearchIndex<T = any> {
  private config: Required<SearchIndexConfig>;
  // Map of documentId -> SearchableItem<T>
  private documents: Map<string, SearchableItem<T>> = new Map();
  // Inverted index: token -> Map<docId, { [fieldName]: termFrequency }>
  private invertedIndex: Map<string, Map<string, Record<string, number>>> = new Map();
  // Field weights quick lookup
  private fieldWeightsMap: Map<string, number> = new Map();

  constructor(config: SearchIndexConfig) {
    this.config = {
      fields: config.fields,
      minTokenLength: config.minTokenLength ?? 2,
      prefixMatch: config.prefixMatch ?? true,
    };

    for (const f of this.config.fields) {
      this.fieldWeightsMap.set(f.name, f.weight);
    }
  }

  /**
   * Adds or replaces a document in the index.
   */
  public addDocument(doc: SearchableItem<T>): void {
    // Remove if already exists to prevent duplicate scoring
    if (this.documents.has(doc.id)) {
      this.removeDocument(doc.id);
    }

    this.documents.set(doc.id, doc);

    for (const field of this.config.fields) {
      const val = doc.fields[field.name];
      if (val === undefined || val === null) continue;

      const textValue = Array.isArray(val) ? val.join(' ') : String(val);
      const tokens = tokenize(textValue, this.config.minTokenLength);

      for (const token of tokens) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Map());
        }

        const postingList = this.invertedIndex.get(token)!;
        if (!postingList.has(doc.id)) {
          postingList.set(doc.id, {});
        }

        const docStats = postingList.get(doc.id)!;
        docStats[field.name] = (docStats[field.name] || 0) + 1;
      }
    }
  }

  /**
   * Indexes an array of documents.
   */
  public addAll(docs: SearchableItem<T>[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /**
   * Clears and replaces all documents.
   */
  public reset(docs: SearchableItem<T>[]): void {
    this.documents.clear();
    this.invertedIndex.clear();
    this.addAll(docs);
  }

  /**
   * Removes a document from the index.
   */
  public removeDocument(id: string): void {
    if (!this.documents.has(id)) return;
    this.documents.delete(id);

    // Clean from posting lists
    for (const [token, postingList] of this.invertedIndex.entries()) {
      postingList.delete(id);
      if (postingList.size === 0) {
        this.invertedIndex.delete(token);
      }
    }
  }

  /**
   * Executes a search query and returns ranked results with scores and highlights.
   */
  public search(query: string, maxResults = 50): SearchMatchResult<T>[] {
    const rawQueryTokens = tokenize(query, 1);
    if (rawQueryTokens.length === 0) {
      return [];
    }

    const docScores = new Map<string, {
      score: number;
      matchedTerms: Set<string>;
      matchedFields: Set<string>;
    }>();

    for (const qToken of rawQueryTokens) {
      // Find matching tokens in index (exact + prefix match if enabled)
      const matchingIndexTokens: string[] = [];

      if (this.invertedIndex.has(qToken)) {
        matchingIndexTokens.push(qToken);
      }

      if (this.config.prefixMatch && qToken.length >= 2) {
        for (const indexToken of this.invertedIndex.keys()) {
          if (indexToken.startsWith(qToken) && indexToken !== qToken) {
            matchingIndexTokens.push(indexToken);
          }
        }
      }

      // Aggregate scores
      for (const token of matchingIndexTokens) {
        const isExact = token === qToken;
        const prefixMultiplier = isExact ? 1.0 : 0.65;
        const postingList = this.invertedIndex.get(token);
        if (!postingList) continue;

        for (const [docId, fieldFreqs] of postingList.entries()) {
          if (!docScores.has(docId)) {
            docScores.set(docId, {
              score: 0,
              matchedTerms: new Set(),
              matchedFields: new Set(),
            });
          }

          const docEntry = docScores.get(docId)!;
          docEntry.matchedTerms.add(qToken);

          for (const [fieldName, freq] of Object.entries(fieldFreqs)) {
            const weight = this.fieldWeightsMap.get(fieldName) ?? 1.0;
            // BM25-like sub-linear term frequency calculation
            const tfScore = Math.sqrt(freq);
            docEntry.score += tfScore * weight * prefixMultiplier;
            docEntry.matchedFields.add(fieldName);
          }
        }
      }
    }

    // Boost documents that matched multiple query terms (coordinate matching bonus)
    for (const [_, entry] of docScores.entries()) {
      const termCoverage = entry.matchedTerms.size / rawQueryTokens.length;
      entry.score *= 1.0 + termCoverage * 1.5;
    }

    // Convert to sorted array
    const sortedEntries = Array.from(docScores.entries())
      .filter(([_, data]) => data.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, maxResults);

    // Build rich result objects with highlighted snippets
    return sortedEntries.map(([docId, meta]) => {
      const doc = this.documents.get(docId)!;
      const highlights: Record<string, string> = {};

      for (const field of this.config.fields) {
        const rawVal = doc.fields[field.name];
        if (rawVal !== undefined && rawVal !== null) {
          const str = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal);
          highlights[field.name] = this.generateHighlightSnippet(str, rawQueryTokens);
        }
      }

      return {
        id: docId,
        item: doc.data,
        score: Math.round(meta.score * 100) / 100,
        matchedTerms: Array.from(meta.matchedTerms),
        matchedFields: Array.from(meta.matchedFields),
        highlights,
      };
    });
  }

  /**
   * Generates a safe text snippet with matched terms highlighted using markdown/HTML.
   */
  private generateHighlightSnippet(text: string, queryTokens: string[]): string {
    if (!text) return '';
    let result = text;
    for (const q of queryTokens) {
      if (!q || q.length < 2) continue;
      const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
      result = result.replace(regex, '<mark>$1</mark>');
    }
    return result;
  }

  /**
   * Returns total indexed documents count.
   */
  public get size(): number {
    return this.documents.size;
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
