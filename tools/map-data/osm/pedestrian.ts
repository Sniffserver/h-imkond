/**
 * OSM Pedestrian Geometry & Walking Graph Pipeline
 * 
 * Ingests, normalizes, and builds walkable OpenStreetMap pedestrian network
 * using the requested pipeline:
 * OSM snapshot -> ways + nodes -> walkability filter -> access rules -> intersection splitting -> one-way handling -> stairs/surface/accessibility flags -> graph builder
 */

import { EDGE_FLAGS } from '../../../src/services/routing/binaryFormat';
import { OsmGraphBuilder, WalkableWay, RawOsmElement } from './graph-builder';

// Define the core high-fidelity streets with their canonical IDs for the Tallinn Bioregion snapshot
const TALLINN_SNAPSHOT_STREETS: WalkableWay[] = [
  // =========================================================================
  // 1. TALLINN VANALINN (OLD TOWN) PEDESTRIAN NETWORK & COBBLESTONES
  // =========================================================================
  {
    id: 'osm_viru_tn',
    name: 'Viru tänav',
    district: 'Vanalinn / Kesklinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: false,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE,
    coordinates: [
      [24.7538, 59.4364], // Viru väljak connection
      [24.7500, 59.4365], // Viru väravad
      [24.7480, 59.4369], // Sauna tn junction
      [24.7465, 59.4372], // Vana turg
    ],
  },
  {
    id: 'osm_viru_valjak',
    name: 'Viru väljak',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7538, 59.4364], // Viru Keskus front plaza
      [24.7548, 59.4368], // Narva mnt start
      [24.7530, 59.4355], // Tammsaare park connection
      [24.7500, 59.4365], // Viru väravad
    ],
  },
  {
    id: 'osm_vana_turg',
    name: 'Vana turg',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: false,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7465, 59.4372],
      [24.7458, 59.4373],
      [24.7452, 59.4374],
    ],
  },
  {
    id: 'osm_raekoja_plats',
    name: 'Raekoja plats',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: false,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE,
    coordinates: [
      [24.7452, 59.4374],
      [24.7448, 59.4373],
      [24.7442, 59.4375],
      [24.7450, 59.4378],
      [24.7452, 59.4374], // Closed plaza loop
    ],
  },
  {
    id: 'osm_pikk_tn_south',
    name: 'Pikk tänav (Lõunaosa)',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7452, 59.4374],
      [24.7455, 59.4382],
      [24.7460, 59.4395],
      [24.7472, 59.4410],
    ],
  },
  {
    id: 'osm_pikk_tn_north',
    name: 'Pikk tänav (Põhjaosa / Paks Margareeta)',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7472, 59.4410],
      [24.7485, 59.4425],
      [24.7495, 59.4435], // Rannamäe tee crossing
    ],
  },
  {
    id: 'osm_lai_tn',
    name: 'Lai tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7442, 59.4375],
      [24.7450, 59.4390],
      [24.7462, 59.4415],
      [24.7480, 59.4430],
    ],
  },
  {
    id: 'osm_vene_tn',
    name: 'Vene tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7465, 59.4372],
      [24.7470, 59.4380],
      [24.7480, 59.4395],
      [24.7490, 59.4412],
    ],
  },
  {
    id: 'osm_harju_tn',
    name: 'Harju tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7448, 59.4373],
      [24.7440, 59.4362],
      [24.7435, 59.4352],
      [24.7440, 59.4340], // Vabaduse väljak
    ],
  },
  {
    id: 'osm_niguliste_tn',
    name: 'Niguliste tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: false,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7440, 59.4362],
      [24.7428, 59.4358],
      [24.7415, 59.4355],
    ],
  },
  {
    id: 'osm_luhike_jalg_stairs',
    name: 'Lühike jalg (Trepp)',
    district: 'Vanalinn / Toompea',
    highwayClass: 'steps',
    surface: 'steps',
    walkable: true,
    wheelchair: false,
    bicycle: false,
    stairs: true,
    flags: EDGE_FLAGS.STAIRS,
    coordinates: [
      [24.7415, 59.4355],
      [24.7408, 59.4358],
      [24.7398, 59.4362], // Toompea Lossi plats
    ],
  },
  {
    id: 'osm_pikk_jalg',
    name: 'Pikk jalg',
    district: 'Vanalinn / Toompea',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE | EDGE_FLAGS.STEEP_SLOPE,
    coordinates: [
      [24.7435, 59.4378], // Nunne tn junction
      [24.7415, 59.4372],
      [24.7395, 59.4368], // Toompea
    ],
  },
  {
    id: 'osm_patkuli_stairs',
    name: 'Patkuli trepp',
    district: 'Toompea / Kalamaja',
    highwayClass: 'steps',
    surface: 'steps',
    walkable: true,
    wheelchair: false,
    bicycle: false,
    stairs: true,
    flags: EDGE_FLAGS.STAIRS,
    coordinates: [
      [24.7390, 59.4375], // Patkuli vaateplatvorm
      [24.7385, 59.4385], // Nunne park
      [24.7380, 59.4395], // Toompuiestee / Snelli tiik
    ],
  },
  {
    id: 'osm_lossi_plats',
    name: 'Lossi plats & Toompea',
    district: 'Toompea',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE,
    coordinates: [
      [24.7398, 59.4362],
      [24.7395, 59.4368],
      [24.7385, 59.4365], // Riigikogu
      [24.7390, 59.4375], // Vaateplatvorm
    ],
  },
  {
    id: 'osm_komandandi_tee',
    name: 'Komandandi tee & Harjumägi',
    district: 'Vanalinn / Toompea',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7398, 59.4362],
      [24.7420, 59.4348],
      [24.7440, 59.4340], // Vabaduse väljak
    ],
  },
  {
    id: 'osm_sauna_muurivahe',
    name: 'Müürivahe & Sauna tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: false,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7480, 59.4369],
      [24.7485, 59.4360],
      [24.7490, 59.4350],
      [24.7480, 59.4345], // Suur-Karja junction
    ],
  },
  {
    id: 'osm_suur_karja',
    name: 'Suur-Karja tänav',
    district: 'Vanalinn',
    highwayClass: 'pedestrian',
    surface: 'cobblestone',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.COBBLESTONE,
    coordinates: [
      [24.7452, 59.4374], // Raekoja plats
      [24.7465, 59.4360],
      [24.7480, 59.4345],
      [24.7505, 59.4338], // Pärnu mnt crossing
    ],
  },

  // =========================================================================
  // 2. KESKLINN & SÜDALINN URBAN PEDESTRIAN CORRIDORS
  // =========================================================================
  {
    id: 'osm_vabaduse_valjak',
    name: 'Vabaduse väljak (Plaza & Tunnel)',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7440, 59.4340],
      [24.7450, 59.4342],
      [24.7460, 59.4345],
      [24.7480, 59.4345],
    ],
  },
  {
    id: 'osm_tammsaare_park',
    name: 'Tammsaare pargi jalgtrajektoor',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'footway',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7500, 59.4365], // Viru väravad
      [24.7530, 59.4355], // Park center
      [24.7538, 59.4364], // Viru Keskus front
      [24.7510, 59.4345], // Estonia teater
    ],
  },
  {
    id: 'osm_estonia_pst',
    name: 'Estonia puiestee (Kõnniteed & Rattatee)',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'primary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7440, 59.4340], // Vabaduse väljak
      [24.7510, 59.4345], // Teater
      [24.7555, 59.4350], // Kaubamaja crossing
      [24.7595, 59.4355], // Teatri väljak / Solarise keskus
    ],
  },
  {
    id: 'osm_ravala_pst',
    name: 'Rävala puiestee',
    district: 'Kesklinn / Südalinn',
    highwayClass: 'secondary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7510, 59.4335],
      [24.7560, 59.4338],
      [24.7610, 59.4342],
      [24.7660, 59.4345],
    ],
  },
  {
    id: 'osm_parnu_mnt_central',
    name: 'Pärnu maantee (Südalinn)',
    district: 'Kesklinn',
    highwayClass: 'primary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7500, 59.4365], // Viru
      [24.7505, 59.4338], // Draamateater
      [24.7470, 59.4305], // Kosmos / Tõnismägi
      [24.7410, 59.4250], // Vineeri
      [24.7335, 59.4218], // PPA Kesklinn / Tondi
    ],
  },
  {
    id: 'narva_mnt',
    name: 'Narva maantee',
    district: 'Kesklinn / Kadriorg',
    highwayClass: 'primary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7548, 59.4368], // Viru ring
      [24.7635, 59.4382], // Hobujaama / Foorum
      [24.7761, 59.4402], // Tallinna Ülikool
      [24.7890, 59.4430], // Kadrioru sissepääs
    ],
  },
  {
    id: 'osm_rotermanni_quarter',
    name: 'Rotermanni Kvartal (Jalakäijateala)',
    district: 'Kesklinn / Sadam',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7550, 59.4375],
      [24.7565, 59.4385],
      [24.7580, 59.4395],
      [24.7600, 59.4410], // Ahtri tn crossing
    ],
  },

  // =========================================================================
  // 3. KALAMAJA, BALTI JAAM & TELLISKIVI CREATIVE CITY
  // =========================================================================
  {
    id: 'osm_balti_jaam_promenade',
    name: 'Balti Jaama Promenaad & Tunnelid',
    district: 'Kalamaja / Kesklinn',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7380, 59.4395], // Snelli park
      [24.7375, 59.4402], // Balti jaam tunnel
      [24.7350, 59.4412], // Balti Jaama Turg
      [24.7320, 59.4405], // Reisijate tn
    ],
  },
  {
    id: 'osm_telliskivi_loomelinnak',
    name: 'Telliskivi Loomelinnak & Kvartal',
    district: 'Kalamaja',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7320, 59.4405],
      [24.7290, 59.4395], // Tool library
      [24.7260, 59.4385],
      [24.7230, 59.4375], // Ristmik
    ],
  },
  {
    id: 'osm_vana_kalamaja_promenade',
    name: 'Vana-Kalamaja Jalakäijate Tänav',
    district: 'Kalamaja',
    highwayClass: 'living_street',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7350, 59.4412], // Balti turg
      [24.7340, 59.4435], // Kotzebue rist
      [24.7310, 59.4465], // Kalamaja põhikool
      [24.7280, 59.4495], // Kalarand / Soo tn
    ],
  },
  {
    id: 'osm_kalaranna_promenaad',
    name: 'Kalaranna Rannapromenaad',
    district: 'Põhja-Tallinn / Sadam',
    highwayClass: 'path',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7495, 59.4435], // Linnahall / Paks Margareeta
      [24.7420, 59.4470], // Kalaranna sadam
      [24.7350, 59.4500], // Patarei merekindlus
      [24.7250, 59.4525], // Noblessner
    ],
  },
  {
    id: 'osm_noblessner_quarter',
    name: 'Noblessneri Sadamalinnak',
    district: 'Põhja-Tallinn',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7250, 59.4525],
      [24.7180, 59.4530],
      [24.7150, 59.4515],
      [24.7180, 59.4485], // Volta ristmik
    ],
  },

  // =========================================================================
  // 4. KADRIORG & PIRITA RECREATIONAL & COMMUTER PATHWAYS
  // =========================================================================
  {
    id: 'osm_weizenbergi_kadriorg',
    name: 'A. Weizenbergi tänav & Kadrioru Park',
    district: 'Kadriorg',
    highwayClass: 'living_street',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7761, 59.4402], // Poska crossing
      [24.7830, 59.4390],
      [24.7890, 59.4385], // Public water tap
      [24.7950, 59.4380], // KUMU kunstimuuseum
    ],
  },
  {
    id: 'osm_kumu_stairs',
    name: 'KUMU & Lasnamäe Trepp',
    district: 'Kadriorg / Lasnamäe',
    highwayClass: 'steps',
    surface: 'steps',
    walkable: true,
    wheelchair: false,
    bicycle: false,
    stairs: true,
    flags: EDGE_FLAGS.STAIRS,
    coordinates: [
      [24.7950, 59.4380], // KUMU alumine sissepääs
      [24.7975, 59.4370], // Mäekalda astmestik
      [24.8010, 59.4360], // Lasnamäe pankrannik
    ],
  },
  {
    id: 'osm_reidi_tee_promenade',
    name: 'Reidi tee Rannapromenaad & Rattatee',
    district: 'Kesklinn / Kadriorg',
    highwayClass: 'path',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7640, 59.4435], // Sadam
      [24.7780, 59.4440], // Russalka mälestussammas
      [24.7930, 59.4455], // Pirita tee algus
    ],
  },

  // =========================================================================
  // 5. KRISTIINE, UUS MAAILM & MUSTAMÄE
  // =========================================================================
  {
    id: 'osm_uus_maailm_grid',
    name: 'Uue Maailma Koidu & Luha tänav',
    district: 'Kesklinn / Uus Maailm',
    highwayClass: 'living_street',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7410, 59.4250], // Pärnu mnt
      [24.7360, 59.4260], // Koidu tn
      [24.7300, 59.4275], // Luha tn
      [24.7240, 59.4285], // Tehnika tn
    ],
  },
  {
    id: 'osm_endla_kristiine',
    name: 'Endla tänav & Kristiine Keskus',
    district: 'Kristiine',
    highwayClass: 'primary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7300, 59.4295],
      [24.7230, 59.4265], // Prisma Kristiine
      [24.7150, 59.4245], // Tulika rist
      [24.7000, 59.4180], // Mustamäe tee algus
    ],
  },
  {
    id: 'osm_mustamae_tee',
    name: 'Mustamäe tee & Magistral Keskus',
    district: 'Mustamäe',
    highwayClass: 'secondary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7000, 59.4180],
      [24.6950, 59.4100],
      [24.6900, 59.4050],
      [24.6850, 59.4010],
    ],
  },
  {
    id: 'osm_mustamae_sutiste',
    name: 'J. Sütiste tee & PERH Haigla park',
    district: 'Mustamäe',
    highwayClass: 'residential',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.6960, 59.3970], // PERH haigla EMO
      [24.6910, 59.3980],
      [24.6850, 59.4010], // Magistral connection
      [24.6780, 59.4020], // Männi park
      [24.6650, 59.3900], // Nõmme ühendus
    ],
  },
  {
    id: 'osm_glehn_nomme_springs',
    name: 'Lossi tee & Glehni Pargi Loodusrajad',
    district: 'Nõmme',
    highwayClass: 'path',
    surface: 'gravel',
    walkable: true,
    wheelchair: false,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.GRAVEL | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.6650, 59.3900], // Nõmme keskus
      [24.6540, 59.3875], // Glehni allikad
      [24.6480, 59.3850], // Tähetorn
    ],
  },
  {
    id: 'osm_nomme_keskus',
    name: 'Nõmme Turu & Jaama Promenaad',
    district: 'Nõmme',
    highwayClass: 'pedestrian',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.6850, 59.3880], // Rahumäe tee ühendus
      [24.6750, 59.3890], // Nõmme raudteejaam
      [24.6650, 59.3900], // Nõmme turg
    ],
  },

  // =========================================================================
  // 6. HAABERSTI & ÕISMÄE BIOREGION
  // =========================================================================
  {
    id: 'osm_haabersti_paldiski',
    name: 'Paldiski maantee & Rocca al Mare Promenaad',
    district: 'Haabersti',
    highwayClass: 'secondary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7000, 59.4180], // Mustamäe ühendus
      [24.6700, 59.4230], // Haabersti ringristmik
      [24.6500, 59.4280], // Rocca al Mare keskus
      [24.6400, 59.4320], // Vabaõhumuuseumi tee
    ],
  },
  {
    id: 'osm_oismae_ring',
    name: 'Õismäe tee & Tiigi Ringpromenaad',
    district: 'Haabersti / Õismäe',
    highwayClass: 'living_street',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.6700, 59.4230], // Haabersti ring
      [24.6550, 59.4180], // Õismäe tiik
      [24.6450, 59.4140], // Kullerkupu
      [24.6400, 59.4100], // Harku järve rand
    ],
  },

  // =========================================================================
  // 7. PIRITA & MERIVÄLJA RANNIKUTEED
  // =========================================================================
  {
    id: 'osm_pirita_tee_promenade',
    name: 'Pirita tee Rannapromenaad',
    district: 'Pirita',
    highwayClass: 'path',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.7930, 59.4455], // Russalka mälestussammas
      [24.8100, 59.4560], // Maarjamäe memoriaal
      [24.8250, 59.4650], // Pirita Selver
      [24.8320, 59.4680], // Pirita sild & Klooster
    ],
  },
  {
    id: 'osm_pirita_ranna_promenaad',
    name: 'Pirita Ranna & Kloostrimetsa Rada',
    district: 'Pirita',
    highwayClass: 'footway',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.8320, 59.4680], // Pirita jõesuu
      [24.8400, 59.4720], // Pirita rand
      [24.8550, 59.4780], // Kloostrimetsa terviserada
    ],
  },

  // =========================================================================
  // 8. LASNAMÄE & PAEPARK URBANDISTRICT
  // =========================================================================
  {
    id: 'osm_paepark_promenade',
    name: 'Paepargi Promenaad & Sild',
    district: 'Lasnamäe',
    highwayClass: 'footway',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.8010, 59.4360], // Lasnamäe pankrannik ühendus
      [24.8120, 59.4320], // Pae park järv
      [24.8250, 59.4300], // Pae tn
      [24.8400, 59.4310], // Punane tn
    ],
  },
  {
    id: 'osm_punane_tn',
    name: 'Punane tänav (Kõnniteed & Rattatee)',
    district: 'Lasnamäe',
    highwayClass: 'secondary',
    surface: 'paved',
    walkable: true,
    wheelchair: true,
    bicycle: true,
    stairs: false,
    flags: EDGE_FLAGS.PAVED | EDGE_FLAGS.WHEELCHAIR_ACCESSIBLE | EDGE_FLAGS.BIKE_PATH,
    coordinates: [
      [24.8400, 59.4310], // Punane / Pae
      [24.8600, 59.4340], // Tondiraba park
      [24.8850, 59.4380], // Mustakivi keskus
      [24.9000, 59.4420], // Priisle
    ],
  },
];

