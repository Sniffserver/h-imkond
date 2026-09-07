import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MeshNode } from '../types';
import { Activity, AlertTriangle, CheckCircle2, Clock, Filter, Radio, RefreshCw, Zap, TrendingUp, ChevronRight } from 'lucide-react';

export interface RelayReliabilityTrendD3Props {
  peers: MeshNode[];
  isNightMode?: boolean;
}

export interface RelayDataPoint {
  timestamp: number;
  timeLabel: string;
  hour: number;
  aggregateReliability: number;
  activeRelaysCount: number;
  packetDeliveryRate: number;
  isBottleneck: boolean;
  bottleneckReason?: string;
  peerBreakdown: Record<string, number>; // callsign -> reliability
}

export const RelayReliabilityTrendD3: React.FC<RelayReliabilityTrendD3Props> = ({
  peers = [],
  isNightMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedTimeRange, setSelectedTimeRange] = useState<24 | 12 | 6>(24);
  const [viewMode, setViewMode] = useState<'aggregate' | 'multinode' | 'selectedPeer'>('aggregate');
  const [selectedPeerCallsign, setSelectedPeerCallsign] = useState<string>(
    peers.length > 0 ? peers[0].callsign : ''
  );
  const [hoveredPoint, setHoveredPoint] = useState<RelayDataPoint | null>(null);

  // Keep selectedPeerCallsign in sync if peers change
  useEffect(() => {
    if (peers.length > 0 && !peers.some((p) => p.callsign === selectedPeerCallsign)) {
      setSelectedPeerCallsign(peers[0].callsign);
    }
  }, [peers, selectedPeerCallsign]);

  // Generate deterministic 24-hour historical telemetry based on peer properties
  const telemetryData = useMemo<RelayDataPoint[]>(() => {
    const points: RelayDataPoint[] = [];
    const now = Date.now();
    const intervalMs = 60 * 60 * 1000; // 1 hour steps
    const totalPoints = 25; // 24 hours back + current hour

    // Baseline network strength derived from actual connected peers
    const basePeerAvg = peers.length > 0
      ? peers.reduce((acc, p) => acc + (p.relayReliability || 85), 0) / peers.length
      : 88;

    for (let i = totalPoints - 1; i >= 0; i--) {
      const pointTime = new Date(now - i * intervalMs);
      const hour = pointTime.getHours();
      const timeLabel = pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Diurnal cycle simulation:
      // Solar peak at 11:00-15:00 (+6% to +8% reliability)
      // Nocturnal dip at 02:00-05:00 (-12% to -18% reliability due to solar node power save sleep)
      let diurnalShift = 0;
      let bottleneckReason: string | undefined;

      if (hour >= 11 && hour <= 16) {
        diurnalShift = 7.5;
      } else if (hour >= 8 && hour < 11) {
        diurnalShift = 3.0;
      } else if (hour >= 17 && hour <= 21) {
        diurnalShift = 1.0;
      } else if (hour >= 2 && hour <= 5) {
        // Nocturnal bottleneck window
        diurnalShift = -16.5;
        bottleneckReason = 'Nocturnal battery-conservation throttle on solar relay nodes';
      } else if (hour >= 22 || hour <= 1) {
        diurnalShift = -7.0;
      } else {
        diurnalShift = -4.0;
      }

      // Small pseudo-random wobble based on hour hash
      const wobble = Math.sin(hour * 1.7) * 2.5;
      const rawAggregate = basePeerAvg + diurnalShift + wobble;
      const aggregateReliability = Math.max(50, Math.min(100, Math.round(rawAggregate * 10) / 10));

      const isBottleneck = aggregateReliability < 75;

      // Peer breakdowns
      const peerBreakdown: Record<string, number> = {};
      peers.forEach((peer, idx) => {
        const peerBase = peer.relayReliability || 85;
        const peerWobble = Math.cos((hour + idx * 3) * 1.3) * 4;
        const peerVal = Math.max(45, Math.min(100, Math.round((peerBase + diurnalShift + peerWobble) * 10) / 10));
        peerBreakdown[peer.callsign] = peerVal;
      });

      points.push({
        timestamp: pointTime.getTime(),
        timeLabel,
        hour,
        aggregateReliability,
        activeRelaysCount: Math.max(2, Math.round(peers.length * (aggregateReliability / 100))),
        packetDeliveryRate: Math.max(70, Math.min(99.8, Math.round((aggregateReliability * 0.98) * 10) / 10)),
        isBottleneck,
        bottleneckReason,
        peerBreakdown,
      });
    }

    return points;
  }, [peers]);

  // Slice data based on selected time window
  const activeData = useMemo(() => {
    const count = selectedTimeRange + 1;
    return telemetryData.slice(telemetryData.length - count);
  }, [telemetryData, selectedTimeRange]);

  // Key bottleneck metrics
  const minPoint = useMemo(() => {
    return activeData.reduce((min, p) => (p.aggregateReliability < min.aggregateReliability ? p : min), activeData[0]);
  }, [activeData]);

  const maxPoint = useMemo(() => {
    return activeData.reduce((max, p) => (p.aggregateReliability > max.aggregateReliability ? p : max), activeData[0]);
  }, [activeData]);

  const avgReliability = useMemo(() => {
    if (activeData.length === 0) return 0;
    const sum = activeData.reduce((acc, p) => acc + p.aggregateReliability, 0);
    return Math.round((sum / activeData.length) * 10) / 10;
  }, [activeData]);

  const bottleneckCount = useMemo(() => {
    return activeData.filter((p) => p.isBottleneck).length;
  }, [activeData]);

  // D3 Render Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || activeData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 600;
    const height = 280;
    const margin = { top: 25, right: 30, bottom: 40, left: 45 };
    const width = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    svg.attr('width', containerWidth).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale: Time
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(activeData, (d) => new Date(d.timestamp)) as [Date, Date])
      .range([0, width]);

    // Y scale: Reliability % (bounded 40% to 100%)
    const yScale = d3
      .scaleLinear()
      .domain([45, 100])
      .range([chartHeight, 0])
      .nice();

    // Define Gradients
    const defs = svg.append('defs');

    // Aggregate area gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'relay-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#2A9D8F')
      .attr('stop-opacity', isNightMode ? 0.45 : 0.35);

    areaGradient
      .append('stop')
      .attr('offset', '60%')
      .attr('stop-color', '#E9C46A')
      .attr('stop-opacity', 0.15);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#E76F51')
      .attr('stop-opacity', 0.02);

    // Grid lines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(() => '');
    g.append('g')
      .attr('class', 'grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', isNightMode ? '#2A3B26' : '#87A878')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-dasharray', '2,2');
    g.select('.grid .domain').remove();

    // Bottleneck Threshold Zone (< 70%)
    const bottleneckY = yScale(70);
    g.append('rect')
      .attr('x', 0)
      .attr('y', bottleneckY)
      .attr('width', width)
      .attr('height', chartHeight - bottleneckY)
      .attr('fill', '#E76F51')
      .attr('fill-opacity', isNightMode ? 0.08 : 0.06);

    // Reference Line: 70% (Bottleneck Alert)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', bottleneckY)
      .attr('y2', bottleneckY)
      .attr('stroke', '#E76F51')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.8);

    g.append('text')
      .attr('x', width - 8)
      .attr('y', bottleneckY - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', '600')
      .attr('fill', '#E76F51')
      .text('70% Bottleneck Threshold');

    // Reference Line: 85% (Nominal Target)
    const nominalY = yScale(85);
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', nominalY)
      .attr('y2', nominalY)
      .attr('stroke', '#588157')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.6);

    g.append('text')
      .attr('x', width - 8)
      .attr('y', nominalY - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', '#588157')
      .text('85% Nominal Target');

    // Line and Area Generators
    const areaGenerator = d3
      .area<RelayDataPoint>()
      .x((d) => xScale(new Date(d.timestamp)))
      .y0(chartHeight)
      .y1((d) => yScale(d.aggregateReliability))
      .curve(d3.curveMonotoneX);

    const lineGenerator = d3
      .line<RelayDataPoint>()
      .x((d) => xScale(new Date(d.timestamp)))
      .y((d) => yScale(d.aggregateReliability))
      .curve(d3.curveMonotoneX);

    // Multi-peer color palette
    const peerColors = ['#2A9D8F', '#E9C46A', '#E76F51', '#588157', '#3A86FF', '#F4A261'];

    // If Multi-node comparison is selected, render individual peer lines
    if (viewMode === 'multinode') {
      peers.slice(0, 5).forEach((peer, idx) => {
        const peerLineGen = d3
          .line<RelayDataPoint>()
          .x((d) => xScale(new Date(d.timestamp)))
          .y((d) => yScale(d.peerBreakdown[peer.callsign] || d.aggregateReliability))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(activeData)
          .attr('fill', 'none')
          .attr('stroke', peerColors[idx % peerColors.length])
          .attr('stroke-width', 1.8)
          .attr('stroke-opacity', 0.75)
          .attr('d', peerLineGen);
      });
    } else if (viewMode === 'selectedPeer' && selectedPeerCallsign) {
      // Render selected peer line
      const selectedLineGen = d3
        .line<RelayDataPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yScale(d.peerBreakdown[selectedPeerCallsign] || d.aggregateReliability))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(activeData)
        .attr('fill', 'none')
        .attr('stroke', '#E9C46A')
        .attr('stroke-width', 2.5)
        .attr('d', selectedLineGen);
    }

    // Always render aggregate area and main line
    if (viewMode === 'aggregate') {
      g.append('path')
        .datum(activeData)
        .attr('fill', 'url(#relay-area-grad)')
        .attr('d', areaGenerator);
    }

    // Main aggregate stroke line
    g.append('path')
      .datum(activeData)
      .attr('fill', 'none')
      .attr('stroke', viewMode === 'aggregate' ? '#2A9D8F' : '#203A2A')
      .attr('stroke-width', viewMode === 'aggregate' ? 2.5 : 1.5)
      .attr('stroke-opacity', viewMode === 'aggregate' ? 1 : 0.4)
      .attr('stroke-dasharray', viewMode === 'aggregate' ? 'none' : '3,3')
      .attr('d', lineGenerator);

    // Render Bottleneck highlight circles
    activeData.forEach((point) => {
      if (point.isBottleneck) {
        g.append('circle')
          .attr('cx', xScale(new Date(point.timestamp)))
          .attr('cy', yScale(point.aggregateReliability))
          .attr('r', 5)
          .attr('fill', '#E76F51')
          .attr('stroke', '#FAF6EE')
          .attr('stroke-width', 2);
      }
    });

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(selectedTimeRange === 24 ? 8 : 6)
      .tickFormat((d) => d3.timeFormat('%H:%M')(d as Date));

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', isNightMode ? '#364E30' : '#87A878');
    xAxisGroup
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', isNightMode ? '#A8BDA5' : '#637062');
    xAxisGroup.selectAll('line').attr('stroke', isNightMode ? '#364E30' : '#87A878');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${d}%`);

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', isNightMode ? '#A8BDA5' : '#637062');
    yAxisGroup.selectAll('line').remove();

    // Crosshair & Interaction Elements
    const crosshair = g
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', isNightMode ? '#E9C46A' : '#203A2A')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('opacity', 0);

    const highlightCircle = g
      .append('circle')
      .attr('r', 6)
      .attr('fill', '#E9C46A')
      .attr('stroke', isNightMode ? '#182315' : '#FAF6EE')
      .attr('stroke-width', 2.5)
      .style('opacity', 0);

    // Transparent overlay rect for mouse tracking
    const bisectDate = d3.bisector<RelayDataPoint, Date>((d) => new Date(d.timestamp)).left;

    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', width)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const xDate = xScale.invert(mx);
        const idx = bisectDate(activeData, xDate, 1);
        const d0 = activeData[idx - 1];
        const d1 = activeData[idx];
        let target = d0;
        if (d0 && d1) {
          target = xDate.getTime() - d0.timestamp > d1.timestamp - xDate.getTime() ? d1 : d0;
        }

        if (target) {
          const cx = xScale(new Date(target.timestamp));
          const cy = yScale(
            viewMode === 'selectedPeer' && selectedPeerCallsign
              ? target.peerBreakdown[selectedPeerCallsign] || target.aggregateReliability
              : target.aggregateReliability
          );

          crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1);
          highlightCircle.attr('cx', cx).attr('cy', cy).style('opacity', 1);
          setHoveredPoint(target);
        }
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        highlightCircle.style('opacity', 0);
        setHoveredPoint(null);
      });
  }, [activeData, viewMode, selectedPeerCallsign, isNightMode, selectedTimeRange, peers]);

  return (
    <div
      id="relay-reliability-trend-panel"
      ref={containerRef}
      className={`rounded-3xl border p-5 sm:p-6 shadow-xs transition-colors duration-200 space-y-4 ${
        isNightMode ? 'bg-[#182315] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/35'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#87A878]/20">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`font-display font-bold text-base flex items-center gap-1.5 ${
                isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-[#2A9D8F]" />
              24-Hour Relay Reliability Trend & Bottleneck Monitor
            </span>
            {bottleneckCount > 0 ? (
              <span className="text-[10px] font-mono font-bold bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {bottleneckCount} Bottleneck Dip{bottleneckCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold bg-[#588157]/15 text-[#588157] border border-[#588157]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#2A9D8F]" />
                Optimal Topology
              </span>
            )}
          </div>
          <p className={`text-xs ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
            Continuous D3 visualization of RF packet relay success over time. Identifies nocturnal battery throttles and link drop bottlenecks.
          </p>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-1 bg-white/80 p-1 rounded-2xl border border-[#87A878]/30 text-xs">
          {([24, 12, 6] as const).map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => setSelectedTimeRange(hours)}
              className={`px-2.5 py-1 rounded-xl font-mono text-xs font-semibold transition-all cursor-pointer ${
                selectedTimeRange === hours
                  ? 'bg-[#203A2A] text-white shadow-xs'
                  : 'text-[#637062] hover:bg-[#FAF6EE]'
              }`}
            >
              {hours}h
            </button>
          ))}
        </div>
      </div>

      {/* View Mode Controls & Summary Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}`}>
            View:
          </span>
          <button
            type="button"
            onClick={() => setViewMode('aggregate')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              viewMode === 'aggregate'
                ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
            }`}
          >
            Mesh Aggregate
          </button>
          <button
            type="button"
            onClick={() => setViewMode('multinode')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              viewMode === 'multinode'
                ? 'bg-[#203A2A] text-white border-[#203A2A] shadow-xs'
                : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
            }`}
          >
            Node Comparison
          </button>
          {peers.length > 0 && (
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-xl border border-[#87A878]/30">
              <span className="text-[10px] text-[#637062]">Peer:</span>
              <select
                value={selectedPeerCallsign}
                onChange={(e) => {
                  setSelectedPeerCallsign(e.target.value);
                  setViewMode('selectedPeer');
                }}
                className="bg-transparent text-xs font-semibold text-[#203A2A] focus:outline-none cursor-pointer"
              >
                {peers.map((p) => (
                  <option key={p.id} value={p.callsign}>
                    {p.callsign} ({p.relayReliability}%)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Telemetry Summary Stats */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1">
            <span className={isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}>Avg:</span>
            <span className="font-bold text-[#203A2A]">{avgReliability}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}>Min:</span>
            <span className="font-bold text-[#E76F51]">{minPoint.aggregateReliability}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'}>Max:</span>
            <span className="font-bold text-[#588157]">{maxPoint.aggregateReliability}%</span>
          </div>
        </div>
      </div>

      {/* D3 SVG Chart Container */}
      <div className="relative w-full overflow-hidden bg-white/70 rounded-2xl border border-[#87A878]/25 p-2">
        <svg ref={svgRef} className="w-full overflow-visible" />

        {/* Live Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute top-3 right-3 bg-[#FAF6EE]/95 border border-[#87A878]/40 shadow-lg rounded-2xl p-3 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100 z-10 max-w-xs pointer-events-none"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#87A878]/20 pb-1">
              <span className="font-bold text-[#203A2A] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#588157]" />
                {hoveredPoint.timeLabel} ({hoveredPoint.hour}:00)
              </span>
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  hoveredPoint.isBottleneck
                    ? 'bg-[#E76F51]/20 text-[#E76F51]'
                    : 'bg-[#588157]/20 text-[#588157]'
                }`}
              >
                {hoveredPoint.aggregateReliability}% Reliability
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#637062]">
              <div>
                Active Relays: <strong className="text-[#203A2A]">{hoveredPoint.activeRelaysCount} nodes</strong>
              </div>
              <div>
                Packet Delivery: <strong className="text-[#2A9D8F]">{hoveredPoint.packetDeliveryRate}%</strong>
              </div>
            </div>

            {hoveredPoint.isBottleneck ? (
              <div className="text-[11px] text-[#E76F51] bg-[#FDF1EE] border border-[#E76F51]/30 p-1.5 rounded-xl font-medium">
                ⚠️ <strong>Infrastructure Bottleneck:</strong> {hoveredPoint.bottleneckReason || 'Packet loss rate exceeded safe margins'}
              </div>
            ) : (
              <div className="text-[10px] text-[#588157] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#2A9D8F]" />
                All relay chains nominal; zero congested mesh hops.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottleneck Diagnostic & Bioregional Action Advice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <div className="p-3.5 bg-white/80 rounded-2xl border border-[#87A878]/20 space-y-1">
          <div className="text-[10px] font-semibold text-[#637062] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#E76F51]" />
            Lowest Recorded Link
          </div>
          <div className="text-sm font-bold text-[#203A2A] font-mono">
            {minPoint.aggregateReliability}% at {minPoint.timeLabel}
          </div>
          <p className="text-[11px] text-[#637062] leading-tight">
            {minPoint.isBottleneck
              ? 'Nocturnal battery-conservation throttle triggered.'
              : 'Reliability remained above critical safety thresholds.'}
          </p>
        </div>

        <div className="p-3.5 bg-white/80 rounded-2xl border border-[#87A878]/20 space-y-1">
          <div className="text-[10px] font-semibold text-[#637062] uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#E9C46A]" />
            Solar Peak Generation Window
          </div>
          <div className="text-sm font-bold text-[#2A9D8F] font-mono">
            {maxPoint.aggregateReliability}% at {maxPoint.timeLabel}
          </div>
          <p className="text-[11px] text-[#637062] leading-tight">
            Maximum radio duty cycle and zero packet drops during direct daylight recharge.
          </p>
        </div>

        <div className="p-3.5 bg-white/80 rounded-2xl border border-[#87A878]/20 space-y-1">
          <div className="text-[10px] font-semibold text-[#637062] uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-[#2A9D8F]" />
            Mesh Topology Guidance
          </div>
          <div className="text-xs font-semibold text-[#203A2A]">
            Deploy Permanent Ridge Relay
          </div>
          <p className="text-[11px] text-[#637062] leading-tight">
            Adding a 12V LiFePO4 battery buffer to southern-facing nodes prevents 03:00–05:00 relay bottlenecks.
          </p>
        </div>
      </div>
    </div>
  );
};
