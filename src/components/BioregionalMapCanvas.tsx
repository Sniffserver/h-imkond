import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  MeshNode,
  ResourceItem,
  ResourceCategory,
  TopologyFilter,
  ConnectionState,
  MapTransform,
  CityMapData,
  SurvivalPoiCategory,
  SurvivalPoi,
  WifiSpot,
  BluetoothSpot,
  LoraNode,
  WalkSession,
  PathfinderFilter,
  SOSPacket,
} from '../types';
import { getActiveSosAlerts } from '../services/utils/sosService';
import { CITY_MAPS } from '../data/cityMaps';
import { mapRevealService, localGridToGeoPoint, geoPointToLocalGrid } from '../services/map/mapRevealService';
import { cacheCityMapData, getCustomPerimeters, saveCustomPerimeter, CustomPerimeterZone, calculateFocalPointZoom } from '../utils/mapTileCache';
import { clusterResourcePins, ResourceCluster, CATEGORY_COLORS, clusterPeerNodes, PeerCluster, RawPeerPosition } from '../utils/resourceClustering';
import { computeD3BioregionalHeatmap, drawD3HeatmapOnCanvas, HeatmapMode, BioregionalHeatmapResult } from '../utils/d3BioregionalHeatmap';
import { rafScheduler } from '../utils/rafScheduler';
import { useMeshStore } from '../store/meshStore';

export type NodeFreshnessTier = 'fresh' | 'warm' | 'stale' | 'dormant';

export interface NodeFreshnessConfig {
  tier: NodeFreshnessTier;
  color: string;
  fillColor: string;
  pulseColor: string;
  label: string;
  shortLabel: string;
  alpha: number;
  dashPattern: number[];
  minutesAgo: number;
}

export function getNodeFreshness(lastSeen: string | number | undefined): NodeFreshnessConfig {
  let minutes = 3;
  if (typeof lastSeen === 'number') {
    minutes = Math.max(0, (Date.now() - lastSeen) / 60000);
  } else if (typeof lastSeen === 'string') {
    const s = lastSeen.toLowerCase().trim();
    if (s.includes('now') || s.includes('hiljuti') || s.includes('sec') || s.includes('sek') || s.includes('praegu')) {
      minutes = 0.5;
    } else if (s.includes('m ago') || s.includes('min tagasi') || s.includes('min')) {
      const match = s.match(/(\d+)/);
      minutes = match ? parseInt(match[1], 10) : 3;
    } else if (s.includes('h ago') || s.includes('tund') || s.includes('h')) {
      const match = s.match(/(\d+)/);
      minutes = match ? parseInt(match[1], 10) * 60 : 120;
    } else if (s.includes('d ago') || s.includes('päev') || s.includes('eile')) {
      minutes = 1440;
    } else {
      const parsed = Date.parse(lastSeen);
      if (!isNaN(parsed)) {
        minutes = Math.max(0, (Date.now() - parsed) / 60000);
      }
    }
  }

  if (minutes <= 5) {
    // Fresh (< 5 min) - Active High-Bandwidth Relay Path
    return {
      tier: 'fresh',
      color: '#2A9D8F',
      fillColor: '#588157',
      pulseColor: 'rgba(42, 157, 143, 0.9)',
      label: 'Aktiivne (<5m)',
      shortLabel: '<5m',
      alpha: 1.0,
      dashPattern: [],
      minutesAgo: minutes,
    };
  } else if (minutes <= 20) {
    // Warm (5-20 min) - Normal Relay Path
    return {
      tier: 'warm',
      color: '#E9C46A',
      fillColor: '#D4A338',
      pulseColor: 'rgba(233, 196, 106, 0.7)',
      label: 'Mõõdukas (5-20m)',
      shortLabel: `${Math.round(minutes)}m`,
      alpha: 0.9,
      dashPattern: [],
      minutesAgo: minutes,
    };
  } else if (minutes <= 60) {
    // Stale (20-60 min) - Degrading / Intermittent Relay Path
    return {
      tier: 'stale',
      color: '#E76F51',
      fillColor: '#C85A32',
      pulseColor: 'rgba(231, 111, 81, 0.5)',
      label: `Aegunud (${Math.round(minutes)}m)`,
      shortLabel: `${Math.round(minutes)}m`,
      alpha: 0.7,
      dashPattern: [5, 3],
      minutesAgo: minutes,
    };
  } else {
    // Dormant (> 60 min / 1h+) - Stale Relay Path
    return {
      tier: 'dormant',
      color: '#8A9286',
      fillColor: '#606B5D',
      pulseColor: 'rgba(138, 146, 134, 0.3)',
      label: `Passiivne (>1h)`,
      shortLabel: '>1h',
      alpha: 0.42,
      dashPattern: [3, 4],
      minutesAgo: minutes,
    };
  }
}

export interface BioregionalMapCanvasProps {
  peers: MeshNode[];
  resources: ResourceItem[];
  userSymbiosisScore: number;
  userCallsign: string;
  isNightMode?: boolean;
  isOverlay?: boolean;
  isEcoMode?: boolean;
  showMeshLinks?: boolean;
  showNodeFreshness?: boolean;
  showDensityHeatmap?: boolean;
  d3HeatmapMode?: HeatmapMode;
  d3HeatmapOpacity?: number;
  showSignalHeatmap?: boolean;
  showCachedZones?: boolean;
  showContours?: boolean;
  showRadii?: boolean;
  selectedCategory?: 'all' | ResourceCategory;
  topologyFilter?: TopologyFilter;
  cityId?: string;
  transform?: MapTransform;
  onTransformChange?: (newTransform: MapTransform) => void;
  onSelectNode?: (peer: MeshNode) => void;
  onSelectResource?: (resource: ResourceItem) => void;
  isClusteringEnabled?: boolean;
  // Perimeter Marker Placement Props
  isPlacingPerimeterMarker?: boolean;
  perimeterPoints?: [number, number][];
  isPerimeterClosed?: boolean;
  onAddPerimeterPoint?: (point: [number, number]) => void;
  onClosePerimeter?: () => void;
  onClearPerimeterPoints?: () => void;
  gpsPosition?: { x: number; y: number; accuracy: number; text?: string } | null;
  // New props for ruler, filters, long press
  visiblePoiCategories?: Set<SurvivalPoiCategory>;
  isRulerMode?: boolean;
  rulerPoints?: {x:number, y:number}[];
  onRulerClick?: (worldPos: {x:number, y:number}) => void;
  onLongPress?: (worldPos: {x:number, y:number}) => void;
  onUpdatePoi?: (poiId: string, updates: Partial<SurvivalPoi>) => void;
  onDeletePoi?: (poiId: string) => void;
  // Offline Street Network Route Planning
  isRouteMode?: boolean;
  routeStart?: { x: number; y: number; label?: string } | null;
  routeDestination?: { x: number; y: number; label?: string } | null;
  activeRoutePath?: [number, number][];
  onMapRouteClick?: (worldPos: { x: number; y: number }) => void;
  onSetRouteStart?: (point: { x: number; y: number; label?: string }) => void;
  onSetRouteDestination?: (point: { x: number; y: number; label?: string }) => void;
  // Pathfinder Mode Props
  showPathfinderLayer?: boolean;
  pathfinderFilter?: PathfinderFilter;
  activeWalkSession?: WalkSession | null;
  allWalkSessions?: WalkSession[];
  wifiSpots?: WifiSpot[];
  bluetoothSpots?: BluetoothSpot[];
  loraNodes?: LoraNode[];
  onSelectPathfinderSpot?: (spot: { type: 'wifi' | 'ble' | 'lora'; data: any }) => void;
  isWalkToRevealEnabled?: boolean;
  revealedCircles?: { x: number; y: number; r: number }[];
  simulatedUserPos?: { x: number; y: number };
  sosAlerts?: SOSPacket[];
  // Dead Reckoning Props
  isDeadReckoningActive?: boolean;
  deadReckoningDriftMeters?: number;
  deadReckoningConfidence?: number;
  mapInstance?: any;
}

