import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { SkillExchangeItem, TrustEndorsement } from '../types';
import { soundFeedback } from '../services/utils/soundFeedback';
import {
  Sparkles,
  ShieldCheck,
  Star,
  Users,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  ArrowRight,
  X,
  BadgeCheck,
  HeartHandshake,
  Layers,
  HelpCircle,
  Award,
} from 'lucide-react';

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'member' | 'skill';
  label: string;
  sublabel?: string;
  category?: string;
  color: string;
  radius: number;
  // Member specific
  callsign?: string;
  isCurrentUser?: boolean;
  skillsTaughtCount?: number;
  endorsementsGivenCount?: number;
  endorsementsReceivedCount?: number;
  // Skill specific
  skill?: SkillExchangeItem;
  providerCallsign?: string;
  isVerified?: boolean;
  ratingAverage?: number;
  endorsementsCount?: number;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  id: string;
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'teaches' | 'endorsed_trade';
  rating?: number;
  comment?: string;
  tags?: string[];
}

interface SkillEndorsementNetworkD3Props {
  skills: SkillExchangeItem[];
  endorsements?: TrustEndorsement[];
  userCallsign: string;
  onSelectSkill?: (skill: SkillExchangeItem) => void;
  onRequestSession?: (skill: SkillExchangeItem) => void;
  onEndorseSkill?: (skill: SkillExchangeItem) => void;
  onOpenChatWithPeer?: (callsign: string) => void;
  isNightMode?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Energy & Solar': '#E9C46A',
  Permaculture: '#588157',
  'Carpentry & Building': '#9C6644',
  'Electronics & Radio': '#7209B7',
  'First Aid & Herbal': '#E76F51',
  'Water & Sanitation': '#2A9D8F',
  'Field Foraging & Fungi': '#DDA15E',
  General: '#637062',
};

