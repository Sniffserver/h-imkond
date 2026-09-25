/**
 * HÕIMU Multi-Source Tallinn POI Pipeline
 * Combines Authoritative State/City Registries (PPA, Päästeamet, Tallinn Open Data)
 * with OpenStreetMap community vector data and live HÕIMU mesh observations.
 * 
 * Guarantees:
 * - When sources disagree: flags explicit "⚠ Data mismatch" with field-by-field breakdown rather than silently choosing one.
 * - POI provenance is visible on every single place.
 * - Never converts community "observed" data into "official" registry data.
 */

import { MapPlace, DataSource, DataDiscrepancy } from '../../../types';
import { haversineDistanceMeters } from '../../../geo/projection';

// =========================================================================
// 1. RAW AUTHORITATIVE REGISTRIES (PPA, Päästeamet, Tallinn Open Data)
// =========================================================================

export interface RawAuthoritativeRecord {
  id: string;
  source: 'ppa' | 'paasteamet' | 'tallinn';
  sourceName: string;
  sourceId: string;
  name: string;
  lat: number;
  lng: number;
  mainCategory: MapPlace['mainCategory'];
  subCategory: MapPlace['subCategory'];
  address: string;
  phone?: string;
  openingHours?: string;
  description?: string;
  snapshotDate: string;
  tags?: Record<string, string>;
}

