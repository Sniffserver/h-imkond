import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  ResourceItem,
  MeshNode,
  UserProfile,
  ResourceCategory,
} from '../../../types';
import { PeerTrustScoreIndicator } from '../../../components/PeerTrustScoreIndicator';
import { soundFeedback } from '../../../services/utils/soundFeedback';
import {
  LoRaBridgeRangeHUD,
  LoRaParameters,
  DEFAULT_LORA_CONFIG,
  estimateLoRaRangeKm,
} from './LoRaBridgeRangeHUD';
import {
  Layers,
  Search,
  Filter,
  Navigation,
  Compass,
  Zap,
  Sprout,
  Wrench,
  GraduationCap,
  Heart,
  Radio,
  Sparkles,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crosshair,
  X,
  MessageSquare,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Send,
  MapPin,
  CheckCircle2,
  Users,
} from 'lucide-react';

export interface D3CommunityResourceMapProps {
  resources: ResourceItem[];
  peers?: MeshNode[];
  user: UserProfile;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onSelectPeer?: (peer: MeshNode) => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
  onOpenReputation?: (peer: MeshNode) => void;
  isNightMode?: boolean;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

interface ResourceGraphNode extends d3.SimulationNodeDatum {
  id: string;
  resource: ResourceItem;
  title: string;
  category: ResourceCategory;
  ownerCallsign: string;
  distanceKm: number;
  bearingDeg: number;
  color: string;
  radius: number;
  isPeerNode?: boolean;
  isUserNode?: boolean;
  peer?: MeshNode;
}

interface ResourceGraphLink extends d3.SimulationLinkDatum<ResourceGraphNode> {
  id: string;
  source: string | ResourceGraphNode;
  target: string | ResourceGraphNode;
}

type ProjectionMode = 'spatial_radar' | 'force_constellation';
type DistanceFilter = 'all' | '500m' | '1.5km' | '5km';

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#588157',
  Energy: '#E9C46A',
  Tools: '#457B9D',
  Skills: '#9C6644',
  Care: '#E76F51',
  'Bio-Remedy': '#2A9D8F',
  Electronics: '#7209B7',
  Other: '#637062',
};

