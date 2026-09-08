import React from 'react';
import { MapQualityMode } from '../mapCapabilities';

export interface SmartZoomConfig {
  zoomLevel: number;
  qualityMode?: MapQualityMode;
  showCities: boolean;
  showNeighborhoods: boolean;
  showPeerClusters: boolean;
  showIndividualPeers: boolean;
  showResources: boolean;
  showSignalHeatmap: boolean;
  isReducedDetail: boolean;
}

export function calculateSmartZoomConfig(
  zoomLevel: number,
  qualityMode: MapQualityMode = 'balanced'
): SmartZoomConfig {
  const isPowerSaver = qualityMode === 'power_saver';

  // Zoom brackets:
  // Level 5-10: Regional / Cities / Bioregional boundaries
  // Level 10-14: Neighborhoods / Clustered Nodes
  // Level 15+: Street / Individual peers & mutual aid resources
  const isRegional = zoomLevel < 10;
  const isDistrict = zoomLevel >= 10 && zoomLevel < 15;
  const isStreetLevel = zoomLevel >= 15;

  return {
    zoomLevel,
    qualityMode,
    showCities: isRegional || isDistrict,
    showNeighborhoods: isDistrict || isStreetLevel,
    showPeerClusters: isDistrict && !isPowerSaver,
    showIndividualPeers: isStreetLevel || (isDistrict && isPowerSaver),
    showResources: isStreetLevel && !isPowerSaver,
    showSignalHeatmap: isStreetLevel && qualityMode === 'detail',
    isReducedDetail: isPowerSaver,
  };
}

export interface SmartZoomBadgeProps {
  zoomLevel: number;
  qualityMode?: MapQualityMode;
  isNightMode?: boolean;
}

export const SmartZoomBadge: React.FC<SmartZoomBadgeProps> = ({
  zoomLevel,
  qualityMode = 'balanced',
  isNightMode = false,
}) => {
  const config = calculateSmartZoomConfig(zoomLevel, qualityMode);

  const zoomLabel =
    zoomLevel < 10
      ? 'Regional View'
      : zoomLevel < 15
      ? 'Neighborhood View'
      : 'Street View';

  return (
    <div
      role="status"
      aria-label={`Current Map Detail: ${zoomLabel}, Zoom ${zoomLevel.toFixed(1)}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono border backdrop-blur-md shadow-xs ${
        isNightMode
          ? 'bg-[#182315]/80 border-[#2A3B26] text-[#A8BDA5]'
          : 'bg-[#FAF6EE]/80 border-[#87A878]/30 text-[#588157]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#2A9D8F]" />
      <span className="font-bold">{zoomLabel}</span>
      <span className="opacity-60">Z{zoomLevel.toFixed(1)}</span>
      {config.isReducedDetail && (
        <span className="text-amber-500 font-bold ml-1">(Eco Mode)</span>
      )}
    </div>
  );
};