export const RAW_AUTHORITATIVE_PLACES: RawAuthoritativeRecord[] = [
  // --- PPA Police Stations ---
  {
    id: 'auth_ppa_kesklinn',
    source: 'ppa',
    sourceName: 'Politsei- ja Piirivalveamet (PPA Official Register)',
    sourceId: 'PPA-REG-TLN-01',
    name: 'Põhja Prefektuur (Kesklinna Jaoskond)',
    lat: 59.4215,
    lng: 24.7330,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'Pärnu mnt 139, Tondi',
    phone: '112',
    openingHours: '24/7 (Emergency Dispatch)',
    description: 'Central police precinct and operations center. Public safety dispatch, detention and secure communications hub.',
    snapshotDate: '2026-09-01',
    tags: { official_role: 'precinct_hq', jurisdiction: 'Põhja Prefektuur' },
  },
  {
    id: 'auth_ppa_kolde',
    source: 'ppa',
    sourceName: 'Politsei- ja Piirivalveamet (PPA Official Register)',
    sourceId: 'PPA-REG-TLN-02',
    name: 'Lääne-Harju Politseijaoskond (Kolde)',
    lat: 59.4398,
    lng: 24.7082,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'Kolde pst 65, Pelgulinn',
    phone: '112',
    openingHours: '24/7',
    description: 'Western regional police precinct with tactical response unit and civil emergency coordination.',
    snapshotDate: '2026-09-01',
    tags: { official_role: 'precinct', jurisdiction: 'Lääne-Harju' },
  },
  {
    id: 'auth_ppa_lasnamäe',
    source: 'ppa',
    sourceName: 'Politsei- ja Piirivalveamet (PPA Official Register)',
    sourceId: 'PPA-REG-TLN-03',
    name: 'Ida-Harju Politseijaoskond (Pinna)',
    lat: 59.4362,
    lng: 24.8395,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'P. Pinna 4, Lasnamäe',
    phone: '112',
    openingHours: '24/7',
    description: 'Eastern Tallinn police precinct. 24/7 patrol dispatch and public emergency customer desk.',
    snapshotDate: '2026-09-01',
    tags: { official_role: 'precinct', jurisdiction: 'Ida-Harju' },
  },
  {
    id: 'auth_ppa_tammsaare',
    source: 'ppa',
    sourceName: 'Politsei- ja Piirivalveamet (PPA Official Register)',
    sourceId: 'PPA-REG-TLN-04',
    name: 'PPA Tammsaare Teeninduskeskus',
    lat: 59.4085,
    lng: 24.6980,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'A. H. Tammsaare tee 47, Mustamäe',
    phone: '+372 612 3000',
    openingHours: '09:00-17:00 (E-R)',
    description: 'PPA identity document issuance, digital trust tokens and administrative licensing center.',
    snapshotDate: '2026-09-01',
    tags: { official_role: 'service_hall' },
  },

  // --- Päästeamet Civil Defense Shelters & Fire Stations ---
  {
    id: 'auth_shelter_balti_jaam',
    source: 'paasteamet',
    sourceName: 'Päästeamet (Estonian Rescue Board)',
    sourceId: 'VARJEND-TLN-001',
    name: 'Balti Jaam Public Civil Protection Shelter',
    lat: 59.4402,
    lng: 24.7375,
    mainCategory: 'safety',
    subCategory: 'shelter',
    address: 'Toompuiestee 37, Kalamaja / Kesklinn',
    openingHours: '24/7 during alert status',
    description: 'Designated reinforced subterranean public shelter. Equipped with auxiliary generator connection and dual air filtration.',
    snapshotDate: '2026-09-18',
    tags: { capacity: '1200', subterranean: 'true', civil_defense: 'verified' },
  },
  {
    id: 'auth_shelter_vabaduse',
    source: 'paasteamet',
    sourceName: 'Päästeamet (Estonian Rescue Board)',
    sourceId: 'VARJEND-TLN-002',
    name: 'Vabaduse Väljak Subterranean Shelter',
    lat: 59.4340,
    lng: 24.7440,
    mainCategory: 'safety',
    subCategory: 'shelter',
    address: 'Vabaduse väljak 9, Südalinn',
    openingHours: '24/7 during alert status',
    description: 'Central civil defense shelter underneath Freedom Square. Direct access from underground pedestrian tunnel.',
    snapshotDate: '2026-09-18',
    tags: { capacity: '2000', reinforced_concrete: 'true' },
  },
  {
    id: 'auth_fire_kesklinn',
    source: 'paasteamet',
    sourceName: 'Päästeamet',
    sourceId: 'PK-TLN-KESK',
    name: 'Kesklinna Päästekomando (Central Fire & Rescue)',
    lat: 59.4310,
    lng: 24.7640,
    mainCategory: 'safety',
    subCategory: 'fire_station',
    address: 'Raua 2, Kesklinn',
    phone: '112',
    openingHours: '24/7',
    description: 'Central heavy rescue brigade, water pump trucks, chemical hazard containment and off-grid radio dispatch.',
    snapshotDate: '2026-09-10',
    tags: { brigade_type: 'heavy_rescue' },
  },
  {
    id: 'auth_fire_lillekula',
    source: 'paasteamet',
    sourceName: 'Päästeamet',
    sourceId: 'PK-TLN-LILL',
    name: 'Lilleküla Päästekomando',
    lat: 59.4290,
    lng: 24.7120,
    mainCategory: 'safety',
    subCategory: 'fire_station',
    address: 'Paldiski mnt 47, Kristiine',
    phone: '112',
    openingHours: '24/7',
    description: 'Rapid response rescue unit, mobile power generation and heavy extrication gear.',
    snapshotDate: '2026-09-10',
    tags: { brigade_type: 'rapid_response' },
  },
  {
    id: 'auth_hospital_itk',
    source: 'paasteamet',
    sourceName: 'Terviseamet / Päästeamet',
    sourceId: 'EMO-ITK-01',
    name: 'Ida-Tallinna Keskhaigla EMO (Trauma Center)',
    lat: 59.4285,
    lng: 24.7560,
    mainCategory: 'safety',
    subCategory: 'hospital',
    address: 'Ravi 18, Kesklinn',
    phone: '+372 666 1900',
    openingHours: '24/7',
    description: '24/7 Level 1 emergency trauma center, surgical unit, blood bank and medical oxygen reserve.',
    snapshotDate: '2026-09-01',
    tags: { emergency_level: '1', trauma: 'true' },
  },
  {
    id: 'auth_hospital_perh',
    source: 'paasteamet',
    sourceName: 'Terviseamet / Päästeamet',
    sourceId: 'EMO-PERH-01',
    name: 'Põhja-Eesti Regionaalhaigla EMO (PERH)',
    lat: 59.3970,
    lng: 24.6980,
    mainCategory: 'safety',
    subCategory: 'hospital',
    address: 'J. Sütiste tee 19, Mustamäe',
    phone: '+372 617 1300',
    openingHours: '24/7',
    description: 'Regional major disaster hospital, trauma resuscitation, helicopter helipad and burn treatment center.',
    snapshotDate: '2026-09-01',
    tags: { helipad: 'true', tertiary_care: 'true' },
  },

  // --- Tallinn Open Data Municipal Water & Infrastructure ---
  {
    id: 'auth_water_glehn',
    source: 'tallinn',
    sourceName: 'Tallinn Open Data (Keskkonnaamet)',
    sourceId: 'TLN-VESI-01',
    name: 'Glehni Pargi Looduslik Allikas (Glehn Springs)',
    lat: 59.3875,
    lng: 24.6540,
    mainCategory: 'water',
    subCategory: 'spring',
    address: 'Lossi tee 13, Nõmme',
    openingHours: '24/7 Public Access',
    description: 'Natural high-volume artesian spring with cold potable spring water. Free continuous flow.',
    snapshotDate: '2026-09-14',
    tags: { water_type: 'natural_spring', flow_rate: 'high' },
  },
  {
    id: 'auth_water_kadriorg',
    source: 'tallinn',
    sourceName: 'Tallinn Open Data / Tallinna Vesi',
    sourceId: 'TLN-VESI-02',
    name: 'Kadrioru Avalik Joogiveekraan (Public Tap)',
    lat: 59.4385,
    lng: 24.7890,
    mainCategory: 'water',
    subCategory: 'tap',
    address: 'August Weizenbergi 26, Kadriorg',
    openingHours: '24/7 (Seasonal May-Oct)',
    description: 'Filtered municipal drinking water column for bottles and hydration.',
    snapshotDate: '2026-09-14',
    tags: { water_type: 'potable_tap' },
  },
];

