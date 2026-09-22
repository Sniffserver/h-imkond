import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { MeshNode, UserProfile } from '../../../types';
import { soundFeedback } from '../../../services/utils/soundFeedback';
import {
  Radio,
  Signal,
  Activity,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Zap,
  Sliders,
  X,
  Layers,
  Cpu,
  ArrowRight,
  Eye,
  Info,
  Route,
  Waypoints,
  GitFork,
} from 'lucide-react';

export interface D3MeshTopologyMapProps {
  peers: MeshNode[];
  user: UserProfile;
  onSelectPeer?: (peer: MeshNode) => void;
  onOpenChatWithPeer?: (peer: MeshNode) => void;
  onOpenReputation?: (peer: MeshNode) => void;
  isNightMode?: boolean;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export interface TopologyNode extends d3.SimulationNodeDatum {
  id: string;
  callsign: string;
  isUser: boolean;
  distanceKm: number;
  bearingDeg: number;
  lastRssi: number;
  hopDistance: number;
  trustScore: number;
  reputationTier: string;
  isDirect: boolean;
  radioType: string;
  relayReliability: number;
  degree: number;
  connectedPeerIds: string[];
  peerRef?: MeshNode;
  avgLatencyMs?: number;
  latencyStatus?: 'ultra_low' | 'stable' | 'degraded' | 'bottleneck';
  pathfindingRating?: 'Optimal Path' | 'Stable Relay' | 'Moderate Lag' | 'High-Latency Bottleneck';
  // Pathfinding Shortest Hop Metrics
  shortestHopCount?: number; // 0 for root, 1, 2, 3... or Infinity if unreachable
  shortestPathNodeIds?: string[]; // Node ID route sequence: ['node_user_self', 'relay1', 'target']
  nextHopPeerId?: string | null; // Direct peer to forward packets to
  nextHopCallsign?: string | null;
  pathLatencyMs?: number; // Cumulative latency along shortest hop path
  pathMinReliability?: number; // Minimum link reliability along path
  isReachable?: boolean; // Whether active path exists from local root
  hopTier?: 'root' | 'direct' | 'relay1' | 'relay2_plus' | 'unreachable';
  routeSummary?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface TopologyLink extends d3.SimulationLinkDatum<TopologyNode> {
  id: string;
  source: string | TopologyNode;
  target: string | TopologyNode;
  sourceId: string;
  targetId: string;
  distanceKm: number;
  rssi: number;
  quality: 'excellent' | 'good' | 'fair' | 'marginal';
  isDirectToUser: boolean;
  bandwidthKbps: number;
  latencyMs: number;
  isHighLatency: boolean;
  packetLossPercent: number;
  reliabilityScore: number;
  baseThickness: number;
  // Pathfinding Metrics Layer
  isShortestPathTree?: boolean; // Belongs to BFS shortest path spanning tree
  hopLevel?: number; // 1 for direct links, 2 for 1st-level relays, etc.
}

export const D3MeshTopologyMap: React.FC<D3MeshTopologyMapProps> = ({
  peers,
  user,
  onSelectPeer,
  onOpenChatWithPeer,
  onOpenReputation,
  isNightMode = false,
  onAddToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Layout & Dimension State
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // User Interactive Settings
  const [linkThresholdKm, setLinkThresholdKm] = useState<number>(2.2); // RF range threshold to draw links
  const [filterQuality, setFilterQuality] = useState<'all' | 'strong_only'>('all');
  const [filterSignalStrength, setFilterSignalStrength] = useState<'all' | 'strong' | 'high_latency'>('all');
  const [showSignalBadges, setShowSignalBadges] = useState<boolean>(true);
  const [signalBadgeMetric, setSignalBadgeMetric] = useState<'rssi' | 'latency' | 'combined'>('rssi');
  const [showPacketFlow, setShowPacketFlow] = useState<boolean>(true);
  const [showLatencyHeatmap, setShowLatencyHeatmap] = useState<boolean>(true); // Heatmap overlay by average ping
  const [showPathfindingLayer, setShowPathfindingLayer] = useState<boolean>(true); // Pathfinding shortest hop metrics layer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [hoveredLinkData, setHoveredLinkData] = useState<{ link: TopologyLink; x: number; y: number } | null>(null);
  const [showControlsHUD, setShowControlsHUD] = useState<boolean>(false);

  // ResizeObserver for Container Sizing
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

  // 1. GENERATE TOPOLOGY NODES (User Node + Peers)
  const initialNodes = useMemo<TopologyNode[]>(() => {
    const list: TopologyNode[] = [];
    const userCallsign = user?.callsign || 'Local Node';

    // Central User Node
    list.push({
      id: 'node_user_self',
      callsign: `${userCallsign} (You)`,
      isUser: true,
      distanceKm: 0,
      bearingDeg: 0,
      lastRssi: -35,
      hopDistance: 0,
      trustScore: 100,
      reputationTier: 'Sovereign Root',
      isDirect: true,
      radioType: 'LoRa/BLE Bridge',
      relayReliability: 100,
      degree: 0,
      connectedPeerIds: [],
    });

    // Process Peers into spatial radar coordinates
    peers.forEach((peer, idx) => {
      // Calculate or extract distance & angle
      let dist = (peer as any).distanceKm;
      if (dist === undefined || dist <= 0) {
        dist = peer.distanceRatio ? peer.distanceRatio * 3.5 : 0.6 + (idx % 6) * 0.45;
      }

      let bearing = peer.angle;
      if (bearing === undefined || isNaN(bearing)) {
        // Distribute evenly around the circle
        bearing = (idx * (360 / Math.max(peers.length, 1)) + 15) % 360;
      }

      list.push({
        id: peer.id,
        callsign: peer.callsign || `Peer-${peer.id.slice(0, 4)}`,
        isUser: false,
        distanceKm: dist,
        bearingDeg: bearing,
        lastRssi: peer.lastRssi ?? -72,
        hopDistance: peer.hopDistance ?? 1,
        trustScore: peer.trustScore ?? 80,
        reputationTier: peer.reputationTier || 'Mesh Contributor',
        isDirect: peer.isDirect ?? peer.hopDistance === 1,
        radioType: peer.radioType || 'LoRa 868.1MHz',
        relayReliability: peer.relayReliability ?? 98.4,
        degree: 0,
        connectedPeerIds: [],
        peerRef: peer,
      });
    });

    return list;
  }, [peers, user]);

  // 2. GENERATE TOPOLOGY LINKS BETWEEN NEARBY NODES (Visualizing Mesh Connectivity Density)
  const { nodes, links, densityMetrics, pathfindingMetrics } = useMemo(() => {
    // Clone nodes so we can attach computed degree & links
    const nodeMap = new Map<string, TopologyNode>();
    initialNodes.forEach((n) => {
      nodeMap.set(n.id, { ...n, degree: 0, connectedPeerIds: [] });
    });

    const generatedLinks: TopologyLink[] = [];

    // Calculate Cartesian relative coordinates for all nodes
    const coords = new Map<string, { x: number; y: number }>();
    nodeMap.forEach((n) => {
      if (n.isUser) {
        coords.set(n.id, { x: 0, y: 0 });
      } else {
        const rad = (n.bearingDeg * Math.PI) / 180;
        coords.set(n.id, {
          x: n.distanceKm * Math.cos(rad),
          y: n.distanceKm * Math.sin(rad),
        });
      }
    });

    // Check all pairs of nodes (u, v) to test proximity connectivity
    const allNodeList = Array.from(nodeMap.values());
    for (let i = 0; i < allNodeList.length; i++) {
      for (let j = i + 1; j < allNodeList.length; j++) {
        const u = allNodeList[i];
        const v = allNodeList[j];
        const coordU = coords.get(u.id);
        const coordV = coords.get(v.id);
        if (!coordU || !coordV) continue;

        // Euclidean distance in simulated kilometers
        const distKm = Math.sqrt(
          Math.pow(coordU.x - coordV.x, 2) + Math.pow(coordU.y - coordV.y, 2)
        );

        // Direct connection condition:
        // 1) Either both are within the RF link threshold, OR
        // 2) One is User and the other has isDirect === true, OR
        // 3) Nearest neighbors if isolated
        const isConnected =
          distKm <= linkThresholdKm ||
          (u.isUser && v.isDirect && distKm <= linkThresholdKm * 1.35) ||
          (v.isUser && u.isDirect && distKm <= linkThresholdKm * 1.35);

        if (isConnected) {
          // Model RF Link Signal Quality (dBm) based on peer hardware measurements & distance attenuation
          const estimatedRssi = Math.round(-46 - 28 * Math.log10(Math.max(distKm, 0.08)));
          const peerReportedRssi =
            !u.isUser && !v.isUser
              ? Math.round((u.lastRssi + v.lastRssi) / 2)
              : u.isUser
              ? v.lastRssi
              : u.lastRssi;
          const effectiveRssi = Math.min(
            -44,
            Math.max(-105, Math.round(peerReportedRssi * 0.45 + estimatedRssi * 0.55))
          );

          let quality: 'excellent' | 'good' | 'fair' | 'marginal' = 'good';
          if (effectiveRssi >= -65) quality = 'excellent';
          else if (effectiveRssi >= -78) quality = 'good';
          else if (effectiveRssi >= -88) quality = 'fair';
          else quality = 'marginal';

          // Check quality filter
          if (filterQuality === 'strong_only' && quality === 'marginal') {
            continue;
          }
          if (filterSignalStrength === 'strong' && effectiveRssi < -78) {
            continue;
          }

          const linkId = `link_${u.id}_${v.id}`;
          const isDirectToUser = u.isUser || v.isUser;
          const bandwidth = quality === 'excellent' ? 250 : quality === 'good' ? 125 : quality === 'fair' ? 62.5 : 19.2;

          // Latency and Packet Loss Calculation for Real-Time Mesh Telemetry
          const baseLatency = 20;
          const distLatency = distKm * 30;
          const rssiPenalty = Math.max(0, (Math.abs(effectiveRssi) - 65) * 2.2);
          const hopPenalty = isDirectToUser ? 0 : 45;
          const latencyMs = Math.round(baseLatency + distLatency + rssiPenalty + hopPenalty);

          const packetLossPercent = effectiveRssi >= -65 ? 0.4 : effectiveRssi >= -78 ? 2.2 : effectiveRssi >= -88 ? 6.8 : 16.5;
          const isHighLatency = latencyMs >= 80 || quality === 'marginal' || packetLossPercent >= 10;

          if (filterSignalStrength === 'high_latency' && !isHighLatency) {
            continue;
          }

          // Compute Mesh Reliability score (0-100%) from signal strength (RSSI), packet loss, and latency
          const rssiFactor = Math.max(0, Math.min(1, (effectiveRssi - (-105)) / (-45 - (-105))));
          const reliabilityScore = Math.round(
            Math.max(
              12,
              Math.min(
                99,
                100 - (packetLossPercent * 2.2) - (latencyMs > 60 ? (latencyMs - 60) * 0.35 : 0) + (rssiFactor * 10) - 8
              )
            )
          );

          // Dynamic line thickness scaled with signal strength (RSSI)
          // Weakest links scale to ~1.3px, strong links scale up to ~5.6px
          const baseThickness = Number((1.3 + Math.pow(rssiFactor, 1.25) * 4.3).toFixed(2));

          generatedLinks.push({
            id: linkId,
            source: u.id,
            target: v.id,
            sourceId: u.id,
            targetId: v.id,
            distanceKm: Number(distKm.toFixed(2)),
            rssi: effectiveRssi,
            quality,
            isDirectToUser,
            bandwidthKbps: bandwidth,
            latencyMs,
            isHighLatency,
            packetLossPercent,
            reliabilityScore,
            baseThickness,
          });

          // Update degree counts and adjacency lists
          u.degree += 1;
          v.degree += 1;
          u.connectedPeerIds.push(v.id);
          v.connectedPeerIds.push(u.id);
        }
      }
    }

    // Compute Per-Node Average Latency (Ping) for Heatmap Overlay & Pathfinding Decisions
    allNodeList.forEach((node) => {
      const incidentLinks = generatedLinks.filter(
        (l) => l.sourceId === node.id || l.targetId === node.id
      );

      if (incidentLinks.length > 0) {
        const sumLatency = incidentLinks.reduce((sum, l) => sum + l.latencyMs, 0);
        node.avgLatencyMs = Math.round(sumLatency / incidentLinks.length);
      } else {
        node.avgLatencyMs = node.isUser ? 18 : 68;
      }

      if (node.avgLatencyMs < 40) {
        node.latencyStatus = 'ultra_low';
        node.pathfindingRating = 'Optimal Path';
      } else if (node.avgLatencyMs <= 75) {
        node.latencyStatus = 'stable';
        node.pathfindingRating = 'Stable Relay';
      } else if (node.avgLatencyMs <= 110) {
        node.latencyStatus = 'degraded';
        node.pathfindingRating = 'Moderate Lag';
      } else {
        node.latencyStatus = 'bottleneck';
        node.pathfindingRating = 'High-Latency Bottleneck';
      }
    });

    // Compute BFS Shortest Hop Pathfinding from Local Root Node ('node_user_self')
    const localUserId = 'node_user_self';
    const adjMap = new Map<string, { peerId: string; link: TopologyLink }[]>();

    allNodeList.forEach((n) => {
      adjMap.set(n.id, []);
    });

    generatedLinks.forEach((link) => {
      adjMap.get(link.sourceId)?.push({ peerId: link.targetId, link });
      adjMap.get(link.targetId)?.push({ peerId: link.sourceId, link });
    });

    interface BFSEntry {
      nodeId: string;
      hopCount: number;
      path: string[];
      totalLatency: number;
      minReliability: number;
    }

    const visited = new Map<string, BFSEntry>();
    const queue: BFSEntry[] = [
      {
        nodeId: localUserId,
        hopCount: 0,
        path: [localUserId],
        totalLatency: 0,
        minReliability: 100,
      },
    ];
    visited.set(localUserId, queue[0]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adjMap.get(curr.nodeId) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.peerId)) {
          const nextEntry: BFSEntry = {
            nodeId: neighbor.peerId,
            hopCount: curr.hopCount + 1,
            path: [...curr.path, neighbor.peerId],
            totalLatency: curr.totalLatency + neighbor.link.latencyMs,
            minReliability: Math.min(curr.minReliability, neighbor.link.reliabilityScore),
          };
          visited.set(neighbor.peerId, nextEntry);
          queue.push(nextEntry);

          // Mark this link as part of the BFS Shortest Path Spanning Tree
          neighbor.link.isShortestPathTree = true;
          neighbor.link.hopLevel = nextEntry.hopCount;
        }
      }
    }

    // Assign pathfinding metrics to each node in allNodeList
    allNodeList.forEach((node) => {
      if (node.id === localUserId) {
        node.shortestHopCount = 0;
        node.shortestPathNodeIds = [localUserId];
        node.nextHopPeerId = null;
        node.nextHopCallsign = null;
        node.pathLatencyMs = 0;
        node.pathMinReliability = 100;
        node.isReachable = true;
        node.hopTier = 'root';
        node.routeSummary = 'Local Mesh Root (0 Hops)';
        return;
      }

      const routeInfo = visited.get(node.id);
      if (routeInfo) {
        node.shortestHopCount = routeInfo.hopCount;
        node.shortestPathNodeIds = routeInfo.path;
        node.pathLatencyMs = routeInfo.totalLatency;
        node.pathMinReliability = routeInfo.minReliability;
        node.isReachable = true;

        const nextHopId = routeInfo.path[1];
        node.nextHopPeerId = nextHopId;
        const nextHopNode = nodeMap.get(nextHopId);
        node.nextHopCallsign = nextHopNode ? nextHopNode.callsign : nextHopId;

        if (routeInfo.hopCount === 1) {
          node.hopTier = 'direct';
          node.routeSummary = 'Direct 1-Hop Radio Link';
        } else if (routeInfo.hopCount === 2) {
          node.hopTier = 'relay1';
          node.routeSummary = `1-Hop Relay via ${node.nextHopCallsign} (2 Hops)`;
        } else {
          node.hopTier = 'relay2_plus';
          node.routeSummary = `${routeInfo.hopCount - 1} Relays via ${node.nextHopCallsign} (${routeInfo.hopCount} Hops)`;
        }
      } else {
        node.shortestHopCount = Infinity;
        node.shortestPathNodeIds = [];
        node.nextHopPeerId = null;
        node.nextHopCallsign = null;
        node.pathLatencyMs = 0;
        node.pathMinReliability = 0;
        node.isReachable = false;
        node.hopTier = 'unreachable';
        node.routeSummary = 'Unreachable (Partitioned/No Link)';
      }
    });

    // Compute Pathfinding Summary Stats
    const reachablePeers = allNodeList.filter((n) => !n.isUser && n.isReachable);
    const maxHopCount = reachablePeers.length > 0 ? Math.max(...reachablePeers.map((n) => n.shortestHopCount || 1)) : 0;
    const avgHopCount =
      reachablePeers.length > 0
        ? Number((reachablePeers.reduce((s, n) => s + (n.shortestHopCount || 1), 0) / reachablePeers.length).toFixed(1))
        : 0;
    const directHopCount = reachablePeers.filter((n) => n.shortestHopCount === 1).length;
    const relay1HopCount = reachablePeers.filter((n) => n.shortestHopCount === 2).length;
    const relay2PlusHopCount = reachablePeers.filter((n) => (n.shortestHopCount || 0) >= 3).length;
    const unreachableCount = allNodeList.filter((n) => !n.isUser && !n.isReachable).length;

    // Network Connectivity Density Metrics
    const totalNodes = allNodeList.length;
    const totalLinks = generatedLinks.length;
    const maxPossibleLinks = (totalNodes * (totalNodes - 1)) / 2;
    const densityRatio = maxPossibleLinks > 0 ? (totalLinks / maxPossibleLinks) : 0;
    const avgDegree = totalNodes > 0 ? Number(((totalLinks * 2) / totalNodes).toFixed(1)) : 0;
    const hubCount = allNodeList.filter((n) => n.degree >= 3).length;

    let densityRating = 'Sparse Relay';
    if (densityRatio >= 0.45) densityRating = 'Dense Mesh (Multi-Path)';
    else if (densityRatio >= 0.25) densityRating = 'Moderate Redundancy';
    else if (densityRatio >= 0.12) densityRating = 'Linear Relay Chain';

    return {
      nodes: allNodeList,
      links: generatedLinks,
      densityMetrics: {
        totalNodes,
        totalLinks,
        densityRatio: Math.round(densityRatio * 100),
        densityRating,
        avgDegree,
        hubCount,
      },
      pathfindingMetrics: {
        maxHopCount,
        avgHopCount,
        directHopCount,
        relay1HopCount,
        relay2PlusHopCount,
        unreachableCount,
        totalReachable: reachablePeers.length,
        networkDiameter: maxHopCount,
      },
    };
  }, [initialNodes, linkThresholdKm, filterQuality, filterSignalStrength]);

