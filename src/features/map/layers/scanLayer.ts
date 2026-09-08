import { WifiSpot } from '../../../types';

export function drawScanLayer(
  ctx: CanvasRenderingContext2D,
  spots: WifiSpot[],
  projectLatOption: (lat: number, lng: number) => { x: number; y: number },
  isDark: boolean
) {
  spots.forEach((spot) => {
    const pt = projectLatOption(spot.latitude, spot.longitude);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = spot.security === 'open' ? '#34C759' : '#E76F51';
    ctx.fill();
  });
}
