import { MapEngineState } from '../mapState';
import { drawBaseLayer } from '../layers/baseLayer';

export function renderCanvasFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: MapEngineState,
  isNightMode: boolean
) {
  drawBaseLayer(ctx, width, height, {
    theme: isNightMode ? 'dark' : 'light',
    gridSizePx: 40,
    showCoordinates: true,
    isHighContrast: false,
  });
}
