import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MeshNode } from '../types';
import { ShieldCheck, Award, Radio, RefreshCw, Sparkles, Zap, Users, Info, ChevronRight } from 'lucide-react';

export interface PeerTrustRadarChartD3Props {
  peer: MeshNode | null;
  allPeers?: MeshNode[];
  onSelectPeer?: (peer: MeshNode) => void;
  onOpenReputation?: (peer: MeshNode) => void;
  onOpenChat?: (peer: MeshNode) => void;
  isNightMode?: boolean;
}

interface RadarAxisMetric {
  key: string;
  name: string;
  shortName: string;
  value: number; // Raw value
  normalizedValue: number; // 0 to 100
  displayValue: string;
  unit: string;
  icon: React.ReactNode;
  description: string;
  benchmarkValue: number; // Community baseline (0 to 100)
}

export const PeerTrustRadarChartD3: React.FC<PeerTrustRadarChartD3Props> = ({
  peer,
  allPeers = [],
  onSelectPeer,
  onOpenReputation,
  onOpenChat,
  isNightMode = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAxis, setHoveredAxis] = useState<RadarAxisMetric | null>(null);
  const [showBenchmark, setShowBenchmark] = useState(true);

  // If no peer is passed, select the first one from allPeers if available
  const activePeer = peer || (allPeers.length > 0 ? allPeers[0] : null);

  // Compute metrics for the radar chart
  const metrics = useMemo<RadarAxisMetric[]>(() => {
    if (!activePeer) return [];

    // 1. Completed Exchanges
    // Benchmark: 15 exchanges = 50%, 30+ = 100%
    const exchangesRaw = activePeer.completedExchanges ?? 0;
    const exchangesNorm = Math.min(100, Math.round((exchangesRaw / 25) * 100));

    // 2. Community Endorsements
    // Endorsements count or derived from trust
    const endorsementsRaw =
      activePeer.endorsementsCount ??
      Math.max(1, Math.floor((activePeer.trustScore || 80) / 10));
    const endorsementsNorm = Math.min(100, Math.round((endorsementsRaw / 15) * 100));

    // 3. Relay Reliability (%)
    const relayRaw = activePeer.relayReliability ?? 98.0;
    const relayNorm = Math.min(100, Math.max(0, relayRaw));

    // 4. Trust Score (0-100)
    const trustRaw = activePeer.trustScore ?? 80;
    const trustNorm = Math.min(100, Math.max(0, trustRaw));

    // 5. Signal & Link Health (Derived from RSSI and hop distance)
    // RSSI e.g. -40 (excellent) to -90 (weak)
    const rssi = activePeer.lastRssi ?? -65;
    const rssiNorm = Math.min(100, Math.max(15, Math.round(100 - (Math.abs(rssi) - 35) * 1.5)));

    // 6. Packet Relay Volume
    const packetsRaw = activePeer.relayedPackets ?? (activePeer.completedExchanges * 8 + 45);
    const packetsNorm = Math.min(100, Math.round((packetsRaw / 200) * 100));

    return [
      {
        key: 'exchanges',
        name: 'Teostatud vahetused',
        shortName: 'Vahetused',
        value: exchangesRaw,
        normalizedValue: Math.max(10, exchangesNorm),
        displayValue: `${exchangesRaw} vahetust`,
        unit: 'tehingut',
        icon: <RefreshCw className="w-3.5 h-3.5 text-[#E76F51]" />,
        description: 'Kinnitatud vastastikuse abi ja ressursside vahetuste arv võrgus.',
        benchmarkValue: 55,
      },
      {
        key: 'endorsements',
        name: 'Kogukonna soovitused',
        shortName: 'Soovitused',
        value: endorsementsRaw,
        normalizedValue: Math.max(15, endorsementsNorm),
        displayValue: `${endorsementsRaw} soovitust`,
        unit: 'häält',
        icon: <Award className="w-3.5 h-3.5 text-[#E9C46A]" />,
        description: 'Võrgusõlmede poolt allkirjastatud Ed25519 usaldussoovitused.',
        benchmarkValue: 60,
      },
      {
        key: 'relay',
        name: 'Relee usaldusväärsus',
        shortName: 'Relee tervis',
        value: relayRaw,
        normalizedValue: Math.max(20, relayNorm),
        displayValue: `${relayRaw.toFixed(1)}%`,
        unit: '%',
        icon: <Zap className="w-3.5 h-3.5 text-[#2A9D8F]" />,
        description: 'P2P pakettide edastamise edukusprotsent ilma andmekaota.',
        benchmarkValue: 92,
      },
      {
        key: 'trust',
        name: 'Sümbioosi usaldusindeks',
        shortName: 'Usaldus',
        value: trustRaw,
        normalizedValue: Math.max(15, trustNorm),
        displayValue: `${trustRaw}/100`,
        unit: 'punkti',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-[#588157]" />,
        description: 'Koondindeks, mis arvutatakse vastastikuse abi ja eetika põhjal.',
        benchmarkValue: 75,
      },
      {
        key: 'signal',
        name: 'RF signaali kvaliteet',
        shortName: 'Raadiosignaal',
        value: rssi,
        normalizedValue: Math.max(20, rssiNorm),
        displayValue: `${rssi} dBm`,
        unit: 'dBm',
        icon: <Radio className="w-3.5 h-3.5 text-[#F4A261]" />,
        description: 'Otsese Bluetooth LE või Wi-Fi Direct raadiolingi tugevus.',
        benchmarkValue: 68,
      },
      {
        key: 'traffic',
        name: 'Edastatud paketid',
        shortName: 'Võrguliiklus',
        value: packetsRaw,
        normalizedValue: Math.max(15, packetsNorm),
        displayValue: `${packetsRaw} pkt`,
        unit: 'paketti',
        icon: <Users className="w-3.5 h-3.5 text-[#3A86C8]" />,
        description: 'Hõimu heaks vabatahtlikult vahendatud võrgusõnumite kogumaht.',
        benchmarkValue: 50,
      },
    ];
  }, [activePeer]);

  // Render D3.js Radar Chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || metrics.length === 0) return;

    // Clear previous elements
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 320;
    const width = Math.min(containerWidth, 420);
    const height = 300;
    const margin = 48;
    const radius = Math.min(width, height) / 2 - margin;
    const cx = width / 2;
    const cy = height / 2;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g');

    // Number of axes (metrics)
    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    // D3 Radius Scale (0 to 100)
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    // Concentric Web Guide Circles (20%, 40%, 60%, 80%, 100%)
    const levels = [20, 40, 60, 80, 100];
    const gridColor = isNightMode ? '#364E30' : '#87A878';

    const axisGrid = svg.append('g').attr('class', 'axis-grid');

    // Concentric polygons/rings
    levels.forEach((level) => {
      const levelRadius = rScale(level);

      // Generate polygon points for this level
      const points: [number, number][] = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const x = cx + levelRadius * Math.cos(angle);
        const y = cy + levelRadius * Math.sin(angle);
        points.push([x, y]);
      }

      // Draw polygon outline
      axisGrid
        .append('polygon')
        .attr('points', points.map((p) => p.join(',')).join(' '))
        .attr('fill', level === 100 ? (isNightMode ? '#1F2E1E' : '#FAF6EE') : 'none')
        .attr('stroke', gridColor)
        .attr('stroke-width', level === 100 ? 1.5 : 0.8)
        .attr('stroke-dasharray', level === 100 ? 'none' : '3,3')
        .attr('opacity', level === 100 ? 0.9 : 0.45);

      // Add percentage label along vertical axis
      axisGrid
        .append('text')
        .attr('x', cx + 4)
        .attr('y', cy - levelRadius + 2)
        .attr('fill', isNightMode ? '#637062' : '#87A878')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('opacity', 0.8)
        .text(`${level}%`);
    });

    // Draw Radial Spoke Axis Lines
    metrics.forEach((metric, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const xEnd = cx + radius * Math.cos(angle);
      const yEnd = cy + radius * Math.sin(angle);

      // Line spoke
      axisGrid
        .append('line')
        .attr('x1', cx)
        .attr('y1', cy)
        .attr('x2', xEnd)
        .attr('y2', yEnd)
        .attr('stroke', gridColor)
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);

      // Outer Axis Label
      const labelDistance = radius + 22;
      const xLabel = cx + labelDistance * Math.cos(angle);
      const yLabel = cy + labelDistance * Math.sin(angle);

      const labelGroup = svg
        .append('g')
        .attr('class', 'axis-label-group')
        .attr('cursor', 'pointer')
        .on('mouseenter', () => setHoveredAxis(metric))
        .on('mouseleave', () => setHoveredAxis(null));

      labelGroup
        .append('text')
        .attr('x', xLabel)
        .attr('y', yLabel + 3)
        .attr('text-anchor', Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end')
        .attr('font-size', '9.5px')
        .attr('font-weight', '600')
        .attr('font-family', 'inherit')
        .attr('fill', isNightMode ? '#E2E8F0' : '#203A2A')
        .text(metric.shortName);
    });

    // Draw Community Benchmark Baseline (if enabled)
    if (showBenchmark) {
      const benchmarkPoints: [number, number][] = metrics.map((m, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const r = rScale(m.benchmarkValue);
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
      });

      svg
        .append('polygon')
        .attr('points', benchmarkPoints.map((p) => p.join(',')).join(' '))
        .attr('fill', 'none')
        .attr('stroke', '#E9C46A')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.65);
    }

    // Draw Active Peer Trust Radar Area Polygon
    const radarPoints: [number, number][] = metrics.map((m, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const r = rScale(m.normalizedValue);
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

    // Radar Area Polygon
    const radarPolygon = svg
      .append('polygon')
      .attr('points', radarPoints.map((p) => p.join(',')).join(' '))
      .attr('fill', isNightMode ? '#2A9D8F' : '#588157')
      .attr('fill-opacity', isNightMode ? 0.35 : 0.25)
      .attr('stroke', isNightMode ? '#2A9D8F' : '#588157')
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('class', 'transition-all duration-300');

    // Draw Vertex Circles for Each Metric
    metrics.forEach((metric, i) => {
      const [x, y] = radarPoints[i];

      const vertexGroup = svg
        .append('g')
        .attr('cursor', 'pointer')
        .on('mouseenter', () => setHoveredAxis(metric))
        .on('mouseleave', () => setHoveredAxis(null));

      // Outer glow circle
      vertexGroup
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 6)
        .attr('fill', isNightMode ? '#2A9D8F' : '#588157')
        .attr('fill-opacity', 0.25)
        .attr('class', 'animate-ping')
        .attr('opacity', hoveredAxis?.key === metric.key ? 1 : 0);

      // Solid vertex dot
      vertexGroup
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4.5)
        .attr('fill', isNightMode ? '#FAF6EE' : '#FAF6EE')
        .attr('stroke', isNightMode ? '#2A9D8F' : '#588157')
        .attr('stroke-width', 2);
    });

    // Center pivot circle
    svg
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', 3)
      .attr('fill', isNightMode ? '#87A878' : '#203A2A')
      .attr('opacity', 0.7);
  }, [metrics, isNightMode, showBenchmark, hoveredAxis]);

  if (!activePeer) {
    return (
      <div
        className={`rounded-3xl border p-6 text-center shadow-sm space-y-2 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#A8BDA5]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#637062]'
        }`}
      >
        <ShieldCheck className="w-8 h-8 text-[#87A878] mx-auto opacity-50" />
        <h4 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
          Vali võrgusõlm usaldusprofiili vaatamiseks
        </h4>
        <p className="text-xs max-w-xs mx-auto">
          Klõpsa mõnel läheduses asuval raadiosõlmel, et genereerida D3.js abil tema mitmemõõtmeline usaldusgraafik.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="peer-trust-radar-card"
      className={`rounded-3xl border shadow-md p-5 space-y-4 relative transition-all duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
      }`}
    >
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#87A878]/25">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[#588157]/15 text-[#588157]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                @{activePeer.callsign} Usaldusprofiil
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                D3 Radar
              </span>
            </div>
            <p className="text-xs text-[#637062] dark:text-[#87A878]">
              {activePeer.isDirect ? 'Otsene BLE raadiolink' : `${activePeer.hopDistance} võrguhüppe kaugusel`} • {activePeer.role || 'Aktiivne abistaja'}
            </p>
          </div>
        </div>

        {/* Peer Switcher Chips (if multiple peers exist) */}
        {allPeers.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
            <span className="text-[10px] text-[#637062] font-mono">Vali sõlm:</span>
            {allPeers.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPeer && onSelectPeer(p)}
                className={`px-2 py-1 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  p.id === activePeer.id
                    ? 'bg-[#203A2A] text-white dark:bg-[#588157]'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 text-current'
                }`}
              >
                @{p.callsign}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Radar SVG + Interactive Telemetry Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Radar SVG */}
        <div className="md:col-span-7 flex flex-col items-center justify-center relative">
          <svg ref={svgRef} className="max-w-full overflow-visible" />

          {/* Legend row below radar */}
          <div className="flex items-center gap-4 text-[10px] font-mono pt-1 text-[#637062] dark:text-[#87A878]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-xs bg-[#588157] inline-block" />
              <span>Sõlme profiil</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBenchmark(!showBenchmark)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span
                className={`w-3 h-0.5 border-t-2 border-dashed inline-block ${
                  showBenchmark ? 'border-[#E9C46A]' : 'border-current/30'
                }`}
              />
              <span className={showBenchmark ? 'text-[#E9C46A] font-bold' : 'line-through'}>
                Kogukonna baastase
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Telemetry Cards */}
        <div className="md:col-span-5 space-y-2.5">
          <div className="text-xs font-bold font-display flex items-center justify-between pb-1 border-b border-current/10">
            <span>Usaldusmõõdikute koond</span>
            <span className="text-[10px] font-mono text-[#588157]">6 Telge</span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {metrics.map((m) => {
              const isHovered = hoveredAxis?.key === m.key;
              return (
                <div
                  key={m.key}
                  onMouseEnter={() => setHoveredAxis(m)}
                  onMouseLeave={() => setHoveredAxis(null)}
                  className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-[#F0F5EE] dark:bg-[#20301E] border-[#588157] scale-[1.02] shadow-xs'
                      : 'bg-white/80 dark:bg-[#1F2C1D]/60 border-[#87A878]/25 hover:border-[#87A878]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-black/5 dark:bg-white/10">
                        {m.icon}
                      </div>
                      <span className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                        {m.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#588157]">
                      {m.displayValue}
                    </span>
                  </div>

                  {isHovered && (
                    <p className="text-[10px] text-[#637062] dark:text-[#87A878] mt-1 pt-1 border-t border-current/10 animate-in fade-in duration-100">
                      {m.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-1">
            {onOpenReputation && (
              <button
                type="button"
                onClick={() => onOpenReputation(activePeer)}
                className="flex-1 py-2 px-3 bg-white dark:bg-[#253822] text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40 hover:bg-[#FAF6EE] text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#588157]" />
                <span>Usaldusraamat</span>
              </button>
            )}

            {onOpenChat && (
              <button
                type="button"
                onClick={() => onOpenChat(activePeer)}
                className="flex-1 py-2 px-3 bg-[#203A2A] hover:bg-[#2e523b] dark:bg-[#588157] dark:hover:bg-[#6b9c6a] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <span>Saada P2P Sõnum</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