  // Active Shortest Path Links (set of link IDs highlighted when a node is selected)
  const activeShortestPathLinkIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const targetNode = nodes.find((n) => n.id === selectedNodeId);
    if (!targetNode || !targetNode.shortestPathNodeIds || targetNode.shortestPathNodeIds.length < 2) {
      return new Set<string>();
    }
    const pathIds = targetNode.shortestPathNodeIds;
    const linkIdSet = new Set<string>();
    for (let i = 0; i < pathIds.length - 1; i++) {
      const u = pathIds[i];
      const v = pathIds[i + 1];
      const match = links.find(
        (l) => (l.sourceId === u && l.targetId === v) || (l.sourceId === v && l.targetId === u)
      );
      if (match) {
        linkIdSet.add(match.id);
      }
    }
    return linkIdSet;
  }, [selectedNodeId, nodes, links]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Connected Peer Links for Selected Node
  const connectedNodeLinks = useMemo(() => {
    if (!selectedNodeId) return [];
    return links.filter((l) => l.sourceId === selectedNodeId || l.targetId === selectedNodeId);
  }, [selectedNodeId, links]);

  // Selected Link Details
  const selectedLink = useMemo(() => {
    return links.find((l) => l.id === selectedLinkId) || null;
  }, [links, selectedLinkId]);

  // Hovered Link Details
  const hoveredLink = useMemo(() => {
    return links.find((l) => l.id === hoveredLinkId) || null;
  }, [links, hoveredLinkId]);

  // Recenter / Reset Zoom
  const handleRecenter = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    soundFeedback.playClick();
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    soundFeedback.playClick();
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.35);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    soundFeedback.playClick();
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.74);
  }, []);

  // 3. PRIMARY D3 RENDERING EFFECT FOR TOPOLOGY GRAPH
  useEffect(() => {
    if (!svgRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // SVG Defs for glowing filters and gradients
    const defs = svg.append('defs');

    // Glow filter for high-density hubs and links
    const filter = defs
      .append('filter')
      .attr('id', 'mesh-topology-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Red glow filter for high-latency links
    const redGlow = defs
      .append('filter')
      .attr('id', 'high-latency-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    redGlow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    const redMerge = redGlow.append('feMerge');
    redMerge.append('feMergeNode').attr('in', 'blur');
    redMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Gaussian blur filter for Latency Heatmap Overlay
    const heatBlur = defs
      .append('filter')
      .attr('id', 'heatmap-gaussian-blur')
      .attr('x', '-60%')
      .attr('y', '-60%')
      .attr('width', '220%')
      .attr('height', '220%');
    heatBlur.append('feGaussianBlur').attr('stdDeviation', '16').attr('result', 'blur');

    // Radial gradients for node latency heatmap
    const latencyGradients = [
      { id: 'heat-grad-ultra_low', color: '#10B981', stop1: 0.8, stop2: 0.32 },
      { id: 'heat-grad-stable', color: isNightMode ? '#588157' : '#2A9D8F', stop1: 0.75, stop2: 0.28 },
      { id: 'heat-grad-degraded', color: '#E9C46A', stop1: 0.8, stop2: 0.35 },
      { id: 'heat-grad-bottleneck', color: '#EF4444', stop1: 0.9, stop2: 0.45 },
    ];
    latencyGradients.forEach((cfg) => {
      const grad = defs.append('radialGradient').attr('id', cfg.id);
      grad.append('stop').attr('offset', '0%').attr('stop-color', cfg.color).attr('stop-opacity', cfg.stop1);
      grad.append('stop').attr('offset', '45%').attr('stop-color', cfg.color).attr('stop-opacity', cfg.stop2);
      grad.append('stop').attr('offset', '100%').attr('stop-color', cfg.color).attr('stop-opacity', 0);
    });

    // Vivid Cyan / Green Glow filter for Shortest Path Pathfinding Routes
    const pathfindingGlow = defs
      .append('filter')
      .attr('id', 'pathfinding-route-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    pathfindingGlow.append('feGaussianBlur').attr('stdDeviation', '4.0').attr('result', 'blur');
    const pathMerge = pathfindingGlow.append('feMerge');
    pathMerge.append('feMergeNode').attr('in', 'blur');
    pathMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Directional Arrowheads for Pathfinding Route Vectors
    const marker = defs
      .append('marker')
      .attr('id', 'pathfinding-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', '18')
      .attr('refY', '5')
      .attr('markerWidth', '6')
      .attr('markerHeight', '6')
      .attr('orient', 'auto-start-reverse');
    marker
      .append('path')
      .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
      .attr('fill', isNightMode ? '#33ff00' : '#0284C7');

    // Root Group with Zoom & Pan
    const g = svg.append('g').attr('class', 'mesh-topology-root');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Canvas Background Click to Deselect
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        setSelectedNodeId(null);
        setSelectedLinkId(null);
      }
    });

    // 1. RADAR & DISTANCE BACKGROUND RINGS
    const radarGroup = g.append('g').attr('class', 'topology-radar-background');
    const maxRadius = Math.min(width, height) * 0.44;
    const distScale = d3.scaleLinear().domain([0, 4.0]).range([0, maxRadius]);

    const distanceRings = [0.5, 1.0, 2.0, 3.5];
    distanceRings.forEach((km) => {
      const r = distScale(km);
      radarGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#2A3D25' : '#87A878')
        .attr('stroke-opacity', isNightMode ? 0.22 : 0.18)
        .attr('stroke-width', km === 2.0 ? 1.5 : 1)
        .attr('stroke-dasharray', km === 0.5 ? '2 3' : 'none');

      radarGroup
        .append('text')
        .attr('x', centerX + r + 4)
        .attr('y', centerY - 4)
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('fill', isNightMode ? '#588157' : '#87A878')
        .attr('opacity', 0.7)
        .text(`${km} km`);
    });

    // Proximity Link Active Threshold Ring (Dashed Amber/Emerald Circle)
    const thresholdRadiusPx = distScale(linkThresholdKm);
    const thresholdGroup = radarGroup.append('g').attr('class', 'threshold-boundary');

    thresholdGroup
      .append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', thresholdRadiusPx)
      .attr('fill', isNightMode ? '#33ff00' : '#588157')
      .attr('fill-opacity', isNightMode ? 0.03 : 0.02)
      .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5 4')
      .attr('stroke-opacity', 0.4);

    thresholdGroup
      .append('text')
      .attr('x', centerX)
      .attr('y', centerY - thresholdRadiusPx - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('opacity', 0.8)
      .text(`RF Link Range Boundary: ${linkThresholdKm} km`);

    // 1.8. LATENCY HEATMAP OVERLAY LAYER (Colors nodes based on avg latency / ping for pathfinding decisions)
    const heatmapLayer = g.append('g').attr('class', 'topology-latency-heatmap-layer');
    let heatmapCircles: d3.Selection<SVGCircleElement, TopologyNode, SVGGElement, unknown> | null = null;

    if (showLatencyHeatmap) {
      heatmapCircles = heatmapLayer
        .selectAll<SVGCircleElement, TopologyNode>('circle.heat-halo')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('class', 'heat-halo pointer-events-none')
        .attr('r', (d) => (d.isUser ? 62 : d.degree >= 3 ? 52 : 44))
        .attr('fill', (d) => `url(#heat-grad-${d.latencyStatus || 'stable'})`)
        .attr('filter', 'url(#heatmap-gaussian-blur)')
        .attr('opacity', isNightMode ? 0.9 : 0.72);
    }

    // 1.9. PATHFINDING CONCENTRIC HOP REACHABILITY CONTOURS (Wavefront zones from local node)
    const wavefrontLayer = g.append('g').attr('class', 'topology-pathfinding-wavefront-layer pointer-events-none');
    if (showPathfindingLayer) {
      const hopDistances = [
        { hop: 1, distKm: Math.min(linkThresholdKm, 1.8), label: 'Hop 1 • Direct Radio Horizon', color: '#10B981' },
        { hop: 2, distKm: Math.min(linkThresholdKm * 1.8, 3.0), label: 'Hop 2 • 1st Relay Horizon', color: '#06B6D4' },
        { hop: 3, distKm: 3.8, label: 'Hop 3+ • Multi-Hop Mesh Zone', color: '#E9C46A' },
      ];

      hopDistances.forEach((zone) => {
        const r = distScale(zone.distKm);
        const zoneG = wavefrontLayer.append('g').attr('class', `hop-zone-${zone.hop}`);

        zoneG
          .append('circle')
          .attr('cx', centerX)
          .attr('cy', centerY)
          .attr('r', r)
          .attr('fill', zone.color)
          .attr('fill-opacity', isNightMode ? 0.02 : 0.015)
          .attr('stroke', zone.color)
          .attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '4 6')
          .attr('stroke-opacity', isNightMode ? 0.45 : 0.35);

        zoneG
          .append('text')
          .attr('x', centerX - r + 8)
          .attr('y', centerY - 4)
          .attr('font-size', '8px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .attr('fill', zone.color)
          .attr('opacity', 0.8)
          .text(`⚡ ${zone.label}`);
      });
    }

    // 2. POSITION NODES (Spatial radar positions with gentle force layout stabilization)
    nodes.forEach((node) => {
      if (node.isUser) {
        node.x = centerX;
        node.y = centerY;
        node.fx = centerX;
        node.fy = centerY;
      } else {
        const rad = (node.bearingDeg * Math.PI) / 180;
        const r = distScale(Math.min(node.distanceKm, 3.8));
        node.x = centerX + r * Math.cos(rad);
        node.y = centerY + r * Math.sin(rad);
      }
    });

    // Force simulation for nice separation while respecting spatial clusters
    const simLinks = links.map((l) => ({ ...l }));
    const simulation = d3
      .forceSimulation<TopologyNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<TopologyNode, any>(simLinks)
          .id((d) => d.id)
          .distance((d) => distScale(Math.max(d.distanceKm, 0.4)) * 0.7)
          .strength(0.25)
      )
      .force('charge', d3.forceManyBody().strength(-90))
      .force('collision', d3.forceCollide<TopologyNode>().radius((d) => (d.isUser ? 28 : 22)))
      .alphaDecay(0.04);

    // 3. RENDER MESH CONNECTIVITY LINES (Interactive, Dynamic Thickness Scaling with RSSI)
    const linkLayer = g.append('g').attr('class', 'topology-links-layer');

    // 3A. Invisible wider hit-area lines for smooth hover and click interaction
    const hitAreaElements = linkLayer
      .selectAll<SVGLineElement, TopologyLink>('line.mesh-hit-area')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'mesh-hit-area')
      .attr('stroke', 'transparent')
      .attr('stroke-width', (d) => Math.max(16, d.baseThickness + 10))
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setHoveredLinkId(d.id);
        setHoveredLinkData({ link: d, x: event.clientX, y: event.clientY });
      })
      .on('mousemove', (event, d) => {
        setHoveredLinkData({ link: d, x: event.clientX, y: event.clientY });
      })
      .on('mouseleave', () => {
        setHoveredLinkId(null);
        setHoveredLinkData(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        soundFeedback.playClick();
        setSelectedLinkId(d.id);
        setSelectedNodeId(null);
      });

    // 3B. Visual connection lines with dynamic thickness scaled to RSSI
    const linkElements = linkLayer
      .selectAll<SVGLineElement, TopologyLink>('line.mesh-visual-link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'mesh-visual-link pointer-events-none')
      .attr('stroke', (d) => {
        const isPathLink = activeShortestPathLinkIds.has(d.id);
        if (isPathLink) return isNightMode ? '#33ff00' : '#0284C7';
        if (d.id === selectedLinkId) return '#E9C46A';
        if (d.id === hoveredLinkId) return isNightMode ? '#33ff00' : '#2A9D8F';
        if (showPathfindingLayer && d.isShortestPathTree && !selectedNodeId) {
          return isNightMode ? '#10B981' : '#0284C7';
        }
        if (d.isHighLatency) return '#EF4444';
        if (d.quality === 'excellent') return isNightMode ? '#33ff00' : '#2A9D8F';
        if (d.quality === 'good') return isNightMode ? '#588157' : '#588157';
        if (d.quality === 'fair') return isNightMode ? '#E9C46A' : '#E9C46A';
        return '#EF4444';
      })
      .attr('filter', (d) => {
        if (activeShortestPathLinkIds.has(d.id)) return 'url(#pathfinding-route-glow)';
        if (d.id === selectedLinkId || d.id === hoveredLinkId) return 'url(#mesh-topology-glow)';
        if (d.isHighLatency) return 'url(#high-latency-glow)';
        return 'none';
      })
      .attr('stroke-width', (d) => {
        const isPathLink = activeShortestPathLinkIds.has(d.id);
        const isSelected = d.id === selectedLinkId;
        const isHovered = d.id === hoveredLinkId;
        const isConnectedToSelected =
          selectedNodeId && (d.sourceId === selectedNodeId || d.targetId === selectedNodeId);

        if (isPathLink) return d.baseThickness + 3.8;
        if (isSelected) return d.baseThickness + 3.0;
        if (isHovered) return d.baseThickness + 2.4;
        if (isConnectedToSelected) return d.baseThickness + 1.8;
        if (showPathfindingLayer && d.isShortestPathTree && !selectedNodeId) {
          return d.baseThickness + 1.2;
        }
        return d.baseThickness;
      })
      .attr('stroke-opacity', (d) => {
        const isPathLink = activeShortestPathLinkIds.has(d.id);
        if (isPathLink) return 1.0;
        if (selectedNodeId) {
          return d.sourceId === selectedNodeId || d.targetId === selectedNodeId ? 0.85 : 0.12;
        }
        if (selectedLinkId) {
          return d.id === selectedLinkId ? 1.0 : 0.2;
        }
        if (hoveredLinkId) {
          return d.id === hoveredLinkId ? 1.0 : 0.4;
        }
        if (showPathfindingLayer && d.isShortestPathTree) {
          return 0.95;
        }
        return d.isHighLatency ? 0.9 : d.quality === 'marginal' ? 0.5 : 0.8;
      })
      .attr('stroke-dasharray', (d) => {
        if (activeShortestPathLinkIds.has(d.id)) return 'none';
        return d.isHighLatency ? '5 3' : d.quality === 'marginal' ? '4 3' : 'none';
      })
      .attr('marker-end', (d) => (activeShortestPathLinkIds.has(d.id) ? 'url(#pathfinding-arrow)' : 'none'));

    // 4. OPTIONAL ANIMATED PACKET PULSES ALONG HIGH-TRAFFIC / DENSE LINKS
    const packetLayer = g.append('g').attr('class', 'packet-pulses-layer');
    if (showPacketFlow) {
      links
        .filter((l) => l.quality === 'excellent' || l.quality === 'good' || l.isHighLatency)
        .slice(0, 14) // pulse along active links
        .forEach((l) => {
          const packetCircle = packetLayer
            .append('circle')
            .attr('r', l.isHighLatency ? 3.0 : 2.5)
            .attr('fill', l.isHighLatency ? '#EF4444' : isNightMode ? '#33ff00' : '#E9C46A')
            .attr('opacity', 0.9);

          (l as any)._packetElement = packetCircle;
        });
    }

    // 4.5. DIRECT SIGNAL STRENGTH BADGES ON INTER-PEER LINKS
    const badgeLayer = g.append('g').attr('class', 'topology-signal-badges-layer');
    let badgeElements: d3.Selection<SVGGElement, TopologyLink, SVGGElement, unknown> | null = null;

    if (showSignalBadges) {
      badgeElements = badgeLayer
        .selectAll<SVGGElement, TopologyLink>('g.signal-badge')
        .data(links)
        .enter()
        .append('g')
        .attr('class', 'signal-badge')
        .attr('cursor', 'pointer')
        .attr('opacity', (d) => {
          if (selectedNodeId) {
            return d.sourceId === selectedNodeId || d.targetId === selectedNodeId ? 1.0 : 0.2;
          }
          if (selectedLinkId) {
            return d.id === selectedLinkId ? 1.0 : 0.25;
          }
          return 0.95;
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          soundFeedback.playClick();
          setSelectedLinkId(d.id);
          setSelectedNodeId(null);
        });

      // Background pill for the signal badge
      badgeElements
        .append('rect')
        .attr('class', 'badge-bg')
        .attr('x', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          const width = Math.max(48, text.length * 5.8 + 20);
          return -width / 2;
        })
        .attr('y', -9)
        .attr('width', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          return Math.max(48, text.length * 5.8 + 20);
        })
        .attr('height', 18)
        .attr('rx', 9)
        .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
        .attr('stroke', (d: TopologyLink) => {
          if (d.id === selectedLinkId) return '#E9C46A';
          if (d.isHighLatency) return '#EF4444';
          if (d.quality === 'excellent') return isNightMode ? '#33ff00' : '#10B981';
          if (d.quality === 'good') return isNightMode ? '#588157' : '#588157';
          if (d.quality === 'fair') return '#E9C46A';
          return '#EF4444';
        })
        .attr('stroke-width', (d: TopologyLink) => (d.id === selectedLinkId ? 2 : 1))
        .attr('stroke-opacity', 0.85);

      // Mini signal bars indicator
      badgeElements
        .append('rect')
        .attr('x', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          const width = Math.max(48, text.length * 5.8 + 20);
          return -width / 2 + 5;
        })
        .attr('y', -2.5)
        .attr('width', 1.8)
        .attr('height', 5)
        .attr('rx', 0.5)
        .attr('fill', (d: TopologyLink) =>
          d.isHighLatency ? '#EF4444' : d.quality === 'marginal' ? '#EF4444' : isNightMode ? '#33ff00' : '#10B981'
        );

      badgeElements
        .append('rect')
        .attr('x', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          const width = Math.max(48, text.length * 5.8 + 20);
          return -width / 2 + 8;
        })
        .attr('y', -4.5)
        .attr('width', 1.8)
        .attr('height', 7)
        .attr('rx', 0.5)
        .attr('fill', (d: TopologyLink) =>
          d.quality === 'marginal'
            ? isNightMode ? '#2A3B26' : '#D1D5DB'
            : d.isHighLatency
            ? '#EF4444'
            : d.quality === 'fair'
            ? '#E9C46A'
            : isNightMode ? '#33ff00' : '#10B981'
        );

      badgeElements
        .append('rect')
        .attr('x', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          const width = Math.max(48, text.length * 5.8 + 20);
          return -width / 2 + 11;
        })
        .attr('y', -6.5)
        .attr('width', 1.8)
        .attr('height', 9)
        .attr('rx', 0.5)
        .attr('fill', (d: TopologyLink) =>
          d.quality === 'marginal' || d.quality === 'fair'
            ? isNightMode ? '#2A3B26' : '#D1D5DB'
            : d.isHighLatency
            ? '#EF4444'
            : isNightMode ? '#33ff00' : '#10B981'
        );

      // Monospace RSSI / latency text readout
      badgeElements
        .append('text')
        .attr('x', (d: TopologyLink) => {
          const text =
            signalBadgeMetric === 'latency'
              ? `${d.latencyMs}ms`
              : signalBadgeMetric === 'combined'
              ? `${d.rssi}dBm • ${d.latencyMs}ms`
              : `${d.rssi} dBm`;
          const width = Math.max(48, text.length * 5.8 + 20);
          return -width / 2 + 15 + (width - 17) / 2;
        })
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('fill', (d: TopologyLink) => {
          if (d.isHighLatency) return '#EF4444';
          if (d.quality === 'excellent') return isNightMode ? '#33ff00' : '#10B981';
          if (d.quality === 'good') return isNightMode ? '#A8BDA5' : '#588157';
          if (d.quality === 'fair') return '#E9C46A';
          return '#EF4444';
        })
        .text((d: TopologyLink) => {
          if (signalBadgeMetric === 'latency') return `${d.latencyMs}ms`;
          if (signalBadgeMetric === 'combined') return `${d.rssi}dBm • ${d.latencyMs}ms`;
          return `${d.rssi} dBm`;
        });
    }

    // 5. RENDER TOPOLOGY NODES (User Node & Peers with D3 Drag capability)
    const nodeLayer = g.append('g').attr('class', 'topology-nodes-layer');

    const nodeElements = nodeLayer
      .selectAll<SVGGElement, TopologyNode>('g.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'mesh-topology-node')
      .attr('cursor', 'grab')
      .on('click', (event, d) => {
        event.stopPropagation();
        soundFeedback.playClick();
        setSelectedNodeId(d.id);
        setSelectedLinkId(null);
        if (!d.isUser && d.peerRef && onSelectPeer) {
          onSelectPeer(d.peerRef);
        }
      });

    // D3 Drag for interactive force-directed graph node manipulation
    const dragBehavior = d3
      .drag<SVGGElement, TopologyNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (!d.isUser) {
          d.fx = null;
          d.fy = null;
        }
      });

    nodeElements.call(dragBehavior as any);

    // Node High-Density Halo (for Mesh Hubs with degree >= 3)
    nodeElements
      .filter((d) => d.degree >= 3 && !d.isUser)
      .append('circle')
      .attr('r', 24)
      .attr('fill', 'none')
      .attr('stroke', isNightMode ? '#33ff00' : '#2A9D8F')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-dasharray', '3 3')
      .attr('filter', 'url(#mesh-topology-glow)');

    // Outer Selection Halo / Latency Heatmap Ring
    nodeElements
      .append('circle')
      .attr('class', 'selection-ring')
      .attr('r', (d) => (d.isUser ? 26 : d.degree >= 3 ? 20 : 16))
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.id === selectedNodeId) return '#E9C46A';
        if (showLatencyHeatmap) {
          if (d.latencyStatus === 'ultra_low') return '#10B981';
          if (d.latencyStatus === 'stable') return isNightMode ? '#588157' : '#2A9D8F';
          if (d.latencyStatus === 'degraded') return '#E9C46A';
          return '#EF4444';
        }
        return d.isUser
          ? isNightMode
            ? '#33ff00'
            : '#588157'
          : isNightMode
          ? '#2A3D25'
          : '#87A878';
      })
      .attr('stroke-width', (d) => (d.id === selectedNodeId ? 2.8 : showLatencyHeatmap ? 2.2 : 1.5))
      .attr('stroke-opacity', (d) => (d.id === selectedNodeId ? 1 : showLatencyHeatmap ? 0.95 : 0.6));

    // Base Node Body Circle
    nodeElements
      .append('circle')
      .attr('r', (d) => (d.isUser ? 18 : d.degree >= 3 ? 15 : 12))
      .attr('fill', (d) => {
        if (d.isUser) return isNightMode ? '#1C2C19' : '#588157';
        if (d.degree >= 3) return isNightMode ? '#1A291A' : '#2A9D8F';
        if (d.degree >= 1) return isNightMode ? '#141F12' : '#FFFFFF';
        return isNightMode ? '#221515' : '#FAF6EE';
      })
      .attr('stroke', (d) => {
        if (d.isUser) return isNightMode ? '#33ff00' : '#FAF6EE';
        if (showLatencyHeatmap) {
          if (d.latencyStatus === 'ultra_low') return '#10B981';
          if (d.latencyStatus === 'stable') return isNightMode ? '#33ff00' : '#2A9D8F';
          if (d.latencyStatus === 'degraded') return '#E9C46A';
          return '#EF4444';
        }
        if (d.degree >= 3) return isNightMode ? '#33ff00' : '#2A9D8F';
        if (d.degree >= 1) return isNightMode ? '#588157' : '#87A878';
        return '#E76F51';
      })
      .attr('stroke-width', 2);

    // Node Icon / Text Glyph
    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', (d) => (d.isUser ? '10px' : '9px'))
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', (d) => {
        if (d.isUser) return '#FFFFFF';
        if (d.degree >= 3) return '#FFFFFF';
        return isNightMode ? '#FAF6EE' : '#203A2A';
      })
      .text((d) => (d.isUser ? 'YOU' : d.callsign.charAt(0).toUpperCase()));

    // Latency Ping Heatmap Badge above Node (for pathfinding decisions)
    if (showLatencyHeatmap) {
      const pingBadge = nodeElements
        .append('g')
        .attr('class', 'node-latency-ping-badge')
        .attr('transform', (d) => `translate(0, -${d.isUser ? 32 : d.degree >= 3 ? 27 : 23})`);

      pingBadge
        .append('rect')
        .attr('x', -24)
        .attr('y', -7)
        .attr('width', 48)
        .attr('height', 14)
        .attr('rx', 7)
        .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
        .attr('stroke', (d) =>
          d.latencyStatus === 'ultra_low'
            ? '#10B981'
            : d.latencyStatus === 'stable'
            ? '#2A9D8F'
            : d.latencyStatus === 'degraded'
            ? '#E9C46A'
            : '#EF4444'
        )
        .attr('stroke-width', 1.2)
        .attr('stroke-opacity', 0.95);

      pingBadge
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('fill', (d) =>
          d.latencyStatus === 'ultra_low'
            ? isNightMode ? '#33ff00' : '#10B981'
            : d.latencyStatus === 'stable'
            ? isNightMode ? '#87A878' : '#2A9D8F'
            : d.latencyStatus === 'degraded'
            ? '#E9C46A'
            : '#EF4444'
        )
        .text((d) => `⚡${d.avgLatencyMs ?? 20}ms`);
    }

    // Node Callsign & Connectivity Density Badge
    const labelGroup = nodeElements
      .append('g')
      .attr('transform', (d) => `translate(0, ${d.isUser ? 28 : d.degree >= 3 ? 24 : 20})`);

    // Pill Background
    labelGroup
      .append('rect')
      .attr('x', (d) => -Math.max(d.callsign.length * 3.4 + 18, 28))
      .attr('y', -7)
      .attr('width', (d) => Math.max(d.callsign.length * 6.8 + 36, 56))
      .attr('height', 15)
      .attr('rx', 7.5)
      .attr('fill', isNightMode ? '#141F12' : '#FFFFFF')
      .attr('stroke', (d) => (d.id === selectedNodeId ? '#E9C46A' : isNightMode ? '#2A3D25' : '#87A878'))
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.7);

    // Pill Text
    labelGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '8.5px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', isNightMode ? '#A8BDA5' : '#203A2A')
      .text((d) => (d.isUser ? 'YOU • Direct Root' : `${d.callsign} (${d.degree}L)`));

    // 5.5. PATHFINDING METRICS LAYER: Shortest Hop Count Badge below node
    if (showPathfindingLayer) {
      // Outer Hop-Tier concentric contour around node
      nodeElements
        .append('circle')
        .attr('class', 'pathfinding-hop-ring pointer-events-none')
        .attr('r', (d) => (d.isUser ? 24 : d.degree >= 3 ? 20 : 16))
        .attr('fill', 'none')
        .attr('stroke', (d) => {
          if (d.isUser) return isNightMode ? '#33ff00' : '#10B981';
          if (!d.isReachable) return '#EF4444';
          if (d.shortestHopCount === 1) return '#10B981';
          if (d.shortestHopCount === 2) return '#06B6D4';
          return '#E9C46A';
        })
        .attr('stroke-width', (d) => (selectedNodeId === d.id ? 2.4 : 1.4))
        .attr('stroke-dasharray', (d) => (d.isUser || d.shortestHopCount === 1 ? 'none' : '3 2'))
        .attr('stroke-opacity', (d) => (selectedNodeId === d.id ? 1 : 0.75));

      const hopBadge = nodeElements
        .append('g')
        .attr('class', 'node-pathfinding-hop-badge')
        .attr('transform', (d) => `translate(0, ${d.isUser ? 45 : d.degree >= 3 ? 41 : 37})`);

      hopBadge
        .append('rect')
        .attr('x', (d) => {
          const label = d.isUser
            ? '★ ROOT (0H)'
            : !d.isReachable
            ? '✕ NO ROUTE'
            : d.shortestHopCount === 1
            ? '⚡ 1 HOP • DIRECT'
            : d.shortestHopCount === 2
            ? '⚡ 2 HOPS • 1 RELAY'
            : `⚡ ${d.shortestHopCount} HOPS • RELAY`;
          return -Math.max(label.length * 3.1 + 8, 30);
        })
        .attr('y', -6.5)
        .attr('width', (d) => {
          const label = d.isUser
            ? '★ ROOT (0H)'
            : !d.isReachable
            ? '✕ NO ROUTE'
            : d.shortestHopCount === 1
            ? '⚡ 1 HOP • DIRECT'
            : d.shortestHopCount === 2
            ? '⚡ 2 HOPS • 1 RELAY'
            : `⚡ ${d.shortestHopCount} HOPS • RELAY`;
          return Math.max(label.length * 6.2 + 16, 60);
        })
        .attr('height', 13)
        .attr('rx', 6.5)
        .attr('fill', (d) => {
          if (d.isUser) return isNightMode ? '#1C2C19' : '#E8F5E9';
          if (!d.isReachable) return isNightMode ? '#2D1515' : '#FEE2E2';
          if (d.shortestHopCount === 1) return isNightMode ? '#132A1C' : '#E6F4EA';
          if (d.shortestHopCount === 2) return isNightMode ? '#0E242B' : '#E0F2FE';
          return isNightMode ? '#2B2310' : '#FEF3C7';
        })
        .attr('stroke', (d) => {
          if (d.isUser) return isNightMode ? '#33ff00' : '#10B981';
          if (!d.isReachable) return '#EF4444';
          if (d.shortestHopCount === 1) return '#10B981';
          if (d.shortestHopCount === 2) return '#06B6D4';
          return '#E9C46A';
        })
        .attr('stroke-width', 1.2);

      hopBadge
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('fill', (d) => {
          if (d.isUser) return isNightMode ? '#33ff00' : '#10B981';
          if (!d.isReachable) return '#EF4444';
          if (d.shortestHopCount === 1) return isNightMode ? '#33ff00' : '#059669';
          if (d.shortestHopCount === 2) return isNightMode ? '#38BDF8' : '#0284C7';
          return isNightMode ? '#FBBF24' : '#D97706';
        })
        .text((d) => {
          if (d.isUser) return '★ ROOT (0H)';
          if (!d.isReachable) return '✕ NO ROUTE';
          if (d.shortestHopCount === 1) return '⚡ 1 HOP • DIRECT';
          if (d.shortestHopCount === 2) return '⚡ 2 HOPS • 1 RELAY';
          return `⚡ ${d.shortestHopCount} HOPS • RELAY`;
        });
    }

    // Simulation Tick Event
    let pulseT = 0;
    simulation.on('tick', () => {
      // Update interactive hit-area and visual line positions
      hitAreaElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Update latency heatmap halos at node centroids
      if (heatmapCircles) {
        heatmapCircles
          .attr('cx', (d: any) => d.x || 0)
          .attr('cy', (d: any) => d.y || 0);
      }

      // Update signal strength badge positions at link midpoints
      if (badgeElements) {
        badgeElements.attr('transform', (d: any) => {
          if (d.source?.x !== undefined && d.target?.x !== undefined) {
            const mx = (d.source.x + d.target.x) / 2;
            const my = (d.source.y + d.target.y) / 2;
            return `translate(${mx}, ${my})`;
          }
          return '';
        });
      }

      // Update node positions
      nodeElements.attr('transform', (d) => `translate(${d.x}, ${d.y})`);

      // Update animated packet pulses
      if (showPacketFlow) {
        pulseT = (pulseT + 0.006) % 1;
        links.forEach((l: any) => {
          if (l._packetElement && l.source?.x && l.target?.x) {
            const px = l.source.x + (l.target.x - l.source.x) * pulseT;
            const py = l.source.y + (l.target.y - l.source.y) * pulseT;
            l._packetElement.attr('cx', px).attr('cy', py);
          }
        });
      }
    });

    return () => {
      simulation.stop();
    };
  }, [
    dimensions,
    nodes,
    links,
    linkThresholdKm,
    filterQuality,
    showPacketFlow,
    showSignalBadges,
    signalBadgeMetric,
    showLatencyHeatmap,
    showPathfindingLayer,
    activeShortestPathLinkIds,
    isNightMode,
    selectedNodeId,
    selectedLinkId,
    hoveredLinkId,
    onSelectPeer,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        isNightMode ? 'bg-[#0E170C] text-[#F0F5EE]' : 'bg-[#FAF6EE] text-[#203A2A]'
      }`}
    >
      {/* 1. TOP STATS HUD: MESH CONNECTIVITY DENSITY BAR */}
      <div className="absolute top-3 left-4 right-4 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        {/* Density Metric Card */}
        <div
          className={`pointer-events-auto px-3.5 py-2 rounded-2xl border shadow-md backdrop-blur-md flex items-center gap-3 text-xs ${
            isNightMode
              ? 'bg-[#141F12]/90 border-[#2A3B26]'
              : 'bg-white/95 border-[#87A878]/35'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#588157]/20 text-[#588157] dark:text-[#33ff00] flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-[11px] flex items-center gap-1.5">
                <span>Mesh Connectivity Density</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#588157]/20 text-[#588157] dark:text-[#33ff00]">
                  {densityMetrics.densityRatio}%
                </span>
              </div>
              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                {densityMetrics.densityRating}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-[#87A878]/25 pl-3 text-[11px] font-mono">
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Nodes: </span>
              <span className="font-bold">{densityMetrics.totalNodes}</span>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Links: </span>
              <span className="font-bold text-[#588157] dark:text-[#33ff00]">{densityMetrics.totalLinks}</span>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">High Latency: </span>
              <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${
                links.filter((l) => l.isHighLatency).length > 0
                  ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                  : 'text-[#588157]'
              }`}>
                {links.filter((l) => l.isHighLatency).length} in RED
              </span>
            </div>
          </div>
        </div>

        {/* Quick Config & HUD Toggle Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Pathfinding Shortest Hop Metrics Layer Toggle Button */}
          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setShowPathfindingLayer(!showPathfindingLayer);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              showPathfindingLayer
                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                : isNightMode
                ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                : 'bg-white/90 border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
            }`}
            title="Toggle shortest hop count pathfinding metrics layer"
          >
            <Route className="w-3.5 h-3.5" />
            <span>Pathfinding / Hops: {showPathfindingLayer ? 'ON' : 'OFF'}</span>
          </button>

          {/* Latency Heatmap Toggle Button */}
          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setShowLatencyHeatmap(!showLatencyHeatmap);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              showLatencyHeatmap
                ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                : isNightMode
                ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                : 'bg-white/90 border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
            }`}
            title="Toggle latency heatmap overlay for mesh pathfinding decisions"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Heatmap: {showLatencyHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setShowControlsHUD(!showControlsHUD);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              showControlsHUD
                ? 'bg-[#588157] text-white border-[#588157]'
                : isNightMode
                ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                : 'bg-white/90 border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Link Range ({linkThresholdKm}km)</span>
          </button>
        </div>
      </div>

      {/* 1.5. SIGNAL STRENGTH, LATENCY HEATMAP & PATHFINDING LEGENDS BAR */}
      <div className="absolute top-16 left-4 right-4 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Signal Strength & Dynamic Line Thickness Legend */}
          <div
            className={`pointer-events-auto px-3 py-1.5 rounded-xl border shadow-sm backdrop-blur-md flex flex-wrap items-center gap-2.5 text-[10px] font-mono ${
              isNightMode
                ? 'bg-[#141F12]/90 border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-white/95 border-[#87A878]/35 text-[#203A2A]'
            }`}
          >
            <span className="font-bold flex items-center gap-1 text-[#203A2A] dark:text-[#F0F5EE]">
              <Signal className="w-3 h-3 text-[#10B981] dark:text-[#33ff00]" />
              <span>Signal (RSSI):</span>
            </span>
            <span className="flex items-center gap-1 text-[#10B981] dark:text-[#33ff00] font-semibold">
              <span className="w-4 h-1 rounded bg-[#10B981] dark:bg-[#33ff00]" /> &gt; -65dBm
            </span>
            <span className="flex items-center gap-1 text-[#588157] dark:text-[#87A878] font-semibold">
              <span className="w-3.5 h-0.75 rounded bg-[#588157] dark:bg-[#87A878]" /> -66..-78dBm
            </span>
            <span className="flex items-center gap-1 text-[#E9C46A] font-semibold">
              <span className="w-3 h-0.5 rounded bg-[#E9C46A]" /> -79..-88dBm
            </span>
            <span className="flex items-center gap-1 text-[#EF4444] font-semibold">
              <span className="w-2.5 h-0.5 rounded bg-[#EF4444]" /> &lt; -88dBm
            </span>
          </div>

          {/* Shortest Hop Count Pathfinding Metrics Legend */}
          {showPathfindingLayer && (
            <div
              className={`pointer-events-auto px-3 py-1.5 rounded-xl border shadow-sm backdrop-blur-md flex flex-wrap items-center gap-2 text-[10px] font-mono animate-in fade-in duration-200 ${
                isNightMode
                  ? 'bg-[#141F12]/95 border-[#0284C7]/50 text-[#A8BDA5]'
                  : 'bg-white/95 border-[#0284C7]/50 text-[#203A2A]'
              }`}
            >
              <span className="font-bold flex items-center gap-1 text-[#0284C7]">
                <Route className="w-3 h-3" />
                <span>Shortest Hops:</span>
              </span>
              <span className="flex items-center gap-1 text-[#10B981] dark:text-[#33ff00] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> 1 Hop (Direct: {pathfindingMetrics.directHopCount})
              </span>
              <span className="flex items-center gap-1 text-[#06B6D4] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#06B6D4]" /> 2 Hops (1 Relay: {pathfindingMetrics.relay1HopCount})
              </span>
              <span className="flex items-center gap-1 text-[#E9C46A] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#E9C46A]" /> 3+ Hops ({pathfindingMetrics.relay2PlusHopCount})
              </span>
              {pathfindingMetrics.unreachableCount > 0 && (
                <span className="flex items-center gap-1 text-[#EF4444] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Unreachable ({pathfindingMetrics.unreachableCount})
                </span>
              )}
              <span className="hidden xl:inline-block border-l border-current/20 pl-2 text-[9px] opacity-80">
                Avg: {pathfindingMetrics.avgHopCount}H • Max: {pathfindingMetrics.maxHopCount}H
              </span>
            </div>
          )}

          {/* Latency Heatmap Pathfinding Legend */}
          {showLatencyHeatmap && (
            <div
              className={`pointer-events-auto px-3 py-1.5 rounded-xl border shadow-sm backdrop-blur-md flex flex-wrap items-center gap-2 text-[10px] font-mono animate-in fade-in duration-200 ${
                isNightMode
                  ? 'bg-[#141F12]/95 border-[#2A9D8F]/50 text-[#A8BDA5]'
                  : 'bg-white/95 border-[#2A9D8F]/50 text-[#203A2A]'
              }`}
            >
              <span className="font-bold flex items-center gap-1 text-[#2A9D8F]">
                <Activity className="w-3 h-3 text-[#10B981]" />
                <span>Ping Latency:</span>
              </span>
              <span className="flex items-center gap-1 text-[#10B981] dark:text-[#33ff00] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> &lt;40ms
              </span>
              <span className="flex items-center gap-1 text-[#2A9D8F] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#2A9D8F]" /> 40-75ms
              </span>
              <span className="flex items-center gap-1 text-[#E9C46A] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#E9C46A]" /> 76-110ms
              </span>
              <span className="flex items-center gap-1 text-[#EF4444] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> &gt;110ms
              </span>
            </div>
          )}
        </div>

        {/* Signal Badge Display Selector */}
        <div
          className={`pointer-events-auto px-2.5 py-1 rounded-xl border shadow-sm backdrop-blur-md flex items-center gap-1.5 text-[10px] font-mono ${
            isNightMode
              ? 'bg-[#141F12]/90 border-[#2A3B26]'
              : 'bg-white/95 border-[#87A878]/35'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setShowSignalBadges(!showSignalBadges);
            }}
            className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
              showSignalBadges
                ? 'bg-[#588157] text-white'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-white'
            }`}
          >
            Labels: {showSignalBadges ? 'ON' : 'OFF'}
          </button>

          {showSignalBadges && (
            <div className="flex items-center gap-1 pl-1 border-l border-[#87A878]/25">
              {(['rssi', 'latency', 'combined'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    soundFeedback.playClick();
                    setSignalBadgeMetric(mode);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    signalBadgeMetric === mode
                      ? 'bg-[#2A9D8F] text-white'
                      : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-white'
                  }`}
                >
                  {mode === 'rssi' ? 'dBm' : mode === 'latency' ? 'RTT' : 'Both'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. FLOATING PROXIMITY & DENSITY SETTINGS ACCORDION */}
      {showControlsHUD && (
        <div
          className={`absolute top-28 left-4 z-25 w-80 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md space-y-3 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 text-xs ${
            isNightMode
              ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between pb-1 border-b border-[#87A878]/20">
            <span className="font-bold font-mono text-[11px] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#33ff00]" />
              RF Topology & Signal Controls
            </span>
            <button
              type="button"
              onClick={() => setShowControlsHUD(false)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#637062] dark:text-[#A8BDA5]">Direct RF Link Radius:</span>
              <span className="font-bold text-[#588157] dark:text-[#33ff00]">{linkThresholdKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={3.8}
              step={0.2}
              value={linkThresholdKm}
              onChange={(e) => setLinkThresholdKm(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#87A878]/30 rounded-lg appearance-none cursor-pointer accent-[#588157]"
            />
            <div className="flex justify-between text-[9px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
              <span>0.8km (Dense Urban)</span>
              <span>2.2km</span>
              <span>3.8km (Rural/LoS)</span>
            </div>
          </div>

          {/* Filter Quality Toggles */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">Signal Quality Filter:</div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setFilterSignalStrength('all');
                }}
                className={`py-1 px-1.5 rounded-lg border text-[9px] font-bold text-center cursor-pointer transition-all ${
                  filterSignalStrength === 'all'
                    ? 'bg-[#588157] text-white border-[#588157]'
                    : isNightMode
                    ? 'bg-[#1A2617] border-[#2A3B26] text-[#A8BDA5]'
                    : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#637062]'
                }`}
              >
                All Links
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setFilterSignalStrength('strong');
                }}
                className={`py-1 px-1.5 rounded-lg border text-[9px] font-bold text-center cursor-pointer transition-all ${
                  filterSignalStrength === 'strong'
                    ? 'bg-[#588157] text-white border-[#588157]'
                    : isNightMode
                    ? 'bg-[#1A2617] border-[#2A3B26] text-[#A8BDA5]'
                    : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#637062]'
                }`}
              >
                Strong Only
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setFilterSignalStrength('high_latency');
                }}
                className={`py-1 px-1.5 rounded-lg border text-[9px] font-bold text-center cursor-pointer transition-all ${
                  filterSignalStrength === 'high_latency'
                    ? 'bg-red-500 text-white border-red-500'
                    : isNightMode
                    ? 'bg-[#1A2617] border-[#2A3B26] text-red-400'
                    : 'bg-[#FAF6EE] border-red-500/30 text-red-600'
                }`}
              >
                High Latency
              </button>
            </div>
          </div>

          {/* Latency Heatmap & Pathfinding Section */}
          <div className="pt-2 border-t border-[#87A878]/15 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#637062] dark:text-[#A8BDA5] font-semibold">Latency Heatmap Overlay</span>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setShowLatencyHeatmap(!showLatencyHeatmap);
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                  showLatencyHeatmap
                    ? 'bg-[#2A9D8F] text-white'
                    : isNightMode
                    ? 'bg-[#1A2617] text-[#A8BDA5]'
                    : 'bg-black/10 text-[#637062]'
                }`}
              >
                {showLatencyHeatmap ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
            <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5] font-mono">
              Colors nodes based on average ping latency to help choose optimal mesh paths and identify lag bottlenecks.
            </div>
            <div className="p-1.5 rounded-lg border bg-black/5 dark:bg-black/20 border-[#87A878]/20 flex items-center justify-between text-[9px] font-mono">
              <span>Dynamic RSSI Thickness:</span>
              <span className="font-bold text-[#588157] dark:text-[#33ff00]">1.3px - 5.6px scale</span>
            </div>
          </div>

          {/* Pathfinding Shortest Hop Count Metrics Layer Section */}
          <div className="pt-2 border-t border-[#87A878]/15 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-bold">
                <Route className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Pathfinding & Hop Metrics</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFeedback.playClick();
                  setShowPathfindingLayer(!showPathfindingLayer);
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                  showPathfindingLayer
                    ? 'bg-[#0284C7] text-white'
                    : isNightMode
                    ? 'bg-[#1A2617] text-[#A8BDA5]'
                    : 'bg-black/10 text-[#637062]'
                }`}
              >
                {showPathfindingLayer ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5] font-mono leading-relaxed">
              Computes shortest-path hop counts, route relays, and reachability wavefronts from your local node using Breadth-First Search (BFS).
            </div>

            {/* Pathfinding Quick Hop Stats */}
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-black/20 border border-[#87A878]/20 text-center">
                <div className="text-[#637062] dark:text-[#A8BDA5] text-[8px]">Direct (1H)</div>
                <div className="font-bold text-[#10B981] dark:text-[#33ff00]">
                  {pathfindingMetrics.directHopCount} peers
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-black/20 border border-[#87A878]/20 text-center">
                <div className="text-[#637062] dark:text-[#A8BDA5] text-[8px]">1-Relay (2H)</div>
                <div className="font-bold text-[#06B6D4]">
                  {pathfindingMetrics.relay1HopCount} peers
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-black/20 border border-[#87A878]/20 text-center">
                <div className="text-[#637062] dark:text-[#A8BDA5] text-[8px]">Avg Hops</div>
                <div className="font-bold text-[#E9C46A]">
                  {pathfindingMetrics.avgHopCount} hops
                </div>
              </div>
            </div>
          </div>

          {/* Animated Packet Flow Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-[#87A878]/15 text-[11px]">
            <span className="text-[#637062] dark:text-[#A8BDA5]">Animate Relay Packets</span>
            <button
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                setShowPacketFlow(!showPacketFlow);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                showPacketFlow
                  ? 'bg-[#588157] text-white'
                  : isNightMode
                  ? 'bg-[#1A2617] text-[#A8BDA5]'
                  : 'bg-black/10 text-[#637062]'
              }`}
            >
              {showPacketFlow ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* 3. FLOATING ZOOM & RECENTER CONTROLS (Right Side) */}
      <div className="absolute right-4 top-28 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          className={`w-9 h-9 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
              : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
          }`}
          title="Zoom In"
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
          title="Zoom Out"
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
          title="Recenter Topology View"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* 4. PRIMARY D3 TOPOLOGY SVG CANVAS */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
        width={dimensions.width}
        height={dimensions.height}
      />

      {/* 5. INTERACTIVE NODE INSPECTION BOTTOM CARD */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md space-y-3 ${
              isNightMode
                ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs border ${
                    selectedNode.isUser
                      ? 'bg-[#588157] text-white border-[#588157]'
                      : selectedNode.degree >= 3
                      ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                      : isNightMode
                      ? 'bg-[#1A291A] text-[#33ff00] border-[#2A3B26]'
                      : 'bg-[#FAF6EE] text-[#588157] border-[#87A878]/30'
                  }`}
                >
                  {selectedNode.isUser ? 'YOU' : selectedNode.callsign.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <span>{selectedNode.callsign}</span>
                    {selectedNode.degree >= 3 && !selectedNode.isUser && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#2A9D8F]/20 text-[#2A9D8F]">
                        Mesh Hub ({selectedNode.degree} links)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#637062] dark:text-[#A8BDA5] font-mono">
                    {selectedNode.reputationTier} • {selectedNode.radioType}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Signal & Density Metrics */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Direct Links</div>
                <div className="font-bold text-xs text-[#588157] dark:text-[#33ff00]">{selectedNode.degree}</div>
              </div>
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Signal (RSSI)</div>
                <div className="font-bold text-xs text-[#E9C46A]">{selectedNode.lastRssi} dBm</div>
              </div>
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Distance</div>
                <div className="font-bold text-xs text-[#2A9D8F]">
                  {selectedNode.isUser ? '0 km' : `${selectedNode.distanceKm.toFixed(2)} km`}
                </div>
              </div>
              <div className={`p-2 rounded-xl border ${
                selectedNode.latencyStatus === 'bottleneck'
                  ? 'bg-red-500/15 border-red-500/40 text-red-500'
                  : selectedNode.latencyStatus === 'ultra_low'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-[#33ff00]'
                  : isNightMode
                  ? 'bg-[#182315] border-[#2A3B26]'
                  : 'bg-[#FAF6EE] border-[#87A878]/20'
              }`}>
                <div className="text-[9px] text-current opacity-80">Avg Ping / RTT</div>
                <div className="font-bold text-xs">{selectedNode.avgLatencyMs ?? 20} ms</div>
              </div>
            </div>

            {/* Pathfinding Decision & Latency Heatmap Guidance */}
            <div className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono ${
              selectedNode.latencyStatus === 'bottleneck'
                ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                : selectedNode.latencyStatus === 'degraded'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                : isNightMode
                ? 'bg-[#182315] border-[#2A3B26] text-[#A8BDA5]'
                : 'bg-[#FAF6EE] border-[#87A878]/20 text-[#203A2A]'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <Activity className="w-3.5 h-3.5 shrink-0 text-[#2A9D8F]" />
                <span className="truncate">
                  <span className="font-bold">Pathfinding: </span>
                  {selectedNode.pathfindingRating}
                </span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                selectedNode.latencyStatus === 'ultra_low'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#33ff00]'
                  : selectedNode.latencyStatus === 'stable'
                  ? 'bg-[#2A9D8F]/20 text-[#2A9D8F]'
                  : selectedNode.latencyStatus === 'degraded'
                  ? 'bg-amber-500/20 text-amber-600'
                  : 'bg-red-500/20 text-red-500'
              }`}>
                {selectedNode.latencyStatus}
              </span>
            </div>

            {/* Shortest Hop Route Pathfinding Info */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 font-mono ${
              isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold flex items-center gap-1.5 text-[#0284C7]">
                  <Route className="w-3.5 h-3.5" />
                  <span>Shortest Path from Local Root:</span>
                </span>
                <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                  selectedNode.isUser
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#33ff00]'
                    : !selectedNode.isReachable
                    ? 'bg-red-500/20 text-red-500'
                    : selectedNode.shortestHopCount === 1
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#33ff00]'
                    : selectedNode.shortestHopCount === 2
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}>
                  {selectedNode.isUser
                    ? 'ROOT NODE (0 HOPS)'
                    : !selectedNode.isReachable
                    ? 'UNREACHABLE'
                    : `${selectedNode.shortestHopCount} HOP${selectedNode.shortestHopCount > 1 ? 'S' : ''}`}
                </span>
              </div>

              {selectedNode.isUser ? (
                <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                  This is your local radio transceiver. All mesh routing paths originate here.
                </div>
              ) : selectedNode.isReachable ? (
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-1 text-[#203A2A] dark:text-[#F0F5EE] font-bold overflow-x-auto py-0.5">
                    {selectedNode.shortestPathNodeIds.map((nodeId, idx) => {
                      const n = nodes.find((item) => item.id === nodeId);
                      const name = n?.isUser ? 'YOU' : n?.callsign || nodeId;
                      return (
                        <span key={nodeId} className="flex items-center gap-1 shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            n?.isUser
                              ? 'bg-[#10B981]/20 text-[#10B981] dark:text-[#33ff00]'
                              : nodeId === selectedNode.id
                              ? 'bg-[#0284C7]/20 text-[#0284C7]'
                              : 'bg-black/10 dark:bg-white/10 text-current'
                          }`}>
                            {name}
                          </span>
                          {idx < selectedNode.shortestPathNodeIds.length - 1 && (
                            <span className="text-[#0284C7] font-bold">→</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#637062] dark:text-[#A8BDA5] pt-0.5 border-t border-[#87A878]/15">
                    <span>Cumulative Route Latency:</span>
                    <span className="font-bold text-[#0284C7]">{selectedNode.pathLatencyMs} ms</span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-red-500">
                  Node is isolated or out of direct/relay radio range. Increase RF link radius.
                </div>
              )}
            </div>

            {/* Connected Peer Signal Strengths */}
            {connectedNodeLinks.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-[#87A878]/15">
                <div className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] flex items-center justify-between">
                  <span>Connected Mesh Peers & Signal:</span>
                  <span className="font-bold text-[#588157] dark:text-[#33ff00]">{connectedNodeLinks.length} Links</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5">
                  {connectedNodeLinks.map((link) => {
                    const peerId = link.sourceId === selectedNode.id ? link.targetId : link.sourceId;
                    const peerNode = nodes.find((n) => n.id === peerId);
                    const callsign = peerNode ? peerNode.callsign : peerId;
                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => {
                          soundFeedback.playClick();
                          setSelectedLinkId(link.id);
                        }}
                        className={`w-full p-1.5 rounded-lg border text-left flex items-center justify-between text-[11px] font-mono transition-all cursor-pointer ${
                          selectedLinkId === link.id
                            ? 'border-[#E9C46A] bg-[#E9C46A]/10'
                            : isNightMode
                            ? 'bg-[#182315]/80 border-[#2A3B26] hover:border-[#588157]'
                            : 'bg-white/80 border-[#87A878]/20 hover:border-[#588157]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              link.isHighLatency
                                ? 'bg-[#EF4444]'
                                : link.quality === 'excellent'
                                ? 'bg-[#10B981] dark:bg-[#33ff00]'
                                : link.quality === 'good'
                                ? 'bg-[#588157]'
                                : 'bg-[#E9C46A]'
                            }`}
                          />
                          <span className="font-bold truncate">{callsign}</span>
                          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">
                            ({link.distanceKm}km)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                          <span
                            className={`font-bold px-1 py-0.2 rounded text-[9px] ${
                              link.isHighLatency
                                ? 'bg-red-500/20 text-red-500'
                                : link.quality === 'excellent'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#33ff00]'
                                : link.quality === 'good'
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {link.rssi} dBm
                          </span>
                          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">
                            {link.latencyMs}ms
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions for Peers */}
            {!selectedNode.isUser && selectedNode.peerRef && (
              <div className="flex items-center gap-2 pt-1 border-t border-[#87A878]/15">
                {onOpenChatWithPeer && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFeedback.playClick();
                      onOpenChatWithPeer(selectedNode.peerRef!);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#588157] hover:bg-[#476a46] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat via Mesh</span>
                  </button>
                )}

                {onOpenReputation && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFeedback.playClick();
                      onOpenReputation(selectedNode.peerRef!);
                    }}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isNightMode
                        ? 'bg-[#1A2617] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                        : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>Vouch</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. INTERACTIVE LINK INSPECTION BOTTOM CARD */}
      {selectedLink && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3.5 rounded-2xl border shadow-xl backdrop-blur-md space-y-2.5 ${
              isNightMode
                ? 'bg-[#141F12]/95 border-[#2A3B26] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/40 text-[#203A2A]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#33ff00]" />
                <span>RF Mesh Relay Link Details</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLinkId(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Length / RSSI</div>
                <div className="font-bold text-xs text-[#588157] dark:text-[#33ff00]">
                  {selectedLink.distanceKm} km · {selectedLink.rssi} dBm
                </div>
              </div>
              <div className={`p-2 rounded-xl border ${
                selectedLink.isHighLatency
                  ? 'bg-red-500/15 border-red-500/40 text-red-500'
                  : isNightMode
                  ? 'bg-[#182315] border-[#2A3B26]'
                  : 'bg-[#FAF6EE] border-[#87A878]/20'
              }`}>
                <div className="text-[9px] text-current opacity-80">Link Latency (RTT)</div>
                <div className="font-bold text-xs">{selectedLink.latencyMs} ms</div>
              </div>
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Mesh Reliability</div>
                <div className="font-bold text-xs text-[#E9C46A]">
                  {selectedLink.reliabilityScore}%
                </div>
              </div>
              <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                <div className="text-[9px] text-[#637062] dark:text-[#A8BDA5]">Line Thickness</div>
                <div className="font-bold text-xs text-[#2A9D8F]">{selectedLink.baseThickness} px</div>
              </div>
            </div>

            {/* Visual Gauge Bar: Reliability & Dynamic RSSI Thickness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                <span>Link Reliability Score:</span>
                <span className="font-bold text-[#588157] dark:text-[#33ff00]">{selectedLink.reliabilityScore} / 100</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-black/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    selectedLink.reliabilityScore >= 80
                      ? 'bg-[#10B981]'
                      : selectedLink.reliabilityScore >= 60
                      ? 'bg-[#588157]'
                      : selectedLink.reliabilityScore >= 40
                      ? 'bg-[#E9C46A]'
                      : 'bg-[#EF4444]'
                  }`}
                  style={{ width: `${selectedLink.reliabilityScore}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
              <div>
                Status: <span className="font-bold uppercase text-[#588157] dark:text-[#33ff00]">{selectedLink.quality}</span> RF path margin ({selectedLink.bandwidthKbps} kbps)
              </div>
              {selectedLink.isHighLatency ? (
                <div className="text-red-500 font-bold flex items-center gap-1">
                  <span>⚠️ High Latency ({selectedLink.latencyMs}ms)</span>
                </div>
              ) : (
                <div className="text-[#10B981] dark:text-[#33ff00] font-bold flex items-center gap-1">
                  <span>✓ Path Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE CONNECTION HOVER TOOLTIP */}
      {hoveredLinkData && (
        <div
          className={`fixed z-50 pointer-events-none p-2.5 rounded-xl border shadow-xl backdrop-blur-md text-[11px] font-mono transition-all transform -translate-x-1/2 -translate-y-full mb-3 animate-in fade-in zoom-in-95 duration-100 ${
            isNightMode
              ? 'bg-[#141F12]/95 border-[#2A9D8F]/60 text-[#F0F5EE]'
              : 'bg-white/95 border-[#2A9D8F]/50 text-[#203A2A]'
          }`}
          style={{ left: hoveredLinkData.x, top: hoveredLinkData.y - 12 }}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1 text-[11px]">
            <Radio className="w-3.5 h-3.5 text-[#33ff00]" />
            <span>Interactive Mesh Relay Connection</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Signal (RSSI): </span>
              <span className="font-bold text-[#588157] dark:text-[#33ff00]">{hoveredLinkData.link.rssi} dBm</span>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Thickness: </span>
              <span className="font-bold text-[#2A9D8F]">{hoveredLinkData.link.baseThickness}px</span>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Latency: </span>
              <span className={`font-bold ${hoveredLinkData.link.isHighLatency ? 'text-red-500' : 'text-[#10B981]'}`}>
                {hoveredLinkData.link.latencyMs}ms
              </span>
            </div>
            <div>
              <span className="text-[#637062] dark:text-[#A8BDA5]">Reliability: </span>
              <span className="font-bold text-[#E9C46A]">{hoveredLinkData.link.reliabilityScore}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
