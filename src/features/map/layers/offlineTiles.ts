import { offlineMapService } from '../../../services/map/offlineMapService';

export interface TileRenderInfo {
  x: number;
  y: number;
  z: number;
  canvasX: number;
  canvasY: number;
  size: number;
}

export function drawOfflineTiles(
  ctx: CanvasRenderingContext2D,
  tiles: TileRenderInfo[],
  isDark: boolean
) {
  tiles.forEach((tile) => {
    // Draw placeholder or cached raster tile boundary
    ctx.strokeStyle = isDark ? 'rgba(233, 196, 106, 0.15)' : 'rgba(88, 129, 87, 0.15)';
    ctx.strokeRect(tile.canvasX, tile.canvasY, tile.size, tile.size);
  });
}
