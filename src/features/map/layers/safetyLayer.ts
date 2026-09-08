import { SurvivalPoi } from '../../../types';

export function drawSafetyLayer(
  ctx: CanvasRenderingContext2D,
  pois: SurvivalPoi[],
  projectLatOption: (lat: number, lng: number) => { x: number; y: number },
  isDark: boolean
) {
  pois.forEach((poi) => {
    const lat = (poi as any).lat ?? (59.437 + (poi.y || 0) * 0.001);
    const lng = (poi as any).lng ?? (24.7535 + (poi.x || 0) * 0.001);
    const pt = projectLatOption(lat, lng);

    ctx.fillStyle = '#E76F51';
    ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);

    ctx.fillStyle = isDark ? '#F0F5EE' : '#203A2A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poi.name, pt.x, pt.y + 14);
  });
}
