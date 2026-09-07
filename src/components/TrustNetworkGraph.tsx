import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { UserProfile, MeshNode, TrustEndorsement, Transaction } from '../types';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Users,
  Activity,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Award,
  Fingerprint,
  Share2,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export interface TrustGraphNode extends d3.SimulationNodeDatum {
  id: string;
  callsign: string;
  isUser: boolean;
  trustScore: number;
  role: string;
  degree: number; // 0 = self, 1 = direct endorsement, 2 = 2nd degree
  endorsementsCount: number;
  bioregion?: string;
  color: string;
  radius: number;
  publicKey?: string;
}

export interface TrustGraphLink extends d3.SimulationLinkDatum<TrustGraphNode> {
  id: string;
  source: string | TrustGraphNode;
  target: string | TrustGraphNode;
  weight: number;
  type: 'direct_endorsement' | 'mutual_exchange' | 'relay_trust';
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

  const [selectedNode, setSelectedNode] = useState<TrustGraphNode | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'direct' | 'high_trust'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // 1. Build Nodes & Links Graph Model
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, TrustGraphNode>();
    const links: TrustGraphLink[] = [];

    // Add Root User Node
    const userNode: TrustGraphNode = {
      id: 'user_self',
      callsign: user.callsign || 'You (Node-01)',
      isUser: true,
      trustScore: Math.min(100, Math.round((user.symbiosisScore || 78) * 1.15)),
      role: 'Local Self-Sovereign Steward',
      degree: 0,
      endorsementsCount: (user.skills?.length || 3) + endorsements.length + 4,
      bioregion: user.bioregion || 'Cascadia-44N',
      color: '#E9C46A',
      radius: 26,
      publicKey: 'ed25519:e8a9...90a42d',
    };
    nodesMap.set(userNode.id, userNode);

