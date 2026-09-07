import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MeshNode, PeerRadioType } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { PeerSignalPulseSVG, SignalStrengthMeterSVG } from './PeerSignalPulseSVG';
import { rafScheduler } from '../utils/rafScheduler';
import {
  Compass,
  Bluetooth,
  Wifi,
  Radio,
  Navigation,
  Signal,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Info,
  Crosshair,
  Sliders,
  Check,
  Activity,
} from 'lucide-react';

interface OfflineRadarCanvasProps {
  peers: MeshNode[];
  onSelectPeer: (peer: MeshNode) => void;
  isSolarAware: boolean;
  selectedPeerId?: string | null;
  isNightMode?: boolean;
}

/**
 * Maps an RSSI value (-40 dBm to -95 dBm) directly to a normalized polar radius ratio (0.22 to 0.94).
 * Stronger signals (-40 dBm) sit near the center; weaker signals (-95 dBm) sit near the outer perimeter.
 */
function rssiToDistanceRatio(rssi: number): number {
  const maxRssi = -40; // Closest / strongest
  const minRssi = -95; // Perimeter / weakest
  const clamped = Math.max(minRssi, Math.min(maxRssi, rssi));
  const norm = (maxRssi - clamped) / (maxRssi - minRssi); // 0 (center) to 1 (outer)
  return 0.22 + norm * 0.72;
}

/**
 * Normalizes an angle into [0, 360) degrees.
 */
