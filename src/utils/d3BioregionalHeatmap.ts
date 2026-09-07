import * as d3 from 'd3';
import { MeshNode, ResourceItem } from '../types';

export type HeatmapMode = 'combined' | 'nodes' | 'resources';

export interface HeatmapPoint {
  x: number;
  y: number;
  weight: number;
  type: 'node' | 'resource';
  label?: string;
}

export interface D3HeatmapGridConfig {
  gridWidth: number;
  gridHeight: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  bandwidth: number; // Gaussian kernel bandwidth in world units
}

export interface BioregionalHeatmapResult {
  contours: d3.ContourMultiPolygon[];
  densityGrid: Float64Array;
  maxDensity: number;
  minDensity: number;
  colorScale: (val: number) => string;
  gridWidth: number;
  gridHeight: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  geoPath: d3.GeoPath<any, any>;
  nodeCount: number;
  resourceCount: number;
}

/**
 * Solarpunk D3 color scale generator
 * Smooth transition from subtle forest teal -> bright emerald -> warm amber gold -> solar coral
 */
export function createSolarpunkHeatmapColorScale(isNightMode: boolean = false): (t: number) => string {
  const interpolator = isNightMode
    ? d3.interpolateRgbBasis([
        'rgba(24, 35, 21, 0.0)',
        'rgba(42, 157, 143, 0.25)',
        'rgba(88, 129, 87, 0.40)',
        'rgba(135, 168, 120, 0.55)',
        'rgba(233, 196, 106, 0.70)',
        'rgba(244, 162, 97, 0.85)',
      ])
    : d3.interpolateRgbBasis([
        'rgba(250, 246, 238, 0.0)',
        'rgba(42, 157, 143, 0.28)',
        'rgba(88, 129, 87, 0.45)',
        'rgba(135, 168, 120, 0.60)',
        'rgba(233, 196, 106, 0.75)',
        'rgba(244, 162, 97, 0.88)',
      ]);

  return d3.scaleSequential(interpolator).domain([0, 1]);
}

/**
 * Computes 2D Kernel Density Estimation using D3 and extracts isodensity contours
 */
