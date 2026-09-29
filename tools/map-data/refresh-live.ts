/**
 * maps:refresh-live — Live Source Ingestion & Snapshot Refresh Worker
 * 
 * Explicitly fetches live data from authoritative and community upstream APIs:
 *  - OpenStreetMap Overpass API
 *  - Tallinn Geoportal (gis.tallinn.ee)
 *  - Päästeamet Civil Defense Open Data (avaandmed.eesti.ee)
 *  - Maa-amet ADS Gazetteer (inaadress.maaamet.ee)
 * 
 * Writes immutable snapshot JSON files to tools/map-data/snapshots/ with SHA-256 integrity metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchOsmData } from './sources/osm/fetch';
import { fetchTallinnData } from './sources/tallinn/fetch';
import { fetchPaasteametData } from './sources/paasteamet/fetch';
import { fetchAdsData } from './sources/ads/fetch';

export async function refreshLiveSnapshots(): Promise<void> {
  console.log('====================================================================');
  console.log('  HÕIMU Live Upstream Source Ingestion (npm run maps:refresh-live)');
  console.log('====================================================================\n');

  const rootDir = process.cwd();
  const snapshotsDir = path.join(rootDir, 'tools', 'map-data', 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  console.log('[1/4] Fetching live OpenStreetMap Overpass elements...');
  const osmResult = await fetchOsmData(undefined, true);
  const osmPath = path.join(snapshotsDir, 'osm.snapshot.json');
  fs.writeFileSync(
    osmPath,
    JSON.stringify({ snapshot: osmResult.snapshot, data: osmResult.elements }, null, 2)
  );
  console.log(`      ✓ Saved OSM snapshot (${osmResult.elements.length} elements) -> ${osmPath}`);

  console.log('[2/4] Fetching live Tallinn Municipal Geoportal points...');
  const tallinnResult = await fetchTallinnData(true);
  const tallinnPath = path.join(snapshotsDir, 'tallinn.snapshot.json');
  fs.writeFileSync(
    tallinnPath,
    JSON.stringify({ snapshot: tallinnResult.snapshot, data: tallinnResult.records }, null, 2)
  );
  console.log(`      ✓ Saved Tallinn snapshot (${tallinnResult.records.length} records) -> ${tallinnPath}`);

  console.log('[3/4] Fetching live Päästeamet Public Shelters & Emergency registries...');
  const paasteametResult = await fetchPaasteametData(true);
  const paasteametPath = path.join(snapshotsDir, 'paasteamet.snapshot.json');
  fs.writeFileSync(
    paasteametPath,
    JSON.stringify({ snapshot: paasteametResult.snapshot, data: paasteametResult.records }, null, 2)
  );
  console.log(`      ✓ Saved Päästeamet snapshot (${paasteametResult.records.length} records) -> ${paasteametPath}`);

  console.log('[4/4] Fetching live Maa-amet ADS Address System points...');
  const adsResult = await fetchAdsData(true);
  const adsPath = path.join(snapshotsDir, 'ads.snapshot.json');
  fs.writeFileSync(
    adsPath,
    JSON.stringify({ snapshot: adsResult.snapshot, data: adsResult.records }, null, 2)
  );
  console.log(`      ✓ Saved ADS snapshot (${adsResult.records.length} records) -> ${adsPath}`);

  console.log('\n====================================================================');
  console.log('  SUCCESS: Live source snapshots refreshed successfully!');
  console.log('====================================================================\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshLiveSnapshots().catch((err) => {
    console.error('Refresh failed:', err);
    process.exit(1);
  });
}