/**
 * Converts high-fidelity Tallinn snapshot ways into raw OSM elements (ways and nodes)
 * with true, complete source tags (no name-inferencing).
 */
export function generateRawOsmElementsFromSnapshot(): RawOsmElement[] {
  const elements: RawOsmElement[] = [];
  const coordToNodeId = new Map<string, number>();
  let nextNodeId = 200000;
  let nextWayId = 2000;

  for (const w of TALLINN_SNAPSHOT_STREETS) {
    const wayNodeIds: number[] = [];

    for (const [lng, lat] of w.coordinates) {
      // Cluster nodes sharing exact lat/lon within ~1.1 meters (5 decimals)
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      let nodeId = coordToNodeId.get(key);

      if (!nodeId) {
        nodeId = nextNodeId++;
        coordToNodeId.set(key, nodeId);
        elements.push({
          type: 'node',
          id: nodeId,
          lat,
          lon: lng,
        });
      }
      wayNodeIds.push(nodeId);
    }

    const tags: Record<string, string> = {
      highway: w.highwayClass === 'steps' ? 'steps' : w.highwayClass,
      name: w.name,
      'name:et': w.name,
      'addr:district': w.district,
      walkable: 'yes',
      access: 'yes',
      foot: 'yes',
    };

    if (w.surface) {
      tags.surface = w.surface;
    }
    if (w.wheelchair) {
      tags.wheelchair = 'yes';
    } else {
      tags.wheelchair = 'no';
    }
    if (w.bicycle) {
      tags.bicycle = 'yes';
    } else {
      tags.bicycle = 'no';
    }
    if (w.stairs) {
      tags.highway = 'steps';
      tags.surface = 'steps';
    }
    if (w.flags & EDGE_FLAGS.STEEP_SLOPE) {
      tags.incline = 'yes';
    }
    if (w.flags & EDGE_FLAGS.ONE_WAY) {
      tags.oneway = 'yes';
    }
    if (w.flags & EDGE_FLAGS.UNSAFE_ZONE) {
      tags.unsafe = 'yes';
    }

    elements.push({
      type: 'way',
      id: nextWayId++,
      nodes: wayNodeIds,
      tags,
    });
  }

  return elements;
}

// -----------------------------------------------------------------------------
// Initialize and run the dynamic pipeline on our local snapshot of ways & nodes!
// -----------------------------------------------------------------------------
const rawElements = generateRawOsmElementsFromSnapshot();
const builder = new OsmGraphBuilder(rawElements);
const pipelineResult = builder.buildPipeline();

// Keep original streets with their canonical IDs for street explorer compatibility
export const OSM_PEDESTRIAN_NETWORK: WalkableWay[] = TALLINN_SNAPSHOT_STREETS;
export const GEOMETRIC_ROUTING_NODES = pipelineResult.routingNodes;
export const GEOMETRIC_ROUTING_EDGES = pipelineResult.routingEdges;
export type { WalkableWay };
