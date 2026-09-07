import { CityMapData } from '../types';

import { KITSEKULA_MAP } from "./kitsekulaMap";

export const CITY_MAPS: Record<string, CityMapData> = {
  tartu: {
    id: 'tartu',
    cityName: 'Tartu',
    country: 'Estonia',
    bioregionName: 'Emajõe Luht / Peipsi Basin',
    centerCoordsText: '58.3780° N, 26.7290° E',
    description: 'Historical university city centered around Emajõgi river, Supilinn wooden district, and Toomemägi hill.',
    districts: [
      { name: 'Kesklinn', x: 0, y: -10 },
      { name: 'Supilinn', x: -80, y: -60 },
      { name: 'Karlova', x: -40, y: 80 },
      { name: 'Annelinn', x: 110, y: 40 },
      { name: 'Tähtvere', x: -110, y: -100 },
      { name: 'Raadi', x: 70, y: -110 },
    ],
    zones: [
      // Emajõgi River Polygon / Ribbon
      {
        name: 'Emajõgi River',
        type: 'water',
        points: [
          [-180, 160],
          [-120, 110],
          [-50, 40],
          [0, -10],
          [60, -50],
          [130, -80],
          [190, -120],
          [190, -90],
          [130, -50],
          [60, -20],
          [0, 10],
          [-50, 65],
          [-120, 135],
          [-180, 185],
        ],
      },
      // Toomemägi Park Polygon
      {
        name: 'Toomemägi Park',
        type: 'park',
        points: [
          [-60, -20],
          [-20, -50],
          [-30, -90],
          [-80, -70],
          [-90, -30],
        ],
      },
      // Botanical Garden & Emajõe Luht Greenway
      {
        name: 'Botanical Garden & River Greenway',
        type: 'park',
        points: [
          [10, -80],
          [60, -100],
          [90, -70],
          [40, -40],
        ],
      },
      // Tähtvere Park
      {
        name: 'Tähtvere Forest Park',
        type: 'park',
        points: [
          [-140, -140],
          [-90, -150],
          [-100, -100],
          [-150, -110],
        ],
      },
    ],
    streets: [
      {
        name: 'Riia Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [-180, 120],
          [-90, 50],
          [0, -10],
          [40, -40],
        ],
      },
      {
        name: 'Narva Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [0, -10],
          [60, -60],
          [140, -120],
          [180, -150],
        ],
      },
      {
        name: 'Vabaduse Puiestee',
        width: 3,
        type: 'primary',
        points: [
          [-60, 45],
          [-10, 0],
          [40, -40],
          [80, -70],
        ],
      },
      {
        name: 'Tähe Tänav',
        width: 2.5,
        type: 'secondary',
        points: [
          [0, -10],
          [-30, 60],
          [-60, 140],
          [-80, 180],
        ],
      },
      {
        name: 'Herne Tänav (Supilinn)',
        width: 2,
        type: 'secondary',
        points: [
          [-50, -20],
          [-90, -60],
          [-130, -100],
        ],
      },
      {
        name: 'Emajõe Jaansoni Rada',
        width: 1.5,
        type: 'trail',
        points: [
          [-160, 140],
          [-40, 50],
          [10, 0],
          [70, -40],
          [150, -80],
        ],
      },
    ],
    landmarks: [
      { id: 'l1', name: 'Raekoda / Town Hall', x: -5, y: -15, type: 'historic' },
      { id: 'l2', name: 'Tartu Ülikool Delta', x: 45, y: -50, type: 'hub' },
      { id: 'l3', name: 'Toomkiriku Varemed', x: -45, y: -55, type: 'historic' },
      { id: 'l4', name: 'Botaanikaaed', x: 25, y: -65, type: 'eco' },
      { id: 'l5', name: 'Supilinn Eko-Keskus', x: -95, y: -75, type: 'eco' },
      { id: 'l6', name: 'Emajõe Sild / Kaarsild', x: 5, y: -25, type: 'water' },
    ],
  },

  tallinn: {
    id: 'tallinn',
    cityName: 'Tallinn',
    country: 'Estonia',
    bioregionName: 'Soome Laht / Pirita Basin',
    centerCoordsText: '59.4370° N, 24.7535° E',
    description: 'Coastal Baltic capital featuring UNESCO medieval Old Town, Kalamaja wooden architecture, and Kadriorg coastal park.',
    districts: [
      { name: 'Vanalinn (Old Town)', x: 0, y: 10 },
      { name: 'Kalamaja', x: -60, y: -70 },
      { name: 'Kadriorg', x: 100, y: -10 },
      { name: 'Kristiine', x: -80, y: 70 },
      { name: 'Pirita', x: 150, y: -100 },
      { name: 'Mustamäe', x: -140, y: 120 },
    ],
    zones: [
      // Baltic Coastline / Tallinn Bay Water Body
      {
        name: 'Tallinn Bay (Soome Laht)',
        type: 'water',
        points: [
          [-190, -180],
          [-100, -140],
          [-30, -100],
          [40, -110],
          [120, -140],
          [190, -180],
          [190, -200],
          [-190, -200],
        ],
      },
      // Old Town Toompea Hill Polygon
      {
        name: 'Toompea & Old Town Walls',
        type: 'urban',
        points: [
          [-20, 30],
          [20, 20],
          [30, -10],
          [-10, -20],
          [-35, 10],
        ],
      },
      // Kadriorg Park Polygon
      {
        name: 'Kadriorg Park',
        type: 'park',
        points: [
          [80, -30],
          [130, -40],
          [140, 20],
          [90, 30],
        ],
      },
      // Telliskivi Creative Area
      {
        name: 'Telliskivi Permaculture Yard',
        type: 'park',
        points: [
          [-50, -20],
          [-20, -30],
          [-30, 10],
          [-60, 10],
        ],
      },
    ],
    streets: [
      {
        name: 'Pärnu Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [0, 10],
          [-50, 70],
          [-110, 130],
          [-170, 180],
        ],
      },
      {
        name: 'Narva Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [0, 10],
          [60, -10],
          [130, -30],
          [180, -50],
        ],
      },
      {
        name: 'Paldiski Maantee',
        width: 3,
        type: 'primary',
        points: [
          [-20, 20],
          [-80, 20],
          [-150, 30],
        ],
      },
      {
        name: 'Soo / Tööstuse (Kalamaja)',
        width: 2.5,
        type: 'secondary',
        points: [
          [-20, -10],
          [-60, -60],
          [-100, -100],
        ],
      },
      {
        name: 'Pirita Reidi Tee Promenade',
        width: 2,
        type: 'trail',
        points: [
          [30, -90],
          [80, -100],
          [140, -130],
        ],
      },
    ],
    landmarks: [
      { id: 'tl1', name: 'Raekoja Plats', x: 5, y: 0, type: 'historic' },
      { id: 'tl2', name: 'Telliskivi Loomelinnak', x: -40, y: -10, type: 'hub' },
      { id: 'tl3', name: 'Lennusadam Maritime Hub', x: -70, y: -110, type: 'water' },
      { id: 'tl4', name: 'Kadriorg Loss & Park', x: 110, y: -10, type: 'eco' },
      { id: 'tl5', name: 'Toompea Loss', x: -15, y: 15, type: 'historic' },
    ],
  },

  parnu: {
    id: 'parnu',
    cityName: 'Pärnu',
    country: 'Estonia',
    bioregionName: 'Pärnu Laht & River Delta',
    centerCoordsText: '58.3859° N, 24.4971° E',
    description: 'Coastal resort and river estuary known for Baltic sandy beaches, Jaansoni health trail, and rich coastal meadows.',
    districts: [
      { name: 'Kesklinn', x: 0, y: -20 },
      { name: 'Rannarajoon', x: -40, y: 60 },
      { name: 'Ülejõe', x: 30, y: -90 },
      { name: 'Rääma', x: 110, y: -60 },
      { name: 'Vana-Pärnu', x: -120, y: -70 },
    ],
    zones: [
      // Pärnu River Estuary
      {
        name: 'Pärnu River',
        type: 'water',
        points: [
          [-180, -60],
          [-100, -45],
          [-20, -35],
          [40, -40],
          [120, -50],
          [180, -60],
          [180, -35],
          [120, -25],
          [40, -15],
          [-20, -10],
          [-100, -20],
          [-180, -35],
        ],
      },
      // Beach Park & Coastal Meadows
      {
        name: 'Beach Park & Coastal Reserve',
        type: 'park',
        points: [
          [-90, 40],
          [10, 30],
          [30, 90],
          [-70, 110],
        ],
      },
      // Vallikäär Park
      {
        name: 'Vallikäär Moat Park',
        type: 'park',
        points: [
          [-40, -20],
          [-10, -20],
          [-15, 10],
          [-45, 10],
        ],
      },
    ],
    streets: [
      {
        name: 'Tallinna Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [-20, -30],
          [20, -80],
          [60, -140],
        ],
      },
      {
        name: 'Riia Maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [0, -20],
          [60, 20],
          [130, 70],
          [180, 110],
        ],
      },
      {
        name: 'Ringi Tänav',
        width: 2.5,
        type: 'secondary',
        points: [
          [-30, -20],
          [-30, 40],
          [-30, 80],
        ],
      },
      {
        name: 'Jaansoni Terviserada',
        width: 2,
        type: 'trail',
        points: [
          [-160, -25],
          [-80, -15],
          [0, -5],
          [80, -15],
          [160, -25],
        ],
      },
    ],
    landmarks: [
      { id: 'pl1', name: 'Pärnu Raekoda', x: -5, y: -25, type: 'historic' },
      { id: 'pl2', name: 'Rannahotell & Rand', x: -40, y: 75, type: 'eco' },
      { id: 'pl3', name: 'Pärnu Muul (Pier)', x: -140, y: 30, type: 'water' },
      { id: 'pl4', name: 'Vallikäär Light Bridge', x: -25, y: -5, type: 'hub' },
    ],
  },

  cascadia: {
    id: 'cascadia',
    cityName: 'Cascadia Common',
    country: 'Pacific Northwest',
    bioregionName: 'Columbia Basin & Willamette Corridor',
    centerCoordsText: '44.0520° N, 123.0860° W',
    description: 'Cascadian temperate rainforest bioregion featuring solar relay stations, permaculture orchards, and river mesh nodes.',
    districts: [
      { name: 'River Basin', x: 0, y: 0 },
      { name: 'Highland Ridge', x: -90, y: -80 },
      { name: 'Valley Orchards', x: 80, y: 70 },
      { name: 'Forest Commons', x: -80, y: 90 },
    ],
    zones: [
      {
        name: 'Willamette River Corridor',
        type: 'water',
        points: [
          [-180, 160],
          [-110, 100],
          [-30, 30],
          [30, -30],
          [110, -100],
          [180, -160],
          [180, -135],
          [110, -75],
          [30, -5],
          [-30, 55],
          [-110, 125],
          [-180, 185],
        ],
      },
      {
        name: 'Old Growth Forest Reserve',
        type: 'park',
        points: [
          [-150, -150],
          [-70, -160],
          [-60, -90],
          [-140, -80],
        ],
      },
      {
        name: 'Food Forest Orchard',
        type: 'park',
        points: [
          [50, 40],
          [130, 30],
          [120, 110],
          [40, 100],
        ],
      },
    ],
    streets: [
      {
        name: 'Pacific Crest Connector',
        width: 3.5,
        type: 'primary',
        points: [
          [-170, -120],
          [-80, -40],
          [0, 0],
          [90, 50],
          [170, 110],
        ],
      },
      {
        name: 'Solar Hub Arterial',
        width: 3,
        type: 'secondary',
        points: [
          [0, -150],
          [0, 0],
          [0, 150],
        ],
      },
      {
        name: 'Salmon Run River Trail',
        width: 2,
        type: 'trail',
        points: [
          [-160, 140],
          [-20, 20],
          [140, -120],
        ],
      },
    ],
    landmarks: [
      { id: 'cl1', name: 'Cascadia Central Solar Repeater', x: 0, y: 0, type: 'hub' },
      { id: 'cl2', name: 'Community Seed Bank', x: -65, y: -45, type: 'eco' },
      { id: 'cl3', name: 'River Basin Micro-Hydro', x: 25, y: -20, type: 'station' },
      { id: 'cl4', name: 'Highland Radio Tower', x: -110, y: -100, type: 'hub' },
    ],
  },
  viljandi: {
    id: 'viljandi',
    cityName: 'Viljandi',
    country: 'Estonia',
    bioregionName: 'Sakala Upland / Viljandi Lake Basin',
    centerCoordsText: '58.3639° N, 25.5976° E',
    description: 'Medieval hillforts, Viljandi castle ruins overlooking Lake Viljandi, vibrant folk heritage, and lush green vales.',
    districts: [
      { name: 'Kesklinn', x: 0, y: -15 },
      { name: 'Lossimäed', x: -35, y: 20 },
      { name: 'Paalalinn', x: -70, y: -80 },
      { name: 'Kantreküla', x: -90, y: -10 },
      { name: 'Männimäe', x: 70, y: 80 },
      { name: 'Kösti', x: 100, y: -40 },
    ],
    zones: [
      // Viljandi Lake (Crescent shape to the south-east)
      {
        name: 'Viljandi Lake (Viljandi Järv)',
        type: 'water',
        points: [
          [-140, 130],
          [-70, 95],
          [-15, 60],
          [40, 50],
          [90, 70],
          [150, 120],
          [160, 155],
          [110, 145],
          [45, 115],
          [-20, 110],
          [-90, 140],
          [-140, 165],
        ],
      },
      // Paala Lake
      {
        name: 'Paala Järv (Valuoja Reservoir)',
        type: 'water',
        points: [
          [-80, -95],
          [-55, -115],
          [-45, -90],
          [-70, -70],
        ],
      },
      // Lossimäed Castle Park
      {
        name: 'Lossimäed & Varemed Park',
        type: 'park',
        points: [
          [-65, 0],
          [-15, 0],
          [10, 25],
          [-10, 50],
          [-55, 45],
        ],
      },
      // Valuoja Green Valley
      {
        name: 'Valuoja Oru Park',
        type: 'park',
        points: [
          [-90, -50],
          [-65, -45],
          [-40, -70],
          [-60, -90],
        ],
      },
      // Männimäe Pine Grove
      {
        name: 'Männimäe Pine Grove',
        type: 'park',
        points: [
          [50, 60],
          [110, 60],
          [120, 110],
          [60, 110],
        ],
      },
    ],
    streets: [
      {
        name: 'Tallinna tänav / Tartu tänav',
        width: 3.5,
        type: 'primary',
        points: [
          [-120, -110],
          [-50, -60],
          [0, -15],
          [60, -30],
          [130, -50],
        ],
      },
      {
        name: 'Riia maantee',
        width: 3,
        type: 'secondary',
        points: [
          [0, -15],
          [-25, 20],
          [-60, 70],
          [-110, 120],
        ],
      },
      {
        name: 'Vaksali tänav',
        width: 2.5,
        type: 'secondary',
        points: [
          [-120, -30],
          [-60, -25],
          [0, -15],
        ],
      },
      {
        name: 'Lossimägede Rippsilla Matkarada',
        width: 2,
        type: 'trail',
        points: [
          [-50, 10],
          [-30, 25],
          [-10, 45],
          [30, 40],
          [70, 55],
        ],
      },
    ],
    landmarks: [
      { id: 'vl1', name: 'Ordulinnuse Varemed', x: -35, y: 20, type: 'historic' },
      { id: 'vl2', name: 'Viljandi Rippsild (Suspension Bridge)', x: -15, y: 35, type: 'hub' },
      { id: 'vl3', name: 'Pärimusmuusika Ait (Folk Center)', x: -20, y: 5, type: 'eco' },
      { id: 'vl4', name: 'Ugala Teater', x: -75, y: -40, type: 'station' },
      { id: 'vl5', name: 'Vana Veetorn (Water Tower)', x: 10, y: -20, type: 'hub' },
    ],
  },
  polva: {
    id: 'polva',
    cityName: 'Põlva',
    country: 'Estonia',
    bioregionName: 'Kagu-Eesti Moreenitasandik / Ora Jõe Org',
    centerCoordsText: '58.0531° N, 27.0569° E',
    description: 'Picturesque pine-sheltered town nestled around Põlva lake reservoir, Intsikurmu festival grounds, and healing nature.',
    districts: [
      { name: 'Kesklinn', x: -10, y: -20 },
      { name: 'Intsikurmu', x: -70, y: 70 },
      { name: 'Põlva Järveäär', x: 25, y: 15 },
      { name: 'Mammaste', x: -80, y: -80 },
      { name: 'Roosi', x: 80, y: -60 },
    ],
    zones: [
      // Põlva Reservoir Lake (Põlva Paisjärv)
      {
        name: 'Põlva Paisjärv',
        type: 'water',
        points: [
          [-30, -5],
          [20, -10],
          [70, 10],
          [80, 50],
          [50, 75],
          [0, 50],
          [-20, 25],
        ],
      },
      // Ora Jõgi River
      {
        name: 'Ora Jõgi Stream',
        type: 'water',
        points: [
          [-140, -110],
          [-90, -70],
          [-50, -35],
          [-30, -5],
          [-40, 5],
          [-60, -25],
          [-100, -60],
          [-145, -95],
        ],
      },
      // Intsikurmu Metsapark
      {
        name: 'Intsikurmu Metsapark & Laululava',
        type: 'park',
        points: [
          [-110, 45],
          [-45, 45],
          [-30, 95],
          [-90, 115],
          [-125, 80],
        ],
      },
      // Põlva Rannapark
      {
        name: 'Põlva Rannapromenaad',
        type: 'park',
        points: [
          [10, -5],
          [55, 0],
          [65, 35],
          [15, 20],
        ],
      },
    ],
    streets: [
      {
        name: 'Kesk tänav',
        width: 3.5,
        type: 'primary',
        points: [
          [-110, -40],
          [-50, -25],
          [-10, -20],
          [40, -15],
          [100, -10],
        ],
      },
      {
        name: 'Jaama tee / Orajõe tee',
        width: 3,
        type: 'secondary',
        points: [
          [-10, -20],
          [-15, 20],
          [-45, 60],
          [-80, 110],
        ],
      },
      {
        name: 'Mammaste Terviserajad',
        width: 2,
        type: 'trail',
        points: [
          [-120, -90],
          [-75, -60],
          [-35, -20],
        ],
      },
      {
        name: 'Intsikurmu Laululava Rada',
        width: 2,
        type: 'trail',
        points: [
          [-35, 45],
          [-65, 75],
          [-90, 95],
        ],
      },
    ],
    landmarks: [
      { id: 'pl1', name: 'Intsikurmu Lauluväljak & Hub', x: -70, y: 70, type: 'eco' },
      { id: 'pl2', name: 'Põlva Maarja Kirik', x: -20, y: -30, type: 'historic' },
      { id: 'pl3', name: 'Põlva Rannapromenaad & Kai', x: 40, y: 20, type: 'water' },
      { id: 'pl4', name: 'Mammaste Tervisespordi Keskkonnajaam', x: -80, y: -75, type: 'station' },
    ],
  },
  narva: {
    id: 'narva',
    cityName: 'Narva',
    country: 'Estonia',
    bioregionName: 'Narva Jõgi / Soome Lahe Estuaar',
    centerCoordsText: '59.3797° N, 28.1913° E',
    description: 'Border fortress town, centered around the fast-flowing Narva River, historic Kreenholm manufacturing island, and massive limestone fortresses.',
    districts: [
      { name: 'Kesklinn', x: -10, y: -20 },
      { name: 'Kreenholm', x: -50, y: 80 },
      { name: 'Sutthoff', x: 20, y: -90 },
      { name: 'Pähklimäe', x: -80, y: -50 },
      { name: 'Siivertsi', x: 60, y: -130 },
    ],
    zones: [
      // Narva River boundary water
      {
        name: 'Narva River (Narva Jõgi)',
        type: 'water',
        points: [
          [-140, 160],
          [-90, 110],
          [-30, 40],
          [20, -20],
          [80, -80],
          [130, -130],
          [160, -180],
          [190, -180],
          [150, -110],
          [90, -50],
          [35, 10],
          [-15, 70],
          [-70, 130],
          [-120, 180],
        ],
      },
      // Kreenholm Island (Cradle of regional community energy)
      {
        name: 'Kreenholm Island & Waterfalls',
        type: 'urban',
        points: [
          [-65, 60],
          [-35, 50],
          [-40, 95],
          [-75, 85],
        ],
      },
      // Äkkeküla Forest Adventure Park
      {
        name: 'Äkkeküla (Pähklimäe) Pine Forest',
        type: 'park',
        points: [
          [-120, -70],
          [-70, -80],
          [-60, -30],
          [-110, -20],
        ],
      },
    ],
    streets: [
      {
        name: 'Tallinna maantee',
        width: 3.5,
        type: 'primary',
        points: [
          [-160, -20],
          [-90, -20],
          [-10, -20],
          [25, -20],
        ],
      },
      {
        name: 'Kreenholmi tänav',
        width: 3,
        type: 'secondary',
        points: [
          [-10, -20],
          [-30, 30],
          [-50, 80],
          [-70, 130],
        ],
      },
      {
        name: 'Narva Jõe Promenaad',
        width: 2,
        type: 'trail',
        points: [
          [-100, 100],
          [-40, 40],
          [10, -10],
          [60, -50],
        ],
      },
    ],
    landmarks: [
      { id: 'nl1', name: 'Hermanni Kindlus (Hermann Castle)', x: 15, y: -15, type: 'historic' },
      { id: 'nl2', name: 'Kreenholmi Manufaktuur', x: -50, y: 75, type: 'hub' },
      { id: 'nl3', name: 'Narva Jõesadam', x: 45, y: -40, type: 'water' },
      { id: 'nl4', name: 'Äkkeküla Tervisespordi Keskus', x: -90, y: -45, type: 'eco' },
    ],
  },
  kuressaare: {
    id: 'kuressaare',
    cityName: 'Kuressaare',
    country: 'Estonia',
    bioregionName: 'Saaremaa Rannik / Läänemere Saared',
    centerCoordsText: '58.2529° N, 22.4849° E',
    description: 'Maritime island stronghold, home of Saaremaa juniper fields, pristine coastal wetlands, and the outstandingly preserved Kuressaare Episcopal Castle.',
    districts: [
      { name: 'Kesklinn', x: 0, y: -20 },
      { name: 'Lossipark', x: -20, y: 30 },
      { name: 'Tori', x: -80, y: 40 },
      { name: 'Kudjape', x: 90, y: -80 },
      { name: 'Roomassaare', x: 120, y: 120 },
    ],
    zones: [
      // Tori Inlet Baltic Coast
      {
        name: 'Tori Inlet & Baltic Sea Coast',
        type: 'water',
        points: [
          [-180, 70],
          [-120, 55],
          [-60, 50],
          [10, 60],
          [80, 80],
          [150, 110],
          [190, 140],
          [190, 180],
          [-180, 180],
        ],
      },
      // Episcopal Castle Moat & Park
      {
        name: 'Episcopal Castle Gardens & Moats',
        type: 'park',
        points: [
          [-45, 10],
          [5, 10],
          [15, 50],
          [-35, 50],
        ],
      },
      // Roomassaare Coastal Wetland
      {
        name: 'Roomassaare Juniper Meadows',
        type: 'park',
        points: [
          [70, 20],
          [120, 30],
          [140, 90],
          [80, 80],
        ],
      },
    ],
    streets: [
      {
        name: 'Tallinna tänav',
        width: 3.5,
        type: 'primary',
        points: [
          [0, -20],
          [40, -60],
          [90, -110],
          [140, -150],
        ],
      },
      {
        name: 'Roomassaare tee',
        width: 3,
        type: 'secondary',
        points: [
          [0, -20],
          [40, 20],
          [80, 60],
          [120, 110],
        ],
      },
      {
        name: 'Loode Tammiku Matkarada',
        width: 2,
        type: 'trail',
        points: [
          [-140, 30],
          [-100, 20],
          [-60, 25],
        ],
      },
    ],
    landmarks: [
      { id: 'kl1', name: 'Kuressaare Piiskopilinnus (Castle)', x: -15, y: 30, type: 'historic' },
      { id: 'kl2', name: 'Kuressaare Raekoda', x: 5, y: -25, type: 'historic' },
      { id: 'kl3', name: 'Tori Abajas (Yacht Harbour)', x: -75, y: 30, type: 'water' },
      { id: 'kl4', name: 'Roomassaare Eco-Energy Hub', x: 110, y: 100, type: 'station' },
    ],
  },
  kitsekula: KITSEKULA_MAP,
};

// Runtime dynamic restorer for custom/imported OpenStreetMap and bioregional city maps
if (typeof window !== 'undefined') {
  try {
    const rawCustom = localStorage.getItem('hoimu_custom_city_maps');
    if (rawCustom) {
      const parsed: Record<string, CityMapData> = JSON.parse(rawCustom);
      Object.keys(parsed).forEach((key) => {
        CITY_MAPS[key] = parsed[key];
        console.info(`[CityMaps] Successfully restored custom/imported OSM map: ${parsed[key].cityName}`);
      });
    }
  } catch (err) {
    console.warn('[CityMaps] Failed to restore custom maps from localStorage:', err);
  }
}

