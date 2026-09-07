import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { MeshNode } from '../types';
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
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Layers,
  Sparkles,
  MessageSquare,
  Award,
  ChevronRight,
  HelpCircle,
  Activity,
  Play,
  Pause,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface MeshRssiGraphD3Props {
  peers: MeshNode[];
  userCallsign?: string;
  selectedPeerId?: string | null;
  onSelectPeer?: (peer: MeshNode) => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
  onOpenReputation?: (peer: MeshNode) => void;
  isNightMode?: boolean;
  isSolarAware?: boolean;
}

// Internal node type for D3 force simulation
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  isUser: boolean;
  callsign: string;
  rssi?: number;
  hopDistance: number;
  trustScore: number;
  relayReliability?: number;
  radioType?: string;
  peerData?: MeshNode;
  radius: number;
}

// Internal link type for D3 force simulation
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  rssi: number;
  quality: number; // 0 to 100
  hopDistance: number;
  isRelayLink?: boolean;
}

// Signal Quality calculation from RSSI dBm (-100 dBm to -30 dBm)
export function calculateSignalQuality(rssi: number): number {
  if (rssi >= -50) return 100;
  if (rssi <= -100) return 5;
  // Linear scale: -100 dBm -> 5%, -50 dBm -> 100%
  return Math.round(5 + ((rssi + 100) / 50) * 95);
}

// Get Solarpunk signal color based on RSSI
export function getSignalColor(rssi: number, isNightMode: boolean = false): {
  stroke: string;
  bg: string;
  label: string;
  glow: string;
} {
  if (rssi >= -60) {
    // Strong / Excellent
    return {
      stroke: isNightMode ? '#588157' : '#2A9D8F',
      bg: isNightMode ? '#1F3323' : '#E6F4F1',
      label: 'Excellent',
      glow: '#2A9D8F',
    };
  } else if (rssi >= -75) {
    // Moderate / Good
    return {
      stroke: '#E9C46A',
      bg: isNightMode ? '#2B2713' : '#FEF8EB',
      label: 'Good',
      glow: '#E9C46A',
    };
  } else if (rssi >= -88) {
    // Fair / Low
    return {
      stroke: '#F4A261',
      bg: isNightMode ? '#332317' : '#FDF3EB',
      label: 'Fair',
      glow: '#F4A261',
    };
  } else {
    // Weak / Fringe
    return {
      stroke: '#E76F51',
      bg: isNightMode ? '#331B19' : '#FDEEE9',
      label: 'Fringe',
      glow: '#E76F51',
    };
  }
}

