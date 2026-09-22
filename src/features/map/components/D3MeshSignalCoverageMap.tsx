import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { MeshNode, UserProfile } from '../../../types';
import { soundFeedback } from '../../../services/utils/soundFeedback';
import {
  Radio,
  Wifi,
  Zap,
  ShieldCheck,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Layers,
  Sparkles,
  MessageSquare,
  Award,
  ChevronRight,
  Compass,
  PlusCircle,
  X,
  Target,
  Share2,
} from 'lucide-react';
import { isHighTrustPeer } from '../../../services/mesh/highTrustProximityService';

export interface D3MeshSignalCoverageMapProps {
  peers: MeshNode[];
  user?: UserProfile;
  selectedPeerId?: string | null;
  onSelectPeer?: (peer: MeshNode) => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
  onOpenReputation?: (peer: MeshNode) => void;
  isNightMode?: boolean;
  onAddToast?: (title: string, description?: string, type?: 'success' | 'warning' | 'info') => void;
}

// RF Propagation Environment Type
export type RFEnvironment = 'open_field' | 'suburban_trees' | 'dense_urban';

export interface OptimalPlacementPoint {
  id: string;
  title: string;
  angle: number; // degrees
  distanceRatio: number; // 0 to 1
  distanceMeters: number;
  reason: string;
  coverageGainPercent: number;
  recommendedHardware: string;
  bridgedPeers: string[];
}

export interface SimulatedRepeater {
  x: number;
  y: number;
  angle: number;
  distanceRatio: number;
  rangeRadius: number;
}

