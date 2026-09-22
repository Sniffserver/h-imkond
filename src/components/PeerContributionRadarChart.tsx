import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import { MeshNode } from '../types';
import {
  calculatePeerContribution,
  ContributionMetricPoint,
  PeerContributionProfile,
} from '../utils/peerContributionCalculator';
import {
  Award,
  Repeat,
  Activity,
  ShieldCheck,
  Radio,
  Sparkles,
  Info,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';

export interface PeerContributionRadarChartProps {
  peer: MeshNode;
  isNightMode?: boolean;
  className?: string;
  showMetricCards?: boolean;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  skills: Award,
  trades: Repeat,
  mesh: Activity,
  trust: ShieldCheck,
  relay: Radio,
};

export const PeerContributionRadarChart: React.FC<PeerContributionRadarChartProps> = ({
  peer,
  isNightMode = false,
  className = '',
  showMetricCards = true,
  compact = false,
}) => {
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);

  const profile: PeerContributionProfile = useMemo(() => {
    return calculatePeerContribution(peer);
  }, [peer]);

  // Recharts radar dataset format
  const chartData = useMemo(() => {
    return profile.metrics.map((m) => ({
      metric: m.metric,
      key: m.key,
      score: m.score,
      fullMark: 100,
      rawValue: m.rawValue,
      unit: m.unit,
      description: m.description,
    }));
  }, [profile.metrics]);

  const activeMetric = useMemo(() => {
    if (!selectedMetricKey) return null;
    return profile.metrics.find((m) => m.key === selectedMetricKey) || null;
  }, [profile.metrics, selectedMetricKey]);

  // Colors conforming to Solarpunk palette
  const strokeColor = '#2A9D8F';
  const fillColor = '#2A9D8F';
  const gridColor = isNightMode ? '#2A3B26' : '#87A878';
  const textColor = isNightMode ? '#FAF6EE' : '#203A2A';
  const labelColor = isNightMode ? '#A8BDA5' : '#588157';

  // Mathematical SVG Radar fallback generator (guarantees instantaneous crisp rendering in zero-width / headless tests)
  const renderSvgRadarFallback = (size: number) => {
    const radius = size * 0.38;
    const center = size / 2;
    const count = profile.metrics.length;
    const angleStep = (Math.PI * 2) / count;

    // Web circles (25%, 50%, 75%, 100%)
    const rings = [0.25, 0.5, 0.75, 1.0];

    // Calculate polygon vertices for peer score
    const points = profile.metrics.map((m, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = radius * (m.score / 100);
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[280px] sm:max-w-[320px] mx-auto overflow-visible select-none"
        aria-label={`Contribution Radar Chart for ${peer.callsign}`}
      >
        {/* Background Radial Webs */}
        {rings.map((ringFactor, idx) => {
          const ringPoints = profile.metrics.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = radius * ringFactor;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return `${x},${y}`;
          }).join(' ');

          return (
            <polygon
              key={`ring-${idx}`}
              points={ringPoints}
              fill="transparent"
              stroke={gridColor}
              strokeOpacity={0.35}
              strokeWidth={idx === rings.length - 1 ? 1.5 : 1}
              strokeDasharray={idx < 3 ? '2 2' : undefined}
            />
          );
        })}

        {/* Axis Spokes from center to rim */}
        {profile.metrics.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={`spoke-${i}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke={gridColor}
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          );
        })}

        {/* The Filled Contribution Polygon */}
        <polygon
          points={points}
          fill={fillColor}
          fillOpacity={0.35}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          className="transition-all duration-300"
        />

        {/* Vertex Markers & Axis Labels */}
        {profile.metrics.map((m, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = radius * (m.score / 100);
          const vx = center + r * Math.cos(angle);
          const vy = center + r * Math.sin(angle);

          // Label coordinates slightly beyond 100% rim
          const labelDist = radius + 22;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);

          const isSelected = selectedMetricKey === m.key;

          return (
            <g key={`vertex-${m.key}`} className="cursor-pointer" onClick={() => {
              soundFeedback.playClick();
              setSelectedMetricKey(isSelected ? null : m.key);
            }}>
              {/* Vertex Circle */}
              <circle
                cx={vx}
                cy={vy}
                r={isSelected ? 6 : 4}
                fill={isSelected ? '#E9C46A' : strokeColor}
                stroke="#FAF6EE"
                strokeWidth={1.5}
                className="transition-all"
              />

              {/* Label text */}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={compact ? 9 : 10}
                fontWeight={isSelected ? 'bold' : '600'}
                fill={isSelected ? (isNightMode ? '#E9C46A' : '#165B53') : labelColor}
                className="transition-colors pointer-events-auto"
              >
                {m.metric.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div
      id={`peer-contribution-radar-${peer.id}`}
      className={`rounded-3xl border transition-all ${
        isNightMode
          ? 'bg-[#141E12] border-[#2A3B26] text-[#FAF6EE]'
          : 'bg-white/95 border-[#87A878]/30 text-[#203A2A]'
      } p-4 sm:p-5 ${className}`}
    >
      {/* Header with Composite Score & Tier Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#588157] dark:text-[#A8BDA5]">
              Community Standing
            </span>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold text-white shadow-xs"
              style={{ backgroundColor: profile.tierColor }}
            >
              {profile.contributionTier}
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-bold font-display truncate">
            Community Contribution Radar
          </h4>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] block">
            Composite Index
          </span>
          <div className="flex items-baseline justify-end gap-0.5">
            <span
              className="text-xl sm:text-2xl font-bold font-display tracking-tight"
              style={{ color: profile.tierColor }}
            >
              {profile.compositeContributionScore}
            </span>
            <span className="text-xs text-[#637062] font-mono">/100</span>
          </div>
        </div>
      </div>

      {/* Main Radar Display Area */}
      <div className="py-2 flex items-center justify-center">
        {/* Render responsive SVG radar representation */}
        {renderSvgRadarFallback(compact ? 240 : 280)}
      </div>

      {/* Summary Capsule */}
      <div
        className={`p-3 rounded-2xl border text-xs leading-relaxed mt-2 ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#A8BDA5]'
            : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#637062]'
        }`}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#2A9D8F]" />
          <p className="flex-1">
            {activeMetric ? (
              <span>
                <strong className="text-current font-bold">{activeMetric.metric}:</strong>{' '}
                {activeMetric.description} Score:{' '}
                <strong style={{ color: strokeColor }}>{activeMetric.score}/100</strong> (
                {activeMetric.rawValue} {activeMetric.unit}).
              </span>
            ) : (
              profile.summaryText
            )}
          </p>
        </div>
      </div>

      {/* Metric Breakdown Cards (Verified Skills, Trades, Mesh Reliability, etc.) */}
      {showMetricCards && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
          {profile.metrics.map((m) => {
            const Icon = CATEGORY_ICONS[m.category] || Activity;
            const isSelected = selectedMetricKey === m.key;

            return (
              <button
                key={m.key}
                type="button"
                id={`metric-pill-${m.key}`}
                onClick={() => {
                  soundFeedback.playClick();
                  setSelectedMetricKey(isSelected ? null : m.key);
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? isNightMode
                      ? 'bg-[#20301B] border-[#2A9D8F] shadow-sm ring-1 ring-[#2A9D8F]/40'
                      : 'bg-[#EBF7F5] border-[#2A9D8F] shadow-sm ring-1 ring-[#2A9D8F]/30'
                    : isNightMode
                    ? 'bg-[#182315] border-[#2A3B26] hover:bg-[#22331E]'
                    : 'bg-[#FAF6EE] border-[#87A878]/20 hover:bg-[#87A878]/15'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] mb-1">
                  <div className="flex items-center gap-1 truncate">
                    <Icon className="w-3 h-3 text-[#2A9D8F] shrink-0" />
                    <span className="truncate">{m.metric.split(' ')[0]}</span>
                  </div>
                  <span className="font-bold text-[#2A9D8F]">{m.score}</span>
                </div>
                <div className="text-xs font-bold font-display truncate">
                  {m.rawValue} <span className="text-[10px] font-normal font-mono text-[#637062] dark:text-[#A8BDA5]">{m.unit}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