export const MeshRssiGraphD3: React.FC<MeshRssiGraphD3Props> = ({
  peers = [],
  userCallsign = 'My Station (Local)',
  selectedPeerId = null,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  isNightMode = false,
  isSolarAware = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // UI state
  const [hoveredPeer, setHoveredPeer] = useState<MeshNode | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'strong' | 'direct' | 'relayed'>('all');
  const [showRssiLabels, setShowRssiLabels] = useState<boolean>(true);
  const [isPhysicsActive, setIsPhysicsActive] = useState<boolean>(true);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 420,
  });

  // Filter peers based on chosen topology filter
  const filteredPeers = useMemo(() => {
    return peers.filter((peer) => {
      if (filterMode === 'strong') return (peer.lastRssi || -90) >= -68;
      if (filterMode === 'direct') return (peer.hopDistance || 1) === 1;
      if (filterMode === 'relayed') return (peer.hopDistance || 1) > 1;
      return true;
    });
  }, [peers, filterMode]);

  // Aggregate signal metrics
  const stats = useMemo(() => {
    if (peers.length === 0) {
      return { avgRssi: -75, strongCount: 0, moderateCount: 0, weakCount: 0, bestPeer: null };
    }
    const totalRssi = peers.reduce((acc, p) => acc + (p.lastRssi || -80), 0);
    const avgRssi = Math.round(totalRssi / peers.length);
    let strong = 0;
    let mod = 0;
    let weak = 0;
    let best: MeshNode | null = null;
    let maxRssi = -999;

    peers.forEach((p) => {
      const r = p.lastRssi || -85;
      if (r > maxRssi) {
        maxRssi = r;
        best = p;
      }
      if (r >= -65) strong++;
      else if (r >= -80) mod++;
      else weak++;
    });

    return {
      avgRssi,
      strongCount: strong,
      moderateCount: mod,
      weakCount: weak,
      bestPeer: best,
    };
  }, [peers]);

  // Resize observer to ensure responsive graph
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          // Responsive aspect ratio
          const height = Math.max(380, Math.min(520, Math.round(width * 0.62)));
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean container

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // Define defs (glow filters, gradients, arrowheads)
    const defs = svg.append('defs');

    // Glow filter for user node & strong signal links
    const filter = defs.append('filter').attr('id', 'rssi-glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Radial Gradients for nodes
    const userGradient = defs.append('radialGradient').attr('id', 'userNodeGrad').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    userGradient.append('stop').attr('offset', '0%').attr('stop-color', '#588157');
    userGradient.append('stop').attr('offset', '100%').attr('stop-color', '#203A2A');

    const peerGradientStrong = defs.append('radialGradient').attr('id', 'peerGradStrong').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    peerGradientStrong.append('stop').attr('offset', '0%').attr('stop-color', '#87A878');
    peerGradientStrong.append('stop').attr('offset', '100%').attr('stop-color', '#2A9D8F');

    // Build Graph Data
    const userNode: GraphNode = {
      id: 'local-user-node',
      isUser: true,
      callsign: userCallsign,
      hopDistance: 0,
      trustScore: 100,
      radius: 26,
      fx: centerX,
      fy: centerY,
    };

    const peerNodes: GraphNode[] = filteredPeers.map((p) => ({
      id: p.id,
      isUser: false,
      callsign: p.callsign,
      rssi: p.lastRssi ?? -75,
      hopDistance: p.hopDistance ?? 1,
      trustScore: p.trustScore ?? 80,
      relayReliability: p.relayReliability ?? 98,
      radioType: p.radioType ?? 'BLE',
      peerData: p,
      radius: Math.max(16, Math.min(22, 14 + (p.trustScore || 70) / 12)),
    }));

    const nodes: GraphNode[] = [userNode, ...peerNodes];

    // Primary Links: from local user to each discovered peer
    const links: GraphLink[] = peerNodes.map((pNode) => {
      const rssi = pNode.rssi ?? -75;
      return {
        source: userNode.id,
        target: pNode.id,
        rssi,
        quality: calculateSignalQuality(rssi),
        hopDistance: pNode.hopDistance,
        isRelayLink: false,
      };
    });

    // Secondary Peer-to-Peer Interconnection links for multi-hop mesh fidelity
    // Connect peers that are close in signal or relay neighbors
    if (peerNodes.length > 1) {
      for (let i = 0; i < peerNodes.length; i++) {
        for (let j = i + 1; j < peerNodes.length; j++) {
          const p1 = peerNodes[i];
          const p2 = peerNodes[j];
          // Connect if one is relaying for another or both are high hopDistance
          if ((p1.hopDistance > 1 || p2.hopDistance > 1) && Math.abs((p1.rssi || 0) - (p2.rssi || 0)) < 22) {
            const simulatedMeshRssi = Math.round(((p1.rssi || -75) + (p2.rssi || -75)) / 2 - 8);
            links.push({
              source: p1.id,
              target: p2.id,
              rssi: simulatedMeshRssi,
              quality: calculateSignalQuality(simulatedMeshRssi),
              hopDistance: Math.max(p1.hopDistance, p2.hopDistance),
              isRelayLink: true,
            });
          }
        }
      }
    }

    // Root Group for Zooming & Panning
    const g = svg.append('g').attr('class', 'mesh-graph-viewport');

    // Zoom Behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomTransform(event.transform);
      });

    svg.call(zoom);

    // Draw Background Concentric Distance/RSSI Rings (Polar Range Rings)
    const ringsGroup = g.append('g').attr('class', 'rssi-polar-rings');
    const ringRadii = [
      { r: 85, rssi: '-45 dBm', label: 'Close Proximity (High SNR)' },
      { r: 160, rssi: '-65 dBm', label: 'Mid Reach (BLE Direct)' },
      { r: 240, rssi: '-85 dBm', label: 'Fringe Reach (Relay Hop)' },
    ];

    ringRadii.forEach(({ r, rssi, label }) => {
      // Ring circle
      ringsGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#364E30' : '#87A878')
        .attr('stroke-opacity', isNightMode ? 0.25 : 0.28)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4, 4');

      // Ring label
      ringsGroup
        .append('text')
        .attr('x', centerX + 8)
        .attr('y', centerY - r + 13)
        .attr('fill', isNightMode ? '#A8BDA5' : '#637062')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('opacity', 0.6)
        .text(`${rssi} • ${label}`);
    });

    // Links Group
    const linkGroup = g.append('g').attr('class', 'links-layer');

    // Draw Link Lines
    const linkElements = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        const color = getSignalColor(d.rssi, isNightMode);
        return color.stroke;
      })
      .attr('stroke-width', (d) => {
        if (d.isRelayLink) return 1.5;
        // Stronger RSSI = thicker stroke (1.5px to 4px)
        return Math.max(1.5, Math.min(4.5, 1.2 + (d.quality / 100) * 3.3));
      })
      .attr('stroke-opacity', (d) => (d.isRelayLink ? 0.45 : isNightMode ? 0.85 : 0.75))
      .attr('stroke-dasharray', (d) => {
        if (d.isRelayLink) return '3, 4';
        if (d.rssi < -78) return '4, 4';
        return 'none';
      });

    // Link Text Labels (Real-time RSSI readout along the middle of the wire)
    const linkLabelGroup = g.append('g').attr('class', 'link-labels-layer');
    const linkLabels = linkLabelGroup
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(links.filter((d) => !d.isRelayLink))
      .join('text')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .attr('fill', (d) => getSignalColor(d.rssi, isNightMode).stroke)
      .attr('opacity', showRssiLabels ? 0.9 : 0)
      .text((d) => `${d.rssi} dBm (${d.quality}%)`);

    // Nodes Group
    const nodeGroup = g.append('g').attr('class', 'nodes-layer');

    // Outer Node Elements container
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', (d) => `node-item ${d.isUser ? 'user-node' : 'peer-node'}`)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        soundFeedback.playClick();
        if (!d.isUser && d.peerData && onSelectPeer) {
          onSelectPeer(d.peerData);
        }
      })
      .on('mouseenter', (event, d) => {
        if (!d.isUser && d.peerData) {
          setHoveredPeer(d.peerData);
        }
      })
      .on('mouseleave', () => {
        setHoveredPeer(null);
      });

    // 1. User Central Node Pulse Glow
    nodeElements
      .filter((d) => d.isUser)
      .append('circle')
      .attr('r', 38)
      .attr('fill', 'none')
      .attr('stroke', '#588157')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '5, 3')
      .attr('class', isSolarAware ? '' : 'animate-spin')
      .style('animation-duration', '16s');

    // 2. Node Circles (Background filled)
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => {
        if (d.isUser) return 'url(#userNodeGrad)';
        const c = getSignalColor(d.rssi ?? -75, isNightMode);
        return isNightMode ? '#182315' : '#FAF6EE';
      })
      .attr('stroke', (d) => {
        if (d.isUser) return '#E9C46A';
        const isSelected = selectedPeerId === d.id;
        if (isSelected) return '#E9C46A';
        return getSignalColor(d.rssi ?? -75, isNightMode).stroke;
      })
      .attr('stroke-width', (d) => {
        if (d.isUser) return 3;
        if (selectedPeerId === d.id) return 3.5;
        return 2;
      })
      .attr('filter', (d) => (d.isUser || (d.rssi ?? -80) >= -60 ? 'url(#rssi-glow)' : 'none'));

    // 3. Node Icon/Glyph inside circle
    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', (d) => (d.isUser ? '14px' : '10px'))
      .attr('font-weight', 'bold')
      .attr('fill', (d) => {
        if (d.isUser) return '#E9C46A';
        return getSignalColor(d.rssi ?? -75, isNightMode).stroke;
      })
      .text((d) => {
        if (d.isUser) return '☵'; // Solarpunk station trigram
        return `${d.rssi ?? -75}`;
      });

    // 4. Callsign Label below node
    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.radius + 14)
      .attr('font-size', (d) => (d.isUser ? '11px' : '10px'))
      .attr('font-weight', (d) => (d.isUser ? 'bold' : '600'))
      .attr('fill', (d) => {
        if (d.isUser) return isNightMode ? '#E9C46A' : '#203A2A';
        if (selectedPeerId === d.id) return '#E9C46A';
        return isNightMode ? '#F0F5EE' : '#203A2A';
      })
      .text((d) => d.callsign);

    // 5. Hop / Protocol mini tag below callsign
    nodeElements
      .filter((d) => !d.isUser)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.radius + 26)
      .attr('font-size', '8.5px')
      .attr('font-family', 'monospace')
      .attr('fill', isNightMode ? '#A8BDA5' : '#637062')
      .text((d) => `${d.hopDistance} hop • ${d.radioType || 'BLE'}`);

    // Drag behavior for nodes
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active && simulationRef.current && isPhysicsActive) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && simulationRef.current && isPhysicsActive) {
          simulationRef.current.alphaTarget(0);
        }
        // Don't unpin the user central node; peers can remain fixed or free
        if (!d.isUser && !isPhysicsActive) {
          d.fx = event.x;
          d.fy = event.y;
        } else if (!d.isUser) {
          d.fx = null;
          d.fy = null;
        }
      });

    nodeElements.call(drag);

    // D3 Force Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.isRelayLink) return 130;
            // Map RSSI (-40 dBm -> 75px, -95 dBm -> 250px)
            const clampedRssi = Math.max(-98, Math.min(-38, d.rssi));
            const norm = (clampedRssi - -38) / (-98 - -38); // 0 (strong) to 1 (weak)
            return 75 + norm * 180;
          })
          .strength(0.8)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength((d) => (d.isUser ? -450 : -220)))
      .force('center', d3.forceCenter(centerX, centerY).strength(0.08))
      .force('collide', d3.forceCollide<GraphNode>().radius((d) => d.radius + 24).strength(0.9))
      .force(
        'radial',
        d3.forceRadial<GraphNode>(
          (d) => {
            if (d.isUser) return 0;
            const r = d.rssi ?? -75;
            if (r >= -60) return 90;
            if (r >= -75) return 165;
            return 235;
          },
          centerX,
          centerY
        ).strength(0.7)
      )
      .alphaDecay(0.028)
      .on('tick', () => {
        linkElements
          .attr('x1', (d) => ((d.source as GraphNode).x ?? centerX))
          .attr('y1', (d) => ((d.source as GraphNode).y ?? centerY))
          .attr('x2', (d) => ((d.target as GraphNode).x ?? centerX))
          .attr('y2', (d) => ((d.target as GraphNode).y ?? centerY));

        linkLabels
          .attr('x', (d) => (((d.source as GraphNode).x ?? centerX) + ((d.target as GraphNode).x ?? centerX)) / 2)
          .attr('y', (d) => (((d.source as GraphNode).y ?? centerY) + ((d.target as GraphNode).y ?? centerY)) / 2);

        nodeElements.attr('transform', (d) => `translate(${d.x ?? centerX},${d.y ?? centerY})`);
      });

    simulationRef.current = simulation;

    // Reset Zoom to center if needed
    svg.on('dblclick', () => {
      svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity);
    });

    return () => {
      simulation.stop();
    };
  }, [
    filteredPeers,
    userCallsign,
    selectedPeerId,
    dimensions,
    isNightMode,
    isSolarAware,
    showRssiLabels,
    isPhysicsActive,
    onSelectPeer,
  ]);

  // Reset Zoom handler
  const handleResetZoom = useCallback(() => {
    soundFeedback.playClick();
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  }, []);

  // Zoom In / Out handlers
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    soundFeedback.playClick();
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const factor = direction === 'in' ? 1.3 : 0.75;
    svg.transition().duration(300).call(d3.zoom<SVGSVGElement, unknown>().scaleBy, factor);
  }, []);

  // Toggle Physics
  const handleTogglePhysics = useCallback(() => {
    soundFeedback.playClick();
    setIsPhysicsActive((prev) => {
      const next = !prev;
      if (simulationRef.current) {
        if (next) {
          simulationRef.current.alpha(0.3).restart();
        } else {
          simulationRef.current.stop();
        }
      }
      return next;
    });
  }, []);

  return (
    <div
      id="mesh-rssi-graph-container"
      ref={containerRef}
      className={`relative w-full rounded-3xl border shadow-sm transition-all duration-200 overflow-hidden flex flex-col ${
        isNightMode ? 'bg-[#182315] border-[#364E30] text-[#FAF6EE]' : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
          isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-white/60'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#588157]/20 flex items-center justify-center text-[#588157] dark:text-[#E9C46A] shadow-xs">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm sm:text-base leading-tight">
                Mesh Signal Topology (D3.js)
              </h3>
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isNightMode
                    ? 'bg-[#2A3B26] text-[#E9C46A] border-[#364E30]'
                    : 'bg-[#588157]/15 text-[#203A2A] border-[#588157]/30'
                }`}
              >
                {filteredPeers.length} {filteredPeers.length === 1 ? 'Peer' : 'Peers'} Active
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
              Real-time RF link strength (RSSI dBm), proximity range & multi-hop paths.
            </p>
          </div>
        </div>

        {/* Filter Pills and Info Trigger */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center p-1 rounded-2xl border text-xs bg-black/5 dark:bg-white/5 border-current/10">
            {(
              [
                { id: 'all', label: 'All Signals' },
                { id: 'strong', label: 'Strong (>-68)' },
                { id: 'direct', label: '1-Hop' },
                { id: 'relayed', label: 'Relayed' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setFilterMode(f.id);
                }}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer text-[11px] ${
                  filterMode === f.id
                    ? isNightMode
                      ? 'bg-[#2A3B26] text-[#E9C46A] shadow-xs'
                      : 'bg-white text-[#203A2A] shadow-xs font-bold'
                    : isNightMode
                    ? 'text-[#A8BDA5] hover:text-white'
                    : 'text-[#637062] hover:text-[#203A2A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Info toggle */}
          <button
            type="button"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showInfoPanel
                ? 'bg-[#588157] text-white border-[#588157]'
                : isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:text-white'
                : 'bg-white text-[#637062] border-[#87A878]/30 hover:text-[#203A2A]'
            }`}
            title="Topology Legend & RF Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Legend Panel (Collapsible) */}
      {showInfoPanel && (
        <div
          className={`p-3.5 sm:p-4 text-xs border-b animate-in fade-in slide-in-from-top-2 duration-150 ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]' : 'bg-[#EDF2EB] border-[#87A878]/30 text-[#637062]'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2A9D8F] shadow-xs shrink-0" />
              <div>
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">Strong (&gt;-60 dBm)</span>: High bandwidth, ideal for file/image sync.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#E9C46A] shadow-xs shrink-0" />
              <div>
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">Good (-61 to -75 dBm)</span>: Robust packet relay & text chat.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#E76F51] shadow-xs shrink-0" />
              <div>
                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">Fringe (&lt;-76 dBm)</span>: High attenuation, use multi-hop relay.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Spectrum Metrics Strip */}
      <div
        className={`px-4 py-2 border-b grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono ${
          isNightMode ? 'border-[#2A3B26] bg-[#141E11]' : 'border-[#87A878]/20 bg-white/40'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5 text-[#588157]" />
          <span className="opacity-70">Avg RSSI:</span>
          <span className="font-bold">{stats.avgRssi} dBm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#2A9D8F]" />
          <span className="opacity-70">Optimal:</span>
          <span className="font-bold text-[#2A9D8F]">{stats.strongCount} Nodes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#E9C46A]" />
          <span className="opacity-70">Relay/Fringe:</span>
          <span className="font-bold text-[#E9C46A]">{stats.moderateCount + stats.weakCount} Nodes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-[#E9C46A]" />
          <span className="opacity-70">Best Link:</span>
          <span className="font-bold truncate max-w-[90px]">{stats.bestPeer?.callsign || 'N/A'}</span>
        </div>
      </div>

      {/* Main SVG Visualization Canvas Area */}
      <div className="relative flex-1 min-h-[380px] sm:min-h-[420px] bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 select-none">
        <svg
          id="mesh-rssi-d3-svg"
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        />

        {/* Floating Controls Overlay (Top Right of Graph) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            id="rssi-graph-zoom-in-btn"
            onClick={() => handleZoom('in')}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:text-white'
                : 'bg-white text-[#637062] border-[#87A878]/40 hover:text-[#203A2A]'
            }`}
            title="Zoom In"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="rssi-graph-zoom-out-btn"
            onClick={() => handleZoom('out')}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:text-white'
                : 'bg-white text-[#637062] border-[#87A878]/40 hover:text-[#203A2A]'
            }`}
            title="Zoom Out"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="rssi-graph-reset-zoom-btn"
            onClick={handleResetZoom}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30] hover:text-white'
                : 'bg-white text-[#637062] border-[#87A878]/40 hover:text-[#203A2A]'
            }`}
            title="Reset View (Double-click canvas)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="rssi-graph-physics-btn"
            onClick={handleTogglePhysics}
            className={`p-2 rounded-xl border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isPhysicsActive
                ? 'bg-[#588157] text-white border-[#588157]'
                : isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30]'
                : 'bg-white text-[#637062] border-[#87A878]/40'
            }`}
            title={isPhysicsActive ? 'Pause Graph Physics Simulation' : 'Resume Graph Physics Simulation'}
          >
            {isPhysicsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Bottom Left Quick View Toggle: Toggle dBm text labels */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
          <button
            type="button"
            id="rssi-toggle-labels-btn"
            onClick={() => {
              soundFeedback.playClick();
              setShowRssiLabels(!showRssiLabels);
            }}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 shadow-md backdrop-blur-xs transition-all cursor-pointer ${
              showRssiLabels
                ? isNightMode
                  ? 'bg-[#2A3B26] text-[#E9C46A] border-[#364E30]'
                  : 'bg-white text-[#203A2A] border-[#87A878]/50'
                : isNightMode
                ? 'bg-[#182315]/80 text-[#A8BDA5] border-[#364E30]'
                : 'bg-white/80 text-[#637062] border-[#87A878]/30'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showRssiLabels ? 'Labels: Visible' : 'Labels: Hidden'}</span>
          </button>
        </div>

        {/* Hovered Peer Detail Floating Card */}
        {hoveredPeer && (
          <div
            id="mesh-graph-hover-card"
            className={`absolute bottom-3 right-3 z-30 max-w-xs p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              isNightMode ? 'bg-[#182315]/95 border-[#364E30] text-[#FAF6EE]' : 'bg-white/95 border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-display font-bold text-xs truncate">{hoveredPeer.callsign}</span>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: getSignalColor(hoveredPeer.lastRssi || -75, isNightMode).bg,
                  color: getSignalColor(hoveredPeer.lastRssi || -75, isNightMode).stroke,
                }}
              >
                {hoveredPeer.lastRssi} dBm
              </span>
            </div>

            <p className={`text-[11px] line-clamp-2 mb-2 ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
              {hoveredPeer.bio || 'Direct mesh peer offering localized mutual aid.'}
            </p>

            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1.5 border-t border-current/10">
              <div>
                <span className="opacity-60">Quality: </span>
                <span className="font-bold">{calculateSignalQuality(hoveredPeer.lastRssi || -75)}%</span>
              </div>
              <div>
                <span className="opacity-60">Hop: </span>
                <span className="font-bold">{hoveredPeer.hopDistance || 1} Hop</span>
              </div>
              <div>
                <span className="opacity-60">Trust: </span>
                <span className="font-bold">{hoveredPeer.trustScore || 80}/100</span>
              </div>
              <div>
                <span className="opacity-60">Reliability: </span>
                <span className="font-bold">{hoveredPeer.relayReliability || 98}%</span>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="mt-2.5 flex items-center gap-1.5">
              {onOpenChatWithPeer && (
                <button
                  type="button"
                  onClick={() => {
                    soundFeedback.playClick();
                    onOpenChatWithPeer(hoveredPeer);
                  }}
                  className="flex-1 py-1 px-2 rounded-xl bg-[#588157] text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-[#466a45] transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Chat</span>
                </button>
              )}

              {onSelectPeer && (
                <button
                  type="button"
                  onClick={() => {
                    soundFeedback.playClick();
                    onSelectPeer(hoveredPeer);
                  }}
                  className={`py-1 px-2 rounded-xl border text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer ${
                    isNightMode
                      ? 'border-[#364E30] text-[#E9C46A] hover:bg-[#2A3B26]'
                      : 'border-[#87A878]/30 text-[#203A2A] hover:bg-[#FAF6EE]'
                  }`}
                >
                  <span>Details</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty State when no peers in filter */}
      {filteredPeers.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-black/5 dark:bg-black/40 backdrop-blur-xs">
          <SignalLow className="w-8 h-8 text-[#E76F51] mb-2" />
          <h4 className="font-display font-bold text-sm">No Peers Match Filter</h4>
          <p className={`text-xs mt-1 max-w-xs ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
            No mesh nodes currently meet the "{filterMode}" signal threshold. Switch back to "All Signals" to see the full network.
          </p>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="mt-3 px-3.5 py-1.5 rounded-2xl bg-[#588157] text-white text-xs font-bold hover:bg-[#466a45] cursor-pointer"
          >
            Show All Peers
          </button>
        </div>
      )}
    </div>
  );
};