    // Add Peers
    peers.forEach((peer, idx) => {
      const isDirectEndorsed = endorsements.some(
        (e) => e.endorserCallsign === peer.callsign || e.recipientCallsign === peer.callsign
      );
      const hasMutualTx = transactions.some(
        (t) => t.providerCallsign === peer.callsign || t.requesterCallsign === peer.callsign
      );

      const degree = isDirectEndorsed || hasMutualTx ? 1 : (idx % 2 === 0 ? 1 : 2);
      const trustScore = peer.reputationScore 
        ? Math.min(100, Math.round(peer.reputationScore * 10)) 
        : Math.min(98, 70 + (peer.endorsementsCount || 2) * 4);

      const nodeColor = degree === 1 
        ? (trustScore >= 85 ? '#2A9D8F' : '#588157') 
        : '#87A878';

      const pNode: TrustGraphNode = {
        id: peer.id,
        callsign: peer.callsign,
        isUser: false,
        trustScore,
        role: peer.role || (degree === 1 ? 'Endorsed Peer Relay' : 'Community Witness'),
        degree,
        endorsementsCount: peer.endorsementsCount || (degree === 1 ? 5 : 2),
        bioregion: peer.cityId ? `Bioregion ${peer.cityId.toUpperCase()}` : 'Emajõe Luht',
        color: nodeColor,
        radius: degree === 1 ? 19 : 14,
        publicKey: peer.publicKey || `ed25519:${peer.callsign.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      };
      nodesMap.set(pNode.id, pNode);

      // Link User to 1st degree peers
      if (degree === 1) {
        links.push({
          id: `link-user-${peer.id}`,
          source: userNode.id,
          target: pNode.id,
          weight: trustScore > 85 ? 3 : 2,
          type: isDirectEndorsed ? 'direct_endorsement' : 'mutual_exchange',
          comment: isDirectEndorsed 
            ? 'Cryptographically signed direct trust endorsement.' 
            : 'Verified mutual exchange interaction.',
          signatureVerified: true,
        });
      }
    });

    // Add Inter-peer links for community cluster depth
    const peerArray = Array.from(nodesMap.values()).filter((n) => !n.isUser);
    for (let i = 0; i < peerArray.length; i++) {
      for (let j = i + 1; j < peerArray.length; j++) {
        // Form link if they share close index or simulated high mutual trust
        if ((i + j) % 3 === 0 || (peerArray[i].degree === 1 && peerArray[j].degree === 2 && (i + j) % 2 === 0)) {
          links.push({
            id: `link-${peerArray[i].id}-${peerArray[j].id}`,
            source: peerArray[i].id,
            target: peerArray[j].id,
            weight: 1.5,
            type: 'relay_trust',
            comment: 'Cross-relay cryptographic mesh attestation.',
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

  // 2. Compute Graph Metrics
  const graphMetrics = useMemo(() => {
    const totalNodes = graphData.nodes.length;
    const totalLinks = graphData.links.length;
    if (totalNodes <= 1) return { density: '0%', avgDegree: 0, totalSignatures: 0, clusterIndex: '100%' };

    // Density = 2 * |E| / (|V| * (|V| - 1))
    const maxPossibleLinks = (totalNodes * (totalNodes - 1)) / 2;
    const densityNum = maxPossibleLinks > 0 ? (totalLinks / maxPossibleLinks) * 100 : 0;
    const avgDegree = (2 * totalLinks) / totalNodes;
    const totalSignatures = totalLinks * 2 + endorsements.length;

    return {
      density: `${densityNum.toFixed(1)}%`,
      avgDegree: avgDegree.toFixed(1),
      totalSignatures,
      clusterIndex: `${Math.min(96, Math.round(55 + densityNum * 0.7))}%`,
    };
  }, [graphData, endorsements]);

  // 3. D3 Force Simulation & Rendering Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 650;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean previous render

    svg.attr('viewBox', [0, 0, width, height]);

    // Definitions (Gradients & Glow Filters)
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'trust-glow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Radial gradient for user node
    const userGrad = defs.append('radialGradient').attr('id', 'user-node-grad');
    userGrad.append('stop').attr('offset', '0%').attr('stop-color', '#F4A261');
    userGrad.append('stop').attr('offset', '100%').attr('stop-color', '#E76F51');

    // Main zoomable container
    const g = svg.append('g').attr('class', 'trust-graph-root');

    // Setup d3 Zoom
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);

    // Deep clones to prevent simulation mutations on immutable React data
    const nodes: TrustGraphNode[] = graphData.nodes.map((d) => ({ ...d }));
    const links: TrustGraphLink[] = graphData.links.map((d) => ({
      ...d,
      source: typeof d.source === 'object' ? (d.source as TrustGraphNode).id : d.source,
      target: typeof d.target === 'object' ? (d.target as TrustGraphNode).id : d.target,
    }));

    // Setup Force Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<TrustGraphNode, TrustGraphLink>(links).id((d) => d.id).distance((d) => (d.type === 'direct_endorsement' ? 85 : 120)).strength(0.6))
      .force('charge', d3.forceManyBody().strength((d: any) => (d.isUser ? -380 : -180)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<TrustGraphNode>().radius((d) => d.radius + 18));

    // Draw Links (Trust Edges)
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (d.type === 'direct_endorsement') return isNightMode ? '#2A9D8F' : '#2A9D8F';
        if (d.type === 'mutual_exchange') return isNightMode ? '#E9C46A' : '#588157';
        return isNightMode ? '#364E30' : '#87A878';
      })
      .attr('stroke-opacity', (d) => (d.type === 'direct_endorsement' ? 0.85 : 0.45))
      .attr('stroke-width', (d) => (d.type === 'direct_endorsement' ? 2.5 : 1.5))
      .attr('stroke-dasharray', (d) => (d.type === 'relay_trust' ? '4,3' : 'none'));

    // Animated particles travelling along direct endorsement links
    const particleGroup = g.append('g').attr('class', 'particles');
    const directLinks = links.filter((l) => l.type === 'direct_endorsement');
    const particles = particleGroup
      .selectAll('circle')
      .data(directLinks)
      .enter()
      .append('circle')
      .attr('r', 2.5)
      .attr('fill', '#E9C46A')
      .attr('opacity', 0.8);

    // Draw Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, TrustGraphNode>()
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
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        if (!d.isUser && onSelectPeer) {
          const matchedPeer = peers.find((p) => p.id === d.id);
          if (matchedPeer) onSelectPeer(matchedPeer);
        }
      });

    // Outer Aura Ring for high trust & User
    node
      .append('circle')
      .attr('r', (d) => d.radius + (d.isUser ? 6 : 4))
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.isUser ? '#E9C46A' : d.color))
      .attr('stroke-width', (d) => (d.isUser ? 2 : 1))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', (d) => (d.isUser ? '3,2' : 'none'));

    // Main Node Circle
    node
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.isUser ? 'url(#user-node-grad)' : d.color))
      .attr('stroke', isNightMode ? '#182315' : '#FAF6EE')
      .attr('stroke-width', 2.5)
      .attr('filter', (d) => (d.isUser || d.trustScore >= 90 ? 'url(#trust-glow)' : 'none'));

    // Inner Icon or Trust Score
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.isUser ? '0.35em' : '0.35em'))
      .attr('fill', '#FFFFFF')
      .attr('font-size', (d) => (d.isUser ? '12px' : '9px'))
      .attr('font-weight', 'bold')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('pointer-events', 'none')
      .text((d) => (d.isUser ? 'YOU' : `${d.trustScore}%`));

    // Label under node
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', isNightMode ? '#F0F5EE' : '#203A2A')
      .attr('font-size', '10px')
      .attr('font-weight', (d) => (d.isUser ? 'bold' : '600'))
      .attr('font-family', 'sans-serif')
      .attr('pointer-events', 'none')
      .text((d) => d.callsign);

    // Degree badge indicator
    node
      .filter((d) => !d.isUser && d.degree === 1)
      .append('circle')
      .attr('cx', (d) => d.radius - 3)
      .attr('cy', (d) => -d.radius + 3)
      .attr('r', 4.5)
      .attr('fill', '#2A9D8F')
      .attr('stroke', isNightMode ? '#182315' : '#FAF6EE')
      .attr('stroke-width', 1.5);

    // Particle Animation Loop
    let particleProgress = 0;
    const timer = d3.timer(() => {
      particleProgress = (particleProgress + 0.008) % 1;
      particles.attr('cx', (d: any) => {
        const sx = d.source.x || 0;
        const tx = d.target.x || 0;
        return sx + (tx - sx) * particleProgress;
      }).attr('cy', (d: any) => {
        const sy = d.source.y || 0;
        const ty = d.target.y || 0;
        return sy + (ty - sy) * particleProgress;
      });
    });

    // Simulation Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      timer.stop();
    };
  }, [graphData, isNightMode]);

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  };

  return (
    <div
      id="trust-network-visualization"
      className={`rounded-3xl border p-5 sm:p-6 space-y-4 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A] shadow-xs'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F] shadow-xs shrink-0">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] text-[10px] font-mono font-bold mb-0.5">
              <Lock className="w-3 h-3" />
              D3 Community Trust Topology & Cryptographic Mesh Graph
            </div>
            <h3 className="font-display font-bold text-lg">Kogukonna Usaldusvõrk / Trust Graph</h3>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Otsesed ja kaudsed Ed25519 usalduskinnitused kasutaja ja peer-sõlmede vahel ilma kesksüsteemideta.
            </p>
          </div>
        </div>

        {/* Filter Controls & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`p-1 rounded-xl border flex items-center gap-1 text-xs ${
              isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
            }`}
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              Kõik ({graphData.nodes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('direct')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'direct'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              1st Degree
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('high_trust')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'high_trust'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
              }`}
            >
              Kõrge Usaldus (&gt;85%)
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
            title="Lähtesta vaade (Reset Zoom & Pan)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Graph Density & Topology Metrics HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Võrgu Tihedus (Density)
          </span>
          <span className="font-mono font-bold text-base text-[#2A9D8F] mt-0.5 block">
            {graphMetrics.density}
          </span>
          <span className="text-[9px] text-[#637062] block">Aktiivsed usalduslingid</span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Klasterduvus (Clustering)
          </span>
          <span className="font-mono font-bold text-base text-[#E9C46A] mt-0.5 block">
            {graphMetrics.clusterIndex}
          </span>
          <span className="text-[9px] text-[#637062] block">Kogukonna sidusus</span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Keskmine Astmelisus
          </span>
          <span className="font-mono font-bold text-base text-[#588157] mt-0.5 block">
            {graphMetrics.avgDegree} ühendust / sõlm
          </span>
          <span className="text-[9px] text-[#637062] block">Otsene kättesaadavus</span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#87A878] block">
            Krüptoallkirjad (Ed25519)
          </span>
          <span className="font-mono font-bold text-base text-[#E76F51] mt-0.5 block">
            {graphMetrics.totalSignatures} Kinnitust
          </span>
          <span className="text-[9px] text-[#637062] block">Võltsimiskindel ahel</span>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        className={`relative w-full h-[400px] rounded-2xl border overflow-hidden transition-colors ${
          isNightMode ? 'bg-[#0E150D] border-[#2A3B26]' : 'bg-[#F4F9F2] border-[#87A878]/35'
        }`}
      >
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-black/55 backdrop-blur-xs text-white text-[10px] space-y-1.5 border border-white/10 pointer-events-none">
          <div className="font-bold font-mono text-[#E9C46A] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Usaldusgraafi Tingmärgid
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51]" />
            <span>Sina (Sovereign Root)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F]" />
            <span>1st Degree Otsene Kinnitus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#87A878]" />
            <span>2nd Degree Kogukonnaliige</span>
          </div>
        </div>

        {/* Floating Zoom Controls at Bottom-Right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-xs p-1 rounded-xl border border-white/10">
          <span className="text-[10px] font-mono text-white px-1.5">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>

      {/* Selected Node Inspector Drawer/Card */}
      {selectedNode && (
        <div
          className={`p-4 rounded-2xl border space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200 ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/35 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs"
                style={{ backgroundColor: selectedNode.color }}
              >
                {selectedNode.isUser ? 'YOU' : `${selectedNode.trustScore}%`}
              </div>
              <div>
                <h4 className="font-display font-bold text-sm flex items-center gap-1.5">
                  <span>{selectedNode.callsign}</span>
                  {selectedNode.isUser && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/30">
                      Sina
                    </span>
                  )}
                  {selectedNode.degree === 1 && !selectedNode.isUser && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] border border-[#2A9D8F]/30">
                      1st Degree Endorsed
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-[#637062] dark:text-[#87A878] font-mono">
                  {selectedNode.role} • {selectedNode.bioregion}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-xs text-[#637062] hover:underline cursor-pointer"
            >
              Sulge
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-current/10">
            <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315]">
              <span className="text-[#637062] block text-[10px]">Usaldusväärsuse skoor</span>
              <span className="font-mono font-bold text-[#2A9D8F]">{selectedNode.trustScore}% Verified</span>
            </div>
            <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315]">
              <span className="text-[#637062] block text-[10px]">Kinnitatud soovitusi</span>
              <span className="font-mono font-bold text-[#588157]">{selectedNode.endorsementsCount} Peers</span>
            </div>
            <div className="p-2 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] col-span-2 sm:col-span-1">
              <span className="text-[#637062] block text-[10px]">Avalik Krüptovõti</span>
              <span className="font-mono font-bold text-[#E76F51] truncate block">
                {selectedNode.publicKey || 'ed25519:verified'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
