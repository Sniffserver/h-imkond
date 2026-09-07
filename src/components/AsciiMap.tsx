import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MeshNode,
  ResourceItem,
  CityMapData,
  SOSPacket,
} from '../types';
import { CITY_MAPS } from '../data/cityMaps';
import { useMeshStore, selectPeersArray } from '../store/meshStore';
import { getActiveSosAlerts } from '../services/sosService';
import { deadReckoningService, DeadReckoningState } from '../services/deadReckoning';
import {
  AsciiGridCell,
  unicodeToAscii,
  exportAsciiToTxt,
  exportToTxt,
  exportToAnsi,
  renderForSerial,
} from '../utils/asciiExport';
import { AsciiMapSettings, AsciiTheme } from './AsciiMapSettings';
import './AsciiMap.css';
import {
  ZoomIn,
  ZoomOut,
  LocateFixed,
  Terminal as TerminalIcon,
  Settings as SettingsIcon,
  Download,
  Cpu,
} from 'lucide-react';

interface AsciiMapProps {
  cityId?: string;
  peers?: MeshNode[];
  resources?: ResourceItem[];
  userCallsign?: string;
  gpsPosition?: { x: number; y: number } | null;
  simulatedUserPos?: { x: number; y: number };
  isNightMode?: boolean;
  onSelectPeer?: (peer: MeshNode) => void;
  onSelectResource?: (resource: ResourceItem) => void;
  columns?: number;
  rows?: number;
}

interface SparseCell {
  char: string;
  timestamp: number;
}

type SparseMap = Record<string, SparseCell>;

const STORAGE_KEY = 'hoimu_ascii_sparse_map';
const SETTINGS_STORAGE_KEY = 'hoimu_ascii_settings';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface PersistedAsciiSettings {
  theme?: AsciiTheme;
  columns?: number;
  rows?: number;
  gridScale?: number;
  glyphSet?: 'unicode' | 'ascii';
}

