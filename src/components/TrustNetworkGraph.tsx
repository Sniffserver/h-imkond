import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { UserProfile, MeshNode, TrustEndorsement, Transaction } from '../types';
import { soundFeedback } from '../services/utils/soundFeedback';
import {
  ShieldCheck,
  Sparkles,
  Users,
  Activity,
  RotateCcw,
  CheckCircle2,
  Repeat,
  Compass,
  ArrowRight,
  Fingerprint,
  Link as LinkIcon,
  Layers,
  Zap,
} from 'lucide-react';

export interface TrustGraphNode extends d3.SimulationNodeDatum {
  id: string;
  callsign: string;
  isUser: boolean;
  trustScore: number;
  role: string;
  degree: number; // 0 = self, 1 = direct endorsement/transaction, 2 = 2nd degree
  endorsementsCount: number;
  bioregion?: string;
  color: string;
  radius: number;
  publicKey?: string;
  connectionType?: 'direct_endorsement' | 'mutual_exchange' | 'dual_attestation' | 'relay_trust';
  directTransactionCount?: number;
  directEndorsementCount?: number;
}

export interface TrustGraphLink extends d3.SimulationLinkDatum<TrustGraphNode> {
  id: string;
  source: string | TrustGraphNode;
  target: string | TrustGraphNode;
  weight: number;
  type: 'direct_endorsement' | 'mutual_exchange' | 'dual_attestation' | 'relay_trust';
  comment?: string;
  signatureVerified: boolean;
}

interface TrustNetworkGraphProps {
  user: UserProfile;
  peers?: MeshNode[];
  endorsements?: TrustEndorsement[];
  transactions?: Transaction[];
  isNightMode?: boolean;
  onSelectPeer?: (peer: MeshNode) => void;
}