export function computeD3BioregionalHeatmap(
  peers: MeshNode[],
  resources: ResourceItem[],
  userPos: { x: number; y: number },
  peerWorldPositions: { peer: MeshNode; x: number; y: number }[],
  resourceWorldPositions: { resource: ResourceItem; x: number; y: number }[],
  mode: HeatmapMode = 'combined',
  isNightMode: boolean = false,
  customBandwidth: number = 85
): BioregionalHeatmapResult | null {
  const points: HeatmapPoint[] = [];

  // 1. Gather Active Node Points
  if (mode === 'combined' || mode === 'nodes') {
    // User local node
    points.push({
      x: userPos.x,
      y: userPos.y,
      weight: 1.8, // High weight for user node
      type: 'node',
      label: 'Local User Node',
    });

    peerWorldPositions.forEach(({ peer, x, y }) => {
      // Weight active nodes by link reliability and direct connectivity
      const freshnessWeight = peer.isDirect ? 1.5 : peer.connectionState === 'relayed' ? 1.2 : 0.8;
      const trustFactor = Math.max(0.5, (peer.trustScore || 70) / 100);
      const weight = freshnessWeight * trustFactor;

      points.push({
        x,
        y,
        weight,
        type: 'node',
        label: peer.callsign,
      });
    });
  }

  // 2. Gather Resource Points
  if (mode === 'combined' || mode === 'resources') {
    resourceWorldPositions.forEach(({ resource, x, y }) => {
      // Resource weight: based on category and activity
      let resWeight = 1.0;
      if (resource.category === 'Energy' || resource.category === 'Food') {
        resWeight = 1.6; // Critical life-support resources weighted higher
      } else if (resource.category === 'Bio-Remedy' || resource.category === 'Care & Housing') {
        resWeight = 1.4;
      } else if (resource.category === 'Tools' || resource.category === 'Electronics') {
        resWeight = 1.2;
      }
      if (resource.isActive) {
        resWeight += 0.3;
      }

      points.push({
        x,
        y,
        weight: resWeight,
        type: 'resource',
        label: resource.title,
      });
    });
  }

  if (points.length === 0) return null;

  // 3. Compute Bounding Box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  // Add padding around bounds
  const padding = Math.max(160, customBandwidth * 2.2);
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const width = Math.max(200, maxX - minX);
  const height = Math.max(200, maxY - minY);

  // Grid Resolution (e.g. 56x56 grid for smooth D3 contouring with high performance)
  const gridWidth = 56;
  const gridHeight = 56;
  const dx = width / gridWidth;
  const dy = height / gridHeight;

  const densityGrid = new Float64Array(gridWidth * gridHeight);
  const bandwidthSq = customBandwidth * customBandwidth;

  let maxDensity = 0;
  let minDensity = Infinity;

  // 4. Compute 2D Gaussian Kernel Density Estimation on Grid
  for (let gy = 0; gy < gridHeight; gy++) {
    const worldY = minY + (gy + 0.5) * dy;
    for (let gx = 0; gx < gridWidth; gx++) {
      const worldX = minX + (gx + 0.5) * dx;
      let density = 0;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const distSq = (worldX - pt.x) * (worldX - pt.x) + (worldY - pt.y) * (worldY - pt.y);
        // Gaussian kernel
        const contrib = pt.weight * Math.exp(-distSq / (2 * bandwidthSq));
        density += contrib;
      }

      const idx = gy * gridWidth + gx;
      densityGrid[idx] = density;
      if (density > maxDensity) maxDensity = density;
      if (density < minDensity) minDensity = density;
    }
  }

  if (maxDensity <= 0.0001) return null;

  // 5. Generate D3 Iso-density Contours
  // Threshold levels: 8 smoothly stepped density levels from 8% to 92% of max density
  const thresholdSteps = 8;
  const thresholds = d3.range(1, thresholdSteps + 1).map((step) => {
    return (maxDensity * step) / (thresholdSteps + 0.8);
  });

  const contourGenerator = d3
    .contours()
    .size([gridWidth, gridHeight])
    .smooth(true)
    .thresholds(thresholds);

  const rawContours = contourGenerator(Array.from(densityGrid));

  // 6. Transform grid coordinates [0..gridWidth, 0..gridHeight] back to world coordinates
  const transformedContours: d3.ContourMultiPolygon[] = rawContours.map((contour) => {
    const transformedCoordinates = contour.coordinates.map((polygon) => {
      return polygon.map((ring) => {
        return ring.map(([gx, gy]) => {
          const worldX = minX + gx * dx;
          const worldY = minY + gy * dy;
          return [worldX, worldY] as [number, number];
        });
      });
    });

    return {
      ...contour,
      coordinates: transformedCoordinates,
    };
  });

  const colorScale = createSolarpunkHeatmapColorScale(isNightMode);

  return {
    contours: transformedContours,
    densityGrid,
    maxDensity,
    minDensity,
    colorScale,
    gridWidth,
    gridHeight,
    bounds: { minX, maxX, minY, maxY },
    geoPath: d3.geoPath(),
    nodeCount: peerWorldPositions.length + 1,
    resourceCount: resourceWorldPositions.length,
  };
}

/**
 * Draws the computed D3 density heatmap directly onto the Canvas 2D rendering context
 */
export function drawD3HeatmapOnCanvas(
  ctx: CanvasRenderingContext2D,
  heatmapResult: BioregionalHeatmapResult,
  transform: { x: number; y: number; scale: number },
  isNightMode: boolean = false,
  heatmapOpacity: number = 0.65
): void {
  const { contours, maxDensity, colorScale } = heatmapResult;
  if (!contours || contours.length === 0) return;

  ctx.save();
  ctx.globalAlpha = heatmapOpacity;

  // Create canvas path generator for D3 geo geometries
  const pathGenerator = d3.geoPath(null, ctx);

  // Draw contours from lowest to highest density level
  contours.forEach((contour) => {
    const normalizedValue = Math.min(1.0, Math.max(0.05, contour.value / maxDensity));
    const fillStyle = colorScale(normalizedValue);

    ctx.beginPath();
    pathGenerator(contour);
    ctx.fillStyle = fillStyle;
    ctx.fill();

    // Subtle contour boundary isocline
    ctx.strokeStyle = isNightMode
      ? `rgba(233, 196, 106, ${0.15 + normalizedValue * 0.35})`
      : `rgba(42, 157, 143, ${0.18 + normalizedValue * 0.40})`;
    ctx.lineWidth = Math.max(0.6, (0.8 + normalizedValue * 0.8) / transform.scale);
    ctx.stroke();
  });

  ctx.restore();
}