export const D3MeshSignalCoverageMap: React.FC<D3MeshSignalCoverageMapProps> = ({
  peers,
  user,
  selectedPeerId,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  isNightMode = false,
  onAddToast,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [rfEnv, setRfEnv] = useState<RFEnvironment>('suburban_trees');
  const [showRings, setShowRings] = useState(true);
  const [showCoverageHeatmap, setShowCoverageHeatmap] = useState(true);
  const [showOptimalPlacements, setShowOptimalPlacements] = useState(true);
  const [showCompassGrid, setShowCompassGrid] = useState(true);
  const [selectedPlacement, setSelectedPlacement] = useState<OptimalPlacementPoint | null>(null);
  const [activePeer, setActivePeer] = useState<MeshNode | null>(null);
  const [simulatedRepeater, setSimulatedRepeater] = useState<SimulatedRepeater | null>(null);
  const [isPlacementSimActive, setIsPlacementSimActive] = useState(false);

  // Environmental path loss exponent
  const pathLossExponent = useMemo(() => {
    switch (rfEnv) {
      case 'open_field':
        return 2.0;
      case 'dense_urban':
        return 3.5;
      case 'suburban_trees':
      default:
        return 2.7;
    }
  }, [rfEnv]);

  // Handle ResizeObserver for SVG container
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height: Math.max(height, 500) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute calculated positions for peers relative to user center
  const radiusMax = Math.min(dimensions.width, dimensions.height) * 0.44;

  const processedPeers = useMemo(() => {
    return peers.map((p, idx) => {
      const angle = typeof p.angle === 'number' ? p.angle : (idx * (360 / Math.max(1, peers.length))) % 360;
      const rad = ((angle - 90) * Math.PI) / 180;
      const rssi = p.lastRssi || -75;

      // Inverse logarithmic mapping from RSSI (-40 dBm -> 0.15, -95 dBm -> 0.95)
      // Clamped ratio from 0.1 to 0.95
      const normalizedRssiRatio = Math.max(0.12, Math.min(0.95, ((-rssi - 40) / 55)));
      const dist = normalizedRssiRatio * radiusMax;
      const x = Math.cos(rad) * dist;
      const y = Math.sin(rad) * dist;

      // Estimated physical meters based on RF environment
      const estMeters = Math.max(1, Math.round(10 ** ((-45 - rssi) / (10 * pathLossExponent))));
      const isHighTrust = isHighTrustPeer(p);
      const isImmediate = rssi > -70;

      return {
        ...p,
        angle,
        rad,
        rssi,
        dist,
        x,
        y,
        estMeters,
        isHighTrust,
        isImmediate,
      };
    });
  }, [peers, radiusMax, pathLossExponent]);

  // Compute Optimal Placement Points to fill coverage gaps and bridge distant/fringe nodes
  const optimalPlacements: OptimalPlacementPoint[] = useMemo(() => {
    const placements: OptimalPlacementPoint[] = [];
    if (processedPeers.length === 0) {
      // Default recommendation when alone in the mesh
      placements.push({
        id: 'opt_default_high_ground',
        title: 'Elevated Ridge Relay (North-East)',
        angle: 45,
        distanceRatio: 0.6,
        distanceMeters: 450,
        reason: 'Broadband LoRa/BLE repeater placement to seed initial bioregional mesh coverage.',
        coverageGainPercent: 85,
        recommendedHardware: 'Solar 5W + Heltec V3 LoRa 868MHz (Omni-directional 3dBi)',
        bridgedPeers: [],
      });
      return placements;
    }

    // 1. Analyze angular sectors (360 degrees in 8 octants of 45 deg)
    const octants = [0, 45, 90, 135, 180, 225, 270, 315];
    const octantNames = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

    octants.forEach((targetAngle, i) => {
      // Find peers within ±30 degrees of this octant
      const nearbyPeers = processedPeers.filter((p) => {
        let diff = Math.abs(p.angle - targetAngle);
        if (diff > 180) diff = 360 - diff;
        return diff <= 35;
      });

      if (nearbyPeers.length === 0) {
        // Void detected in this direction!
        placements.push({
          id: `opt_void_${targetAngle}`,
          title: `${octantNames[i]} Coverage Expansion Relay`,
          angle: targetAngle,
          distanceRatio: 0.65,
          distanceMeters: Math.round(600 * (pathLossExponent / 2.5)),
          reason: `Coverage Dead-Zone: No active nodes detected in the ${octantNames[i]} sector. Placing a repeater here illuminates blindspots.`,
          coverageGainPercent: 40 + Math.floor(Math.random() * 15),
          recommendedHardware: 'Solar Tree-Mounted BLE 5.0 Coded PHY / LoRa Repeater',
          bridgedPeers: [],
        });
      }
    });

    // 2. Identify weak fringe peers (> -80 dBm) that would benefit from a bridging repeater
    const fringePeers = processedPeers.filter((p) => p.rssi <= -80);
    fringePeers.forEach((p) => {
      placements.push({
        id: `opt_bridge_${p.id}`,
        title: `Midpoint Bridge for ${p.callsign}`,
        angle: p.angle,
        distanceRatio: Math.max(0.3, (p.dist / radiusMax) * 0.55),
        distanceMeters: Math.round(p.estMeters * 0.5),
        reason: `Weak link mitigation: ${p.callsign} is at fringe RSSI (${p.rssi} dBm). A midpoint relay provides a +15 dBm link margin.`,
        coverageGainPercent: 28,
        recommendedHardware: 'Rooftop Solar Mesh Relay with High-Gain Collinear Antenna',
        bridgedPeers: [p.callsign],
      });
    });

    return placements.slice(0, 4); // Keep top 4 actionable recommendations
  }, [processedPeers, radiusMax, pathLossExponent]);

  // Overall Local Mesh Coverage Score (0 - 100%)
  const coverageMetrics = useMemo(() => {
    if (processedPeers.length === 0) {
      return { score: 18, rating: 'Sparse', strongCount: 0, relayCount: 0, fringeCount: 0 };
    }
    const strongCount = processedPeers.filter((p) => p.rssi > -70).length;
    const relayCount = processedPeers.filter((p) => p.rssi <= -70 && p.rssi > -82).length;
    const fringeCount = processedPeers.filter((p) => p.rssi <= -82).length;

    // Angular spread calculation
    const angles = processedPeers.map((p) => p.angle).sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 0; i < angles.length; i++) {
      const nextAngle = i === angles.length - 1 ? angles[0] + 360 : angles[i + 1];
      const gap = nextAngle - angles[i];
      if (gap > maxGap) maxGap = gap;
    }

    const angularSpreadScore = Math.max(20, Math.min(100, Math.round(100 - (maxGap / 360) * 80)));
    const signalScore = Math.min(100, strongCount * 25 + relayCount * 15 + fringeCount * 8);
    const score = Math.min(100, Math.round(angularSpreadScore * 0.4 + signalScore * 0.6));

    let rating = 'Critical Gaps';
    if (score >= 80) rating = 'Excellent Omni Coverage';
    else if (score >= 60) rating = 'Good Sector Coverage';
    else if (score >= 40) rating = 'Moderate Directional Link';

    return { score, rating, strongCount, relayCount, fringeCount, maxGap };
  }, [processedPeers]);

  // Draw D3 Visualisation with Zoom & Pan
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;
    const cx = width / 2;
    const cy = height / 2;

    // Create defs for gradients and filters
    const defs = svg.append('defs');

    // High-Trust Green / Solarpunk Teal Glow Filter
    const glowFilter = defs.append('filter').attr('id', 'coverage-glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    glowFilter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Heatmap Radial Gradient for Center
    const centerGrad = defs.append('radialGradient').attr('id', 'center-signal-grad');
    centerGrad.append('stop').attr('offset', '0%').attr('stop-color', isNightMode ? '#33ff00' : '#2A9D8F').attr('stop-opacity', '0.35');
    centerGrad.append('stop').attr('offset', '45%').attr('stop-color', isNightMode ? '#588157' : '#2A9D8F').attr('stop-opacity', '0.15');
    centerGrad.append('stop').attr('offset', '80%').attr('stop-color', '#E9C46A').attr('stop-opacity', '0.06');
    centerGrad.append('stop').attr('offset', '100%').attr('stop-color', '#E76F51').attr('stop-opacity', '0.0');

    // Optimal Placement Pulse Gradient
    const optGrad = defs.append('radialGradient').attr('id', 'opt-pulse-grad');
    optGrad.append('stop').attr('offset', '0%').attr('stop-color', '#E9C46A').attr('stop-opacity', '0.45');
    optGrad.append('stop').attr('offset', '70%').attr('stop-color', '#E9C46A').attr('stop-opacity', '0.12');
    optGrad.append('stop').attr('offset', '100%').attr('stop-color', '#E9C46A').attr('stop-opacity', '0');

    // Simulated Repeater Gradient
    const simGrad = defs.append('radialGradient').attr('id', 'sim-repeater-grad');
    simGrad.append('stop').attr('offset', '0%').attr('stop-color', '#3B82F6').attr('stop-opacity', '0.4');
    simGrad.append('stop').attr('offset', '80%').attr('stop-color', '#3B82F6').attr('stop-opacity', '0.1');
    simGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3B82F6').attr('stop-opacity', '0');

    // Master Container Group with Zoom
    const g = svg.append('g').attr('class', 'zoomable-container');

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);

    // Background Click Listener for Placement Simulation or Deselection
    svg.on('click', (event) => {
      // Check if click was on background
      if (event.target === svgRef.current || (event.target as Element).classList.contains('bg-interactive-layer')) {
        if (isPlacementSimActive) {
          const [mx, my] = d3.pointer(event, g.node());
          const dx = mx - cx;
          const dy = my - cy;
          const angleRad = Math.atan2(dy, dx);
          let deg = (angleRad * 180) / Math.PI + 90;
          if (deg < 0) deg += 360;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          const ratio = Math.min(1.0, distFromCenter / radiusMax);

          setSimulatedRepeater({
            x: mx,
            y: my,
            angle: Math.round(deg),
            distanceRatio: parseFloat(ratio.toFixed(2)),
            rangeRadius: radiusMax * 0.42,
          });
          soundFeedback.playClick();
          if (onAddToast) {
            onAddToast(
              'Simulated Solar Repeater Placed',
              `Placed at ${Math.round(deg)}° bearing (~${Math.round(ratio * 800)}m). Check live coverage projection.`,
              'info'
            );
          }
        } else {
          setActivePeer(null);
          setSelectedPlacement(null);
        }
      }
    });

    // Transparent rect to capture pan/zoom clicks everywhere
    g.append('rect')
      .attr('class', 'bg-interactive-layer')
      .attr('x', -width * 2)
      .attr('y', -height * 2)
      .attr('width', width * 5)
      .attr('height', height * 5)
      .attr('fill', 'transparent');

    // 1. SIGNAL COVERAGE HEATMAP / CONTOURS
    if (showCoverageHeatmap) {
      const heatmapG = g.append('g').attr('class', 'signal-heatmap-layer');

      // Central RF halo
      heatmapG
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', radiusMax * 0.95)
        .attr('fill', 'url(#center-signal-grad)');

      // Peer RF halos
      processedPeers.forEach((p) => {
        const peerGradId = `peer-grad-${p.id}`;
        const peerGrad = defs.append('radialGradient').attr('id', peerGradId);
        const color = p.rssi > -70 ? '#2A9D8F' : p.rssi > -82 ? '#E9C46A' : '#F4A261';

        peerGrad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', '0.28');
        peerGrad.append('stop').attr('offset', '70%').attr('stop-color', color).attr('stop-opacity', '0.08');
        peerGrad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', '0.0');

        heatmapG
          .append('circle')
          .attr('cx', cx + p.x)
          .attr('cy', cy + p.y)
          .attr('r', radiusMax * 0.38)
          .attr('fill', `url(#${peerGradId})`);
      });

      // Simulated Repeater RF halo if present
      if (simulatedRepeater) {
        heatmapG
          .append('circle')
          .attr('cx', simulatedRepeater.x)
          .attr('cy', simulatedRepeater.y)
          .attr('r', simulatedRepeater.rangeRadius)
          .attr('fill', 'url(#sim-repeater-grad)');
      }
    }

    // 2. CONCENTRIC RSSI RANGE RINGS & COMPASS AXES
    if (showRings) {
      const ringsG = g.append('g').attr('class', 'rssi-rings-layer');

      const ringConfig = [
        { ratio: 0.32, label: 'Immediate BLE (> -70 dBm)', color: isNightMode ? '#33ff00' : '#2A9D8F', dash: 'none', alpha: 0.4 },
        { ratio: 0.58, label: 'Reliable Link (-70 to -80 dBm)', color: '#E9C46A', dash: '3,3', alpha: 0.35 },
        { ratio: 0.82, label: 'Fringe Reach (-80 to -90 dBm)', color: '#F4A261', dash: '5,5', alpha: 0.3 },
        { ratio: 0.98, label: 'Noise Floor Horizon (< -90 dBm)', color: isNightMode ? '#364E30' : '#87A878', dash: '8,4', alpha: 0.25 },
      ];

      ringConfig.forEach((ring) => {
        const r = radiusMax * ring.ratio;

        ringsG
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', ring.color)
          .attr('stroke-width', ring.ratio === 0.32 ? 1.75 : 1.2)
          .attr('stroke-dasharray', ring.dash)
          .attr('stroke-opacity', ring.alpha);

        // Ring Label
        ringsG
          .append('text')
          .attr('x', cx + 8)
          .attr('y', cy - r + 13)
          .attr('fill', ring.color)
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .attr('font-weight', '600')
          .attr('opacity', 0.85)
          .text(ring.label);
      });
    }

    // 3. COMPASS RADIAL SPOKES & SECTOR BEARING
    if (showCompassGrid) {
      const compassG = g.append('g').attr('class', 'compass-grid-layer');
      const directions = [
        { label: 'N · 000°', angle: 0 },
        { label: 'NE · 045°', angle: 45 },
        { label: 'E · 090°', angle: 90 },
        { label: 'SE · 135°', angle: 135 },
        { label: 'S · 180°', angle: 180 },
        { label: 'SW · 225°', angle: 225 },
        { label: 'W · 270°', angle: 270 },
        { label: 'NW · 315°', angle: 315 },
      ];

      directions.forEach((dir) => {
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const x2 = cx + Math.cos(rad) * radiusMax * 1.03;
        const y2 = cy + Math.sin(rad) * radiusMax * 1.03;

        // Spoke line
        compassG
          .append('line')
          .attr('x1', cx)
          .attr('y1', cy)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', isNightMode ? '#364E30' : '#87A878')
          .attr('stroke-width', dir.angle % 90 === 0 ? 1.0 : 0.6)
          .attr('stroke-opacity', 0.25)
          .attr('stroke-dasharray', dir.angle % 90 === 0 ? 'none' : '2,4');

        // Bearing label
        compassG
          .append('text')
          .attr('x', cx + Math.cos(rad) * (radiusMax * 1.08))
          .attr('y', cy + Math.sin(rad) * (radiusMax * 1.08) + 4)
          .attr('text-anchor', 'middle')
          .attr('fill', isNightMode ? '#87A878' : '#637062')
          .attr('font-size', '9.5px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .attr('opacity', 0.8)
          .text(dir.label);
      });
    }

    // 4. RF VECTOR LINKS FROM SELF TO DISCOVERED PEERS
    const linksG = g.append('g').attr('class', 'rf-links-layer');

    processedPeers.forEach((p) => {
      const strokeColor = p.rssi > -70 ? (isNightMode ? '#33ff00' : '#2A9D8F') : p.rssi > -82 ? '#E9C46A' : '#F4A261';
      const isSelected = activePeer?.id === p.id || selectedPeerId === p.id;

      // Vector link line
      linksG
        .append('line')
        .attr('x1', cx)
        .attr('y1', cy)
        .attr('x2', cx + p.x)
        .attr('y2', cy + p.y)
        .attr('stroke', strokeColor)
        .attr('stroke-width', isSelected ? 2.5 : p.isHighTrust && p.isImmediate ? 2.0 : 1.2)
        .attr('stroke-opacity', isSelected ? 0.9 : 0.45)
        .attr('stroke-dasharray', p.isImmediate ? 'none' : '4,3');

      // Distance & RSSI Tag along the link midpoint
      const midX = cx + p.x * 0.52;
      const midY = cy + p.y * 0.52;

      const tagGroup = linksG.append('g').attr('transform', `translate(${midX}, ${midY})`);
      tagGroup
        .append('rect')
        .attr('x', -24)
        .attr('y', -8)
        .attr('width', 48)
        .attr('height', 16)
        .attr('rx', 8)
        .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
        .attr('stroke', strokeColor)
        .attr('stroke-width', 0.75)
        .attr('opacity', 0.9);

      tagGroup
        .append('text')
        .attr('x', 0)
        .attr('y', 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', strokeColor)
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(`${p.rssi} dBm`);
    });

    // 5. OPTIMAL REPEATER PLACEMENT WAYPOINTS & RECOMMENDATIONS
    if (showOptimalPlacements) {
      const optG = g.append('g').attr('class', 'optimal-placements-layer');

      optimalPlacements.forEach((opt) => {
        const rad = ((opt.angle - 90) * Math.PI) / 180;
        const optDist = radiusMax * opt.distanceRatio;
        const ox = cx + Math.cos(rad) * optDist;
        const oy = cy + Math.sin(rad) * optDist;
        const isSelected = selectedPlacement?.id === opt.id;

        const optNode = optG
          .append('g')
          .attr('transform', `translate(${ox}, ${oy})`)
          .attr('class', 'cursor-pointer')
          .on('click', (event) => {
            event.stopPropagation();
            soundFeedback.playClick();
            setSelectedPlacement(opt);
            setActivePeer(null);
          });

        // Pulsing halo
        optNode
          .append('circle')
          .attr('r', isSelected ? 24 : 18)
          .attr('fill', 'url(#opt-pulse-grad)')
          .attr('class', 'animate-pulse');

        // Outer dotted waypoint ring
        optNode
          .append('circle')
          .attr('r', 12)
          .attr('fill', isNightMode ? '#2B2713' : '#FEF8EB')
          .attr('stroke', '#E9C46A')
          .attr('stroke-width', 1.8)
          .attr('stroke-dasharray', '2,2');

        // Center beacon icon
        optNode
          .append('circle')
          .attr('r', 4.5)
          .attr('fill', '#E9C46A');

        // Optimal Label Badge
        const labelG = optNode.append('g').attr('transform', `translate(0, 20)`);
        labelG
          .append('rect')
          .attr('x', -45)
          .attr('y', -6)
          .attr('width', 90)
          .attr('height', 14)
          .attr('rx', 7)
          .attr('fill', isNightMode ? '#1C190D' : '#FFF9E6')
          .attr('stroke', '#E9C46A')
          .attr('stroke-width', 0.75);

        labelG
          .append('text')
          .attr('x', 0)
          .attr('y', 4)
          .attr('text-anchor', 'middle')
          .attr('fill', '#D4A017')
          .attr('font-size', '8px')
          .attr('font-family', 'sans-serif')
          .attr('font-weight', 'bold')
          .text(`★ OPTIMAL RELAY`);
      });
    }

    // 6. SIMULATED REPEATER PIN IF ACTIVE
    if (simulatedRepeater) {
      const simG = g.append('g').attr('class', 'sim-repeater-pin-layer');
      const simNode = simG.append('g').attr('transform', `translate(${simulatedRepeater.x}, ${simulatedRepeater.y})`);

      simNode
        .append('circle')
        .attr('r', 18)
        .attr('fill', '#3B82F6')
        .attr('fill-opacity', 0.25)
        .attr('class', 'animate-ping');

      simNode
        .append('circle')
        .attr('r', 10)
        .attr('fill', '#3B82F6')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);

      // Label
      const simLabel = simNode.append('g').attr('transform', `translate(0, -16)`);
      simLabel
        .append('rect')
        .attr('x', -40)
        .attr('y', -7)
        .attr('width', 80)
        .attr('height', 14)
        .attr('rx', 7)
        .attr('fill', '#1E3A8A')
        .attr('stroke', '#60A5FA')
        .attr('stroke-width', 1);

      simLabel
        .append('text')
        .attr('x', 0)
        .attr('y', 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#93C5FD')
        .attr('font-size', '8.5px')
        .attr('font-weight', 'bold')
        .text('VIRTUAL REPEATER');
    }

    // 7. DISCOVERED PEER NODES
    const peersG = g.append('g').attr('class', 'peer-nodes-layer');

    processedPeers.forEach((p) => {
      const nodeX = cx + p.x;
      const nodeY = cy + p.y;
      const isSelected = activePeer?.id === p.id || selectedPeerId === p.id;
      const nodeColor = p.rssi > -70 ? (isNightMode ? '#33ff00' : '#2A9D8F') : p.rssi > -82 ? '#E9C46A' : '#F4A261';

      const peerGroup = peersG
        .append('g')
        .attr('transform', `translate(${nodeX}, ${nodeY})`)
        .attr('class', 'cursor-pointer')
        .on('click', (event) => {
          event.stopPropagation();
          soundFeedback.playClick();
          setActivePeer(p);
          setSelectedPlacement(null);
          if (onSelectPeer) onSelectPeer(p);
        });

      // Pulse ring for High Trust + Immediate BLE (< -70 dBm)
      if (p.isHighTrust && p.isImmediate) {
        peerGroup
          .append('circle')
          .attr('r', 22)
          .attr('fill', 'none')
          .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.6)
          .attr('class', 'animate-ping');
      }

      // Selection ring
      if (isSelected) {
        peerGroup
          .append('circle')
          .attr('r', 18)
          .attr('fill', 'none')
          .attr('stroke', nodeColor)
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '3,3');
      }

      // Node background disc
      peerGroup
        .append('circle')
        .attr('r', 12)
        .attr('fill', isNightMode ? '#1A2917' : '#FFFFFF')
        .attr('stroke', nodeColor)
        .attr('stroke-width', 2.2);

      // Radio Type icon inside node
      peerGroup
        .append('circle')
        .attr('r', 5)
        .attr('fill', nodeColor);

      // Callsign and Trust Pill label below node
      const peerLabel = peerGroup.append('g').attr('transform', `translate(0, 19)`);
      const labelText = p.callsign;
      const labelWidth = Math.max(64, labelText.length * 7 + 16);

      peerLabel
        .append('rect')
        .attr('x', -labelWidth / 2)
        .attr('y', -6)
        .attr('width', labelWidth)
        .attr('height', 15)
        .attr('rx', 7.5)
        .attr('fill', isNightMode ? '#141F12' : '#FAF6EE')
        .attr('stroke', nodeColor)
        .attr('stroke-width', 0.9);

      peerLabel
        .append('text')
        .attr('x', 0)
        .attr('y', 4.5)
        .attr('text-anchor', 'middle')
        .attr('fill', isNightMode ? '#F0F5EE' : '#203A2A')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text(labelText);

      // High trust indicator icon tag
      if (p.isHighTrust) {
        peerGroup
          .append('text')
          .attr('x', 11)
          .attr('y', -7)
          .attr('font-size', '11px')
          .text('🛡️');
      }
    });

    // 8. USER NODE (CENTER BEACON)
    const userG = g.append('g').attr('transform', `translate(${cx}, ${cy})`).attr('class', 'user-center-node');

    // Self active pulse ring
    userG
      .append('circle')
      .attr('r', 20)
      .attr('fill', 'none')
      .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.5)
      .attr('class', 'animate-pulse');

    // Main self disc
    userG
      .append('circle')
      .attr('r', 11)
      .attr('fill', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2.5);

    // Callsign tag for self
    const userLabel = userG.append('g').attr('transform', 'translate(0, 18)');
    userLabel
      .append('rect')
      .attr('x', -40)
      .attr('y', -6)
      .attr('width', 80)
      .attr('height', 15)
      .attr('rx', 7.5)
      .attr('fill', isNightMode ? '#141F12' : '#FAF6EE')
      .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('stroke-width', 1);

    userLabel
      .append('text')
      .attr('x', 0)
      .attr('y', 4.5)
      .attr('text-anchor', 'middle')
      .attr('fill', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text(user?.callsign || 'Self (Kestrel-7)');
  }, [
    dimensions,
    processedPeers,
    optimalPlacements,
    simulatedRepeater,
    showRings,
    showCoverageHeatmap,
    showOptimalPlacements,
    showCompassGrid,
    activePeer,
    selectedPlacement,
    selectedPeerId,
    isNightMode,
    pathLossExponent,
    radiusMax,
    user?.callsign,
    isPlacementSimActive,
    onAddToast,
    onSelectPeer,
  ]);

  // Recenter / Reset View
  const handleResetZoom = useCallback(() => {
    soundFeedback.playClick();
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(450).call(d3.zoom().transform as any, d3.zoomIdentity);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none flex flex-col ${
        isNightMode ? 'bg-[#121D10] text-[#F0F5EE]' : 'bg-[#FAF6EE] text-[#203A2A]'
      }`}
    >
      {/* Top HUD: Mesh Coverage & Signal Telemetry Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {/* Coverage Score & Environment Badge */}
        <div
          className={`pointer-events-auto px-3.5 py-2 rounded-2xl border shadow-md backdrop-blur-md flex items-center gap-3 text-xs ${
            isNightMode ? 'bg-[#141F12]/95 border-[#2A3B26]' : 'bg-white/95 border-[#87A878]/35'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                coverageMetrics.score >= 70
                  ? isNightMode
                    ? 'bg-[#33ff00]/20 text-[#33ff00]'
                    : 'bg-[#2A9D8F]/20 text-[#2A9D8F]'
                  : coverageMetrics.score >= 40
                  ? 'bg-[#E9C46A]/20 text-[#D4A017]'
                  : 'bg-[#F4A261]/20 text-[#E76F51]'
              }`}
            >
              {coverageMetrics.score}%
            </div>
            <div>
              <div className="font-bold text-[11px] flex items-center gap-1.5">
                <span>Mesh Coverage Index</span>
                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-normal">
                  ({coverageMetrics.rating})
                </span>
              </div>
              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono flex items-center gap-2">
                <span>Immediate (&gt;-70): <strong>{coverageMetrics.strongCount}</strong></span>
                <span>·</span>
                <span>Relay: <strong>{coverageMetrics.relayCount}</strong></span>
                <span>·</span>
                <span>Fringe: <strong>{coverageMetrics.fringeCount}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Simulation Toggles */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/90 dark:bg-[#141F12]/90 p-1 rounded-2xl border border-[#87A878]/30 dark:border-[#2A3B26] shadow-md backdrop-blur-md">
          {/* RF Environment Selector */}
          <select
            value={rfEnv}
            onChange={(e) => {
              soundFeedback.playClick();
              setRfEnv(e.target.value as RFEnvironment);
            }}
            className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-transparent border-none focus:outline-none cursor-pointer text-[#203A2A] dark:text-[#F0F5EE]"
            title="Select RF Path Loss Terrain Model"
          >
            <option value="open_field" className="dark:bg-[#141F12]">Terrain: Open Field (n=2.0)</option>
            <option value="suburban_trees" className="dark:bg-[#141F12]">Terrain: Forest/Suburban (n=2.7)</option>
            <option value="dense_urban" className="dark:bg-[#141F12]">Terrain: Dense Urban (n=3.5)</option>
          </select>

          {/* Simulate Custom Repeater Placement Button */}
          <button
            id="btn-simulate-placement"
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              const nextState = !isPlacementSimActive;
              setIsPlacementSimActive(nextState);
              if (nextState && onAddToast) {
                onAddToast('Placement Simulator Active', 'Click anywhere on the map to place a virtual solar repeater.', 'info');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPlacementSimActive
                ? 'bg-[#3B82F6] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isPlacementSimActive ? 'Click to Place Relay' : 'Simulate Placement'}</span>
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-xl text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE] cursor-pointer"
            title="Recenter On Self Node"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Visibility Toggles (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/90 dark:bg-[#141F12]/90 p-1.5 rounded-2xl border border-[#87A878]/30 dark:border-[#2A3B26] shadow-md backdrop-blur-md text-[11px] font-bold">
        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setShowCoverageHeatmap(!showCoverageHeatmap);
          }}
          className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            showCoverageHeatmap ? 'bg-[#588157] text-white' : 'text-[#637062] dark:text-[#A8BDA5]'
          }`}
        >
          Signal Heatmap
        </button>
        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setShowRings(!showRings);
          }}
          className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            showRings ? 'bg-[#588157] text-white' : 'text-[#637062] dark:text-[#A8BDA5]'
          }`}
        >
          RSSI Rings
        </button>
        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setShowOptimalPlacements(!showOptimalPlacements);
          }}
          className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            showOptimalPlacements ? 'bg-[#D4A017] text-white' : 'text-[#637062] dark:text-[#A8BDA5]'
          }`}
        >
          ★ Optimal Relays
        </button>
        <button
          type="button"
          onClick={() => {
            soundFeedback.playClick();
            setShowCompassGrid(!showCompassGrid);
          }}
          className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            showCompassGrid ? 'bg-[#588157] text-white' : 'text-[#637062] dark:text-[#A8BDA5]'
          }`}
        >
          Bearings
        </button>
      </div>

      {/* Main D3 SVG Canvas */}
      <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Selected Node or Optimal Placement Inspection Drawer */}
      {activePeer && (
        <div
          className={`absolute bottom-4 right-4 z-30 max-w-sm w-[calc(100vw-32px)] p-4 rounded-2xl border shadow-xl backdrop-blur-lg transition-all ${
            isNightMode ? 'bg-[#141F12]/95 border-[#2A3B26]' : 'bg-white/95 border-[#87A878]/40'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm">{activePeer.callsign}</span>
                {isHighTrustPeer(activePeer) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#2A9D8F]/20 text-[#2A9D8F] dark:text-[#33ff00]">
                    🛡️ High Trust
                  </span>
                )}
                {activePeer.lastRssi > -70 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#33ff00]/20 text-[#588157] dark:text-[#33ff00]">
                    Immediate BLE
                  </span>
                )}
              </div>
              <div className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                {activePeer.bio || 'Regional mesh node participant.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePeer(null)}
              className="p-1 rounded-full text-[#637062] hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3 bg-black/5 dark:bg-white/5 p-2.5 rounded-xl">
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Signal (RSSI):</span>{' '}
              <strong className={activePeer.lastRssi > -70 ? 'text-[#2A9D8F] dark:text-[#33ff00]' : 'text-[#E9C46A]'}>
                {activePeer.lastRssi} dBm
              </strong>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Est. Distance:</span>{' '}
              <strong>~{Math.max(1, Math.round(10 ** ((-45 - activePeer.lastRssi) / (10 * pathLossExponent))))}m</strong>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Trust Score:</span>{' '}
              <strong>{activePeer.trustScore ?? 85}%</strong>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Radio Link:</span>{' '}
              <strong>{activePeer.radioType || 'BLE 5.0'}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenChatWithPeer && (
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  onOpenChatWithPeer(activePeer);
                }}
                className="flex-1 py-1.5 rounded-xl bg-[#588157] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#466945] cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Mesh Chat</span>
              </button>
            )}
            {onOpenReputation && (
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  onOpenReputation(activePeer);
                }}
                className="px-3 py-1.5 rounded-xl border border-[#87A878]/40 text-xs font-bold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-[#E9C46A]" />
                <span>Reputation</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Optimal Placement Waypoint Drawer */}
      {selectedPlacement && (
        <div
          className={`absolute bottom-4 right-4 z-30 max-w-sm w-[calc(100vw-32px)] p-4 rounded-2xl border shadow-xl backdrop-blur-lg transition-all ${
            isNightMode ? 'bg-[#1C190D]/95 border-[#E9C46A]/40 text-[#FDF6E2]' : 'bg-[#FFFDF7]/95 border-[#E9C46A]/60 text-[#203A2A]'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">★</span>
              <div>
                <h4 className="font-bold text-xs leading-tight">{selectedPlacement.title}</h4>
                <div className="text-[10px] text-[#8C6207] dark:text-[#E9C46A] font-mono">
                  Bearing: {selectedPlacement.angle}° · Distance: ~{selectedPlacement.distanceMeters}m
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlacement(null)}
              className="p-1 rounded-full text-[#637062] hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#524419] dark:text-[#E2D5B5] mb-2.5 leading-relaxed">
            {selectedPlacement.reason}
          </p>

          <div className="bg-[#E9C46A]/15 dark:bg-[#E9C46A]/10 p-2.5 rounded-xl text-[11px] mb-3 border border-[#E9C46A]/30">
            <div className="font-bold text-[#8C6207] dark:text-[#E9C46A] mb-0.5">Recommended Hardware:</div>
            <div className="text-xs font-mono">{selectedPlacement.recommendedHardware}</div>
            <div className="mt-1.5 flex items-center justify-between font-mono font-bold text-[#2A9D8F] dark:text-[#33ff00]">
              <span>Coverage Gain:</span>
              <span>+{selectedPlacement.coverageGainPercent}% Redundancy</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              if (onAddToast) {
                onAddToast(
                  'Placement Coordinates Saved',
                  `Waypoint bearing ${selectedPlacement.angle}° (~${selectedPlacement.distanceMeters}m) tagged for offline field deployment.`,
                  'success'
                );
              }
              setSelectedPlacement(null);
            }}
            className="w-full py-1.5 rounded-xl bg-[#E9C46A] text-[#422C00] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#D4A017] cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Tag Deployment Location</span>
          </button>
        </div>
      )}
    </div>
  );
};