export const D3CommunityResourceMap: React.FC<D3CommunityResourceMapProps> = ({
  resources,
  peers = [],
  user,
  onViewResourceDetails,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  isNightMode = false,
  onAddToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Map Filter & View States
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('spatial_radar');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<ResourceGraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ResourceGraphNode | null>(null);
  const [loraConfig, setLoraConfig] = useState<LoRaParameters>(DEFAULT_LORA_CONFIG);

  const estimatedLoRaRangeKm = useMemo(() => estimateLoRaRangeKm(loraConfig), [loraConfig]);

  const coveredResourcesCount = useMemo(
    () => resources.filter((r) => (r.distanceKm || 0) <= estimatedLoRaRangeKm).length,
    [resources, estimatedLoRaRangeKm]
  );

  const coveredPeersCount = useMemo(
    () => peers.filter((p) => ((p as any).distanceKm || 1.2) <= estimatedLoRaRangeKm).length,
    [peers, estimatedLoRaRangeKm]
  );

  // Container dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Bearing and Distance Angle for each resource
  const processedNodes = useMemo(() => {
    const nodes: ResourceGraphNode[] = [];
    const userCallsign = user?.callsign || 'Local Node';
    const userId = user?.id || 'usr_self';

    // 1. Center sovereign user node
    nodes.push({
      id: 'node_user',
      title: `${userCallsign} (You)`,
      category: 'Care' as ResourceCategory,
      ownerCallsign: userCallsign,
      distanceKm: 0,
      bearingDeg: 0,
      color: '#588157',
      radius: 20,
      isUserNode: true,
      x: dimensions.width / 2,
      y: dimensions.height / 2,
      resource: {
        id: 'res_user_self',
        ownerId: userId,
        ownerCallsign: userCallsign,
        title: `${userCallsign} • Sovereign Mesh Node`,
        description: user?.bio || 'Active sovereign node broadcasting off-grid telemetry.',
        category: 'Care' as ResourceCategory,
        distanceKm: 0,
        createdAt: Date.now(),
        isActive: true,
        availabilityText: 'Local terminal',
        avatarSeed: 'user-root',
      },
    });

    // 2. Map resource nodes
    resources.forEach((res, index) => {
      // Find matching owner peer if available
      const ownerPeer = peers.find((p) => p.callsign === res.ownerCallsign);

      // Determine angle / bearing
      let bearing = 0;
      if (res.coordinates?.x !== undefined && res.coordinates?.y !== undefined) {
        bearing = (Math.atan2(res.coordinates.y, res.coordinates.x) * 180) / Math.PI;
      } else if (ownerPeer && ownerPeer.angle !== undefined) {
        // Add subtle angular dispersion so multiple resources from same peer fan out
        const fanOffset = (index % 5) * 12 - 24;
        bearing = (ownerPeer.angle + fanOffset + 360) % 360;
      } else {
        // Deterministic angle based on resource id
        const hash = res.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        bearing = (hash * 37) % 360;
      }

      const dist = res.distanceKm > 0 ? res.distanceKm : 0.4 + (index % 4) * 0.35;
      const color = CATEGORY_COLORS[res.category] || '#588157';

      nodes.push({
        id: res.id,
        resource: res,
        title: res.title,
        category: res.category,
        ownerCallsign: res.ownerCallsign,
        distanceKm: dist,
        bearingDeg: bearing,
        color,
        radius: 16,
        peer: ownerPeer,
      });
    });

    return nodes;
  }, [resources, peers, user, dimensions.width, dimensions.height]);

  // Filter nodes based on UI controls
  const filteredNodes = useMemo(() => {
    return processedNodes.filter((node) => {
      if (node.isUserNode) return true;

      // Category filter
      if (selectedCategory !== 'ALL' && node.category !== selectedCategory) {
        return false;
      }

      // Distance filter
      if (distanceFilter === '500m' && node.distanceKm > 0.5) return false;
      if (distanceFilter === '1.5km' && node.distanceKm > 1.5) return false;
      if (distanceFilter === '5km' && node.distanceKm > 5.0) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = node.title.toLowerCase().includes(q);
        const matchesOwner = node.ownerCallsign.toLowerCase().includes(q);
        const matchesCategory = node.category.toLowerCase().includes(q);
        const matchesDesc = node.resource.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOwner && !matchesCategory && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [processedNodes, selectedCategory, distanceFilter, searchQuery]);

  // Handle Node Click / Tap
  const handleSelectNode = useCallback(
    (node: ResourceGraphNode) => {
      soundFeedback.playClick();
      if (navigator.vibrate) navigator.vibrate(15);
      setSelectedNode(node);

      // Smoothly pan & zoom to the tapped node
      if (svgRef.current && zoomBehaviorRef.current && node.x !== undefined && node.y !== undefined) {
        const svg = d3.select(svgRef.current);
        const targetZoom = 1.6;
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;

        const transform = d3.zoomIdentity
          .translate(centerX - node.x * targetZoom, centerY - node.y * targetZoom)
          .scale(targetZoom);

        svg.transition().duration(600).ease(d3.easeCubicOut).call(zoomBehaviorRef.current.transform, transform);
      }
    },
    [dimensions.width, dimensions.height]
  );

  // Zoom to Fit / Recenter on User
  const handleRecenter = useCallback(() => {
    soundFeedback.playClick();
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    setSelectedNode(null);
  }, []);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.35);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.74);
  };

  // Primary D3 Render Effect
  useEffect(() => {
    if (!svgRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // SVG Defs for Gradients & Filters
    const defs = svg.append('defs');

    // Glow Filter
    const filter = defs.append('filter').attr('id', 'd3-resource-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Root Group with Zoom Support
    const g = svg.append('g').attr('class', 'd3-map-root');

    // Attach Zoom Behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Click background to deselect
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        setSelectedNode(null);
      }
    });

    // 1. BACKGROUND GRID & RADAR LAYERS
    const radarGroup = g.append('g').attr('class', 'radar-layer');

    // Calculate maximum radius for distance mapping
    const maxRadius = Math.min(width, height) * 0.44;
    const distanceScale = d3.scaleSqrt().domain([0, 5.0]).range([0, maxRadius]);

    if (projectionMode === 'spatial_radar') {
      // Distance Intervals: 250m, 500m, 1km, 2km, 5km
      const distanceRings = [0.25, 0.5, 1.0, 2.0, 5.0];

      // Concentric Distance Circles
      distanceRings.forEach((km) => {
        const r = distanceScale(km);
        radarGroup
          .append('circle')
          .attr('cx', centerX)
          .attr('cy', centerY)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', isNightMode ? '#2A3D25' : '#87A878')
          .attr('stroke-opacity', isNightMode ? 0.35 : 0.28)
          .attr('stroke-width', km === 1.0 || km === 5.0 ? 1.5 : 1)
          .attr('stroke-dasharray', km === 0.25 ? '3 3' : 'none');

        // Distance Label on Ring
        radarGroup
          .append('text')
          .attr('x', centerX + r + 4)
          .attr('y', centerY - 4)
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .attr('fill', isNightMode ? '#6B8765' : '#588157')
          .attr('opacity', 0.8)
          .text(km < 1.0 ? `${km * 1000}m` : `${km}km`);
      });

      // Cardinal Axis Lines & Compass Directions
      const cardinalRays = [
        { angle: 0, label: 'E' },
        { angle: 90, label: 'S' },
        { angle: 180, label: 'W' },
        { angle: 270, label: 'N' },
      ];

      cardinalRays.forEach(({ angle, label }) => {
        const rad = (angle * Math.PI) / 180;
        const x2 = centerX + Math.cos(rad) * (maxRadius + 24);
        const y2 = centerY + Math.sin(rad) * (maxRadius + 24);

        radarGroup
          .append('line')
          .attr('x1', centerX)
          .attr('y1', centerY)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', isNightMode ? '#2A3D25' : '#87A878')
          .attr('stroke-opacity', 0.25)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2 4');

        radarGroup
          .append('text')
          .attr('x', x2 + Math.cos(rad) * 12)
          .attr('y', y2 + Math.sin(rad) * 12 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .attr('fill', isNightMode ? '#E9C46A' : '#9C6644')
          .text(label);
      });
    }

    // LORA BRIDGE EFFECTIVE TRANSMISSION CIRCULAR RANGE OVERLAY
    if (loraConfig.showOverlay) {
      const loraGroup = g.append('g').attr('class', 'lora-range-layer');

      const loraRadiusPx =
        projectionMode === 'spatial_radar'
          ? estimatedLoRaRangeKm <= 5.0
            ? distanceScale(estimatedLoRaRangeKm)
            : distanceScale(5.0) * Math.sqrt(estimatedLoRaRangeKm / 5.0)
          : maxRadius * (Math.min(estimatedLoRaRangeKm, 7.5) / 3.8);

      // Radial gradient for LoRa RF field
      const loraGrad = defs
        .append('radialGradient')
        .attr('id', 'lora-field-grad')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');

      loraGrad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#33ff00')
        .attr('stop-opacity', isNightMode ? 0.16 : 0.12);

      loraGrad
        .append('stop')
        .attr('offset', '65%')
        .attr('stop-color', '#588157')
        .attr('stop-opacity', isNightMode ? 0.07 : 0.05);

      loraGrad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#33ff00')
        .attr('stop-opacity', isNightMode ? 0.02 : 0.01);

      // Concentric expanding RF wavefront ripple
      const ripple = loraGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', loraRadiusPx * 0.3)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.4)
        .attr('stroke-dasharray', '3 3');

      ripple
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', `${loraRadiusPx * 0.2};${loraRadiusPx}`)
        .attr('dur', '4.5s')
        .attr('repeatCount', 'indefinite');

      ripple
        .append('animate')
        .attr('attributeName', 'stroke-opacity')
        .attr('values', '0.5;0')
        .attr('dur', '4.5s')
        .attr('repeatCount', 'indefinite');

      // Main circular range boundary
      loraGroup
        .append('circle')
        .attr('class', 'lora-range-boundary')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', loraRadiusPx)
        .attr('fill', 'url(#lora-field-grad)')
        .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '7 4')
        .attr('stroke-opacity', 0.75)
        .attr('filter', 'url(#d3-resource-glow)');

      // Circular Range Perimeter Label Tag
      const tagG = loraGroup
        .append('g')
        .attr('transform', `translate(${centerX}, ${centerY - loraRadiusPx})`);

      const tagText = `📡 LoRa SX1262 Bridge: ${estimatedLoRaRangeKm} km radius (${loraConfig.environment.replace('_', ' ')})`;
      const tagW = tagText.length * 6.4 + 20;

      tagG
        .append('rect')
        .attr('x', -tagW / 2)
        .attr('y', -11)
        .attr('width', tagW)
        .attr('height', 20)
        .attr('rx', 10)
        .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
        .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.85);

      tagG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 3)
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('fill', isNightMode ? '#33ff00' : '#203A2A')
        .text(tagText);
    }

    // 2. POSITION NODES ACCORDING TO PROJECTION MODE
    if (projectionMode === 'spatial_radar') {
      filteredNodes.forEach((node) => {
        if (node.isUserNode) {
          node.x = centerX;
          node.y = centerY;
        } else {
          const r = distanceScale(node.distanceKm);
          const rad = ((node.bearingDeg - 90) * Math.PI) / 180; // 0 deg is North
          node.x = centerX + Math.cos(rad) * r;
          node.y = centerY + Math.sin(rad) * r;
        }
      });
    }

    // 3. FORCE SIMULATION (WHEN IN FORCE CONSTELLATION MODE)
    let simulation: d3.Simulation<ResourceGraphNode, undefined> | null = null;
    if (projectionMode === 'force_constellation') {
      simulation = d3
        .forceSimulation(filteredNodes)
        .force('center', d3.forceCenter(centerX, centerY))
        .force('charge', d3.forceManyBody().strength(-180))
        .force('collision', d3.forceCollide<ResourceGraphNode>().radius((d) => d.radius + 18))
        .alphaDecay(0.04);
    }

    // 4. LINKS / MUTUAL AID VECTORS (Link user to resources)
    const linkGroup = g.append('g').attr('class', 'links-layer');
    const userNode = filteredNodes.find((n) => n.isUserNode);

    if (userNode) {
      filteredNodes.forEach((node) => {
        if (node.isUserNode) return;
        linkGroup
          .append('line')
          .attr('class', `resource-link-${node.id}`)
          .attr('x1', userNode.x || centerX)
          .attr('y1', userNode.y || centerY)
          .attr('x2', node.x || centerX)
          .attr('y2', node.y || centerY)
          .attr('stroke', node.color)
          .attr('stroke-opacity', 0.18)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2 4');
      });
    }

    // 5. RENDER RESOURCE NODES
    const nodeGroup = g.append('g').attr('class', 'nodes-layer');

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, ResourceGraphNode>('g.resource-node')
      .data(filteredNodes, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', (d) => `resource-node cursor-pointer transition-transform duration-150`)
      .attr('transform', (d) => `translate(${d.x || centerX}, ${d.y || centerY})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        handleSelectNode(d);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget).select('.node-circle').attr('stroke-width', 3).attr('stroke', '#E9C46A');
      })
      .on('mouseleave', (event, d) => {
        setHoveredNode(null);
        d3.select(event.currentTarget)
          .select('.node-circle')
          .attr('stroke-width', d.id === selectedNode?.id ? 3 : 1.5)
          .attr('stroke', d.id === selectedNode?.id ? '#E9C46A' : isNightMode ? '#364E30' : '#FFFFFF');
      });

    // Outer Glow / Selection Ring
    nodeSelection
      .append('circle')
      .attr('class', 'selection-ring')
      .attr('r', (d) => (d.isUserNode ? 28 : d.radius + 6))
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.id === selectedNode?.id ? '#E9C46A' : d.color))
      .attr('stroke-width', (d) => (d.id === selectedNode?.id ? 2.5 : 1))
      .attr('stroke-opacity', (d) => (d.id === selectedNode?.id ? 0.9 : 0.25))
      .attr('stroke-dasharray', (d) => (d.id === selectedNode?.id ? '4 2' : 'none'));

    // Main Node Circle
    nodeSelection
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => (d.isUserNode ? 20 : d.radius))
      .attr('fill', (d) => (d.isUserNode ? '#203A2A' : d.color))
      .attr('stroke', (d) => (d.id === selectedNode?.id ? '#E9C46A' : isNightMode ? '#364E30' : '#FFFFFF'))
      .attr('stroke-width', (d) => (d.id === selectedNode?.id ? 3 : 2))
      .attr('filter', 'url(#d3-resource-glow)');

    // Inner Glyph / Symbol
    nodeSelection.each(function (d) {
      const el = d3.select(this);

      if (d.isUserNode) {
        // GPS Compass icon in user node
        el.append('circle').attr('r', 5).attr('fill', '#E9C46A');
      } else {
        // Initial letter of category
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', '11px')
          .attr('font-family', 'sans-serif')
          .attr('font-weight', 'bold')
          .attr('fill', '#FFFFFF')
          .text(d.category.charAt(0).toUpperCase());
      }
    });

    // Distance Label Pill directly beneath each node (The Core Requirement!)
    const labelGroup = nodeSelection
      .append('g')
      .attr('class', 'distance-pill')
      .attr('transform', (d) => `translate(0, ${d.radius + 14})`);

    // Pill background
    labelGroup
      .append('rect')
      .attr('x', -24)
      .attr('y', -8)
      .attr('width', 48)
      .attr('height', 16)
      .attr('rx', 8)
      .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
      .attr('stroke', isNightMode ? '#2A3D25' : '#87A878')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5)
      .attr('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))');

    // Pill distance text (e.g. "320m", "1.2km")
    labelGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', isNightMode ? '#A8BDA5' : '#203A2A')
      .text((d) => (d.isUserNode ? 'YOU' : d.distanceKm < 1 ? `${Math.round(d.distanceKm * 1000)}m` : `${d.distanceKm.toFixed(1)}km`));

    // Force Simulation Tick Update (if in force constellation mode)
    if (simulation) {
      simulation.on('tick', () => {
        nodeSelection.attr('transform', (d) => `translate(${d.x || centerX}, ${d.y || centerY})`);

        if (userNode) {
          filteredNodes.forEach((node) => {
            if (node.isUserNode) return;
            linkGroup
              .select(`.resource-link-${node.id}`)
              .attr('x1', userNode.x || centerX)
              .attr('y1', userNode.y || centerY)
              .attr('x2', node.x || centerX)
              .attr('y2', node.y || centerY);
          });
        }
      });
    }

    return () => {
      if (simulation) simulation.stop();
    };
  }, [
    dimensions,
    filteredNodes,
    projectionMode,
    isNightMode,
    selectedNode?.id,
    handleSelectNode,
    loraConfig,
    estimatedLoRaRangeKm,
  ]);

  // Quick categories list
  const categoryFilters = [
    { id: 'ALL', label: 'All Resources' },
    { id: 'Food', label: '🌱 Food', color: '#588157' },
    { id: 'Energy', label: '⚡ Energy', color: '#E9C46A' },
    { id: 'Tools', label: '🔨 Tools', color: '#457B9D' },
    { id: 'Skills', label: '🎓 Skills', color: '#9C6644' },
    { id: 'Care', label: '❤️ Care', color: '#E76F51' },
    { id: 'Bio-Remedy', label: '🌿 Bio-Remedy', color: '#2A9D8F' },
  ];

  return (
    <div
      ref={containerRef}
      id="d3-community-resource-map-container"
      className={`relative w-full h-full overflow-hidden select-none flex flex-col ${
        isNightMode ? 'bg-[#0E150C] text-[#F0F5EE]' : 'bg-[#FAF6EE] text-[#203A2A]'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search & Category Filter */}
        <div className="pointer-events-auto flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#637062] dark:text-[#A8BDA5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resource nodes, tools, food..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border shadow-sm focus:outline-hidden transition-all ${
                isNightMode
                  ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#F0F5EE] focus:border-[#588157]'
                  : 'bg-white/95 border-[#87A878]/30 text-[#203A2A] focus:border-[#588157]'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[#637062] hover:text-[#203A2A] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Distance Filter Selector */}
          <select
            value={distanceFilter}
            onChange={(e) => setDistanceFilter(e.target.value as DistanceFilter)}
            className={`px-2.5 py-1.5 rounded-xl text-xs border shadow-sm font-semibold focus:outline-hidden cursor-pointer ${
              isNightMode
                ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/30 text-[#203A2A]'
            }`}
          >
            <option value="all">Radius: All</option>
            <option value="500m">&lt; 500m (Walk)</option>
            <option value="1.5km">&lt; 1.5km (Local)</option>
            <option value="5km">&lt; 5km (Bioregion)</option>
          </select>
        </div>

        {/* Projection Mode Toggle (Spatial Radar vs Constellation) */}
        <div className="pointer-events-auto flex items-center gap-1.5 self-end sm:self-auto shrink-0 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-[#87A878]/20 backdrop-blur-xs">
          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setProjectionMode('spatial_radar');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              projectionMode === 'spatial_radar'
                ? 'bg-[#203A2A] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Spatial Radar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setProjectionMode('force_constellation');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              projectionMode === 'force_constellation'
                ? 'bg-[#203A2A] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Constellation</span>
          </button>
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="absolute top-16 left-3 right-3 z-15 pointer-events-none flex items-center gap-1.5 overflow-x-auto pb-1">
        <div className="pointer-events-auto flex items-center gap-1.5">
          {categoryFilters.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                setSelectedCategory(cat.id);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap border shadow-2xs transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#588157] text-white border-[#588157] font-bold'
                  : isNightMode
                  ? 'bg-[#141F12]/80 text-[#A8BDA5] border-[#2A3B26] hover:text-white'
                  : 'bg-white/90 text-[#637062] border-[#87A878]/30 hover:text-[#203A2A]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating LoRa Bridge Transmission Distance Range Control (Left Side) */}
      <div className="absolute top-26 left-3 z-20 max-w-xs pointer-events-auto">
        <LoRaBridgeRangeHUD
          config={loraConfig}
          onChangeConfig={setLoraConfig}
          isNightMode={isNightMode}
          coveredResourcesCount={coveredResourcesCount}
          coveredPeersCount={coveredPeersCount}
        />
      </div>

      {/* Floating Zoom & Recenter Controls (Right Side) */}
      <div className="absolute right-4 top-32 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          className={`w-9 h-9 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
              : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
          }`}
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className={`w-9 h-9 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
              : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
          }`}
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleRecenter}
          className={`w-9 h-9 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#E9C46A] hover:bg-[#1C2C19]'
              : 'bg-white border-[#87A878]/30 text-[#8C6207] hover:bg-[#FAF6EE]'
          }`}
          title="Recenter on My Location"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Interactive D3 Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* INTERACTIVE BOTTOM SHEET / DETAIL CARD UPON NODE TAP (The Core Requirement!) */}
      {selectedNode && (
        <div
          id="d3-resource-tapped-detail-card"
          className="absolute bottom-4 left-4 right-4 max-w-xl mx-auto z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div
            className={`rounded-3xl border shadow-2xl p-4 sm:p-5 backdrop-blur-md transition-colors ${
              isNightMode
                ? 'bg-[#141F12]/95 border-[#364E30] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            {/* Header: Category Badge, Distance & Close */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold text-white shadow-2xs"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {selectedNode.category.toUpperCase()}
                </span>

                {/* Distance Highlight (Key Requirement!) */}
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] border border-[#E9C46A]/40 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedNode.isUserNode
                    ? 'Center Location'
                    : selectedNode.distanceKm < 1
                    ? `${Math.round(selectedNode.distanceKm * 1000)} m away`
                    : `${selectedNode.distanceKm.toFixed(2)} km away`}
                </span>

                {!selectedNode.isUserNode && (
                  <span className="text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
                    <Compass className="w-3 h-3" />
                    Bearing {Math.round(selectedNode.bearingDeg)}°
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors"
                title="Close detail card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resource Title & Walking Estimate */}
            <div className="mb-2">
              <h3 className="font-display font-bold text-base sm:text-lg leading-snug">
                {selectedNode.title}
              </h3>
              {!selectedNode.isUserNode && (
                <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-2 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#2A9D8F]" />
                    ~{Math.max(1, Math.round(selectedNode.distanceKm * 13))} min walk (at 4.5 km/h)
                  </span>
                  <span>•</span>
                  <span>Off-grid mesh verified</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed mb-3 line-clamp-2">
              {selectedNode.resource.description}
            </p>

            {/* Provider & Action Row */}
            <div
              className={`pt-3 border-t flex flex-wrap items-center justify-between gap-3 ${
                isNightMode ? 'border-[#2A3B26]' : 'border-[#87A878]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#588157]/20 border border-[#588157]/30 flex items-center justify-center font-bold text-xs text-[#588157] dark:text-[#87A878]">
                  {selectedNode.ownerCallsign.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>{selectedNode.ownerCallsign}</span>
                    {selectedNode.isUserNode ? (
                      <span className="text-[9px] bg-[#588157] text-white px-1.5 py-0.2 rounded-full">
                        You
                      </span>
                    ) : (
                      selectedNode.peer && (
                        <PeerTrustScoreIndicator
                          completedExchanges={selectedNode.peer.completedExchanges}
                          endorsementsCount={selectedNode.peer.endorsementsCount}
                          peerId={selectedNode.peer.id}
                          callsign={selectedNode.peer.callsign}
                          isNightMode={isNightMode}
                          size="xs"
                        />
                      )
                    )}
                  </div>
                  <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                    {selectedNode.resource.availabilityText || 'Available for community trade'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!selectedNode.isUserNode && (
                  <>
                    {onOpenChatWithPeer && selectedNode.peer && (
                      <button
                        type="button"
                        onClick={() => onOpenChatWithPeer(selectedNode.peer!)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          isNightMode
                            ? 'bg-[#182315] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                            : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
                        }`}
                        title={`Message ${selectedNode.ownerCallsign} via Mesh`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onViewResourceDetails(selectedNode.resource)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <span>View & Trade</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend & Stats Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden md:flex items-center gap-2 text-[10px] font-mono opacity-80">
        <span className="bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-xl backdrop-blur-xs">
          Showing {filteredNodes.length - 1} Community Resource Nodes
        </span>
        <span className="bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-xl backdrop-blur-xs">
          Tap any node to inspect distance & details
        </span>
      </div>
    </div>
  );
};