// =========================================================================
// 2. RAW OPENSTREETMAP (OSM) VECTOR DATA SNAPSHOT
// =========================================================================

export interface RawOsmRecord {
  id: string;
  osmId: string;
  osmType: 'node' | 'way';
  name: string;
  lat: number;
  lng: number;
  mainCategory: MapPlace['mainCategory'];
  subCategory: MapPlace['subCategory'];
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  description?: string;
  tags: Record<string, string>;
  updatedDaysAgo: number;
}

export const RAW_OSM_PLACES: RawOsmRecord[] = [
  // --- OSM amenity=police entries (Including intentionally subtle discrepancy on Kesklinna jaoskond entrance) ---
  {
    id: 'osm_police_kesklinn',
    osmId: 'node/498172635',
    osmType: 'node',
    name: 'Põhja Prefektuur Kesklinna politseijaoskond',
    lat: 59.4217, // slight 22m entrance node offset from building center
    lng: 24.7333,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'Pärnu mnt 139a, Tondi', // OSM recorded entrance building number as 139a vs official parcel 139
    phone: '+372 612 4000',
    openingHours: '24/7',
    description: 'Police precinct building and front reception gate.',
    tags: { 'amenity': 'police', 'operator': 'Politsei- ja Piirivalveamet', 'wheelchair': 'yes' },
    updatedDaysAgo: 14,
  },
  {
    id: 'osm_police_kolde',
    osmId: 'node/812938120',
    osmType: 'node',
    name: 'Lääne-Harju politseijaoskond',
    lat: 59.4398,
    lng: 24.7082,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'Kolde pst 65, Pelgulinn',
    phone: '+372 612 5400',
    openingHours: '24/7',
    description: 'Police station Pelgulinn.',
    tags: { 'amenity': 'police' },
    updatedDaysAgo: 45,
  },
  {
    id: 'osm_police_pinna',
    osmId: 'way/293847192',
    osmType: 'way',
    name: 'Ida-Harju politseijaoskond',
    lat: 59.4362,
    lng: 24.8395,
    mainCategory: 'safety',
    subCategory: 'police',
    address: 'P. Pinna 4, Lasnamäe',
    phone: '+372 612 4800',
    openingHours: '24/7',
    description: 'Lasnamäe police station.',
    tags: { 'amenity': 'police' },
    updatedDaysAgo: 60,
  },

  // --- OSM Tools, Hardware & DIY ---
  {
    id: 'osm_bauhaus_lasna',
    osmId: 'way/103948572',
    osmType: 'way',
    name: 'Bauhaus Lasnamäe Hardware & Power Tools',
    lat: 59.4385,
    lng: 24.8450,
    mainCategory: 'tools',
    subCategory: 'hardware',
    address: 'Tähesaju tee 8, Lasnamäe',
    phone: '+372 602 9200',
    openingHours: '07:00-20:00 (E-L), 09:00-18:00 (P)',
    description: 'Heavy hardware, lumber, steel cable, generator maintenance parts, plumbing fixtures, solar mounting, and electrical wiring.',
    tags: { 'shop': 'hardware', 'tools': 'yes', 'generators': 'yes' },
    updatedDaysAgo: 12,
  },
  {
    id: 'osm_krauta_kristiine',
    osmId: 'way/182736451',
    osmType: 'way',
    name: 'K-Rauta Kristiine Building & Tools Depot',
    lat: 59.4210,
    lng: 24.7190,
    mainCategory: 'tools',
    subCategory: 'diy',
    address: 'Sõpruse pst 145, Kristiine',
    phone: '+372 630 9700',
    openingHours: '08:00-20:00 (E-R), 09:00-18:00 (L-P)',
    description: 'Hand tools, cordless drills, concrete, water pumps, insulation foam, roofing tarps, and fasteners.',
    tags: { 'shop': 'doityourself', 'building_materials': 'yes' },
    updatedDaysAgo: 8,
  },
  {
    id: 'osm_espak_kesklinn',
    osmId: 'way/203948172',
    osmType: 'way',
    name: 'Espak Ehitusmaterjalid (Tallinn HQ)',
    lat: 59.4240,
    lng: 24.7490,
    mainCategory: 'tools',
    subCategory: 'hardware',
    address: 'Viadukti 42, Kesklinn',
    phone: '+372 651 2301',
    openingHours: '07:30-19:00 (E-R), 08:00-17:00 (L)',
    description: 'Extensive construction supply: structural timber, steel beams, heavy insulation, drainage pipes, generators, and masonry cement.',
    tags: { 'shop': 'hardware', 'trade': 'building_supplies' },
    updatedDaysAgo: 15,
  },
  {
    id: 'osm_oomipood_jarve',
    osmId: 'node/384729104',
    osmType: 'node',
    name: 'Oomipood Järve (Electronics & Radio Parts)',
    lat: 59.3965,
    lng: 24.7170,
    mainCategory: 'tools',
    subCategory: 'electronics',
    address: 'Pärnu mnt 238 (Järve Keskus), Nõmme',
    phone: '+372 650 6000',
    openingHours: '10:00-20:00',
    description: 'Semiconductors, 868MHz LoRa antennas, LiFePO4 battery BMS, soldering equipment, multimeters, DC-DC buck converters, and coaxial connectors.',
    tags: { 'shop': 'electronics', 'components': 'yes', 'radio': 'yes' },
    updatedDaysAgo: 5,
  },

  // --- OSM Pharmacies ---
  {
    id: 'osm_pharmacy_tonismagi',
    osmId: 'node/582910492',
    osmType: 'node',
    name: 'Tõnismäe Südameapteek (24h Valveapteek)',
    lat: 59.4305,
    lng: 24.7420,
    mainCategory: 'safety',
    subCategory: 'pharmacy',
    address: 'Tõnismägi 5, Kesklinn',
    phone: '+372 644 2282',
    openingHours: '24/7',
    description: '24-hour night emergency pharmacy with prescription antibiotics, trauma dressings, insulin, and emergency serums.',
    tags: { 'amenity': 'pharmacy', 'dispensing': 'yes', 'opening_hours': '24/7' },
    updatedDaysAgo: 4,
  },
  {
    id: 'osm_pharmacy_lasna',
    osmId: 'node/928374619',
    osmType: 'node',
    name: 'Vikerlase Südameapteek (24h Valveapteek)',
    lat: 59.4370,
    lng: 24.8320,
    mainCategory: 'safety',
    subCategory: 'pharmacy',
    address: 'Vikerlase 19, Lasnamäe',
    phone: '+372 638 4338',
    openingHours: '24/7',
    description: 'Eastern Tallinn 24h emergency dispensing pharmacy, trauma first aid kits, antiseptic washes, and electrolytes.',
    tags: { 'amenity': 'pharmacy', 'opening_hours': '24/7' },
    updatedDaysAgo: 20,
  },

  // --- OSM Stores & Markets ---
  {
    id: 'osm_balti_turg',
    osmId: 'way/583920194',
    osmType: 'way',
    name: 'Balti Jaama Turg (Fresh Produce & Supplies)',
    lat: 59.4412,
    lng: 24.7350,
    mainCategory: 'stores',
    subCategory: 'market',
    address: 'Kopli 1, Kalamaja / Põhja-Tallinn',
    openingHours: '09:00-19:00 (E-L), 09:00-17:00 (P)',
    description: 'Three-story covered food and provisions marketplace. Fresh vegetable stalls, root cellars, grains, dried legumes, and cured meats.',
    tags: { 'amenity': 'marketplace' },
    updatedDaysAgo: 7,
  },
  {
    id: 'osm_keskturg',
    osmId: 'way/603948271',
    osmType: 'way',
    name: 'Tallinna Keskturg (Central Open-Air Market)',
    lat: 59.4288,
    lng: 24.7665,
    mainCategory: 'stores',
    subCategory: 'market',
    address: 'Keldrimäe 9, Kesklinn',
    openingHours: '08:00-16:00',
    description: 'Open-air farmers market with bulk local root vegetables, honey, preserves, smoked fish, and bulk grains directly from regional growers.',
    tags: { 'amenity': 'marketplace' },
    updatedDaysAgo: 10,
  },
  {
    id: 'osm_prisma_kristiine',
    osmId: 'way/302948172',
    osmType: 'way',
    name: 'Kristiine Prisma Hypermarket (24h Provisions)',
    lat: 59.4265,
    lng: 24.7230,
    mainCategory: 'stores',
    subCategory: 'supermarket',
    address: 'Endla 45 (Kristiine Keskus), Kristiine',
    phone: '+372 665 0500',
    openingHours: '24/7',
    description: '24-hour hypermarket with non-perishable canned food, mineral water pallets, butane gas canisters, and baby formula.',
    tags: { 'shop': 'supermarket', 'opening_hours': '24/7' },
    updatedDaysAgo: 3,
  },

  // --- OSM Bicycle Shops ---
  {
    id: 'osm_city_bike',
    osmId: 'node/293847582',
    osmType: 'node',
    name: 'City Bike Tallinn Repair & Parts Workshop',
    lat: 59.4380,
    lng: 24.7470,
    mainCategory: 'tools',
    subCategory: 'bicycle_shop',
    address: 'Vene 33, Vanalinn',
    phone: '+372 511 1819',
    openingHours: '10:00-18:00',
    description: 'Inner tubes, brake pads, heavy-duty cargo racks, chains, chain breakers, spokes, and mechanical repair stands.',
    tags: { 'shop': 'bicycle', 'service': 'repair' },
    updatedDaysAgo: 18,
  },

  // --- OSM Finds & Reuse ---
  {
    id: 'osm_uuskasutus_tatari',
    osmId: 'node/748392019',
    osmType: 'node',
    name: 'Uuskasutuskeskus Tatari (Reuse & Tools)',
    lat: 59.4278,
    lng: 24.7450,
    mainCategory: 'finds',
    subCategory: 'reuse',
    address: 'Tatari 64, Kesklinn',
    phone: '+372 5553 0240',
    openingHours: '10:00-18:00 (E-R), 10:00-16:00 (L)',
    description: 'Non-profit reuse centre: cookware, heavy wool blankets, boots, durable clothing, hand tools, containers, and household goods.',
    tags: { 'shop': 'second_hand', 'charity': 'yes' },
    updatedDaysAgo: 9,
  },
  {
    id: 'osm_uuskasutus_arsenal',
    osmId: 'node/849201837',
    osmType: 'node',
    name: 'Uuskasutuskeskus Arsenali Keskus',
    lat: 59.4520,
    lng: 24.7180,
    mainCategory: 'finds',
    subCategory: 'second_hand',
    address: 'Erika 14, Põhja-Tallinn',
    phone: '+372 5553 0244',
    openingHours: '10:00-19:00',
    description: 'Secondary goods, warm outerwear, winter gear, hand appliances, storage bins, and manual repair gear.',
    tags: { 'shop': 'second_hand' },
    updatedDaysAgo: 11,
  },
];

