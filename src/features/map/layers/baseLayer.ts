export interface BaseLayerConfig {
  theme: 'light' | 'dark' | 'direct_sun';
  gridSizePx: number;
  showCoordinates: boolean;
  isHighContrast: boolean;
}

export function drawBaseLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: BaseLayerConfig
) {
  const isDark = config.theme === 'dark';
  const isDirectSun = config.theme === 'direct_sun';

  // Background canvas fill
  ctx.fillStyle = isDirectSun ? '#FFFFFF' : isDark ? '#121A10' : '#FAF6EE';
  ctx.fillRect(0, 0, width, height);

  // Topo contour grid lines
  ctx.lineWidth = config.isHighContrast ? 1.5 : 1;
  ctx.strokeStyle = isDirectSun
    ? '#0000001A'
    : isDark
    ? 'rgba(54, 78, 48, 0.25)'
    : 'rgba(135, 168, 120, 0.2)';

  const gridStep = config.gridSizePx;
  for (let x = 0; x < width; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}
