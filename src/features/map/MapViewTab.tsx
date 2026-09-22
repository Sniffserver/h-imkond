import { estimateTileCountForBounds, downloadRasterTilesForBounds } from '../../services/map/rasterTileCacheService';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useAnimation } from 'motion/react';
import {
  MeshNode,
  ResourceItem,
  ResourceCategory,
  TopologyFilter,
  MapTransform,
  SurvivalPoiCategory,
  SurvivalPoi,
  PathfinderFilter,
  WifiSpot,
  BluetoothSpot,
  LoraNode,
  WalkSession,
  UserProfile,
  OfflineMapRegion,
  BatteryManagerStatus,
} from '../../types';
import { offlineMapService } from '../../services/map/offlineMapService';
import { pathfinderScanner, PathfinderActiveState } from '../../services/scanner/pathfinderScanner';
import { initPathfinderDB, getLoadedPathfinderData } from '../../utils/pathfinderStorage';
import { CITY_MAPS } from '../../data/cityMaps';
import { pedometerService } from '../../services/utils/pedometerService';
import { deadReckoningService, DeadReckoningState } from '../../services/utils/deadReckoning';
import { mapRevealService, localGridToGeoPoint, geoPointToLocalGrid } from '../../services/map/mapRevealService';
import { useMeshStore, selectPeersArray } from '../../store/meshStore';
import { StepProgressWidget } from '../../components/StepProgressWidget';
import { SolarpunkAvatarCanvas } from '../../components/SolarpunkAvatarCanvas';
import { ReputationPill } from '../../components/ReputationPill';
import { MapLegendComponent } from '../../components/MapLegendComponent';
import type { HeatmapMode } from '../../utils/d3BioregionalHeatmap';
import { MapSkeleton } from './MapSkeleton';
import { NearbyResourcesOverlay } from '../../components/NearbyResourcesOverlay';
import { DynamicScaleRuler } from '../../components/DynamicScaleRuler';

// Lazy-loaded Map Renderers & Modals
const OfflineMapCanvas = React.lazy(() => import('../../components/OfflineMapCanvas').then((m) => ({ default: m.OfflineMapCanvas })));
const WebGlMapCanvas = React.lazy(() => import('../../components/WebGlMapCanvas').then((m) => ({ default: m.WebGlMapCanvas })));
const AsciiMap = React.lazy(() => import('../../components/AsciiMap').then((m) => ({ default: m.AsciiMap })));
const CitySelectionModal = React.lazy(() => import('../../components/CitySelectionModal').then((m) => ({ default: m.CitySelectionModal })));
const PathfinderModal = React.lazy(() => import('../../components/PathfinderModal').then((m) => ({ default: m.PathfinderModal })));
const DownloadOfflineRegionModal = React.lazy(() => import('../../components/DownloadOfflineRegionModal').then((m) => ({ default: m.DownloadOfflineRegionModal })));
const D3HeatmapLegend = React.lazy(() => import('../../components/D3HeatmapLegend').then((m) => ({ default: m.D3HeatmapLegend })));
const MeshActivityHubsD3 = React.lazy(() => import('../../components/MeshActivityHubsD3').then((m) => ({ default: m.MeshActivityHubsD3 })));
import {
  calculatePolygonArea,
  calculatePerimeterLength,
  encodePerimeterToken,
  decodePerimeterToken,
  saveCustomPerimeter,
} from '../../utils/mapTileCache';
import { planOfflineRoute, RouteResult, RouteStep } from '../../utils/offlineRouter';
import {
  MapPin,
  Layers,
  Flame,
  Radio,
  Compass,
  Sparkles,
  Zap,
  Wrench,
  Wheat,
  GraduationCap,
  Home,
  HeartPulse,
  MessageSquare,
  ArrowRight,
  Info,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Building,
  Move,
  Maximize2,
  Minimize2,
  Share2,
  Copy,
  Check,
  Undo2,
  Navigation,
  Upload,
  LocateFixed,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  X,
  Ruler,
  Footprints,
  Bike,
  CornerDownRight,
  ArrowUpDown,
  Route as RouteIcon,
  Boxes,
  Signal,
  HeartHandshake,
  Eye,
  EyeOff,
  FolderDown,
  HardDrive, Download,
  Clock,
  Terminal,
  Cpu,
  ZapOff,
} from 'lucide-react';

const ALL_CATEGORIES: ResourceCategory[] = [
  'Energy',
  'Tools',
  'Food',
  'Skills',
  'Care & Housing',
  'Bio-Remedy',
  'Electronics',
];

interface MapViewTabProps {
  peers: MeshNode[];
  resources: ResourceItem[];
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
  isNightMode?: boolean;
  filterOnlyNew?: boolean;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onSelectPeer: (peer: MeshNode) => void;
  onOpenChatWithPeer: (peer: MeshNode) => void;
  onOpenReputation: (peer: MeshNode) => void;
  batteryStatus?: BatteryManagerStatus;
  activeLayers?: {
    peers: boolean;
    resources: boolean;
    heatmap: boolean;
    terrain: boolean;
  };
  onToggleLayer?: (layerKey: 'peers' | 'resources' | 'heatmap' | 'terrain') => void;
  onZoomChange?: (zoom: number) => void;
}