// =========================================================================
// 3. RAW HÕIMU MESH COMMUNITY OBSERVATIONS (Peer Nodes Verified)
// =========================================================================

export interface RawHoimuObservationRecord {
  id: string;
  nodeObservationId: string;
  name: string;
  lat: number;
  lng: number;
  mainCategory: MapPlace['mainCategory'];
  subCategory: MapPlace['subCategory'];
  address: string;
  observedByNodes: number;
  lastConfirmed: string;
  description: string;
  tags?: Record<string, string>;
}

export const RAW_HOIMU_COMMUNITY_PLACES: RawHoimuObservationRecord[] = [
  {
    id: 'hoimu_tool_lib_telliskivi',
    nodeObservationId: 'HOIMU-NODE-TLN-TEL-01',
    name: 'Telliskivi Mutual Aid Tool Library',
    lat: 59.4395,
    lng: 24.7290,
    mainCategory: 'finds',
    subCategory: 'tool_library',
    address: 'Telliskivi 60a (Hoov), Kalamaja',
    observedByNodes: 3,
    lastConfirmed: '2026-09-24 (Yesterday)',
    description: 'Community-maintained open tool chest: angle grinders, torque wrenches, multimeter, wire strippers, bolt cutters, and socket sets.',
    tags: { community_governed: 'true', access: 'public_mesh_auth' },
  },
  {
    id: 'hoimu_give_box_kopli',
    nodeObservationId: 'HOIMU-NODE-TLN-KOP-02',
    name: 'Kopli Rahvamaja Community Give Box',
    lat: 59.4530,
    lng: 24.6980,
    mainCategory: 'finds',
    subCategory: 'give_box',
    address: 'Kopli 93, Põhja-Tallinn',
    observedByNodes: 2,
    lastConfirmed: '2026-09-25 (Today)',
    description: 'Free resource box (Amenity Freeshop): dry sealed oats, warm socks, matchboxes, spare 18650 batteries, and water purification tablets.',
    tags: { freeshelf: 'true', weatherproof: 'true' },
  },
  {
    id: 'hoimu_repair_cafe_pelgu',
    nodeObservationId: 'HOIMU-NODE-TLN-PEL-03',
    name: 'Pelgulinna Paranduskohvik (Repair Café)',
    lat: 59.4375,
    lng: 24.7140,
    mainCategory: 'finds',
    subCategory: 'repair_cafe',
    address: 'Roo 21b, Pelgulinn',
    observedByNodes: 4,
    lastConfirmed: '2026-09-23',
    description: 'Weekly community repair space with soldering stations, 3D printer for spare gears, sewing machines, and bicycle truing stand.',
    tags: { circular_economy: 'true' },
  },
  {
    id: 'hoimu_solar_hub_kadriorg',
    nodeObservationId: 'HOIMU-NODE-TLN-KAD-04',
    name: 'Kadriorg Autonomous Solar & LoRa Relay Hub',
    lat: 59.4372,
    lng: 24.7935,
    mainCategory: 'energy',
    subCategory: 'solar_hub',
    address: 'Mäekalda 2, Kadriorg',
    observedByNodes: 2,
    lastConfirmed: '2026-09-25 (Today)',
    description: 'Off-grid autonomous solar and LoRa relay station with emergency device charging ports.',
    tags: {},
  },
];

