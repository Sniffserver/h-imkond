/**
 * Canonical Tallinn POIs & Places Database
 * Single geographic coordinate system { lat, lng }
 */

import { Poi } from '../../../types';

export const TALLINN_POIS: Poi[] = [
  // 1. HARDWARE & REPAIR
  {
    id: 'poi_bauhaus_lasna',
    name: 'Bauhaus Lasnamäe Hardware & Tools',
    category: 'hardware',
    source: 'osm',
    location: { lat: 59.4385, lng: 24.8450 },
    address: 'Tähesaju tee 8, Lasnamäe',
    openingHours: '07:00-20:00',
    description: 'Extensive hand tools, fasteners, electrical cable, off-grid materials and lumber.',
    tags: { tools: 'true', generator_parts: 'true' },
  },
  {
    id: 'poi_telliskivi_repair',
    name: 'Telliskivi Community Tool Library & Repair Workshop',
    category: 'tools',
    source: 'community',
    location: { lat: 59.4398, lng: 24.7290 },
    address: 'Telliskivi 60a, Kalamaja',
    openingHours: '10:00-19:00',
    description: 'Shared woodworking tools, electronics soldering station, 3D printers and bicycle repair stand.',
    tags: { mutual_aid: 'true', tool_sharing: 'true' },
  },
  {
    id: 'poi_kristiine_krauta',
    name: 'K-Rauta Kristiine Hardware Hub',
    category: 'hardware',
    source: 'osm',
    location: { lat: 59.4210, lng: 24.7190 },
    address: 'Sõpruse pst 145, Kristiine',
    openingHours: '08:00-20:00',
    description: 'Hardware tools, plumbing, insulation, solar mounting supplies, rainwater catchment hardware.',
  },

  // 2. SAFETY, WATER & EMERGENCY SHELTERS
  {
    id: 'poi_shelter_balti_jaam',
    name: 'Balti Jaam Civil Protection Shelter',
    category: 'shelter',
    source: 'paasteamet',
    location: { lat: 59.4402, lng: 24.7375 },
    address: 'Toompuiestee 37, Kesklinn',
    description: 'Designated reinforced public shelter with secondary power grid and filtered ventilation.',
    tags: { emergency_shelter: 'true', capacity: '1200' },
  },
  {
    id: 'poi_water_kadriorg_spring',
    name: 'Kadriorg Park Natural Gravity Water Spring',
    category: 'water',
    source: 'tallinn',
    location: { lat: 59.4390, lng: 24.7890 },
    address: 'Kadriorg Park, Kesklinn',
    description: 'Perennial natural spring tap. Tested potable groundwater with zero electricity required.',
    tags: { potable_water: 'true', gravity_flow: 'true' },
  },
  {
    id: 'poi_shelter_vabaduse',
    name: 'Vabaduse Väljak Subterranean Shelter',
    category: 'shelter',
    source: 'paasteamet',
    location: { lat: 59.4340, lng: 24.7440 },
    address: 'Vabaduse väljak 9, Südalinn',
    description: 'Underground complex designated for civil defense emergency refuge.',
  },

  // 3. REUSE & CIRCULAR ECONOMY
  {
    id: 'poi_reuse_center_arsenal',
    name: 'Uuskasutuskeskus (Reuse Center) Kopli',
    category: 'reuse',
    source: 'community',
    location: { lat: 59.4520, lng: 24.7140 },
    address: 'Erika 14, Põhja-Tallinn',
    openingHours: '10:00-18:00',
    description: 'Clothing, household hardware, textiles, containers, bicycle parts, non-electric kitchenware.',
  },
  {
    id: 'poi_reuse_tatari',
    name: 'Uuskasutuskeskus Tatari',
    category: 'reuse',
    source: 'community',
    location: { lat: 59.4290, lng: 24.7470 },
    address: 'Tatari 64, Südalinn',
    openingHours: '10:00-18:00',
    description: 'Downtown mutual reuse outlet with work clothes, cookware, and emergency thermal blankets.',
  },

  // 4. LIBRARIES & WORKSPACES
  {
    id: 'poi_kalamaja_library',
    name: 'Kalamaja Raamatukogu & Field Knowledge Depot',
    category: 'library',
    source: 'tallinn',
    location: { lat: 59.4450, lng: 24.7380 },
    address: 'Kotzebue 9, Kalamaja',
    openingHours: '11:00-19:00',
    description: 'Municipal library with offline reference archives, solar power charging tables, and community notice board.',
  },
  {
    id: 'poi_rahvusraamatukogu_solarise',
    name: 'Eesti Rahvusraamatukogu (Solaris Branch)',
    category: 'library',
    source: 'tallinn',
    location: { lat: 59.4335, lng: 24.7510 },
    address: 'Estonia pst 9, Kesklinn',
    openingHours: '10:00-20:00',
    description: 'National library temporary hub with study desks, digitized maps, and emergency mesh relay node.',
  },

  // 5. PERMACULTURE & COMMUNITY FOOD
  {
    id: 'poi_kalamaja_garden',
    name: 'Kalamaja Community Permaculture Garden',
    category: 'permaculture',
    source: 'community',
    location: { lat: 59.4470, lng: 24.7340 },
    address: 'Valgevase 10, Kalamaja',
    description: 'Shared raised beds, heritage seed bank, composting station, and rainwater harvesting cistern.',
  },
  {
    id: 'poi_balti_jaam_market',
    name: 'Balti Jaama Turg (Local Food & Produce Market)',
    category: 'food',
    source: 'osm',
    location: { lat: 59.4410, lng: 24.7360 },
    address: 'Kopli 1, Kalamaja',
    openingHours: '09:00-19:00',
    description: 'Farmers market with root vegetables, honey, smoked fish, grains, and dry goods.',
  },
];
