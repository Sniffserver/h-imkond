/**
 * DEMO / SIMULATION Type Definitions
 * 
 * NOTE: These models are strictly isolated from production services and canonical mesh models.
 * Never share production services/data models with this demo space.
 */

export interface DemoBatteryStatus {
  batteryLevelPercent?: number;
  isCharging?: boolean;
  solarHarvestRateW?: number;
  solarAwareModeEnabled?: boolean;
  currentWeatherCondition?: string;
  estimatedHoursRemaining?: number;
  [key: string]: any;
}

export interface DemoLandingPageProps {
  onEnterApp: () => void;
  onNavigateToTab?: (tab: 'mesh' | 'map' | 'pathfinder' | 'exchange' | 'journal' | 'profile') => void;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  peersCount?: number;
  batteryStatus?: DemoBatteryStatus;
}

export interface DemoWikiArticle {
  id: string;
  category: 'mesh' | 'solar' | 'permaculture' | 'emergency';
  title: string;
  summary: string;
  readTime: string;
  content: string[];
}
