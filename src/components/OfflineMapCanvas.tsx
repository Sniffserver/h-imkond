import React from 'react';
import { BioregionalMapCanvas, BioregionalMapCanvasProps } from './BioregionalMapCanvas';

/**
 * OfflineMapCanvas - High-performance offline map canvas with 60FPS fluid motion,
 * throttled state synchronization, kinetic inertia panning, and focal-point pinch-to-zoom.
 */
export const OfflineMapCanvas: React.FC<BioregionalMapCanvasProps> = BioregionalMapCanvas;
export { BioregionalMapCanvas };
export type { BioregionalMapCanvasProps };
export default OfflineMapCanvas;
