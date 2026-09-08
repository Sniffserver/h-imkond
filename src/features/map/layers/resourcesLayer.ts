import { ResourceItem } from '../../../types';
import { SpatialGridCluster } from '../mapState';

export function drawResourcesLayer(
  ctx: CanvasRenderingContext2D,
  resources: ResourceItem[],
  clusters: SpatialGridCluster<ResourceItem>[],
  projectLatOption: (lat: number, lng: number) => { x: number; y: number },
  isDark: boolean
) {
  resources.forEach((res) => {
    const lat = (res as any).lat ?? (59.437 + (res.coordinates?.y || 0) * 0.001);
    const lng = (res as any).lng ?? (24.7535 + (res.coordinates?.x || 0) * 0.001);
    const pt = projectLatOption(lat, lng);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#E9C46A' : '#588157';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    if (resources.length < 50) {
      ctx.fillStyle = isDark ? '#A8BDA5' : '#3A4A38';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(res.title, pt.x, pt.y + 15);
    }
  });
}