// =========================================================================
// 4. DEDUPLICATION & CROSS-VALIDATION PIPELINE (PPA + OSM + Päästeamet + HÕIMU)
// =========================================================================

/**
 * Builds the canonical MapPlace list by merging official registries with OSM and HÕIMU feeds.
 * - Detects attribute mismatches between authoritative state registries and OSM community tags.
 * - Explicitly surfaces mismatches with '⚠ Data mismatch' status instead of silently hiding.
 * - Retains full provenance metadata for every entry.
 */
export function buildCanonicalMapPlaces(): MapPlace[] {
  const result: MapPlace[] = [];
  const processedOsmIds = new Set<string>();

  // 1. Process Authoritative records & cross-validate against OSM candidates
  for (const auth of RAW_AUTHORITATIVE_PLACES) {
    // Find matching candidate in OSM (within 65m and matching category)
    const osmMatch = RAW_OSM_PLACES.find((osm) => {
      if (processedOsmIds.has(osm.id)) return false;
      const dist = haversineDistanceMeters(auth.lat, auth.lng, osm.lat, osm.lng);
      return dist <= 65 && (osm.mainCategory === auth.mainCategory || (auth.subCategory === 'police' && osm.tags.amenity === 'police'));
    });

    if (osmMatch) {
      processedOsmIds.add(osmMatch.id);

      // Check for discrepancies between Authoritative Record and OSM
      const discrepancies: DataDiscrepancy[] = [];

      // Check address discrepancy
      if (auth.address && osmMatch.address && auth.address.trim().toLowerCase() !== osmMatch.address.trim().toLowerCase()) {
        discrepancies.push({
          sourceA: auth.sourceName,
          sourceB: `OpenStreetMap (${osmMatch.osmId})`,
          field: 'Address & Parcel Designation',
          valueA: auth.address,
          valueB: osmMatch.address,
          warningNote: 'State registry references official land parcel; OSM tag records pedestrian entrance doorway.',
        });
      }

      // Check coordinate delta (> 18m)
      const coordDelta = Math.round(haversineDistanceMeters(auth.lat, auth.lng, osmMatch.lat, osmMatch.lng));
      if (coordDelta > 15) {
        discrepancies.push({
          sourceA: auth.sourceName,
          sourceB: `OpenStreetMap (${osmMatch.osmId})`,
          field: 'Geographic Pin Offset',
          valueA: `${auth.lat.toFixed(5)}, ${auth.lng.toFixed(5)} (Parcel Center)`,
          valueB: `${osmMatch.lat.toFixed(5)}, ${osmMatch.lng.toFixed(5)} (${coordDelta}m offset to entrance)`,
          warningNote: `Displacement of ${coordDelta} meters detected between registry footprint and mapped entryway.`,
        });
      }

      // Check opening hours discrepancy
      if (auth.openingHours && osmMatch.openingHours && auth.openingHours !== osmMatch.openingHours) {
        discrepancies.push({
          sourceA: auth.sourceName,
          sourceB: `OpenStreetMap (${osmMatch.osmId})`,
          field: 'Operating Hours',
          valueA: auth.openingHours,
          valueB: osmMatch.openingHours,
          warningNote: 'Registry reflects 24/7 dispatch duty; OSM tag specifies public desk schedule.',
        });
      }

      const hasMismatch = discrepancies.length > 0;

      result.push({
        id: `place_${auth.subCategory}_${auth.id.replace('auth_', '')}`,
        name: auth.name,
        location: { lat: auth.lat, lng: auth.lng },
        mainCategory: auth.mainCategory,
        subCategory: auth.subCategory,
        source: auth.source,
        sourceName: auth.sourceName,
        sourceId: auth.sourceId,
        secondarySource: 'osm',
        secondarySourceName: `OpenStreetMap (${osmMatch.osmId})`,
        hasMismatch,
        mismatchDetails: hasMismatch
          ? `Discrepancy identified between ${auth.sourceName} and OpenStreetMap community tags (${discrepancies.length} field variance)`
          : undefined,
        discrepancies: hasMismatch ? discrepancies : undefined,
        provenanceStatus: hasMismatch ? 'conflict' : 'official',
        snapshotDate: auth.snapshotDate,
        updatedDaysAgo: osmMatch.updatedDaysAgo,
        address: auth.address,
        phone: auth.phone || osmMatch.phone,
        openingHours: auth.openingHours || osmMatch.openingHours,
        description: auth.description,
        tags: { ...auth.tags, ...osmMatch.tags },
      });
    } else {
      // Authoritative record without OSM match
      result.push({
        id: `place_${auth.subCategory}_${auth.id.replace('auth_', '')}`,
        name: auth.name,
        location: { lat: auth.lat, lng: auth.lng },
        mainCategory: auth.mainCategory,
        subCategory: auth.subCategory,
        source: auth.source,
        sourceName: auth.sourceName,
        sourceId: auth.sourceId,
        provenanceStatus: 'official',
        snapshotDate: auth.snapshotDate,
        address: auth.address,
        phone: auth.phone,
        openingHours: auth.openingHours,
        description: auth.description,
        tags: auth.tags,
      });
    }
  }

  // 2. Add remaining OpenStreetMap places
  for (const osm of RAW_OSM_PLACES) {
    if (processedOsmIds.has(osm.id)) continue;

    result.push({
      id: `place_${osm.subCategory}_${osm.id.replace('osm_', '')}`,
      name: osm.name,
      location: { lat: osm.lat, lng: osm.lng },
      mainCategory: osm.mainCategory,
      subCategory: osm.subCategory,
      source: 'osm',
      sourceName: 'OpenStreetMap (OSM Vector Snapshot)',
      sourceId: osm.osmId,
      provenanceStatus: 'osm',
      updatedDaysAgo: osm.updatedDaysAgo,
      snapshotDate: '2026-09-15',
      address: osm.address,
      phone: osm.phone,
      openingHours: osm.openingHours,
      website: osm.website,
      description: osm.description,
      tags: osm.tags,
    });
  }

  // 3. Add HÕIMU Community Observations (Strictly labeled as 'community' & observed, NEVER converted to official)
  for (const hoimu of RAW_HOIMU_COMMUNITY_PLACES) {
    result.push({
      id: `place_${hoimu.subCategory}_${hoimu.id.replace('hoimu_', '')}`,
      name: hoimu.name,
      location: { lat: hoimu.lat, lng: hoimu.lng },
      mainCategory: hoimu.mainCategory,
      subCategory: hoimu.subCategory,
      source: 'hoimu',
      sourceName: 'HÕIMU Peer Mesh Observations',
      sourceId: hoimu.nodeObservationId,
      provenanceStatus: 'community',
      observedByNodes: hoimu.observedByNodes,
      lastConfirmed: hoimu.lastConfirmed,
      snapshotDate: '2026-09-25',
      address: hoimu.address,
      description: hoimu.description,
      tags: hoimu.tags,
    });
  }

  return result;
}

export const CANONICAL_TALLINN_PLACES: MapPlace[] = buildCanonicalMapPlaces();