export const AsciiMap: React.FC<AsciiMapProps> = ({
  cityId = 'tartu',
  peers = [],
  resources = [],
  userCallsign = 'USER-NODE',
  gpsPosition,
  simulatedUserPos,
  isNightMode = false,
  onSelectPeer,
  onSelectResource,
  columns: initialCols = 80,
  rows: initialRows = 40,
}) => {
  // Load persisted settings from localStorage (hoimu_ascii_settings)
  const [theme, setTheme] = useState<AsciiTheme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed: PersistedAsciiSettings = JSON.parse(raw);
          if (parsed.theme) return parsed.theme;
        }
      } catch {}
    }
    return 'phosphor';
  });

  const [columns, setColumns] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed: PersistedAsciiSettings = JSON.parse(raw);
          if (typeof parsed.columns === 'number') return parsed.columns;
        }
      } catch {}
    }
    return initialCols;
  });

  const [rows, setRows] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed: PersistedAsciiSettings = JSON.parse(raw);
          if (typeof parsed.rows === 'number') return parsed.rows;
        }
      } catch {}
    }
    return initialRows;
  });

  const [gridScale, setGridScale] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed: PersistedAsciiSettings = JSON.parse(raw);
          if (typeof parsed.gridScale === 'number') return parsed.gridScale;
        }
      } catch {}
    }
    return 10;
  });

  const [glyphSet, setGlyphSet] = useState<'unicode' | 'ascii'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed: PersistedAsciiSettings = JSON.parse(raw);
          if (parsed.glyphSet) return parsed.glyphSet;
        }
      } catch {}
    }
    return 'unicode';
  });

  const [revealRadius, setRevealRadius] = useState<number>(6); // 6 cells radius
  const [autoCenter, setAutoCenter] = useState<boolean>(true);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist settings changes to localStorage (hoimu_ascii_settings)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const settings: PersistedAsciiSettings = {
          theme,
          columns,
          rows,
          gridScale,
          glyphSet,
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }
  }, [theme, columns, rows, gridScale, glyphSet]);

  const [deadReckoningState, setDeadReckoningState] = useState<DeadReckoningState>(() => deadReckoningService.getState());

  useEffect(() => {
    const unsubscribe = deadReckoningService.addListener((st) => {
      setDeadReckoningState(st);
    });
    return unsubscribe;
  }, []);

  // Subscribe to Mesh Store
  const storeGps = useMeshStore((state) => state.gpsPosition);
  const setStoreGps = useMeshStore((state) => state.setGpsPosition);
  const storePeers = useMeshStore(selectPeersArray);
  const activePeers = peers && peers.length > 0 ? peers : storePeers;

  // Persistent Sparse Map in localStorage
  const [sparseMap, setSparseMap] = useState<SparseMap>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // Fallback
      }
    }
    return {};
  });

  const cityData: CityMapData = CITY_MAPS[cityId] || CITY_MAPS.tartu;

  // Compute effective user world position
  const userPos = useMemo(() => {
    if (simulatedUserPos) return { x: simulatedUserPos.x, y: simulatedUserPos.y };
    if (gpsPosition) return { x: gpsPosition.x, y: gpsPosition.y };
    if (storeGps) {
      const latDiffKm = (storeGps.lat - (cityData.centerCoords?.[0] || 58.3780)) * 110.574;
      const lngDiffKm = (storeGps.lng - (cityData.centerCoords?.[1] || 26.7290)) * (111.32 * Math.cos(((cityData.centerCoords?.[0] || 58.3780) * Math.PI) / 180));
      return { x: Math.round(lngDiffKm * 1000), y: Math.round(-latDiffKm * 1000) };
    }
    return { x: 0, y: 0 };
  }, [simulatedUserPos, gpsPosition, storeGps, cityData]);

  // Map world meters coordinate to ASCII grid cell index
  const worldToGrid = useCallback(
    (wx: number, wy: number) => {
      const gx = Math.round(wx / gridScale);
      const gy = Math.round(wy / gridScale);
      return { gx, gy };
    },
    [gridScale]
  );

  const userGrid = useMemo(
    () => worldToGrid(userPos.x, userPos.y),
    [userPos.x, userPos.y, worldToGrid]
  );

  // Center of the grid canvas
  const centerCol = Math.floor(columns / 2);
  const centerRow = Math.floor(rows / 2);

  // Camera center position in grid units
  const cameraGrid = useMemo(() => {
    if (autoCenter) {
      return { gx: userGrid.gx, gy: userGrid.gy };
    }
    return { gx: userGrid.gx + panOffset.x, gy: userGrid.gy + panOffset.y };
  }, [autoCenter, userGrid.gx, userGrid.gy, panOffset.x, panOffset.y]);

  // Save sparse map to localStorage whenever updated
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(sparseMap).length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sparseMap));
      } catch {
        // Fallback
      }
    }
  }, [sparseMap]);

  // Raycasting Line Visibility algorithm
  const computeVisibilityAndReveal = useCallback(() => {
    const visibleCells = new Set<string>();
    const newRevealedMap: SparseMap = {};
    const now = Date.now();

    const centerGx = userGrid.gx;
    const centerGy = userGrid.gy;

    const raycastLine = (x0: number, y0: number, x1: number, y1: number) => {
      let x = x0;
      let y = y0;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        const key = `${x},${y}`;
        visibleCells.add(key);

        const isExactUserPosition = x === centerGx && y === centerGy;
        newRevealedMap[key] = {
          char: isExactUserPosition ? '.' : '·',
          timestamp: now,
        };

        if (x === x1 && y === y1) break;

        const distSq = (x - x0) * (x - x0) + (y - y0) * (y - y0);
        if (distSq > revealRadius * revealRadius) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
    };

    for (let dx = -revealRadius; dx <= revealRadius; dx++) {
      for (let dy = -revealRadius; dy <= revealRadius; dy++) {
        if (Math.abs(dx) === revealRadius || Math.abs(dy) === revealRadius) {
          raycastLine(centerGx, centerGy, centerGx + dx, centerGy + dy);
        }
      }
    }

    setSparseMap((prev) => {
      let updated = false;
      const next = { ...prev };

      // Ensure exact user position is stamped with '.'
      const userKey = `${centerGx},${centerGy}`;
      if (!next[userKey] || next[userKey].char !== '.') {
        next[userKey] = { char: '.', timestamp: now };
        updated = true;
      }

      Object.entries(newRevealedMap).forEach(([k, v]) => {
        if (!next[k]) {
          next[k] = v;
          updated = true;
        } else if (v.char === '.' && next[k].char !== '.') {
          next[k] = v;
          updated = true;
        }
      });
      return updated ? next : prev;
    });

    return visibleCells;
  }, [userGrid.gx, userGrid.gy, revealRadius]);

  const currentlyVisible = useMemo(() => {
    return computeVisibilityAndReveal();
  }, [computeVisibilityAndReveal]);

  // Static terrain character lookup
  const getCellStaticTerrainChar = useCallback(
    (gx: number, gy: number): string => {
      const wx = gx * gridScale;
      const wy = gy * gridScale;

      if (cityData.zones) {
        for (const z of cityData.zones) {
          if (z.type === 'water') {
            let inside = false;
            const pts = z.points;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i][0];
              const yi = pts[i][1];
              const xj = pts[j][0];
              const yj = pts[j][1];
              const intersect =
                yi > wy !== yj > wy && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
            }
            if (inside) return '~';
          }

          if (z.type === 'park') {
            let inside = false;
            const pts = z.points;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i][0];
              const yi = pts[i][1];
              const xj = pts[j][0];
              const yj = pts[j][1];
              const intersect =
                yi > wy !== yj > wy && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
            }
            if (inside) return '♣';
          }
        }
      }

      if (cityData.landmarks) {
        for (const lm of cityData.landmarks) {
          if (Math.hypot(lm.x - wx, lm.y - wy) < 25) {
            return lm.type === 'water' ? '═' : '□';
          }
        }
      }

      const hillDist = Math.hypot(wx + 50, wy + 50);
      if (hillDist < 35) return '▲';

      return '·';
    },
    [cityData, gridScale]
  );

  const sosAlerts = useMemo(() => getActiveSosAlerts(), []);

  // Dev Test GPS Jitter Function
  const handleJitterGps = useCallback(() => {
    const deltaLat = (Math.random() - 0.5) * 0.0002;
    const deltaLng = (Math.random() - 0.5) * 0.0002;

    const baseLat = storeGps?.lat || cityData.centerCoords?.[0] || 58.3780;
    const baseLng = storeGps?.lng || cityData.centerCoords?.[1] || 26.7290;

    const newLat = baseLat + deltaLat;
    const newLng = baseLng + deltaLng;

    setStoreGps({
      lat: newLat,
      lng: newLng,
      accuracy: 5,
      timestamp: Date.now(),
    });

    deadReckoningService.updateGpsFix(newLat, newLng, 5);
  }, [storeGps, cityData, setStoreGps]);

  // Dev Test Step Movement Function (N, S, E, W)
  const handleStepDirection = useCallback(
    (dir: 'N' | 'S' | 'E' | 'W') => {
      const stepMeters = 15;
      let dLat = 0;
      let dLng = 0;

      if (dir === 'N') dLat = stepMeters / 110574;
      if (dir === 'S') dLat = -stepMeters / 110574;
      if (dir === 'E') dLng = stepMeters / (111320 * Math.cos((58.378 * Math.PI) / 180));
      if (dir === 'W') dLng = -stepMeters / (111320 * Math.cos((58.378 * Math.PI) / 180));

      const baseLat = storeGps?.lat || cityData.centerCoords?.[0] || 58.3780;
      const baseLng = storeGps?.lng || cityData.centerCoords?.[1] || 26.7290;

      const newLat = baseLat + dLat;
      const newLng = baseLng + dLng;

      setStoreGps({
        lat: newLat,
        lng: newLng,
        accuracy: 5,
        timestamp: Date.now(),
      });

      deadReckoningService.updateGpsFix(newLat, newLng, 5);
    },
    [storeGps, cityData, setStoreGps]
  );

  // Clear Fog-of-War Sparse Map
  const handleClearSparseMap = useCallback(() => {
    if (window.confirm('Clear all discovered terminal cells and path history?')) {
      setSparseMap({});
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, []);

  // Calculate off-screen direction arrow if user node is panned out of view
  const getOffScreenDirectionArrow = useCallback(
    (minColGx: number, maxColGx: number, minRowGy: number, maxRowGy: number) => {
      const userGx = userGrid.gx;
      const userGy = userGrid.gy;

      const isOffScreen =
        userGx < minColGx || userGx > maxColGx || userGy < minRowGy || userGy > maxRowGy;

      if (!isOffScreen) return null;

      const cameraGx = cameraGrid.gx;
      const cameraGy = cameraGrid.gy;

      const dx = userGx - cameraGx;
      const dy = userGy - cameraGy;

      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      // Map angle to compass arrow glyph
      if (angleDeg >= -22.5 && angleDeg < 22.5) return '→';
      if (angleDeg >= 22.5 && angleDeg < 67.5) return '↘';
      if (angleDeg >= 67.5 && angleDeg < 112.5) return '↓';
      if (angleDeg >= 112.5 && angleDeg < 157.5) return '↙';
      if (angleDeg >= 157.5 || angleDeg < -157.5) return '←';
      if (angleDeg >= -157.5 && angleDeg < -112.5) return '↖';
      if (angleDeg >= -112.5 && angleDeg < -67.5) return '↑';
      if (angleDeg >= -67.5 && angleDeg < -22.5) return '↗';

      return '↑';
    },
    [userGrid.gx, userGrid.gy, cameraGrid.gx, cameraGrid.gy]
  );

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutoCenter(false);
        setPanOffset((prev) => ({ ...prev, y: prev.y - 2 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutoCenter(false);
        setPanOffset((prev) => ({ ...prev, y: prev.y + 2 }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAutoCenter(false);
        setPanOffset((prev) => ({ ...prev, x: prev.x - 2 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAutoCenter(false);
        setPanOffset((prev) => ({ ...prev, x: prev.x + 2 }));
      } else if (e.key === '+' || e.key === '=') {
        setGridScale((prev) => Math.max(4, prev - 2));
      } else if (e.key === '-' || e.key === '_') {
        setGridScale((prev) => Math.min(25, prev + 2));
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'g' || e.key === 'G') {
        setAutoCenter(true);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 't' || e.key === 'T') {
        const themes: AsciiTheme[] = ['phosphor', 'amber', 'paper', 'night'];
        setTheme((prev) => themes[(themes.indexOf(prev) + 1) % themes.length]);
      } else if (e.key === 's' || e.key === 'S') {
        setIsSettingsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme CSS Class Map
  const themeContainerClass = useMemo(() => {
    switch (theme) {
      case 'amber':
        return 'ascii-theme-amber';
      case 'paper':
        return 'ascii-theme-paper';
      case 'night':
        return 'ascii-theme-night';
      case 'phosphor':
      default:
        return 'ascii-theme-phosphor';
    }
  }, [theme]);

  // Build 2D ASCII Grid Buffer
  const gridBuffer = useMemo(() => {
    const buffer: (AsciiGridCell & { styleClass: string; entity?: any })[][] = [];

    const minColGx = cameraGrid.gx - centerCol;
    const maxColGx = cameraGrid.gx + centerCol - 1;
    const minRowGy = cameraGrid.gy - centerRow;
    const maxRowGy = cameraGrid.gy + centerRow - 1;

    const offScreenArrow = getOffScreenDirectionArrow(minColGx, maxColGx, minRowGy, maxRowGy);

    const peerGridMap = new Map<string, { peer: MeshNode; gx: number; gy: number }>();
    activePeers.forEach((p) => {
      const rad = (p.angle * Math.PI) / 180;
      const dist = p.distanceRatio * 150;
      const wx = Math.cos(rad) * dist;
      const wy = Math.sin(rad) * dist;
      const { gx, gy } = worldToGrid(wx, wy);
      peerGridMap.set(`${gx},${gy}`, { peer: p, gx, gy });
    });

    const resourceGridMap = new Map<string, { resource: ResourceItem; gx: number; gy: number }>();
    resources.forEach((r) => {
      if (r.coordinates) {
        const { gx, gy } = worldToGrid(r.coordinates.x, r.coordinates.y);
        resourceGridMap.set(`${gx},${gy}`, { resource: r, gx, gy });
      }
    });

    const sosGridMap = new Map<string, SOSPacket>();
    sosAlerts.forEach((sos) => {
      const { gx, gy } = worldToGrid((sos.lng - 26.729) * 10000, (sos.lat - 58.378) * 10000);
      sosGridMap.set(`${gx},${gy}`, sos);
    });

    const now = Date.now();

    for (let r = 0; r < rows; r++) {
      const rowArr: (AsciiGridCell & { styleClass: string; entity?: any })[] = [];
      const gy = minRowGy + r;

      for (let c = 0; c < columns; c++) {
        const gx = minColGx + c;
        const key = `${gx},${gy}`;

        const isUserCell = gx === userGrid.gx && gy === userGrid.gy;
        const isVisible = currentlyVisible.has(key);
        const cellData = sparseMap[key];
        const isExplored = Boolean(cellData);

        let rawChar = ' ';
        let type: AsciiGridCell['type'] = 'empty';
        let styleClass = 'dim-cell';
        let title = `Grid (${gx}, ${gy})`;
        let entity: any = undefined;

        if (!isExplored && !isVisible) {
          rawChar = ' ';
          type = 'fog';
          styleClass = 'opacity-0';
        } else {
          const baseChar = getCellStaticTerrainChar(gx, gy);

          // Handle walked path fading after 24h
          let renderedTerrainChar = baseChar;
          if (cellData && cellData.char === '.') {
            const ageMs = now - cellData.timestamp;
            if (ageMs < TWENTY_FOUR_HOURS_MS) {
              renderedTerrainChar = '.'; // Fresh walked path trail
            } else {
              renderedTerrainChar = '·'; // Faded path trail
            }
          }

          rawChar = renderedTerrainChar;
          type = 'terrain';
          styleClass = isVisible ? '' : 'dim-cell opacity-40';

          if (sosGridMap.has(key) && isVisible) {
            rawChar = '!';
            type = 'sos';
            styleClass = 'sos-cell';
            title = `🚨 SOS ALERT: ${sosGridMap.get(key)?.from}`;
          } else if (isUserCell) {
            const isLowConfidence = deadReckoningState.isActive && deadReckoningState.confidencePercent < 50;
            rawChar = isLowConfidence ? '?' : '@';
            type = 'user';
            styleClass = isLowConfidence ? 'user-cell text-[#E76F51] animate-pulse' : 'user-cell';
            title = `User Node: ${userCallsign} (${rawChar}) ${
              deadReckoningState.isActive ? `[Dead Reckoning: ${deadReckoningState.confidencePercent}% confidence, ±${deadReckoningState.driftEstimateMeters.toFixed(1)}m drift]` : ''
            }`;
          } else if (peerGridMap.has(key) && isVisible) {
            const pInfo = peerGridMap.get(key)!;
            rawChar = '☉';
            type = 'peer';
            styleClass = 'peer-cell';
            title = `Peer: ${pInfo.peer.callsign} (Trust: ${pInfo.peer.trustScore || 100}%)`;
            entity = pInfo.peer;
          } else if (resourceGridMap.has(key) && isVisible) {
            const rInfo = resourceGridMap.get(key)!;
            const catGlyphs: Record<string, string> = {
              Energy: '⚡',
              Tools: 'T',
              Food: 'F',
              Skills: 'S',
              'Care & Housing': 'C',
              Care: 'C',
              Bio: 'B',
              Bioregional: 'B',
            };
            rawChar = catGlyphs[rInfo.resource.category] || 'R';
            type = 'resource';
            styleClass = 'resource-cell';
            title = `Resource: ${rInfo.resource.title} (${rInfo.resource.category})`;
            entity = rInfo.resource;
          }
        }

        // Render off-screen arrow if user is panned out of view
        if (offScreenArrow && !isUserCell) {
          const isCenterBorderCell =
            (r === 0 && c === centerCol) ||
            (r === rows - 1 && c === centerCol) ||
            (c === 0 && r === centerRow) ||
            (c === columns - 1 && r === centerRow);

          if (isCenterBorderCell) {
            rawChar = offScreenArrow;
            styleClass = 'user-cell font-bold text-[#E9C46A] animate-pulse';
            title = `User Node (@) is off-screen in direction ${offScreenArrow}. Press 'C' or click 'Follow @' to center.`;
          }
        }

        const char = glyphSet === 'ascii' ? unicodeToAscii(rawChar) : rawChar;

        rowArr.push({ char, type, styleClass, title, entity });
      }

      buffer.push(rowArr);
    }

    return buffer;
  }, [
    cameraGrid.gx,
    cameraGrid.gy,
    centerCol,
    centerRow,
    rows,
    columns,
    activePeers,
    resources,
    sosAlerts,
    userGrid.gx,
    userGrid.gy,
    userCallsign,
    currentlyVisible,
    sparseMap,
    glyphSet,
    deadReckoningState,
    worldToGrid,
    getCellStaticTerrainChar,
    getOffScreenDirectionArrow,
  ]);

  // Keyboard Shortcuts: 'T' cycles theme, 'E' exports current view to clipboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTheme((prev) => {
          const themes: AsciiTheme[] = ['phosphor', 'amber', 'paper', 'night'];
          const nextIdx = (themes.indexOf(prev) + 1) % themes.length;
          const nextTheme = themes[nextIdx];
          setToastMessage(`Theme switched to ${nextTheme.toUpperCase()} (Hotkey T)`);
          setTimeout(() => setToastMessage(null), 2000);
          return nextTheme;
        });
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const exportText = exportAsciiToTxt(gridBuffer, glyphSet === 'ascii');
        navigator.clipboard.writeText(exportText);
        setToastMessage('ASCII Map copied to Clipboard! (Hotkey E)');
        setTimeout(() => setToastMessage(null), 2500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridBuffer, glyphSet]);

  return (
    <div className={`ascii-map-container relative rounded-3xl border ${themeContainerClass} p-4 flex flex-col gap-3 shadow-xl select-none transition-colors duration-200`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-40 bg-[#33ff00] text-black font-mono font-black text-xs px-3 py-1.5 rounded-lg shadow-xl border border-black animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Dead Reckoning Banner in Terminal Mode */}
      {deadReckoningState.isActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-[#E9C46A]/40 bg-[#1A180E] text-[#E9C46A] text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E76F51] animate-ping" />
            <span className="font-bold uppercase tracking-wider">
              ⚠️ Dead Reckoning Active ({deadReckoningState.reason === 'low_accuracy' ? 'Low GPS Accuracy' : 'GPS Signal Lost'})
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>Confidence: <strong className={deadReckoningState.confidencePercent < 50 ? 'text-[#E76F51]' : 'text-[#E9C46A]'}>{deadReckoningState.confidencePercent}% ({deadReckoningState.confidencePercent < 50 ? '?' : '@'})</strong></span>
            <span>Est. Drift: <strong>±{deadReckoningState.driftEstimateMeters.toFixed(1)}m</strong></span>
            <span>Steps: <strong>{deadReckoningState.stepCount}</strong></span>
            <button
              type="button"
              onClick={() => deadReckoningService.manualResetPosition(deadReckoningState.currentLat, deadReckoningState.currentLng)}
              className="px-2 py-0.5 rounded bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 text-[#E9C46A] border border-[#E9C46A]/50 text-[10px] font-bold cursor-pointer transition-all"
            >
              📍 Reset ("I am here")
            </button>
          </div>
        </div>
      )}
      {/* Top Controls & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b pb-2.5 border-current/20">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <span className="font-bold uppercase tracking-wider">
            HÕIMU TERMINAL MAP • {cityData.cityName}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded border border-current/30">
            Scale: {gridScale}m/cell ({columns}x{rows})
          </span>
        </div>

        {/* Theme Selectors & Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-bold opacity-75 mr-1">Theme:</span>
          {(['phosphor', 'amber', 'paper', 'night'] as AsciiTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded border transition-all cursor-pointer ${
                theme === t
                  ? 'bg-current text-black font-black shadow-xs'
                  : 'border-current/30 opacity-70 hover:opacity-100'
              }`}
            >
              {t}
            </button>
          ))}

          <div className="h-4 w-px bg-current/20 mx-1" />

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 rounded border border-current/30 hover:bg-current/10 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
            title="Terminal Settings & Hardware Output (S)"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {/* Auto Center Toggle */}
          <button
            type="button"
            onClick={() => {
              setAutoCenter(true);
              setPanOffset({ x: 0, y: 0 });
            }}
            className={`px-2 py-1 rounded border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
              autoCenter ? 'bg-current/20 font-black' : 'border-current/30 opacity-70 hover:opacity-100'
            }`}
            title="Center camera on user position (@)"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Follow @</span>
          </button>

          {/* Zoom In/Out */}
          <button
            type="button"
            onClick={() => setGridScale((prev) => Math.max(4, prev - 2))}
            className="p-1 rounded border border-current/30 hover:bg-current/10 cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setGridScale((prev) => Math.min(25, prev + 2))}
            className="p-1 rounded border border-current/30 hover:bg-current/10 cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main ASCII Monospace Render Container */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto bg-black/40 rounded-2xl p-3 border border-current/10 font-mono text-[13px] leading-none tracking-widest whitespace-pre select-none cursor-crosshair min-h-[420px] flex flex-col justify-center items-center"
      >
        <pre className="inline-block leading-tight font-mono">
          {gridBuffer.map((row, rIdx) => (
            <div key={rIdx} className="flex">
              {row.map((cell, cIdx) => (
                <span
                  key={cIdx}
                  className={`inline-block w-[1.1em] text-center ${cell.styleClass} hover:bg-white/20 rounded-xs transition-colors`}
                  title={cell.title}
                  onMouseEnter={() => setHoverInfo(cell.title)}
                  onClick={() => {
                    if (cell.entity) {
                      if ('callsign' in cell.entity && onSelectPeer) {
                        onSelectPeer(cell.entity as MeshNode);
                      } else if ('title' in cell.entity && onSelectResource) {
                        onSelectResource(cell.entity as ResourceItem);
                      }
                    }
                  }}
                >
                  {cell.char}
                </span>
              ))}
            </div>
          ))}
        </pre>
      </div>

      {/* Bottom Status & Key Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-current/20 opacity-90">
        <div className="flex items-center gap-3 font-mono">
          <span className="font-bold">LEGEND:</span>
          <span><strong className="px-1 rounded bg-current/30">@</strong> User</span>
          <span><strong className="peer-cell">☉</strong> Peer</span>
          <span><strong className="resource-cell">F/⚡/T</strong> Resource</span>
          <span><strong>~</strong> Water</span>
          <span><strong>♣</strong> Forest</span>
          <span><strong>□</strong> Building</span>
          <span><strong>▲</strong> Hill</span>
          <span><strong>·</strong> Explored</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span>Explored Cells: <strong>{Object.keys(sparseMap).length}</strong></span>
          <span>•</span>
          <span className="truncate max-w-xs">{hoverInfo || 'Hover over cells for coordinates'}</span>
          <span>•</span>
          <span className="opacity-70">Hotkeys: Arrows (Pan), +/- (Zoom), C (Center), S (Settings)</span>
        </div>
      </div>

      {/* Settings Modal */}
      <AsciiMapSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        columns={columns}
        onColumnsChange={setColumns}
        rows={rows}
        onRowsChange={setRows}
        gridScale={gridScale}
        onGridScaleChange={setGridScale}
        glyphSet={glyphSet}
        onGlyphSetChange={setGlyphSet}
        gridBuffer={gridBuffer}
      />
    </div>
  );
};