function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export const OfflineRadarCanvas: React.FC<OfflineRadarCanvasProps> = ({
  peers,
  onSelectPeer,
  isSolarAware,
  selectedPeerId,
  isNightMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 340 });
  const [hoveredPeer, setHoveredPeer] = useState<MeshNode | null>(null);

  // Radio Protocol Filter: 'all' | 'ble' | 'wifi_direct'
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'ble' | 'wifi_direct'>('all');

  // Real-time location simulation offset (helps users test moving around to optimize location)
  const [simulatedOffsetDb, setSimulatedOffsetDb] = useState<number>(0);
  const [isLiveJitterActive, setIsLiveJitterActive] = useState<boolean>(true);
  const [liveJitterMap, setLiveJitterMap] = useState<Record<string, number>>({});

  // Responsive Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width } = entries[0].contentRect;
      const size = Math.min(Math.max(width, 280), 440);
      setDimensions({ width: size, height: size });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Real-time micro-fluctuations in RF signal (simulating natural multipath fading & beacon packets)
  useEffect(() => {
    if (!isLiveJitterActive) {
      setLiveJitterMap({});
      return;
    }

    const interval = setInterval(() => {
      const jitter: Record<string, number> = {};
      peers.forEach((p) => {
        // Natural ±1.5 dBm fluctuation
        jitter[p.id] = Math.round((Math.sin(Date.now() / 1200 + p.angle) * 1.5 + (Math.random() - 0.5) * 1.2) * 10) / 10;
      });
      setLiveJitterMap(jitter);
    }, 1800);

    return () => clearInterval(interval);
  }, [peers, isLiveJitterActive]);

  // Filtered peers list with simulated RSSI offsets applied
  const processedPeers = useMemo(() => {
    return peers
      .filter((p) => {
        const proto = p.radioType || (p.isDirect && p.lastRssi > -65 ? 'Wi-Fi Direct' : 'BLE');
        if (protocolFilter === 'ble') return proto === 'BLE';
        if (protocolFilter === 'wifi_direct') return proto === 'Wi-Fi Direct';
        return true;
      })
      .map((p) => {
        const proto: PeerRadioType = p.radioType || (p.isDirect && p.lastRssi > -65 ? 'Wi-Fi Direct' : 'BLE');
        const jitter = liveJitterMap[p.id] || 0;
        // Apply simulated location step offset and live RF jitter
        const effectiveRssi = Math.min(-38, Math.max(-98, p.lastRssi + simulatedOffsetDb + jitter));
        const effectiveDistanceRatio = rssiToDistanceRatio(effectiveRssi);

        return {
          ...p,
          radioType: proto,
          effectiveRssi: Math.round(effectiveRssi * 10) / 10,
          effectiveDistanceRatio,
        };
      });
  }, [peers, protocolFilter, simulatedOffsetDb, liveJitterMap]);

  // Compute Optimal Routing Azimuth & Location Quality Score
  const routingAdvice = useMemo(() => {
    if (processedPeers.length === 0) {
      return {
        optimalAzimuth: 45,
        azimuthLabel: 'N/A',
        routingScore: 20,
        qualityTier: 'Ühendused puuduvad',
        primaryRelay: null,
        adviceText: 'Majakasignaale pole tuvastatud. Liigu avatud alale või kõrgemale positsioonile.',
        linkMarginDb: 0,
      };
    }

    let sumX = 0;
    let sumY = 0;
    let totalWeight = 0;
    let bestDirectPeer: (MeshNode & { effectiveRssi: number }) | null = null;
    let maxRssi = -120;

    processedPeers.forEach((p) => {
      // Weight by signal strength (stronger signal = higher weight)
      const weight = Math.max(5, 100 + p.effectiveRssi);
      const rad = (p.angle * Math.PI) / 180;
      sumX += Math.cos(rad) * weight;
      sumY += Math.sin(rad) * weight;
      totalWeight += weight;

      if (p.effectiveRssi > maxRssi) {
        maxRssi = p.effectiveRssi;
        bestDirectPeer = p;
      }
    });

    let optimalAzimuth = 45;
    if (totalWeight > 0) {
      const avgRad = Math.atan2(sumY, sumX);
      optimalAzimuth = normalizeAngle(Math.round((avgRad * 180) / Math.PI));
    }

    // Determine compass cardinal sector
    const cardinalLabels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const sectorIdx = Math.round(optimalAzimuth / 45) % 8;
    const azimuthLabel = `${optimalAzimuth}° ${cardinalLabels[sectorIdx]}`;

    // Score calculation
    const directCount = processedPeers.filter((p) => p.isDirect || p.effectiveRssi >= -65).length;
    let routingScore = Math.min(100, Math.max(30, 40 + directCount * 20 + (maxRssi + 80) * 0.8));
    if (simulatedOffsetDb > 0) routingScore = Math.min(100, routingScore + 8);
    routingScore = Math.round(routingScore);

    let qualityTier = 'Stabiilne võrguala (Good)';
    if (routingScore >= 85) qualityTier = 'Optimaalne asukoht (Optimal)';
    else if (routingScore < 60) qualityTier = 'Nõrk piiriala (Reposition)';

    const linkMarginDb = Math.max(0, Math.round(maxRssi - -95));

    let adviceText = '';
    if (routingScore >= 85) {
      adviceText = `Oled suurepärases RF-asendis. Otselink ${bestDirectPeer ? bestDirectPeer.callsign : 'partneriga'} (${maxRssi} dBm) tagab katkematu pakettide ruutimise.`;
    } else if (routingScore >= 60) {
      adviceText = `Võrguühendus on stabiilne. Suuna seade ${azimuthLabel} poole või liigu 2-3m avatud vaatevälja, et tõsta link täiskiirusele.`;
    } else {
      adviceText = `Signaalid on piirialal. Soovitatav on liikuda ${azimuthLabel} suunas või tõsta terminal kõrgemale (Fresneli tsoon).`;
    }

    return {
      optimalAzimuth,
      azimuthLabel,
      routingScore,
      qualityTier,
      primaryRelay: bestDirectPeer,
      adviceText,
      linkMarginDb,
    };
  }, [processedPeers, simulatedOffsetDb]);

  // Canvas render loop for radar sweep, range rings, and optimal vector cone
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;
    const dpr = window.devicePixelRatio || 1;
    const size = dimensions.width;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size / 2 - 20;

    // Slower sweep when solar-aware mode is active (energy saver)
    const sweepSpeed = isSolarAware ? 0.014 : 0.032;

    const render = () => {
      angle = (angle + sweepSpeed) % (Math.PI * 2);
      ctx.clearRect(0, 0, size, size);

      // 1. Radar background disc
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      if (isNightMode) {
        bgGrad.addColorStop(0, '#131D11');
        bgGrad.addColorStop(0.7, '#162314');
        bgGrad.addColorStop(1, '#1A2817');
      } else {
        bgGrad.addColorStop(0, '#FAF6EE');
        bgGrad.addColorStop(0.7, '#F0F5EE');
        bgGrad.addColorStop(1, '#E2EBE0');
      }

      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.fillStyle = bgGrad;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = isNightMode ? '#364E30' : '#87A878';
      ctx.stroke();

      // 2. Concentric Range Rings strictly mapped to RSSI (dBm)
      const ringLevels = [
        { rssi: -45, label: '-45 dBm • Otselink (Optimal)', color: '#2A9D8F' },
        { rssi: -60, label: '-60 dBm • Tugev relee (Strong)', color: '#588157' },
        { rssi: -75, label: '-75 dBm • Relee tsoon (Stable)', color: '#E9C46A' },
        { rssi: -90, label: '-90 dBm • Piiriala (Fringe)', color: '#E76F51' },
      ];

      ringLevels.forEach((ring) => {
        const ratio = rssiToDistanceRatio(ring.rssi);
        const r = maxRadius * ratio;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color + (isNightMode ? '40' : '48');
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // dBm Label
        ctx.fillStyle = isNightMode ? '#87A878' : '#637062';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(ring.label, cx + 5, cy - r + 10);
      });

      // 3. Polar Axis Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.strokeStyle = isNightMode ? '#364E3040' : '#87A87835';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bioregional cardinal markers
      ctx.font = '9px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = isNightMode ? '#A8BDA5' : '#588157';
      ctx.fillText('N • RIDGE', cx - 22, cy - maxRadius + 13);
      ctx.fillText('S • BASIN', cx - 20, cy + maxRadius - 5);
      ctx.fillText('W', cx - maxRadius + 5, cy + 3);
      ctx.fillText('E', cx + maxRadius - 12, cy + 3);

      // 4. Optimal Routing Vector Cone (Helps users orient towards best location)
      if (processedPeers.length > 0) {
        const optRad = (routingAdvice.optimalAzimuth * Math.PI) / 180;
        const coneWidth = 0.35; // radians
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, optRad - coneWidth, optRad + coneWidth);
        ctx.closePath();
        ctx.fillStyle = isNightMode ? '#2A9D8F18' : '#2A9D8F22';
        ctx.fill();

        // Directional guide vector arrow
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(optRad) * maxRadius, cy + Math.sin(optRad) * maxRadius);
        ctx.strokeStyle = '#2A9D8F';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 5. Active Link Line to Selected Peer
      if (selectedPeerId) {
        const selected = processedPeers.find((p) => p.id === selectedPeerId);
        if (selected) {
          const selRad = (selected.angle * Math.PI) / 180;
          const selR = selected.effectiveDistanceRatio * maxRadius;
          const px = cx + Math.cos(selRad) * selR;
          const py = cy + Math.sin(selRad) * selR;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
          ctx.strokeStyle = selected.radioType === 'Wi-Fi Direct' ? '#E9C46A' : '#2A9D8F';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // 6. Rotating Radar Sweep Cone & Beam
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, angle - 0.42, angle);
      ctx.closePath();

      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      if (isNightMode) {
        sweepGrad.addColorStop(0, '#87A87815');
        sweepGrad.addColorStop(1, '#E9C46A35');
      } else {
        sweepGrad.addColorStop(0, '#87A87820');
        sweepGrad.addColorStop(1, '#E9C46A40');
      }
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Leading beam line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
      ctx.strokeStyle = '#E9C46A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 7. Empty State Message
      if (processedPeers.length === 0) {
        ctx.fillStyle = isNightMode ? '#A8BDA5' : '#637062';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Valitud raadiokanalil signaale pole', cx, cy - 8);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#87A878';
        ctx.fillText('Otsitakse BLE majakaid ja Wi-Fi Direct sõlmi...', cx, cy + 12);
        ctx.textAlign = 'start';
      }

      // 8. Central Self Node (Kestrel-7)
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#2A9D8F';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Self pulse wave
      const pulse = 7 + Math.sin(Date.now() / 450) * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#2A9D8F55';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const unregister = rafScheduler.register('offline-radar-canvas', render);

    return () => {
      unregister();
    };
  }, [dimensions, processedPeers, isSolarAware, isNightMode, routingAdvice, selectedPeerId]);

  const size = dimensions.width;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 20;

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full space-y-4">
      {/* Radio Protocol Filter Controls & Live Simulation Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2">
        {/* Protocol Filter Pills */}
        <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs ${
          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-2xs'
        }`}>
          <button
            type="button"
            onClick={() => setProtocolFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              protocolFilter === 'all'
                ? 'bg-[#588157] text-white font-bold shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Kõik ({peers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setProtocolFilter('ble')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              protocolFilter === 'ble'
                ? 'bg-[#2A9D8F] text-white font-bold shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
            }`}
          >
            <Bluetooth className="w-3 h-3" />
            <span>BLE ({peers.filter((p) => (p.radioType || 'BLE') === 'BLE').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setProtocolFilter('wifi_direct')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              protocolFilter === 'wifi_direct'
                ? 'bg-[#E9C46A] text-[#243128] font-bold shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A]'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>Wi-Fi Direct ({peers.filter((p) => (p.radioType || 'Wi-Fi Direct') === 'Wi-Fi Direct').length})</span>
          </button>
        </div>

        {/* Live Jitter & Offset Simulation Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulatedOffsetDb((prev) => (prev === 0 ? 5 : 0))}
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-semibold border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              simulatedOffsetDb > 0
                ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
                : isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30]'
                : 'bg-white text-[#637062] border-[#87A878]/30'
            }`}
            title="Simuleeri liikumist optimaalsesse asukohta (+5 dBm signaalitõus)"
          >
            <Navigation className="w-3 h-3" />
            <span>{simulatedOffsetDb > 0 ? 'Asukoht: +5 dBm' : 'Testi asukohanihkust'}</span>
          </button>
        </div>
      </div>

      {/* Main Radar Canvas Container */}
      <div
        className={`relative rounded-full shadow-inner border overflow-hidden ${
          isNightMode ? 'border-[#364E30] bg-[#162214]' : 'border-[#87A878]/30 bg-[#FAF6EE]'
        }`}
        style={{ width: size, height: size }}
      >
        <canvas ref={canvasRef} style={{ width: size, height: size }} className="block" />

        {/* DOM-rendered Peer Nodes with SVG Pulse Animations & Procedural Avatars */}
        {processedPeers.map((peer) => {
          const rad = (peer.angle * Math.PI) / 180;
          const r = peer.effectiveDistanceRatio * maxRadius;
          const px = cx + Math.cos(rad) * r;
          const py = cy + Math.sin(rad) * r;

          const isSelected = selectedPeerId === peer.id;
          const isHovered = hoveredPeer?.id === peer.id;
          const isWifi = peer.radioType === 'Wi-Fi Direct';

          const stateSymbol =
            peer.connectionState === 'direct'
              ? '✓'
              : peer.connectionState === 'relayed'
              ? '↷'
              : '⏳';

          return (
            <div
              key={peer.id}
              onClick={() => onSelectPeer(peer)}
              onMouseEnter={() => setHoveredPeer(peer)}
              onMouseLeave={() => setHoveredPeer(null)}
              style={{
                left: `${px}px`,
                top: `${py}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute cursor-pointer group transition-transform duration-200 hover:scale-125 z-20 canvas-tap-target"
              title={`${peer.callsign} (${peer.effectiveRssi} dBm, ${peer.radioType})`}
              tabIndex={0}
              role="button"
              aria-label={`Select peer ${peer.callsign}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelectPeer(peer);
              }}
            >
              {/* SVG Pulse Animation Container wrapping the peer node */}
              <div className="relative">
                <PeerSignalPulseSVG
                  rssi={peer.effectiveRssi}
                  connectionState={peer.connectionState}
                  isDirect={peer.isDirect}
                  isNightMode={isNightMode}
                  size={52}
                  className="transition-transform duration-200"
                >
                  <div
                    className={`p-0.5 rounded-full shadow-md transition-all ${
                      isNightMode ? 'bg-[#182315]' : 'bg-white'
                    } ${
                      isSelected
                        ? 'ring-2 ring-[#E76F51] ring-offset-2'
                        : isWifi
                        ? 'ring-1.5 ring-[#E9C46A]'
                        : 'ring-1 ring-[#2A9D8F]'
                    }`}
                  >
                    <SolarpunkAvatarCanvas seed={peer.avatarSeed} size={28} />
                  </div>
                </PeerSignalPulseSVG>

                {/* Protocol Badge Tag at top */}
                <span
                  className={`absolute -top-1.5 -right-1.5 text-[8px] font-mono font-bold px-1 py-0.2 rounded-full shadow-xs z-20 flex items-center gap-0.5 border ${
                    isWifi
                      ? 'bg-[#E9C46A] text-[#243128] border-[#dfba5f]'
                      : 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                  }`}
                >
                  {isWifi ? <Wifi className="w-2.5 h-2.5" /> : <Bluetooth className="w-2.5 h-2.5" />}
                  <span>{isWifi ? 'Wi-Fi' : 'BLE'}</span>
                </span>

                {/* State Tag symbol at lower corner */}
                <span
                  className={`absolute bottom-0 right-0 text-[8px] font-bold px-1 rounded-full shadow-xs z-20 ${
                    peer.connectionState === 'direct'
                      ? 'bg-[#588157] text-white'
                      : peer.connectionState === 'relayed'
                      ? 'bg-[#E9C46A] text-[#243128]'
                      : 'bg-[#E76F51] text-white'
                  }`}
                >
                  {stateSymbol}
                </span>
              </div>

              {/* Tooltip on hover or selection */}
              {(isHovered || isSelected) && (
                <div
                  className={`absolute left-1/2 -bottom-14 -translate-x-1/2 whitespace-nowrap text-[11px] px-2.5 py-1.5 rounded-xl shadow-xl pointer-events-none z-30 flex flex-col gap-0.5 border ${
                    isNightMode
                      ? 'bg-[#121A10]/95 text-[#F0F5EE] border-[#87A878]/50'
                      : 'bg-[#203A2A]/95 text-white border-[#87A878]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <span>{peer.callsign}</span>
                    <span className={`text-[9px] px-1.5 rounded font-mono ${
                      isWifi ? 'bg-[#E9C46A] text-[#243128]' : 'bg-[#2A9D8F] text-white'
                    }`}>
                      {peer.radioType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-gray-300">
                    <span className="font-bold text-[#E9C46A]">{peer.effectiveRssi} dBm</span>
                    <span>•</span>
                    <span>{peer.hopDistance} {peer.hopDistance === 1 ? 'hop (Otselink)' : 'hops (Relee)'}</span>
                    <span>•</span>
                    <span className="text-[#87A878]">{peer.channelOrFrequency || 'Ch 37'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Real-time Location Guidance & Mesh Routing Advisor Card */}
      <div className={`w-full p-4 rounded-2xl border space-y-2.5 transition-colors ${
        isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-xs'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-current/10">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#2A9D8F]" />
            <span className="font-display font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
              Ruutingukvaliteedi ja asukoha teejuht (Mesh Location Advisor)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              routingAdvice.routingScore >= 80
                ? 'bg-green-500/15 text-green-600 border-green-500/30'
                : routingAdvice.routingScore >= 60
                ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                : 'bg-red-500/15 text-red-600 border-red-500/30'
            }`}>
              {routingAdvice.qualityTier} ({routingAdvice.routingScore}%)
            </span>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30 font-bold">
              Veerand: {routingAdvice.azimuthLabel}
            </span>
          </div>
        </div>

        {/* Dynamic Contextual Guidance Text */}
        <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
          {routingAdvice.adviceText}
        </p>

        {/* Quick RF Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] dark:bg-black/25">
            <span className="text-[#637062] dark:text-[#87A878]">Peavärav:</span>
            <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
              {routingAdvice.primaryRelay ? routingAdvice.primaryRelay.callsign : 'Otsitakse...'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] dark:bg-black/25">
            <span className="text-[#637062] dark:text-[#87A878]">Link Margin:</span>
            <span className="font-bold text-[#2A9D8F]">+{routingAdvice.linkMarginDb} dB</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] dark:bg-black/25 col-span-2 sm:col-span-1">
            <span className="text-[#637062] dark:text-[#87A878]">Suunavektor:</span>
            <span className="font-bold text-[#E9C46A]">{routingAdvice.azimuthLabel}</span>
          </div>
        </div>
      </div>

      {/* Telemetry Protocol Legend */}
      <div
        className={`w-full flex flex-wrap items-center justify-between gap-3 text-xs pt-1 ${
          isNightMode ? 'text-[#A8BDA5]' : 'text-[#637062]'
        }`}
      >
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2A9D8F]" />
            BLE 5.0 (2 Mbps)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E9C46A]" />
            Wi-Fi Direct (54 Mbps)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-[#588157]">
            <span>✓</span> Otselink (Direct)
          </span>
          <span className="flex items-center gap-1 text-[#E9C46A]">
            <span>↷</span> Relee (Relayed)
          </span>
        </div>
      </div>
    </div>
  );
};
