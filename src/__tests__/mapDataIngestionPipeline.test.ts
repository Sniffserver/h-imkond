import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const requireFn = createRequire(import.meta.url);
(globalThis as any).nodeZlib = requireFn('zlib');

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fetchOsmData } from '../../tools/map-data/osm/fetch';
import { normalizeOsmBatch } from '../../tools/map-data/osm/normalize';
import { validateOsmBatch } from '../../tools/map-data/osm/validate';
import { fetchTallinnMunicipalData } from '../../tools/map-data/tallinn/fetch';
import { normalizeTallinnBatch } from '../../tools/map-data/tallinn/normalize';
import { validateTallinnBatch } from '../../tools/map-data/tallinn/validate';
import { fetchPaasteametData } from '../../tools/map-data/paasteamet/fetch';
import { normalizePaasteametBatch } from '../../tools/map-data/paasteamet/normalize';
import { fetchAdsData } from '../../tools/map-data/ads/fetch';
import { buildAdsIndex } from '../../tools/map-data/ads/normalize';
import { deduplicateRecords } from '../../tools/map-data/merge/dedupe';
import { detectConflicts } from '../../tools/map-data/merge/conflicts';
import { synthesizeCanonicalPlaces } from '../../tools/map-data/merge/provenance';
import { buildPMTilesBuffer } from '../../tools/map-data/build/pmtiles';
import { buildPoiBinaryIndex } from '../../tools/map-data/build/poi-index';
import { buildRoutingGraphBuffer, buildStreetIndexBuffer } from '../../tools/map-data/build/street-index';
import { validatePMTilesHeader } from '../features/map/packs/MapPackManifest';

