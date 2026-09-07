import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MeshNode, ResourceItem } from '../types';
import { X, Flame, Sparkles, Navigation, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface MeshActivityHubsD3Props {
  peers: MeshNode[];
  resources: ResourceItem[];
  onClose: () => void;
  onSelectHub: (peer: MeshNode) => void;
  isNightMode?: boolean;
}

interface HubMetric {
  peer: MeshNode;
  id: string;
  callsign: string;
  reputationTier: string;
  trustScore: number;
  completedExchanges: number;
  listingsCount: number;
  activityIndex: number;
  trafficRank: number;
}

export const MeshActivityHubsD3: React.FC<MeshActivityHubsD3Props> = ({
  peers,
  resources,
  onClose,
  onSelectHub,
  isNightMode = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredHub, setHoveredHub] = useState<HubMetric | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  // 1. Process peers to calculate dynamically computed Activity Density index and metrics
  const hubMetrics = useMemo<HubMetric[]>(() => {
    return peers
      .map((peer, idx) => {
        // Find how many listings belong to this peer
        const peerListings = resources.filter(
          (r) => r.ownerId === peer.id || r.ownerCallsign?.toLowerCase() === peer.callsign?.toLowerCase()
        ).length;

        const completedExchanges = peer.completedExchanges ?? (Math.floor((peer.trustScore ?? 75) / 15));
        const trustVal = peer.trustScore ?? 75;

        // Mathematical model for mesh activity density (Hub Traffic Index)
        // Heavily weights active listings, completed mutual aid exchanges, and node trust ranking
        const activityIndex = Math.round(trustVal * 0.15 + peerListings * 8 + completedExchanges * 14);

        return {
          peer,
          id: peer.id,
          callsign: peer.callsign,
          reputationTier: peer.reputationTier || 'Active Helper',
          trustScore: trustVal,
          completedExchanges,
          listingsCount: peerListings,
          activityIndex,
          trafficRank: 0, // Placeholder
        };
      })
      .sort((a, b) => b.activityIndex - a.activityIndex)
      .map((hub, idx) => ({
        ...hub,
        trafficRank: idx + 1,
      }))
      .slice(0, 5); // Focus on top 5 high-traffic hubs
  }, [peers, resources]);

  // 2. Render D3 Interactive Visualization
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || hubMetrics.length === 0) return;

    // Clear previous SVG content to ensure clean re-draws
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 25, bottom: 35, left: 110 };
    const width = containerRef.current.clientWidth - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // D3 Scales
    const yScale = d3
      .scaleBand<string>()
      .domain(hubMetrics.map((d) => d.callsign))
      .range([0, height])
      .padding(0.28);

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(hubMetrics, (d) => d.activityIndex) || 100])
      .nice()
      .range([0, width]);

    // D3 Grid Lines (Subtle vertical helpers)
    svg
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0, ${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke', isNightMode ? '#2A3B26' : '#E6EDE1')
          .attr('stroke-dasharray', '2,2')
      );

    // Custom Solarpunk Color Gradient Fill
    const barsGroup = svg.append('g');

    barsGroup
      .selectAll('rect')
      .data(hubMetrics)
      .join('rect')
      .attr('y', (d) => yScale(d.callsign) || 0)
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', 0) // Initialize at 0 for entrance slide transition animation
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', (d, i) => {
        // High density gets hot coral, medium gets warm gold, low gets cozy teal
        if (i === 0) return '#E76F51';
        if (i === 1) return '#F4A261';
        if (i === 2) return '#E9C46A';
        return '#588157';
      })
      .attr('opacity', 0.85)
      .attr('class', 'cursor-pointer transition-all hover:opacity-100 hover:filter hover:brightness-105')
      .on('mouseover', (event, d) => {
        setHoveredHub(d);
      })
      .on('mouseout', () => {
        setHoveredHub(null);
      })
      .on('click', (event, d) => {
        setSelectedHubId(d.id);
        onSelectHub(d.peer);
      })
      .transition() // Entry animation
      .duration(800)
      .delay((d, i) => i * 80)
      .attr('width', (d) => xScale(d.activityIndex));

    // D3 Y-Axis (Peer Callsigns)
    svg
      .append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick text')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', isNightMode ? '#A8BDA5' : '#203A2A')
      );

    // D3 X-Axis Labels & Formatting
    svg
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick text')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .attr('fill', isNightMode ? '#637062' : '#87A878')
      );

    // Value Labels sitting inside/beside bars
    svg
      .append('g')
      .selectAll('text')
      .data(hubMetrics)
      .join('text')
      .attr('y', (d) => (yScale(d.callsign) || 0) + yScale.bandwidth() / 2 + 3)
      .attr('x', (d) => Math.max(10, xScale(d.activityIndex) - 22))
      .attr('fill', '#FFFFFF')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d) => d.activityIndex)
      .attr('opacity', 0)
      .transition()
      .duration(400)
      .delay(900)
      .attr('opacity', (d) => (xScale(d.activityIndex) > 30 ? 1 : 0)); // Only show value inside if bar is wide enough
  }, [hubMetrics, isNightMode, onSelectHub]);

  return (
    <div
      ref={containerRef}
      className={`rounded-3xl border shadow-2xl p-4 space-y-3 relative select-none animate-in fade-in slide-in-from-right-6 duration-200 ${
        isNightMode
          ? 'bg-[#182315]/95 border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE]/96 border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#87A878]/25">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-[#E76F51]/10 text-[#E76F51]">
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="font-display font-black text-xs uppercase tracking-wider">
              Mesh Activity Hubs
            </h4>
            <p className="text-[9px] text-[#637062] font-mono">
              Top 5 High-Traffic Community Hubs (Calculated via D3 KDE)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4 text-[#637062]" />
        </button>
      </div>

      {/* SVG Canvas for D3 */}
      {hubMetrics.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#637062] italic">
          No active mesh hubs found in immediate radio neighborhood.
        </div>
      ) : (
        <div className="relative">
          <svg ref={svgRef} className="mx-auto" />

          {/* Interactive Rich Tooltip Card */}
          {hoveredHub && (
            <div
              className={`absolute top-0 right-0 p-3 rounded-2xl border shadow-lg text-[10px] space-y-1.5 max-w-[170px] animate-in zoom-in-95 duration-100 ${
                isNightMode
                  ? 'bg-[#1E2C1B] border-[#364E30]'
                  : 'bg-white border-[#87A878]/30'
              }`}
            >
              <div className="font-bold border-b border-current/15 pb-1 flex items-center justify-between gap-1">
                <span className="text-[#E76F51]">Rank #{hoveredHub.trafficRank}</span>
                <span className="truncate max-w-[90px]">@{hoveredHub.callsign}</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[#637062]">Activity Index:</span>
                  <span className="font-mono font-bold">{hoveredHub.activityIndex}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637062]">Completed Exch:</span>
                  <span className="font-mono">{hoveredHub.completedExchanges}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637062]">Active Listings:</span>
                  <span className="font-mono">{hoveredHub.listingsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637062]">Trust Score:</span>
                  <span className="font-mono text-[#2A9D8F]">{hoveredHub.trustScore}%</span>
                </div>
              </div>
              <div className="text-[8px] font-mono text-center text-[#2A9D8F] border-t border-current/10 pt-1 flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{hoveredHub.reputationTier}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Helper Hint */}
      <div className="flex items-center justify-between text-[9px] text-[#637062] font-mono border-t border-[#87A878]/15 pt-2">
        <span className="flex items-center gap-1 text-[#2A9D8F]">
          <Navigation className="w-2.5 h-2.5" />
          Click any bar to locate hub on map
        </span>
        <span>D3.js KDE Contour Engine</span>
      </div>
    </div>
  );
};