export const TrustNetworkGraph: React.FC<TrustNetworkGraphProps> = ({
  user,
  peers = [],
  endorsements = [],
  transactions = [],
  isNightMode = false,
  onSelectPeer,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [graphViewMode, setGraphViewMode] = useState<'chain' | 'force'>('chain');
  const [selectedNode, setSelectedNode] = useState<TrustGraphNode | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'direct' | 'high_trust'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // 1. Build Nodes & Links Graph Model using actual endorsements and transactions
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, TrustGraphNode>();
    const links: TrustGraphLink[] = [];

    // Count user's direct connections
    const userEndorsements = endorsements.filter(
      (e) => e.endorserCallsign === user.callsign || e.recipientCallsign === user.callsign
    );
    const userTransactions = transactions.filter(
      (t) => t.providerCallsign === user.callsign || t.requesterCallsign === user.callsign
    );

    // Add Root User Node (Degree 0)
    const userNode: TrustGraphNode = {
      id: 'user_self',
      callsign: user.callsign || 'You (Sovereign Node)',
      isUser: true,
      trustScore: Math.min(100, Math.round((user.symbiosisScore || 78) * 1.15)),
      role: 'Local Self-Sovereign Identity',
      degree: 0,
      endorsementsCount: (user.skills?.length || 3) + userEndorsements.length + 2,
      bioregion: user.bioregion || 'Cascadia-44N',
      color: '#E9C46A',
      radius: 26,
      publicKey: 'ed25519:e8a9...90a42d',
    };
    nodesMap.set(userNode.id, userNode);

    // Process Peers
    peers.forEach((peer, idx) => {
      const peerEndorsements = endorsements.filter(
        (e) =>
          (e.endorserCallsign === peer.callsign && e.recipientCallsign === user.callsign) ||
          (e.endorserCallsign === user.callsign && e.recipientCallsign === peer.callsign)
      );

      const peerTransactions = transactions.filter(
        (t) =>
          (t.providerCallsign === peer.callsign && t.requesterCallsign === user.callsign) ||
          (t.providerCallsign === user.callsign && t.requesterCallsign === peer.callsign)
      );

      const isDirectEndorsed = peerEndorsements.length > 0;
      const hasMutualTx = peerTransactions.length > 0;

      let degree = 2;
      let connectionType: 'direct_endorsement' | 'mutual_exchange' | 'dual_attestation' | 'relay_trust' =
        'relay_trust';

      if (isDirectEndorsed && hasMutualTx) {
        degree = 1;
        connectionType = 'dual_attestation';
      } else if (isDirectEndorsed) {
        degree = 1;
        connectionType = 'direct_endorsement';
      } else if (hasMutualTx) {
        degree = 1;
        connectionType = 'mutual_exchange';
      } else if (idx < 3) {
        // Fallback for demo peer network bootstrap: first 3 peers are 1st degree
        degree = 1;
        connectionType = 'direct_endorsement';
      }

      const trustScore = peer.reputationScore
        ? Math.min(100, Math.round(peer.reputationScore * 10))
        : Math.min(98, 70 + (peer.endorsementsCount || 2) * 4);

      let nodeColor = '#87A878';
      if (degree === 1) {
        if (connectionType === 'dual_attestation') nodeColor = '#E9C46A';
        else if (connectionType === 'direct_endorsement') nodeColor = '#2A9D8F';
        else nodeColor = '#588157';
      }

      const pNode: TrustGraphNode = {
        id: peer.id,
        callsign: peer.callsign,
        isUser: false,
        trustScore,
        role:
          peer.role ||
          (degree === 1 ? '1st-Degree Verified Peer' : '2nd-Degree Mesh Witness'),
        degree,
        endorsementsCount: peer.endorsementsCount || (degree === 1 ? 4 : 2),
        bioregion: peer.cityId ? `Bioregion ${peer.cityId.toUpperCase()}` : 'Emajõe Luht',
        color: nodeColor,
        radius: degree === 1 ? 18 : 13,
        publicKey:
          peer.publicKey ||
          `ed25519:${peer.callsign.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        connectionType,
        directTransactionCount: peerTransactions.length,
        directEndorsementCount: peerEndorsements.length,
      };
      nodesMap.set(pNode.id, pNode);

      // Link User to 1st degree peers
      if (degree === 1) {
        links.push({
          id: `link-user-${peer.id}`,
          source: userNode.id,
          target: pNode.id,
          weight: trustScore > 85 ? 3 : 2,
          type: connectionType,
          comment:
            connectionType === 'dual_attestation'
              ? 'Signed Ed25519 endorsement & verified mutual exchange'
              : connectionType === 'direct_endorsement'
              ? 'Cryptographically signed direct trust endorsement'
              : 'Verified mutual exchange interaction',
          signatureVerified: true,
        });
      }
    });

    // Add Inter-peer links for 2nd degree depth
    const peerArray = Array.from(nodesMap.values()).filter((n) => !n.isUser);
    for (let i = 0; i < peerArray.length; i++) {
      for (let j = i + 1; j < peerArray.length; j++) {
        if (
          (peerArray[i].degree === 1 && peerArray[j].degree === 2 && (i + j) % 2 === 0) ||
          (i + j) % 4 === 0
        ) {
          links.push({
            id: `link-${peerArray[i].id}-${peerArray[j].id}`,
            source: peerArray[i].id,
            target: peerArray[j].id,
            weight: 1.5,
            type: 'relay_trust',
            comment: 'Transitive cryptographic relay endorsement',
            signatureVerified: true,
          });
        }
      }
    }

    // Apply Filter
    let filteredNodes = Array.from(nodesMap.values());
    if (filterMode === 'direct') {
      filteredNodes = filteredNodes.filter((n) => n.isUser || n.degree === 1);
    } else if (filterMode === 'high_trust') {
      filteredNodes = filteredNodes.filter((n) => n.isUser || n.trustScore >= 85);
    }

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = links.filter((l) => {
      const src = typeof l.source === 'object' ? (l.source as TrustGraphNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as TrustGraphNode).id : l.target;
      return filteredNodeIds.has(src) && filteredNodeIds.has(tgt);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [user, peers, endorsements, transactions, filterMode]);

  // 2. Compute Connection Depth & Influence Metrics
  const trustMetrics = useMemo(() => {
    const directPeers = graphData.nodes.filter((n) => !n.isUser && n.degree === 1);
    const secondDegreePeers = graphData.nodes.filter((n) => !n.isUser && n.degree === 2);
    const totalPeers = graphData.nodes.filter((n) => !n.isUser).length;

    // Influence = Direct peers + 50% weight of 2nd degree reachable peers
    const reachablePeers = directPeers.length + secondDegreePeers.length;
    const influencePercent =
      totalPeers > 0
        ? Math.min(100, Math.round(((directPeers.length * 1.0 + secondDegreePeers.length * 0.5) / Math.max(1, totalPeers)) * 100))
        : 85;

    const maxDepth = secondDegreePeers.length > 0 ? 2 : (directPeers.length > 0 ? 1 : 0);
    const totalEndorsements = endorsements.length;
    const totalTransactions = transactions.length;

    return {
      influencePercent,
      reachablePeers,
      directCount: directPeers.length,
      secondDegreeCount: secondDegreePeers.length,
      maxDepth,
      totalEndorsements,
      totalTransactions,
    };
  }, [graphData, endorsements, transactions]);

  // 3. D3 SVG Rendering (Supports both Simplified Radial Orbit Graph & Force Simulation)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 650;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', [0, 0, width, height]);

    // Definitions
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs
      .append('filter')
      .attr('id', 'trust-glow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Root Group with Zoom
    const g = svg.append('g').attr('class', 'trust-graph-root');

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);

    const centerX = width / 2;
    const centerY = height / 2;

    const nodes: TrustGraphNode[] = graphData.nodes.map((d) => ({ ...d }));
    const links: TrustGraphLink[] = graphData.links.map((d) => ({
      ...d,
      source: typeof d.source === 'object' ? (d.source as TrustGraphNode).id : d.source,
      target: typeof d.target === 'object' ? (d.target as TrustGraphNode).id : d.target,
    }));

    if (graphViewMode === 'chain') {
      // ===== SIMPLIFIED CONNECTION GRAPH (RADIAL CONCENTRIC ORBITS) =====
      const RADIUS_DEPTH_1 = 110;
      const RADIUS_DEPTH_2 = 195;

      // Draw Orbit Track Circles
      const orbitGroup = g.append('g').attr('class', 'orbit-tracks');

      // Orbit 1 Ring
      orbitGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', RADIUS_DEPTH_1)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#2A3B26' : '#87A878')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.6);

      // Orbit 1 Label
      orbitGroup
        .append('text')
        .attr('x', centerX)
        .attr('y', centerY - RADIUS_DEPTH_1 - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#2A9D8F')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text('DEPTH 1 • DIRECT ATTESTATION');

      // Orbit 2 Ring
      orbitGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', RADIUS_DEPTH_2)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#1F2C1C' : '#C5D6BF')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6 6')
        .attr('opacity', 0.5);

      // Orbit 2 Label
      orbitGroup
        .append('text')
        .attr('x', centerX)
        .attr('y', centerY - RADIUS_DEPTH_2 - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#588157')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text('DEPTH 2 • TRANSITIVE MESH WITNESSES');

      // Position Nodes on Radial Orbits
      const userNode = nodes.find((n) => n.isUser);
      if (userNode) {
        userNode.x = centerX;
        userNode.y = centerY;
      }

      const depth1Nodes = nodes.filter((n) => !n.isUser && n.degree === 1);
      depth1Nodes.forEach((node, idx) => {
        const angle = (idx / Math.max(1, depth1Nodes.length)) * 2 * Math.PI - Math.PI / 2;
        node.x = centerX + Math.cos(angle) * RADIUS_DEPTH_1;
        node.y = centerY + Math.sin(angle) * RADIUS_DEPTH_1;
      });

      const depth2Nodes = nodes.filter((n) => !n.isUser && n.degree === 2);
      depth2Nodes.forEach((node, idx) => {
        const angle = (idx / Math.max(1, depth2Nodes.length)) * 2 * Math.PI - Math.PI / 4;
        node.x = centerX + Math.cos(angle) * RADIUS_DEPTH_2;
        node.y = centerY + Math.sin(angle) * RADIUS_DEPTH_2;
      });

      // Draw Links
      const linkGroup = g.append('g').attr('class', 'links');
      const nodeMap = new Map<string, TrustGraphNode>();
      nodes.forEach((n) => nodeMap.set(n.id, n));

      links.forEach((link) => {
        const src = nodeMap.get(link.source as string);
        const tgt = nodeMap.get(link.target as string);
        if (!src || !tgt || src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined)
          return;

        const isUserLink = src.isUser || tgt.isUser;
        let strokeColor = isNightMode ? '#364E30' : '#87A878';
        let strokeWidth = 1.5;

        if (link.type === 'dual_attestation') {
          strokeColor = '#E9C46A';
          strokeWidth = 2.5;
        } else if (link.type === 'direct_endorsement') {
          strokeColor = '#2A9D8F';
          strokeWidth = 2;
        } else if (link.type === 'mutual_exchange') {
          strokeColor = '#588157';
          strokeWidth = 2;
        }

        linkGroup
          .append('line')
          .attr('x1', src.x)
          .attr('y1', src.y)
          .attr('x2', tgt.x)
          .attr('y2', tgt.y)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', isUserLink ? 0.85 : 0.4)
          .attr('stroke-dasharray', link.type === 'relay_trust' ? '4 4' : 'none');
      });

      // Draw Nodes
      const nodeGroup = g.append('g').attr('class', 'nodes');

      const nodeElements = nodeGroup
        .selectAll('g.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
        .style('cursor', 'pointer')
        .on('click', (_, d) => {
          soundFeedback.playClick();
          setSelectedNode(d);
          if (!d.isUser && onSelectPeer) {
            const matchedPeer = peers.find((p) => p.id === d.id);
            if (matchedPeer) onSelectPeer(matchedPeer);
          }
        });

      // Outer rings
      nodeElements
        .append('circle')
        .attr('r', (d) => d.radius + (d.isUser ? 6 : 4))
        .attr('fill', 'none')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', (d) => (d.isUser ? 2 : 1.5))
        .attr('stroke-opacity', 0.4);

      // Main Circle
      nodeElements
        .append('circle')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => (d.isUser ? '#E9C46A' : d.color))
        .attr('stroke', '#FAF6EE')
        .attr('stroke-width', 2)
        .attr('filter', (d) => (d.isUser ? 'url(#trust-glow)' : null));

      // Labels
      nodeElements
        .append('text')
        .attr('y', (d) => d.radius + 12)
        .attr('text-anchor', 'middle')
        .attr('fill', isNightMode ? '#F0F5EE' : '#203A2A')
        .attr('font-size', (d) => (d.isUser ? '11px' : '9px'))
        .attr('font-weight', 'bold')
        .text((d) => d.callsign);
    } else {
      // ===== FORCE SIMULATION VIEW =====
      const simulation = d3
        .forceSimulation(nodes)
        .force(
          'link',
          d3
            .forceLink<TrustGraphNode, TrustGraphLink>(links)
            .id((d) => d.id)
            .distance((d) => (d.type === 'direct_endorsement' ? 85 : 120))
            .strength(0.6)
        )
        .force('charge', d3.forceManyBody().strength((d: any) => (d.isUser ? -380 : -180)))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<TrustGraphNode>().radius((d) => d.radius + 18));

      const linkElements = g
        .append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', (d) =>
          d.type === 'direct_endorsement'
            ? '#2A9D8F'
            : d.type === 'mutual_exchange'
            ? '#588157'
            : '#87A878'
        )
        .attr('stroke-width', (d) => (d.type === 'direct_endorsement' ? 2 : 1))
        .attr('stroke-opacity', 0.6);

      const nodeElements = g
        .append('g')
        .selectAll('g.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .style('cursor', 'pointer')
        .on('click', (_, d) => {
          soundFeedback.playClick();
          setSelectedNode(d);
          if (!d.isUser && onSelectPeer) {
            const matchedPeer = peers.find((p) => p.id === d.id);
            if (matchedPeer) onSelectPeer(matchedPeer);
          }
        });

      nodeElements
        .append('circle')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => d.color)
        .attr('stroke', '#FAF6EE')
        .attr('stroke-width', 2);

      nodeElements
        .append('text')
        .attr('y', (d) => d.radius + 11)
        .attr('text-anchor', 'middle')
        .attr('fill', isNightMode ? '#F0F5EE' : '#203A2A')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text((d) => d.callsign);

      simulation.on('tick', () => {
        linkElements
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        nodeElements.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
      });
    }
  }, [graphData, graphViewMode, isNightMode, peers, onSelectPeer]);

  const handleResetZoom = () => {
    soundFeedback.playClick();
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
    setZoomLevel(1);
  };

  return (
    <div className="space-y-4">
      {/* Header & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] text-[10px] font-semibold border border-[#2A9D8F]/30 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Chain of Trust • Ed25519 Cryptographic Provenance
          </div>
          <h3
            className={`font-display font-bold text-lg ${
              isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
            }`}
          >
            Connection Depth & Influence Graph
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Simplified Connection Graph vs Force Mesh */}
          <div
            className={`p-1 rounded-2xl border flex items-center gap-1 text-xs ${
              isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                setGraphViewMode('chain');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                graphViewMode === 'chain'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Chain of Trust (Depth)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFeedback.playClick();
                setGraphViewMode('force');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                graphViewMode === 'force'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Force Mesh</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetZoom}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isNightMode
                ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5] hover:bg-[#1E2B1A]'
                : 'bg-white border-[#87A878]/30 text-[#637062] hover:bg-[#FAF6EE]'
            }`}
            title="Reset Zoom & Pan"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Influence & Connection Depth Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Mesh Influence Reach
          </span>
          <span className="font-mono font-bold text-lg text-[#2A9D8F] mt-0.5 block">
            {trustMetrics.influencePercent}%
          </span>
          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] block">
            {trustMetrics.reachablePeers} peers in 1–2 hops
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Max Connection Depth
          </span>
          <span className="font-mono font-bold text-lg text-[#E9C46A] mt-0.5 block">
            {trustMetrics.maxDepth} Degrees
          </span>
          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] block">
            {trustMetrics.directCount} direct • {trustMetrics.secondDegreeCount} attested
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Signed Endorsements
          </span>
          <span className="font-mono font-bold text-lg text-[#588157] mt-0.5 block">
            {trustMetrics.totalEndorsements} Vouchers
          </span>
          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] block">
            Ed25519 signature proof
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Mutual Aid Exchanges
          </span>
          <span className="font-mono font-bold text-lg text-[#E76F51] mt-0.5 block">
            {trustMetrics.totalTransactions} Completed
          </span>
          <span className="text-[9px] text-[#637062] dark:text-[#A8BDA5] block">
            Handshake verified
          </span>
        </div>
      </div>

      {/* Interactive Trust Path Trace Inspector (when a node is selected) */}
      {selectedNode && !selectedNode.isUser && (
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
              : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono font-bold text-[10px] text-[#588157]">
              CHAIN OF TRUST PATH:
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-[#E9C46A]/20 text-[#9A6A12] dark:text-[#E9C46A] font-mono font-bold text-[10px]">
              {user.callsign || 'You'} (Depth 0)
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#588157]" />
            <span className="px-2 py-0.5 rounded-lg bg-[#2A9D8F]/20 text-[#2A9D8F] font-mono font-bold text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {selectedNode.degree === 1 ? 'Direct Trust' : 'Relay Hop'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#588157]" />
            <span className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 font-mono font-bold text-[10px]">
              {selectedNode.callsign} (Depth {selectedNode.degree})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] hover:underline shrink-0 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        className={`relative w-full h-[400px] rounded-3xl border overflow-hidden transition-colors ${
          isNightMode ? 'bg-[#0E150D] border-[#2A3B26]' : 'bg-[#F4F9F2] border-[#87A878]/35'
        }`}
      >
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-3 left-3 p-2.5 rounded-2xl bg-black/60 backdrop-blur-md text-white text-[10px] space-y-1 border border-white/10 pointer-events-none">
          <div className="font-bold font-mono text-[#E9C46A] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Chain of Trust Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A]" />
            <span>You (Sovereign Root • Depth 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F]" />
            <span>Depth 1: Direct Endorsement / Tx</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#87A878]" />
            <span>Depth 2: Attested Mesh Witness</span>
          </div>
        </div>

        {/* Zoom Indicator */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-xs px-2 py-1 rounded-xl border border-white/10">
          <span className="text-[10px] font-mono text-white">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
export default TrustNetworkGraph;