describe('HÕIMU Real Map Data Ingestion Pipeline', () => {
  describe('Step 1: Multi-Source Fetch Workers', () => {
    it('fetches OSM dataset with cryptographic checksum and snapshot metadata', async () => {
      const res = await fetchOsmData();
      expect(res.elements.length).toBeGreaterThan(0);
      expect(res.metadata.source).toBe('osm');
      expect(res.metadata.checksum).toHaveLength(64);
      expect(res.metadata.snapshotId).toContain('osm-tln-');
    });

    it('fetches Tallinn municipal geoportal points with official categories', async () => {
      const res = await fetchTallinnMunicipalData();
      expect(res.records.length).toBeGreaterThan(0);
      expect(res.metadata.source).toBe('tallinn');
      expect(res.metadata.checksum).toHaveLength(64);
      expect(res.metadata.snapshotId).toContain('tln-mun-');

      const waterPoints = res.records.filter((r) => r.kategooria === 'joogivesi_kraan' || r.kategooria === 'looduslik_allikas');
      expect(waterPoints.length).toBeGreaterThan(0);
    });

    it('fetches Päästeamet public shelters with official capacity and validation timestamps', async () => {
      const res = await fetchPaasteametData();
      expect(res.records.length).toBeGreaterThan(0);
      expect(res.metadata.source).toBe('paasteamet');
      expect(res.metadata.checksum).toHaveLength(64);
      expect(res.metadata.snapshotId).toContain('rescue-tln-');

      const shelters = res.records.filter((r) => r.objekti_kood.startsWith('VARJ'));
      expect(shelters.length).toBeGreaterThan(0);
      expect(shelters[0].mahutavus).toBeGreaterThan(0);
      expect(shelters[0].viimati_kontrollitud).toBeDefined();
    });

    it('fetches Estonian Address Data System (ADS) official spatial address points', async () => {
      const res = await fetchAdsData();
      expect(res.records.length).toBeGreaterThan(0);
      expect(res.metadata.source).toBe('ads');
      const adsIndex = buildAdsIndex(res);
      const match = adsIndex.lookup('Pärnu mnt', '139');
      expect(match).toBeDefined();
      expect(match?.officialFullAddress).toContain('Pärnu mnt 139');
    });
  });

  describe('Step 2 & 3: Normalization & Validation', () => {
    it('normalizes OSM tags into canonical categories', async () => {
      const raw = await fetchOsmData();
      const norm = normalizeOsmBatch(raw);
      expect(norm.length).toBeGreaterThan(0);

      const { validRecords, rejectedRecords } = validateOsmBatch(norm);
      expect(validRecords.length).toBe(norm.length);
      expect(rejectedRecords.length).toBe(0);
    });

    it('normalizes Tallinn municipal and PPA records with verified authority codes', async () => {
      const raw = await fetchTallinnMunicipalData();
      const norm = normalizeTallinnBatch(raw);
      expect(norm.length).toBeGreaterThan(0);

      const { validRecords, rejectedRecords } = validateTallinnBatch(norm);
      expect(validRecords.length).toBe(norm.length);
      expect(rejectedRecords.length).toBe(0);

      const ppa = validRecords.find((r) => r.source === 'ppa');
      expect(ppa).toBeDefined();
      expect(ppa?.sourceId).toContain('PPA-REG');
    });

    it('normalizes Päästeamet shelters and records sourceUpdatedAt and snapshotId', async () => {
      const raw = await fetchPaasteametData();
      const norm = normalizePaasteametBatch(raw);
      const shelter = norm.find((r) => r.subCategory === 'shelter');
      expect(shelter).toBeDefined();
      expect(shelter?.sourceUpdatedAt).toBeDefined();
      expect(shelter?.snapshotId).toBeDefined();
      expect(shelter?.ingestedAt).toBeDefined();
    });
  });

  describe('Step 4 & 5: Deduplication, Conflicts & Provenance', () => {
    it('deduplicates authoritative records against OSM candidates using Haversine distance', async () => {
      const osmRaw = await fetchOsmData();
      const normOsm = normalizeOsmBatch(osmRaw);
      const tlnRaw = await fetchTallinnMunicipalData();
      const normTln = normalizeTallinnBatch(tlnRaw);

      const dedupe = deduplicateRecords(normTln, normOsm, 65);
      expect(dedupe.matchedPairs.length).toBeGreaterThan(0);

      // Kesklinn police station should be matched with its OSM counterpart
      const match = dedupe.matchedPairs.find((m) => m.primary.name.includes('Põhja Prefektuur (Kesklinna Jaoskond)'));
      expect(match).toBeDefined();
      expect(match?.distanceMeters).toBeLessThanOrEqual(65);
    });

    it('detects and flags coordinate and address discrepancies', async () => {
      const osmRaw = await fetchOsmData();
      const normOsm = normalizeOsmBatch(osmRaw);
      const tlnRaw = await fetchTallinnMunicipalData();
      const normTln = normalizeTallinnBatch(tlnRaw);

      const dedupe = deduplicateRecords(normTln, normOsm, 65);
      const kesklinnaPair = dedupe.matchedPairs.find((m) => m.primary.name.includes('Põhja Prefektuur (Kesklinna Jaoskond)'));
      expect(kesklinnaPair).toBeDefined();

      if (kesklinnaPair) {
        const conflict = detectConflicts(kesklinnaPair.primary, kesklinnaPair.secondary);
        expect(conflict.hasMismatch).toBe(true);
        expect(conflict.discrepancies.length).toBeGreaterThan(0);

        const addrMismatch = conflict.discrepancies.find((d) => d.field.includes('Address'));
        expect(addrMismatch).toBeDefined();
      }
    });

    it('synthesizes canonical places while strictly safeguarding community observations', async () => {
      const osmRaw = await fetchOsmData();
      const normOsm = normalizeOsmBatch(osmRaw);
      const tlnRaw = await fetchTallinnMunicipalData();
      const normTln = normalizeTallinnBatch(tlnRaw);

      const dedupe = deduplicateRecords(normTln, normOsm, 65);
      const places = synthesizeCanonicalPlaces(dedupe);

      expect(places.length).toBeGreaterThan(0);

      const communityPlace = places.find((p) => p.name.includes('Telliskivi Mutual Aid Tool Library'));
      expect(communityPlace).toBeDefined();
      expect(communityPlace?.source).toBe('hoimu');
      expect(communityPlace?.provenanceStatus).toBe('community');
      expect(communityPlace?.observedByNodes).toBe(3);
    });
  });

  describe('Step 6: Binary Artifacts & Manifest Integrity', () => {
    it('generates valid PMTiles v3 buffer with compliant header magic and metadata', () => {
      const buffer = buildPMTilesBuffer({
        outputPath: 'test.pmtiles',
        name: 'Tallinn Test Vector',
        description: 'Test vector tiles',
      });

      expect(buffer.length).toBeGreaterThanOrEqual(127);
      const validation = validatePMTilesHeader(new Uint8Array(buffer));
      expect(validation.valid).toBe(true);
    });

    it('generates binary POI index with valid HPOII header', async () => {
      const osmRaw = await fetchOsmData();
      const normOsm = normalizeOsmBatch(osmRaw);
      const tlnRaw = await fetchTallinnMunicipalData();
      const normTln = normalizeTallinnBatch(tlnRaw);

      const dedupe = deduplicateRecords(normTln, normOsm, 65);
      const places = synthesizeCanonicalPlaces(dedupe);

      const buf = buildPoiBinaryIndex(places);
      expect(buf.toString('ascii', 0, 5)).toBe('HPOII');
      expect(buf.readUInt32LE(8)).toBe(places.length);
    });

    it('generates routing graph and street index with genuine topology', () => {
      const { buffer: routingBuf, nodeCount, edgeCount } = buildRoutingGraphBuffer();
      expect(routingBuf.toString('ascii', 0, 6)).toBe('HROUTG');
      expect(nodeCount).toBeGreaterThan(0);
      expect(edgeCount).toBeGreaterThan(0);

      const streetBuf = buildStreetIndexBuffer();
      expect(streetBuf.toString('ascii', 0, 7)).toBe('HSTRIDX');
    });

    it('verifies that manifest.json contains authentic hashes and that all referenced artifacts exist on disk', () => {
      const manifestPath = path.resolve('src/data/generated/manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Check for placeholder patterns that indicate fake data
      const EMPTY_STRING_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(manifestContent.basemap.sha256).not.toBe(EMPTY_STRING_SHA256);
      expect(manifestContent.poi.sha256).not.toContain('a1b2c3d4');
      expect(manifestContent.routing.sha256).not.toContain('7890abcd');
      expect(manifestContent.streetIndex.sha256).not.toContain('cdef1234');

      // Verify all artifact files exist on disk
      const basemapFile = path.resolve('src/data/generated', manifestContent.basemap.filename);
      const poiFile = path.resolve('src/data/generated', manifestContent.poi.filename);
      const poiIndexFile = path.resolve('src/data/generated', manifestContent.poi.index);
      const routingFile = path.resolve('src/data/generated', manifestContent.routing.filename);
      const streetIndexFile = path.resolve('src/data/generated', manifestContent.streetIndex.filename);

      expect(fs.existsSync(basemapFile)).toBe(true);
      expect(fs.existsSync(poiFile)).toBe(true);
      expect(fs.existsSync(poiIndexFile)).toBe(true);
      expect(fs.existsSync(routingFile)).toBe(true);
      expect(fs.existsSync(streetIndexFile)).toBe(true);

      // Verify exact SHA-256 match between file on disk and manifest
      const computedBasemapSha = crypto.createHash('sha256').update(fs.readFileSync(basemapFile)).digest('hex');
      expect(manifestContent.basemap.sha256).toBe(computedBasemapSha);

      const computedPoiSha = crypto.createHash('sha256').update(fs.readFileSync(poiFile)).digest('hex');
      expect(manifestContent.poi.sha256).toBe(computedPoiSha);

      const computedRoutingSha = crypto.createHash('sha256').update(fs.readFileSync(routingFile)).digest('hex');
      expect(manifestContent.routing.sha256).toBe(computedRoutingSha);

      const computedStreetIndexSha = crypto.createHash('sha256').update(fs.readFileSync(streetIndexFile)).digest('hex');
      expect(manifestContent.streetIndex.sha256).toBe(computedStreetIndexSha);
    });
  });
});
