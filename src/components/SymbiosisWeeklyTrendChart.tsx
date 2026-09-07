import React, { useState } from 'react';
import { SymbiosisWeeklyPoint } from '../types';
import { TrendingUp, Sparkles, Sprout, Award, Calendar, CheckCircle2 } from 'lucide-react';

interface SymbiosisWeeklyTrendChartProps {
  currentScore: number;
  isNightMode?: boolean;
}

export const SymbiosisWeeklyTrendChart: React.FC<SymbiosisWeeklyTrendChartProps> = ({
  currentScore,
  isNightMode = false,
}) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(4);

  // Dynamic 5-point weekly progression over the last month
  const weeklyData: SymbiosisWeeklyPoint[] = [
    {
      weekLabel: 'Week -4',
      dateRange: 'Aug 1 – Aug 7',
      score: Math.max(20, currentScore - 30),
      delta: 6,
      reflectionCount: 2,
      highlight: 'Solar microgrid repair with Sol-Spark & heirloom seed swap',
    },
    {
      weekLabel: 'Week -3',
      dateRange: 'Aug 8 – Aug 14',
      score: Math.max(30, currentScore - 22),
      delta: 8,
      reflectionCount: 3,
      highlight: 'Timber swale irrigation assistance with River-Oak',
    },
    {
      weekLabel: 'Week -2',
      dateRange: 'Aug 15 – Aug 21',
      score: Math.max(40, currentScore - 12),
      delta: 10,
      reflectionCount: 4,
      highlight: 'Olla terracotta pot firing with Clay-Root & herbal infusion share',
    },
    {
      weekLabel: 'Last Week',
      dateRange: 'Aug 22 – Aug 27',
      score: Math.max(50, currentScore - 5),
      delta: 7,
      reflectionCount: 3,
      highlight: 'Chanterelle pack trail relay mapping with Spore-Walker',
    },
    {
      weekLabel: 'Current',
      dateRange: 'Today',
      score: currentScore,
      delta: 5,
      reflectionCount: 2,
      highlight: 'Active bioregional mutual aid ledger & BLE node stewardship',
    },
  ];

  const scores = weeklyData.map((d) => d.score);
  const minScore = Math.floor(Math.min(...scores) / 10) * 10 - 10;
  const maxScore = Math.ceil(Math.max(...scores) / 10) * 10 + 10;
  const range = maxScore - minScore || 1;

  const totalMonthlyGain = currentScore - weeklyData[0].score;
  const avgWeeklyDelta = (totalMonthlyGain / 4).toFixed(1);

  // Chart dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const padding = { top: 25, right: 35, bottom: 45, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Calculate coordinates for points
  const points = weeklyData.map((d, index) => {
    const x = padding.left + (index / (weeklyData.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((d.score - minScore) / range) * graphHeight;
    return { ...d, x, y };
  });

  // Build SVG Path
  const linePath = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    // Bezier curve smoothing
    const prev = points[idx - 1];
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`;

  // Grid tick values (4 steps)
  const yTicks = [
    minScore,
    Math.round(minScore + range * 0.33),
    Math.round(minScore + range * 0.66),
    maxScore,
  ];

  const activePoint = activePointIndex !== null ? points[activePointIndex] : points[points.length - 1];

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 transition-colors duration-200 shadow-xs space-y-4 ${
        isNightMode
          ? 'bg-[#223120] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#F0F5EE] border-[#87A878]/35 text-[#203A2A]'
      }`}
    >
      {/* Header with Title & Highlight Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2A9D8F]" />
            <h3 className="font-display font-bold text-base sm:text-lg">
              30-Day Symbiosis Score Trend
            </h3>
          </div>
          <p className="text-xs text-[#588157]">
            Weekly community impact and mutual aid co-evolution trajectory
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#2A9D8F]/15 border border-[#2A9D8F]/30 px-3 py-1 rounded-2xl text-xs font-bold text-[#2A9D8F]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>+{totalMonthlyGain} Pts This Month</span>
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div
        className={`w-full rounded-2xl border p-3 relative overflow-hidden transition-colors ${
          isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white/90 border-[#87A878]/25'
        }`}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Gradient for area fill under line */}
            <linearGradient id="symbiosisAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2A9D8F" stopOpacity={isNightMode ? "0.45" : "0.35"} />
              <stop offset="60%" stopColor="#87A878" stopOpacity={isNightMode ? "0.20" : "0.12"} />
              <stop offset="100%" stopColor="#E9C46A" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient for the main stroke */}
            <linearGradient id="symbiosisLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#588157" />
              <stop offset="50%" stopColor="#2A9D8F" />
              <stop offset="100%" stopColor="#E9C46A" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal Grid lines and Y-axis labels */}
          {yTicks.map((val, idx) => {
            const yPos = padding.top + graphHeight - ((val - minScore) / range) * graphHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={svgWidth - padding.right}
                  y2={yPos}
                  stroke={isNightMode ? 'rgba(135,168,120,0.15)' : 'rgba(135,168,120,0.25)'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fill={isNightMode ? '#7C9377' : '#637062'}
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path d={areaPath} fill="url(#symbiosisAreaGrad)" />

          {/* Smooth Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#symbiosisLineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Vertical Guides and Interactive Nodes */}
          {points.map((pt, idx) => {
            const isHovered = activePointIndex === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer group"
                onClick={() => setActivePointIndex(idx)}
                onMouseEnter={() => setActivePointIndex(idx)}
              >
                {/* Vertical hover indicator line */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={padding.top}
                    x2={pt.x}
                    y2={padding.top + graphHeight}
                    stroke="#2A9D8F"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* Outer halo */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 9 : 6}
                  fill={isHovered ? '#E9C46A' : '#2A9D8F'}
                  fillOpacity={isHovered ? 0.35 : 0.2}
                  className="transition-all duration-200"
                />

                {/* Inner solid node circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4.5}
                  fill={isHovered ? '#E9C46A' : '#FAF6EE'}
                  stroke={isHovered ? '#203A2A' : '#2A9D8F'}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-200"
                />

                {/* Score label badge above node if selected */}
                {isHovered && (
                  <g>
                    <rect
                      x={pt.x - 24}
                      y={pt.y - 30}
                      width="48"
                      height="20"
                      rx="6"
                      fill={isNightMode ? '#203A2A' : '#203A2A'}
                      stroke="#87A878"
                      strokeWidth="1"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 16}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      fill="#E9C46A"
                    >
                      {pt.score} pts
                    </text>
                  </g>
                )}

                {/* X-axis week label */}
                <text
                  x={pt.x}
                  y={padding.top + graphHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fontFamily="Outfit, sans-serif"
                  fill={
                    isHovered
                      ? isNightMode
                        ? '#E9C46A'
                        : '#203A2A'
                      : isNightMode
                      ? '#8EAA87'
                      : '#637062'
                  }
                >
                  {pt.weekLabel}
                </text>
                <text
                  x={pt.x}
                  y={padding.top + graphHeight + 34}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fill={isNightMode ? '#60795B' : '#8A9988'}
                >
                  {pt.dateRange}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Detail Inspector Box */}
      {activePoint && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
            isNightMode
              ? 'bg-[#1B2718] border-[#364E30]'
              : 'bg-white/95 border-[#87A878]/30 shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 mb-2 border-current/10">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-[#E9C46A]">
                {activePoint.weekLabel} ({activePoint.dateRange})
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
                Score: {activePoint.score} Pts (+{activePoint.delta} that week)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#588157]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{activePoint.reflectionCount} Reflections Logged</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[#87A878] shrink-0 mt-0.5" />
            <p className={isNightMode ? 'text-[#D3E2D0]' : 'text-[#203A2A]'}>
              <strong className="font-semibold text-[#588157]">Community Impact:</strong>{' '}
              {activePoint.highlight}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div
          className={`p-2.5 rounded-xl border text-center ${
            isNightMode ? 'bg-[#1A2617] border-[#2E4229]' : 'bg-white/70 border-[#87A878]/25'
          }`}
        >
          <span className="text-[10px] font-medium text-[#637062] block">Weekly Momentum</span>
          <span className="text-sm font-bold font-mono text-[#2A9D8F]">+{avgWeeklyDelta} Pts/Wk</span>
        </div>

        <div
          className={`p-2.5 rounded-xl border text-center ${
            isNightMode ? 'bg-[#1A2617] border-[#2E4229]' : 'bg-white/70 border-[#87A878]/25'
          }`}
        >
          <span className="text-[10px] font-medium text-[#637062] block">Exchanges Logged</span>
          <span className="text-sm font-bold font-mono text-[#588157]">14 Total</span>
        </div>

        <div
          className={`p-2.5 rounded-xl border text-center ${
            isNightMode ? 'bg-[#1A2617] border-[#2E4229]' : 'bg-white/70 border-[#87A878]/25'
          }`}
        >
          <span className="text-[10px] font-medium text-[#637062] block">Peak Growth</span>
          <span className="text-sm font-bold font-mono text-[#E9C46A]">+10 Pts (Wk -2)</span>
        </div>

        <div
          className={`p-2.5 rounded-xl border text-center ${
            isNightMode ? 'bg-[#1A2617] border-[#2E4229]' : 'bg-white/70 border-[#87A878]/25'
          }`}
        >
          <span className="text-[10px] font-medium text-[#637062] block">Next Tier Target</span>
          <span className="text-sm font-bold font-mono text-[#E76F51]">150 (Steward)</span>
        </div>
      </div>
    </div>
  );
};