export const SkillEndorsementNetworkD3: React.FC<SkillEndorsementNetworkD3Props> = ({
  skills,
  endorsements = [],
  userCallsign,
  onSelectSkill,
  onRequestSession,
  onEndorseSkill,
  onOpenChatWithPeer,
  isNightMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Filter & Search States
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 760,
    height: 520,
  });

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
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

  // Build Graph Nodes and Links from Skills & Endorsements
  const { nodes, links, membersMap } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();
    const linkList: NetworkLink[] = [];
    const members = new Map<
      string,
      {
        callsign: string;
        skillsTaught: SkillExchangeItem[];
        endorsementsGiven: number;
        endorsementsReceived: number;
      }
    >();

    // Helper to get or create member
    const getOrCreateMember = (callsign: string) => {
      if (!members.has(callsign)) {
        members.set(callsign, {
          callsign,
          skillsTaught: [],
          endorsementsGiven: 0,
          endorsementsReceived: 0,
        });
      }
      return members.get(callsign)!;
    };

    // 1. Process Skills and Providers
    skills.forEach((skill) => {
      const provider = getOrCreateMember(skill.providerCallsign);
      provider.skillsTaught.push(skill);

      // Create skill node
      const skillNodeId = `skill_${skill.id}`;
      const color = CATEGORY_COLORS[skill.category] || '#588157';

      // Compute average rating from endorsements
      const itemEndorsements = skill.endorsements || [];
      const totalRatings = itemEndorsements.reduce((acc, e) => acc + (e.rating || 5), 0);
      const avgRating = itemEndorsements.length > 0 ? totalRatings / itemEndorsements.length : 5;

      nodeMap.set(skillNodeId, {
        id: skillNodeId,
        type: 'skill',
        label: skill.title,
        sublabel: skill.category,
        category: skill.category,
        color,
        radius: 17,
        skill,
        providerCallsign: skill.providerCallsign,
        isVerified: skill.isVerified || itemEndorsements.some((e) => e.isTradeVerified),
        ratingAverage: avgRating,
        endorsementsCount: skill.endorsementsCount || itemEndorsements.length,
      });

      // Add "teaches" link from Provider -> Skill
      const memberNodeId = `member_${skill.providerCallsign}`;
      linkList.push({
        id: `link_teaches_${skill.providerCallsign}_${skill.id}`,
        source: memberNodeId,
        target: skillNodeId,
        type: 'teaches',
      });

      // Process endorsements attached to this skill
      itemEndorsements.forEach((end, idx) => {
        const endorser = getOrCreateMember(end.endorserCallsign);
        endorser.endorsementsGiven += 1;
        provider.endorsementsReceived += 1;

        // Add "endorsed_trade" link from Endorser Member -> Skill
        const endorserNodeId = `member_${end.endorserCallsign}`;
        linkList.push({
          id: `link_endorse_${end.endorserCallsign}_${skill.id}_${idx}`,
          source: endorserNodeId,
          target: skillNodeId,
          type: 'endorsed_trade',
          rating: end.rating,
          comment: end.comment,
          tags: end.tags,
        });
      });
    });

    // 2. Also register standalone endorsements from the endorsements prop if any
    endorsements.forEach((end, idx) => {
      if (end.endorserCallsign) {
        const endorser = getOrCreateMember(end.endorserCallsign);
        endorser.endorsementsGiven += 1;
      }
      if (end.recipientCallsign) {
        const recipient = getOrCreateMember(end.recipientCallsign);
        recipient.endorsementsReceived += 1;
      }
    });

    // 3. Create Member Nodes
    members.forEach((m, callsign) => {
      const memberNodeId = `member_${callsign}`;
      const isSelf = callsign === userCallsign;
      nodeMap.set(memberNodeId, {
        id: memberNodeId,
        type: 'member',
        label: callsign,
        sublabel: isSelf ? 'You (Sovereign Node)' : `${m.skillsTaught.length} skills • ${m.endorsementsReceived} endorsements`,
        color: isSelf ? '#E9C46A' : '#588157',
        radius: isSelf ? 23 : 19,
        callsign,
        isCurrentUser: isSelf,
        skillsTaughtCount: m.skillsTaught.length,
        endorsementsGivenCount: m.endorsementsGiven,
        endorsementsReceivedCount: m.endorsementsReceived,
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linkList,
      membersMap: members,
    };
  }, [skills, endorsements, userCallsign]);

  // Filtered nodes & links based on UI controls
  const { filteredNodes, filteredLinks } = useMemo(() => {
    // 1. Filter skills based on category and verification
    const validSkillIds = new Set<string>();

    nodes.forEach((n) => {
      if (n.type === 'skill') {
        let matchesCategory = selectedCategory === 'ALL' || n.category === selectedCategory;
        let matchesVerified = !onlyVerified || n.isVerified;
        let matchesSearch = true;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          matchesSearch =
            n.label.toLowerCase().includes(q) ||
            (n.providerCallsign && n.providerCallsign.toLowerCase().includes(q)) ||
            (n.category && n.category.toLowerCase().includes(q));
        }

        if (matchesCategory && matchesVerified && matchesSearch) {
          validSkillIds.add(n.id);
        }
      }
    });

    // 2. Identify members linked to valid skills
    const validMemberIds = new Set<string>();
    const activeLinks: NetworkLink[] = [];

    links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;

      // If either end is a valid skill, keep link and both endpoints
      if (validSkillIds.has(srcId) || validSkillIds.has(tgtId)) {
        activeLinks.push({ ...l });
        if (srcId.startsWith('member_')) validMemberIds.add(srcId);
        if (tgtId.startsWith('member_')) validMemberIds.add(tgtId);
        if (srcId.startsWith('skill_')) validSkillIds.add(srcId);
        if (tgtId.startsWith('skill_')) validSkillIds.add(tgtId);
      }
    });

    // Also keep user node always
    validMemberIds.add(`member_${userCallsign}`);

    // If search query matched a member callsign directly, ensure they appear
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes.forEach((n) => {
        if (n.type === 'member' && n.callsign?.toLowerCase().includes(q)) {
          validMemberIds.add(n.id);
        }
      });
    }

    const activeNodes = nodes
      .filter((n) => (n.type === 'skill' ? validSkillIds.has(n.id) : validMemberIds.has(n.id)))
      .map((n) => ({ ...n })); // clone for d3 simulation

    return {
      filteredNodes: activeNodes,
      filteredLinks: activeLinks,
    };
  }, [nodes, links, selectedCategory, onlyVerified, searchQuery, userCallsign]);

  // Handle Node Click
  const handleNodeClick = useCallback((node: NetworkNode) => {
    soundFeedback.playClick();
    if (navigator.vibrate) navigator.vibrate(10);
    setSelectedNode(node);

    // Pan smoothly to node
    if (svgRef.current && zoomBehaviorRef.current && node.x !== undefined && node.y !== undefined) {
      const svg = d3.select(svgRef.current);
      const targetZoom = 1.35;
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      const transform = d3.zoomIdentity
        .translate(centerX - node.x * targetZoom, centerY - node.y * targetZoom)
        .scale(targetZoom);

      svg.transition().duration(500).ease(d3.easeCubicOut).call(zoomBehaviorRef.current.transform, transform);
    }
  }, [dimensions.width, dimensions.height]);

  // Zoom Helpers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
  };

  const handleResetZoom = () => {
    soundFeedback.playClick();
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    setSelectedNode(null);
  };

  // D3 Force Layout Effect
  useEffect(() => {
    if (!svgRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // SVG Defs
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'network-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers for links
    defs.append('marker')
      .attr('id', 'arrow-endorsed')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#E9C46A');

    // Root Group with Zoom
    const g = svg.append('g').attr('class', 'network-root');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Background click deselects
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        setSelectedNode(null);
      }
    });

    // Background decorative circular grid rings
    const bgGroup = g.append('g').attr('class', 'bg-decorations');
    [100, 200, 320].forEach((r) => {
      bgGroup
        .append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', isNightMode ? '#2A3D25' : '#87A878')
        .attr('stroke-opacity', 0.12)
        .attr('stroke-dasharray', '4 4');
    });

    // D3 Force Simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(filteredNodes)
      .force(
        'link',
        d3
          .forceLink<NetworkNode, NetworkLink>(filteredLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === 'teaches' ? 65 : 85))
          .strength(0.55)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide<NetworkNode>().radius((d) => d.radius + 16))
      .alphaDecay(0.045);

    // 1. Render Links
    const linkGroup = g.append('g').attr('class', 'links-layer');

    const linkSelection = linkGroup
      .selectAll<SVGLineElement, NetworkLink>('line.network-link')
      .data(filteredLinks, (d) => d.id)
      .enter()
      .append('line')
      .attr('class', 'network-link')
      .attr('stroke', (d) => (d.type === 'endorsed_trade' ? '#E9C46A' : isNightMode ? '#588157' : '#87A878'))
      .attr('stroke-width', (d) => (d.type === 'endorsed_trade' ? 2 : 1.5))
      .attr('stroke-opacity', (d) => (d.type === 'endorsed_trade' ? 0.65 : 0.35))
      .attr('stroke-dasharray', (d) => (d.type === 'endorsed_trade' ? '4 3' : 'none'))
      .attr('marker-end', (d) => (d.type === 'endorsed_trade' ? 'url(#arrow-endorsed)' : 'none'));

    // 2. Render Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes-layer');

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, NetworkNode>()
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
      });

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, NetworkNode>('g.network-node')
      .data(filteredNodes, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', 'network-node cursor-pointer')
      .call(drag as any)
      .on('click', (event, d) => {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
        // Dim unrelated links and highlight connected ones
        linkSelection.attr('stroke-opacity', (l: any) => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return srcId === d.id || tgtId === d.id ? 0.9 : 0.1;
        });
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
        linkSelection.attr('stroke-opacity', (l: any) => (l.type === 'endorsed_trade' ? 0.65 : 0.35));
      });

    // Outer Halo / Selected Ring
    nodeSelection
      .append('circle')
      .attr('class', 'outer-halo')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.id === selectedNode?.id ? '#E9C46A' : d.color))
      .attr('stroke-width', (d) => (d.id === selectedNode?.id ? 2.5 : 1))
      .attr('stroke-opacity', (d) => (d.id === selectedNode?.id ? 0.9 : 0.2))
      .attr('stroke-dasharray', (d) => (d.id === selectedNode?.id ? '3 2' : 'none'));

    // Main Node Circle / Shape
    nodeSelection
      .append('circle')
      .attr('class', 'main-circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => {
        if (d.type === 'member') {
          return d.isCurrentUser ? '#E9C46A' : isNightMode ? '#1A2617' : '#FFFFFF';
        }
        return d.color;
      })
      .attr('stroke', (d) => {
        if (d.id === selectedNode?.id) return '#E9C46A';
        if (d.type === 'member') return d.isCurrentUser ? '#E9C46A' : '#588157';
        return isNightMode ? '#364E30' : '#FFFFFF';
      })
      .attr('stroke-width', (d) => (d.id === selectedNode?.id ? 3 : 2))
      .attr('filter', 'url(#network-glow)');

    // Node Glyph / Icons
    nodeSelection.each(function (d) {
      const el = d3.select(this);

      if (d.type === 'member') {
        // Initials of callsign
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', d.isCurrentUser ? '11px' : '10px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .attr('fill', d.isCurrentUser ? '#203A2A' : isNightMode ? '#A8BDA5' : '#203A2A')
          .text(d.label.slice(0, 2).toUpperCase());
      } else {
        // Skill verified star or graduation cap symbol
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#FFFFFF')
          .text(d.isVerified ? '★' : '✦');
      }
    });

    // Node Label
    const labelGroup = nodeSelection
      .append('g')
      .attr('class', 'node-label')
      .attr('transform', (d) => `translate(0, ${d.radius + 12})`);

    // Background pill for label
    labelGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', (d) => (d.type === 'member' ? 'bold' : 'normal'))
      .attr('fill', isNightMode ? '#F0F5EE' : '#203A2A')
      .text((d) => (d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label));

    // Simulation Tick
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeSelection.attr('transform', (d) => `translate(${d.x || centerX}, ${d.y || centerY})`);
    });

    return () => {
      simulation.stop();
    };
  }, [dimensions, filteredNodes, filteredLinks, isNightMode, selectedNode?.id, handleNodeClick]);

  const categories = [
    'ALL',
    'Energy & Solar',
    'Permaculture',
    'Carpentry & Building',
    'Electronics & Radio',
    'First Aid & Herbal',
    'Water & Sanitation',
  ];

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[480px] rounded-2xl overflow-hidden select-none flex flex-col border ${
        isNightMode
          ? 'bg-[#0E150C] border-[#2A3B26] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      }`}
    >
      {/* Top Header & Search Strip */}
      <div className="p-3 border-b flex flex-wrap items-center justify-between gap-2.5 z-10 backdrop-blur-xs bg-black/5 dark:bg-white/5 border-[#87A878]/20">
        <div className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#637062] dark:text-[#A8BDA5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mentor or trade skill..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border shadow-2xs focus:outline-hidden transition-all ${
                isNightMode
                  ? 'bg-[#141F12] border-[#2A3B26] text-[#F0F5EE] focus:border-[#588157]'
                  : 'bg-white border-[#87A878]/30 text-[#203A2A] focus:border-[#588157]'
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

          <button
            type="button"
            onClick={() => setOnlyVerified(!onlyVerified)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              onlyVerified
                ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] shadow-xs'
                : isNightMode
                ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Trades Only</span>
          </button>
        </div>

        {/* Node Stats Summary */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-[#588157] dark:text-[#87A878]">
            <Users className="w-3.5 h-3.5" />
            <span>{membersMap.size} Members</span>
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1.5 text-[#E9C46A]">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{skills.length} Skills</span>
          </span>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto z-10 bg-black/5 dark:bg-white/5 border-[#87A878]/10 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              soundFeedback.playClick();
              setSelectedCategory(cat);
            }}
            className={`px-2.5 py-1 rounded-xl whitespace-nowrap text-xs font-semibold border transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#588157] text-white border-[#588157] shadow-2xs font-bold'
                : isNightMode
                ? 'bg-[#141F12]/80 text-[#A8BDA5] border-[#2A3B26] hover:text-white'
                : 'bg-white/90 text-[#637062] border-[#87A878]/30 hover:text-[#203A2A]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Zoom / Reset Controls (Top Right Overlay) */}
      <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleZoomIn}
          className={`w-8 h-8 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
              : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
          }`}
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className={`w-8 h-8 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
              : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
          }`}
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          className={`w-8 h-8 rounded-xl border shadow-md flex items-center justify-center transition-all cursor-pointer ${
            isNightMode
              ? 'bg-[#141F12] border-[#2A3B26] text-[#E9C46A] hover:bg-[#1C2C19]'
              : 'bg-white border-[#87A878]/30 text-[#8C6207] hover:bg-[#FAF6EE]'
          }`}
          title="Reset Graph Position"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary Interactive D3 Canvas */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          className="w-full h-full outline-none"
          width={dimensions.width}
          height={dimensions.height}
        />
      </div>

      {/* Legend strip at bottom left */}
      <div className="p-2 px-3 border-t flex flex-wrap items-center justify-between text-[11px] font-mono opacity-85 border-[#87A878]/20 bg-black/5 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#588157] inline-block border border-white" />
            <span>Community Member</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#E9C46A] inline-block" />
            <span>You</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#7209B7] inline-block" />
            <span>Trade Skill</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 border-b-2 border-dashed border-[#E9C46A] inline-block" />
            <span>Verified Trade Endorsement</span>
          </span>
        </div>
        <span>Drag nodes or scroll to zoom</span>
      </div>

      {/* SELECTED NODE INSPECTOR DRAWER / MODAL */}
      {selectedNode && (
        <div className="absolute bottom-10 left-4 right-4 max-w-lg mx-auto z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`rounded-3xl border shadow-2xl p-4 sm:p-5 backdrop-blur-md ${
              isNightMode
                ? 'bg-[#141F12]/95 border-[#364E30] text-[#F0F5EE]'
                : 'bg-white/95 border-[#87A878]/50 text-[#203A2A]'
            }`}
          >
            {/* Header with Type & Close */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold text-white shadow-2xs"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {selectedNode.type === 'member' ? 'COMMUNITY MEMBER' : 'TRADE SKILL'}
                </span>

                {selectedNode.type === 'skill' && selectedNode.isVerified && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] border border-[#E9C46A]/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Trade
                  </span>
                )}

                {selectedNode.type === 'member' && selectedNode.isCurrentUser && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#588157]/20 text-[#588157] dark:text-[#87A878] border border-[#588157]/30">
                    Sovereign You
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors"
                title="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Sublabel */}
            <div className="mb-2">
              <h3 className="font-display font-bold text-base sm:text-lg leading-snug">
                {selectedNode.label}
              </h3>
              {selectedNode.sublabel && (
                <div className="text-xs text-[#637062] dark:text-[#A8BDA5] pt-0.5">
                  {selectedNode.sublabel}
                </div>
              )}
            </div>

            {/* Member Details */}
            {selectedNode.type === 'member' && (
              <div className="space-y-2 mb-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Skills Offered</div>
                    <div className="font-bold text-sm text-[#588157] dark:text-[#87A878]">
                      {selectedNode.skillsTaughtCount || 0} Sessions
                    </div>
                  </div>

                  <div className={`p-2 rounded-xl border ${isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'}`}>
                    <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">Endorsements Given</div>
                    <div className="font-bold text-sm text-[#E9C46A]">
                      {selectedNode.endorsementsGivenCount || 0} Verified
                    </div>
                  </div>
                </div>

                {onOpenChatWithPeer && !selectedNode.isCurrentUser && selectedNode.callsign && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenChatWithPeer(selectedNode.callsign!)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message {selectedNode.callsign}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Skill Details */}
            {selectedNode.type === 'skill' && selectedNode.skill && (
              <div className="space-y-2 mb-3 text-xs">
                <p className="text-[#637062] dark:text-[#A8BDA5] leading-relaxed line-clamp-2">
                  {selectedNode.skill.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-[#E9C46A]">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{selectedNode.ratingAverage?.toFixed(1)} / 5.0 Rating</span>
                  </span>
                  <span>•</span>
                  <span>{selectedNode.endorsementsCount} Community Endorsements</span>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                  {onEndorseSkill && (
                    <button
                      type="button"
                      onClick={() => onEndorseSkill(selectedNode.skill!)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isNightMode
                          ? 'bg-[#182315] border-[#2A3B26] text-[#E9C46A] hover:bg-[#2A3B26]'
                          : 'bg-white border-[#87A878]/30 text-[#8C6207] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-[#E9C46A]" />
                      <span>Endorse Trade</span>
                    </button>
                  )}

                  {onRequestSession && (
                    <button
                      type="button"
                      onClick={() => onRequestSession(selectedNode.skill!)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <span>Request Session</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
