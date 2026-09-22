import React, { lazy, Suspense } from 'react';
import type { BioregionalMapCanvasProps } from './BioregionalMapCanvas';
import { MapSkeleton } from '../features/map/MapSkeleton';

const BioregionalMapCanvas = lazy(() =>
  import('./BioregionalMapCanvas').then((m) => ({ default: m.BioregionalMapCanvas }))
);

/**
 * OfflineMapCanvas - High-performance offline map canvas with 60FPS fluid motion,
 * throttled state synchronization, kinetic inertia panning, and focal-point pinch-to-zoom.
 * Wrapped in lazy dynamic import to keep initial bundle ultra-lean.
 */
export const OfflineMapCanvas: React.FC<BioregionalMapCanvasProps> = (props) => (
  <Suspense fallback={<MapSkeleton isNightMode={props.isNightMode} />}>
    <BioregionalMapCanvas {...props} />
  </Suspense>
);

export { BioregionalMapCanvas };
export type { BioregionalMapCanvasProps };
export default OfflineMapCanvas;

