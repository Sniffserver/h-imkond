import React from 'react';
import { ConnectionState } from '../types';

interface PeerSignalPulseSVGProps {
  rssi: number;
  connectionState: ConnectionState;
  isDirect?: boolean;
  isTransmitting?: boolean;
  size?: number;
  className?: string;
  isNightMode?: boolean;
  children?: React.ReactNode;
}

export const PeerSignalPulseSVG: React.FC<PeerSignalPulseSVGProps> = ({
  rssi,
  connectionState,
  isDirect = false,
  isTransmitting = true,
  size = 54,
  className = '',
  isNightMode = false,
  children,
}) => {
  // Signal strength classification
  // Strong: >= -58 dBm, Moderate: -59 to -75 dBm, Weak: < -75 dBm
  const isStrong = rssi >= -58;
  const isModerate = rssi >= -75 && rssi < -58;
  const isWeak = rssi < -75;

  // Visual Palette depending on connection state and signal level
  const pulseColor =
    connectionState === 'direct' || isDirect
      ? isNightMode ? '#87A878' : '#588157'
      : connectionState === 'relayed'
      ? isNightMode ? '#E9C46A' : '#D4A338'
      : isNightMode ? '#F4A261' : '#E76F51';

  const secondaryColor =
    connectionState === 'direct'
      ? '#2A9D8F'
      : connectionState === 'relayed'
      ? '#F4A261'
      : '#E76F51';

  // Duration scales inversely with signal strength: strong = faster ping, weak = slow dissipation
  const pulseDuration = isStrong ? '1.4s' : isModerate ? '2.1s' : '3.0s';
  const delayStep = isStrong ? 0.45 : isModerate ? 0.7 : 1.0;

  // Geometry
  const viewBoxSize = 100;
  const center = viewBoxSize / 2; // 50
  const innerRadius = 22; // node boundary
  const maxPulseRadius = 46; // outer ripple

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background SVG Pulse & RF Transmission Layer */}
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Gradient for Active Signal Halo */}
          <radialGradient id={`pulse-grad-${rssi}-${connectionState}-${isNightMode ? 'dark' : 'light'}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={pulseColor} stopOpacity="0.35" />
            <stop offset="60%" stopColor={pulseColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={pulseColor} stopOpacity="0" />
          </radialGradient>

          {/* Glow filter for active transmissions */}
          <filter id={`glow-${connectionState}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Static Ambience Base Halo */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius + 4}
          fill={`url(#pulse-grad-${rssi}-${connectionState}-${isNightMode ? 'dark' : 'light'})`}
        />

        {/* 2. Wave 1: Primary Concentric Pulse Ring */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={pulseColor}
          strokeWidth="1.8"
          strokeOpacity="0.9"
        >
          <animate
            attributeName="r"
            values={`${innerRadius}; ${maxPulseRadius}`}
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.21, 0.61, 0.35, 1"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.85; 0"
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.21, 0.61, 0.35, 1"
          />
          <animate
            attributeName="stroke-width"
            values="2.2; 0.6"
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
          />
        </circle>

        {/* 3. Wave 2: Staggered Secondary Pulse Ring */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={pulseColor}
          strokeWidth="1.5"
          strokeOpacity="0.75"
        >
          <animate
            attributeName="r"
            values={`${innerRadius}; ${maxPulseRadius}`}
            begin={`${delayStep}s`}
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.21, 0.61, 0.35, 1"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.75; 0"
            begin={`${delayStep}s`}
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.21, 0.61, 0.35, 1"
          />
          <animate
            attributeName="stroke-width"
            values="1.8; 0.5"
            begin={`${delayStep}s`}
            dur={pulseDuration}
            repeatCount="indefinite"
            keyTimes="0; 1"
          />
        </circle>

        {/* 4. Wave 3: Strong Signal High-Cadence Ripple (Direct/Strong nodes only) */}
        {isStrong && (
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1.2"
            strokeOpacity="0.6"
          >
            <animate
              attributeName="r"
              values={`${innerRadius}; ${maxPulseRadius * 0.85}`}
              begin={`${delayStep * 2}s`}
              dur={pulseDuration}
              repeatCount="indefinite"
              keyTimes="0; 1"
            />
            <animate
              attributeName="stroke-opacity"
              values="0.6; 0"
              begin={`${delayStep * 2}s`}
              dur={pulseDuration}
              repeatCount="indefinite"
              keyTimes="0; 1"
            />
          </circle>
        )}

        {/* 5. RF Transmission Activity Orbit / Directional Beacon Arcs */}
        {isTransmitting && (
          <g transform={`rotate(0 ${center} ${center})`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${center} ${center}`}
              to={`360 ${center} ${center}`}
              dur={isStrong ? '5s' : isModerate ? '8s' : '12s'}
              repeatCount="indefinite"
            />

            {/* Orbiting RF Broadcast Arc 1 */}
            <path
              d={`M ${center - 25} ${center - 6} A 26 26 0 0 1 ${center - 6} ${center - 25}`}
              fill="none"
              stroke={pulseColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeOpacity="0.9"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.4; 1; 0.4"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </path>

            {/* Orbiting RF Broadcast Arc 2 (Opposing polarity) */}
            <path
              d={`M ${center + 25} ${center + 6} A 26 26 0 0 1 ${center + 6} ${center + 25}`}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeOpacity="0.9"
            >
              <animate
                attributeName="stroke-opacity"
                values="1; 0.4; 1"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </path>

            {/* Micro Packet Photon Particle */}
            <circle
              cx={center + 26}
              cy={center}
              r="2.2"
              fill={isNightMode ? '#FAF6EE' : pulseColor}
            >
              <animate
                attributeName="r"
                values="1.8; 2.6; 1.8"
                dur="1.2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.5; 1; 0.5"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        )}

        {/* 6. Static Node Perimeter Ring */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={pulseColor}
          strokeWidth="1.5"
          strokeDasharray={connectionState === 'store_forward' ? '3, 2' : undefined}
          strokeOpacity={isNightMode ? 0.75 : 0.6}
        />
      </svg>

      {/* Centered Node Child Element (Avatar / Icon / Content) */}
      <div className="relative z-10 flex items-center justify-center pointer-events-auto">
        {children}
      </div>
    </div>
  );
};

/**
 * Compact SVG Signal Strength Meter with active pulsing RF waves
 */
export const SignalStrengthMeterSVG: React.FC<{
  rssi: number;
  connectionState: ConnectionState;
  isNightMode?: boolean;
  showDbm?: boolean;
}> = ({ rssi, connectionState, isNightMode = false, showDbm = true }) => {
  // Bar count calculation: 4 bars max
  const activeBars =
    rssi >= -50 ? 4 : rssi >= -65 ? 3 : rssi >= -80 ? 2 : 1;

  const barColor =
    connectionState === 'direct'
      ? isNightMode ? '#87A878' : '#588157'
      : connectionState === 'relayed'
      ? isNightMode ? '#E9C46A' : '#D4A338'
      : isNightMode ? '#F4A261' : '#E76F51';

  const inactiveBarColor = isNightMode ? '#2A3B26' : '#D8E2D4';

  return (
    <div className="inline-flex items-center gap-1.5 font-mono">
      {/* SVG Wave/Bar Array with active pulse glow */}
      <svg width="22" height="16" viewBox="0 0 22 16" className="overflow-visible" xmlns="http://www.w3.org/2000/svg">
        {/* Bar 1 (Shortest - 4px) */}
        <rect
          x="1"
          y="11"
          width="3.5"
          height="5"
          rx="1"
          fill={activeBars >= 1 ? barColor : inactiveBarColor}
        />

        {/* Bar 2 (Medium Low - 7px) */}
        <rect
          x="6.5"
          y="8"
          width="3.5"
          height="8"
          rx="1"
          fill={activeBars >= 2 ? barColor : inactiveBarColor}
        />

        {/* Bar 3 (Medium High - 11px) */}
        <rect
          x="12"
          y="4.5"
          width="3.5"
          height="11.5"
          rx="1"
          fill={activeBars >= 3 ? barColor : inactiveBarColor}
        />

        {/* Bar 4 (Full - 15px) */}
        <rect
          x="17.5"
          y="1"
          width="3.5"
          height="15"
          rx="1"
          fill={activeBars >= 4 ? barColor : inactiveBarColor}
        />

        {/* Active Signal Transmission Ping dot at top of highest active bar */}
        <circle
          cx={activeBars === 4 ? 19.25 : activeBars === 3 ? 13.75 : activeBars === 2 ? 8.25 : 2.75}
          cy={activeBars === 4 ? 1 : activeBars === 3 ? 4.5 : activeBars === 2 ? 8 : 11}
          r="1.8"
          fill={barColor}
        >
          <animate
            attributeName="opacity"
            values="0.3; 1; 0.3"
            dur="1.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="1.2; 2.4; 1.2"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {showDbm && (
        <span
          className={`text-[10px] font-semibold ${
            isNightMode ? 'text-[#E9C46A]' : 'text-[#588157]'
          }`}
        >
          {rssi} dBm
        </span>
      )}
    </div>
  );
};