export const BioregionalMapCanvas: React.FC<BioregionalMapCanvasProps> = React.memo(({
  peers,
  resources,
  userSymbiosisScore,
  userCallsign,
  isNightMode = false,
  isOverlay = false,
  isEcoMode = false,
  showMeshLinks = true,
  showNodeFreshness = true,
  showDensityHeatmap = true,
  d3HeatmapMode = 'combined',
  d3HeatmapOpacity = 0.65,
  mapInstance,
  showSignalHeatmap = true,
  showCachedZones = true,
  showContours = true,
  showRadii = true,
  selectedCategory = 'all',
  topologyFilter = 'all',
  cityId = 'tartu',
  transform: externalTransform,
  onTransformChange,
  onSelectNode,
  onSelectResource,
  isClusteringEnabled = true,
  isPlacingPerimeterMarker = false,
  perimeterPoints = [],
  isPerimeterClosed = false,
  onAddPerimeterPoint,
  onClosePerimeter,
  onClearPerimeterPoints,
  gpsPosition,
  visiblePoiCategories,
  isRulerMode = false,
  rulerPoints = [],
  onRulerClick,
  onLongPress,
  onUpdatePoi,
  onDeletePoi,
  isRouteMode = false,
  routeStart = null,
  routeDestination = null,
  activeRoutePath = [],
  onMapRouteClick,
  onSetRouteStart,
  onSetRouteDestination,
  showPathfinderLayer = true,
  pathfinderFilter,
  activeWalkSession,
  allWalkSessions = [],
  wifiSpots = [],
  bluetoothSpots = [],
  loraNodes = [],
  onSelectPathfinderSpot,
  isWalkToRevealEnabled = false,
  revealedCircles = [],
  simulatedUserPos,
  sosAlerts,
  isDeadReckoningActive = false,
  deadReckoningDriftMeters = 0,
  deadReckoningConfidence = 100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const d3HeatmapCacheRef = useRef<BioregionalHeatmapResult | null>(null);
  const lastD3ComputeKeyRef = useRef<string>('');

  // Live cursor position in world space for perimeter drawing guide line
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [isNearFirstPerimeterPoint, setIsNearFirstPerimeterPoint] = useState(false);
  const [mapMoveCount, setMapMoveCount] = useState(0);

  // Internal Map Transform state if not controlled externally
  const [internalTransform, setInternalTransform] = useState<MapTransform>({
    scale: 1.0,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const activeExternalTransform = externalTransform || internalTransform;

  // High-frequency mutable ref for 60FPS fluid canvas transformations
  const transformRef = useRef<MapTransform>(activeExternalTransform);

  // Active Focal Point Visual Reticle Indicator Reference
  const activeFocalPointRef = useRef<{
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    scale: number;
    timestamp: number;
  } | null>(null);

  // Sync ref when parent passes new externalTransform (e.g. from city switch or control buttons)
  useEffect(() => {
    if (externalTransform) {
      const curr = transformRef.current;
      const scaleChanged = Math.abs(curr.scale - externalTransform.scale) > 0.001;
      if (
        scaleChanged ||
        Math.abs(curr.rotation - externalTransform.rotation) > 0.001 ||
        Math.abs(curr.offsetX - externalTransform.offsetX) > 0.5 ||
        Math.abs(curr.offsetY - externalTransform.offsetY) > 0.5
      ) {
        transformRef.current = externalTransform;

        // If scale changed externally (e.g. +/- buttons) and no recent active focal point,
        // center the focal reticle in the viewport
        if (
          scaleChanged &&
          (!activeFocalPointRef.current || performance.now() - activeFocalPointRef.current.timestamp > 700)
        ) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            activeFocalPointRef.current = {
              screenX: rect.width / 2,
              screenY: rect.height / 2,
              worldX: 0,
              worldY: 0,
              scale: externalTransform.scale,
              timestamp: performance.now(),
            };
          }
        }
      }
    }
  }, [externalTransform]);

  // State-update throttle to the parent component:
  // Prevents excessive React UI recalculations during high-velocity gestures, maintaining 60FPS fluid motion
  const lastSyncTimeRef = useRef<number>(0);
  const pendingSyncRef = useRef<MapTransform | null>(null);
  const syncRafRef = useRef<number | null>(null);

  const syncTransformToParent = useCallback(
    (newTransform: MapTransform, immediate: boolean = false) => {
      pendingSyncRef.current = newTransform;

      if (immediate) {
        if (syncRafRef.current !== null) {
          cancelAnimationFrame(syncRafRef.current);
          syncRafRef.current = null;
        }
        lastSyncTimeRef.current = performance.now();
        if (onTransformChange) {
          onTransformChange(newTransform);
        } else {
          setInternalTransform(newTransform);
        }
        pendingSyncRef.current = null;
        return;
      }

      // requestAnimationFrame-based throttle: high-frequency pointer move events
      // (panning, pinch-zooming) update the component state at most once per frame,
      // maintaining a consistent 60FPS fluid motion.
      if (syncRafRef.current === null) {
        syncRafRef.current = requestAnimationFrame(() => {
          syncRafRef.current = null;
          if (pendingSyncRef.current) {
            const next = pendingSyncRef.current;
            pendingSyncRef.current = null;
            if (onTransformChange) {
              onTransformChange(next);
            } else {
              setInternalTransform(next);
            }
          }
        });
      }
    },
    [onTransformChange]
  );

  const updateTransform = useCallback(
    (updater: (prev: MapTransform) => MapTransform, immediate: boolean = false) => {
      const next = updater(transformRef.current);
      transformRef.current = next;
      syncTransformToParent(next, immediate);
    },
    [syncTransformToParent]
  );

  // Kinetic Scrolling (Inertia Pan) Physics Engine
  const velocityHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const kineticAnimationId = useRef<number | null>(null);

  const stopKineticPan = useCallback(() => {
    if (kineticAnimationId.current !== null) {
      cancelAnimationFrame(kineticAnimationId.current);
      kineticAnimationId.current = null;
    }
  }, []);

  const startKineticPan = useCallback(
    (initialVx: number, initialVy: number) => {
      stopKineticPan();

      // Accessibility: Respect prefers-reduced-motion
      const prefersReducedMotion =
        (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || isEcoMode;

      if (prefersReducedMotion) {
        // Accessibility: Disable animated inertia sliding for users requesting reduced motion
        syncTransformToParent(transformRef.current, true);
        return;
      }

      let vx = initialVx;
      let vy = initialVy;
      let lastTime = performance.now();
      const friction = 0.942; // Deceleration factor per 16ms frame

      const kineticStep = (now: number) => {
        const elapsed = Math.min(now - lastTime, 48); // Cap elapsed time
        lastTime = now;

        const frameFactor = elapsed / 16.67;
        const currentFriction = Math.pow(friction, frameFactor);

        vx *= currentFriction;
        vy *= currentFriction;

        const dx = vx * elapsed;
        const dy = vy * elapsed;

        // Stop condition when speed decays below threshold
        if (Math.hypot(vx, vy) < 0.02) {
          kineticAnimationId.current = null;
          syncTransformToParent(transformRef.current, true);
          return;
        }

        transformRef.current = {
          ...transformRef.current,
          offsetX: transformRef.current.offsetX + dx,
          offsetY: transformRef.current.offsetY + dy,
        };

        syncTransformToParent(transformRef.current, false);
        kineticAnimationId.current = requestAnimationFrame(kineticStep);
      };

      kineticAnimationId.current = requestAnimationFrame(kineticStep);
    },
    [stopKineticPan, syncTransformToParent]
  );

  const checkKineticRelease = useCallback(() => {
    const history = velocityHistoryRef.current;
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
          const maxSpeed = 2.6; // Max 2600 px/s clamp for natural feel
          const scale = speed > maxSpeed ? maxSpeed / speed : 1.0;
          startKineticPan(rawVx * scale, rawVy * scale);
          velocityHistoryRef.current = [];
          return;
        }
      }
    }
    velocityHistoryRef.current = [];
    syncTransformToParent(transformRef.current, true);
  }, [startKineticPan, syncTransformToParent]);

  // Active City Map Data
  const cityData: CityMapData = CITY_MAPS[cityId] || CITY_MAPS.tartu;

  // IndexedDB Cache Sync State
  const [isIndexedDBCached, setIsIndexedDBCached] = useState(false);

  useEffect(() => {
    // Sync active city vector data into IndexedDB cache
    cacheCityMapData(cityData).then(() => {
      setIsIndexedDBCached(true);
    });
  }, [cityData]);

  // Hover and selection state inside canvas
  const [hoveredEntity, setHoveredEntity] = useState<{
    type: 'peer' | 'peerCluster' | 'resource' | 'resourceCluster' | 'user' | 'landmark' | 'compass' | 'survivalPoi';
    id: string;
    title: string;
    subtitle: string;
    worldX: number;
    worldY: number;
  } | null>(null);

  // Selected Resource Cluster Popup for inspecting grouped items
  const [selectedClusterPopup, setSelectedClusterPopup] = useState<{
    cluster: ResourceCluster;
    x: number;
    y: number;
  } | null>(null);

  // Selected Peer Cluster Popup for inspecting grouped mesh nodes
  const [selectedPeerClusterPopup, setSelectedPeerClusterPopup] = useState<{
    cluster: PeerCluster;
    x: number;
    y: number;
  } | null>(null);

  // Interaction States for Drag / Pinch / Rotate
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; initialOffsetX: number; initialOffsetY: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const touchStartRef = useRef<{
    dist: number;
    angle: number;
    initialScale: number;
    initialRotation: number;
    initialOffsetX: number;
    initialOffsetY: number;
    focalWorldX: number;
    focalWorldY: number;
  } | null>(null);

  // Filtered resources
  const visibleResources = resources.filter(
    (r) => selectedCategory === 'all' || r.category === selectedCategory
  );

  // Category Color Map
  const categoryColors: Record<ResourceCategory, string> = {
    Energy: '#F4A261',
    Tools: '#2A9D8F',
    Food: '#87A878',
    Skills: '#E9C46A',
    'Care & Housing': '#588157',
    'Bio-Remedy': '#E76F51',
    'Electronics': '#6366F1',
  };

  // Helper to check if a world point is within revealed areas
  const isPointRevealed = useCallback((x: number, y: number, userPos?: { x: number; y: number }) => {
    if (!isWalkToRevealEnabled) return true;
    
    // Always reveal near the user's position if provided
    if (userPos) {
      const dxUser = x - userPos.x;
      const dyUser = y - userPos.y;
      if (dxUser * dxUser + dyUser * dyUser < 65 * 65) {
        return true;
      }
    }

    // Always reveal near origin (0,0) so the center is visible initially
    const dxOrigin = x;
    const dyOrigin = y;
    if (dxOrigin * dxOrigin + dyOrigin * dyOrigin < 65 * 65) {
      return true;
    }

    // Check mapRevealService with geocoordinates
    const geoPoint = localGridToGeoPoint(x, y, cityData.centerCoordsText);
    if (mapRevealService.isPointRevealed(geoPoint.latitude, geoPoint.longitude)) {
      return true;
    }

    for (const circle of revealedCircles) {
      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy < circle.r * circle.r) {
        return true;
      }
    }
    return false;
  }, [isWalkToRevealEnabled, revealedCircles, cityData.centerCoordsText]);

  // World Coordinates Calculation (Centered at 0,0)
  const calculateWorldPositions = useCallback((activeScale?: number) => {
    const baseMaxRadius = (isOverlay && mapInstance) ? 280 : 180;

    // Get the most up-to-date scale for clustering and collision resolution
    let scale = activeScale ?? transformRef.current.scale;
    if (activeScale === undefined && isOverlay && mapInstance) {
      try {
        const centerGeo = localGridToGeoPoint(0, 0, cityData.centerCoordsText);
        const centerPixel = mapInstance.project([centerGeo.longitude, centerGeo.latitude]);
        const testGeo = localGridToGeoPoint(100, 0, cityData.centerCoordsText);
        const testPixel = mapInstance.project([testGeo.longitude, testGeo.latitude]);
        scale = Math.hypot(testPixel.x - centerPixel.x, testPixel.y - centerPixel.y) / 100;
      } catch (e) {
        scale = Math.pow(2, mapInstance.getZoom() - 13);
      }
    }

    // User node position
    const userWorldPos = simulatedUserPos 
      ? { x: simulatedUserPos.x, y: simulatedUserPos.y }
      : (gpsPosition ? { x: gpsPosition.x, y: gpsPosition.y } : { x: 0, y: 0 });

    // Peer positions calculated from polar angle & distanceRatio
    const allPeerWorldPositions = peers.map((p) => {
      const rad = (p.angle * Math.PI) / 180;
      const dist = p.distanceRatio * baseMaxRadius;
      const x = Math.cos(rad) * dist;
      const y = Math.sin(rad) * dist;
      return { peer: p, x, y, distKm: (p.distanceRatio * 1.5).toFixed(1) };
    });

    // Filter peers if Walk to Reveal is enabled
    const peerWorldPositions = isWalkToRevealEnabled
      ? allPeerWorldPositions.filter((pp) => isPointRevealed(pp.x, pp.y, userWorldPos))
      : allPeerWorldPositions;

    // Map resources to peer locations with slight offsets
    const rawResourcePositions = visibleResources.map((res, idx) => {
      const ownerPeer = peers.find((p) => p.id === res.ownerId);
      let baseX = 0;
      let baseY = 0;

      if (ownerPeer) {
        const peerPos = allPeerWorldPositions.find((pp) => pp.peer.id === ownerPeer.id);
        if (peerPos) {
          baseX = peerPos.x;
          baseY = peerPos.y;
        }
      } else if (res.coordinates) {
        baseX = res.coordinates.x;
        baseY = res.coordinates.y;
      }

      const angleOffset = (idx * 65 * Math.PI) / 180;
      const offsetDist = 20;
      const x = baseX + Math.cos(angleOffset) * offsetDist;
      const y = baseY + Math.sin(angleOffset) * offsetDist;

      return { resource: res, x, y, color: categoryColors[res.category] || '#87A878' };
    });

    // Filter rawResourcePositions if Walk to Reveal is enabled
    const activeResourcePositions = isWalkToRevealEnabled
      ? rawResourcePositions.filter((rp) => isPointRevealed(rp.x, rp.y, userWorldPos))
      : rawResourcePositions;

    // Run spatial clustering for mesh peer nodes with current scale
    const peerClusters = clusterPeerNodes(
      peerWorldPositions,
      scale,
      isClusteringEnabled,
      48
    );

    // Run spatial clustering with current scale
    const resourceClusters = clusterResourcePins(
      activeResourcePositions,
      scale,
      isClusteringEnabled,
      44
    );

    // Collision resolution & relaxation between peer clusters and resource clusters to prevent visual overlap
    // Running 3 iterations of relaxation to resolve overlapping elements (35px minimum separation on screen)
    if (isClusteringEnabled && scale > 0.1) {
      const minDistanceWorld = 35 / scale;
      for (let iter = 0; iter < 3; iter++) {
        // A. Resolve overlap between resource clusters/pins and peer clusters/pins
        for (let i = 0; i < resourceClusters.length; i++) {
          const rc = resourceClusters[i];
          for (let j = 0; j < peerClusters.length; j++) {
            const pc = peerClusters[j];
            const dx = rc.x - pc.x;
            const dy = rc.y - pc.y;
            const dist = Math.hypot(dx, dy);
            if (dist < minDistanceWorld) {
              const angle = dist > 0.1 ? Math.atan2(dy, dx) : (i * 1.3 + iter * 0.7);
              const nudge = (minDistanceWorld - dist) * 0.6; // Nudge factor
              rc.x += Math.cos(angle) * nudge;
              rc.y += Math.sin(angle) * nudge;
            }
          }
        }

        // B. Resolve overlap among resource clusters/pins themselves
        for (let i = 0; i < resourceClusters.length; i++) {
          const r1 = resourceClusters[i];
          for (let j = i + 1; j < resourceClusters.length; j++) {
            const r2 = resourceClusters[j];
            const dx = r2.x - r1.x;
            const dy = r2.y - r1.y;
            const dist = Math.hypot(dx, dy);
            if (dist < minDistanceWorld) {
              const angle = dist > 0.1 ? Math.atan2(dy, dx) : (i * 1.3 + j * 0.9);
              const nudge = (minDistanceWorld - dist) * 0.3;
              r1.x -= Math.cos(angle) * nudge;
              r1.y -= Math.sin(angle) * nudge;
              r2.x += Math.cos(angle) * nudge;
              r2.y += Math.sin(angle) * nudge;
            }
          }
        }

        // C. Resolve overlap among peer clusters/pins themselves
        for (let i = 0; i < peerClusters.length; i++) {
          const p1 = peerClusters[i];
          for (let j = i + 1; j < peerClusters.length; j++) {
            const p2 = peerClusters[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            if (dist < minDistanceWorld) {
              const angle = dist > 0.1 ? Math.atan2(dy, dx) : (i * 1.3 + j * 0.9);
              const nudge = (minDistanceWorld - dist) * 0.3;
              p1.x -= Math.cos(angle) * nudge;
              p1.y -= Math.sin(angle) * nudge;
              p2.x += Math.cos(angle) * nudge;
              p2.y += Math.sin(angle) * nudge;
            }
          }
        }
      }
    }

    return {
      userWorldPos,
      peerWorldPositions,
      peerClusters,
      resourceWorldPositions: activeResourcePositions,
      resourceClusters,
      baseMaxRadius,
    };
  }, [
    peers, 
    visibleResources, 
    isClusteringEnabled, 
    isWalkToRevealEnabled, 
    isPointRevealed, 
    simulatedUserPos, 
    gpsPosition,
    isOverlay,
    mapInstance,
    cityData.centerCoordsText,
  ]);

  // Coordinate Conversion Helpers (reading live transformRef for 60FPS precision)
  const getScreenCoords = useCallback(
    (worldX: number, worldY: number, canvasWidth: number, canvasHeight: number) => {
      if (isOverlay && mapInstance) {
        try {
          const geo = localGridToGeoPoint(worldX, worldY, cityData.centerCoordsText);
          const pos = mapInstance.project([geo.longitude, geo.latitude]);
          return { screenX: pos.x, screenY: pos.y };
        } catch (e) {
          // fallback
        }
      }

      const current = transformRef.current;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      const cosR = Math.cos(current.rotation);
      const sinR = Math.sin(current.rotation);

      const rotX = worldX * cosR - worldY * sinR;
      const rotY = worldX * sinR + worldY * cosR;

      const screenX = centerX + current.offsetX + rotX * current.scale;
      const screenY = centerY + current.offsetY + rotY * current.scale;

      return { screenX, screenY };
    },
    [isOverlay, mapInstance, cityData?.centerCoordsText]
  );

  const getWorldCoords = useCallback(
    (screenX: number, screenY: number, canvasWidth: number, canvasHeight: number) => {
      if (isOverlay && mapInstance) {
        try {
          const lngLat = mapInstance.unproject([screenX, screenY]);
          const grid = geoPointToLocalGrid(lngLat.lat, lngLat.lng, cityData.centerCoordsText);
          return { worldX: grid.x, worldY: grid.y };
        } catch (e) {
          // fallback
        }
      }

      const current = transformRef.current;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      const dx = screenX - (centerX + current.offsetX);
      const dy = screenY - (centerY + current.offsetY);

      const unscaledX = dx / current.scale;
      const unscaledY = dy / current.scale;

      const cosR = Math.cos(-current.rotation);
      const sinR = Math.sin(-current.rotation);

      const worldX = unscaledX * cosR - unscaledY * sinR;
      const worldY = unscaledX * sinR + unscaledY * cosR;

      return { worldX, worldY };
    },
    [isOverlay, mapInstance, cityData?.centerCoordsText]
  );

  // Helper function to render visual category-specific map pins
  const drawCategoryMapPin = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    category: ResourceCategory,
    color: string,
    isNightMode: boolean,
    isHovered: boolean,
    isPulseActive: boolean = false,
    elapsed: number = 0
  ) => {
    ctx.save();

    const pinScale = (isHovered ? 1.25 : 1.0) / transformRef.current.scale;
    const pinHeadRadius = 11 * pinScale;
    const pinTipY = y;
    const pinHeadCenterY = y - 18 * pinScale;

    // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil (lihtne ring ilma varjudeta ja gradientideta)
    if (transformRef.current.scale < 1.1 && !isHovered) {
      const r = 6.5 / transformRef.current.scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#141E12' : '#FAF6EE';
      ctx.lineWidth = 1.2 / transformRef.current.scale;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // 0. Optional pulse ring for newly discovered resources / active pulse
    if (isPulseActive) {
      const pulseCycle = (elapsed * 2.0) % 1;
      const pulseRadius = pinHeadRadius + (pulseCycle * 14) / transformRef.current.scale;
      const pulseAlpha = Math.max(0, (1 - pulseCycle) * 0.75);
      ctx.beginPath();
      ctx.arc(x, pinHeadCenterY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6 / transformRef.current.scale;
      ctx.globalAlpha = pulseAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // 1. Halo Shadow underneath pin tip - only for hovered elements to avoid expensive shadow draws
    if (isHovered) {
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * pinScale, 7 * pinScale, 3 * pinScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = isNightMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(32, 58, 42, 0.22)';
      ctx.fill();
    }

    // 2. Teardrop Map Pin Silhouette Path
    ctx.beginPath();
    ctx.moveTo(x, pinTipY);
    ctx.bezierCurveTo(
      x - pinHeadRadius * 1.1,
      y - 8 * pinScale,
      x - pinHeadRadius * 1.2,
      pinHeadCenterY - pinHeadRadius * 0.5,
      x - pinHeadRadius,
      pinHeadCenterY
    );
    ctx.arc(x, pinHeadCenterY, pinHeadRadius, Math.PI, 0, false);
    ctx.bezierCurveTo(
      x + pinHeadRadius * 1.2,
      pinHeadCenterY - pinHeadRadius * 0.5,
      x + pinHeadRadius * 1.1,
      y - 8 * pinScale,
      x,
      pinTipY
    );
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = isNightMode ? '#FAF6EE' : '#203A2A';
    ctx.lineWidth = 1.8 * pinScale;
    ctx.stroke();

    // 3. Category Symbol inside Pin Head
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5 * pinScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = x;
    const cy = pinHeadCenterY;

    switch (category) {
      case 'Tools':
        ctx.beginPath();
        ctx.moveTo(cx - 4 * pinScale, cy - 4 * pinScale);
        ctx.lineTo(cx + 4 * pinScale, cy + 4 * pinScale);
        ctx.moveTo(cx + 3 * pinScale, cy - 4 * pinScale);
        ctx.lineTo(cx - 3 * pinScale, cy + 4 * pinScale);
        ctx.stroke();
        break;

      case 'Food':
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5 * pinScale);
        ctx.quadraticCurveTo(cx - 4 * pinScale, cy, cx, cy - 5 * pinScale);
        ctx.quadraticCurveTo(cx + 4 * pinScale, cy, cx, cy + 5 * pinScale);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5 * pinScale);
        ctx.lineTo(cx, cy - 5 * pinScale);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * pinScale;
        ctx.stroke();
        break;

      case 'Energy':
        ctx.beginPath();
        ctx.moveTo(cx + 1 * pinScale, cy - 6 * pinScale);
        ctx.lineTo(cx - 4 * pinScale, cy + 1 * pinScale);
        ctx.lineTo(cx - 1 * pinScale, cy + 1 * pinScale);
        ctx.lineTo(cx - 2 * pinScale, cy + 6 * pinScale);
        ctx.lineTo(cx + 4 * pinScale, cy - 1 * pinScale);
        ctx.lineTo(cx + 1 * pinScale, cy - 1 * pinScale);
        ctx.closePath();
        ctx.fill();
        break;

      case 'Skills':
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5 * pinScale);
        ctx.lineTo(cx + 6 * pinScale, cy - 2 * pinScale);
        ctx.lineTo(cx, cy + 1 * pinScale);
        ctx.lineTo(cx - 6 * pinScale, cy - 2 * pinScale);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 4 * pinScale, cy - 1 * pinScale);
        ctx.lineTo(cx + 4 * pinScale, cy + 4 * pinScale);
        ctx.stroke();
        break;

      case 'Care & Housing':
        ctx.beginPath();
        ctx.moveTo(cx - 5 * pinScale, cy - 1 * pinScale);
        ctx.lineTo(cx, cy - 5 * pinScale);
        ctx.lineTo(cx + 5 * pinScale, cy - 1 * pinScale);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(cx - 3.5 * pinScale, cy - 1 * pinScale, 7 * pinScale, 5 * pinScale);
        ctx.fill();
        break;

      case 'Bio-Remedy':
      case 'Electronics':
        ctx.beginPath();
        ctx.rect(cx - 5 * pinScale, cy - 2 * pinScale, 10 * pinScale, 4 * pinScale);
        ctx.rect(cx - 2 * pinScale, cy - 5 * pinScale, 4 * pinScale, 10 * pinScale);
        ctx.fill();
        break;

      default:
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * pinScale, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  };

  // Helper function to render a high-density resource cluster badge
  const drawResourceClusterBadge = (
    ctx: CanvasRenderingContext2D,
    cluster: ResourceCluster,
    isNightMode: boolean,
    isHovered: boolean,
    elapsed: number
  ) => {
    ctx.save();
    const scale = transformRef.current.scale;
    const baseRadius = (isHovered ? 17 : 14.5) / scale;
    const x = cluster.x;
    const y = cluster.y;

    // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil (lihtne ring koos numbriga, ilma varjudeta)
    if (scale < 1.1 && !isHovered) {
      const r = 11.5 / scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = cluster.dominantColor;
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#182315' : '#FFFFFF';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(8, 10 / scale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cluster.count}`, x, y + 0.5 / scale);
      ctx.restore();
      return;
    }

    // 1. Drop shadow underneath cluster badge - only when hovered
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y + 2 / scale, baseRadius + 3 / scale, 0, Math.PI * 2);
      ctx.fillStyle = isNightMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(32, 58, 42, 0.25)';
      ctx.fill();
    }

    // 2. Pulse animated halo if hovered
    if (isHovered) {
      const pulseWave = baseRadius + (6 + Math.sin(elapsed * 6) * 3) / scale;
      ctx.beginPath();
      ctx.arc(x, y, pulseWave, 0, Math.PI * 2);
      ctx.strokeStyle = cluster.dominantColor;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }

    // 3. Multi-category segmented pie ring
    const catKeys = Object.keys(cluster.categoryCounts);
    let startAngle = -Math.PI / 2;
    const totalCount = cluster.count;

    catKeys.forEach((cat) => {
      const count = cluster.categoryCounts[cat] || 1;
      const sliceAngle = (count / totalCount) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const catColor = CATEGORY_COLORS[cat as ResourceCategory] || cluster.dominantColor;

      ctx.beginPath();
      ctx.arc(x, y, baseRadius + 2.5 / scale, startAngle, endAngle);
      ctx.strokeStyle = catColor;
      ctx.lineWidth = 3.5 / scale;
      ctx.lineCap = 'butt';
      ctx.stroke();

      startAngle = endAngle;
    });

    // 4. Central Solid Core
    ctx.beginPath();
    ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = isNightMode ? '#182315' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = isNightMode ? '#364E30' : '#87A878';
    ctx.lineWidth = 1.8 / scale;
    ctx.stroke();

    // 5. Inner Core Disc
    ctx.beginPath();
    ctx.arc(x, y, baseRadius - 2.5 / scale, 0, Math.PI * 2);
    ctx.fillStyle = cluster.dominantColor;
    ctx.fill();

    // 6. Cluster Count Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, (isHovered ? 13 : 11) / scale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cluster.count}`, x, y + 0.5 / scale);

    // 7. Cluster micro label if zoomed in
    if (scale > 1.2 || isHovered) {
      ctx.fillStyle = isNightMode ? '#F0F5EE' : '#203A2A';
      ctx.font = `bold ${Math.max(7, 8 / scale)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${cluster.count} RES`, x, y - baseRadius - 3.5 / scale);
    }

    ctx.restore();
  };

  // Helper function to render a high-density peer node cluster badge (mesh nodes cluster)
  const drawPeerClusterBadge = (
    ctx: CanvasRenderingContext2D,
    cluster: PeerCluster,
    isNightMode: boolean,
    isHovered: boolean,
    elapsed: number
  ) => {
    ctx.save();
    const scale = transformRef.current.scale;
    const baseRadius = (isHovered ? 18 : 15) / scale;
    const x = cluster.x;
    const y = cluster.y;

    // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil (lihtne ring koos numbriga, ilma varjudeta)
    if (scale < 1.1 && !isHovered) {
      const r = 12 / scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = cluster.directCount > 0 ? '#588157' : '#F4A261';
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#182315' : '#FFFFFF';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(8, 10 / scale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cluster.count}`, x, y + 0.5 / scale);
      ctx.restore();
      return;
    }

    // 1. Drop shadow underneath peer cluster badge - only when hovered
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y + 2 / scale, baseRadius + 3 / scale, 0, Math.PI * 2);
      ctx.fillStyle = isNightMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(32, 58, 42, 0.25)';
      ctx.fill();
    }

    // 2. Pulse animated radio halo if hovered or active direct peers exist
    const prefersReducedMotion =
      (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) || isEcoMode;

    if (isHovered || (!prefersReducedMotion && cluster.directCount > 0)) {
      const pulseWave = baseRadius + (5 + Math.sin(elapsed * 5) * 3) / scale;
      ctx.beginPath();
      ctx.arc(x, y, pulseWave, 0, Math.PI * 2);
      ctx.strokeStyle = cluster.directCount > 0 ? '#588157' : '#F4A261';
      ctx.lineWidth = 1.8 / scale;
      ctx.stroke();
    }

    // 3. Status Ring: Direct (green) vs Relayed (amber) ratio
    const totalCount = cluster.count;
    const directAngle = (cluster.directCount / totalCount) * Math.PI * 2;

    // Background ring
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + 2.5 / scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#F4A261'; // Relayed color
    ctx.lineWidth = 3 / scale;
    ctx.stroke();

    if (cluster.directCount > 0) {
      ctx.beginPath();
      ctx.arc(x, y, baseRadius + 2.5 / scale, -Math.PI / 2, -Math.PI / 2 + directAngle);
      ctx.strokeStyle = '#588157'; // Direct color
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
    }

    // 4. Central Disc
    ctx.beginPath();
    ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = isNightMode ? '#182315' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = isNightMode ? '#364E30' : '#87A878';
    ctx.lineWidth = 1.8 / scale;
    ctx.stroke();

    // 5. Inner Core Disc
    ctx.beginPath();
    ctx.arc(x, y, baseRadius - 2.5 / scale, 0, Math.PI * 2);
    ctx.fillStyle = cluster.directCount > 0 ? '#588157' : '#E76F51';
    ctx.fill();

    // 6. Cluster Count Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(8, (isHovered ? 13 : 11) / scale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cluster.count}`, x, y + 0.5 / scale);

    // 7. Cluster micro label (e.g. "3 SÕLME")
    if (scale > 1.2 || isHovered) {
      ctx.fillStyle = isNightMode ? '#F0F5EE' : '#203A2A';
      ctx.font = `bold ${Math.max(7, 8 / scale)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${cluster.count} SÕLME`, x, y - baseRadius - 3.5 / scale);
    }

    ctx.restore();
  };

  // Dynamic Compass Rose Drawer in Screen Space
  const drawCompassRose = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    rotation: number,
    isNightMode: boolean
  ) => {
    ctx.save();
    ctx.translate(cx, cy);

    // Compass Background Disk
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = isNightMode ? 'rgba(24, 35, 21, 0.88)' : 'rgba(250, 246, 238, 0.92)';
    ctx.fill();
    ctx.strokeStyle = isNightMode ? '#364E30' : '#87A878';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Degree Ticks Ring
    ctx.strokeStyle = isNightMode ? '#588157' : '#A8BDA5';
    ctx.lineWidth = 1;
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const x1 = Math.cos(rad) * (radius - 5);
      const y1 = Math.sin(rad) * (radius - 5);
      const x2 = Math.cos(rad) * radius;
      const y2 = Math.sin(rad) * radius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Rotating Needle & Star Pointer
    ctx.rotate(-rotation);

    // North Needle (Gold / Terra Cotta)
    ctx.beginPath();
    ctx.moveTo(0, -(radius - 6));
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#E9C46A';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -(radius - 6));
    ctx.lineTo(-4, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#E76F51';
    ctx.fill();

    // South Needle (Sage / Dark)
    ctx.beginPath();
    ctx.moveTo(0, radius - 6);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fillStyle = isNightMode ? '#588157' : '#87A878';
    ctx.fill();

    // Cardinal Direction Labels
    ctx.fillStyle = '#E9C46A';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -(radius - 14));

    ctx.fillStyle = isNightMode ? '#A8BDA5' : '#637062';
    ctx.font = 'bold 8px Outfit, sans-serif';
    ctx.fillText('S', 0, radius - 12);
    ctx.fillText('E', radius - 10, 0);
    ctx.fillText('W', -(radius - 10), 0);

    ctx.restore();
  };

  // Pre-calculate fog-of-war mask to avoid heavy path operations during 60FPS render loop
  const cachedFogCanvas = React.useMemo(() => {
    if (!isWalkToRevealEnabled || typeof window === 'undefined') return null;
    const fogSize = 600;
    const canvas = document.createElement('canvas');
    canvas.width = fogSize * 2;
    canvas.height = fogSize * 2;
    const fogCtx = canvas.getContext('2d');
    if (!fogCtx) return null;

    fogCtx.fillStyle = isNightMode 
      ? 'rgba(10, 16, 9, 0.90)' // Deep solarpunk dark fog
      : 'rgba(235, 230, 218, 0.88)'; // Clean light off-white fog
    
    fogCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Use destination-out to clear circles
    fogCtx.globalCompositeOperation = 'destination-out';
    fogCtx.fillStyle = '#000000';

    fogCtx.translate(fogSize, fogSize); // center world origin at canvas center

    // Determine current user world pos for this memo computation
    const uPos = simulatedUserPos 
      ? { x: simulatedUserPos.x, y: simulatedUserPos.y }
      : (gpsPosition ? { x: gpsPosition.x, y: gpsPosition.y } : { x: 0, y: 0 });

    // 1. Clear user current position
    fogCtx.beginPath();
    fogCtx.arc(uPos.x, uPos.y, 65, 0, Math.PI * 2);
    fogCtx.fill();

    // 2. Clear starting origin (0, 0)
    fogCtx.beginPath();
    fogCtx.arc(0, 0, 65, 0, Math.PI * 2);
    fogCtx.fill();

    // 3. Clear all permanently unlocked areas
    revealedCircles.forEach((circle) => {
      fogCtx.beginPath();
      fogCtx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      fogCtx.fill();
    });

    // 4. Clear all areas revealed via mapRevealService
    try {
      const serviceAreas = mapRevealService.getRevealedAreas();
      serviceAreas.forEach((area) => {
        const gridPos = geoPointToLocalGrid(area.centerLat, area.centerLng, cityData.centerCoordsText);
        const radiusGrid = area.radiusMeters / 10.71; // convert 50m to grid units
        fogCtx.beginPath();
        fogCtx.arc(gridPos.x, gridPos.y, radiusGrid, 0, Math.PI * 2);
        fogCtx.fill();
      });
    } catch (e) {
      console.warn('Error rendering mapRevealService areas:', e);
    }

    return canvas;
  }, [
    isWalkToRevealEnabled, 
    isNightMode, 
    simulatedUserPos?.x, 
    simulatedUserPos?.y,
    gpsPosition?.x,
    gpsPosition?.y,
    revealedCircles, 
    cityData.centerCoordsText
  ]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startPulseTime = Date.now();
    let lastPulseStepTime = Date.now();
    let throttledElapsed = 0;
    let lastRenderTime = 0;

    const render = () => {
      const now = Date.now();
      const isMapMoving = isOverlay && mapInstance && (mapInstance.isMoving() || mapInstance.isZooming());
      const targetFps = (isDragging || isMapMoving)
        ? (isEcoMode ? 30 : 60)
        : (isEcoMode ? 6 : (isOverlay ? 15 : 20));
      const interval = 1000 / targetFps;
      if (now - lastRenderTime < interval) {
        return;
      }
      lastRenderTime = now;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const dpr = window.devicePixelRatio || 1;

      let transform = transformRef.current;
      if (isOverlay && mapInstance) {
        try {
          const centerGeo = localGridToGeoPoint(0, 0, cityData.centerCoordsText);
          const centerPixel = mapInstance.project([centerGeo.longitude, centerGeo.latitude]);
          
          const testGeo = localGridToGeoPoint(100, 0, cityData.centerCoordsText);
          const testPixel = mapInstance.project([testGeo.longitude, testGeo.latitude]);
          
          const calcScale = Math.hypot(testPixel.x - centerPixel.x, testPixel.y - centerPixel.y) / 100;
          const bearingRad = -(mapInstance.getBearing() || 0) * Math.PI / 180;
          
          transform = {
            scale: calcScale,
            rotation: bearingRad,
            offsetX: centerPixel.x - width / 2,
            offsetY: centerPixel.y - height / 2,
          };
        } catch (e) {
          // Keep standard transform as fallback
        }
      }

      // Optimize: Step pulse animation phase in 100ms intervals instead of continuous per-frame calculation
      if (now - lastPulseStepTime >= 100) {
        throttledElapsed = (now - startPulseTime) / 1000;
        lastPulseStepTime = now;
      }
      const elapsed = throttledElapsed;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const {
        userWorldPos,
        peerWorldPositions,
        peerClusters,
        resourceWorldPositions,
        resourceClusters,
        baseMaxRadius,
      } = calculateWorldPositions(transform.scale);

      // High element density threshold check: disable continuous pulses if count > 50
      const totalActiveElements = peerWorldPositions.length + resourceWorldPositions.length;
      const isHighDensityMode = totalActiveElements > 50;

      // 1. Screen-Space Background Fill
      if (!isOverlay) {
        if (isNightMode) {
          ctx.fillStyle = '#141E12';
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.fillStyle = '#FAF6EE';
          ctx.fillRect(0, 0, width, height);
        }
      }

      // 2. BEGIN TRANSFORMED WORLD SPACE RENDERING
      ctx.save();
      ctx.translate(width / 2 + transform.offsetX, height / 2 + transform.offsetY);
      ctx.rotate(transform.rotation);
      ctx.scale(transform.scale, transform.scale);

      // 3. Viewport culling helpers (checks if world position falls inside canvas viewport with margin)
      const cosR = Math.cos(transform.rotation);
      const sinR = Math.sin(transform.rotation);

      const isWorldPointInViewport = (worldX: number, worldY: number, margin = 50) => {
        const rotX = worldX * cosR - worldY * sinR;
        const rotY = worldX * sinR + worldY * cosR;
        const sx = width / 2 + transform.offsetX + rotX * transform.scale;
        const sy = height / 2 + transform.offsetY + rotY * transform.scale;
        return sx >= -margin && sx <= width + margin && sy >= -margin && sy <= height + margin;
      };

      const isWorldLineInViewport = (x1: number, y1: number, x2: number, y2: number, margin = 60) => {
        const rotX1 = x1 * cosR - y1 * sinR;
        const rotY1 = x1 * sinR + y1 * cosR;
        const sx1 = width / 2 + transform.offsetX + rotX1 * transform.scale;
        const sy1 = height / 2 + transform.offsetY + rotY1 * transform.scale;

        const rotX2 = x2 * cosR - y2 * sinR;
        const rotY2 = x2 * sinR + y2 * cosR;
        const sx2 = width / 2 + transform.offsetX + rotX2 * transform.scale;
        const sy2 = height / 2 + transform.offsetY + rotY2 * transform.scale;

        // If either endpoint is inside the screen
        if (
          (sx1 >= -margin && sx1 <= width + margin && sy1 >= -margin && sy1 <= height + margin) ||
          (sx2 >= -margin && sx2 <= width + margin && sy2 >= -margin && sy2 <= height + margin)
        ) {
          return true;
        }

        // Bounding box overlap rejection
        const minX = Math.min(sx1, sx2);
        const maxX = Math.max(sx1, sx2);
        const minY = Math.min(sy1, sy2);
        const maxY = Math.max(sy1, sy2);

        return maxX >= -margin && minX <= width + margin && maxY >= -margin && minY <= height + margin;
      };

      // A. Draw City Vector Zones (Water, Parks, Urban Polygons)
      if (!isOverlay) {
        cityData.zones.forEach((zone) => {
          if (zone.points.length < 3) return;

          // Viewport bounding box check for polygon
          let minZx = Infinity, maxZx = -Infinity, minZy = Infinity, maxZy = -Infinity;
          for (let i = 0; i < zone.points.length; i++) {
            const px = zone.points[i][0];
            const py = zone.points[i][1];
            if (px < minZx) minZx = px;
            if (px > maxZx) maxZx = px;
            if (py < minZy) minZy = py;
            if (py > maxZy) maxZy = py;
          }
          if (!isWorldLineInViewport(minZx, minZy, maxZx, maxZy, 100)) return;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(zone.points[0][0], zone.points[0][1]);
          for (let i = 1; i < zone.points.length; i++) {
            ctx.lineTo(zone.points[i][0], zone.points[i][1]);
          }
          ctx.closePath();

          if (zone.type === 'water') {
            ctx.fillStyle = isNightMode ? 'rgba(30, 58, 58, 0.75)' : 'rgba(160, 196, 196, 0.65)';
            ctx.strokeStyle = isNightMode ? '#2A9D8F' : '#68A6A6';
            ctx.lineWidth = 1.5 / transform.scale;
            ctx.fill();
            ctx.stroke();
          } else if (zone.type === 'park') {
            ctx.fillStyle = isNightMode ? 'rgba(42, 63, 39, 0.75)' : 'rgba(195, 219, 193, 0.7)';
            ctx.strokeStyle = isNightMode ? '#3D5E38' : '#A3C4A0';
            ctx.lineWidth = 1 / transform.scale;
            ctx.fill();
            ctx.stroke();
          } else if (zone.type === 'urban') {
            ctx.fillStyle = isNightMode ? 'rgba(40, 51, 36, 0.6)' : 'rgba(234, 222, 201, 0.6)';
            ctx.strokeStyle = isNightMode ? '#3C4D38' : '#D1C2A5';
            ctx.lineWidth = 1 / transform.scale;
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // B. Draw Custom User Bioregional Perimeter Boundary
      if (perimeterPoints.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(perimeterPoints[0][0], perimeterPoints[0][1]);
        for (let i = 1; i < perimeterPoints.length; i++) {
          ctx.lineTo(perimeterPoints[i][0], perimeterPoints[i][1]);
        }

        // Closed polygon fill or live preview line to cursor
        if (isPerimeterClosed && perimeterPoints.length >= 3) {
          ctx.closePath();
          ctx.fillStyle = isNightMode ? 'rgba(42, 157, 143, 0.22)' : 'rgba(42, 157, 143, 0.18)';
          ctx.fill();
        } else if (isPlacingPerimeterMarker && cursorWorldPos) {
          if (isNearFirstPerimeterPoint && perimeterPoints.length >= 3) {
            // Snap preview to P1
            ctx.lineTo(perimeterPoints[0][0], perimeterPoints[0][1]);
          } else {
            // Live guideline to current cursor
            ctx.lineTo(cursorWorldPos.x, cursorWorldPos.y);
          }
        }

        ctx.strokeStyle = '#2A9D8F';
        ctx.lineWidth = 2.5 / transform.scale;
        ctx.setLineDash([5 / transform.scale, 4 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Perimeter Vertex Markers
        perimeterPoints.forEach(([ptX, ptY], idx) => {
          const isFirst = idx === 0;
          const isSnapping = isFirst && isNearFirstPerimeterPoint;

          // If snapping to first point, draw pulsing indicator
          if (isSnapping) {
            const snapRing = (11 + Math.sin(elapsed * 6) * 3) / transform.scale;
            ctx.beginPath();
            ctx.arc(ptX, ptY, snapRing, 0, Math.PI * 2);
            ctx.strokeStyle = '#E9C46A';
            ctx.lineWidth = 2 / transform.scale;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(ptX, ptY, (isFirst ? 8 : 6) / transform.scale, 0, Math.PI * 2);
          ctx.fillStyle = isSnapping ? '#E9C46A' : isFirst ? '#2A9D8F' : '#E9C46A';
          ctx.fill();
          ctx.strokeStyle = '#203A2A';
          ctx.lineWidth = 1.5 / transform.scale;
          ctx.stroke();

          ctx.fillStyle = isFirst ? '#FFFFFF' : '#203A2A';
          ctx.font = `bold ${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`P${idx + 1}`, ptX, ptY + 3 / transform.scale);
        });

        ctx.restore();
      }

      // C. Draw City Vector Streets
      if (!isOverlay) {
        cityData.streets.forEach((street) => {
          if (street.points.length < 2) return;
          
          let isStreetRevealed = false;
          if (isWalkToRevealEnabled) {
            // A street is considered "revealed" if at least one of its points is inside a revealed area
            isStreetRevealed = street.points.some(([sx, sy]) => {
              return isPointRevealed(sx, sy);
            });
          } else {
            isStreetRevealed = true;
          }

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(street.points[0][0], street.points[0][1]);
          for (let i = 1; i < street.points.length; i++) {
            ctx.lineTo(street.points[i][0], street.points[i][1]);
          }

          ctx.lineWidth = street.width / transform.scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (street.type === 'primary') {
            ctx.strokeStyle = isStreetRevealed 
              ? (isNightMode ? 'rgba(150, 200, 140, 0.95)' : 'rgba(140, 110, 80, 0.95)')
              : (isNightMode ? 'rgba(50, 60, 48, 0.25)' : 'rgba(190, 180, 160, 0.25)');
          } else if (street.type === 'secondary') {
            ctx.strokeStyle = isStreetRevealed
              ? (isNightMode ? 'rgba(110, 160, 100, 0.9)' : 'rgba(170, 140, 110, 0.9)')
              : (isNightMode ? 'rgba(40, 50, 38, 0.2)' : 'rgba(210, 200, 180, 0.2)');
          } else {
            // Trail
            ctx.strokeStyle = isStreetRevealed
              ? (isNightMode ? 'rgba(42, 157, 143, 0.9)' : 'rgba(88, 129, 87, 0.9)')
              : (isNightMode ? 'rgba(30, 40, 30, 0.15)' : 'rgba(220, 215, 200, 0.15)');
            ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
          }
          ctx.stroke();
          ctx.restore();
        });
      }

      // ==========================================================
      // FOG OF WAR (Walk to Reveal Mask)
      // ==========================================================
      if (isWalkToRevealEnabled && cachedFogCanvas && !isOverlay) {
        ctx.save();
        const fogSize = 600;
        ctx.drawImage(cachedFogCanvas, -fogSize, -fogSize);
        ctx.restore();

        // Draw pulsing gold/yellow boundary overlays for discovered points
        try {
          const serviceAreas = mapRevealService.getRevealedAreas();
          const nowMs = Date.now();
          serviceAreas.forEach((area) => {
            const gridPos = geoPointToLocalGrid(area.centerLat, area.centerLng, cityData.centerCoordsText);
            const radiusGrid = area.radiusMeters / 10.71; // convert 50m to grid units

            ctx.save();
            // Subtle gold border
            ctx.strokeStyle = isNightMode ? 'rgba(233, 196, 106, 0.5)' : 'rgba(214, 162, 59, 0.6)';
            ctx.lineWidth = 1.5 / transform.scale;
            ctx.beginPath();
            ctx.arc(gridPos.x, gridPos.y, radiusGrid, 0, Math.PI * 2);
            ctx.stroke();

            // Check if recently revealed (within 15 seconds) to pulse gold
            const age = nowMs - area.revealedAt;
            if (age < 15000) {
              const alpha = Math.max(0, 1 - age / 15000);
              const waveProgress = (age / 1500) % 1; // repeats every 1.5s
              const pulseRadius = radiusGrid * (1.0 + 0.35 * waveProgress);
              ctx.strokeStyle = isNightMode 
                ? `rgba(233, 196, 106, ${alpha * (1.0 - waveProgress) * 0.8})`
                : `rgba(214, 162, 59, ${alpha * (1.0 - waveProgress) * 0.8})`;
              ctx.lineWidth = 3 / transform.scale;
              ctx.beginPath();
              ctx.arc(gridPos.x, gridPos.y, pulseRadius, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          });
        } catch (e) {
          console.warn('Error rendering pulse effects:', e);
        }
      }

      // D. Draw Bioregional Topography Contours & Creek
      if (showContours && !isOverlay && !isEcoMode) {
        ctx.save();
        const contourCount = 5;
        for (let i = 1; i <= contourCount; i++) {
          const r = (baseMaxRadius / contourCount) * i * 1.1;
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
            const noise = Math.sin(a * 3 + i) * 5 + Math.cos(a * 2) * 3;
            const cx = userWorldPos.x + Math.cos(a) * (r + noise);
            const cy = userWorldPos.y + Math.sin(a) * (r + noise);
            if (a === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.closePath();
          ctx.strokeStyle = isNightMode ? 'rgba(135, 168, 120, 0.12)' : 'rgba(88, 129, 87, 0.16)';
          ctx.lineWidth = 1 / transform.scale;
          ctx.stroke();
        }
        ctx.restore();
      }

      // E. Draw D3 Density Heatmap Layer (Active Nodes & Resource Availability across Bioregion)
      if (showDensityHeatmap) {
        const currentCacheKey = `${peers.length}-${visibleResources.length}-${userWorldPos.x.toFixed(0)}-${userWorldPos.y.toFixed(0)}-${d3HeatmapMode}-${isNightMode}`;
        if (!d3HeatmapCacheRef.current || lastD3ComputeKeyRef.current !== currentCacheKey) {
          d3HeatmapCacheRef.current = computeD3BioregionalHeatmap(
            peers,
            visibleResources,
            userWorldPos,
            peerWorldPositions,
            resourceWorldPositions,
            d3HeatmapMode as HeatmapMode,
            isNightMode
          );
          lastD3ComputeKeyRef.current = currentCacheKey;
        }

        if (d3HeatmapCacheRef.current) {
          drawD3HeatmapOnCanvas(
            ctx,
            d3HeatmapCacheRef.current,
            { x: transform.offsetX, y: transform.offsetY, scale: transform.scale },
            isNightMode,
            d3HeatmapOpacity
          );
        } else {
          // Fallback radial gradient glow
          ctx.save();
          peerWorldPositions.forEach((pp) => {
            const peerResources = visibleResources.filter((r) => r.ownerId === pp.peer.id);
            const densityWeight = Math.max(1, peerResources.length * 1.5);
            const heatRadius = 40 * densityWeight;

            // Viewport culling for asset density glow
            if (!isWorldPointInViewport(pp.x, pp.y, heatRadius + 20)) return;

            const grad = ctx.createRadialGradient(pp.x, pp.y, 2, pp.x, pp.y, heatRadius);
            if (isNightMode) {
              grad.addColorStop(0, 'rgba(233, 196, 106, 0.35)');
              grad.addColorStop(0.5, 'rgba(88, 129, 87, 0.18)');
              grad.addColorStop(1, 'rgba(20, 30, 18, 0)');
            } else {
              grad.addColorStop(0, 'rgba(233, 196, 106, 0.45)');
              grad.addColorStop(0.5, 'rgba(135, 168, 120, 0.22)');
              grad.addColorStop(1, 'rgba(250, 246, 238, 0)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, heatRadius, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        }
      }

      // E2. Draw RSSI Signal Strength Heatmap (Coverage Field)
      if (showSignalHeatmap) {
        ctx.save();
        
        const latLonToWorldLocal = (lat: number, lon: number): { x: number; y: number } => {
          const centerLat = 58.3780;
          const centerLon = 26.7290;
          return {
            x: (lon - centerLon) * 5828.0,
            y: -(lat - centerLat) * 11113.9,
          };
        };

        // Combine mesh peers with user local transceiver node and historical Pathfinder scans
        const signalNodes = [
          {
            x: userWorldPos.x,
            y: userWorldPos.y,
            rssi: -38, // Local node high field strength reference
            isUser: true,
            callsign: userCallsign,
          },
          ...peerWorldPositions
            .filter((pp) => {
              if (topologyFilter === 'direct' && !pp.peer.isDirect) return false;
              if (topologyFilter === 'relayed' && pp.peer.connectionState !== 'relayed') return false;
              if (topologyFilter === 'store_forward' && pp.peer.connectionState !== 'store_forward') return false;
              return true;
            })
            .map((pp) => ({
              x: pp.x,
              y: pp.y,
              rssi: pp.peer.lastRssi,
              isUser: false,
              callsign: pp.peer.callsign,
            })),
          // Add previously detected Wi-Fi nodes to visualize dead zones & coverage
          ...(wifiSpots || []).map((spot) => {
            const pos = latLonToWorldLocal(spot.latitude, spot.longitude);
            return {
              x: pos.x,
              y: pos.y,
              rssi: spot.signalDbm,
              isUser: false,
              callsign: spot.ssid,
            };
          }),
          // Add previously detected BLE nodes
          ...(bluetoothSpots || []).map((spot) => {
            const pos = latLonToWorldLocal(spot.latitude, spot.longitude);
            return {
              x: pos.x,
              y: pos.y,
              rssi: spot.rssi,
              isUser: false,
              callsign: spot.deviceName || 'BLE Device',
            };
          }),
        ];

        signalNodes.forEach((node) => {
          // Normalize RSSI: range roughly -95 dBm (poor) to -45 dBm (excellent)
          const clampedRssi = Math.max(-100, Math.min(-40, node.rssi));
          const qualityRatio = (clampedRssi - (-100)) / ((-40) - (-100)); // 0.0 to 1.0
          
          // Heatmap coverage radius based on RF power and link quality
          const heatRadius = 55 + qualityRatio * 85; // 55px to 140px in world space

          // Viewport culling for signal strength node
          if (!isWorldPointInViewport(node.x, node.y, heatRadius + 20)) return;

          const isoRadius65 = heatRadius * 0.65;
          const isoRadius80 = heatRadius * 0.90;

          const grad = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, heatRadius);

          if (clampedRssi >= -65) {
            // Strong Signal (> -65 dBm): Vibrant teal / emerald green core transitioning to soft amber
            if (isNightMode) {
              grad.addColorStop(0, 'rgba(42, 157, 143, 0.46)');
              grad.addColorStop(0.35, 'rgba(88, 129, 87, 0.30)');
              grad.addColorStop(0.7, 'rgba(233, 196, 106, 0.12)');
              grad.addColorStop(1, 'rgba(20, 30, 18, 0)');
            } else {
              grad.addColorStop(0, 'rgba(42, 157, 143, 0.52)');
              grad.addColorStop(0.35, 'rgba(88, 129, 87, 0.34)');
              grad.addColorStop(0.7, 'rgba(233, 196, 106, 0.14)');
              grad.addColorStop(1, 'rgba(250, 246, 238, 0)');
            }
          } else if (clampedRssi >= -80) {
            // Moderate Signal (-65 to -80 dBm): Amber gold core transitioning to warm coral
            if (isNightMode) {
              grad.addColorStop(0, 'rgba(233, 196, 106, 0.40)');
              grad.addColorStop(0.45, 'rgba(244, 162, 97, 0.22)');
              grad.addColorStop(0.8, 'rgba(231, 111, 81, 0.08)');
              grad.addColorStop(1, 'rgba(20, 30, 18, 0)');
            } else {
              grad.addColorStop(0, 'rgba(233, 196, 106, 0.46)');
              grad.addColorStop(0.45, 'rgba(244, 162, 97, 0.26)');
              grad.addColorStop(0.8, 'rgba(231, 111, 81, 0.10)');
              grad.addColorStop(1, 'rgba(250, 246, 238, 0)');
            }
          } else {
            // Fringe / Weak Signal (< -80 dBm): Coral / rust red edge aura
            if (isNightMode) {
              grad.addColorStop(0, 'rgba(231, 111, 81, 0.32)');
              grad.addColorStop(0.5, 'rgba(231, 111, 81, 0.14)');
              grad.addColorStop(1, 'rgba(20, 30, 18, 0)');
            } else {
              grad.addColorStop(0, 'rgba(231, 111, 81, 0.38)');
              grad.addColorStop(0.5, 'rgba(231, 111, 81, 0.16)');
              grad.addColorStop(1, 'rgba(250, 246, 238, 0)');
            }
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, heatRadius, 0, Math.PI * 2);
          ctx.fill();

          // Iso-coverage contour boundary ring (threshold boundary)
          ctx.beginPath();
          ctx.arc(node.x, node.y, isoRadius65, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(42, 157, 143, 0.25)' : 'rgba(42, 157, 143, 0.30)';
          ctx.lineWidth = 1 / transform.scale;
          ctx.setLineDash([3 / transform.scale, 4 / transform.scale]);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, isoRadius80, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(231, 111, 81, 0.20)' : 'rgba(231, 111, 81, 0.25)';
          ctx.lineWidth = 0.8 / transform.scale;
          ctx.setLineDash([2 / transform.scale, 5 / transform.scale]);
          ctx.stroke();
          ctx.setLineDash([]);

          // 4. Vähenda tekstide arvu: Zoomed-in RSSI readout tag ainult suuremal suumil (scale > 1.2)
          if (transform.scale > 1.2 && !node.isUser) {
            ctx.fillStyle = isNightMode ? '#A8BDA5' : '#588157';
            ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`${node.rssi} dBm`, node.x, node.y + (16 / transform.scale));
          }
        });

        ctx.restore();
      }

      // E3. Draw Offline Cached Zones (Overlay representing areas where mesh nodes were recently detected)
      if (showCachedZones) {
        ctx.save();
        
        // Gather all nodes with detection footprint
        const detectedZones = [
          {
            x: userWorldPos.x,
            y: userWorldPos.y,
            callsign: userCallsign,
            lastSeen: 'Kohalik sõlm',
            lastRssi: -38,
            hopDistance: 0,
            isDirect: true,
            connectionState: 'direct' as ConnectionState,
          },
          ...peerWorldPositions.map((pp) => ({
            x: pp.x,
            y: pp.y,
            callsign: pp.peer.callsign,
            lastSeen: pp.peer.lastSeen || 'Hiljuti tuvastatud',
            lastRssi: pp.peer.lastRssi,
            hopDistance: pp.peer.hopDistance,
            isDirect: pp.peer.isDirect,
            connectionState: pp.peer.connectionState,
          })),
        ];

        // 1. Draw cached corridor bridges between neighboring mesh node detections (< 190px apart)
        for (let i = 0; i < detectedZones.length; i++) {
          for (let j = i + 1; j < detectedZones.length; j++) {
            const z1 = detectedZones[i];
            const z2 = detectedZones[j];
            const dx = z2.x - z1.x;
            const dy = z2.y - z1.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 190) {
              const corridorWidth = 22 / transform.scale;
              const angle = Math.atan2(dy, dx);
              const perpX = -Math.sin(angle) * corridorWidth;
              const perpY = Math.cos(angle) * corridorWidth;

              ctx.beginPath();
              ctx.moveTo(z1.x + perpX, z1.y + perpY);
              ctx.lineTo(z2.x + perpX, z2.y + perpY);
              ctx.lineTo(z2.x - perpX, z2.y - perpY);
              ctx.lineTo(z1.x - perpX, z1.y - perpY);
              ctx.closePath();
              ctx.fillStyle = isNightMode ? 'rgba(42, 157, 143, 0.10)' : 'rgba(42, 157, 143, 0.14)';
              ctx.fill();

              ctx.strokeStyle = isNightMode ? 'rgba(233, 196, 106, 0.28)' : 'rgba(42, 157, 143, 0.35)';
              ctx.lineWidth = 1.2 / transform.scale;
              ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // 2. Draw individual node cached zone footprints & boundary indicators
        detectedZones.forEach((zone) => {
          const zoneRadius = 55 + Math.max(10, Math.min(40, (zone.lastRssi + 100) * 0.65));
          if (!isWorldPointInViewport(zone.x, zone.y, zoneRadius + 30)) return;

          // Zone Color Scheme by Connection State & Detection Tier
          const zonePalette = zone.isDirect || zone.hopDistance <= 1
            ? {
                fill: isNightMode ? 'rgba(42, 157, 143, 0.20)' : 'rgba(42, 157, 143, 0.24)',
                stroke: '#2A9D8F',
                halo: isNightMode ? 'rgba(42, 157, 143, 0.35)' : 'rgba(42, 157, 143, 0.45)',
              }
            : zone.connectionState === 'relayed' || zone.hopDistance === 2
            ? {
                fill: isNightMode ? 'rgba(233, 196, 106, 0.18)' : 'rgba(233, 196, 106, 0.24)',
                stroke: '#E9C46A',
                halo: isNightMode ? 'rgba(233, 196, 106, 0.35)' : 'rgba(233, 196, 106, 0.45)',
              }
            : {
                fill: isNightMode ? 'rgba(244, 162, 97, 0.16)' : 'rgba(244, 162, 97, 0.22)',
                stroke: '#F4A261',
                halo: isNightMode ? 'rgba(244, 162, 97, 0.30)' : 'rgba(244, 162, 97, 0.40)',
              };

          // Fill smooth rounded cached zone footprint
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zoneRadius, 0, Math.PI * 2);
          ctx.fillStyle = zonePalette.fill;
          ctx.fill();

          // Outer dashed perimeter
          ctx.strokeStyle = zonePalette.stroke;
          ctx.lineWidth = 1.6 / transform.scale;
          ctx.setLineDash([5 / transform.scale, 4 / transform.scale]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Inner radial concentric contour
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zoneRadius * 0.55, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(240, 245, 238, 0.18)' : 'rgba(32, 58, 42, 0.15)';
          ctx.lineWidth = 0.8 / transform.scale;
          ctx.stroke();

          // Cached Zone Label Badge (visible when scale >= 0.75)
          if (transform.scale >= 0.75) {
            const badgeY = zone.y - zoneRadius - (6 / transform.scale);
            const badgeText = `OFFLINE ZONE: ${zone.callsign}`;
            
            ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px monospace`;
            const textWidth = ctx.measureText(badgeText).width;
            const padX = 6 / transform.scale;
            const boxW = textWidth + padX * 2;
            const boxH = 15 / transform.scale;

            // Pill background
            ctx.fillStyle = isNightMode ? 'rgba(24, 35, 21, 0.94)' : 'rgba(250, 246, 238, 0.96)';
            ctx.strokeStyle = zonePalette.stroke;
            ctx.lineWidth = 1 / transform.scale;
            ctx.beginPath();
            ctx.roundRect(zone.x - boxW / 2, badgeY - boxH, boxW, boxH, 4 / transform.scale);
            ctx.fill();
            ctx.stroke();

            // Pill text
            ctx.fillStyle = isNightMode ? '#E9C46A' : '#203A2A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, zone.x, badgeY - boxH / 2);
          }
        });

        ctx.restore();
      }

      // F. REAL-TIME OSCILLATING 'PULSE' ANIMATION FOR RADIO RELAYS
      if (showRadii) {
        ctx.save();
        const prefersReducedMotion =
          (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) || isEcoMode;

        // Active radio relay nodes:
        // 1. User local transceiver node (primary bioregional hub)
        // 2. Nodes where connectionState === 'relayed' or hopDistance >= 2 (relay bridges)
        // 3. Direct repeater nodes (direct high-packet links)
        const relayNodes = [
          {
            x: userWorldPos.x,
            y: userWorldPos.y,
            id: 'user',
            isRelay: true,
            isHub: true,
            color: '#E9C46A',
            isNew: false,
          },
          ...peerWorldPositions.map((pp) => {
            // Pulse if active within last 5 minutes (300000ms), otherwise keep static to distinguish from stale data
            const lastSeenMs = pp.peer.lastSeen ? new Date(pp.peer.lastSeen).getTime() : 0;
            const isNew = Date.now() - lastSeenMs < 300000;
            return {
              x: pp.x,
              y: pp.y,
              id: pp.peer.id,
              isRelay: pp.peer.connectionState === 'relayed' || pp.peer.hopDistance >= 2,
              isHub: false,
              color: pp.peer.isDirect
                ? '#2A9D8F'
                : pp.peer.connectionState === 'relayed'
                ? '#E9C46A'
                : '#F4A261',
              isNew,
            };
          }),
        ];

        relayNodes.forEach((node, idx) => {
          // Viewport culling for relay node aura
          if (!isWorldPointInViewport(node.x, node.y, 80)) return;

          const nodeOffset = idx * 1.25;

          // Performance Optimization: If high density (>50 elements) or node is not newly discovered,
          // render static crisp aura circles instead of continuous oscillating pulse computation
          const shouldAnimate = !prefersReducedMotion && !isHighDensityMode && (node.isHub || node.isNew);

          const oscFreq = 2.4;
          const oscValue = shouldAnimate
            ? (Math.sin(elapsed * oscFreq + nodeOffset) + 1) / 2
            : 0.5; // [0.0, 1.0] static fallback
          const scaleFactor = 0.82 + oscValue * 0.42; // Oscillates between 0.82 and 1.24

          // Scale radial gradients around specific mesh nodes
          const baseRadius = node.isRelay ? 36 : 24;
          const scaledRadius = (baseRadius * scaleFactor) / transform.scale;
          const auraAlpha = 0.25 + oscValue * 0.35;

          // 5. Kasuta lihtsamaid graafilisi elemente: gradients are expensive, use simple fill on low zoom unless hub
          if (transform.scale < 1.1 && !node.isHub) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, scaledRadius, 0, Math.PI * 2);
            ctx.fillStyle = node.color === '#2A9D8F'
              ? (isNightMode ? 'rgba(42, 157, 143, 0.08)' : 'rgba(42, 157, 143, 0.12)')
              : (isNightMode ? 'rgba(233, 196, 106, 0.08)' : 'rgba(233, 196, 106, 0.12)');
            ctx.fill();
          } else {
            // Radial Gradient Glow Wave
            const pulseGrad = ctx.createRadialGradient(
              node.x,
              node.y,
              2 / transform.scale,
              node.x,
              node.y,
              scaledRadius
            );

            if (isNightMode) {
              pulseGrad.addColorStop(
                0,
                node.isRelay
                  ? `rgba(233, 196, 106, ${auraAlpha * 0.75})`
                  : `rgba(42, 157, 143, ${auraAlpha * 0.6})`
              );
              pulseGrad.addColorStop(0.5, `rgba(42, 157, 143, ${auraAlpha * 0.35})`);
              pulseGrad.addColorStop(1, 'rgba(20, 30, 18, 0)');
            } else {
              pulseGrad.addColorStop(
                0,
                node.isRelay
                  ? `rgba(233, 196, 106, ${auraAlpha * 0.85})`
                  : `rgba(42, 157, 143, ${auraAlpha * 0.7})`
              );
              pulseGrad.addColorStop(0.5, `rgba(233, 196, 106, ${auraAlpha * 0.3})`);
              pulseGrad.addColorStop(1, 'rgba(250, 246, 238, 0)');
            }

            ctx.fillStyle = pulseGrad;
            ctx.beginPath();
            ctx.arc(node.x, node.y, scaledRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Concentric propagating wave ripple rings for active radio relays (only if animated)
          if (shouldAnimate && node.isRelay) {
            const waveCycle = (elapsed * 1.35 + nodeOffset * 0.6) % 1;
            const currentRippleRadius = (12 + waveCycle * 54) / transform.scale;
            const rippleAlpha = Math.max(0, (1 - waveCycle) * 0.65);

            ctx.beginPath();
            ctx.arc(node.x, node.y, currentRippleRadius, 0, Math.PI * 2);
            ctx.strokeStyle = isNightMode
              ? `rgba(233, 196, 106, ${rippleAlpha * 0.6})`
              : `rgba(42, 157, 143, ${rippleAlpha * 0.7})`;
            ctx.lineWidth = (1.4 - waveCycle * 0.7) / transform.scale;
            ctx.stroke();
          }
        });

        ctx.restore();
      }

      // F2. Real-time background sync pulse data propagation ripple on target mesh node
      const currentSyncPulse = useMeshStore.getState().lastSyncPulse;
      if (currentSyncPulse) {
        const pulseAgeSec = (Date.now() - currentSyncPulse.timestamp) / 1000;
        if (pulseAgeSec >= 0 && pulseAgeSec < 2.6) {
          const pulseProgress = pulseAgeSec / 2.6; // [0, 1]
          const targetPeer = peerWorldPositions.find(
            (pp) =>
              pp.peer.id === currentSyncPulse.peerId ||
              (currentSyncPulse.callsign &&
                pp.peer.callsign.toLowerCase() === currentSyncPulse.callsign.toLowerCase())
          );
          const originX = targetPeer ? targetPeer.x : userWorldPos.x;
          const originY = targetPeer ? targetPeer.y : userWorldPos.y;

          if (isWorldPointInViewport(originX, originY, 140)) {
            ctx.save();

            // Outer primary expanding teal propagation wave
            const rippleR1 = (14 + pulseProgress * 78) / transform.scale;
            const alpha1 = Math.max(0, (1 - pulseProgress) * 0.85);
            ctx.beginPath();
            ctx.arc(originX, originY, rippleR1, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(42, 157, 143, ${alpha1})`;
            ctx.lineWidth = Math.max(1, (2.6 * (1 - pulseProgress * 0.6)) / transform.scale);
            ctx.stroke();

            // Secondary amber harmonic echo ripple
            if (pulseProgress > 0.15) {
              const echoProg = (pulseProgress - 0.15) / 0.85;
              const rippleR2 = (14 + echoProg * 58) / transform.scale;
              const alpha2 = Math.max(0, (1 - echoProg) * 0.7);
              ctx.beginPath();
              ctx.arc(originX, originY, rippleR2, 0, Math.PI * 2);
              ctx.strokeStyle = isNightMode
                ? `rgba(233, 196, 106, ${alpha2})`
                : `rgba(88, 129, 87, ${alpha2})`;
              ctx.lineWidth = Math.max(0.8, (1.8 * (1 - echoProg * 0.5)) / transform.scale);
              ctx.stroke();
            }

            // Central beacon flash
            const coreAlpha = Math.max(0, Math.sin(pulseProgress * Math.PI) * 0.6);
            ctx.beginPath();
            ctx.arc(originX, originY, 8 / transform.scale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(42, 157, 143, ${coreAlpha})`;
            ctx.fill();

            ctx.restore();
          }
        }
      }

      // G. Draw Mesh Links with Active Signal Path Strengths & Health Metrics
      if (showMeshLinks) {
        ctx.save();

        // Calculate link health metric styling based on RSSI signal strength
        const getSignalPathConfig = (rssi: number) => {
          if (rssi >= -60) {
            // Optimal / Strong Signal Path
            return {
              color: isNightMode ? '#2A9D8F' : '#2A9D8F',
              glowColor: isNightMode ? 'rgba(42, 157, 143, 0.45)' : 'rgba(42, 157, 143, 0.35)',
              opacity: 0.92,
              lineWidth: 3.2,
              dashPattern: [] as number[],
              packetSpeed: 0.8,
              packetColor: '#2A9D8F',
              packetSize: 3.6,
              healthLabel: 'EXC',
              healthPercent: 98,
            };
          } else if (rssi >= -72) {
            // Good Signal Path
            return {
              color: isNightMode ? '#87A878' : '#588157',
              glowColor: isNightMode ? 'rgba(135, 168, 120, 0.35)' : 'rgba(88, 129, 87, 0.25)',
              opacity: 0.78,
              lineWidth: 2.4,
              dashPattern: [] as number[],
              packetSpeed: 0.55,
              packetColor: isNightMode ? '#E9C46A' : '#588157',
              packetSize: 3.0,
              healthLabel: 'GOOD',
              healthPercent: 84,
            };
          } else if (rssi >= -82) {
            // Moderate / Fair Signal Path
            return {
              color: isNightMode ? '#E9C46A' : '#D4A373',
              glowColor: isNightMode ? 'rgba(233, 196, 106, 0.25)' : 'rgba(212, 163, 115, 0.20)',
              opacity: 0.62,
              lineWidth: 1.8,
              dashPattern: [5 / transform.scale, 3 / transform.scale],
              packetSpeed: 0.38,
              packetColor: '#E9C46A',
              packetSize: 2.6,
              healthLabel: 'FAIR',
              healthPercent: 62,
            };
          } else if (rssi >= -90) {
            // Weak / Fringe Signal Path
            return {
              color: isNightMode ? '#F4A261' : '#E76F51',
              glowColor: isNightMode ? 'rgba(244, 162, 97, 0.20)' : 'rgba(231, 111, 81, 0.15)',
              opacity: 0.45,
              lineWidth: 1.3,
              dashPattern: [3 / transform.scale, 4 / transform.scale],
              packetSpeed: 0.25,
              packetColor: '#F4A261',
              packetSize: 2.2,
              healthLabel: 'WEAK',
              healthPercent: 38,
            };
          } else {
            // Critical / Marginal Path
            return {
              color: isNightMode ? '#E76F51' : '#D64045',
              glowColor: isNightMode ? 'rgba(231, 111, 81, 0.15)' : 'rgba(214, 64, 69, 0.10)',
              opacity: 0.30,
              lineWidth: 1.0,
              dashPattern: [2 / transform.scale, 4 / transform.scale],
              packetSpeed: 0.15,
              packetColor: '#E76F51',
              packetSize: 1.8,
              healthLabel: 'CRIT',
              healthPercent: 16,
            };
          }
        };

        // Helper to draw link line, path glow, packet animation and midpoint health label
        const drawActiveMeshLink = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          rssi: number,
          animIndex: number,
          isDirect: boolean,
          connectionState: string,
          p1LastSeen?: string | number,
          p2LastSeen?: string | number
        ) => {
          const cfg = getSignalPathConfig(rssi);

          // Calculate freshness factors if enabled
          let linkAlpha = cfg.opacity;
          let linkColor = cfg.color;
          let linkDash = cfg.dashPattern;
          let isStaleRelayPath = false;

          if (showNodeFreshness) {
            const f1 = getNodeFreshness(p1LastSeen);
            const f2 = getNodeFreshness(p2LastSeen);
            const minAlpha = Math.min(f1.alpha, f2.alpha);
            linkAlpha = Math.min(cfg.opacity, minAlpha + 0.15);

            if (f1.tier === 'dormant' || f2.tier === 'dormant') {
              linkColor = isNightMode ? '#6C757D' : '#8A9286';
              linkDash = [3 / transform.scale, 4 / transform.scale];
              isStaleRelayPath = true;
            } else if (f1.tier === 'stale' || f2.tier === 'stale') {
              linkColor = isNightMode ? '#E76F51' : '#D96749';
              linkDash = [5 / transform.scale, 3 / transform.scale];
              isStaleRelayPath = true;
            } else if (f1.tier === 'warm' || f2.tier === 'warm') {
              linkColor = isNightMode ? '#E9C46A' : '#D4A373';
            }
          }

          // 1. Soft Path Glow Underlay
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = isStaleRelayPath ? 'transparent' : cfg.glowColor;
          ctx.lineWidth = (cfg.lineWidth * 2.8) / transform.scale;
          ctx.stroke();
          ctx.restore();

          // 2. Main Signal Path Line with varying opacity & color
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.globalAlpha = linkAlpha;
          ctx.strokeStyle = linkColor;
          ctx.lineWidth = (isStaleRelayPath ? Math.max(1.0, cfg.lineWidth * 0.75) : cfg.lineWidth) / transform.scale;

          if (!isDirect && connectionState === 'relayed') {
            ctx.setLineDash([6 / transform.scale, 3 / transform.scale]);
          } else if (!isDirect) {
            ctx.setLineDash([3 / transform.scale, 4 / transform.scale]);
          } else if (linkDash.length > 0) {
            ctx.setLineDash(linkDash);
          } else {
            ctx.setLineDash([]);
          }

          ctx.stroke();
          ctx.restore();

          // 3. Active data packet transmission animation (slowed down for stale relay paths)
          if (!isHighDensityMode && (!isStaleRelayPath || (elapsed * 2) % 2 < 1)) {
            ctx.save();
            const packetSpeed = isStaleRelayPath ? cfg.packetSpeed * 0.4 : cfg.packetSpeed;
            const progress = (elapsed * packetSpeed + animIndex * 0.28) % 1;
            const packetX = x1 + (x2 - x1) * progress;
            const packetY = y1 + (y2 - y1) * progress;

            ctx.beginPath();
            ctx.arc(packetX, packetY, (isStaleRelayPath ? cfg.packetSize * 0.75 : cfg.packetSize) / transform.scale, 0, Math.PI * 2);
            ctx.fillStyle = isStaleRelayPath ? linkColor : cfg.packetColor;
            ctx.globalAlpha = Math.min(1.0, linkAlpha + 0.2);
            ctx.fill();
            ctx.restore();
          }

          // 4. Midpoint Mesh Path Health Badge (visible at zoom scale >= 1.15)
          if (transform.scale >= 1.15) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const badgeText = isStaleRelayPath ? `${rssi}dBm • Stale Relay` : `${rssi}dBm • ${cfg.healthPercent}%`;

            ctx.save();
            ctx.font = `bold ${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
            const textWidth = ctx.measureText(badgeText).width;
            const padX = 4 / transform.scale;
            const boxW = textWidth + padX * 2;
            const boxH = 12 / transform.scale;

            ctx.fillStyle = isNightMode ? 'rgba(24, 35, 21, 0.92)' : 'rgba(250, 246, 238, 0.92)';
            ctx.strokeStyle = linkColor;
            ctx.lineWidth = 0.8 / transform.scale;
            ctx.beginPath();
            ctx.roundRect(midX - boxW / 2, midY - boxH / 2, boxW, boxH, 3 / transform.scale);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = linkColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, midX, midY);
            ctx.restore();
          }
        };

        // Inter-peer links
        for (let i = 0; i < peerWorldPositions.length; i++) {
          for (let j = i + 1; j < peerWorldPositions.length; j++) {
            const p1 = peerWorldPositions[i];
            const p2 = peerWorldPositions[j];

            if (topologyFilter === 'direct' && (!p1.peer.isDirect || !p2.peer.isDirect)) continue;
            if (topologyFilter === 'relayed' && p1.peer.connectionState !== 'relayed' && p2.peer.connectionState !== 'relayed') continue;
            if (topologyFilter === 'store_forward' && p1.peer.connectionState !== 'store_forward' && p2.peer.connectionState !== 'store_forward') continue;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distBetweenPeers = Math.hypot(dx, dy);

            if (distBetweenPeers < baseMaxRadius * 1.1) {
              if (!isWorldLineInViewport(p1.x, p1.y, p2.x, p2.y, 50)) continue;

              const avgRssi = Math.round((p1.peer.lastRssi + p2.peer.lastRssi) / 2);
              const isDirectLink = p1.peer.isDirect && p2.peer.isDirect;
              const connState = p1.peer.connectionState === 'relayed' || p2.peer.connectionState === 'relayed' ? 'relayed' : p1.peer.connectionState;

              drawActiveMeshLink(
                p1.x,
                p1.y,
                p2.x,
                p2.y,
                avgRssi,
                i + j,
                isDirectLink,
                connState,
                p1.peer.lastSeen,
                p2.peer.lastSeen
              );
            }
          }
        }

        // Center User to Peers
        peerWorldPositions.forEach((pp, idx) => {
          if (topologyFilter === 'direct' && !pp.peer.isDirect) return;
          if (topologyFilter === 'relayed' && pp.peer.connectionState !== 'relayed') return;
          if (topologyFilter === 'store_forward' && pp.peer.connectionState !== 'store_forward') return;

          if (!isWorldLineInViewport(userWorldPos.x, userWorldPos.y, pp.x, pp.y, 50)) return;

          drawActiveMeshLink(
            userWorldPos.x,
            userWorldPos.y,
            pp.x,
            pp.y,
            pp.peer.lastRssi,
            idx,
            pp.peer.isDirect,
            pp.peer.connectionState,
            Date.now(), // User node is always current
            pp.peer.lastSeen
          );
        });

        ctx.restore();
      }

      // H. Draw City Landmarks & District Labels
      cityData.landmarks.forEach((lm) => {
        if (isWalkToRevealEnabled && !isPointRevealed(lm.x, lm.y, userWorldPos)) return;
        // Viewport culling for landmarks
        if (!isWorldPointInViewport(lm.x, lm.y, 40)) return;

        ctx.save();
        ctx.fillStyle = isNightMode ? '#E9C46A' : '#203A2A';
        ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
        ctx.lineWidth = 1.5 / transform.scale;

        ctx.beginPath();
        ctx.arc(lm.x, lm.y, 5 / transform.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 4. Vähenda tekstide arvu: kuva nimesilt ainult kui suum > 1.2
        if (transform.scale > 1.2) {
          ctx.fillStyle = isNightMode ? '#A8BDA5' : '#588157';
          ctx.font = `${Math.max(8, 10 / transform.scale)}px Outfit, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(lm.name, lm.x, lm.y + 12 / transform.scale);
        }
        ctx.restore();
      });

      cityData.districts.forEach((dist) => {
        // Viewport culling for districts
        if (!isWorldPointInViewport(dist.x, dist.y, 80)) return;

        // 4. Vähenda tekstide arvu: rajoonide tekstid peita väga madalal suumil (< 0.9)
        if (transform.scale >= 0.9) {
          ctx.save();
          ctx.fillStyle = isNightMode ? 'rgba(168, 189, 165, 0.45)' : 'rgba(99, 112, 98, 0.55)';
          ctx.font = `bold ${Math.max(9, 12 / transform.scale)}px Outfit, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(dist.name.toUpperCase(), dist.x, dist.y);
          ctx.restore();
        }
      });

      // Draw Survival POIs
      if (cityData.survivalPois) {
        cityData.survivalPois.forEach((poi) => {
          if (visiblePoiCategories && !visiblePoiCategories.has(poi.category)) return;

          // Viewport culling for survival POIs
          if (!isWorldPointInViewport(poi.x, poi.y, 40)) return;

          ctx.save();
          const isHovered = hoveredEntity?.type === 'survivalPoi' && hoveredEntity.id === poi.id;
          
          let color = '#2A9D8F';
          let symbol = '🔧';
          if (poi.category === 'Bikes') { color = '#F4A261'; symbol = '🚲'; }
          else if (poi.category === 'Medical') { color = '#E76F51'; symbol = '⛑️'; }
          else if (poi.category === 'Food') { color = '#87A878'; symbol = '🌾'; }
          else if (poi.category === 'Station') { color = '#E9C46A'; symbol = '🚉'; }
          
          const radius = (isHovered ? 12 : 9) / transform.scale;
          
          // 5. Kasuta lihtsamaid graafilisi elemente: madalal suumil ainult lihtne ring ilma emotikonita
          if (transform.scale < 1.1 && !isHovered) {
            ctx.beginPath();
            ctx.arc(poi.x, poi.y, radius * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
            ctx.lineWidth = 1 / transform.scale;
            ctx.stroke();
            ctx.restore();
            return;
          }

          ctx.beginPath();
          ctx.arc(poi.x, poi.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
          ctx.lineWidth = 1.5 / transform.scale;
          ctx.stroke();
          
          ctx.font = `${Math.max(6, (isHovered ? 12 : 9) / transform.scale)}px sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol, poi.x, poi.y + 1 / transform.scale);
          
          ctx.restore();
        });
      }

      // I. Draw Resource Pins & Clusters
      resourceClusters.forEach((cluster) => {
        const isHovered =
          (hoveredEntity?.type === 'resource' && cluster.singleResource?.id === hoveredEntity.id) ||
          (hoveredEntity?.type === 'resourceCluster' && hoveredEntity.id === cluster.id);

        // 3. Joonista ainult nähtavad elemendid: viewport culling for resource
        if (!isHovered && !isWorldPointInViewport(cluster.x, cluster.y, 45)) return;

        if (cluster.isCluster) {
          drawResourceClusterBadge(ctx, cluster, isNightMode, isHovered, elapsed);
        } else if (cluster.singleResource) {
          // Check if resource is newly created/discovered (< 5000ms) and high-density mode is off
          const resCreatedAt = cluster.singleResource.createdAt || 0;
          const isNewResource = Date.now() - resCreatedAt < 5000;
          const isPulseActive = !isHighDensityMode && (isHovered || isNewResource);

          drawCategoryMapPin(
            ctx,
            cluster.x,
            cluster.y,
            cluster.singleResource.category,
            cluster.dominantColor,
            isNightMode,
            isHovered,
            isPulseActive,
            elapsed
          );
        }
      });

      // J. Draw Peer Nodes (clustered or individual)
      peerClusters.forEach((cluster) => {
        const isHovered =
          (hoveredEntity?.type === 'peer' && cluster.singlePeer?.id === hoveredEntity.id) ||
          (hoveredEntity?.type === 'peerCluster' && hoveredEntity.id === cluster.id);

        // 3. Joonista ainult nähtavad elemendid: viewport culling for peer
        if (!isHovered && !isWorldPointInViewport(cluster.x, cluster.y, 45)) return;

        if (cluster.isCluster) {
          drawPeerClusterBadge(ctx, cluster, isNightMode, isHovered, elapsed);
        } else if (cluster.singlePeer) {
          const p = cluster.singlePeer;
          const freshness = showNodeFreshness ? getNodeFreshness(p.lastSeen) : null;
          ctx.save();

          // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil (lihtne ring ilma keeruliste kihtideta)
          if (transform.scale < 1.1 && !isHovered) {
            const r = 6.5 / transform.scale;
            ctx.beginPath();
            ctx.arc(cluster.x, cluster.y, r, 0, Math.PI * 2);
            ctx.fillStyle = freshness
              ? freshness.color
              : p.isDirect
              ? '#588157'
              : p.connectionState === 'relayed'
              ? '#F4A261'
              : '#E76F51';
            ctx.globalAlpha = freshness ? freshness.alpha : 1.0;
            ctx.fill();
            ctx.strokeStyle = isNightMode ? '#182315' : '#FFFFFF';
            ctx.lineWidth = 1.2 / transform.scale;
            ctx.stroke();

            // 4. Vähenda tekstide arvu: madalal suumil ära kuva tekstsilte
            ctx.restore();
            return;
          }

          const outerR = (isHovered ? 15 : 13) / transform.scale;
          const innerR = (isHovered ? 9.5 : 8) / transform.scale;

          // Pulse halo for peer if recently active (< 5 minutes or fresh tier) or hovered, and not high-density
          const isFreshOrHovered = isHovered || (freshness ? freshness.tier === 'fresh' : (Date.now() - (p.lastSeen ? new Date(p.lastSeen).getTime() : 0) < 300000));
          if (!isHighDensityMode && isFreshOrHovered) {
            const peerPulseWave = outerR + (4 + Math.sin(elapsed * 5) * 3) / transform.scale;
            ctx.beginPath();
            ctx.arc(cluster.x, cluster.y, peerPulseWave, 0, Math.PI * 2);
            ctx.strokeStyle = freshness ? freshness.pulseColor : (p.isDirect ? '#588157' : '#F4A261');
            ctx.lineWidth = 1.6 / transform.scale;
            // Add subtle pulse opacity based on how recent it is
            ctx.globalAlpha = isHovered ? 1.0 : 0.6 + Math.sin(elapsed * 2) * 0.2;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }

          // Outer Ring with Freshness Alpha & Dash Pattern
          ctx.beginPath();
          ctx.arc(cluster.x, cluster.y, outerR, 0, Math.PI * 2);
          ctx.fillStyle = isNightMode ? '#182315' : '#FFFFFF';
          ctx.globalAlpha = freshness ? freshness.alpha : 1.0;
          ctx.fill();

          ctx.strokeStyle = freshness
            ? freshness.color
            : p.isDirect
            ? '#588157'
            : p.connectionState === 'relayed'
            ? '#F4A261'
            : '#E76F51';
          ctx.lineWidth = (freshness?.tier === 'fresh' ? 3.0 : 2.5) / transform.scale;

          if (freshness && (freshness.tier === 'stale' || freshness.tier === 'dormant')) {
            ctx.setLineDash([4 / transform.scale, 2.5 / transform.scale]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Inner Center Dot
          ctx.beginPath();
          ctx.arc(cluster.x, cluster.y, innerR, 0, Math.PI * 2);
          ctx.fillStyle = freshness
            ? freshness.fillColor
            : p.isDirect
            ? '#87A878'
            : '#F4A261';
          ctx.fill();

          // 4. Vähenda tekstide arvu: kui transform.scale > 1.2 või hoverdatud, näita nime ja signaali + värskust
          if (transform.scale > 1.2 || isHovered) {
            ctx.globalAlpha = isHovered ? 1.0 : Math.max(0.65, (freshness ? freshness.alpha : 1.0));
            ctx.fillStyle = isNightMode ? '#F0F5EE' : '#203A2A';
            ctx.font = `bold ${Math.max(9, 10 / transform.scale)}px Outfit, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(p.callsign, cluster.x, cluster.y + 22 / transform.scale);

            // Freshness and Signal Tag
            ctx.fillStyle = freshness ? freshness.color : (isNightMode ? '#A8BDA5' : '#637062');
            ctx.font = `${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
            const freshnessTag = freshness ? ` • ${freshness.shortLabel}` : '';
            ctx.fillText(`${p.lastRssi}dBm • ${cluster.distKm}km${freshnessTag}`, cluster.x, cluster.y + 31 / transform.scale);
          }

          ctx.restore();
        }
      });

      // K. Draw Center User Node & Dead Reckoning Accuracy Halo
      ctx.save();
      const userOuterR = 15 / transform.scale;
      const userInnerR = 7.5 / transform.scale;

      // Draw growing accuracy halo based on accumulated drift estimate
      if (isDeadReckoningActive || deadReckoningDriftMeters > 0) {
        const baseGpsAcc = gpsPosition?.accuracy || 15;
        const totalDriftMeters = baseGpsAcc + deadReckoningDriftMeters;
        const haloRadiusPx = Math.max(22, totalDriftMeters * 1.5) / transform.scale;

        ctx.beginPath();
        ctx.arc(userWorldPos.x, userWorldPos.y, haloRadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = isDeadReckoningActive ? 'rgba(231, 111, 81, 0.14)' : 'rgba(233, 196, 106, 0.14)';
        ctx.fill();
        ctx.strokeStyle = isDeadReckoningActive ? 'rgba(231, 111, 81, 0.6)' : 'rgba(233, 196, 106, 0.45)';
        ctx.lineWidth = 1.6 / transform.scale;
        ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Position Marker: Solid circle normally, Dashed circle when dead reckoning is active
      ctx.beginPath();
      ctx.arc(userWorldPos.x, userWorldPos.y, userOuterR, 0, Math.PI * 2);
      ctx.fillStyle = isDeadReckoningActive ? '#2B1A12' : '#203A2A';
      ctx.fill();
      ctx.strokeStyle = isDeadReckoningActive ? '#E76F51' : '#E9C46A';
      ctx.lineWidth = 3 / transform.scale;
      if (isDeadReckoningActive) {
        ctx.setLineDash([5 / transform.scale, 3 / transform.scale]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(userWorldPos.x, userWorldPos.y, userInnerR, 0, Math.PI * 2);
      ctx.fillStyle = isDeadReckoningActive ? '#E76F51' : '#E9C46A';
      ctx.fill();

      ctx.fillStyle = isNightMode ? '#E9C46A' : '#203A2A';
      ctx.font = `bold ${Math.max(10, 11 / transform.scale)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      const userTag = isDeadReckoningActive
        ? `${userCallsign} (Dead Reckoning ±${deadReckoningDriftMeters.toFixed(1)}m)`
        : `${userCallsign} (You)`;
      ctx.fillText(userTag, userWorldPos.x, userWorldPos.y - 20 / transform.scale);
      ctx.fillStyle = isDeadReckoningActive ? '#E76F51' : '#588157';
      ctx.font = `${Math.max(8, 9 / transform.scale)}px JetBrains Mono, monospace`;
      ctx.fillText(
        isDeadReckoningActive ? `Confidence: ${deadReckoningConfidence}%` : `Symbiosis: ${userSymbiosisScore}`,
        userWorldPos.x,
        userWorldPos.y - 10 / transform.scale
      );
      ctx.restore();

      // Draw Real-time Device GPS Beacon if active
      if (gpsPosition) {
        ctx.save();
        const accRadius = Math.max(12, (gpsPosition.accuracy || 25) * 0.1) / transform.scale;

        // Semi-transparent accuracy circle
        ctx.beginPath();
        ctx.arc(gpsPosition.x, gpsPosition.y, accRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
        ctx.lineWidth = 1.2 / transform.scale;
        ctx.setLineDash([4 / transform.scale, 3 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated GPS pulse ring
        const prefersReducedMotion =
          (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) || isEcoMode;
        if (!prefersReducedMotion) {
          const gpsCycle = (elapsed * 1.5) % 1;
          const gpsWave = (6 + gpsCycle * 24) / transform.scale;
          ctx.beginPath();
          ctx.arc(gpsPosition.x, gpsPosition.y, gpsWave, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59, 130, 246, ${Math.max(0, (1 - gpsCycle) * 0.75)})`;
          ctx.lineWidth = 1.5 / transform.scale;
          ctx.stroke();
        }

        // Central Blue GPS Dot
        ctx.beginPath();
        ctx.arc(gpsPosition.x, gpsPosition.y, 6.5 / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#3B82F6';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / transform.scale;
        ctx.stroke();

        // Inner white dot
        ctx.beginPath();
        ctx.arc(gpsPosition.x, gpsPosition.y, 2.5 / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Label
        ctx.fillStyle = isNightMode ? '#93C5FD' : '#1D4ED8';
        ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('You (GPS Device)', gpsPosition.x, gpsPosition.y - 12 / transform.scale);
        ctx.restore();
      }

      // L. Emergency SOS Broadcast Markers Layer (renders flashing red cross regardless of layer filters)
      const currentSosAlerts = sosAlerts && sosAlerts.length > 0 ? sosAlerts : getActiveSosAlerts();
      if (currentSosAlerts.length > 0) {
        currentSosAlerts.forEach((sos) => {
          let sx = 0;
          let sy = 0;

          const matchedPeer = peers.find(
            (p) => p.callsign?.toLowerCase() === sos.from.toLowerCase() || p.id === sos.from
          );
          if (matchedPeer) {
            const pp = peerWorldPositions.find((p) => p.peer.id === matchedPeer.id);
            if (pp) {
              sx = pp.x;
              sy = pp.y;
            }
          } else {
            const gridPos = geoPointToLocalGrid(sos.lat, sos.lng, cityData.centerCoordsText);
            sx = gridPos.x;
            sy = gridPos.y;
          }

          ctx.save();
          // Flashing animated pulse wave
          const pulsePhase = (Date.now() / 250) % (Math.PI * 2);
          const rippleRadius = (22 + Math.sin(pulsePhase) * 12) / transform.scale;

          // Expanding red alert halo
          ctx.beginPath();
          ctx.arc(sx, sy, rippleRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(220, 38, 38, ${0.7 - Math.sin(pulsePhase) * 0.3})`;
          ctx.lineWidth = 3 / transform.scale;
          ctx.stroke();

          // Flashing red background circle
          ctx.beginPath();
          ctx.arc(sx, sy, 16 / transform.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#DC2626';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5 / transform.scale;
          ctx.stroke();

          // White Emergency Cross (+)
          const crossSize = 8 / transform.scale;
          const barThickness = 3 / transform.scale;
          ctx.fillStyle = '#FFFFFF';

          // Vertical bar
          ctx.fillRect(sx - barThickness / 2, sy - crossSize, barThickness, crossSize * 2);
          // Horizontal bar
          ctx.fillRect(sx - crossSize, sy - barThickness / 2, crossSize * 2, barThickness);

          // Callsign & SOS Label tag above marker
          ctx.font = `bold ${Math.max(10, 12 / transform.scale)}px JetBrains Mono, monospace`;
          ctx.fillStyle = '#DC2626';
          ctx.textAlign = 'center';
          ctx.fillText(`🚨 SOS: ${sos.from}`, sx, sy - 22 / transform.scale);

          ctx.restore();
        });
      }

      // L. Draw Distance Ruler
      if (isRulerMode && rulerPoints.length > 0) {
        ctx.save();
        const p1 = rulerPoints[0];
        const p2 = rulerPoints.length > 1 ? rulerPoints[1] : (cursorWorldPos || p1);

        // Draw Line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#E76F51'; // Vibrant red-orange
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
        ctx.stroke();

        // Draw Points
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 4 / transform.scale, 0, Math.PI * 2);
        ctx.arc(p2.x, p2.y, 4 / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#E76F51';
        ctx.fill();

        // Draw Distance Text
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        // Assuming 1 world unit = 5 meters for visualization (adjust as needed based on scale logic)
        const meters = dist * 5; 
        
        ctx.font = `bold ${Math.max(10, 12 / transform.scale)}px sans-serif`;
        ctx.fillStyle = '#111';
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Text background
        const text = `${meters.toFixed(0)}m`;
        const metrics = ctx.measureText(text);
        const padding = 4 / transform.scale;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(
          midX - metrics.width / 2 - padding, 
          midY - 14 / transform.scale, 
          metrics.width + padding * 2, 
          16 / transform.scale
        );
        
        ctx.fillStyle = '#E76F51';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, midX, midY - 2 / transform.scale);

        ctx.restore();
      }

      // M. Draw Active Offline Street Route
      if (activeRoutePath && activeRoutePath.length > 1) {
        ctx.save();

        // 1. Wide Route Glow
        ctx.beginPath();
        ctx.moveTo(activeRoutePath[0][0], activeRoutePath[0][1]);
        for (let i = 1; i < activeRoutePath.length; i++) {
          ctx.lineTo(activeRoutePath[i][0], activeRoutePath[i][1]);
        }
        ctx.strokeStyle = isNightMode ? 'rgba(233, 196, 106, 0.45)' : 'rgba(88, 129, 87, 0.35)';
        ctx.lineWidth = 10 / transform.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 2. Main Street Route Line
        ctx.beginPath();
        ctx.moveTo(activeRoutePath[0][0], activeRoutePath[0][1]);
        for (let i = 1; i < activeRoutePath.length; i++) {
          ctx.lineTo(activeRoutePath[i][0], activeRoutePath[i][1]);
        }
        ctx.strokeStyle = isNightMode ? '#E9C46A' : '#588157';
        ctx.lineWidth = 4.5 / transform.scale;
        ctx.stroke();

        // 3. Directional animated marching dashes
        ctx.beginPath();
        ctx.moveTo(activeRoutePath[0][0], activeRoutePath[0][1]);
        for (let i = 1; i < activeRoutePath.length; i++) {
          ctx.lineTo(activeRoutePath[i][0], activeRoutePath[i][1]);
        }
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([7 / transform.scale, 7 / transform.scale]);
        ctx.lineDashOffset = -(elapsed * 24) / transform.scale;
        ctx.stroke();
        ctx.setLineDash([]);

        // 4. Direction arrows along long segments
        for (let i = 0; i < activeRoutePath.length - 1; i++) {
          const p1 = activeRoutePath[i];
          const p2 = activeRoutePath[i + 1];
          const segDist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
          if (segDist > 18) {
            const midX = (p1[0] + p2[0]) / 2;
            const midY = (p1[1] + p2[1]) / 2;
            const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-5 / transform.scale, -4 / transform.scale);
            ctx.lineTo(5 / transform.scale, 0);
            ctx.lineTo(-5 / transform.scale, 4 / transform.scale);
            ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
            ctx.lineWidth = 1.8 / transform.scale;
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.restore();
      }

      // Draw Route Start (A) & Destination (B) Marker Pins
      if (routeStart) {
        ctx.save();
        const startPulse = (8 + ((elapsed * 2.5) % 1) * 14) / transform.scale;
        ctx.beginPath();
        ctx.arc(routeStart.x, routeStart.y, startPulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(42, 157, 143, 0.6)';
        ctx.lineWidth = 1.5 / transform.scale;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(routeStart.x, routeStart.y, 8 / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#2A9D8F';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / transform.scale;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(8, 10 / transform.scale)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('A', routeStart.x, routeStart.y + 3.5 / transform.scale);

        ctx.fillStyle = isNightMode ? '#2A9D8F' : '#203A2A';
        ctx.font = `bold ${Math.max(9, 10 / transform.scale)}px Outfit, sans-serif`;
        ctx.fillText(routeStart.label || 'Algus (A)', routeStart.x, routeStart.y - 12 / transform.scale);
        ctx.restore();
      }

      if (routeDestination) {
        ctx.save();
        const destPulse = (8 + ((elapsed * 2.5) % 1) * 14) / transform.scale;
        ctx.beginPath();
        ctx.arc(routeDestination.x, routeDestination.y, destPulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 111, 81, 0.6)';
        ctx.lineWidth = 1.5 / transform.scale;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(routeDestination.x, routeDestination.y, 8 / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#E76F51';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / transform.scale;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(8, 10 / transform.scale)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('B', routeDestination.x, routeDestination.y + 3.5 / transform.scale);

        ctx.fillStyle = isNightMode ? '#E76F51' : '#203A2A';
        ctx.font = `bold ${Math.max(9, 10 / transform.scale)}px Outfit, sans-serif`;
        ctx.fillText(routeDestination.label || 'Sihtkoht (B)', routeDestination.x, routeDestination.y - 12 / transform.scale);
        ctx.restore();
      }

      // N. DRAW PATHFINDER MODE LAYERS (GPS Tracks, WiFi, BLE, LoRa Nodes & Novelty Badges)
      if (showPathfinderLayer !== false) {
        const latLonToWorld = (lat: number, lon: number): { x: number; y: number } => {
          const centerLat = 58.3780;
          const centerLon = 26.7290;
          const worldX = (lon - centerLon) * 5828.0;
          const worldY = -(lat - centerLat) * 11113.9;
          return { x: worldX, y: worldY };
        };

        const activeSessionId = activeWalkSession?.id;

        // 1. Past Walk Tracks (Heritage trails)
        if (pathfinderFilter?.showTracks !== false && allWalkSessions && allWalkSessions.length > 0) {
          ctx.save();
          allWalkSessions.forEach((session) => {
            if (session.id === activeSessionId) return; // Drawn separately below
            if (!session.track || session.track.length < 2) return;

            ctx.beginPath();
            const startPt = latLonToWorld(session.track[0].latitude, session.track[0].longitude);
            ctx.moveTo(startPt.x, startPt.y);

            for (let i = 1; i < session.track.length; i++) {
              const pt = latLonToWorld(session.track[i].latitude, session.track[i].longitude);
              ctx.lineTo(pt.x, pt.y);
            }

            ctx.strokeStyle = isNightMode ? 'rgba(233, 196, 106, 0.45)' : 'rgba(231, 111, 81, 0.4)';
            ctx.lineWidth = 2 / transform.scale;
            ctx.setLineDash([5 / transform.scale, 4 / transform.scale]);
            ctx.stroke();

            // Start & Finish points
            const endPt = latLonToWorld(
              session.track[session.track.length - 1].latitude,
              session.track[session.track.length - 1].longitude
            );
            ctx.beginPath();
            ctx.arc(startPt.x, startPt.y, 3 / transform.scale, 0, Math.PI * 2);
            ctx.arc(endPt.x, endPt.y, 3.5 / transform.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#E9C46A';
            ctx.fill();
          });
          ctx.restore();
        }

        // 2. Active Walk Session Track (Live glowing trail)
        if (activeWalkSession && activeWalkSession.track && activeWalkSession.track.length > 0) {
          ctx.save();
          const trk = activeWalkSession.track;

          if (trk.length >= 2) {
            ctx.beginPath();
            const p0 = latLonToWorld(trk[0].latitude, trk[0].longitude);
            ctx.moveTo(p0.x, p0.y);

            for (let i = 1; i < trk.length; i++) {
              const pi = latLonToWorld(trk[i].latitude, trk[i].longitude);
              ctx.lineTo(pi.x, pi.y);
            }

            ctx.strokeStyle = '#E76F51';
            ctx.lineWidth = 3.5 / transform.scale;
            ctx.setLineDash([]);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }

          // Active Walker Pulse at latest GPS breadcrumb
          const lastPt = trk[trk.length - 1];
          const lastWorld = latLonToWorld(lastPt.latitude, lastPt.longitude);

          const walkerPulse = (6 + ((elapsed * 2.2) % 1) * 16) / transform.scale;
          ctx.beginPath();
          ctx.arc(lastWorld.x, lastWorld.y, walkerPulse, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(231, 111, 81, 0.6)';
          ctx.lineWidth = 1.8 / transform.scale;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(lastWorld.x, lastWorld.y, 7 / transform.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#E76F51';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2 / transform.scale;
          ctx.stroke();

          // Mini walker icon tag
          ctx.fillStyle = isNightMode ? '#E76F51' : '#203A2A';
          ctx.font = `bold ${Math.max(9, 10 / transform.scale)}px Outfit, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('🏃 Pathfinder', lastWorld.x, lastWorld.y - 12 / transform.scale);

          ctx.restore();
        }

        // 3. Discovered WiFi Spots Layer (Color-coded Sky Blue / Cyan `#0284C7`, Gold `#E9C46A` if NEW)
        if (pathfinderFilter?.showWifi !== false && wifiSpots && wifiSpots.length > 0) {
          wifiSpots.forEach((spot) => {
            if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) {
              return;
            }

            const pos = latLonToWorld(spot.latitude, spot.longitude);
            // Viewport culling for wifi spot
            if (!isWorldPointInViewport(pos.x, pos.y, 35)) return;

            const isNewThisWalk = Boolean(activeSessionId && spot.walkSessionId === activeSessionId);

            ctx.save();
            const r = 7.5 / transform.scale;

            // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil
            if (transform.scale < 1.1) {
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, r * 0.75, 0, Math.PI * 2);
              ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#0284C7';
              ctx.fill();
              ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
              ctx.lineWidth = 1 / transform.scale;
              ctx.stroke();
              ctx.restore();
              return;
            }

            // Outer glowing ring for new discoveries in GOLD
            if (isNewThisWalk) {
              const glowR = (10 + Math.sin(elapsed * 4) * 3) / transform.scale;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
              ctx.strokeStyle = '#E9C46A';
              ctx.lineWidth = 2.5 / transform.scale;
              ctx.stroke();
            }

            // Pin base
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#0284C7';
            ctx.fill();
            ctx.strokeStyle = isNewThisWalk ? '#FFFFFF' : '#0284C7';
            ctx.lineWidth = 1.8 / transform.scale;
            ctx.stroke();

            // Mini WiFi icon symbol
            ctx.fillStyle = isNewThisWalk ? '#203A2A' : '#FFFFFF';
            ctx.font = `${Math.max(6, 8 / transform.scale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📶', pos.x, pos.y);

            // 4. Vähenda tekstide arvu: näita nimesilti ainult kui suum > 1.2
            if (transform.scale > 1.2) {
              ctx.fillStyle = isNightMode ? '#38BDF8' : '#0369A1';
              ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px Outfit, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(spot.ssid, pos.x, pos.y - 9 / transform.scale);

              if (isNewThisWalk) {
                ctx.fillStyle = '#E9C46A';
                ctx.font = `bold ${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
                ctx.fillText('✨ GOLD NEW WiFi', pos.x, pos.y - 18 / transform.scale);
              }
            }

            ctx.restore();
          });
        }

        // 4. Discovered Bluetooth BLE Spots Layer (Color-coded Purple `#8B5CF6`, Gold `#E9C46A` if NEW)
        if (pathfinderFilter?.showBluetooth !== false && bluetoothSpots && bluetoothSpots.length > 0) {
          bluetoothSpots.forEach((spot) => {
            if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) {
              return;
            }

            const pos = latLonToWorld(spot.latitude, spot.longitude);
            // Viewport culling for bluetooth spot
            if (!isWorldPointInViewport(pos.x, pos.y, 35)) return;

            const isNewThisWalk = Boolean(activeSessionId && spot.walkSessionId === activeSessionId);

            ctx.save();
            const r = 7.5 / transform.scale;

            // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil
            if (transform.scale < 1.1) {
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, r * 0.75, 0, Math.PI * 2);
              ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#8B5CF6';
              ctx.fill();
              ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
              ctx.lineWidth = 1 / transform.scale;
              ctx.stroke();
              ctx.restore();
              return;
            }

            if (isNewThisWalk) {
              const glowR = (10 + Math.sin(elapsed * 4 + 1) * 3) / transform.scale;
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
              ctx.strokeStyle = '#E9C46A';
              ctx.lineWidth = 2.5 / transform.scale;
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#8B5CF6';
            ctx.fill();
            ctx.strokeStyle = isNewThisWalk ? '#FFFFFF' : '#8B5CF6';
            ctx.lineWidth = 1.8 / transform.scale;
            ctx.stroke();

            ctx.fillStyle = isNewThisWalk ? '#203A2A' : '#FFFFFF';
            ctx.font = `${Math.max(6, 8 / transform.scale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ᛒ', pos.x, pos.y);

            // 4. Vähenda tekstide arvu: näita nimesilti ainult kui suum > 1.2
            if (transform.scale > 1.2) {
              ctx.fillStyle = isNightMode ? '#C084FC' : '#6B21A8';
              ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px Outfit, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(spot.deviceName, pos.x, pos.y - 9 / transform.scale);

              if (isNewThisWalk) {
                ctx.fillStyle = '#E9C46A';
                ctx.font = `bold ${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
                ctx.fillText('✨ GOLD NEW BLE', pos.x, pos.y - 18 / transform.scale);
              }
            }

            ctx.restore();
          });
        }

        // 5. Discovered LoRa Mesh Nodes Layer (Color-coded Emerald Green `#10B981`, Gold `#E9C46A` if NEW)
        if (pathfinderFilter?.showLora !== false && loraNodes && loraNodes.length > 0) {
          loraNodes.forEach((node) => {
            if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && node.walkSessionId !== activeSessionId) {
              return;
            }

            const pos = latLonToWorld(node.latitude, node.longitude);
            // Viewport culling for LoRa node
            if (!isWorldPointInViewport(pos.x, pos.y, 35)) return;

            const isNewThisWalk = Boolean(activeSessionId && node.walkSessionId === activeSessionId);

            ctx.save();
            const r = 8.5 / transform.scale;

            // 5. Kasuta lihtsamaid graafilisi elemente madalal suumil
            if (transform.scale < 1.1) {
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, r * 0.75, 0, Math.PI * 2);
              ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#10B981';
              ctx.fill();
              ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
              ctx.lineWidth = 1 / transform.scale;
              ctx.stroke();
              ctx.restore();
              return;
            }

            // Radiating radio waves
            const wave = (9 + ((elapsed * 1.8) % 1) * 14) / transform.scale;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, wave, 0, Math.PI * 2);
            ctx.strokeStyle = isNewThisWalk ? 'rgba(233, 196, 106, 0.7)' : 'rgba(16, 185, 129, 0.5)';
            ctx.lineWidth = 1.8 / transform.scale;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = isNewThisWalk ? '#E9C46A' : '#10B981';
            ctx.fill();
            ctx.strokeStyle = isNewThisWalk ? '#203A2A' : '#FFFFFF';
            ctx.lineWidth = 2 / transform.scale;
            ctx.stroke();

            ctx.fillStyle = isNewThisWalk ? '#203A2A' : '#FFFFFF';
            ctx.font = `${Math.max(6, 8 / transform.scale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📻', pos.x, pos.y);

            // 4. Vähenda tekstide arvu: näita nimesilti ainult kui suum > 1.2
            if (transform.scale > 1.2) {
              ctx.fillStyle = isNightMode ? '#34D399' : '#065F46';
              ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px Outfit, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(node.callsign, pos.x, pos.y - 10 / transform.scale);

              if (isNewThisWalk) {
                ctx.fillStyle = '#E9C46A';
                ctx.font = `bold ${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
                ctx.fillText('✨ GOLD NEW LoRa', pos.x, pos.y - 19 / transform.scale);
              } else {
                ctx.fillStyle = '#588157';
                ctx.font = `${Math.max(7, 8 / transform.scale)}px JetBrains Mono, monospace`;
                ctx.fillText(`${node.frequency}MHz • ${node.rssi}dBm`, pos.x, pos.y + 16 / transform.scale);
              }
            }

            ctx.restore();
          });
        }
      }

      ctx.restore(); // END TRANSFORMED WORLD SPACE

      // 3. SCREEN SPACE ANNOTATIONS, DYNAMIC COMPASS ROSE & TOOLTIPS
      ctx.save();

      // Top Left Map Metrics & IndexedDB status
      ctx.fillStyle = isNightMode ? '#60795B' : '#8A9988';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`CITY: ${cityData.cityName.toUpperCase()} (${cityData.centerCoordsText})`, 12, 18);
      ctx.fillText(`ZOOM: ${(transform.scale * 100).toFixed(0)}% | ROT: ${(transform.rotation * (180 / Math.PI)).toFixed(0)}°`, 12, 30);
      ctx.fillStyle = isIndexedDBCached ? '#2A9D8F' : '#E9C46A';
      ctx.fillText(`IDB TILE CACHE: ${isIndexedDBCached ? 'SYNCHRONIZED' : 'INDEXING...'}`, 12, 42);

      // Top Right Screen Space Compass Rose
      const compassCx = width - 42;
      const compassCy = 42;
      drawCompassRose(ctx, compassCx, compassCy, 24, transform.rotation, isNightMode);

      // Tooltip Overlay
      if (hoveredEntity) {
        let tooltipX = width / 2;
        let tooltipY = height / 2;

        if (hoveredEntity.type === 'compass') {
          tooltipX = compassCx;
          tooltipY = compassCy + 38;
        } else {
          const { screenX, screenY } = getScreenCoords(
            hoveredEntity.worldX,
            hoveredEntity.worldY,
            width,
            height
          );
          tooltipX = Math.min(width - 100, Math.max(100, screenX));
          tooltipY = Math.max(45, screenY - 35);
        }

        ctx.fillStyle = isNightMode ? 'rgba(34, 49, 32, 0.95)' : 'rgba(32, 58, 42, 0.92)';
        ctx.strokeStyle = '#87A878';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(tooltipX - 75, tooltipY - 26, 150, 36, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E9C46A';
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hoveredEntity.title, tooltipX, tooltipY - 12);

        ctx.fillStyle = '#F0F5EE';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(hoveredEntity.subtitle, tooltipX, tooltipY - 1);
      }

      // 4. ACTIVE FOCAL POINT VISUAL RETICLE INDICATOR (Focal-Point Zoom & Orientation Feedback)
      if (activeFocalPointRef.current) {
        const fp = activeFocalPointRef.current;
        const age = performance.now() - fp.timestamp;
        if (age < 1300) {
          const isReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

          // Fade out smoothly over last 500ms
          const alpha = Math.max(0, Math.min(1, (1300 - age) / 500));

          // Screen position of focal point: if it has geographic world coordinates,
          // compute dynamic screen coordinates so it stays locked to world anchor point during gestures
          let reticleX = fp.screenX;
          let reticleY = fp.screenY;
          if (fp.worldX !== 0 || fp.worldY !== 0) {
            const liveCoords = getScreenCoords(fp.worldX, fp.worldY, width, height);
            reticleX = liveCoords.screenX;
            reticleY = liveCoords.screenY;
          }

          ctx.save();
          ctx.translate(reticleX, reticleY);

          const pulse = isReducedMotion ? 0 : Math.sin(now / 130) * 1.6;
          const baseRadius = 18 + pulse;

          // Concentric Expanding Solarpunk Wave Ripple
          if (!isReducedMotion) {
            const rippleProgress = ((now / 12) % 45) / 45;
            const rippleRadius = 14 + rippleProgress * 28;
            const rippleAlpha = alpha * (1 - rippleProgress) * 0.75;
            ctx.beginPath();
            ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(42, 157, 143, ${rippleAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Main Reticle Ring
          ctx.beginPath();
          ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode
            ? `rgba(233, 196, 106, ${alpha * 0.9})`
            : `rgba(32, 58, 42, ${alpha * 0.9})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Precision Crosshair Brackets
          const tickLen = 6;
          const tickDist = baseRadius;
          ctx.strokeStyle = `rgba(231, 111, 81, ${alpha * 0.95})`; // Terra Cotta
          ctx.lineWidth = 2;
          [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach((rad) => {
            const cosA = Math.cos(rad);
            const sinA = Math.sin(rad);
            ctx.beginPath();
            ctx.moveTo(cosA * (tickDist - 4), sinA * (tickDist - 4));
            ctx.lineTo(cosA * (tickDist + tickLen), sinA * (tickDist + tickLen));
            ctx.stroke();
          });

          // Center Pin Dot
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#E9C46A';
          ctx.fill();
          ctx.strokeStyle = isNightMode ? '#141E12' : '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Solarpunk Data Micro-Badge
          const badgeText = `FOOKUS ${(fp.scale).toFixed(1)}x`;
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(badgeText);
          const badgeWidth = textMetrics.width + 16;
          const badgeHeight = 18;
          const badgeY = baseRadius + 10;

          ctx.fillStyle = isNightMode
            ? `rgba(20, 30, 18, ${alpha * 0.92})`
            : `rgba(250, 246, 238, ${alpha * 0.95})`;
          ctx.strokeStyle = `rgba(88, 129, 87, ${alpha * 0.8})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isNightMode ? '#E9C46A' : '#203A2A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, 0, badgeY + badgeHeight / 2);

          ctx.restore();
        } else {
          activeFocalPointRef.current = null;
        }
      }
      ctx.restore();

      ctx.restore();
    };

    // Register canvas draw callback with the unified single RAF scheduler
    const unregisterRaf = rafScheduler.register('bioregional-map-canvas', render);

    return () => {
      stopKineticPan();
      unregisterRaf();
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
      }
    };
  }, [
    peers,
    visibleResources,
    userSymbiosisScore,
    userCallsign,
    isNightMode,
    showMeshLinks,
    showDensityHeatmap,
    showSignalHeatmap,
    showCachedZones,
    showContours,
    showRadii,
    cityData,
    hoveredEntity,
    topologyFilter,
    isIndexedDBCached,
    perimeterPoints,
    isPerimeterClosed,
    isPlacingPerimeterMarker,
    cursorWorldPos,
    isNearFirstPerimeterPoint,
    gpsPosition,
    calculateWorldPositions,
    getScreenCoords,
    stopKineticPan,
    isDragging,
    isOverlay,
    isEcoMode,
    mapInstance,
    mapMoveCount,
  ]);

  // Handle Canvas Resizing
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Mouse & Touch Gesture Listeners with High-Performance Throttling & Kinetic Physics
  const startLongPressTimer = (clientX: number, clientY: number) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (!onLongPress) return;
    longPressTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = clientX - rect.left;
      const mouseScreenY = clientY - rect.top;
      const { worldX, worldY } = getWorldCoords(mouseScreenX, mouseScreenY, rect.width, rect.height);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(30);
        } catch {}
      }
      onLongPress({ x: worldX, y: worldY });
    }, 600);
  };

  const cancelLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    stopKineticPan();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialOffsetX: transformRef.current.offsetX,
      initialOffsetY: transformRef.current.offsetY,
    };
    velocityHistoryRef.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
    startLongPressTimer(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;
    const currentScale = transformRef.current.scale;

    if (isDragging && dragStartRef.current) {
      const now = performance.now();
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (Math.hypot(dx, dy) > 5) {
        cancelLongPressTimer();
      }

      velocityHistoryRef.current.push({ x: e.clientX, y: e.clientY, time: now });
      if (velocityHistoryRef.current.length > 8) {
        velocityHistoryRef.current.shift();
      }
      velocityHistoryRef.current = velocityHistoryRef.current.filter((p) => now - p.time <= 90);

      updateTransform((prev) => ({
        ...prev,
        offsetX: dragStartRef.current!.initialOffsetX + dx,
        offsetY: dragStartRef.current!.initialOffsetY + dy,
      }), false);
      return;
    }

    // Check Compass Hover in Screen Space
    const compassCx = rect.width - 42;
    const compassCy = 42;
    if (Math.hypot(mouseScreenX - compassCx, mouseScreenY - compassCy) < 28) {
      setHoveredEntity({
        type: 'compass',
        id: 'compass_rose',
        title: 'Compass Rose (North)',
        subtitle: 'Click to orient North (0 deg)',
        worldX: 0,
        worldY: 0,
      });
      return;
    }

    // Hover detection using World Coordinates
    const { worldX, worldY } = getWorldCoords(mouseScreenX, mouseScreenY, rect.width, rect.height);
    const { userWorldPos, peerClusters, resourceClusters } = calculateWorldPositions();

    // In Perimeter Placement Mode or Ruler Mode: update live guide cursor
    if (isPlacingPerimeterMarker || isRulerMode) {
      setCursorWorldPos({ x: worldX, y: worldY });

      // If at least 3 points, check if hovering close to P1 to snap-close
      if (isPlacingPerimeterMarker && perimeterPoints.length >= 3 && !isPerimeterClosed) {
        const p1 = perimeterPoints[0];
        const distToP1 = Math.hypot(worldX - p1[0], worldY - p1[1]);
        if (distToP1 < 22 / currentScale) {
          setIsNearFirstPerimeterPoint(true);
          setHoveredEntity({
            type: 'landmark',
            id: 'snap_close_loop',
            title: 'Close Perimeter Loop',
            subtitle: 'Click on P1 to complete closed boundary area',
            worldX: p1[0],
            worldY: p1[1],
          });
          return;
        } else {
          setIsNearFirstPerimeterPoint(false);
        }
      } else {
        setIsNearFirstPerimeterPoint(false);
      }
    } else {
      if (cursorWorldPos) setCursorWorldPos(null);
      if (isNearFirstPerimeterPoint) setIsNearFirstPerimeterPoint(false);
    }

    // Check User Node
    if (Math.hypot(worldX - userWorldPos.x, worldY - userWorldPos.y) < 20 / currentScale) {
      setHoveredEntity({
        type: 'user',
        id: 'user_node',
        title: `${userCallsign} (Local Node)`,
        subtitle: `Score: ${userSymbiosisScore} Pts`,
        worldX: userWorldPos.x,
        worldY: userWorldPos.y,
      });
      return;
    }

    // Check Peer Nodes and Peer Clusters
    for (const cluster of peerClusters) {
      const radius = cluster.isCluster ? 20 / currentScale : 18 / currentScale;
      if (Math.hypot(worldX - cluster.x, worldY - cluster.y) < radius) {
        if (cluster.isCluster) {
          setHoveredEntity({
            type: 'peerCluster',
            id: cluster.id,
            title: `📶 Sõlmede kobar (${cluster.count} sõlme)`,
            subtitle: `${cluster.directCount} otsest • ${cluster.relayedCount} vahendatud • ~${cluster.avgRssi} dBm`,
            worldX: cluster.x,
            worldY: cluster.y,
          });
        } else if (cluster.singlePeer) {
          setHoveredEntity({
            type: 'peer',
            id: cluster.singlePeer.id,
            title: cluster.singlePeer.callsign,
            subtitle: `${cluster.singlePeer.connectionState.toUpperCase()} • ${cluster.singlePeer.lastRssi} dBm • ${cluster.distKm}km`,
            worldX: cluster.x,
            worldY: cluster.y,
          });
        }
        return;
      }
    }

    // Check Resource Clusters and Single Pins
    for (const cluster of resourceClusters) {
      const radius = cluster.isCluster ? 18 / currentScale : 16 / currentScale;
      const distTip = Math.hypot(worldX - cluster.x, worldY - cluster.y);
      const distHead = Math.hypot(worldX - cluster.x, worldY - (cluster.y - 18 / currentScale));

      if (distTip < radius || (!cluster.isCluster && distHead < radius)) {
        if (cluster.isCluster) {
          const catBreakdown = Object.entries(cluster.categoryCounts)
            .map(([cat, cnt]) => `${cnt}x ${cat}`)
            .join(' • ');
          setHoveredEntity({
            type: 'resourceCluster',
            id: cluster.id,
            title: `📦 Ressursikobar (${cluster.count} eset)`,
            subtitle: catBreakdown,
            worldX: cluster.x,
            worldY: cluster.y,
          });
        } else if (cluster.singleResource) {
          setHoveredEntity({
            type: 'resource',
            id: cluster.singleResource.id,
            title: cluster.singleResource.title.slice(0, 22) + (cluster.singleResource.title.length > 22 ? '...' : ''),
            subtitle: `${cluster.singleResource.category} • ${cluster.singleResource.ownerCallsign}`,
            worldX: cluster.x,
            worldY: cluster.y - 18 / currentScale,
          });
        }
        return;
      }
    }

    // Check Survival POIs
    if (cityData.survivalPois) {
      for (const poi of cityData.survivalPois) {
        if (visiblePoiCategories && !visiblePoiCategories.has(poi.category)) continue;

        if (Math.hypot(worldX - poi.x, worldY - poi.y) < 18 / currentScale) {
          setHoveredEntity({
            type: 'survivalPoi',
            id: poi.id,
            title: poi.name,
            subtitle: `Survival POI • ${poi.category}`,
            worldX: poi.x,
            worldY: poi.y,
          });
          return;
        }
      }
    }

    // Check Pathfinder spots (WiFi, BLE, LoRa)
    if (showPathfinderLayer !== false) {
      const latLonToWorld = (lat: number, lon: number): { x: number; y: number } => {
        const centerLat = 58.3780;
        const centerLon = 26.7290;
        return {
          x: (lon - centerLon) * 5828.0,
          y: -(lat - centerLat) * 11113.9,
        };
      };
      const activeSessionId = activeWalkSession?.id;

      if (pathfinderFilter?.showWifi !== false && wifiSpots) {
        for (const spot of wifiSpots) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(spot.latitude, spot.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 18 / currentScale) {
            const isNew = Boolean(activeSessionId && spot.walkSessionId === activeSessionId);
            setHoveredEntity({
              type: 'wifiSpot' as any,
              id: spot.bssid,
              title: `📶 WiFi: ${spot.ssid}`,
              subtitle: `${spot.security || 'WPA2'} • Signal: ${spot.signalDbm} dBm ${isNew ? '• ✨ GOLD NEW DISCOVERY' : ''}`,
              worldX: pos.x,
              worldY: pos.y,
            });
            return;
          }
        }
      }

      if (pathfinderFilter?.showBluetooth !== false && bluetoothSpots) {
        for (const spot of bluetoothSpots) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(spot.latitude, spot.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 18 / currentScale) {
            const isNew = Boolean(activeSessionId && spot.walkSessionId === activeSessionId);
            setHoveredEntity({
              type: 'bleSpot' as any,
              id: spot.address,
              title: `ᛒ Bluetooth: ${spot.deviceName}`,
              subtitle: `${spot.address} • RSSI: ${spot.rssi} dBm ${isNew ? '• ✨ GOLD NEW DISCOVERY' : ''}`,
              worldX: pos.x,
              worldY: pos.y,
            });
            return;
          }
        }
      }

      if (pathfinderFilter?.showLora !== false && loraNodes) {
        for (const node of loraNodes) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && node.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(node.latitude, node.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 20 / currentScale) {
            const isNew = Boolean(activeSessionId && node.walkSessionId === activeSessionId);
            setHoveredEntity({
              type: 'loraNode' as any,
              id: node.id,
              title: `📻 LoRa Node: ${node.callsign}`,
              subtitle: `${node.frequency} MHz • RSSI: ${node.rssi} dBm ${isNew ? '• ✨ GOLD NEW DISCOVERY' : ''}`,
              worldX: pos.x,
              worldY: pos.y,
            });
            return;
          }
        }
      }
    }

    setHoveredEntity(null);
  };

  const handleMouseUp = () => {
    cancelLongPressTimer();
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      checkKineticRelease();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopKineticPan();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorScreenX = e.clientX - rect.left;
    const cursorScreenY = e.clientY - rect.top;

    // Trackpad 2-finger Pan Gesture (horizontal scrolling or shift+scroll)
    if (!e.ctrlKey && (Math.abs(e.deltaX) > 0 || e.shiftKey)) {
      const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
      const dy = e.shiftKey ? 0 : -e.deltaY;
      updateTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }), false);
      return;
    }

    // Support both trackpad pinch gesture (e.ctrlKey) and mouse wheel scroll
    const zoomMultiplier = e.ctrlKey ? Math.exp(-e.deltaY * 0.012) : e.deltaY < 0 ? 1.15 : 0.85;
    const current = transformRef.current;
    const targetScale = Math.min(5.0, Math.max(0.4, current.scale * zoomMultiplier));

    // Focal-point zoom keeping world point under cursor stationary
    const newTrans = calculateFocalPointZoom(
      current,
      cursorScreenX,
      cursorScreenY,
      rect.width,
      rect.height,
      targetScale
    );

    // Active Focal Reticle Visual Indicator tracking
    const { worldX, worldY } = getWorldCoords(cursorScreenX, cursorScreenY, rect.width, rect.height);
    activeFocalPointRef.current = {
      screenX: cursorScreenX,
      screenY: cursorScreenY,
      worldX,
      worldY,
      scale: targetScale,
      timestamp: performance.now(),
    };

    updateTransform(() => newTrans, false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    stopKineticPan();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorScreenX = e.clientX - rect.left;
    const cursorScreenY = e.clientY - rect.top;

    const current = transformRef.current;
    const targetScale = Math.min(5.0, current.scale * 1.4);

    const newTrans = calculateFocalPointZoom(
      current,
      cursorScreenX,
      cursorScreenY,
      rect.width,
      rect.height,
      targetScale
    );

    const { worldX, worldY } = getWorldCoords(cursorScreenX, cursorScreenY, rect.width, rect.height);
    activeFocalPointRef.current = {
      screenX: cursorScreenX,
      screenY: cursorScreenY,
      worldX,
      worldY,
      scale: targetScale,
      timestamp: performance.now(),
    };

    updateTransform(() => newTrans, true);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If was dragging significantly, don't trigger click action
    if (dragStartRef.current) {
      const dist = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );
      if (dist > 5) return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;
    const currentScale = transformRef.current.scale;

    // Check Compass Click (Reset North)
    const compassCx = rect.width - 42;
    const compassCy = 42;
    if (Math.hypot(mouseScreenX - compassCx, mouseScreenY - compassCy) < 28) {
      updateTransform((prev) => ({ ...prev, rotation: 0 }), true);
      return;
    }

    const { worldX, worldY } = getWorldCoords(mouseScreenX, mouseScreenY, rect.width, rect.height);

    if (isRulerMode && onRulerClick) {
      onRulerClick({ x: worldX, y: worldY });
      return;
    }

    // If in Route Planning Mode, click to set start/destination waypoint
    if (isRouteMode && onMapRouteClick) {
      onMapRouteClick({ x: worldX, y: worldY });
      return;
    }

    // If in perimeter marker placement mode, drop point or snap close!
    if (isPlacingPerimeterMarker) {
      if (isNearFirstPerimeterPoint && onClosePerimeter && perimeterPoints.length >= 3) {
        onClosePerimeter();
        setIsNearFirstPerimeterPoint(false);
        setCursorWorldPos(null);
        return;
      }
      if (onAddPerimeterPoint) {
        onAddPerimeterPoint([Math.round(worldX), Math.round(worldY)]);
        return;
      }
    }

    const { peerClusters, resourceClusters } = calculateWorldPositions();

    // Check click on resource clusters or single pins
    for (const cluster of resourceClusters) {
      const radius = cluster.isCluster ? 20 / currentScale : 18 / currentScale;
      const distTip = Math.hypot(worldX - cluster.x, worldY - cluster.y);
      const distHead = Math.hypot(worldX - cluster.x, worldY - (cluster.y - 18 / currentScale));

      if (distTip < radius || (!cluster.isCluster && distHead < radius)) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(15); } catch {}
        }
        if (cluster.isCluster) {
          setSelectedPoiPopup(null);
          setSelectedPeerClusterPopup(null);
          setSelectedClusterPopup({
            cluster,
            x: mouseScreenX,
            y: mouseScreenY,
          });
          return;
        } else if (cluster.singleResource) {
          setSelectedClusterPopup(null);
          setSelectedPeerClusterPopup(null);
          onSelectResource?.(cluster.singleResource);
          return;
        }
      }
    }

    // Check click on peers or peer clusters
    for (const cluster of peerClusters) {
      const radius = cluster.isCluster ? 22 / currentScale : 20 / currentScale;
      if (Math.hypot(worldX - cluster.x, worldY - cluster.y) < radius) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(15); } catch {}
        }
        if (cluster.isCluster) {
          setSelectedPoiPopup(null);
          setSelectedClusterPopup(null);
          setSelectedPeerClusterPopup({
            cluster,
            x: mouseScreenX,
            y: mouseScreenY,
          });
          return;
        } else if (cluster.singlePeer) {
          setSelectedPeerClusterPopup(null);
          onSelectNode?.(cluster.singlePeer);
          return;
        }
      }
    }

    // Check click on Survival POIs
    if (cityData.survivalPois) {
      for (const poi of cityData.survivalPois) {
        if (visiblePoiCategories && !visiblePoiCategories.has(poi.category)) continue;

        if (Math.hypot(worldX - poi.x, worldY - poi.y) < 20 / currentScale) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(15); } catch {}
          }
          setSelectedPoiPopup({ poi, x: mouseScreenX, y: mouseScreenY });
          return;
        }
      }
    }

    // Check click on Pathfinder spots
    if (showPathfinderLayer !== false) {
      const latLonToWorld = (lat: number, lon: number): { x: number; y: number } => {
        const centerLat = 58.3780;
        const centerLon = 26.7290;
        return {
          x: (lon - centerLon) * 5828.0,
          y: -(lat - centerLat) * 11113.9,
        };
      };
      const activeSessionId = activeWalkSession?.id;

      if (pathfinderFilter?.showWifi !== false && wifiSpots) {
        for (const spot of wifiSpots) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(spot.latitude, spot.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 20 / currentScale) {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(15); } catch {}
            }
            onSelectPathfinderSpot?.({ type: 'wifi', data: spot });
            return;
          }
        }
      }

      if (pathfinderFilter?.showBluetooth !== false && bluetoothSpots) {
        for (const spot of bluetoothSpots) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && spot.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(spot.latitude, spot.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 20 / currentScale) {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(15); } catch {}
            }
            onSelectPathfinderSpot?.({ type: 'ble', data: spot });
            return;
          }
        }
      }

      if (pathfinderFilter?.showLora !== false && loraNodes) {
        for (const node of loraNodes) {
          if (pathfinderFilter?.onlyNewDiscoveries && activeSessionId && node.walkSessionId !== activeSessionId) continue;
          const pos = latLonToWorld(node.latitude, node.longitude);
          if (Math.hypot(worldX - pos.x, worldY - pos.y) < 22 / currentScale) {
            onSelectPathfinderSpot?.({ type: 'lora', data: node });
            return;
          }
        }
      }
    }
    
    // Clear popup if click miss
    setSelectedPoiPopup(null);
    setSelectedClusterPopup(null);
  };

  const [selectedPoiPopup, setSelectedPoiPopup] = useState<{ poi: any, x: number, y: number } | null>(null);
  const [isEditingPoi, setIsEditingPoi] = useState(false);
  const [editPoiData, setEditPoiData] = useState<{name: string, category: string, description: string}>({ name: '', category: 'Tools', description: '' });

  // Non-passive native touch listener to prevent iOS Safari gesture bounce / page-zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onNativeTouchMove = (e: TouchEvent) => {
      // Prevent browser-level bounce and pinch zoom on multi-touch
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener('touchmove', onNativeTouchMove);
    };
  }, []);

  // Touch Gesture Listeners (Focal-Point Pinch-Zoom, Rotation & Kinetic Drag)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      stopKineticPan();
      const t = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        initialOffsetX: transformRef.current.offsetX,
        initialOffsetY: transformRef.current.offsetY,
      };
      velocityHistoryRef.current = [{ x: t.clientX, y: t.clientY, time: performance.now() }];
      startLongPressTimer(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      cancelLongPressTimer();
      stopKineticPan();
      setIsDragging(false);
      dragStartRef.current = null;
      velocityHistoryRef.current = [];

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      const focalScreenX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const focalScreenY = (t1.clientY + t2.clientY) / 2 - rect.top;

      // Invariant world coordinate under center of the two fingers
      const current = transformRef.current;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const dx = focalScreenX - (cx + current.offsetX);
      const dy = focalScreenY - (cy + current.offsetY);

      const unscaledX = dx / current.scale;
      const unscaledY = dy / current.scale;

      const cosRot = Math.cos(-current.rotation);
      const sinRot = Math.sin(-current.rotation);

      const focalWorldX = unscaledX * cosRot - unscaledY * sinRot;
      const focalWorldY = unscaledX * sinRot + unscaledY * cosRot;

      touchStartRef.current = {
        dist,
        angle,
        initialScale: current.scale,
        initialRotation: current.rotation,
        initialOffsetX: current.offsetX,
        initialOffsetY: current.offsetY,
        focalWorldX,
        focalWorldY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.touches.length === 1 && isDragging && dragStartRef.current) {
      const t = e.touches[0];
      const now = performance.now();
      const dx = t.clientX - dragStartRef.current.x;
      const dy = t.clientY - dragStartRef.current.y;

      if (Math.hypot(dx, dy) > 5) {
        cancelLongPressTimer();
      }

      velocityHistoryRef.current.push({ x: t.clientX, y: t.clientY, time: now });
      if (velocityHistoryRef.current.length > 8) {
        velocityHistoryRef.current.shift();
      }
      velocityHistoryRef.current = velocityHistoryRef.current.filter((p) => now - p.time <= 90);

      updateTransform((prev) => ({
        ...prev,
        offsetX: dragStartRef.current!.initialOffsetX + dx,
        offsetY: dragStartRef.current!.initialOffsetY + dy,
      }), false);
    } else if (e.touches.length === 2 && touchStartRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const newAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

      const currentFocalScreenX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const currentFocalScreenY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const scaleChange = newDist / touchStartRef.current.dist;
      const angleChange = newAngle - touchStartRef.current.angle;

      const newScale = Math.min(5.0, Math.max(0.4, touchStartRef.current.initialScale * scaleChange));
      const newRotation = touchStartRef.current.initialRotation + angleChange;

      // Focal-point zoom algorithm:
      // Mathematically anchors the initial geographic coordinate (focalWorldX, focalWorldY)
      // to the current touch center (currentFocalScreenX, currentFocalScreenY)
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const wx = touchStartRef.current.focalWorldX;
      const wy = touchStartRef.current.focalWorldY;

      const cosNewRot = Math.cos(newRotation);
      const sinNewRot = Math.sin(newRotation);

      const rotWorldX = (wx * cosNewRot - wy * sinNewRot) * newScale;
      const rotWorldY = (wx * sinNewRot + wy * cosNewRot) * newScale;

      const newOffsetX = currentFocalScreenX - cx - rotWorldX;
      const newOffsetY = currentFocalScreenY - cy - rotWorldY;

      // Active focal reticle visual indicator tracking
      activeFocalPointRef.current = {
        screenX: currentFocalScreenX,
        screenY: currentFocalScreenY,
        worldX: wx,
        worldY: wy,
        scale: newScale,
        timestamp: performance.now(),
      };

      updateTransform(() => ({
        scale: newScale,
        rotation: newRotation,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }), false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    cancelLongPressTimer();
    e.stopPropagation();
    if (e.touches.length === 0) {
      const now = performance.now();
      const changedTouch = e.changedTouches[0];
      if (changedTouch && dragStartRef.current) {
        const dragDist = Math.hypot(
          changedTouch.clientX - dragStartRef.current.x,
          changedTouch.clientY - dragStartRef.current.y
        );
        // Only evaluate double-tap if finger didn't drag extensively
        if (dragDist < 12) {
          const lastTap = lastTouchTapRef.current;
          if (lastTap && now - lastTap.time < 340) {
            const tapDist = Math.hypot(changedTouch.clientX - lastTap.x, changedTouch.clientY - lastTap.y);
            if (tapDist < 40) {
              // Double tap detected! Focal-point zoom in by 1.4x
              stopKineticPan();
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const cursorScreenX = changedTouch.clientX - rect.left;
                const cursorScreenY = changedTouch.clientY - rect.top;
                const current = transformRef.current;
                const targetScale = Math.min(5.0, current.scale * 1.4);

                const newTrans = calculateFocalPointZoom(
                  current,
                  cursorScreenX,
                  cursorScreenY,
                  rect.width,
                  rect.height,
                  targetScale
                );

                const { worldX, worldY } = getWorldCoords(cursorScreenX, cursorScreenY, rect.width, rect.height);
                activeFocalPointRef.current = {
                  screenX: cursorScreenX,
                  screenY: cursorScreenY,
                  worldX,
                  worldY,
                  scale: targetScale,
                  timestamp: performance.now(),
                };

                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try {
                    navigator.vibrate(12);
                  } catch {}
                }

                updateTransform(() => newTrans, false);
                lastTouchTapRef.current = null;
              }
            } else {
              lastTouchTapRef.current = { time: now, x: changedTouch.clientX, y: changedTouch.clientY };
            }
          } else {
            lastTouchTapRef.current = { time: now, x: changedTouch.clientX, y: changedTouch.clientY };
          }
        }
      }

      setIsDragging(false);
      dragStartRef.current = null;
      touchStartRef.current = null;
      checkKineticRelease();
    } else if (e.touches.length === 1) {
      // Transition from 2 fingers to 1 finger seamlessly without jumping
      const t = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        initialOffsetX: transformRef.current.offsetX,
        initialOffsetY: transformRef.current.offsetY,
      };
      touchStartRef.current = null;
      velocityHistoryRef.current = [{ x: t.clientX, y: t.clientY, time: performance.now() }];
    }
  };

  // Synchronize MapLibre viewport changes and handle interactions on the MapLibre map directly
  useEffect(() => {
    if (!isOverlay || !mapInstance) return;

    const handleMapMove = () => {
      setMapMoveCount((prev) => prev + 1);
    };

    const handleMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;
      const { x: worldX, y: worldY } = geoPointToLocalGrid(lat, lng, cityData.centerCoordsText);
      const pos = mapInstance.project([lng, lat]);
      const mouseScreenX = pos.x;
      const mouseScreenY = pos.y;
      // Map scale to match standard scale math
      const currentScale = Math.pow(2, mapInstance.getZoom() - 13);

      if (isRulerMode && onRulerClick) {
        onRulerClick({ x: worldX, y: worldY });
        return;
      }
      
      if (isRouteMode && onMapRouteClick) {
        onMapRouteClick({ x: worldX, y: worldY });
        return;
      }

      if (isPlacingPerimeterMarker) {
        if (isNearFirstPerimeterPoint && onClosePerimeter && perimeterPoints.length >= 3) {
          onClosePerimeter();
          setIsNearFirstPerimeterPoint(false);
          setCursorWorldPos(null);
          return;
        }
        if (onAddPerimeterPoint) {
          onAddPerimeterPoint([Math.round(worldX), Math.round(worldY)]);
          return;
        }
      }

      const { peerClusters, resourceClusters } = calculateWorldPositions();

      // Check click on resource clusters or single pins
      for (const cluster of resourceClusters) {
        const radius = cluster.isCluster ? 20 / currentScale : 18 / currentScale;
        const distTip = Math.hypot(worldX - cluster.x, worldY - cluster.y);
        const distHead = Math.hypot(worldX - cluster.x, worldY - (cluster.y - 18 / currentScale));

        if (distTip < radius || (!cluster.isCluster && distHead < radius)) {
          if (cluster.isCluster) {
            setSelectedPoiPopup?.(null);
            setSelectedPeerClusterPopup?.(null);
            setSelectedClusterPopup?.({
              cluster,
              x: mouseScreenX,
              y: mouseScreenY,
            });
            return;
          } else if (cluster.singleResource) {
            setSelectedClusterPopup?.(null);
            setSelectedPeerClusterPopup?.(null);
            onSelectResource?.(cluster.singleResource);
            return;
          }
        }
      }

      // Check click on peers or peer clusters
      for (const cluster of peerClusters) {
        const radius = cluster.isCluster ? 22 / currentScale : 20 / currentScale;
        if (Math.hypot(worldX - cluster.x, worldY - cluster.y) < radius) {
          if (cluster.isCluster) {
            setSelectedPoiPopup?.(null);
            setSelectedClusterPopup?.(null);
            setSelectedPeerClusterPopup?.({
              cluster,
              x: mouseScreenX,
              y: mouseScreenY,
            });
            return;
          } else if (cluster.singlePeer) {
            setSelectedPeerClusterPopup?.(null);
            onSelectNode?.(cluster.singlePeer);
            return;
          }
        }
      }

      // Check click on Survival POIs
      if (cityData.survivalPois) {
        for (const poi of cityData.survivalPois) {
          if (visiblePoiCategories && !visiblePoiCategories.has(poi.category)) continue;

          if (Math.hypot(worldX - poi.x, worldY - poi.y) < 20 / currentScale) {
            setSelectedPoiPopup?.({ poi, x: mouseScreenX, y: mouseScreenY });
            return;
          }
        }
      }
    };

    const handleMapMouseMove = (e: any) => {
      const { lng, lat } = e.lngLat;
      const { x: worldX, y: worldY } = geoPointToLocalGrid(lat, lng, cityData.centerCoordsText);
      const currentScale = Math.pow(2, mapInstance.getZoom() - 13);
      
      const { userWorldPos, peerClusters, resourceClusters } = calculateWorldPositions();
      
      if (Math.hypot(worldX - userWorldPos.x, worldY - userWorldPos.y) < 20 / currentScale) {
        setHoveredEntity({
          type: 'user',
          id: 'user_node',
          title: `${userCallsign} (Kohalik Sõlm)`,
          subtitle: `Sümbioosi skoor: ${userSymbiosisScore} Pts`,
          worldX: userWorldPos.x,
          worldY: userWorldPos.y,
        });
        return;
      }

      for (const cluster of peerClusters) {
        const radius = cluster.isCluster ? 20 / currentScale : 18 / currentScale;
        if (Math.hypot(worldX - cluster.x, worldY - cluster.y) < radius) {
          if (cluster.isCluster) {
            setHoveredEntity({
              type: 'peerCluster',
              id: cluster.id,
              title: `📶 Sõlmede kobar (${cluster.count} sõlme)`,
              subtitle: `${cluster.directCount} otsest • ${cluster.relayedCount} vahendatud`,
              worldX: cluster.x,
              worldY: cluster.y,
            });
          } else if (cluster.singlePeer) {
            setHoveredEntity({
              type: 'peer',
              id: cluster.singlePeer.id,
              title: cluster.singlePeer.callsign,
              subtitle: `${cluster.singlePeer.role || 'Kasutaja'} • RSSI: ${cluster.singlePeer.lastRssi} dBm`,
              worldX: cluster.x,
              worldY: cluster.y,
            });
          }
          return;
        }
      }

      for (const cluster of resourceClusters) {
        const radius = cluster.isCluster ? 20 / currentScale : 18 / currentScale;
        if (Math.hypot(worldX - cluster.x, worldY - cluster.y) < radius) {
          if (cluster.isCluster) {
            setHoveredEntity({
              type: 'resourceCluster',
              id: cluster.id,
              title: `🎒 Ressursside kobar (${cluster.count} eset)`,
              subtitle: 'Klõpsa loendi nägemiseks',
              worldX: cluster.x,
              worldY: cluster.y,
            });
          } else if (cluster.singleResource) {
            setHoveredEntity({
              type: 'resource',
              id: cluster.singleResource.id,
              title: cluster.singleResource.title,
              subtitle: `${cluster.singleResource.category} • ${cluster.singleResource.availabilityText}`,
              worldX: cluster.x,
              worldY: cluster.y,
            });
          }
          return;
        }
      }

      if (cityData.survivalPois) {
        for (const poi of cityData.survivalPois) {
          if (visiblePoiCategories && !visiblePoiCategories.has(poi.category)) continue;

          if (Math.hypot(worldX - poi.x, worldY - poi.y) < 20 / currentScale) {
            setHoveredEntity({
              type: 'survivalPoi',
              id: poi.id,
              title: poi.name,
              subtitle: `${poi.category.toUpperCase()} • ${poi.description || ''}`,
              worldX: poi.x,
              worldY: poi.y,
            });
            return;
          }
        }
      }

      setHoveredEntity(null);
    };

    mapInstance.on('move', handleMapMove);
    mapInstance.on('zoom', handleMapMove);
    mapInstance.on('resize', handleMapMove);
    mapInstance.on('click', handleMapClick);
    mapInstance.on('mousemove', handleMapMouseMove);

    return () => {
      mapInstance.off('move', handleMapMove);
      mapInstance.off('zoom', handleMapMove);
      mapInstance.off('resize', handleMapMove);
      mapInstance.off('click', handleMapClick);
      mapInstance.off('mousemove', handleMapMouseMove);
    };
  }, [
    isOverlay,
    mapInstance,
    cityData,
    peers,
    visibleResources,
    isRulerMode,
    onRulerClick,
    isRouteMode,
    onMapRouteClick,
    isPlacingPerimeterMarker,
    isNearFirstPerimeterPoint,
    onClosePerimeter,
    perimeterPoints,
    onAddPerimeterPoint,
    onSelectResource,
    onSelectNode,
    visiblePoiCategories,
    userCallsign,
    userSymbiosisScore,
    calculateWorldPositions,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-[380px] sm:h-[460px] relative rounded-3xl overflow-hidden select-none ${
        isPlacingPerimeterMarker ? 'cursor-crosshair ring-2 ring-[#2A9D8F]' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredEntity(null);
          setCursorWorldPos(null);
          setIsNearFirstPerimeterPoint(false);
        }}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full block touch-none"
      />

      {/* POI Popup */}
      {selectedPoiPopup && (
        <div
          className="absolute z-30 w-64 bg-white dark:bg-[#182315] border border-[#87A878]/60 rounded-2xl p-3.5 shadow-xl pointer-events-auto flex flex-col gap-2.5 text-xs text-[#203A2A] dark:text-[#F0F5EE]"
          style={{ 
            left: Math.min(selectedPoiPopup.x + 12, (containerRef.current?.clientWidth || 500) - 270), 
            top: Math.min(selectedPoiPopup.y + 12, (containerRef.current?.clientHeight || 400) - 220) 
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-1.5">
            <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] truncate pr-2 flex items-center gap-1.5">
              <span>📍</span>
              <span>{isEditingPoi ? 'Muuda ellujäämispunkti (POI)' : selectedPoiPopup.poi.name}</span>
            </h4>
            <button 
              type="button"
              onClick={() => {
                setSelectedPoiPopup(null);
                setIsEditingPoi(false);
              }}
              className="p-1 rounded-md text-[#637062] hover:text-[#203A2A] dark:text-[#A8BDA5] dark:hover:text-[#F0F5EE] hover:bg-black/5 shrink-0"
              title="Sulge"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {isEditingPoi ? (
            <div className="space-y-2 pt-0.5">
              <div>
                <label className="block text-[10px] font-bold text-[#588157] mb-0.5">Nimi / Pealkiri:</label>
                <input 
                  type="text" 
                  value={editPoiData.name} 
                  onChange={(e) => setEditPoiData({...editPoiData, name: e.target.value})}
                  className="w-full bg-[#FAF6EE] dark:bg-[#203A2A]/70 border border-[#87A878]/40 rounded-lg p-1.5 text-xs text-black dark:text-white outline-none focus:border-[#588157]"
                  placeholder="POI Nimi"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#588157] mb-0.5">Kategooria:</label>
                <select 
                  value={editPoiData.category}
                  onChange={(e) => setEditPoiData({...editPoiData, category: e.target.value})}
                  className="w-full bg-[#FAF6EE] dark:bg-[#203A2A]/70 border border-[#87A878]/40 rounded-lg p-1.5 text-xs text-black dark:text-white outline-none focus:border-[#588157]"
                >
                  <option value="Tools">🔧 Tools / Tööriistad & Seadmed</option>
                  <option value="Bikes">🚲 Bikes / Jalgrattad & Transport</option>
                  <option value="Medical">⛑️ Medical / Esmaabi & Ravimid</option>
                  <option value="Food">🌾 Food / Toit & Puhas vesi</option>
                  <option value="Station">🚉 Station / Sidejaam & Varjupaik</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#588157] mb-0.5">Kirjeldus & Lisainfo:</label>
                <textarea 
                  value={editPoiData.description}
                  onChange={(e) => setEditPoiData({...editPoiData, description: e.target.value})}
                  className="w-full bg-[#FAF6EE] dark:bg-[#203A2A]/70 border border-[#87A878]/40 rounded-lg p-1.5 text-xs text-black dark:text-white outline-none focus:border-[#588157] resize-none"
                  rows={2}
                  placeholder="Kirjelda punkti sisu, ligipääsu ja ressursse..."
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1 border-t border-[#87A878]/20">
                <button 
                  type="button"
                  onClick={() => setIsEditingPoi(false)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#87A878]/40 text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5"
                >
                  Loobu
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (onUpdatePoi) onUpdatePoi(selectedPoiPopup.poi.id, editPoiData);
                    setSelectedPoiPopup({ ...selectedPoiPopup, poi: { ...selectedPoiPopup.poi, ...editPoiData } });
                    setIsEditingPoi(false);
                  }}
                  className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-[#588157] hover:bg-[#436442] text-white shadow-xs"
                >
                  Salvesta
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#588157]/15 text-[#588157] dark:text-[#A8BDA5] uppercase tracking-wider">
                    {selectedPoiPopup.poi.category}
                  </span>
                  <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                    {selectedPoiPopup.poi.x.toFixed(0)}, {selectedPoiPopup.poi.y.toFixed(0)}
                  </span>
                </div>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed mt-1.5">
                  {selectedPoiPopup.poi.description || 'Kirjeldus puudub.'}
                </p>
              </div>

              {/* Teekonna kiirnupud */}
              {(onSetRouteStart || onSetRouteDestination) && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#87A878]/20">
                  {onSetRouteStart && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetRouteStart({
                          x: selectedPoiPopup.poi.x,
                          y: selectedPoiPopup.poi.y,
                          label: selectedPoiPopup.poi.name,
                        });
                        setSelectedPoiPopup(null);
                      }}
                      className="flex-1 py-1 px-1.5 rounded-lg bg-[#2A9D8F]/15 hover:bg-[#2A9D8F]/25 text-[#2A9D8F] dark:text-[#52B788] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Alusta teekonda sellest punktist"
                    >
                      <span>🚩</span>
                      <span>Alusta siit</span>
                    </button>
                  )}
                  {onSetRouteDestination && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetRouteDestination({
                          x: selectedPoiPopup.poi.x,
                          y: selectedPoiPopup.poi.y,
                          label: selectedPoiPopup.poi.name,
                        });
                        setSelectedPoiPopup(null);
                      }}
                      className="flex-1 py-1 px-1.5 rounded-lg bg-[#E76F51]/15 hover:bg-[#E76F51]/25 text-[#E76F51] text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Määra teekonna sihtpunktiks"
                    >
                      <span>🎯</span>
                      <span>Sihtkoht</span>
                    </button>
                  )}
                </div>
              )}
              
              {/* Edit and Delete Actions */}
              <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#87A878]/20">
                <button 
                  type="button"
                  onClick={() => {
                    setEditPoiData({ 
                      name: selectedPoiPopup.poi.name, 
                      category: selectedPoiPopup.poi.category, 
                      description: selectedPoiPopup.poi.description || '' 
                    });
                    setIsEditingPoi(true);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-[11px] font-bold text-[#588157] bg-[#588157]/15 hover:bg-[#588157]/25 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span>Muuda</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (onDeletePoi) onDeletePoi(selectedPoiPopup.poi.id);
                    setSelectedPoiPopup(null);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-[11px] font-bold text-[#E76F51] bg-[#E76F51]/15 hover:bg-[#E76F51]/25 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  <span>Kustuta</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resource Cluster Inspector Popup */}
      {selectedClusterPopup && (
        <div
          className="absolute z-30 w-72 bg-white dark:bg-[#182315] border border-[#87A878]/60 rounded-2xl p-3.5 shadow-2xl pointer-events-auto flex flex-col gap-2.5 text-xs text-[#203A2A] dark:text-[#F0F5EE] animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(
              selectedClusterPopup.x + 14,
              (containerRef.current?.clientWidth || 500) - 300
            ),
            top: Math.min(
              selectedClusterPopup.y + 14,
              (containerRef.current?.clientHeight || 400) - 340
            ),
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2A9D8F] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                {selectedClusterPopup.cluster.count}
              </span>
              <div>
                <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] leading-tight">
                  Ressursikobar (Mesh Hub)
                </h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                  {selectedClusterPopup.cluster.count} ressurssi samas piirkonnas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedClusterPopup(null)}
              className="p-1 rounded-md text-[#637062] hover:text-[#203A2A] dark:text-[#A8BDA5] dark:hover:text-[#F0F5EE] hover:bg-black/5 shrink-0"
              title="Sulge"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Category distribution tags */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {Object.entries(selectedClusterPopup.cluster.categoryCounts).map(([cat, count]) => {
              const color = CATEGORY_COLORS[cat as ResourceCategory] || '#2A9D8F';
              return (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                  style={{
                    backgroundColor: `${color}20`,
                    borderColor: `${color}60`,
                    color: isNightMode ? '#F0F5EE' : color,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{cat}</span>
                  <span className="opacity-80 font-mono font-bold">({count})</span>
                </span>
              );
            })}
          </div>

          {/* Zoom In Action */}
          <button
            type="button"
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const targetScale = Math.min(5.0, transformRef.current.scale * 1.7);
                const newTrans = calculateFocalPointZoom(
                  transformRef.current,
                  selectedClusterPopup.x,
                  selectedClusterPopup.y,
                  rect.width,
                  rect.height,
                  targetScale
                );
                updateTransform(() => newTrans, true);
              }
            }}
            className="w-full py-1.5 px-2 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/50 hover:bg-[#87A878]/20 border border-[#87A878]/30 text-[11px] font-semibold text-[#588157] dark:text-[#A8BDA5] flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span>Suurenda vaadet (Zoom in klastrile)</span>
          </button>

          {/* Scrollable list of individual resources in cluster */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 -mr-1">
            {selectedClusterPopup.cluster.resources.map((res) => {
              const resColor = CATEGORY_COLORS[res.category] || '#2A9D8F';
              return (
                <div
                  key={res.id}
                  onClick={() => {
                    onSelectResource?.(res);
                    setSelectedClusterPopup(null);
                  }}
                  className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/60 hover:bg-[#87A878]/20 border border-[#87A878]/30 cursor-pointer transition-all flex items-start justify-between gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: resColor }}
                      />
                      <span className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] truncate group-hover:text-[#588157]">
                        {res.title}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 truncate">
                      {res.category} • {res.ownerCallsign}
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-[#588157] px-2 py-0.5 rounded-lg bg-white dark:bg-[#182315] border border-[#87A878]/30 shrink-0 group-hover:bg-[#588157] group-hover:text-white transition-colors">
                    Vali
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Peer Mesh Nodes Cluster Inspector Popup */}
      {selectedPeerClusterPopup && (
        <div
          className="absolute z-30 w-72 bg-white dark:bg-[#182315] border border-[#588157]/60 rounded-2xl p-3.5 shadow-2xl pointer-events-auto flex flex-col gap-2.5 text-xs text-[#203A2A] dark:text-[#F0F5EE] animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(
              selectedPeerClusterPopup.x + 14,
              (containerRef.current?.clientWidth || 500) - 300
            ),
            top: Math.min(
              selectedPeerClusterPopup.y + 14,
              (containerRef.current?.clientHeight || 400) - 340
            ),
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#588157] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                {selectedPeerClusterPopup.cluster.count}
              </span>
              <div>
                <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] leading-tight">
                  Mesh-sõlmede kobar
                </h4>
                <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                  {selectedPeerClusterPopup.cluster.count} raadiosõlme lähestikku
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPeerClusterPopup(null)}
              className="p-1 rounded-md text-[#637062] hover:text-[#203A2A] dark:text-[#A8BDA5] dark:hover:text-[#F0F5EE] hover:bg-black/5 shrink-0"
              title="Sulge"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Peer connection stats tags */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {selectedPeerClusterPopup.cluster.directCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#588157]/40 bg-[#588157]/15 text-[#588157] dark:text-[#A8BDA5] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#588157]" />
                <span>Otsesed: {selectedPeerClusterPopup.cluster.directCount}</span>
              </span>
            )}
            {selectedPeerClusterPopup.cluster.relayedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#F4A261]/40 bg-[#F4A261]/15 text-[#E76F51] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4A261]" />
                <span>Vahendatud: {selectedPeerClusterPopup.cluster.relayedCount}</span>
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border border-black/10 dark:border-white/10 text-[#637062] dark:text-[#A8BDA5]">
              Keskm. {selectedPeerClusterPopup.cluster.avgRssi} dBm
            </span>
          </div>

          {/* Zoom In Action */}
          <button
            type="button"
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const targetScale = Math.min(5.0, transformRef.current.scale * 1.8);
                const newTrans = calculateFocalPointZoom(
                  transformRef.current,
                  selectedPeerClusterPopup.x,
                  selectedPeerClusterPopup.y,
                  rect.width,
                  rect.height,
                  targetScale
                );
                updateTransform(() => newTrans, true);
              }
            }}
            className="w-full py-1.5 px-2 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/50 hover:bg-[#87A878]/20 border border-[#87A878]/30 text-[11px] font-semibold text-[#588157] dark:text-[#A8BDA5] flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span>Suurenda vaadet (Zoom in klastrile)</span>
          </button>

          {/* Scrollable list of individual peers in cluster */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 -mr-1">
            {selectedPeerClusterPopup.cluster.peers.map((peer) => (
              <div
                key={peer.id}
                onClick={() => {
                  onSelectNode?.(peer);
                  setSelectedPeerClusterPopup(null);
                }}
                className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#203A2A]/60 hover:bg-[#87A878]/20 border border-[#87A878]/30 cursor-pointer transition-all flex items-start justify-between gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        peer.isDirect ? 'bg-[#588157]' : 'bg-[#F4A261]'
                      }`}
                    />
                    <span className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] truncate group-hover:text-[#588157]">
                      {peer.callsign}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5 truncate font-mono">
                    {peer.connectionState.toUpperCase()} • {peer.lastRssi} dBm
                  </div>
                </div>

                <span className="text-[10px] font-semibold text-[#588157] px-2 py-0.5 rounded-lg bg-white dark:bg-[#182315] border border-[#87A878]/30 shrink-0 group-hover:bg-[#588157] group-hover:text-white transition-colors">
                  Vali
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

BioregionalMapCanvas.displayName = 'BioregionalMapCanvas';

export const OfflineMapCanvas = BioregionalMapCanvas;
export default BioregionalMapCanvas;