export const MapViewTab: React.FC<MapViewTabProps> = React.memo(({
  peers,
  resources,
  user,
  onUpdateUser,
  onAddToast,
  isNightMode = false,
  filterOnlyNew = false,
  onViewResourceDetails,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  batteryStatus,
  activeLayers,
  onToggleLayer,
  onZoomChange,
}) => {
  const userSymbiosisScore = user.symbiosisScore;
  const userCallsign = user.callsign;
  // Map Layers State subscribed to meshStore
  const activeLayer = useMeshStore((state) => state.activeLayer);
  const setActiveLayer = useMeshStore((state) => state.setActiveLayer);

  const activeMapLayer = useMemo<'Terrain' | 'Community Infrastructure' | 'Mesh Coverage'>(() => {
    if (activeLayer === 'terrain') return 'Terrain';
    if (activeLayer === 'mesh') return 'Mesh Coverage';
    return 'Community Infrastructure';
  }, [activeLayer]);

  const setActiveMapLayer = useCallback((layer: 'Terrain' | 'Community Infrastructure' | 'Mesh Coverage') => {
    if (layer === 'Terrain') setActiveLayer('terrain');
    else if (layer === 'Mesh Coverage') setActiveLayer('mesh');
    else setActiveLayer('infrastructure');
  }, [setActiveLayer]);
  const mapContainerAnimControls = useAnimation();

  // Animate map container on layer change
  useEffect(() => {
    mapContainerAnimControls.start({
      opacity: [0.6, 1],
      filter: ['blur(4px)', 'blur(0px)'],
      transition: { duration: 0.5, ease: 'easeOut' },
    });
  }, [activeMapLayer, mapContainerAnimControls]);

  // Selected City & Map Transform State
  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    return localStorage.getItem('hoimu_selected_city') || 'tartu';
  });
  const activeCity = CITY_MAPS[selectedCityId] || CITY_MAPS.tartu;
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  const [autoFollowUser, setAutoFollowUser] = useState(false);
  const autoFollowWatchIdRef = useRef<number | null>(null);

  // Field Navigation Landscape Mode Enforcement
  useEffect(() => {
    if (user?.forceLandscapeMap) {
      if (typeof window !== 'undefined' && 'screen' in window && screen.orientation && 'lock' in screen.orientation) {
        (screen.orientation as any).lock('landscape').catch(() => {
          // Gracefully ignore environments where screen orientation lock is not permitted (e.g. desktop/iframe)
        });
      }
    }
    return () => {
      if (typeof window !== 'undefined' && 'screen' in window && screen.orientation && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
        } catch {}
      }
    };
  }, [user?.forceLandscapeMap]);

  // Layer Toggles
  // Toggle Mesh Nodes Filter connected to meshStore
  const showMeshNodes = useMeshStore((state) => state.showMeshNodes);
  const setShowMeshNodes = useMeshStore((state) => state.setShowMeshNodes);

  // Node Last Seen / Freshness Shading Layer
  const [showNodeFreshness, setShowNodeFreshness] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_node_freshness');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_node_freshness', String(showNodeFreshness));
  }, [showNodeFreshness]);

  const [showMeshLinks, setShowMeshLinks] = useState(true);
  const [showDensityHeatmap, setShowDensityHeatmap] = useState(true);
  const [d3HeatmapMode, setD3HeatmapMode] = useState<HeatmapMode>(() => {
    const saved = localStorage.getItem('hoimu_d3_heatmap_mode');
    return (saved as HeatmapMode) || 'combined';
  });
  const [d3HeatmapOpacity, setD3HeatmapOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('hoimu_d3_heatmap_opacity');
    return saved ? parseFloat(saved) : 0.65;
  });

  useEffect(() => {
    localStorage.setItem('hoimu_d3_heatmap_mode', d3HeatmapMode);
  }, [d3HeatmapMode]);

  useEffect(() => {
    localStorage.setItem('hoimu_d3_heatmap_opacity', String(d3HeatmapOpacity));
  }, [d3HeatmapOpacity]);
  const [showSignalHeatmap, setShowSignalHeatmap] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_signal_heatmap');
    return saved !== null ? saved === 'true' : true;
  });
  const [showCachedZones, setShowCachedZones] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_cached_zones');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_cached_zones', String(showCachedZones));
  }, [showCachedZones]);

  // Map Legend visibility state
  const [showLegend, setShowLegend] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_show_legend');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_show_legend', String(showLegend));
  }, [showLegend]);
  const [showContours, setShowContours] = useState(true);
  const [showRadii, setShowRadii] = useState(true);
  const [useWebGl, setUseWebGl] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_use_webgl');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_use_webgl', String(useWebGl));
  }, [useWebGl]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ResourceCategory>('all');
  const [topologyFilter, setTopologyFilter] = useState<TopologyFilter>('all');

  // Resource Category Marker Visibility Filter (multi-category toggle)
  const [visibleCategories, setVisibleCategories] = useState<Set<ResourceCategory>>(() => {
    try {
      const saved = localStorage.getItem('hoimu_map_visible_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed as ResourceCategory[]);
        }
      }
    } catch {}
    return new Set(ALL_CATEGORIES);
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_visible_categories', JSON.stringify(Array.from(visibleCategories)));
  }, [visibleCategories]);

  const toggleCategoryVisibility = useCallback((category: ResourceCategory) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const toggleAllCategories = useCallback(() => {
    setVisibleCategories((prev) => {
      if (prev.size === ALL_CATEGORIES.length) {
        return new Set();
      } else {
        return new Set(ALL_CATEGORIES);
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('hoimu_map_signal_heatmap', String(showSignalHeatmap));
  }, [showSignalHeatmap]);

  // Survival POI Filter
  const [visiblePoiCategories, setVisiblePoiCategories] = useState<Set<SurvivalPoiCategory>>(
    new Set(['Tools', 'Bikes', 'Medical', 'Food', 'Station'])
  );

  // Fullscreen Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map Display Mode: 'visual' (Canvas) vs 'terminal' (Rogue-like ASCII)
  const [mapDisplayMode, setMapDisplayMode] = useState<'visual' | 'terminal'>('visual');

  // Ruler Mode
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<{x:number,y:number}[]>([]);

  // Resource Pin Clustering State (persisted locally)
  const [isClusteringEnabled, setIsClusteringEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_map_clustering');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('hoimu_map_clustering', String(isClusteringEnabled));
  }, [isClusteringEnabled]);

  // Offline Street Network Route Planning State
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [routeStart, setRouteStart] = useState<{ x: number; y: number; label?: string } | null>(null);
  const [routeDestination, setRouteDestination] = useState<{ x: number; y: number; label?: string } | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isSelectingWayPoint, setIsSelectingWayPoint] = useState<'start' | 'destination' | null>(null);
  const [showRouteSteps, setShowRouteSteps] = useState(false);

  // Selected Entity Inspector
  const [selectedPeer, setSelectedPeer] = useState<MeshNode | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);

  // Bioregional Perimeter Placement State
  const [isPlacingPerimeterMarker, setIsPlacingPerimeterMarker] = useState(false);
  const [perimeterPoints, setPerimeterPoints] = useState<[number, number][]>(() => {
    try {
      const saved = localStorage.getItem('hoimu_perimeter_points');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isPerimeterClosed, setIsPerimeterClosed] = useState<boolean>(() => {
    return localStorage.getItem('hoimu_perimeter_closed') === 'true';
  });

  // GPS Device Beacon State connected to meshStore
  const storeGps = useMeshStore((state) => state.gpsPosition);
  const setStoreGps = useMeshStore((state) => state.setGpsPosition);

  // Dead Reckoning Service State
  const [deadReckoningState, setDeadReckoningState] = useState<DeadReckoningState>(() => deadReckoningService.getState());

  useEffect(() => {
    deadReckoningService.startTracking();
    const unsubscribe = deadReckoningService.addListener((st) => {
      setDeadReckoningState(st);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Sync GPS updates with deadReckoningService
  useEffect(() => {
    if (storeGps) {
      const latDiffKm = (storeGps.lat - (activeCity.centerCoords?.[0] || 58.3780)) * 110.574;
      const lngDiffKm = (storeGps.lng - (activeCity.centerCoords?.[1] || 26.7290)) * (111.32 * Math.cos(((activeCity.centerCoords?.[0] || 58.3780) * Math.PI) / 180));
      const wx = Math.round(lngDiffKm * 100);
      const wy = Math.round(-latDiffKm * 100);

      deadReckoningService.updateGpsFix(storeGps.lat, storeGps.lng, storeGps.accuracy, Date.now(), wx, wy);
    }
  }, [storeGps, activeCity]);

  const gpsPosition = useMemo(() => {
    if (!storeGps) return null;
    let cityLat = 58.3780;
    let cityLng = 26.7290;
    if (activeCity.centerCoords) {
      cityLat = activeCity.centerCoords[0];
      cityLng = activeCity.centerCoords[1];
    } else if (activeCity.centerCoordsText) {
      const match = activeCity.centerCoordsText.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/);
      if (match) {
        cityLat = parseFloat(match[1]) * (match[2] === 'S' ? -1 : 1);
        cityLng = parseFloat(match[3]) * (match[4] === 'W' ? -1 : 1);
      }
    }

    const latDiffKm = (storeGps.lat - cityLat) * 110.574;
    const lngDiffKm = (storeGps.lng - cityLng) * (111.32 * Math.cos((cityLat * Math.PI) / 180));

    const worldX = Math.round(lngDiffKm * 100);
    const worldY = Math.round(-latDiffKm * 100);

    return {
      x: worldX,
      y: worldY,
      accuracy: storeGps.accuracy,
      text: `GPS (${storeGps.lat.toFixed(4)}°, ${storeGps.lng.toFixed(4)}°) ±${storeGps.accuracy}m`,
    };
  }, [storeGps, activeCity]);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  // Share / Export / Import Token Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [zoneName, setZoneName] = useState('Bioregional Zone');
  const [importTokenInput, setImportTokenInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showWalkInfo, setShowWalkInfo] = useState(false);
  const [showActivityHubsDrawer, setShowActivityHubsDrawer] = useState(false);
  const [showNearbyAidOverlay, setShowNearbyAidOverlay] = useState(false);


  const [isEcoMode, setIsEcoMode] = useState<boolean>(() => localStorage.getItem('hoimu-map-eco-mode') === 'true');
  const effectiveEcoMode = isEcoMode || !!batteryStatus?.isSolarAwareActive;

  // Offline Region Download Utility State
  const [isOfflineDownloadOpen, setIsOfflineDownloadOpen] = useState(false);
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineMapRegion[]>(() =>
    offlineMapService.getDownloadedRegions()
  );

  // Viewport Cache State
  const [isViewportCacheModalOpen, setIsViewportCacheModalOpen] = useState(false);
  const [viewportCacheStatus, setViewportCacheStatus] = useState<'idle' | 'estimating' | 'downloading' | 'done'>('idle');
  const [viewportCacheBounds, setViewportCacheBounds] = useState<{minLat: number, maxLat: number, minLng: number, maxLng: number} | null>(null);
  const [viewportCacheCount, setViewportCacheCount] = useState<number>(0);
  const [viewportCacheProgress, setViewportCacheProgress] = useState<{downloaded: number, total: number}>({downloaded: 0, total: 0});

  const handleOpenViewportCache = async () => {
    const activeCity = CITY_MAPS[selectedCityId];
    if (!activeCity) return;
    
    setIsViewportCacheModalOpen(true);
    setViewportCacheStatus('estimating');
    
    // Calculate viewport bounds in local grid coordinates
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minX = -transform.offsetX / transform.scale;
    const maxX = (w - transform.offsetX) / transform.scale;
    const minY = -transform.offsetY / transform.scale;
    const maxY = (h - transform.offsetY) / transform.scale;

    const tl = localGridToGeoPoint(minX, minY, activeCity.centerCoordsText);
    const br = localGridToGeoPoint(maxX, maxY, activeCity.centerCoordsText);
    const bl = localGridToGeoPoint(minX, maxY, activeCity.centerCoordsText);
    const tr = localGridToGeoPoint(maxX, minY, activeCity.centerCoordsText);
    
    const lats = [tl.latitude, br.latitude, bl.latitude, tr.latitude];
    const lngs = [tl.longitude, br.longitude, bl.longitude, tr.longitude];
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    setViewportCacheBounds({ minLat, maxLat, minLng, maxLng });
    
    try {
            const count = estimateTileCountForBounds(minLat, maxLat, minLng, maxLng, 12, 15);
      setViewportCacheCount(count);
      setViewportCacheStatus('idle');
    } catch (e) {
      setViewportCacheStatus('idle');
    }
  };

  const handleStartViewportCache = async () => {
    if (!viewportCacheBounds) return;
    setViewportCacheStatus('downloading');
    setViewportCacheProgress({ downloaded: 0, total: viewportCacheCount });
    
    try {
            await downloadRasterTilesForBounds(
        viewportCacheBounds.minLat,
        viewportCacheBounds.maxLat,
        viewportCacheBounds.minLng,
        viewportCacheBounds.maxLng,
        12,
        15,
        (downloaded, total) => {
          setViewportCacheProgress({ downloaded, total });
        }
      );
      setViewportCacheStatus('done');
      setTimeout(() => {
        setIsViewportCacheModalOpen(false);
        if (onAddToast) onAddToast('🌐 Vaateväli vahemällu salvestatud', 'Kõik rasterkaardi kihid on nüüd saadaval võrguühenduseta.', 'success');
      }, 1500);
    } catch (e) {
      console.error(e);
      setViewportCacheStatus('idle');
    }
  };


  const handleCenterOnDownloadedRegion = useCallback((region: OfflineMapRegion) => {
    // Zoom and center map viewport smoothly to the region center coordinates
    const targetScale = Math.max(1.2, Math.min(3.5, 4.0 / Math.max(1, region.radiusKm)));
    setTransform({
      scale: targetScale,
      offsetX: -region.centerCoords.x * targetScale,
      offsetY: -region.centerCoords.y * targetScale,
      rotation: 0,
    });
    if (onAddToast) {
      onAddToast(
        `📍 Vaade suunatud: ${region.name}`,
        `Raadius ${region.radiusKm}km (${region.nodeCount} sõlme, ${region.resourceCount} ressurssi)`,
        'info'
      );
    }
  }, [onAddToast]);

  // ==========================================================
  // WALK TO REVEAL / PEDOMETER STATE & EFFECTS (Connected to meshStore)
  // ==========================================================
  const [isWalkToRevealEnabled, setIsWalkToRevealEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('hoimu_walk_to_reveal_enabled');
    return saved === 'true';
  });

  const storeRevealedCircles = useMeshStore((state) => state.revealedCircles);
  const addRevealedCircle = useMeshStore((state) => state.addRevealedCircle);
  const setStoreRevealedCircles = useMeshStore((state) => state.setRevealedCircles);

  const revealedCircles = useMemo(() => {
    return storeRevealedCircles.map((c) => {
      const pt = geoPointToLocalGrid(c.lat, c.lng, activeCity.centerCoordsText);
      return { x: pt.x, y: pt.y, r: c.radius };
    });
  }, [storeRevealedCircles, activeCity.centerCoordsText]);

  const [simulatedUserPos, setSimulatedUserPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(`hoimu_simulated_user_pos_${selectedCityId}`);
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const simulatedUserPosRef = useRef(simulatedUserPos);
  simulatedUserPosRef.current = simulatedUserPos;

  const [stepsState, setStepsState] = useState({
    steps: pedometerService.getTotalSteps(),
    distanceMeters: pedometerService.getDistanceMeters(),
  });

  const [lastRevealSteps, setLastRevealSteps] = useState<number>(() => {
    const saved = localStorage.getItem('hoimu_last_reveal_steps');
    return saved ? parseInt(saved, 10) : pedometerService.getTotalSteps();
  });

  // Persist configs when they change
  useEffect(() => {
    localStorage.setItem('hoimu_walk_to_reveal_enabled', String(isWalkToRevealEnabled));
  }, [isWalkToRevealEnabled]);

  useEffect(() => {
    localStorage.setItem(`hoimu_simulated_user_pos_${selectedCityId}`, JSON.stringify(simulatedUserPos));
  }, [simulatedUserPos, selectedCityId]);

  useEffect(() => {
    localStorage.setItem('hoimu_last_reveal_steps', String(lastRevealSteps));
  }, [lastRevealSteps]);

  // Sync city switches
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem(`hoimu_simulated_user_pos_${selectedCityId}`);
      setSimulatedUserPos(savedPos ? JSON.parse(savedPos) : { x: 0, y: 0 });
    } catch {
      setSimulatedUserPos({ x: 0, y: 0 });
    }
  }, [selectedCityId]);

  const checkDailyWalkStreak = (currentSteps: number) => {
    if (currentSteps >= 500) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (user.lastWalkDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const nextStreak = user.lastWalkDate === yesterdayStr ? (user.streakDays || 0) + 1 : 1;
        
        onUpdateUser({
          streakDays: nextStreak,
          lastWalkDate: todayStr,
        });

        if (onAddToast) {
          onAddToast(
            '🔥 Jalutuskäigu Seeria!',
            `Suurepärane! Sinu tänane kõndimise seeria on nüüd ${nextStreak} päeva. Jätka samas vaimus!`,
            'success'
          );
        }
      }
    }
  };

  const processNewAreaRevealed = (revealedArea: any) => {
    // 1. Award +2 symbiosis score points for the new area
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedHistory = user.symbiosisHistory ? [...user.symbiosisHistory] : [];
    const todayIdx = updatedHistory.findIndex((h) => h.date === todayStr);
    if (todayIdx >= 0) {
      updatedHistory[todayIdx] = { date: todayStr, score: updatedHistory[todayIdx].score + 2 };
    } else {
      updatedHistory.push({ date: todayStr, score: 2 });
    }

    let nextExploredStreets = user.exploredStreets ? [...user.exploredStreets] : [];
    let symbiosisPointsGained = 2;
    let bonusMessage = '';

    // 2. Check for fully discovered streets
    if (activeCity && activeCity.streets) {
      activeCity.streets.forEach((street) => {
        if (!street.name || nextExploredStreets.includes(street.name)) return;
        
        // A street is fully discovered if ALL of its points are within some revealed area
        const allPointsRevealed = street.points.every(([px, py]) => {
          const gp = localGridToGeoPoint(px, py, activeCity.centerCoordsText);
          return mapRevealService.isPointRevealed(gp.latitude, gp.longitude);
        });

        if (allPointsRevealed) {
          nextExploredStreets.push(street.name);
          symbiosisPointsGained += 15; // +15 points bonus for full street!
          bonusMessage += `\n🏅 Tänav "${street.name}" on täielikult avastatud! (+15 punkti)`;
          if (onAddToast) {
            onAddToast(
              '🏅 Erimärk: Tänava Avastaja!',
              `Tänav "${street.name}" on täielikult uuritud! Saavutasid uue märgise ja +15 sümbioosi punkti.`,
              'success'
            );
          }
        }
      });
    }

    // Update the state
    onUpdateUser({
      symbiosisScore: user.symbiosisScore + symbiosisPointsGained,
      symbiosisHistory: updatedHistory,
      exploredStreets: nextExploredStreets,
    });

    if (onAddToast) {
      onAddToast(
        '🗺️ Uus piirkond avatud!',
        `Kõndisid piisavalt, et paljastada uus asukoht piirkonnas. (+2 sümbioosi punkti)${bonusMessage}`,
        'success'
      );
    }
  };

  // Listen to step updates from pedometer service
  useEffect(() => {
    const unsubscribe = pedometerService.addListener((update) => {
      setStepsState({
        steps: update.steps,
        distanceMeters: update.distanceMeters,
      });

      // Reveal new circle every 100 steps milestone
      if (isWalkToRevealEnabled) {
        const userPos = gpsPosition ? { x: gpsPosition.x, y: gpsPosition.y } : simulatedUserPos;
        const geoPoint = localGridToGeoPoint(userPos.x, userPos.y, activeCity.centerCoordsText);
        const revealed = mapRevealService.checkForReveal(update.steps, geoPoint);

        // Check daily walking streak
        checkDailyWalkStreak(update.steps);

        const diff = update.steps - lastRevealSteps;
        if (diff >= 100 || revealed) {
          addRevealedCircle({
            lat: geoPoint.latitude,
            lng: geoPoint.longitude,
            radius: 60,
          });

          setLastRevealSteps(update.steps);
          if (revealed) {
            processNewAreaRevealed(revealed);
          }
        }
      }
    });

    if (isWalkToRevealEnabled) {
      pedometerService.startTracking();
    }

    return () => {
      unsubscribe();
    };
  }, [isWalkToRevealEnabled, lastRevealSteps, gpsPosition, simulatedUserPos, activeCity.centerCoordsText, user, addRevealedCircle]);

  const handleSimulateStepWalk = () => {
    pedometerService.simulateSteps(100);

    const angle = Math.random() * Math.PI * 2;
    const distance = 35; // Nudge simulated user position
    const nextX = Math.max(-180, Math.min(180, simulatedUserPos.x + Math.cos(angle) * distance));
    const nextY = Math.max(-180, Math.min(180, simulatedUserPos.y + Math.sin(angle) * distance));
    
    const newPos = { x: nextX, y: nextY };
    setSimulatedUserPos(newPos);

    // Register with mapRevealService
    const geoPoint = localGridToGeoPoint(newPos.x, newPos.y, activeCity.centerCoordsText);
    const totalSteps = pedometerService.getTotalSteps();
    const revealed = mapRevealService.checkForReveal(totalSteps, geoPoint);

    // Check daily walking streak
    checkDailyWalkStreak(totalSteps);

    addRevealedCircle({
      lat: geoPoint.latitude,
      lng: geoPoint.longitude,
      radius: 60,
    });

    if (revealed) {
      processNewAreaRevealed(revealed);
    }
  };

  const handleResetExploration = () => {
    pedometerService.reset();
    mapRevealService.resetAll();
    setLastRevealSteps(0);
    setSimulatedUserPos({ x: 0, y: 0 });
    const centerGeo = localGridToGeoPoint(0, 0, activeCity.centerCoordsText);
    setStoreRevealedCircles([{ lat: centerGeo.latitude, lng: centerGeo.longitude, radius: 65 }]);
  };

  useEffect(() => {
    localStorage.setItem('hoimu_perimeter_points', JSON.stringify(perimeterPoints));
  }, [perimeterPoints]);

  useEffect(() => {
    localStorage.setItem('hoimu_perimeter_closed', String(isPerimeterClosed));
  }, [isPerimeterClosed]);

  const [transform, setTransform] = useState<MapTransform>({
    scale: 1.0,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const latestTransformRef = useRef(transform);
  useEffect(() => {
    latestTransformRef.current = transform;
    if (onZoomChange) {
      const zoom = Math.round((13 + Math.log2(transform.scale)) * 10) / 10;
      onZoomChange(zoom);
    }
  }, [transform, onZoomChange]);

  const animateMapTo = useCallback((targetX: number, targetY: number, targetScale: number) => {
    const startScale = latestTransformRef.current.scale;
    const startOffsetX = latestTransformRef.current.offsetX;
    const startOffsetY = latestTransformRef.current.offsetY;

    const destOffsetX = -targetX * targetScale;
    const destOffsetY = -targetY * targetScale;

    const duration = 1200; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Cubic easing out
      const ease = 1 - Math.pow(1 - progress, 3);

      const currentScale = startScale + (targetScale - startScale) * ease;
      const currentOffsetX = startOffsetX + (destOffsetX - startOffsetX) * ease;
      const currentOffsetY = startOffsetY + (destOffsetY - startOffsetY) * ease;

      setTransform({
        scale: currentScale,
        rotation: latestTransformRef.current.rotation,
        offsetX: currentOffsetX,
        offsetY: currentOffsetY,
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, []);

  // Sync auto-follow to GPS
  useEffect(() => {
    if (autoFollowUser) {
      if (!navigator.geolocation) {
        setGpsStatusMessage('Geolocation not supported in browser');
        setAutoFollowUser(false);
        return;
      }
      setIsLocatingGps(true);
      setGpsStatusMessage('Acquiring satellite GPS fix (Auto-follow)...');
      
      autoFollowWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setIsLocatingGps(false);
          const { latitude, longitude, accuracy } = pos.coords;
          
          let cityLat = 58.3780;
          let cityLng = 26.7290;
          if (activeCity.centerCoords) {
            cityLat = activeCity.centerCoords[0];
            cityLng = activeCity.centerCoords[1];
          } else if (activeCity.centerCoordsText) {
            const match = activeCity.centerCoordsText.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/);
            if (match) {
              cityLat = parseFloat(match[1]) * (match[2] === 'S' ? -1 : 1);
              cityLng = parseFloat(match[3]) * (match[4] === 'W' ? -1 : 1);
            }
          }

          const latDiffKm = (latitude - cityLat) * 110.574;
          const lngDiffKm = (longitude - cityLng) * (111.32 * Math.cos((cityLat * Math.PI) / 180));

          const worldX = Math.round(lngDiffKm * 100);
          const worldY = Math.round(-latDiffKm * 100);

          setStoreGps({
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            timestamp: Date.now(),
          });

          // Lock viewport to location
          setTransform((prev) => ({
            ...prev,
            offsetX: -worldX * prev.scale,
            offsetY: -worldY * prev.scale,
          }));

          setGpsStatusMessage(`Auto-following GPS: ±${Math.round(accuracy)}m`);
        },
        (err) => {
          console.warn('GPS location error:', err);
          setIsLocatingGps(false);
          // Auto-follow simulated user pos
          setTransform((prev) => ({
            ...prev,
            offsetX: -simulatedUserPosRef.current.x * prev.scale,
            offsetY: -simulatedUserPosRef.current.y * prev.scale,
          }));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      if (autoFollowWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(autoFollowWatchIdRef.current);
        autoFollowWatchIdRef.current = null;
      }
      setIsLocatingGps(false);
      setGpsStatusMessage(null);
    }

    return () => {
      if (autoFollowWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(autoFollowWatchIdRef.current);
        autoFollowWatchIdRef.current = null;
      }
    };
  }, [autoFollowUser, activeCity]);

  useEffect(() => {
    localStorage.setItem('hoimu_selected_city', selectedCityId);
  }, [selectedCityId]);

  // Sync default zone name when city changes
  useEffect(() => {
    setZoneName(`${activeCity.cityName} Community Commons`);
  }, [activeCity.cityName]);

  // Pathfinder Mode State
  const [isPathfinderModalOpen, setIsPathfinderModalOpen] = useState(false);
  const [pathfinderFilter, setPathfinderFilter] = useState<PathfinderFilter>(() => {
    try {
      const saved = localStorage.getItem('hoimu_pathfinder_filter');
      return saved
        ? JSON.parse(saved)
        : {
            showWifi: true,
            showBluetooth: true,
            showLora: true,
            showTracks: true,
            onlyNewDiscoveries: false,
          };
    } catch {
      return {
        showWifi: true,
        showBluetooth: true,
        showLora: true,
        showTracks: true,
        onlyNewDiscoveries: false,
      };
    }
  });

  const [pathfinderState, setPathfinderState] = useState<PathfinderActiveState>(pathfinderScanner.getState());
  const [pathfinderWifi, setPathfinderWifi] = useState<WifiSpot[]>([]);
  const [pathfinderBle, setPathfinderBle] = useState<BluetoothSpot[]>([]);
  const [pathfinderLora, setPathfinderLora] = useState<LoraNode[]>([]);
  const [pathfinderWalks, setPathfinderWalks] = useState<WalkSession[]>([]);
  const [showPathfinderLayer, setShowPathfinderLayer] = useState(true);
  const [selectedPathfinderSpot, setSelectedPathfinderSpot] = useState<{
    type: 'wifi' | 'ble' | 'lora';
    data: any;
  } | null>(null);

  // 'Peer in range' sound & notification logic
  const alertedBlePeers = useRef<Set<string>>(new Set());

  useEffect(() => {
    let playedBeep = false;
    
    // Ignore initial mass-population
    if (alertedBlePeers.current.size === 0 && pathfinderBle.length > 0) {
      pathfinderBle.forEach(spot => alertedBlePeers.current.add(spot.address));
      return;
    }

    pathfinderBle.forEach(spot => {
      if (!alertedBlePeers.current.has(spot.address)) {
        alertedBlePeers.current.add(spot.address);
        
        // Find if this BLE spot matches a high trust peer
        const matchedPeer = peers.find(p => 
          (p.callsign === spot.deviceName || p.id === spot.deviceName || (spot.deviceName && spot.deviceName.includes(p.callsign))) && 
          p.trustScore >= 80
        );

        if (matchedPeer) {
          if (!playedBeep) {
            try {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              // Soft chime
              osc.type = 'sine';
              osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
              osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
              
              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
            } catch(e) {
              console.warn('Audio chime skipped', e);
            }
            playedBeep = true;

            // Trigger haptic feedback if within approx 50m (using RSSI > -75 as a proxy for BLE)
            if (spot.rssi > -75) {
              if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                try {
                  window.navigator.vibrate([200, 100, 200]);
                } catch(err) {}
              }
            }
          }
          
          if (onAddToast) {
            onAddToast(
              'Trusted Peer in Range',
              `${matchedPeer.callsign} has entered your immediate BLE signal radius.`,
              'info'
            );
          }
        }
      }
    });
  }, [pathfinderBle, peers, onAddToast]);

  useEffect(() => {
    localStorage.setItem('hoimu_pathfinder_filter', JSON.stringify(pathfinderFilter));
  }, [pathfinderFilter]);

  useEffect(() => {
    if (filterOnlyNew) {
      setPathfinderFilter((prev) => ({ ...prev, onlyNewDiscoveries: true }));
    }
  }, [filterOnlyNew]);

  const [autoFollowWalk, setAutoFollowWalk] = useState(true);

  useEffect(() => {
    if (pathfinderState.isRecording && autoFollowWalk && pathfinderState.currentLocation) {
      const { latitude, longitude } = pathfinderState.currentLocation;
      let cityLat = 58.3780;
      let cityLng = 26.7290;
      if (activeCity.centerCoords) {
        cityLat = activeCity.centerCoords[0];
        cityLng = activeCity.centerCoords[1];
      }
      const latDiffKm = (latitude - cityLat) * 110.574;
      const lngDiffKm = (longitude - cityLng) * (111.32 * Math.cos((cityLat * Math.PI) / 180));
      const worldX = Math.round(lngDiffKm * 100);
      const worldY = Math.round(-latDiffKm * 100);

      setTransform((prev) => ({
        ...prev,
        offsetX: -worldX * prev.scale,
        offsetY: -worldY * prev.scale,
      }));
    }
  }, [pathfinderState.currentLocation, pathfinderState.isRecording, autoFollowWalk, activeCity]);

  useEffect(() => {
    initPathfinderDB().then((data) => {
      setPathfinderWifi(data.wifi);
      setPathfinderBle(data.ble);
      setPathfinderLora(data.lora);
      setPathfinderWalks(data.walks);
    });

    const unsub = pathfinderScanner.subscribe((st) => {
      setPathfinderState(st);
      const data = getLoadedPathfinderData();
      setPathfinderWifi(data.wifi);
      setPathfinderBle(data.ble);
      setPathfinderLora(data.lora);
      setPathfinderWalks(data.walks);
    });

    return unsub;
  }, []);

  // Geometric calculations for perimeter
  const perimeterLengthKm = calculatePerimeterLength(perimeterPoints, isPerimeterClosed);
  const polygonArea = calculatePolygonArea(perimeterPoints);

  // Save to IndexedDB cache whenever closed polygon changes
  useEffect(() => {
    if (isPerimeterClosed && perimeterPoints.length >= 3) {
      saveCustomPerimeter({
        id: `zone_${selectedCityId}`,
        name: zoneName,
        points: perimeterPoints,
        color: '#2A9D8F',
        createdAt: Date.now(),
      });
    }
  }, [isPerimeterClosed, perimeterPoints, selectedCityId, zoneName]);

  const categories: { id: 'all' | ResourceCategory; label: string; icon: any; color: string }[] = [
    { id: 'all', label: 'All Assets', icon: Layers, color: '#2A9D8F' },
    { id: 'Energy', label: 'Energy', icon: Zap, color: '#F4A261' },
    { id: 'Tools', label: 'Tools', icon: Wrench, color: '#2A9D8F' },
    { id: 'Food', label: 'Food', icon: Wheat, color: '#87A878' },
    { id: 'Skills', label: 'Skills', icon: GraduationCap, color: '#E9C46A' },
    { id: 'Care & Housing', label: 'Care & Housing', icon: Home, color: '#588157' },
    { id: 'Bio-Remedy', label: 'Bio-Remedy', icon: HeartPulse, color: '#E76F51' },
    { id: 'Electronics', label: 'Electronics', icon: Radio, color: '#6366F1' },
  ];

  // Load custom POIs on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hoimu_custom_pois');
      if (saved) {
        const customPois = JSON.parse(saved) as Record<string, SurvivalPoi[]>;
        Object.keys(customPois).forEach(cityId => {
          const map = CITY_MAPS[cityId];
          if (map) {
            if (!map.survivalPois) map.survivalPois = [];
            // Merge custom POIs, preventing duplicates
            const existingIds = new Set(map.survivalPois.map(p => p.id));
            customPois[cityId].forEach(poi => {
              if (!existingIds.has(poi.id)) {
                map.survivalPois!.push(poi);
              }
            });
          }
        });
      }
    } catch (e) {
      console.error('Failed to load custom POIs', e);
    }
  }, []);

  const handleSelectNode = (peer: MeshNode) => {
    setSelectedPeer(peer);
    setSelectedResource(null);
    if (peer.angle !== undefined && peer.distanceRatio !== undefined) {
      const rad = (peer.angle * Math.PI) / 180;
      const dist = peer.distanceRatio * 180;
      const px = Math.cos(rad) * dist;
      const py = Math.sin(rad) * dist;
      animateMapTo(px, py, 1.5);
    }
  };

  const handleSelectResource = (resource: ResourceItem) => {
    setSelectedResource(resource);
    const owner = peers.find((p) => p.id === resource.ownerId);
    if (owner) {
      setSelectedPeer(owner);
      if (owner.angle !== undefined && owner.distanceRatio !== undefined) {
        const rad = (owner.angle * Math.PI) / 180;
        const dist = owner.distanceRatio * 180;
        const px = Math.cos(rad) * dist;
        const py = Math.sin(rad) * dist;
        animateMapTo(px, py, 1.5);
      }
    }
  };

  const togglePoiCategory = (cat: SurvivalPoiCategory) => {
    setVisiblePoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Listen for Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Recalculate offline vector route whenever start, destination, or active city changes
  useEffect(() => {
    if (routeStart && routeDestination) {
      const streets = activeCity.streets || [];
      const result = planOfflineRoute(streets, routeStart, routeDestination);
      setRouteResult(result);
    } else {
      setRouteResult(null);
    }
  }, [routeStart, routeDestination, activeCity]);

  const handleMapRouteClick = useCallback((worldPos: { x: number; y: number }) => {
    if (isSelectingWayPoint === 'start' || (!routeStart && !routeDestination)) {
      setRouteStart({
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        label: `Koordinaat (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`,
      });
      setIsSelectingWayPoint('destination');
    } else {
      setRouteDestination({
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        label: `Koordinaat (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`,
      });
      setIsSelectingWayPoint(null);
    }
  }, [isSelectingWayPoint, routeStart, routeDestination]);

  const handleClearRoute = useCallback(() => {
    setRouteStart(null);
    setRouteDestination(null);
    setRouteResult(null);
    setIsSelectingWayPoint(null);
  }, []);

  const handleReverseRoute = useCallback(() => {
    if (routeStart && routeDestination) {
      const temp = routeStart;
      setRouteStart(routeDestination);
      setRouteDestination(temp);
    }
  }, [routeStart, routeDestination]);

  const handleSetRouteStart = useCallback((pos: { x: number; y: number; label?: string }) => {
    setRouteStart(pos);
    if (!isRouteMode) setIsRouteMode(true);
  }, [isRouteMode]);

  const handleSetRouteDestination = useCallback((pos: { x: number; y: number; label?: string }) => {
    setRouteDestination(pos);
    if (!isRouteMode) setIsRouteMode(true);
  }, [isRouteMode]);

  const handleRulerClick = useCallback((worldPos: { x: number; y: number }) => {
    setRulerPoints((prev) => {
      if (prev.length === 0 || prev.length === 2) {
        return [worldPos]; // Start new line
      } else {
        setIsRulerMode(false);
        return [prev[0], worldPos]; // Finish line
      }
    });
  }, []);

  const handleLongPress = useCallback((worldPos: { x: number; y: number }) => {
    if (isRulerMode || isPlacingPerimeterMarker) return;
    
    const newPoiId = `custom-poi-${Date.now()}`;
    const newPoi: SurvivalPoi = {
      id: newPoiId,
      name: 'Custom Survival POI',
      category: 'Tools',
      x: worldPos.x,
      y: worldPos.y,
      description: 'User created POI. Update required.',
    };

    const activeMap = CITY_MAPS[selectedCityId];
    if (activeMap) {
      if (!activeMap.survivalPois) activeMap.survivalPois = [];
      activeMap.survivalPois.push(newPoi);
      
      // Save to localStorage for persistence
      try {
        const saved = localStorage.getItem('hoimu_custom_pois');
        const customPois = saved ? JSON.parse(saved) : {};
        if (!customPois[selectedCityId]) customPois[selectedCityId] = [];
        customPois[selectedCityId].push(newPoi);
        localStorage.setItem('hoimu_custom_pois', JSON.stringify(customPois));
      } catch (e) {
        console.error('Failed to save custom POI', e);
      }

      setSelectedResource({
        id: newPoi.id,
        title: newPoi.name,
        category: 'Hardware',
        ownerId: 'system',
        ownerCallsign: 'City Infrastructure',
        description: newPoi.description || 'Public survival point of interest.',
        availabilityText: 'Public Access',
      } as any);
    }
  }, [isRulerMode, isPlacingPerimeterMarker, selectedCityId]);

  const handleUpdatePoi = useCallback((poiId: string, updates: Partial<SurvivalPoi>) => {
    const activeMap = CITY_MAPS[selectedCityId];
    if (activeMap && activeMap.survivalPois) {
      const index = activeMap.survivalPois.findIndex(p => p.id === poiId);
      if (index !== -1) {
        activeMap.survivalPois[index] = { ...activeMap.survivalPois[index], ...updates };
        
        try {
          const saved = localStorage.getItem('hoimu_custom_pois');
          const customPois = saved ? JSON.parse(saved) : {};
          if (customPois[selectedCityId]) {
            const lsIndex = customPois[selectedCityId].findIndex((p: any) => p.id === poiId);
            if (lsIndex !== -1) {
              customPois[selectedCityId][lsIndex] = { ...customPois[selectedCityId][lsIndex], ...updates };
              localStorage.setItem('hoimu_custom_pois', JSON.stringify(customPois));
            }
          }
        } catch (e) {
          console.error('Failed to update custom POI in localStorage', e);
        }
      }
    }
  }, [selectedCityId]);

  const handleDeletePoi = useCallback((poiId: string) => {
    const activeMap = CITY_MAPS[selectedCityId];
    if (activeMap && activeMap.survivalPois) {
      activeMap.survivalPois = activeMap.survivalPois.filter(p => p.id !== poiId);
      
      try {
        const saved = localStorage.getItem('hoimu_custom_pois');
        const customPois = saved ? JSON.parse(saved) : {};
        if (customPois[selectedCityId]) {
          customPois[selectedCityId] = customPois[selectedCityId].filter((p: any) => p.id !== poiId);
          localStorage.setItem('hoimu_custom_pois', JSON.stringify(customPois));
        }
      } catch (e) {
        console.error('Failed to delete custom POI from localStorage', e);
      }
    }
  }, [selectedCityId]);

  // Map Controls Helpers
  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(5.0, prev.scale * 1.25) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(0.4, prev.scale * 0.8) }));
  }, []);

  const handleResetView = useCallback(() => {
    setTransform({ scale: 1.0, rotation: 0, offsetX: 0, offsetY: 0 });
  }, []);

  const handleResetNorth = useCallback(() => {
    setTransform((prev) => ({ ...prev, rotation: 0 }));
  }, []);

  const handleRotateCw = useCallback(() => {
    setTransform((prev) => ({ ...prev, rotation: prev.rotation + Math.PI / 4 }));
  }, []);

  const handleRotateCcw = useCallback(() => {
    setTransform((prev) => ({ ...prev, rotation: prev.rotation - Math.PI / 4 }));
  }, []);

  // Map Container & Gesture References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapDragStartRef = useRef<{ x: number; y: number; initialOffsetX: number; initialOffsetY: number } | null>(null);
  const touchPinchStartRef = useRef<{
    initialDist: number;
    initialAngle: number;
    initialScale: number;
    initialRotation: number;
    pinnedGeoX: number;
    pinnedGeoY: number;
  } | null>(null);

  // Kinetic Scrolling (Inertia) Physics Engine in MapViewTab
  const kineticInertiaRafRef = useRef<number | null>(null);
  const mapVelocityHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);

  const stopKineticScrolling = useCallback(() => {
    if (kineticInertiaRafRef.current !== null) {
      cancelAnimationFrame(kineticInertiaRafRef.current);
      kineticInertiaRafRef.current = null;
    }
  }, []);

  /**
   * When a user releases their finger after panning the map, apply a velocity decay calculation
   * to the offsetX and offsetY values so the map slides naturally before coming to a stop.
   */
  const startKineticScrolling = useCallback(
    (initialVx: number, initialVy: number) => {
      stopKineticScrolling();

      // Accessibility: Respect prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        return;
      }

      let vx = initialVx;
      let vy = initialVy;
      let lastTime = performance.now();
      const friction = 0.942; // Deceleration decay factor per 16.67ms frame

      const kineticStep = (now: number) => {
        const elapsed = Math.min(now - lastTime, 48);
        lastTime = now;

        const frameFactor = elapsed / 16.67;
        const decay = Math.pow(friction, frameFactor);

        // Velocity decay calculation applied to velocities
        vx *= decay;
        vy *= decay;

        const dx = vx * elapsed;
        const dy = vy * elapsed;

        // Natural stop threshold when speed decays below minimum threshold
        if (Math.hypot(vx, vy) < 0.02) {
          kineticInertiaRafRef.current = null;
          return;
        }

        // Apply decay displacement to offsetX and offsetY
        setTransform((prev) => ({
          ...prev,
          offsetX: prev.offsetX + dx,
          offsetY: prev.offsetY + dy,
        }));

        kineticInertiaRafRef.current = requestAnimationFrame(kineticStep);
      };

      kineticInertiaRafRef.current = requestAnimationFrame(kineticStep);
    },
    [stopKineticScrolling]
  );

  // Cleanup kinetic inertia animation on unmount
  useEffect(() => {
    return () => {
      stopKineticScrolling();
    };
  }, [stopKineticScrolling]);

  /**
   * Refine the pinch-zoom gesture logic in MapViewTab.
   * Calculate the geographic coordinate currently centered between the user's two fingers.
   */
  const calculateGeographicCentroid = useCallback(
    (
      touch1: { clientX: number; clientY: number },
      touch2: { clientX: number; clientY: number },
      containerRect: DOMRect,
      currentTransform: MapTransform
    ) => {
      const focalScreenX = (touch1.clientX + touch2.clientX) / 2 - containerRect.left;
      const focalScreenY = (touch1.clientY + touch2.clientY) / 2 - containerRect.top;

      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // Project into world / geographic coordinate space
      const dx = focalScreenX - (centerX + currentTransform.offsetX);
      const dy = focalScreenY - (centerY + currentTransform.offsetY);
      const unscaledX = dx / currentTransform.scale;
      const unscaledY = dy / currentTransform.scale;

      const cosR = Math.cos(-currentTransform.rotation);
      const sinR = Math.sin(-currentTransform.rotation);

      // Invariant geographic coordinate centered under user's two fingers
      const geoX = unscaledX * cosR - unscaledY * sinR;
      const geoY = unscaledX * sinR + unscaledY * cosR;

      return { focalScreenX, focalScreenY, geoX, geoY };
    },
    []
  );

  /**
   * During the zoom scale update, adjust the map's offset so that this specific
   * coordinate remains pinned under the user's fingers, preventing the map from jumping.
   */
  const updatePinchZoom = useCallback(
    (
      touch1: { clientX: number; clientY: number },
      touch2: { clientX: number; clientY: number },
      containerRect: DOMRect,
      initialTouch: {
        initialDist: number;
        initialAngle: number;
        initialScale: number;
        initialRotation: number;
        pinnedGeoX: number;
        pinnedGeoY: number;
      }
    ) => {
      const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const currentAngle = Math.atan2(touch1.clientY - touch2.clientY, touch1.clientX - touch2.clientX);

      const currentFocalX = (touch1.clientX + touch2.clientX) / 2 - containerRect.left;
      const currentFocalY = (touch1.clientY + touch2.clientY) / 2 - containerRect.top;

      const scaleMultiplier = currentDist / initialTouch.initialDist;
      const angleDelta = currentAngle - initialTouch.initialAngle;

      const newScale = Math.min(5.0, Math.max(0.4, initialTouch.initialScale * scaleMultiplier));
      const newRotation = initialTouch.initialRotation + angleDelta;

      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      const cosRot = Math.cos(newRotation);
      const sinRot = Math.sin(newRotation);

      // Rotated and scaled geographic coordinate in new transform
      const rotGeoX = (initialTouch.pinnedGeoX * cosRot - initialTouch.pinnedGeoY * sinRot) * newScale;
      const rotGeoY = (initialTouch.pinnedGeoX * sinRot + initialTouch.pinnedGeoY * cosRot) * newScale;

      // Adjust map offset so the specific coordinate remains pinned under the user's fingers
      const newOffsetX = currentFocalX - centerX - rotGeoX;
      const newOffsetY = currentFocalY - centerY - rotGeoY;

      setTransform({
        scale: newScale,
        rotation: newRotation,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    },
    []
  );

  // Map container touch gesture event handlers
  const handleMapTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    stopKineticScrolling();
    setAutoFollowUser(false); // Cancel auto-follow on manual pan
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      mapDragStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        initialOffsetX: transform.offsetX,
        initialOffsetY: transform.offsetY,
      };
      mapVelocityHistoryRef.current = [{ x: t.clientX, y: t.clientY, time: performance.now() }];
      touchPinchStartRef.current = null;
    } else if (e.touches.length === 2) {
      mapDragStartRef.current = null;
      mapVelocityHistoryRef.current = [];

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const initialDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const initialAngle = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX);

      // Calculate the geographic coordinate currently centered between the user's two fingers
      const { geoX, geoY } = calculateGeographicCentroid(t1, t2, rect, transform);

      touchPinchStartRef.current = {
        initialDist,
        initialAngle,
        initialScale: transform.scale,
        initialRotation: transform.rotation,
        pinnedGeoX: geoX,
        pinnedGeoY: geoY,
      };
    }
  };

  const handleMapTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (e.touches.length === 1 && mapDragStartRef.current) {
      const t = e.touches[0];
      const now = performance.now();
      const dx = t.clientX - mapDragStartRef.current.x;
      const dy = t.clientY - mapDragStartRef.current.y;

      mapVelocityHistoryRef.current.push({ x: t.clientX, y: t.clientY, time: now });
      if (mapVelocityHistoryRef.current.length > 8) mapVelocityHistoryRef.current.shift();
      mapVelocityHistoryRef.current = mapVelocityHistoryRef.current.filter((p) => now - p.time <= 90);

      setTransform((prev) => ({
        ...prev,
        offsetX: mapDragStartRef.current!.initialOffsetX + dx,
        offsetY: mapDragStartRef.current!.initialOffsetY + dy,
      }));
    } else if (e.touches.length === 2 && touchPinchStartRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      updatePinchZoom(t1, t2, rect, touchPinchStartRef.current);
    }
  };

  const handleMapTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      mapDragStartRef.current = null;
      touchPinchStartRef.current = null;

      // When user releases finger after panning the map, apply velocity decay calculation
      const history = mapVelocityHistoryRef.current;
      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const dt = newest.time - oldest.time;
        const timeSinceLastMove = performance.now() - newest.time;

        if (dt > 12 && timeSinceLastMove < 80) {
          const rawVx = (newest.x - oldest.x) / dt;
          const rawVy = (newest.y - oldest.y) / dt;
          const speed = Math.hypot(rawVx, rawVy);

          if (speed > 0.12) {
            const maxSpeed = 2.6; // Max clamp for natural feel
            const scale = speed > maxSpeed ? maxSpeed / speed : 1.0;
            startKineticScrolling(rawVx * scale, rawVy * scale);
          }
        }
      }
      mapVelocityHistoryRef.current = [];
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      mapDragStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        initialOffsetX: transform.offsetX,
        initialOffsetY: transform.offsetY,
      };
      touchPinchStartRef.current = null;
      mapVelocityHistoryRef.current = [{ x: t.clientX, y: t.clientY, time: performance.now() }];
    }
  };

  const handleUndoPoint = () => {
    setPerimeterPoints((prev) => {
      const updated = prev.slice(0, -1);
      if (updated.length < 3) setIsPerimeterClosed(false);
      return updated;
    });
  };

  const handleCloseLoop = () => {
    if (perimeterPoints.length >= 3) {
      setIsPerimeterClosed(true);
      setIsPlacingPerimeterMarker(false);
    }
  };

  const handleClearPerimeter = () => {
    setPerimeterPoints([]);
    setIsPerimeterClosed(false);
  };

  // Geolocation trigger
  const handleLocateMe = () => {
    setAutoFollowUser((prev) => !prev);
  };

  // Center on My Node (Auto-zoom & pan directly to user's GPS / local transceiver node)
  const handleCenterOnMyNode = useCallback(() => {
    setIsLocatingGps(true);
    setGpsStatusMessage('Otsin GPS asukohta ja tsentreerin sõlmele...');

    const targetScale = 1.6; // High-precision zoom for field movement

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocatingGps(false);
          const { latitude, longitude, accuracy } = pos.coords;

          let cityLat = 58.3780;
          let cityLng = 26.7290;
          if (activeCity.centerCoords) {
            cityLat = activeCity.centerCoords[0];
            cityLng = activeCity.centerCoords[1];
          } else if (activeCity.centerCoordsText) {
            const match = activeCity.centerCoordsText.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/);
            if (match) {
              cityLat = parseFloat(match[1]) * (match[2] === 'S' ? -1 : 1);
              cityLng = parseFloat(match[3]) * (match[4] === 'W' ? -1 : 1);
            }
          }

          const latDiffKm = (latitude - cityLat) * 110.574;
          const lngDiffKm = (longitude - cityLng) * (111.32 * Math.cos((cityLat * Math.PI) / 180));

          const worldX = Math.round(lngDiffKm * 100);
          const worldY = Math.round(-latDiffKm * 100);

          setStoreGps({
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            timestamp: Date.now(),
          });

          // Zoom and center directly on GPS position with beautiful smooth glide animation
          animateMapTo(worldX, worldY, targetScale);
          
          setGpsStatusMessage(`Tsentreeritud GPS sõlmele (±${Math.round(accuracy)}m)`);
          setTimeout(() => setGpsStatusMessage(null), 3500);
        },
        (err) => {
          console.warn('GPS single fix error, falling back to node position:', err);
          setIsLocatingGps(false);
          const posX = gpsPosition ? gpsPosition.x : simulatedUserPosRef.current.x;
          const posY = gpsPosition ? gpsPosition.y : simulatedUserPosRef.current.y;
          animateMapTo(posX, posY, targetScale);
          setGpsStatusMessage('Tsentreeritud kohalikule raadiosõlmele');
          setTimeout(() => setGpsStatusMessage(null), 3500);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      );
    } else {
      setIsLocatingGps(false);
      const posX = gpsPosition ? gpsPosition.x : simulatedUserPosRef.current.x;
      const posY = gpsPosition ? gpsPosition.y : simulatedUserPosRef.current.y;
      animateMapTo(posX, posY, targetScale);
      setGpsStatusMessage('Tsentreeritud kohalikule raadiosõlmele');
      setTimeout(() => setGpsStatusMessage(null), 3500);
    }
  }, [activeCity, gpsPosition, animateMapTo]);

  // Keyboard Shortcuts for map navigation and perimeter undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetView();
      } else if (e.key === '1') {
        setActiveMapLayer('Terrain');
      } else if (e.key === '2') {
        setActiveMapLayer('Community Infrastructure');
      } else if (e.key === '3') {
        setActiveMapLayer('Mesh Coverage');
      } else if (e.key === 'n' || e.key === 'N') {
        handleResetNorth();
      } else if (e.key === 'c' || e.key === 'C') {
        handleCenterOnMyNode();
      } else if (e.key === 'f' || e.key === 'F') {
        handleLocateMe();
      } else if (e.key === 'm' || e.key === 'M') {
        // Find nearest peer and open chat
        const pos = gpsPosition ? gpsPosition : simulatedUserPosRef.current;
        let nearestPeer = null;
        let minDistance = Infinity;
        peers.forEach(peer => {
          const dx = peer.distanceRatio * 500 - pos.x; // Approx using distance ratio if true coords aren't available, but we don't have true coords on peer here easily. We'll use the radar distance ratio.
          if (peer.distanceRatio < minDistance) {
            minDistance = peer.distanceRatio;
            nearestPeer = peer;
          }
        });
        if (nearestPeer) {
          onOpenChatWithPeer(nearestPeer);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey) {
          handleRotateCcw();
        } else {
          handleRotateCw();
        }
      } else if (e.key === 'Escape') {
        if (isPlacingPerimeterMarker) setIsPlacingPerimeterMarker(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (perimeterPoints.length > 0) {
          e.preventDefault();
          handleUndoPoint();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    perimeterPoints,
    isPlacingPerimeterMarker,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleResetNorth,
    handleCenterOnMyNode,
    handleRotateCw,
    handleRotateCcw,
  ]);

  // Import token handler
  const handleApplyImportToken = () => {
    setImportError(null);
    if (!importTokenInput.trim()) {
      setImportError('Please paste a valid HOIMU token string.');
      return;
    }

    const decoded = decodePerimeterToken(importTokenInput.trim());
    if (!decoded || !Array.isArray(decoded.points) || decoded.points.length < 3) {
      setImportError('Invalid or corrupted token. Requires at least 3 perimeter vertices.');
      return;
    }

    setZoneName(decoded.name || `${activeCity.cityName} Zone`);
    setPerimeterPoints(decoded.points);
    setIsPerimeterClosed(true);
    setIsImportModalOpen(false);
    setImportTokenInput('');

    // Center map around the imported polygon center
    const avgX = decoded.points.reduce((acc, p) => acc + p[0], 0) / decoded.points.length;
    const avgY = decoded.points.reduce((acc, p) => acc + p[1], 0) / decoded.points.length;
    setTransform((prev) => ({
      ...prev,
      offsetX: -avgX * prev.scale,
      offsetY: -avgY * prev.scale,
    }));
  };

  // Density Calculation Stats
  const activeResourceCount = resources.filter((r) => r.isActive).length;

  // Layer & Category Visibility Effective States for Map Markers
  const isPeersVisible = activeLayers?.peers !== undefined ? (activeLayers.peers && showMeshNodes) : showMeshNodes;
  const isHeatmapVisible = activeLayers?.heatmap !== undefined ? (activeLayers.heatmap && showDensityHeatmap) : showDensityHeatmap;
  const isTerrainVisible = activeLayers?.terrain !== undefined ? activeLayers.terrain : true;

  const effectiveShowMeshLinks = !isPeersVisible ? false : (activeMapLayer === 'Terrain' ? false : showMeshLinks);
  const effectiveShowDensityHeatmap = !isHeatmapVisible ? false : (activeMapLayer === 'Mesh Coverage' ? false : (activeMapLayer === 'Terrain' ? false : showDensityHeatmap));
  const effectiveShowSignalHeatmap = !isPeersVisible ? false : (activeMapLayer === 'Terrain' ? false : showSignalHeatmap);
  const effectiveShowCachedZones = !isTerrainVisible ? false : (!isPeersVisible ? false : (activeMapLayer === 'Terrain' ? false : showCachedZones));

  const storePeers = useMeshStore(selectPeersArray);
  const stablePeers = peers && peers.length > 0 ? peers : storePeers;

  const effectivePeers = useMemo(() => {
    return isPeersVisible ? stablePeers : [];
  }, [isPeersVisible, stablePeers]);
  const effectiveResources = useMemo(() => {
    if (activeLayers?.resources === false) return [];
    return resources.filter((r) => visibleCategories.has(r.category));
  }, [resources, visibleCategories, activeLayers?.resources]);

  return (
    <React.Suspense fallback={<MapSkeleton isNightMode={isNightMode} />}>
      <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] text-xs font-semibold border border-[#2A9D8F]/30 mb-1">
            <Compass className="w-3.5 h-3.5" />
            Bioregional Geographic Grid • {activeCity.cityName}
          </div>
          <h2
            className={`font-display font-bold text-2xl ${
              isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
            }`}
          >
            Spatial Asset Density & Mesh Topography
          </h2>
          <p className="text-xs text-[#588157]">
            Visualizes real-time physical distribution of mutual aid resources and peer nodes over offline vector maps of {activeCity.cityName}, {activeCity.country}.
          </p>
        </div>

        {/* Quick Density KPI, City Selector, Route Mode, Pathfinder Mode & Fullscreen Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPathfinderModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              pathfinderState.isRecording
                ? 'bg-[#E76F51] border-[#E76F51] text-white shadow-[#E76F51]/30 shadow-md animate-pulse'
                : isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
            title="HÕIMU Pathfinder Mode – Kaasaskantavus, eetriardumine (WiFi, BLE, LoRa) ja kõnnirajad"
          >
            <Footprints className="w-4 h-4 text-[#E76F51]" />
            <span>
              {pathfinderState.isRecording
                ? `Pathfinder (${(pathfinderState.totalDistanceMeters / 1000).toFixed(1)}km)`
                : 'Pathfinder Mode'}
            </span>
            {pathfinderFilter.onlyNewDiscoveries && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#E9C46A] text-[#203A2A] rounded-full">
                Uued
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isFullscreen
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-md'
                : isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
            title={isFullscreen ? 'Välju täisekraanist (ESC)' : 'Täisekraan (Full Screen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-[#588157]" />}
            <span>{isFullscreen ? 'Välju täisekraanist' : 'Täisekraan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRouteMode(!isRouteMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isRouteMode
                ? 'bg-[#E76F51] border-[#E76F51] text-white shadow-[#E76F51]/30 shadow-md'
                : isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
            title="Teekonna planeerimine tänavavõrgus (Offline Street Routing)"
          >
            <RouteIcon className="w-4 h-4 text-[#E76F51] group-hover:rotate-12 transition-transform" />
            <span>Teekond</span>
          </button>

          {/* Display Mode Switcher: Visual Map vs Rogue-like Terminal Mode */}
          <div className="flex border rounded-2xl p-1 bg-black/10 dark:bg-white/5 border-current/20 shadow-xs">
            <button
              type="button"
              onClick={() => setMapDisplayMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mapDisplayMode === 'visual'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Visual Map</span>
            </button>
            <button
              type="button"
              onClick={() => setMapDisplayMode('terminal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mapDisplayMode === 'terminal'
                  ? 'bg-[#33ff00] text-black shadow-xs font-mono font-black'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal Mode</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOfflineDownloadOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#2A9D8F] hover:border-[#2A9D8F]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#2A9D8F] hover:bg-white'
            }`}
            title="Download Offline Region (Laadi maastiku ja sõlmede andmepakett võrguühenduseta kasutusse)"
          >
            <FolderDown className="w-4 h-4 text-[#2A9D8F]" />
            <span>Võrguühenduseta pakett</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCityModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE] hover:border-[#87A878]'
                : 'bg-[#F0F5EE] border-[#87A878]/50 text-[#203A2A] hover:bg-white'
            }`}
          >
            <Building className="w-4 h-4 text-[#2A9D8F]" />
            <span>Map: {activeCity.cityName}</span>
          </button>

          <div
            className={`flex items-center gap-3 p-2.5 px-3.5 rounded-2xl border ${
              isNightMode ? 'bg-[#223120] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/35'
            }`}
          >
            <div className="text-right">
              <span className="text-[10px] font-medium text-[#637062] block">Mesh Asset Density</span>
              <span className="text-xs font-mono font-bold text-[#E9C46A]">
                {activeResourceCount} Assets / {showMeshNodes ? `${peers.length} Nodes` : 'Nodes Hidden'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 flex items-center justify-center border border-[#E9C46A]/40">
              <Flame className="w-4 h-4 text-[#E9C46A]" />
            </div>
          </div>
        </div>
      </div>

      {/* Layer Controls Bar & Category Filter Strip */}
      <div
        className={`p-4 rounded-3xl border shadow-xs space-y-3 transition-colors ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        {/* Dead Reckoning Active Banner */}
        {deadReckoningState.isActive && (
          <div className="p-3.5 rounded-2xl bg-[#E76F51]/10 dark:bg-[#E76F51]/20 border border-[#E76F51]/40 flex flex-wrap items-center justify-between gap-3 text-xs transition-all shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51] animate-ping inline-block" />
              <div>
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE] uppercase tracking-wider flex items-center gap-2">
                  <span>⚠️ Dead Reckoning Active</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[#E76F51]/20 text-[#E76F51] font-mono">
                    {deadReckoningState.reason === 'low_accuracy' ? `Degraded GPS ±${deadReckoningState.lastGpsAccuracy}m` : 'GPS Signal Lost (>10s)'}
                  </span>
                </span>
                <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                  Indoors / Canopy position estimated via Accelerometer & Compass Heading
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 font-bold border border-current/10">
                  Confidence: <strong className={deadReckoningState.confidencePercent < 50 ? 'text-[#E76F51]' : 'text-[#2A9D8F]'}>{deadReckoningState.confidencePercent}%</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 font-bold border border-current/10">
                  Est. Drift: <strong>±{deadReckoningState.driftEstimateMeters.toFixed(1)}m</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 font-bold border border-current/10">
                  Steps: <strong>{deadReckoningState.stepCount}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => deadReckoningService.simulateStep(20, deadReckoningState.headingDegrees, 0.75)}
                  className="px-3 py-1.5 rounded-xl bg-[#588157] text-white font-bold text-[11px] hover:bg-[#466845] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Simulate walking 20 steps indoors without GPS"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Walk 20 Steps (Test)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const userPos = gpsPosition ? { x: gpsPosition.x, y: gpsPosition.y } : simulatedUserPos;
                    const geoPoint = localGridToGeoPoint(userPos.x, userPos.y, activeCity.centerCoordsText);
                    deadReckoningService.manualResetPosition(geoPoint.latitude, geoPoint.longitude, userPos.x, userPos.y);
                    if (onAddToast) {
                      onAddToast('📍 Asukoht Lähtestatud', 'Dead reckoning asukoht korrigeeritud ja triiv eemaldatud.', 'success');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#2A9D8F] text-white font-bold text-[11px] hover:bg-[#238276] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>"I Am Here" (Reset)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Layer Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold flex items-center gap-1.5 text-[#588157]">
              <Layers className="w-3.5 h-3.5" />
              Active Map Layers:
            </span>

            {/* Toggle Mesh Nodes Checkbox */}
            <label
              htmlFor="toggle-mesh-nodes-checkbox"
              id="toggle-mesh-nodes-label"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer select-none transition-all shadow-xs ${
                showMeshNodes
                  ? isNightMode
                    ? 'bg-[#182315] text-[#F0F5EE] border-[#588157] ring-1 ring-[#588157]/30'
                    : 'bg-white text-[#203A2A] border-[#588157] ring-1 ring-[#588157]/20 shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315]/70 text-[#A8BDA5] border-[#364E30]'
                  : 'bg-white/80 text-[#637062] border-[#87A878]/40'
              }`}
              title="Toggle Mesh Nodes: Filter between 'Resource Only' and 'Full View' (resources + peer node locations)"
            >
              <input
                id="toggle-mesh-nodes-checkbox"
                type="checkbox"
                checked={showMeshNodes}
                onChange={(e) => setShowMeshNodes(e.target.checked)}
                className="w-4 h-4 rounded text-[#588157] focus:ring-[#588157] accent-[#588157] cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <span className="text-[#203A2A] dark:text-[#F0F5EE]">Toggle Mesh Nodes:</span>
                <span
                  className={`font-bold ${
                    showMeshNodes ? 'text-[#588157] dark:text-[#E9C46A]' : 'text-[#E76F51]'
                  }`}
                >
                  {showMeshNodes ? 'Full View' : 'Resource Only'}
                </span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] hidden sm:inline">
                  {showMeshNodes ? `(${peers.length} nodes)` : '(assets only)'}
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Walk to Reveal Toggle Button */}
            <button
              id="toggle-walk-to-reveal-btn"
              type="button"
              onClick={() => setIsWalkToRevealEnabled(!isWalkToRevealEnabled)}
              title="Walk to Reveal: Kaart algab udusena (fog of war) - ainult kasutaja lähiala on nähtav."
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isWalkToRevealEnabled
                  ? 'bg-[#E76F51] text-white border-[#E76F51] shadow-xs animate-pulse'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>{isWalkToRevealEnabled ? 'Walk to Reveal: SEES' : 'Walk to Reveal'}</span>
            </button>

            {/* Main Map Rendering Layers */}
            <div className="flex border rounded-xl overflow-hidden shadow-xs ml-2" role="group" aria-label="Map Base Layer Selection">
              {(['Terrain', 'Community Infrastructure', 'Mesh Coverage'] as const).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  aria-pressed={activeMapLayer === layer}
                  aria-label={`Switch base map layer to ${layer}`}
                  onClick={() => setActiveMapLayer(layer)}
                  className={`px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    activeMapLayer === layer
                      ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                      : isNightMode
                      ? 'bg-[#182315] text-[#A8BDA5] hover:bg-[#2A3B26]'
                      : 'bg-white text-[#637062] hover:bg-gray-50'
                  } border-r border-current/10 last:border-r-0`}
                >
                  {layer}
                </button>
              ))}
            </div>

            {/* Screen Reader Accessible Map Summary */}
            <div className="sr-only" id="sr-map-summary" aria-live="polite">
              {`Map showing ${resources.length} resources, ${peers.length} peers, and active ${activeMapLayer} layer.`}
            </div>

            {/* Pathfinder Hotspots & Tracks Layer Toggle */}
            <button
              id="toggle-pathfinder-layer-btn"
              type="button"
              aria-pressed={showPathfinderLayer}
              onClick={() => setShowPathfinderLayer(!showPathfinderLayer)}
              title="Pathfinder kiht: WiFi, Bluetooth ja LoRa kuumpunktid ning GPS teekonnad"
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showPathfinderLayer
                  ? 'bg-[#E76F51] text-white border-[#E76F51] shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Radio className="w-3 h-3 text-[#E9C46A]" />
              <span>{showPathfinderLayer ? 'Pathfinder Kiht: SEES' : 'Pathfinder Kiht'}</span>
            </button>

            {/* Nearby Aid Clusters Layer Toggle */}
            <button
              id="toggle-nearby-aid-overlay-btn"
              type="button"
              aria-pressed={showNearbyAidOverlay}
              onClick={() => setShowNearbyAidOverlay(!showNearbyAidOverlay)}
              title="Nearby Aid Clusters: Grupeerib läheduses asuvad kogukonna ressursid ja pakub geograafilist ülevaadet"
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showNearbyAidOverlay
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{showNearbyAidOverlay ? 'Aid Clusters: SEES' : 'Aid Clusters'}</span>
            </button>

            <button
              type="button"
              aria-pressed={showMeshLinks}
              onClick={() => setShowMeshLinks(!showMeshLinks)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer ${
                showMeshLinks
                  ? 'bg-[#588157] text-white border-[#588157]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              Mesh RF Links
            </button>

            <button
              type="button"
              aria-pressed={showDensityHeatmap}
              onClick={() => setShowDensityHeatmap(!showDensityHeatmap)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer ${
                showDensityHeatmap
                  ? 'bg-[#E9C46A] text-[#243128] border-[#E9C46A]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              Asset Density Glow
            </button>

            {/* RSSI Signal Strength Heatmap Toggle */}
            <button
              id="toggle-signal-heatmap-btn"
              type="button"
              aria-pressed={showSignalHeatmap}
              onClick={() => setShowSignalHeatmap(!showSignalHeatmap)}
              title="Signaalitugevuse soojuskaart: Visualiseerib võrgusõlmede RSSI leviulatuse ja leviala tugevuse"
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showSignalHeatmap
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Signal className="w-3 h-3 text-[#E9C46A]" />
              <span>{showSignalHeatmap ? 'RSSI Leviala: SEES' : 'RSSI Leviala'}</span>
            </button>

            {/* Offline Cached Zones Colored Overlay Toggle */}
            <button
              id="toggle-cached-zones-btn"
              type="button"
              aria-pressed={showCachedZones}
              onClick={() => setShowCachedZones(!showCachedZones)}
              title="Võrguühenduseta puhverdatud tsoonid: Visualiseerib värvilise ülekattena alad, kus võrgusõlmi hiljuti tuvastati"
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showCachedZones
                  ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] shadow-xs font-bold'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Boxes className="w-3 h-3 text-[#2A9D8F]" />
              <span>{showCachedZones ? 'Puhvertsoonid: SEES' : 'Puhvertsoonid'}</span>
            </button>

            {/* Center on My Node Toolbar Button */}
            <button
              id="toolbar-center-on-my-node-btn"
              type="button"
              onClick={handleCenterOnMyNode}
              title="Center on My Node: Tsentreeri ja suumi kaart automaatselt minu GPS ja raadiosõlme asukohale (Vajuta 'C')"
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isLocatingGps
                  ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] animate-pulse shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#87A878] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-white text-[#2A9D8F] border-[#87A878]/30 hover:bg-[#FAF6EE]'
              }`}
            >
              <Navigation className={`w-3 h-3 text-[#2A9D8F] ${isLocatingGps ? 'animate-spin' : ''}`} />
              <span>Minu Sõlm (Center)</span>
            </button>

            {/* Map Legend Modal / Drawer Toggle Button */}
            <button
              id="toolbar-toggle-map-legend-btn"
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              title="Kaardi Legend: Ressursside, võrgusõlmede ja signaalitugevuse sümbolite ja värvide selgitus"
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showLegend
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs font-bold'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Info className="w-3 h-3 text-[#E9C46A]" />
              <span>{showLegend ? 'Legend: SEES' : 'Legend'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNodeFreshness(!showNodeFreshness)}
              title={showNodeFreshness ? 'Sõlmede värskuskiht: SEES (Eristab aktiivseid ja aegunud releeteid viimati nähtud aja järgi)' : 'Sõlmede värskuskiht: VÄLJAS'}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showNodeFreshness
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs font-bold'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Clock className="w-3 h-3 text-[#E9C46A]" />
              <span>{showNodeFreshness ? 'Värskus: SEES' : 'Värskus'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowContours(!showContours)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer ${
                showContours
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              Topography
            </button>

            <button
              type="button"
              onClick={() => setUseWebGl(!useWebGl)}
              title={useWebGl ? 'WebGL kaardikiirendus: SEES (Sujuv 60 FPS GPU-l)' : 'WebGL kaardikiirendus: VÄLJAS'}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                useWebGl
                  ? 'bg-[#E76F51] text-white border-[#E76F51]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Zap className="w-3 h-3 text-[#E9C46A]" />
              <span>WebGL Kiirendus</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRadii(!showRadii)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer ${
                showRadii
                  ? 'bg-[#87A878] text-white border-[#87A878]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              Radio Radii
            </button>

            {/* Resource Pin Clustering Pill */}
            <button
              type="button"
              onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
              title={isClusteringEnabled ? 'Ressursiklastrid: SEES (Grupeerib tihedad ressursid)' : 'Ressursiklastrid: VÄLJAS (Kõik üksikud nööpnõelad)'}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isClusteringEnabled
                  ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                  : 'bg-white text-[#637062] border-[#87A878]/30'
              }`}
            >
              <Boxes className="w-3 h-3" />
              <span>{isClusteringEnabled ? 'Klastrid: SEES' : 'Klastrid: VÄLJAS'}</span>
            </button>

            {/* Drop Perimeter Marker Toggle */}
            <button
              type="button"
              onClick={() => setIsPlacingPerimeterMarker(!isPlacingPerimeterMarker)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isPlacingPerimeterMarker
                  ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] shadow-sm font-bold animate-pulse'
                  : isPerimeterClosed
                  ? 'bg-[#2A9D8F]/20 text-[#2A9D8F] border-[#2A9D8F]/60'
                  : perimeterPoints.length > 0
                  ? 'bg-[#E9C46A]/20 text-[#B58A2B] dark:text-[#E9C46A] border-[#E9C46A]/50'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]/40'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#E76F51]" />
              <span>
                {isPlacingPerimeterMarker
                  ? 'Drawing Boundary...'
                  : isPerimeterClosed
                  ? `Zone Defined (${perimeterPoints.length} Pts)`
                  : perimeterPoints.length > 0
                  ? `Perimeter Draft (${perimeterPoints.length} Pts)`
                  : 'Define Perimeter'}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-bold text-[#203A2A] dark:text-[#A8BDA5] flex items-center gap-1.5 uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              POIs:
            </span>
            {(['Tools', 'Bikes', 'Medical', 'Food', 'Station'] as SurvivalPoiCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => togglePoiCategory(cat)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-all cursor-pointer ${
                  visiblePoiCategories.has(cat)
                    ? 'bg-[#E76F51] text-white border-[#E76F51]'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                    : 'bg-white text-[#637062] border-[#87A878]/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* RSSI Signal Strength Heatmap Legend Strip */}
          {showSignalHeatmap && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-2xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 text-xs mt-2 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse" />
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5 text-[#2A9D8F]" />
                  <span>RSSI Signaalitugevuse soojuskaart:</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-[#2A9D8F] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F] shadow-xs" />
                  &gt; -65 dBm (Tugev)
                </span>
                <span className="flex items-center gap-1.5 text-[#E9C46A] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A] shadow-xs" />
                  -65..-80 dBm (Hea)
                </span>
                <span className="flex items-center gap-1.5 text-[#E76F51] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51] shadow-xs" />
                  &lt; -80 dBm (Nõrk)
                </span>
                <span className="text-[#588157] font-semibold border-l border-current/20 pl-2">
                  Sõlmi levialas: <strong className="text-[#203A2A] dark:text-[#F0F5EE]">{peers.length + 1}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Offline Cached Zones Legend Strip */}
          {showCachedZones && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-2xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 text-xs mt-2 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E9C46A] animate-pulse" />
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Võrguühenduseta puhverdatud tsoonid:</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-[#2A9D8F] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F] shadow-xs" />
                  Otsesed sõlmed (Direct)
                </span>
                <span className="flex items-center gap-1.5 text-[#E9C46A] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A] shadow-xs" />
                  Vahendatud tsoon (Relayed)
                </span>
                <span className="flex items-center gap-1.5 text-[#F4A261] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F4A261] shadow-xs" />
                  Talleta ja edasta (3+ hops)
                </span>
                <span className="text-[#588157] font-semibold border-l border-current/20 pl-2">
                  Puhvertsoone: <strong className="text-[#203A2A] dark:text-[#F0F5EE]">{peers.length + 1}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Node Freshness & Stale Relay Path Indicator Legend Strip */}
          {showNodeFreshness && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-2xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 text-xs mt-2 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse" />
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2A9D8F]" />
                  <span>Sõlmede värskuskiht (Viimati nähtud & releeteed):</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-[#2A9D8F] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F] shadow-xs" />
                  &lt;5m Aktiivne
                </span>
                <span className="flex items-center gap-1.5 text-[#E9C46A] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A] shadow-xs" />
                  5-20m Mõõdukas
                </span>
                <span className="flex items-center gap-1.5 text-[#E76F51] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51] shadow-xs" />
                  20-60m Aegunud (Stale)
                </span>
                <span className="flex items-center gap-1.5 text-[#8A9286] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8A9286] shadow-xs" />
                  &gt;1h Passiivne
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Intuitive Perimeter Control & Metrics Subbar */}
        {(isPlacingPerimeterMarker || perimeterPoints.length > 0) && (
          <div className="p-3 rounded-2xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Guidance Text based on state */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#588157] animate-ping inline-block" />
                <span className="font-medium text-[#203A2A] dark:text-[#F0F5EE]">
                  {isPlacingPerimeterMarker && perimeterPoints.length === 0 && (
                    <>🎯 Click anywhere on the map to drop your initial community marker <strong className="font-mono text-[#E76F51]">(P1)</strong>.</>
                  )}
                  {isPlacingPerimeterMarker && perimeterPoints.length > 0 && perimeterPoints.length < 3 && (
                    <>📌 Click map to add vertex <strong className="font-mono text-[#E76F51]">(P{perimeterPoints.length + 1})</strong>. Need at least 3 points to enclose.</>
                  )}
                  {isPlacingPerimeterMarker && perimeterPoints.length >= 3 && !isPerimeterClosed && (
                    <>🔄 Click near starting point <strong className="font-mono text-[#E76F51]">P1</strong> on map or click <strong className="text-[#2A9D8F]">"Close Loop"</strong> to complete zone.</>
                  )}
                  {isPerimeterClosed && (
                    <span className="text-[#2A9D8F] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2A9D8F]" />
                      Bioregional Community Zone enclosed & synchronized locally.
                    </span>
                  )}
                  {!isPlacingPerimeterMarker && !isPerimeterClosed && perimeterPoints.length > 0 && (
                    <span>Perimeter paused. Click "Resume Drawing" to add more points.</span>
                  )}
                </span>
              </div>

              {/* Actions Button Group */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Undo point */}
                {perimeterPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoPoint}
                    title="Undo last placed point (Ctrl+Z)"
                    className="px-2.5 py-1 rounded-lg border border-[#87A878]/40 bg-white dark:bg-[#203A2A] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#FAF6EE] cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3 text-[#588157]" />
                    <span>Undo</span>
                  </button>
                )}

                {/* Close Loop */}
                {perimeterPoints.length >= 3 && !isPerimeterClosed && (
                  <button
                    type="button"
                    onClick={handleCloseLoop}
                    className="px-2.5 py-1 rounded-lg bg-[#2A9D8F] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-[#238276] cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Close Loop</span>
                  </button>
                )}

                {/* Share Token */}
                {perimeterPoints.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-[#588157] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-[#466845] cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Share Zone</span>
                  </button>
                )}

                {/* Import Token */}
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg border border-[#87A878]/40 bg-white dark:bg-[#203A2A] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#FAF6EE] cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-[#2A9D8F]" />
                  <span>Import</span>
                </button>

                {/* Clear */}
                {perimeterPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPerimeter}
                    className="px-2.5 py-1 text-[11px] font-bold text-[#E76F51] bg-[#E76F51]/10 rounded-lg hover:bg-[#E76F51]/20 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}

                {/* Resume / Done */}
                <button
                  type="button"
                  onClick={() => setIsPlacingPerimeterMarker(!isPlacingPerimeterMarker)}
                  className="px-3 py-1 text-[11px] font-bold bg-[#203A2A] text-white rounded-lg cursor-pointer"
                >
                  {isPlacingPerimeterMarker ? 'Finish Drawing' : 'Resume Drawing'}
                </button>
              </div>
            </div>

            {/* Live Metrics Chips */}
            {perimeterPoints.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-current/10 text-[11px] font-mono">
                <span className="text-[#588157] font-semibold">
                  Vertices: <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">{perimeterPoints.length} points</span>
                </span>
                <span className="text-[#588157] font-semibold">
                  Boundary Length: <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">{perimeterLengthKm.toFixed(2)} km</span>
                </span>
                {perimeterPoints.length >= 3 && (
                  <span className="text-[#2A9D8F] font-semibold">
                    Enclosed Area:{' '}
                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                      {polygonArea.hectares.toFixed(1)} ha ({polygonArea.km2.toFixed(3)} km²)
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Category & Topology Filter Chips */}
        <div className="space-y-2 pt-1">
          {/* Topology Filter */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-[#588157] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Topology:
            </span>
            {[
              { id: 'all', label: 'All Links' },
              { id: 'direct', label: 'Direct Only (1-Hop)' },
              { id: 'relayed', label: 'Relayed Only (2-Hop)' },
              { id: 'store_forward', label: 'Store & Forward' },
            ].map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTopologyFilter(tf.id as TopologyFilter)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                  topologyFilter === tf.id
                    ? 'bg-[#588157] text-white border-[#588157]'
                    : isNightMode
                    ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26]'
                    : 'bg-white text-[#637062] border-[#87A878]/30'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Resource Category Marker Visibility Filter */}
          <div className="space-y-1.5 pt-2 border-t border-current/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-xs text-[#588157] flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#2A9D8F]" />
                <span>Ressursikategooriate nähtavus kaardil (Marker Visibility):</span>
              </span>
              <button
                type="button"
                onClick={toggleAllCategories}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  visibleCategories.size === ALL_CATEGORIES.length
                    ? 'bg-[#2A9D8F]/15 text-[#2A9D8F] border-[#2A9D8F]/40 hover:bg-[#2A9D8F]/25'
                    : 'bg-black/5 dark:bg-white/5 text-[#637062] dark:text-[#A8BDA5] border-current/20 hover:border-[#2A9D8F]'
                }`}
              >
                {visibleCategories.size === ALL_CATEGORIES.length ? (
                  <>
                    <Eye className="w-3 h-3 text-[#2A9D8F]" />
                    <span>Peida kõik</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3 text-[#87A878]" />
                    <span>Kuva kõik ({visibleCategories.size}/{ALL_CATEGORIES.length})</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {categories.filter((cat) => cat.id !== 'all').map((cat) => {
                const categoryKey = cat.id as ResourceCategory;
                const Icon = cat.icon;
                const isVisible = visibleCategories.has(categoryKey);
                const count = resources.filter((r) => r.category === categoryKey).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategoryVisibility(categoryKey)}
                    title={`Lülita ${cat.label} markerid kaardil ${isVisible ? 'välja' : 'sisse'}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                      isVisible
                        ? isNightMode
                          ? 'bg-[#203A2A] text-[#F0F5EE] border-[#588157] shadow-xs'
                          : 'bg-white text-[#203A2A] border-[#2A9D8F] shadow-xs ring-1 ring-[#2A9D8F]/20'
                        : isNightMode
                        ? 'bg-[#182315]/50 text-[#637062] border-[#2A3B26]/60 opacity-60 hover:opacity-100'
                        : 'bg-white/50 text-[#87A878] border-[#87A878]/25 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: isVisible ? cat.color : '#87A878' }} />
                    <span className={isVisible ? 'font-bold' : 'line-through opacity-75'}>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isVisible
                          ? 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
                          : 'bg-black/10 dark:bg-white/10 text-[#637062] dark:text-[#A8BDA5]'
                      }`}
                    >
                      {count}
                    </span>
                    {isVisible ? (
                      <Check className="w-3 h-3 text-[#2A9D8F] stroke-[2.5]" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-[#87A878]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Card with Floating Overlay Controls */}
      <div
        ref={mapContainerRef}
        onTouchStart={handleMapTouchStart}
        onTouchMove={handleMapTouchMove}
        onTouchEnd={handleMapTouchEnd}
        onTouchCancel={handleMapTouchEnd}
        className={`${
          isFullscreen
            ? 'fixed inset-0 z-50 w-screen h-screen m-0 p-0 rounded-none border-none overflow-hidden flex flex-col'
            : 'relative rounded-3xl border p-4 sm:p-5 shadow-xs select-none touch-none'
        } transition-all duration-200 ${
          isNightMode
            ? 'bg-[#223120] border-[#364E30]'
            : 'bg-[#F0F5EE] border-[#87A878]/35'
        }`}
      >
        {/* Fullscreen Floating Top Navigation Bar */}
        {isFullscreen && (
          <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto bg-[#182315]/90 border border-[#87A878]/40 p-2 rounded-2xl backdrop-blur-md shadow-xl text-xs text-white">
              <span className="font-bold flex items-center gap-1.5 px-2 text-[#E9C46A]">
                <Compass className="w-4 h-4 text-[#2A9D8F]" />
                <span>{activeCity.cityName} • Täisekraan</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCityModalOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 font-medium cursor-pointer"
              >
                Vaheta linna
              </button>
              <button
                type="button"
                onClick={() => setIsRouteMode(!isRouteMode)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                  isRouteMode ? 'bg-[#E76F51] text-white' : 'bg-white/10 hover:bg-white/20 text-[#A8BDA5]'
                }`}
              >
                <RouteIcon className="w-3.5 h-3.5" />
                <span>Teekond</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRulerMode(!isRulerMode);
                  if (isRulerMode) setRulerPoints([]);
                }}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                  isRulerMode ? 'bg-[#2A9D8F] text-white' : 'bg-white/10 hover:bg-white/20 text-[#A8BDA5]'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Mõõdulint</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                  isClusteringEnabled ? 'bg-[#2A9D8F] text-white' : 'bg-white/10 hover:bg-white/20 text-[#A8BDA5]'
                }`}
                title="Lülita ressursiklastrite grupeerimine sisse/välja"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>{isClusteringEnabled ? 'Klastrid' : 'Üksikud'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSignalHeatmap(!showSignalHeatmap)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                  showSignalHeatmap ? 'bg-[#2A9D8F] text-white' : 'bg-white/10 hover:bg-white/20 text-[#A8BDA5]'
                }`}
                title="Lülita RSSI signaalitugevuse soojuskaart sisse/välja"
              >
                <Signal className="w-3.5 h-3.5" />
                <span>{showSignalHeatmap ? 'RSSI: Sees' : 'RSSI: Väljas'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCachedZones(!showCachedZones)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                  showCachedZones ? 'bg-[#E9C46A] text-[#203A2A]' : 'bg-white/10 hover:bg-white/20 text-[#A8BDA5]'
                }`}
                title="Lülita võrguühenduseta puhverdatud tsoonide ülekate sisse/välja"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>{showCachedZones ? 'Puhvertsoonid: Sees' : 'Puhvertsoonid: Väljas'}</span>
              </button>

              {/* Fullscreen Center on My Node button */}
              <button
                type="button"
                onClick={handleCenterOnMyNode}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 ${
                  isLocatingGps
                    ? 'bg-[#E9C46A] text-[#203A2A] animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 text-[#2A9D8F]'
                }`}
                title="Center on My Node (Tsentreeri ja suumi oma sõlmele / Vajuta 'C')"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>Minu Sõlm</span>
              </button>

              {/* Fullscreen Legend button */}
              <button
                type="button"
                onClick={() => setShowLegend(!showLegend)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 ${
                  showLegend ? 'bg-[#2A9D8F] text-white' : 'bg-white/10 hover:bg-white/20 text-[#E9C46A]'
                }`}
                title="Kaardi Legend (Sümbolite ja signaalitugevuste selgitused)"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showLegend ? 'Legend: SEES' : 'Legend'}</span>
              </button>

              {/* Fullscreen Toggle Mesh Nodes Checkbox */}
              <label
                htmlFor="fullscreen-toggle-mesh-nodes-checkbox"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 font-medium cursor-pointer text-xs select-none"
                title="Lülita võrgusõlmede kuvamine sisse/välja (Täisvaade vs Ainult ressursid)"
              >
                <input
                  id="fullscreen-toggle-mesh-nodes-checkbox"
                  type="checkbox"
                  checked={showMeshNodes}
                  onChange={(e) => setShowMeshNodes(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#588157] accent-[#588157] cursor-pointer"
                />
                <span>Sõlmed: {showMeshNodes ? 'Täisvaade' : 'Ainult ressursid'}</span>
              </label>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3.5 py-2 rounded-2xl bg-[#E76F51] hover:bg-[#d55e41] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                title="Välju täisekraanist (ESC)"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Välju (ESC)</span>
              </button>
            </div>
          </div>
        )}

        {/* Step Progress Widget for Walk to Reveal */}
        {isWalkToRevealEnabled && (
          <StepProgressWidget
            totalSteps={stepsState.steps}
            stepsPerReveal={100}
            isNightMode={isNightMode}
            onOpenSettings={() => setShowWalkInfo(true)}
          />
        )}

        {/* Rogue-like ASCII Terminal Map OR Visual Canvas Map */}
        {mapDisplayMode === 'terminal' ? (
          <AsciiMap
            cityId={selectedCityId}
            peers={effectivePeers}
            resources={effectiveResources}
            userCallsign={userCallsign}
            gpsPosition={gpsPosition}
            simulatedUserPos={simulatedUserPos}
            isNightMode={isNightMode}
            onSelectPeer={handleSelectNode}
            onSelectResource={handleSelectResource}
          />
        ) : useWebGl ? (
          <WebGlMapCanvas
            isEcoMode={effectiveEcoMode}
            peers={effectivePeers}
            resources={effectiveResources}
            userSymbiosisScore={userSymbiosisScore}
            userCallsign={userCallsign}
            isNightMode={isNightMode}
            showMeshLinks={effectiveShowMeshLinks}
            showNodeFreshness={showNodeFreshness}
            showDensityHeatmap={effectiveShowDensityHeatmap}
            d3HeatmapMode={d3HeatmapMode}
            d3HeatmapOpacity={d3HeatmapOpacity}
            showSignalHeatmap={effectiveShowSignalHeatmap}
            showCachedZones={effectiveShowCachedZones}
            showContours={showContours}
            showRadii={showRadii}
            selectedCategory={selectedCategory}
            topologyFilter={topologyFilter}
            cityId={selectedCityId}
            transform={transform}
            onTransformChange={setTransform}
            onSelectNode={handleSelectNode}
            onSelectResource={handleSelectResource}
            isClusteringEnabled={isClusteringEnabled}
            isPlacingPerimeterMarker={isPlacingPerimeterMarker}
            perimeterPoints={perimeterPoints}
            isPerimeterClosed={isPerimeterClosed}
            onAddPerimeterPoint={(pt) => setPerimeterPoints((prev) => [...prev, pt])}
            onClosePerimeter={handleCloseLoop}
            onClearPerimeterPoints={handleClearPerimeter}
            gpsPosition={gpsPosition}
            visiblePoiCategories={visiblePoiCategories}
            isRulerMode={isRulerMode}
            rulerPoints={rulerPoints}
            onRulerClick={handleRulerClick}
            onLongPress={handleLongPress}
            onUpdatePoi={handleUpdatePoi}
            onDeletePoi={handleDeletePoi}
            isRouteMode={isRouteMode}
            routeStart={routeStart}
            routeDestination={routeDestination}
            activeRoutePath={routeResult?.path}
            onMapRouteClick={handleMapRouteClick}
            onSetRouteStart={handleSetRouteStart}
            onSetRouteDestination={handleSetRouteDestination}
            pathfinderFilter={pathfinderFilter}
            activeWalkSession={pathfinderState.activeSession}
            allWalkSessions={pathfinderWalks}
            wifiSpots={pathfinderWifi}
            bluetoothSpots={pathfinderBle}
            loraNodes={pathfinderLora}
            showPathfinderLayer={showPathfinderLayer}
            onSelectPathfinderSpot={(spot) => setSelectedPathfinderSpot(spot)}
            onToggleFallback={() => setUseWebGl(false)}
            isWalkToRevealEnabled={isWalkToRevealEnabled}
            revealedCircles={revealedCircles}
            simulatedUserPos={simulatedUserPos}
            isDeadReckoningActive={deadReckoningState.isActive}
            deadReckoningDriftMeters={deadReckoningState.driftEstimateMeters}
            deadReckoningConfidence={deadReckoningState.confidencePercent}
          />
        ) : (
          <OfflineMapCanvas
            isEcoMode={effectiveEcoMode}
            peers={effectivePeers}
            resources={effectiveResources}
            userSymbiosisScore={userSymbiosisScore}
            userCallsign={userCallsign}
            isNightMode={isNightMode}
            showMeshLinks={effectiveShowMeshLinks}
            showNodeFreshness={showNodeFreshness}
            showDensityHeatmap={effectiveShowDensityHeatmap}
            d3HeatmapMode={d3HeatmapMode}
            d3HeatmapOpacity={d3HeatmapOpacity}
            showSignalHeatmap={effectiveShowSignalHeatmap}
            showCachedZones={effectiveShowCachedZones}
            showContours={showContours}
            showRadii={showRadii}
            selectedCategory={selectedCategory}
            topologyFilter={topologyFilter}
            cityId={selectedCityId}
            transform={transform}
            onTransformChange={setTransform}
            onSelectNode={handleSelectNode}
            onSelectResource={handleSelectResource}
            isClusteringEnabled={isClusteringEnabled}
            isPlacingPerimeterMarker={isPlacingPerimeterMarker}
            perimeterPoints={perimeterPoints}
            isPerimeterClosed={isPerimeterClosed}
            onAddPerimeterPoint={(pt) => setPerimeterPoints((prev) => [...prev, pt])}
            onClosePerimeter={handleCloseLoop}
            onClearPerimeterPoints={handleClearPerimeter}
            gpsPosition={gpsPosition}
            visiblePoiCategories={visiblePoiCategories}
            isRulerMode={isRulerMode}
            rulerPoints={rulerPoints}
            onRulerClick={handleRulerClick}
            onLongPress={handleLongPress}
            onUpdatePoi={handleUpdatePoi}
            onDeletePoi={handleDeletePoi}
            isRouteMode={isRouteMode}
            routeStart={routeStart}
            routeDestination={routeDestination}
            activeRoutePath={routeResult?.path}
            onMapRouteClick={handleMapRouteClick}
            onSetRouteStart={handleSetRouteStart}
            onSetRouteDestination={handleSetRouteDestination}
            pathfinderFilter={pathfinderFilter}
            activeWalkSession={pathfinderState.activeSession}
            allWalkSessions={pathfinderWalks}
            wifiSpots={pathfinderWifi}
            bluetoothSpots={pathfinderBle}
            loraNodes={pathfinderLora}
            showPathfinderLayer={showPathfinderLayer}
            onSelectPathfinderSpot={(spot) => setSelectedPathfinderSpot(spot)}
            isWalkToRevealEnabled={isWalkToRevealEnabled}
            revealedCircles={revealedCircles}
            simulatedUserPos={simulatedUserPos}
            isDeadReckoningActive={deadReckoningState.isActive}
            deadReckoningDriftMeters={deadReckoningState.driftEstimateMeters}
            deadReckoningConfidence={deadReckoningState.confidencePercent}
          />
        )}

        {/* Resource Only spatial view notification banner on map */}
        {!showMeshNodes && (
          <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-20 pointer-events-auto animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-[#182315]/95 border border-[#E76F51]/40 shadow-md backdrop-blur-xs text-xs text-[#203A2A] dark:text-[#F0F5EE]">
              <span className="w-2 h-2 rounded-full bg-[#E76F51] shrink-0 animate-pulse" />
              <span className="font-bold">Resource Only View</span>
              <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5] hidden md:inline">
                (Peer nodes hidden for spatial visibility)
              </span>
              <button
                type="button"
                onClick={() => setShowMeshNodes(true)}
                className="ml-1 px-2 py-0.5 rounded-lg bg-[#588157] hover:bg-[#466745] text-white text-[10px] font-bold cursor-pointer transition-colors"
                title="Switch back to Full View (Resources + Peer Nodes)"
              >
                Full View
              </button>
            </div>
          </div>
        )}

        {/* FLOATING INTERACTIVE MAP CONTROLS OVERLAY */}
        <div className={`absolute right-8 z-20 flex flex-col gap-2 ${isFullscreen ? 'top-20' : 'top-8'}`}>
          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Välju täisekraanist (ESC)' : 'Täisekraan (Full Screen)'}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-[#588157]" />}
          </button>

          {/* Toggle Mesh Nodes Floating Button */}
          <button
            id="floating-toggle-mesh-nodes-btn"
            type="button"
            onClick={() => setShowMeshNodes(!showMeshNodes)}
            title={
              showMeshNodes
                ? 'Mesh Nodes: Full View (Resources + Peer Nodes). Click for Resource Only'
                : 'Mesh Nodes: Resource Only (Peer Nodes Hidden). Click for Full View'
            }
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              showMeshNodes
                ? 'bg-[#588157] border-[#588157] text-white shadow-[#588157]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Radio className="w-4 h-4" />
            {!showMeshNodes && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E76F51] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Route Planning Tool Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsRouteMode(!isRouteMode);
              if (!isRouteMode) {
                setIsSelectingWayPoint('start');
              }
            }}
            title="Teekonna planeerimine (Offline Street Routing)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isRouteMode
                ? 'bg-[#E76F51] border-[#E76F51] text-white shadow-[#E76F51]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <RouteIcon className="w-4 h-4" />
          </button>

          {/* Signal Strength Heatmap Floating Button */}
          <button
            id="floating-signal-heatmap-btn"
            type="button"
            onClick={() => setShowSignalHeatmap(!showSignalHeatmap)}
            title={showSignalHeatmap ? 'RSSI signaalitugevuse soojuskaart: SEES' : 'RSSI signaalitugevuse soojuskaart: VÄLJAS'}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              showSignalHeatmap
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Signal className="w-4 h-4" />
            {showSignalHeatmap && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Ruler Tool */}
          <button
            type="button"
            onClick={() => {
              setIsRulerMode(!isRulerMode);
              if (isRulerMode) setRulerPoints([]);
            }}
            title="Measure Distance (Mõõdulint)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isRulerMode
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Resource Pin Clustering Toggle */}
          <button
            type="button"
            onClick={() => setIsClusteringEnabled(!isClusteringEnabled)}
            title={isClusteringEnabled ? 'Ressursiklastrid: SEES (Grupeerib kattuvad ressursid)' : 'Ressursiklastrid: VÄLJAS (Kõik üksikud nööpnõelad)'}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              isClusteringEnabled
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Boxes className="w-4 h-4" />
            {isClusteringEnabled && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Center on My Node Dedicated Quick Button */}
          <button
            id="btn-center-on-my-node"
            type="button"
            onClick={handleCenterOnMyNode}
            title="Center on My Node (Tsentreeri ja suumi minu sõlmele / Vajuta 'C')"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              isLocatingGps
                ? 'bg-[#E9C46A] border-[#E9C46A] text-[#203A2A] animate-pulse shadow-[#E9C46A]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#E9C46A] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#2A9D8F] hover:bg-[#FAF6EE]'
            }`}
          >
            <Navigation className={`w-4 h-4 ${isLocatingGps ? 'animate-spin' : ''}`} />
            <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#2A9D8F] border-2 border-white dark:border-[#182315]" />
          </button>

          {/* GPS Auto-Follow Location Button */}
          <button
            type="button"
            onClick={handleLocateMe}
            title={autoFollowUser ? "Auto-Follow Enabled (Click to disable)" : "Re-center to my location (Enable Auto-Follow)"}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              autoFollowUser
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg animate-pulse'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <LocateFixed className={`w-4 h-4 ${isLocatingGps && autoFollowUser ? 'animate-spin text-[#E9C46A]' : ''}`} />
            {gpsPosition && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Map Legend Floating Toggle Button */}
          <button
            id="btn-toggle-map-legend"
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            title={showLegend ? "Kaardi Legend: SEES (Peida legend)" : "Kaardi Legend: VÄLJAS (Kuva legend)"}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              showLegend
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Info className="w-4 h-4 text-[#E9C46A]" />
            {showLegend && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Activity Density Hubs Floating Button */}
          <button
            id="btn-floating-activity-hubs"
            type="button"
            onClick={() => setShowActivityHubsDrawer(!showActivityHubsDrawer)}
            title="Mesh Activity Hubs (Vaata kõrge aktiivsusega kogukonna keskusi D3-ga)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              showActivityHubsDrawer
                ? 'bg-[#E76F51] border-[#E76F51] text-white shadow-[#E76F51]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#E76F51] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#E76F51] hover:bg-[#FAF6EE]'
            }`}
          >
            <Flame className="w-4 h-4 text-[#E76F51]" />
            {showActivityHubsDrawer && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Nearby Aid Resources Overlay Button */}
          <button
            id="btn-floating-nearby-aid"
            type="button"
            onClick={() => setShowNearbyAidOverlay(!showNearbyAidOverlay)}
            title={showNearbyAidOverlay ? "Nearby Aid Clusters: ON (Clustering of peer offerings)" : "Nearby Aid Clusters: OFF"}
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              showNearbyAidOverlay
                ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#2A9D8F] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#2A9D8F] hover:bg-[#FAF6EE]'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            {showNearbyAidOverlay && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#E9C46A] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Download Offline Region Floating Button */}
          <button
            id="btn-floating-download-offline"
            type="button"
            onClick={() => setIsOfflineDownloadOpen(true)}
            title="Download Offline Region (Laadi piirkond võrguühenduseta / Salvesta maastik & sõlmed)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#2A9D8F] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#2A9D8F] hover:bg-[#FAF6EE]'
            }`}
          >
            <FolderDown className="w-4 h-4 text-[#2A9D8F]" />
            {downloadedRegions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#2A9D8F] border-2 border-white dark:border-[#182315]" />
            )}
          </button>

          {/* Cache Viewport Floating Button */}
          <button
            id="btn-floating-cache-viewport"
            type="button"
            onClick={handleOpenViewportCache}
            title="Cache Current Viewport (Salvesta praegune vaateväli rasterkaardina)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer relative ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#E76F51] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#E76F51] hover:bg-[#FAF6EE]'
            }`}
          >
            <HardDrive className="w-4 h-4 text-[#E76F51]" />
          </button>

          {/* Performance / Eco Mode Toggle Floating Button */}
          <button
            id="btn-floating-eco-mode"
            type="button"
            disabled={!!batteryStatus?.isSolarAwareActive}
            onClick={() => {
              const newMode = !isEcoMode;
              setIsEcoMode(newMode);
              localStorage.setItem('hoimu-map-eco-mode', String(newMode));
            }}
            title={
              batteryStatus?.isSolarAwareActive
                ? "Solar-Saver energiasäästurežiim on SEES (Kaardirežiim on lukustatud madalale koormusele süsteemi säästmiseks)"
                : isEcoMode
                ? "Energiasäästurežiim: SEES (Vähendab animatsioone, langetab kaadrisagedust ja säästab akut)"
                : "Energiasäästurežiim: VÄLJAS (Lülita sisse energiasäästurežiim map-lagi kaotamiseks)"
            }
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all relative ${
              batteryStatus?.isSolarAwareActive
                ? 'bg-[#E76F51]/25 border-[#E76F51]/60 text-[#E76F51] cursor-not-allowed'
                : isEcoMode
                ? 'bg-[#E9C46A] border-[#E9C46A] text-[#203A2A] shadow-[#E9C46A]/30 shadow-lg cursor-pointer'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26] cursor-pointer'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE] cursor-pointer'
            }`}
          >
            {batteryStatus?.isSolarAwareActive ? (
              <ZapOff className="w-4 h-4 text-[#E76F51] animate-pulse" />
            ) : isEcoMode ? (
              <ZapOff className="w-4 h-4 text-[#203A2A]" />
            ) : (
              <Cpu className="w-4 h-4 text-[#588157]" />
            )}
          </button>


          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <ZoomIn className="w-4 h-4 text-[#588157]" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <ZoomOut className="w-4 h-4 text-[#588157]" />
          </button>

          {/* Reset Zoom & Pan (1:1) */}
          <button
            type="button"
            onClick={handleResetView}
            title="Reset Pan & Zoom (1:1 / Press '0')"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] hover:bg-[#FAF6EE]'
            }`}
          >
            <Move className="w-4 h-4 text-[#2A9D8F]" />
          </button>

          {/* Rotate Map 45° Clockwise Button */}
          <button
            type="button"
            id="map-rotate-cw-btn"
            onClick={handleRotateCw}
            title="Rotate 45° Clockwise (Pööra 45° päripäeva / Press 'R')"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#E9C46A] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#588157] hover:bg-[#FAF6EE]'
            }`}
          >
            <RotateCw className="w-4 h-4 transition-transform active:rotate-45" />
          </button>

          {/* Reset North Compass */}
          <button
            type="button"
            id="map-reset-north-btn"
            onClick={handleResetNorth}
            title="Orient North (Reset Rotation / Press 'N')"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shadow-md transition-all cursor-pointer ${
              transform.rotation !== 0
                ? 'bg-[#E9C46A] border-[#E9C46A] text-[#203A2A]'
                : isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
          >
            <Compass
              className="w-4 h-4 transition-transform duration-200"
              style={{ transform: `rotate(${-transform.rotation}rad)` }}
            />
          </button>
        </div>

        {/* GPS Status Toast Floating Banner */}
        {gpsStatusMessage && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-[#203A2A]/90 text-white text-xs font-semibold backdrop-blur-xs border border-[#87A878]/40 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <LocateFixed className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>{gpsStatusMessage}</span>
          </div>
        )}

        {/* BIOREGIONAL MAP INTERACTIVE LEGEND COMPONENT */}
        <MapLegendComponent
          isOpen={showLegend}
          onClose={() => setShowLegend(false)}
          isNightMode={isNightMode}
          isFloating={true}
        />

        {/* D3 BIOREGIONAL HEATMAP LEGEND COMPONENT */}
        {effectiveShowDensityHeatmap && (
          <D3HeatmapLegend
            mode={d3HeatmapMode}
            onModeChange={setD3HeatmapMode}
            opacity={d3HeatmapOpacity}
            onOpacityChange={setD3HeatmapOpacity}
            nodeCount={peers.length + 1}
            resourceCount={resources.length}
            isNightMode={isNightMode}
            className="absolute bottom-20 left-4 sm:left-6 z-30 w-64 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-150"
          />
        )}

        {/* D3 MESH ACTIVITY HUBS VISUALIZATION DRAWER/CARD */}
        {showActivityHubsDrawer && (
          <div className="absolute top-20 right-4 sm:right-6 z-35 w-80 max-w-[calc(100vw-2rem)]">
            <MeshActivityHubsD3
              peers={peers}
              resources={resources}
              onClose={() => setShowActivityHubsDrawer(false)}
              onSelectHub={(peer) => {
                handleSelectNode(peer);
                if (onAddToast) {
                  onAddToast(
                    '📍 Keskus märgistatud kaardil',
                    `Suunatud võrgusõlmele @${peer.callsign} (${peer.reputationTier || 'Aktiivne abistaja'})`,
                    'success'
                  );
                }
              }}
              isNightMode={isNightMode}
            />
          </div>
        )}

        {/* NEARBY RESOURCES VISUALIZATION OVERLAY */}
        <NearbyResourcesOverlay
          resources={resources}
          selectedCity={activeCity}
          onSelectResource={handleSelectResource}
          onFocusCoordinates={(coords, targetScale = 2.2) => {
            setTransform((prev) => ({
              ...prev,
              offsetX: -coords.x * targetScale,
              offsetY: -coords.y * targetScale,
              scale: targetScale,
            }));
          }}
          isNightMode={isNightMode}
          isOpen={showNearbyAidOverlay}
          onToggle={() => setShowNearbyAidOverlay((prev) => !prev)}
        />

        {/* OFFLINE STREET ROUTE PLANNER FLOATING CARD */}
        {(isRouteMode || routeStart || routeDestination) && (
          <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-30 w-72 sm:w-80 bg-white/95 dark:bg-[#182315]/95 border border-[#87A878]/60 rounded-3xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                <RouteIcon className="w-4 h-4 text-[#E76F51]" />
                <span>Teekonna planeerimine (Offline)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRouteMode(false);
                  handleClearRoute();
                }}
                className="p-1 rounded-lg text-[#637062] hover:text-[#203A2A] dark:text-[#A8BDA5] dark:hover:text-[#F0F5EE] hover:bg-black/5"
                title="Sulge teekonna planeerija"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Waypoints Selection Inputs */}
            <div className="space-y-1.5">
              {/* Start Point */}
              <div className="flex items-center gap-1.5 bg-[#FAF6EE] dark:bg-[#203A2A]/60 p-2 rounded-xl border border-[#87A878]/30">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Alguspunkt (Start):</span>
                  <span className="font-semibold text-xs text-[#203A2A] dark:text-[#F0F5EE] truncate block">
                    {routeStart ? routeStart.label || `(${routeStart.x}, ${routeStart.y})` : 'Klõpsa kaardil alguspunktiks'}
                  </span>
                </div>
                {gpsPosition && !routeStart && (
                  <button
                    type="button"
                    onClick={() => {
                      setRouteStart({ x: Math.round(gpsPosition.x), y: Math.round(gpsPosition.y), label: 'Minu GPS asukoht' });
                      setIsSelectingWayPoint('destination');
                    }}
                    className="px-2 py-1 text-[10px] font-bold bg-[#2A9D8F] text-white rounded-lg shadow-xs hover:bg-[#238276] shrink-0"
                  >
                    Minu GPS
                  </button>
                )}
                {routeStart && (
                  <button
                    type="button"
                    onClick={() => setRouteStart(null)}
                    className="p-1 text-[#E76F51] hover:bg-black/5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Destination Point */}
              <div className="flex items-center gap-1.5 bg-[#FAF6EE] dark:bg-[#203A2A]/60 p-2 rounded-xl border border-[#87A878]/30">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] block">Sihtpunkt (Destination):</span>
                  <span className="font-semibold text-xs text-[#203A2A] dark:text-[#F0F5EE] truncate block">
                    {routeDestination ? routeDestination.label || `(${routeDestination.x}, ${routeDestination.y})` : 'Klõpsa kaardil sihtpunktiks'}
                  </span>
                </div>
                {routeDestination && (
                  <button
                    type="button"
                    onClick={() => setRouteDestination(null)}
                    className="p-1 text-[#E76F51] hover:bg-black/5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Route Planning Action Buttons */}
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleReverseRoute}
                  disabled={!routeStart || !routeDestination}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#87A878]/40 text-[#203A2A] dark:text-[#F0F5EE] hover:bg-black/5 disabled:opacity-40 flex items-center gap-1"
                  title="Pööra algus- ja sihtpunkt ümber"
                >
                  <ArrowUpDown className="w-3 h-3 text-[#2A9D8F]" />
                  <span>Vaheta</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearRoute}
                  disabled={!routeStart && !routeDestination}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-[#E76F51] hover:bg-[#E76F51]/10 disabled:opacity-40 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Tühjenda</span>
                </button>
              </div>

              <span className="text-[10px] font-mono text-[#588157]">
                Tänavavõrk: {activeCity.streets?.length || 0}
              </span>
            </div>

            {/* Route Stats & Step-by-Step Directions */}
            {routeResult && (
              <div className="pt-2 border-t border-[#87A878]/20 space-y-2">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/20">
                    <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] block">Vahemaa</span>
                    <span className="font-bold text-xs text-[#2A9D8F]">
                      {routeResult.totalDistanceM >= 1000
                        ? `${(routeResult.totalDistanceM / 1000).toFixed(2)} km`
                        : `${Math.round(routeResult.totalDistanceM)} m`}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/20">
                    <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] flex items-center justify-center gap-0.5">
                      <Footprints className="w-2.5 h-2.5" /> Jalgsi
                    </span>
                    <span className="font-bold text-xs text-[#588157]">
                      ~{routeResult.estimatedWalkMin} min
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/20">
                    <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] flex items-center justify-center gap-0.5">
                      <Bike className="w-2.5 h-2.5" /> Rattaga
                    </span>
                    <span className="font-bold text-xs text-[#E9C46A]">
                      ~{routeResult.estimatedBikeMin} min
                    </span>
                  </div>
                </div>

                {/* Step-by-Step Turn List Toggle */}
                {routeResult.steps.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowRouteSteps(!showRouteSteps)}
                      className="w-full py-1 text-[11px] font-bold text-[#588157] hover:underline flex items-center justify-center gap-1"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>{showRouteSteps ? 'Peida teekonnajuhised' : `Kuva juhised (${routeResult.steps.length} lõiku)`}</span>
                    </button>

                    {showRouteSteps && (
                      <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1 text-[11px]">
                        {routeResult.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded-lg bg-[#FAF6EE] dark:bg-[#203A2A]/50 border border-[#87A878]/20 flex items-start gap-1.5"
                          >
                            <span className="font-mono text-[10px] font-bold text-[#588157] mt-0.5">{idx + 1}.</span>
                            <div className="flex-1">
                              <span className="font-semibold text-[#203A2A] dark:text-[#F0F5EE] block leading-snug">
                                {step.streetName}
                              </span>
                              <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                                {step.distanceM >= 1000
                                  ? `${(step.distanceM / 1000).toFixed(2)} km`
                                  : `${Math.round(step.distanceM)} m`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* WALK TO REVEAL CONTROLS FLOATING OVERLAY */}
        {isWalkToRevealEnabled && (
          <div className="absolute bottom-18 sm:bottom-22 left-4 sm:left-6 z-30 w-64 sm:w-72 bg-white/95 dark:bg-[#182315]/95 border border-[#87A878]/50 rounded-3xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                <Footprints className="w-4 h-4 text-[#E76F51]" />
                <span>Walk to Reveal</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#E76F51]/10 text-[#E76F51] px-1.5 py-0.5 rounded-md animate-pulse">
                Fog of War
              </span>
            </div>

            <p className="text-[10px] leading-relaxed text-[#637062] dark:text-[#A8BDA5]">
              Kaart on udune. Iga <strong className="font-mono">100 sammu</strong> avab uue 50-meetrise piirkonna sinu asukoha ümber.
            </p>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px] font-bold">
              <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/25">
                <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] font-sans font-normal block leading-tight">Sammud</span>
                <span className="text-[#203A2A] dark:text-[#F0F5EE]">{stepsState.steps}</span>
              </div>
              <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/25">
                <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] font-sans font-normal block leading-tight">Vahemaa</span>
                <span className="text-[#2A9D8F]">{(stepsState.distanceMeters / 1000).toFixed(2)} km</span>
              </div>
              <div className="p-1.5 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/40 border border-[#87A878]/25">
                <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] font-sans font-normal block leading-tight">Piirkonnad</span>
                <span className="text-[#E9C46A]">{revealedCircles.length} avatud</span>
              </div>
            </div>

            {/* Simulated walk controls */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleSimulateStepWalk}
                className="flex-1 px-3 py-2 bg-[#588157] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#476a46] transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Kõnni 100 sammu</span>
              </button>

              <button
                type="button"
                onClick={handleResetExploration}
                title="Nulli kogu uuritud ala"
                className="px-2.5 py-2 bg-[#E76F51]/10 text-[#E76F51] hover:bg-[#E76F51]/20 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center"
              >
                Nulli
              </button>
            </div>
          </div>
        )}

        {/* Gesture Guide, City Selector & Dynamic Scale Ruler Micro Bar */}
        <div className="absolute bottom-8 left-8 z-20 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCityModalOpen(true)}
            className="px-3 py-1.5 rounded-2xl bg-[#203A2A]/85 text-[#F0F5EE] border border-[#87A878]/50 text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 shadow-md hover:bg-[#203A2A] cursor-pointer"
          >
            <Building className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>{activeCity.cityName}</span>
          </button>

          {/* Dynamic Scale Ruler HUD Element */}
          <DynamicScaleRuler
            scale={transform.scale}
            isNightMode={isNightMode}
            isRulerMode={isRulerMode}
            onToggleRulerMode={() => {
              setIsRulerMode(!isRulerMode);
              if (isRulerMode) setRulerPoints([]);
            }}
          />

          <div className="px-3 py-1.5 rounded-2xl bg-[#203A2A]/75 text-[#A8BDA5] border border-[#87A878]/30 text-[11px] font-mono backdrop-blur-xs flex items-center gap-1.5 hidden sm:flex">
            <Move className="w-3 h-3 text-[#2A9D8F]" />
            <span>Pan: Drag / Trackpad • Zoom: Scroll / Pinch • Rotate: 2 Fingers / 'R'</span>
          </div>
        </div>

        {/* Canvas Legend Strip */}
        <div
          className={`mt-4 pt-3 border-t space-y-2 text-[11px] font-mono ${
            isNightMode
              ? 'border-[#2A3B26] text-[#A8BDA5]'
              : 'border-[#87A878]/25 text-[#637062]'
          }`}
        >
          {/* RF Topology Links & RSSI Line Thickness Scale */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 bg-[#588157] rounded-full inline-block" /> Strong Link (≥ -60 dBm)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-[2px] bg-[#F4A261] rounded-full inline-block" /> Relayed Link (-61 to -78 dBm)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-[1px] bg-[#E76F51] rounded-full inline-block" /> Store & Forward (&lt; -78 dBm)
              </span>
            </div>

            <span className="text-[10px] text-[#588157] font-sans font-medium">
              💡 Hotkeys: <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[9px]">+</kbd> <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[9px]">-</kbd> Zoom • <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[9px]">0</kbd> Reset • <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[9px]">N</kbd> North • <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[9px]">Ctrl+Z</kbd> Undo Point
            </span>
          </div>

          {/* Resource Pin Types Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-current/10 text-[10px]">
            <span className="font-bold text-[#588157] font-sans">Resource Pin Types:</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F]" /> 🛠️ Tools
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#87A878]" /> 🌾 Food
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F4A261]" /> ⚡ Energy
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A]" /> 🎓 Skills
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#588157]" /> 🏠 Housing
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51]" /> 🩺 Bio-Remedy
              <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" /> 📻 Electronics
            </span>
          </div>

          {/* Pathfinder RF Hotspots Legend */}
          {showPathfinderLayer && (
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-current/10 text-[10px]">
              <span className="font-bold text-[#E76F51] font-sans">Pathfinder Kiht (RF):</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" /> 📶 WiFi Hotspot
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /> ᛒ Bluetooth BLE
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> 📻 LoRa Node
              </span>
              <span className="flex items-center gap-1 font-bold text-[#B58A2B] dark:text-[#E9C46A] bg-[#E9C46A]/20 px-1.5 py-0.5 rounded border border-[#E9C46A]/40">
                <span className="w-2 h-2 rounded-full bg-[#E9C46A] animate-pulse" /> ✨ New Discovery (Gold)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pathfinder Hotspot Telemetry Inspector Card */}
      {selectedPathfinderSpot && (
        <div
          className={`rounded-3xl border p-5 shadow-xl space-y-4 animate-in fade-in transition-colors ${
            isNightMode
              ? 'bg-[#182315] border-[#E9C46A]/40 text-[#F0F5EE]'
              : 'bg-white border-[#E9C46A]/60 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-current/10 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#E9C46A]" />
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <span>
                  {selectedPathfinderSpot.type === 'wifi' && '📶 WiFi Kuumpunkt'}
                  {selectedPathfinderSpot.type === 'ble' && 'ᛒ Bluetooth Seade'}
                  {selectedPathfinderSpot.type === 'lora' && '📻 LoRa Sõlm'}
                </span>
                {pathfinderState.activeSession && selectedPathfinderSpot.data.walkSessionId === pathfinderState.activeSession.id && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E9C46A] text-[#203A2A] animate-pulse">
                    ✨ GOLD NEW DISCOVERY
                  </span>
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPathfinderSpot(null)}
              className="text-xs text-[#637062] hover:text-current font-bold cursor-pointer"
            >
              Sulge
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-display font-bold text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                  {selectedPathfinderSpot.type === 'wifi' && selectedPathfinderSpot.data.ssid}
                  {selectedPathfinderSpot.type === 'ble' && selectedPathfinderSpot.data.deviceName}
                  {selectedPathfinderSpot.type === 'lora' && selectedPathfinderSpot.data.callsign}
                </h4>
                <span className="text-xs font-mono text-[#588157]">
                  {selectedPathfinderSpot.type === 'wifi' && `BSSID: ${selectedPathfinderSpot.data.bssid}`}
                  {selectedPathfinderSpot.type === 'ble' && `Address: ${selectedPathfinderSpot.data.address}`}
                  {selectedPathfinderSpot.type === 'lora' && `ID: ${selectedPathfinderSpot.data.id}`}
                </span>
              </div>

              <div className="text-xs font-mono font-bold px-3 py-1 bg-[#87A878]/20 text-[#588157] rounded-full border border-[#87A878]/40 self-start sm:self-auto">
                Signal: {selectedPathfinderSpot.data.signalDbm || selectedPathfinderSpot.data.rssi} dBm
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono pt-1">
              <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                <span className="text-[10px] text-[#637062] block">Tüüp / Turvalisus</span>
                <span className="font-bold text-[#588157]">
                  {selectedPathfinderSpot.type === 'wifi' && (selectedPathfinderSpot.data.security || 'WPA2/WPA3')}
                  {selectedPathfinderSpot.type === 'ble' && 'Bluetooth LE'}
                  {selectedPathfinderSpot.type === 'lora' && `${selectedPathfinderSpot.data.frequency} MHz`}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                <span className="text-[10px] text-[#637062] block">Asukoht (Lat, Lon)</span>
                <span className="font-bold text-[#2A9D8F]">
                  {selectedPathfinderSpot.data.latitude.toFixed(4)}, {selectedPathfinderSpot.data.longitude.toFixed(4)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                <span className="text-[10px] text-[#637062] block">Tuvastatud</span>
                <span className="font-bold text-[#E9C46A]">
                  {new Date(selectedPathfinderSpot.data.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                <span className="text-[10px] text-[#637062] block">Kõnnisessioon</span>
                <span className="font-bold text-[#E76F51] truncate block">
                  {selectedPathfinderSpot.data.walkSessionId ? selectedPathfinderSpot.data.walkSessionId.slice(0, 10) : 'Eelnevad'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPathfinderFilter((prev) => ({ ...prev, onlyNewDiscoveries: true }));
                  setSelectedPathfinderSpot(null);
                }}
                className="px-4 py-2 bg-[#E9C46A] text-[#203A2A] font-bold text-xs rounded-xl shadow-xs hover:bg-[#dfb450] cursor-pointer flex items-center gap-1.5"
              >
                <span>Filtreeri ainult uued leiud</span>
                <Sparkles className="w-3.5 h-3.5 text-[#203A2A]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Inspector Card */}
      {(selectedPeer || selectedResource) && (
        <div
          className={`rounded-3xl border p-5 shadow-md space-y-4 animate-in fade-in transition-colors ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/50 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-current/10 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E76F51]" />
              <h3 className="font-display font-bold text-base">
                {selectedResource ? 'Resource Asset Inspector' : 'Peer Node Telemetry'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPeer(null);
                setSelectedResource(null);
              }}
              className="text-xs text-[#637062] hover:text-current font-bold cursor-pointer"
            >
              Close
            </button>
          </div>

          {selectedResource && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-display font-bold text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                    {selectedResource.title}
                  </h4>
                  <span className="text-xs text-[#588157] font-semibold">
                    Category: {selectedResource.category} • {selectedResource.distanceKm} km away
                  </span>
                </div>

                <span className="text-xs font-mono font-bold px-3 py-1 bg-[#87A878]/20 text-[#588157] rounded-full border border-[#87A878]/40 self-start sm:self-auto">
                  {selectedResource.availabilityText}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-[#637062] bg-[#FAF6EE] dark:bg-[#223120] p-3 rounded-2xl border border-[#87A878]/20">
                {selectedResource.description}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onViewResourceDetails(selectedResource)}
                  className="px-4 py-2 bg-[#203A2A] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#16271c] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Request Mutual Aid Exchange</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E9C46A]" />
                </button>

                {selectedPeer && (
                  <button
                    type="button"
                    onClick={() => onOpenChatWithPeer(selectedPeer)}
                    className="px-3.5 py-2 border border-[#87A878]/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-[#FAF6EE] dark:hover:bg-[#223120] cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#588157]" />
                    <span>Message {selectedPeer.callsign}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {!selectedResource && selectedPeer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SolarpunkAvatarCanvas seed={selectedPeer.avatarSeed} size={44} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-base">{selectedPeer.callsign}</h4>
                      <span className="text-[10px] font-mono text-[#588157] font-semibold bg-[#87A878]/20 px-2 py-0.5 rounded-full">
                        {selectedPeer.connectionState.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#637062]">{selectedPeer.bio}</p>
                  </div>
                </div>

                <ReputationPill
                  completedExchanges={selectedPeer.completedExchanges}
                  onClick={() => onOpenReputation(selectedPeer)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                  <span className="text-[10px] text-[#637062] block">Signal Strength</span>
                  <span className="font-bold text-[#588157]">{selectedPeer.lastRssi} dBm</span>
                </div>
                <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                  <span className="text-[10px] text-[#637062] block">Trust Score</span>
                  <span className="font-bold text-[#2A9D8F]">{selectedPeer.trustScore}/100</span>
                </div>
                <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#223120] border border-[#87A878]/20">
                  <span className="text-[10px] text-[#637062] block">Relay Reliability</span>
                  <span className="font-bold text-[#E9C46A]">{selectedPeer.relayReliability}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectPeer(selectedPeer)}
                  className="px-4 py-2 bg-[#203A2A] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#16271c] cursor-pointer"
                >
                  View Full Node Telemetry
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChatWithPeer(selectedPeer)}
                  className="px-3.5 py-2 border border-[#87A878]/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-[#FAF6EE] dark:hover:bg-[#223120] cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#588157]" />
                  <span>Send Radio Message</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* City Selection Modal */}
      <CitySelectionModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
        selectedCityId={selectedCityId}
        onSelectCity={(newCityId) => setSelectedCityId(newCityId)}
        isNightMode={isNightMode}
      />

      {/* Walk to Reveal Info Modal */}
      {showWalkInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowWalkInfo(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#588157]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#87A878]/20 pb-3">
              <Footprints className="w-5 h-5 text-[#E76F51]" />
              <h3 className="font-display font-bold text-base">Walk to Reveal seaded</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p>
                <strong>Walk to Reveal (Kaardi avastamine)</strong> on kohalikku liikumist ja matkamist soodustav mänguline süsteem.
              </p>
              <p>
                Kaardi kohal lasub alguses udukiht (fog of war). Iga kord, kui teed oma asukohas või simuleeritud liikumisega <strong>100 sammu</strong>, avatakse sinu ümber uus <strong>50-meetrise raadiusega piirkond</strong>. See avastab ja paljastab uusi kohalikke võrgusõlmi, kogunemispunkte ja ressursse.
              </p>
              
              <div className="bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/20 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                  <span>Sammud ühe avamise jaoks:</span>
                  <span className="text-[#E76F51]">100 sammu</span>
                </div>
                <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                  <span>Avastatud ala raadius:</span>
                  <span className="text-[#2A9D8F]">50 meetrit</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWalkInfo(false)}
              className="w-full py-2.5 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Sain aru!
            </button>
          </div>
        </div>
      )}

      {/* Share / Export Perimeter Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`relative w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsShareModalOpen(false);
                setCopiedToken(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#588157]/20 border border-[#87A878]/40 flex items-center justify-center text-[#588157]">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Broadcast Community Zone</h3>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                  Offline shareable packet for mesh radio & peers
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block text-[#588157]">Zone Label / Name</label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-medium ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-white'
                    : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                }`}
                placeholder="e.g. Karlova Ecovillage Zone"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-current/10">
              <div>
                <span className="text-[10px] text-[#637062] block">Boundary Length</span>
                <span className="font-bold text-[#588157]">{perimeterLengthKm.toFixed(2)} km</span>
              </div>
              <div>
                <span className="text-[10px] text-[#637062] block">Enclosed Area</span>
                <span className="font-bold text-[#2A9D8F]">
                  {polygonArea.hectares.toFixed(1)} ha ({polygonArea.km2.toFixed(3)} km²)
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#588157] block">Offline Mesh Token</span>
              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  value={encodePerimeterToken(zoneName, perimeterPoints)}
                  className={`w-full p-2.5 rounded-xl border font-mono text-[10px] leading-tight break-all select-all resize-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>
            </div>

            <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              📡 Transmit this token over LoRa packet radio, paste in radio chat, or scan as a paper QR code. Zero internet required.
            </p>

            <button
              type="button"
              onClick={() => {
                const token = encodePerimeterToken(zoneName, perimeterPoints);
                navigator.clipboard.writeText(token);
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 3000);
              }}
              className="w-full py-2.5 rounded-xl bg-[#203A2A] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#16271c] cursor-pointer"
            >
              {copiedToken ? (
                <>
                  <Check className="w-4 h-4 text-[#87A878]" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Share Token</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Perimeter Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`relative w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-4 ${
              isNightMode
                ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportError(null);
                setImportTokenInput('');
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Import Peer Perimeter</h3>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                  Paste a shared HOIMU token to project neighbor's zone
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold block text-[#588157]">Paste Token String</label>
              <textarea
                rows={4}
                value={importTokenInput}
                onChange={(e) => {
                  setImportTokenInput(e.target.value);
                  setImportError(null);
                }}
                placeholder="HOIMU:eyJ2IjoxLCJuIjoi..."
                className={`w-full p-3 rounded-xl border font-mono text-xs leading-tight break-all ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-white'
                    : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                }`}
              />
            </div>

            {importError && (
              <p className="text-xs text-[#E76F51] bg-[#E76F51]/10 p-2.5 rounded-xl border border-[#E76F51]/30">
                {importError}
              </p>
            )}

            <button
              type="button"
              onClick={handleApplyImportToken}
              className="w-full py-2.5 rounded-xl bg-[#2A9D8F] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#238276] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Perimeter to Map</span>
            </button>
          </div>
        </div>
      )}

      {/* Download Offline Region Utility Modal */}
      <DownloadOfflineRegionModal
        isOpen={isOfflineDownloadOpen}
        onClose={() => {
          setIsOfflineDownloadOpen(false);
          setDownloadedRegions(offlineMapService.getDownloadedRegions());
        }}
        activeCity={activeCity}
        cityId={selectedCityId}
        cameraCenter={{
          x: -transform.offsetX / transform.scale,
          y: -transform.offsetY / transform.scale,
        }}
        allNodes={peers}
        allResources={resources}
        userCallsign={userCallsign}
        isNightMode={isNightMode}
        onSelectAndCenterRegion={handleCenterOnDownloadedRegion}
        onAddToast={onAddToast}
      />


      {/* Viewport Raster Cache Modal */}
      {isViewportCacheModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => viewportCacheStatus !== 'downloading' && setIsViewportCacheModalOpen(false)} />
          <div className={`relative w-full max-w-sm p-5 rounded-3xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200 ${
            isNightMode ? 'bg-[#141E12] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/30'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isNightMode ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]' : 'bg-[#2A9D8F]/10 text-[#2A9D8F]'}`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'}`}>
                    Salvesta Rasterkaardi Vaateväli
                  </h3>
                  <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                    Puhverda aktiivne piirkond Wi-Fi kaudu
                  </p>
                </div>
              </div>
              {viewportCacheStatus !== 'downloading' && (
                <button
                  type="button"
                  onClick={() => setIsViewportCacheModalOpen(false)}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="w-4 h-4 text-[#637062]" />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {viewportCacheStatus === 'estimating' ? (
                <div className="py-6 text-center text-[#637062] dark:text-[#A8BDA5]">
                  <div className="inline-block w-5 h-5 border-2 border-[#2A9D8F] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Arvutan kaardipaanide mahtu...</p>
                </div>
              ) : viewportCacheStatus === 'downloading' ? (
                <div className="py-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                    <span>Laadin alla ({viewportCacheProgress.downloaded} / {viewportCacheProgress.total})</span>
                    <span>{Math.round((viewportCacheProgress.downloaded / Math.max(1, viewportCacheProgress.total)) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-[#2A9D8F] transition-all duration-300" 
                      style={{ width: `${(viewportCacheProgress.downloaded / Math.max(1, viewportCacheProgress.total)) * 100}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-center text-[#637062] dark:text-[#A8BDA5]">
                    Palun oota, allalaadimine käib (ära sulge rakendust)
                  </p>
                </div>
              ) : viewportCacheStatus === 'done' ? (
                <div className="py-6 text-center">
                  <div className="inline-flex p-3 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#203A2A] dark:text-[#F0F5EE]">Allalaaditud!</p>
                </div>
              ) : (
                <>
                  <div className={`p-3 rounded-2xl border flex items-center gap-3 ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'}`}>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">Paanide hulk</p>
                      <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Kõik suumitasemed (Z12-Z15)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#2A9D8F]">{viewportCacheCount.toLocaleString()}</p>
                      <p className="text-[10px] text-[#637062]">Hinnanguline maht: ~{Math.ceil(viewportCacheCount * 0.02)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={handleStartViewportCache}
                    disabled={viewportCacheCount === 0}
                    className="w-full py-3 rounded-2xl bg-[#2A9D8F] text-white font-bold text-sm hover:bg-[#238276] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Alusta Allalaadimist</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pathfinder Mode Control Center & Novelty Radar Modal */}
      {isPathfinderModalOpen && (
        <React.Suspense fallback={null}>
          <PathfinderModal
            isOpen={isPathfinderModalOpen}
            onClose={() => setIsPathfinderModalOpen(false)}
            isNightMode={isNightMode}
            pathfinderFilter={pathfinderFilter}
            onUpdateFilter={setPathfinderFilter}
            onCenterMapOnLocation={(lat, lon) => {
              // Convert lat/lon to world coords and center map
              const centerLat = 58.3780;
              const centerLon = 26.7290;
              const worldX = (lon - centerLon) * 5828.0;
              const worldY = -(lat - centerLat) * 11113.9;
              setTransform((prev) => ({
                ...prev,
                offsetX: -worldX * prev.scale,
                offsetY: -worldY * prev.scale,
              }));
              setIsPathfinderModalOpen(false);
            }}
          />
        </React.Suspense>
      )}
    </div>
    </React.Suspense>
  );
});

MapViewTab.displayName = 'MapViewTab';
