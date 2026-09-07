import { CityMapData, SurvivalPoi } from '../types';

const survivalPois: SurvivalPoi[] = [
  {
    id: 'kt-tools-1',
    name: 'Kitseküla Rauapood',
    category: 'Tools',
    x: 10,
    y: 60,
    description: 'Ehitus- ja remonditarbed, tööriistad',
  },
  {
    id: 'kt-bike-1',
    name: 'Rattaparkla & Remont',
    category: 'Bikes',
    x: 20,
    y: -10,
    description: 'Jalgrataste hooldus ja turvaline parkimine',
  },
  {
    id: 'kt-med-1',
    name: 'Kitseküla Apteek',
    category: 'Medical',
    x: -40,
    y: -30,
    description: 'Esmaabivahendid ja käsimüügiravimid',
  },
  {
    id: 'kt-food-1',
    name: 'Kitseküla Toidupood',
    category: 'Food',
    x: 30,
    y: 30,
    description: 'Kohalik toidupood, värske leib ja hooajasaadused',
  },
  {
    id: 'kt-station-1',
    name: 'Tondi Raudteejaam',
    category: 'Station',
    x: -50,
    y: -50,
    description: 'Rongipeatus, ühendus kesklinna ja Nõmme suunal',
  },
];

export const KITSEKULA_MAP: CityMapData = {
  id: 'kitsekula',
  cityName: 'Kitseküla',
  country: 'Estonia',
  bioregionName: 'North-Estonian Klint / Baltoscandian',
  centerCoordsText: '59.418°N 24.743°E',
  centerCoords: [59.418, 24.743],
  description: 'Historical railway suburb blending old wooden houses with modern eco-nodes.',
  districts: [
    { name: 'Kitseküla Station', x: -50, y: 30 },
    { name: 'Tondi', x: -60, y: -40 },
    { name: 'Osta', x: 20, y: -20 },
    { name: 'Magdaleena', x: 40, y: 50 },
  ],
  zones: [
    {
      type: 'park',
      name: 'Kitseküla Park',
      points: [
        [20, 20],
        [40, 20],
        [40, 40],
        [20, 40],
      ],
    },
  ],
  streets: [
    {
      name: 'Pärnu maantee',
      type: 'primary',
      width: 3,
      points: [
        [-80, 80],
        [80, -80],
      ],
    },
    {
      name: 'Tondi',
      type: 'secondary',
      width: 2,
      points: [
        [-50, -50],
        [-10, 20],
      ],
    },
    {
      name: 'Tehnika',
      type: 'primary',
      width: 3,
      points: [
        [20, 80],
        [50, -30],
      ],
    },
    {
      name: 'Railway',
      type: 'primary',
      width: 4,
      points: [
        [-100, 40],
        [100, 40],
      ],
    }
  ],
  landmarks: [
    { id: 'kl1', name: 'Kitseküla Station Node', x: -30, y: 40, type: 'station' },
  ],
  survivalPois,
};
